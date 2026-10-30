# Specification 4: UI Proxy Backend
The following specification outlines the FastAPI service `ui_proxy` that serves the web UI, owns all vendor-PDF ingestion, proxies chat to watsonx Orchestrate (WXO) and exposes the Governance endpoints.

## Prerequisites
Load any skills that seem relevant — new ones may be added over time. Review [`backend/api_endpoints.md`](backend/api_endpoints.md) first.

## Requirements to follow
* Python 3.11, FastAPI, uvicorn, httpx, pydantic v2, `python-multipart`, `python-dotenv`, `ibm-cos-sdk`, `astrapy`, `pymupdf`. Pin direct dependencies to exact versions.
* Create all files under [`services/ui_proxy/`](../services/ui_proxy): `main.py`, `requirements.txt`, `.env.example`, `Dockerfile`, `.dockerignore`, `k8s/deployment.yaml`. The UI (`index.html`, Spec 5) is served by this same app.
* All configuration from environment variables (see [`.env_template`](../.env_template)); never hard-code.
* Use `snake_case` in all JSON.
* Single container, single port **8080**, single replica (sessions are in memory).

## Why PDF ingestion happens here (not in WXO)
The WXO `/upload-to-s3/` endpoint is not available on the target SaaS instance. The proxy therefore parses PDFs itself and gives the agent only a `session_id` plus a COS URL. **The agent never handles file bytes and never calls an ingestion tool.**

## Step 1: Start-up (lifespan)
1. Fail fast if a required variable is missing, or `UI_PASSWORD` is shorter than **12** characters.
2. Obtain a WXO bearer token. If `WXO_API_KEY` starts with `ZenApiKey` use it directly; otherwise exchange the IBM Cloud API key at `https://iam.cloud.ibm.com/identity/token` (grant `urn:ibm:params:oauth:grant-type:apikey`), cache until 5 minutes before expiry, guard refresh with an asyncio lock.
3. Create the AstraDB collection handle (`astrapy.DataAPIClient`) and the IBM COS client (`ibm_boto3`, `signature_version="oauth"`).
4. Create a keep-alive `httpx.AsyncClient(base_url=WXO_BASE_URL, timeout=120)`.
5. Best-effort seed an in-memory test-case batch registry from WXO (non-fatal on error).

## Step 2: Authentication and session handling
* **Sign-in page** `GET /login` — static HTML form with no JavaScript, fixed error messages chosen from a table by a one-character `e` query value that is never echoed (no XSS), no `next` parameter (no open redirect). Own CSP: `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`.
* `POST /auth/login` (form fields `username`, `password`, max 256 chars) — compare both in constant time against `UI_USERNAME` / `UI_PASSWORD`. On success issue a fresh `secrets.token_urlsafe(32)` in cookie `cr_session`: `HttpOnly`, `SameSite=Strict`, `Secure` when HTTPS (or `X-Forwarded-Proto: https`), 8 h `Max-Age`; redirect `303 /`.
* **Session store:** in-process dict `session id → expiry`, 8 h TTL, capped at 1000 entries (evict oldest).
* `POST /auth/logout` — delete the session server-side, clear the cookie, redirect to `/login`.
* **Brute-force lockout:** 5 failed logins per client per 60 s; afterwards even the right password is refused until the window passes.
* **Unauthenticated requests:** a `GET` accepting `text/html` → `303 /login`; anything else → `401 {"detail":"Authentication required."}` with **no** `WWW-Authenticate` header. HTTP Basic auth is not supported.
* **Public paths:** `/health`, `/login`, `/auth/login`, `/auth/logout`.

## Step 3: Middleware order (`_guard`)
public-path bypass → session check → `Origin` check on non-`GET`/`HEAD` → per-client rate limit → response security headers.
* **Origin check (CSRF):** a request carrying `Origin` must match its own scheme + host (or `ALLOWED_ORIGIN`). No `Origin` (curl, probes) passes. Login/logout apply the same check.
* **Rate limit:** 120 req/min general; **20 req/min** for `/chat`, `/upload`, `/governance/evaluate`, `/governance/test_cases/upload`, `/governance/agent/stats`. Sliding window per client; client key = last `X-Forwarded-For` hop + socket address; sweep tracking tables at 10 000 clients.
* **Headers on every response:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` (not `no-referrer` — that makes browsers send `Origin: null` on form posts, which locks users out), `Cache-Control: no-store`, `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`. HSTS is configured on the OpenShift Route, not in the app.
* **CORS:** enabled only for the single explicit `ALLOWED_ORIGIN`; `*` is ignored.

## Step 4: `POST /upload` — vendor PDF ingestion
1. Accept `multipart/form-data`: `file` (PDF); optional query `vendor_id`, `template_id`.
2. Validate: non-empty, ≤ **25 MB**, starts with `%PDF-`, ≤ **500 pages**; otherwise `400/413/415/422`.
3. Derive `vendor_id` from the filename if absent (`GTA.Everton-Contract.pdf` → `everton`; skip generic tokens `gta, contract, agreement, vendor, pdf, final, signed`). Default `template_id` = `DEFAULT_TEMPLATE_ID`.
4. Extract text with PyMuPDF; parse clauses with the **same algorithm as Spec 1** (numbered-section anchors, 1200-char sub-chunks, paragraph fallback) **plus a deferred-heading pass**: when a heading's body is < 40 chars (heading printed on one page, body several pages later), search forward for the first line containing a heading keyword (words ≥ 4 chars) and collect that paragraph (≤ 15 lines). Sort clauses by `section_id`. No clauses → `422`.
5. `session_id = uuid4()`. `insert_many` all chunks with `doc_type="vendor_contract"` per [`data/clause_schema.md`](data/clause_schema.md) (`clause_type="other"`).
6. Upload the original PDF to COS as `original_{vendor_id}_{session_id}.pdf`; `cos_pdf_url = {COS_ENDPOINT}/{COS_BUCKET}/{key}`.
7. `clause_index` = sorted unique `"{section_id} {heading}"` (each ≤ 300 chars).

Response:
```json
{ "session_id": "uuid", "cos_pdf_url": "https://…/original_everton_<uuid>.pdf",
  "vendor_id": "everton", "template_id": "GTA-STANDARD-v1.0",
  "clause_count": 15, "clause_index": ["§3.2 Calculation and Payment of Fee"], "filename": "GTA.Everton-Contract.pdf" }
```

## Step 5: `GET /template_clauses?template_id=…`
Return `{template_id, clauses:[{section_id, heading, text, clause_type}]}` for `doc_type=standard_template`, sorted by `section_id`, capped at 200. `400` if `template_id` missing, `503` if AstraDB is not initialised.

## Step 6: `POST /chat` — context injection and agent call
Request (`message` ≤ 8000 chars):
```json
{ "message": "…", "thread_id": null, "session_id": null, "cos_pdf_url": null,
  "vendor_id": null, "template_id": null, "clause_count": null, "clause_index": null }
```
Validation: identifiers regex-constrained (`session_id/thread_id` `^[A-Za-z0-9_-]{1,128}$`, `template_id`, `vendor_id` per schema); `clause_index` ≤ 1000 items of ≤ 300 chars; **`cos_pdf_url` must start with `{COS_ENDPOINT}/{COS_BUCKET}/original_`** else `422` (SSRF guard).

1. Create a WXO thread (`POST /v1/orchestrate/threads`, title "Contract Review Session") if `thread_id` is absent.
2. Build the message text:
   * **Phase 1 — `session_id` and `cos_pdf_url` present** (first message after upload): prepend a plain-text context block —
     ```
     The vendor contract has been uploaded and parsed.
     session_id: …
     cos_pdf_url: …
     vendor_id: …
     template_id: …
     clause_count: N
     clause_index:
       §1 …
     <user message>
     ```
   * **Phase 0 — only `template_id`** (no upload yet): fetch all standard clauses from AstraDB and prepend `[template_id: …]`, a **CLAUSE INDEX** (every `section_id heading`) and **CLAUSE CONTENT** bodies up to **12 000 chars** total (append a truncation marker pointing the agent to `searchClause`). Fall back to the tag only if AstraDB returns nothing.
   * Otherwise forward the message unchanged.
3. `POST /v1/orchestrate/{WXO_AGENT_ID}/chat/completions` with `{"messages":[{"role":"user","content":…}],"stream":false}` and header `X-IBM-THREAD-ID`. Non-200/201 → `502`.
4. Return `{reply, thread_id}`.

## Step 7: Governance endpoints (proxy to WXO Evaluation API v2)
All paths are under `/v1/orchestrate/agent/{WXO_AGENT_ID}/…`. See [`backend/api_endpoints.md`](backend/api_endpoints.md) for the full table; details in [Spec 7](7-governance-evaluation.md).

## Step 8: Error handling and validation
* Upstream (WXO) error bodies are redacted of bearer tokens / API keys, logged server-side, and the client sees only `upstream returned <status>` (`_safe()`). This applies to every route.
* Path/body identifiers are regex-constrained and URL-quoted (`urllib.parse.quote(safe='')`) before being placed in upstream URLs, COS keys or prompts.
* `GET /health` → `{"status":"ok"}`.

## Validation
* Missing/short `UI_PASSWORD` → process exits at start-up.
* Unauthenticated `curl /chat` → `401`; browser `GET /` → `303 /login`.
* Six wrong passwords in a minute → lockout message (`/login?e=2`).
* `POST /upload` with `docs/GTA.Everton-Contract.pdf` → `vendor_id="everton"`, `clause_count > 0`, object present in COS.
* `POST /chat` with a foreign `cos_pdf_url` → `422`.

## Cleanup
* Documentation: super simple, non-verbose, max 3–4 pages per .md; place into `services/ui_proxy/docs/`.
* Provide `.env.example` (empty placeholders), `.dockerignore` (excludes `.env`), and update `.gitignore`.
