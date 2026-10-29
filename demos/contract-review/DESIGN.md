# Contract Reviewer — Architecture & Design Document

## Overview

**Contract Reviewer** is an AI-powered contract review assistant built on IBM watsonx Orchestrate.  
It allows a Government Technology Agency (GTA) contract reviewer to:

1. Upload a vendor PDF contract
2. Compare it clause-by-clause against a GTA Standard Template
3. View deviations with actionable recommendations
4. Produce a corrected PDF to dispatch back to the vendor

Everything happens through a chat interface — no manual document comparison, no legal clause hunting.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│          Sign-in page  (GET /login → POST /auth/login)           │
│          session cookie: HttpOnly · SameSite=Strict · 8 h        │
├──────────────────────────────────────────────────────────────────┤
│                     Contract Reviewer UI                         │
│              ui_proxy/index.html (served by ui_proxy)            │
│   Left panel: template selector + clause list                    │
│   Centre: chat   Right: deviation cards   Top: Sign out          │
└───────────────┬──────────────────────┬───────────────────────────┘
                │  PDF upload          │  Chat messages
                │  POST /upload        │  POST /chat
                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ui_proxy  (FastAPI)                         │
│  middleware: session check → origin check → rate limit          │
│                                                                 │
│  POST /upload  ──→ PyMuPDF parse                                │
│                    AstraDB insert_many (vendor_contract chunks)  │
│                    IBM COS upload (original PDF)                │
│                    returns {session_id, cos_pdf_url,            │
│                             clause_index, vendor_id,            │
│                             template_id, clause_count}          │
│                                                                 │
│  POST /chat ───→ embeds session context as plain text in the    │
│                  first message after upload, then forwards      │
│                  all messages to WXO agent                      │
│                                                                 │
│  GET /governance/* ──→ proxies to WXO Evaluation API            │
└──────────────────────────────┬──────────────────────────────────┘
                               │  WXO chat/completions
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     watsonx Orchestrate                         │
│                                                                 │
│   Agent: contract_reviewer                                      │
│   Style: react_core   LLM: groq/openai/gpt-oss-120b             │
│                                                                 │
│   Tools:  searchClause   (OpenAPI → Code Engine)                │
│           rectifyPdf     (OpenAPI → Code Engine)                │
└──────────────────┬────────────────────────┬─────────────────────┘
                   │  OpenAPI               │  OpenAPI
                   ▼                        ▼
      ┌─────────────────────┐   ┌───────────────────────┐
      │ search_contract_    │   │ regenerate_pdf        │
      │ clause              │   │                       │
      │ Code Engine FastAPI │   │ Code Engine FastAPI   │
      │ X-API-Key required  │   │ X-API-Key required    │
      └──────────┬──────────┘   └──────────┬────────────┘
                 │                          │
                 ▼                          ▼
┌────────────────────────────────┐   ┌──────────────────────┐
│  AstraDB                       │   │  IBM COS             │
│  Database:   contract_review   │   │  Bucket: regeneratepdf│
│  Collection: contract_collection│  │                      │
│  Vectorize:  nvidia/nv-embedqa  │  │  original PDFs       │
│  Dimensions: 1024  Cosine sim. │   │  rectified PDFs      │
│                                │   └──────────────────────┘
│  doc_type = standard_template  │
│  doc_type = vendor_contract    │
└────────────────────────────────┘
```

### Why PDF ingestion does NOT go through WXO

The WXO `/upload-to-s3/` endpoint returns 404 on this SaaS instance.  
All PDF ingestion runs inside `ui_proxy` directly:

1. Browser `POST /upload` → `ui_proxy`
2. PyMuPDF extracts text + parses clause sections
3. Chunks inserted into AstraDB (`doc_type=vendor_contract`)
4. Original PDF binary uploaded to IBM COS
5. `{session_id, cos_pdf_url, clause_index, …}` returned to browser
6. Browser stores response as `_uploadResult`
7. On the next chat send, browser includes the upload context in `POST /chat`
8. `ui_proxy` embeds it as plain text at the top of the WXO message
9. WXO agent reads it, stores `session_id` + `cos_pdf_url` in conversation memory

The WXO agent **never handles file bytes** and **never calls an ingestion tool**.
`session_id` (36 chars) is the only persistent handle the agent needs after Turn 1.

---

## AstraDB Schema

**Database:** `contract_review`  
**Collection:** `contract_collection`  
**Vectorize:** `nvidia/nv-embedqa-e5-v5` · 1024 dimensions · Cosine similarity  
**Query mode:** `$vectorize` — pass plain text, AstraDB handles embedding internally.

### Document shape

```json
{
  "_id":           "<auto-uuid>",
  "doc_type":      "standard_template | vendor_contract",
  "template_id":   "GTA-STANDARD-v1.0",
  "template_type": null,
  "vendor_id":     "everton | null",
  "session_id":    "uuid-per-upload | null",
  "review_date":   "2025-01-19",
  "clause_type":   "other",
  "section_id":    "§3.2",
  "heading":       "Calculation and Payment of Fee",
  "text":          "The amount of the Fee shall equal three percent (3%)...",
  "$vectorize":    "Calculation and Payment of Fee The amount of the Fee shall equal three percent (3%)..."
}
```

- `$vectorize` = `heading + " " + text` — richer semantic signal than text alone
- `doc_type` isolates standard templates from vendor contracts on every query
- `template_id` ensures version-correct comparisons never mix
- `session_id` scopes all vendor queries to one specific upload
- `vendor_id` enables future cross-session vendor history queries

### Core query patterns

```python
# Standard template clause search
collection.find(
    filter={"doc_type": "standard_template", "template_id": "GTA-STANDARD-v1.0"},
    sort={"$vectorize": "fee payment calculation"},
    limit=3,
    include_similarity=True
)

# Vendor contract clause search (session-scoped)
collection.find(
    filter={"doc_type": "vendor_contract", "session_id": "abc-123"},
    sort={"$vectorize": "fee payment calculation"},
    limit=3,
    include_similarity=True
)

# Bulk insert during /upload
collection.insert_many([{
    "doc_type":   "vendor_contract",
    "session_id": "abc-123",
    "vendor_id":  "everton",
    "template_id":"GTA-STANDARD-v1.0",
    "$vectorize": "heading + text"    # AstraDB embeds automatically
}, ...])
```

---

## Components

### Component 1 — `scripts/ingest_standard_templates.py`

**Type:** One-time local Python script  
**Status:** Run once — 15 chunks for `GTA-STANDARD-v1.0` are in AstraDB.

**What it does:**
1. Reads GTA Standard Template PDFs from `scripts/templates/`
2. Extracts text with PyMuPDF, parses into clause sections
3. Inserts all chunks into AstraDB with `doc_type=standard_template`

**Credentials needed:** `ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`

---

### Component 2 — `services/ui_proxy/`

**Type:** FastAPI — serves the UI and owns all PDF ingestion
**Deployed:** local `uvicorn` during development; single-replica container on OpenShift

#### Endpoints

Every route requires a valid session cookie except the four marked **public**.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Serves `index.html` |
| `GET` | `/login` | Sign-in page (**public**; redirects to `/` if already signed in) |
| `POST` | `/auth/login` | Form login — sets the session cookie, redirects to `/` (**public**) |
| `POST` | `/auth/logout` | Revokes the session server-side, redirects to `/login` (**public**, so an expired session can still sign out) |
| `GET` | `/health` | Liveness probe (**public**) |
| `GET` | `/template_clauses` | List all standard template clauses from AstraDB |
| `POST` | `/upload` | Full PDF ingestion (see below) |
| `POST` | `/chat` | Proxy to WXO agent with context injection |
| `GET` | `/governance/evaluations` | List WXO evaluation runs |
| `GET` | `/governance/evaluations/status` | Check if evaluation is currently running |
| `GET` | `/governance/evaluations/{id}` | Single run detail |
| `GET` | `/governance/evaluations/{id}/test_cases` | Per-test-case breakdown |
| `GET` | `/governance/test_cases` | All registered test cases |
| `GET` | `/governance/test_cases/{tc_id}` | Single test case detail |
| `GET` | `/governance/test_case_batches` | In-memory upload batch history |
| `POST` | `/governance/evaluate` | Trigger a new evaluation run |
| `POST` | `/governance/test_cases/upload` | Upload test cases JSON/ZIP to WXO |
| `POST` | `/governance/test_cases/from_thread` | Create test case from a recorded chat thread |
| `POST` | `/governance/test_cases/bulk_delete` | Bulk-delete test cases by ID |
| `GET` | `/governance/runs` | List all WXO agent runs (token usage / timing) |
| `GET` | `/governance/runs/{run_id}` | Single run detail (tokens, model, timing) |
| `GET` | `/governance/threads/{thread_id}/messages` | Thread messages (used to extract trace_id) |
| `GET` | `/governance/agent/stats` | Full agent analytics — scans all runs, returns token/timing aggregates + sparkline series |

#### `POST /upload` pipeline

1. Accept `multipart/form-data`: `file` (PDF), optional `vendor_id`, optional `template_id`
2. Derive `vendor_id` from filename if absent (e.g. `GTA.Everton-Contract.pdf` → `everton`)
3. Default `template_id` to `DEFAULT_TEMPLATE_ID` env var if absent
4. Parse PDF bytes with PyMuPDF → raw text
5. `_extract_clauses()`: regex-based section heading detector; sections > 1200 chars split into labelled sub-chunks (`§3a`, `§3b`, …)
6. Generate `session_id = uuid4()`
7. `_collection.insert_many(docs)` — all chunks, `doc_type=vendor_contract`
8. Upload original PDF to IBM COS as `original_{vendor_id}_{session_id}.pdf`
9. Return `UploadResponse`

```python
class UploadResponse(BaseModel):
    session_id:   str
    cos_pdf_url:  str
    vendor_id:    str
    template_id:  str
    clause_count: int
    clause_index: list[str]   # ["§3.2 Calculation and Payment of Fee", ...]
    filename:     str
```

#### `POST /chat` context injection

```python
class ChatRequest(BaseModel):
    message:      str
    thread_id:    Optional[str]
    session_id:   Optional[str]   # set after upload
    cos_pdf_url:  Optional[str]   # set after upload
    vendor_id:    Optional[str]
    template_id:  Optional[str]
    clause_count: Optional[int]
    clause_index: Optional[list[str]]
```

- **Phase 1 (first message after upload):** `session_id` + `cos_pdf_url` present →
  prepend full context block (session_id, cos_pdf_url, vendor_id, template_id, clause_index) as plain text before forwarding to WXO
- **Phase 0 (no upload yet):** `template_id` present but no `session_id` →
  fetch all standard template clauses from AstraDB via `_build_template_context()` and inject the full clause index + clause bodies (up to 12 000 chars) as context, plus a `[template_id: ...]` tag. Falls back to tag-only if AstraDB returns nothing.
- **All other messages:** forward as-is

#### Authentication and session handling

- **Login:** `POST /auth/login` (form fields `username`, `password`, max 256 chars each) compares both values in constant time against `UI_USERNAME` / `UI_PASSWORD`. On success it issues a new random session id (`secrets.token_urlsafe(32)`, 256 bits) in cookie `cr_session` (`HttpOnly`, `SameSite=Strict`, `Secure` when the request is HTTPS or `X-Forwarded-Proto: https`) and redirects to `/`. The redirect target is fixed — there is no `next` parameter.
- **Session store:** in-process dict `session id → expiry`, 8-hour lifetime, capped at 1000 entries (oldest evicted). Because it is in memory, a restart signs everyone out and the deployment must stay at `replicas: 1`; scaling out needs a shared store.
- **Logout:** deletes the id from the store and clears the cookie, so a copied cookie stops working immediately.
- **Unauthenticated requests:** a `GET` that accepts `text/html` is redirected (303) to `/login`; anything else gets `401 {"detail": "Authentication required."}` with no `WWW-Authenticate` header, so browsers never raise their own Basic-auth dialog. `index.html` wraps `fetch` so any `401` sends the browser back to `/login`.
- **HTTP Basic auth is removed.** It was replaced by the sign-in page; scripted clients must sign in through the form and reuse the cookie.
- **Brute-force lockout:** 5 failed logins per client per 60 s, after which even the correct password is refused until the window passes. Tracked separately from the general rate limit because failed logins never reach an authenticated route.
- **Middleware order (`_guard`):** public-path bypass → session check → `Origin` check on non-`GET`/`HEAD` → per-client rate limit (120/min general, 20/min for `/chat`, `/upload`, `/governance/evaluate`, `/governance/test_cases/upload`, `/governance/agent/stats`) → response security headers.
- **Origin check (CSRF):** a request carrying an `Origin` header must match the request's own scheme + host (or `ALLOWED_ORIGIN`). Requests without `Origin` (curl, probes) pass. Login and logout apply the same check. `Referrer-Policy` is `same-origin` rather than `no-referrer` because `no-referrer` makes browsers send `Origin: null` on form posts, which the check correctly rejects and which locked users out of the login form.
- **Client key:** the rate limiter and lockout key on the last `X-Forwarded-For` hop (the OpenShift router) plus the socket address. Tracking tables are swept at 10 000 clients so unauthenticated traffic cannot grow memory without bound.
- **Login page hardening:** static HTML; the error text is chosen from a fixed table by a one-character query value that is never echoed; its own CSP is `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`.
- **Other response headers (all responses):** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, and `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`. HSTS is not set by the app; configure it on the OpenShift route.

#### Request validation and error handling

- Path/body identifiers (`thread_id`, `session_id`, `vendor_id`, `template_id`, test-case ids) are regex-constrained and URL-quoted before being placed in upstream URLs, COS keys or agent prompts.
- Uploads are size-limited: vendor PDF 25 MB / 500 pages and `%PDF-` magic bytes; test-case file 10 MB, `.json`/`.zip` only.
- `/chat` accepts a `cos_pdf_url` only if it starts with `{COS_ENDPOINT}/{COS_BUCKET}/original_`.
- Upstream (WXO) error bodies are redacted for bearer tokens/API keys and logged server-side; the client sees only `upstream returned <status>` (`_safe()`). This applies to every route, including `/governance/agent/stats`.
- `ALLOWED_ORIGIN` enables CORS for one explicit origin only. A wildcard `*` is ignored.

#### Environment variables

```
WXO_BASE_URL                  WXO SaaS base URL
WXO_API_KEY                   IAM API key
WXO_AGENT_ID                  UUID of contract_reviewer agent
UI_USERNAME                   sign-in user, default: reviewer
UI_PASSWORD                   sign-in password — REQUIRED, min 12 chars (service will not start without it)
ASTRA_DB_API_ENDPOINT
ASTRA_DB_APPLICATION_TOKEN
ASTRA_DB_COLLECTION           default: contract_collection
COS_API_KEY
COS_SERVICE_INSTANCE_ID
COS_ENDPOINT                  default: https://s3.us-east.cloud-object-storage.appdomain.cloud
COS_BUCKET                    default: regeneratepdf
DEFAULT_TEMPLATE_ID           default: GTA-STANDARD-v1.0
ALLOWED_ORIGIN                optional external CORS origin; empty = same-origin only ("*" is ignored)
```

---

### Component 3 — `services/search_contract_clause/main.py`

**Type:** Code Engine FastAPI — registered as `searchClause` OpenAPI tool in WXO  
**When called:** Phase 0 (standard-only) and Phase 2+ (both sides), multiple times per session

**`POST /search_clause`**

Input:
```json
{
  "session_id":   "abc-123",
  "template_id":  "GTA-STANDARD-v1.0",
  "clause_query": "fee payment calculation percentage",
  "top_k":        3
}
```

- If `session_id == "__template_only__"`: no vendor contract has that session, so the `vendor` result is null/empty
- Otherwise: two parallel AstraDB queries — standard template + vendor contract
- `session_id` must match `^[A-Za-z0-9_-]{1,128}$`, `template_id` `^[A-Za-z0-9._-]{1,64}$`, `clause_query` is 1–500 chars and `top_k` is 1–5; anything else is rejected with `422`

Output — **list of up to `top_k` entries per side**:
```json
{
  "standard": [
    {"section_id": "§3.2", "heading": "...", "text": "...3%...", "similarity": 0.94}
  ],
  "vendor": [
    {"section_id": "§3.2", "heading": "...", "text": "...2.5%...", "similarity": 0.91}
  ]
}
```

The agent reads ALL headings in each list and selects the entry whose heading best matches the user's query — vector rank is not assumed to equal intent match.

**Access control:** every route except `GET /health` requires the `X-API-Key` header to equal `SERVICE_API_KEY` (compared in constant time). The service refuses to start if the variable is missing or shorter than 24 characters. Per-client limit: 120 requests / 60 s (`429` beyond that). The WXO connection used to register the tool must send this header (OpenAPI `ApiKeyAuth`, `in: header`, `name: X-API-Key`).

**Credentials needed:** `ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`, `SERVICE_API_KEY`

---

### Component 4 — `services/regenerate_pdf/main.py`

**Type:** Code Engine FastAPI — registered as `rectifyPdf` OpenAPI tool in WXO  
**When called:** On explicit user confirmation to regenerate the PDF

**`POST /rectify_pdf`**

Input:
```json
{
  "cos_pdf_url": "https://s3.../original_everton_abc-123.pdf",
  "instructions": [
    {"find": "two- and one-half percent (2.5%)", "replace": "three percent (3%)"}
  ]
}
```

Output:
```json
{
  "download_url":    "https://s3.../rectified_uuid.pdf",
  "changes_applied": ["two- and one-half percent (2.5%) → three percent (3%)"],
  "expires_in":      3600
}
```

Pipeline:
1. Validate `cos_pdf_url`: it must start with `{COS_ENDPOINT}/{COS_BUCKET}/` and the object key (query string stripped, so presigned retry URLs work) must match `^(original|rectified)_[A-Za-z0-9_-]{1,200}\.pdf$`; otherwise `422`. Then download from COS via the IAM client (max 25 MB). This stops the endpoint being used to read arbitrary bucket objects or other hosts.
2. For each `{find, replace}` pair:  
   `page.search_for(find, TEXT_PRESERVE_LIGATURES)` → hit rects  
   White redaction over original footprint → insert replacement text  
   Font name, size, and colour matched from the original span
3. Multi-line matches: `insert_textbox` with font-size shrink fallback (down to 7pt);  
   white-fill gap when replacement is shorter than original
4. Upload rectified PDF to COS as `rectified_{uuid}.pdf`
5. Return presigned URL (HMAC) or direct COS URL (IAM fallback — only usable if the bucket is public or the caller has COS access, so configure HMAC keys in production)

**Access control:** same as `search_contract_clause` — `X-API-Key` on every route except `/health`, minimum 24-character key, `429` above 30 requests / 60 s per client. Request limits: `instructions` max 100 pairs, `find`/`replace` max 2000 chars each.

**Credentials needed:** `COS_API_KEY`, `COS_SERVICE_INSTANCE_ID`, `COS_ENDPOINT`, `COS_BUCKET`, `SERVICE_API_KEY`,
optional `COS_HMAC_ACCESS_KEY_ID` + `COS_HMAC_SECRET_ACCESS_KEY`

---

## WXO Agent

**File:** `agent/agent.yaml`

```yaml
spec_version: v1
kind: native
name: contract_reviewer
title: Contract Reviewer
style: react_core
llm: groq/openai/gpt-oss-120b
tools:
  - searchClause
  - rectifyPdf
```

**Phases (governed by `instructions:` key in `agent/agent.yaml`):**

| Phase | Trigger | Agent action |
|---|---|---|
| 0 — No upload | User asks about standard template | Call `searchClause` with `session_id="__template_only__"` |
| 1 — Upload context | Message contains `session_id`, `cos_pdf_url`, `clause_index` | Store all fields in conversation context; confirm upload with clause list |
| 2 — Comparison | User asks to compare a clause | Call `searchClause`; select best entry per side by heading; build deviation table + recommendations |
| 3 — Regeneration | User explicitly confirms | Call `rectifyPdf` with `{find, replace}` pairs from comparison context |

---

## Full Session Data Flow

```
TURN 0 — Template question (no upload yet)
  Reviewer selects template in dropdown, types question
  Browser → POST /chat {message, template_id}
  ui_proxy prepends [template_id: ...] → WXO
  Agent calls searchClause(session_id="__template_only__", template_id, clause_query, top_k=3)
  ← Agent picks best standard entry by heading, displays it

TURN 1 — PDF upload
  Reviewer clicks 📎, selects vendor PDF
  Browser → POST /upload (multipart) → ui_proxy
      PyMuPDF parse → clause chunks
      AstraDB insert_many (doc_type=vendor_contract, session_id="abc-123")
      IBM COS upload → "original_everton_abc-123.pdf"
  ← {session_id, cos_pdf_url, clause_index, ...} → browser
  Browser stores _uploadResult, populates clause list in left panel
  Browser → POST /chat {session_id, cos_pdf_url, clause_index, ...}
  ui_proxy builds context block → prepends to message → WXO
  Agent stores session_id + cos_pdf_url in conversation memory
  ← Chat: "Contract uploaded. N clauses found. Here is the clause index: ..."

TURN 2 — Clause comparison
  Reviewer: "Compare the fee and payment clause"
  Agent calls searchClause(session_id, template_id, "fee payment calculation", top_k=3)
      AstraDB: standard query → up to 3 hits
      AstraDB: vendor query (session-scoped) → up to 3 hits
  Agent selects best entry from each list by heading
  ← Deviation table + old clause text + rectified clause text
  ← "Do you want to regenerate? / Modify first?"

TURN 3 — Regenerate
  Reviewer: "Yes, regenerate"
  Agent calls rectifyPdf(cos_pdf_url, instructions=[{find, replace}, ...])
      Download PDF from COS
      PyMuPDF exact find/replace, upload rectified PDF
  ← download_url
  ← "Your PDF has been regenerated. [Click here to download]"
```

---

## IBM COS Usage

**Bucket:** `regeneratepdf`

| Object | Key pattern | Purpose |
|---|---|---|
| Original vendor PDF | `original_{vendor_id}_{session_id}.pdf` | Source binary for `rectifyPdf` |
| Rectified output PDF | `rectified_{uuid}.pdf` | Reviewer download |

---

## Credentials Summary

| Secret | Used by |
|---|---|
| `WXO_BASE_URL`, `WXO_API_KEY`, `WXO_AGENT_ID` | ui_proxy |
| `UI_USERNAME`, `UI_PASSWORD` | ui_proxy sign-in (password min 12 chars, required) |
| `SERVICE_API_KEY` (min 24 chars; use a different value per service) | search_contract_clause, regenerate_pdf; also entered in the WXO connection that calls them |
| `ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`, `ASTRA_DB_COLLECTION` | ui_proxy `/upload`, search_contract_clause, ingest script |
| `COS_API_KEY`, `COS_SERVICE_INSTANCE_ID`, `COS_ENDPOINT`, `COS_BUCKET` | ui_proxy `/upload`, regenerate_pdf |
| `COS_HMAC_ACCESS_KEY_ID`, `COS_HMAC_SECRET_ACCESS_KEY` | regenerate_pdf (presigned URLs, optional) |

**Never needed:** NVIDIA API key (AstraDB handles all embeddings via `$vectorize`), watsonx.ai API key.

**Handling:** real values live only in gitignored `.env` files (local) or Kubernetes/OpenShift secrets (deployed). `.env.example` files are committed with empty placeholders only, and each service's `.dockerignore` keeps `.env` out of the image. Generate shared secrets with `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`. Rotate any credential that was ever copied outside those locations.

---

## Security Model

| Layer | Control |
|---|---|
| Browser → `ui_proxy` | Sign-in page + `HttpOnly`/`SameSite=Strict` session cookie; origin check on writes; lockout after 5 failed logins/min; per-client rate limits; security headers; no wildcard CORS |
| WXO agent → tool services | `X-API-Key` shared secret (constant-time compare), fail-closed start-up, per-client rate limit |
| Tool services → AstraDB / COS | Credentials from env/secrets only; `cos_pdf_url` constrained to this bucket's `original_*`/`rectified_*` objects; validated identifiers in every filter |
| Containers / cluster | Digest-pinned `python:3.11-slim-bookworm`, non-root UID 10001, `allowPrivilegeEscalation: false`, all capabilities dropped, read-only root filesystem (writable `/tmp` only), `RuntimeDefault` seccomp, no service-account token, resource limits, TLS-terminating Route with HTTP→HTTPS redirect |
| Supply chain | Direct dependencies pinned to exact versions; `pip-audit -r requirements.txt` reported no known vulnerabilities for every service when last run |

**Known limitations**

- **Single shared login, no roles.** The persona selector (David Kim / Kate Ross) only hides or shows the Governance tab in the browser. Any signed-in user can call `/governance/*`, including `bulk_delete`, `evaluate` and test-case upload. Add a separate admin credential or SSO before multi-user use.
- **Sessions in memory** — single replica only; restart = sign-out.
- **No HSTS** from the app; set it on the Route.
- **Prompt content comes from the client and from vendor PDFs.** `/chat` forwards `clause_index`, `vendor_id` and similar fields into the agent prompt. Impact is bounded (PDF regeneration validates the COS object and the tool services require the API key), but an uploaded contract could try to steer the agent. A stricter design would rebuild this context server-side from AstraDB using `session_id`.
- **The UI renders agent replies as links.** Markdown links and the download link come from the LLM reply and are not restricted to the COS host; restrict them to an allowlist if the threat model includes hostile vendor PDFs.
- **Transitive dependencies are not hash-pinned**; re-run `pip-audit` before each release and prefer a hashed lockfile.

---

## File Structure

```
contract_review_v2/
├── DESIGN.md
├── scripts/
│   ├── ingest_standard_templates.py
│   ├── .env.example
│   └── templates/
│       └── GTA.Standard-Template.pdf
│
├── services/
│   ├── ui_proxy/
│   │   ├── main.py                    ← FastAPI: /login /auth/* /upload /chat /governance/*
│   │   ├── index.html                 ← chat UI, template selector, clause list, Sign out
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── .env.example
│   │   ├── .env                       ← gitignored
│   │   └── k8s/deployment.yaml
│   │
│   ├── search_contract_clause/
│   │   ├── main.py                    ← FastAPI: POST /search_clause (X-API-Key)
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── .env.example
│   │   ├── k8s/deployment.yaml
│   │   └── search_contract_clause.json  ← OpenAPI spec for WXO tool registration
│   │
│   └── regenerate_pdf/
│       ├── main.py                    ← FastAPI: POST /rectify_pdf (X-API-Key)
│       ├── requirements.txt
│       ├── Dockerfile
│       ├── .dockerignore
│       ├── .env.example
│       ├── k8s/deployment.yaml
│       └── regenerate_pdf.json        ← OpenAPI spec for WXO tool registration
│
└── agent/
    ├── agent.yaml                     ← WXO agent spec + instructions (all phases)
    ├── test_cases.json                ← ADK CLI benchmark scenarios
    └── test_cases_wxo.json            ← WXO v2 format test cases (used by /governance/test_cases/upload)
```

---

## Commands Reference

```bash
# Import agent after agent.yaml changes (instructions live in agent.yaml, not system_prompt.txt)
cd contract_review_v2/scripts
.venv/bin/orchestrate agents import -f ../agent/agent.yaml

# Run ui_proxy locally (needs UI_PASSWORD in .env; then open http://localhost:8080 and sign in)
cd contract_review_v2/services/ui_proxy
../../scripts/.venv/bin/uvicorn main:app --reload --port 8080

# Run search_contract_clause locally (needs SERVICE_API_KEY in .env)
cd contract_review_v2/services/search_contract_clause
uvicorn main:app --reload --port 8081
curl http://localhost:8081/health                                      # public, no key needed
curl -H "X-API-Key: $SERVICE_API_KEY" -H "Content-Type: application/json" \
  -d '{"session_id":"__template_only__","template_id":"GTA-STANDARD-v1.0","clause_query":"payment"}' \
  http://localhost:8081/search_clause

# Run regenerate_pdf locally (needs SERVICE_API_KEY in .env)
cd contract_review_v2/services/regenerate_pdf
uvicorn main:app --reload --port 8082

# Audit a service's dependencies
pip-audit -r services/ui_proxy/requirements.txt
```
