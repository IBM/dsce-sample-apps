# Specification 3: Tool Services (`searchClause` and `rectifyPdf`)
The following specification outlines the two FastAPI microservices that the watsonx Orchestrate agent calls as OpenAPI tools. They are deployed to IBM Code Engine (Spec 10).

## Prerequisites
Load any skills that seem relevant — new ones may be added over time.

## Requirements to follow
* Python 3.11, **FastAPI** + **uvicorn**, **pydantic v2**. Pin direct dependencies to exact versions in `requirements.txt`.
* Create each service under its own folder: [`services/search_contract_clause/`](../services/search_contract_clause) and [`services/regenerate_pdf/`](../services/regenerate_pdf).
* Each folder contains: `main.py`, `requirements.txt`, `.env.example` (empty placeholders), `Dockerfile`, `.dockerignore`, `k8s/deployment.yaml`, and an OpenAPI file for WXO tool registration.
* All configuration from environment variables (loaded from `.env` locally).
* Port **8080** in containers; local dev ports 8081 (search) and 8082 (regenerate).
* **Do not create any UI.**

## Shared access control (both services)
* Every route except `GET /health` requires header `X-API-Key` equal to `SERVICE_API_KEY`, compared in constant time (`secrets.compare_digest`).
* **Fail closed:** the service refuses to start if `SERVICE_API_KEY` is missing or shorter than 24 characters.
* In-memory per-client sliding-window rate limit; `429` with `Retry-After` beyond the limit. Client key = last `X-Forwarded-For` hop + socket address.
* Response headers: `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
* Errors never leak upstream internals; log details server-side only.

---

## Service A — `search_contract_clause` (tool name `searchClause`)

### `POST /search_clause`
Request:
```json
{ "session_id": "abc-123", "template_id": "GTA-STANDARD-v1.0",
  "clause_query": "fee payment calculation percentage", "top_k": 3 }
```
| Field | Validation |
|---|---|
| `session_id` | `^[A-Za-z0-9_-]{1,128}$` |
| `template_id` | `^[A-Za-z0-9._-]{1,64}$` |
| `clause_query` | 1–500 chars |
| `top_k` | int 1–5 |

Behaviour:
* Run two AstraDB vector queries **in parallel** (thread pool): standard template and vendor contract (Spec 2 query table).
* If `session_id == "__template_only__"` no vendor contract has that session, so `vendor` is `null`.
* Return `null` for a side that has no matching documents.
* Rate limit: **120 requests / 60 s** per client.

Response (list of up to `top_k` entries per side, ordered by similarity):
```json
{ "standard": [ {"section_id":"§3.2","heading":"…","text":"…","clause_type":"fee_payment","similarity":0.94} ],
  "vendor":   [ {"section_id":"§3.2","heading":"…","text":"…","clause_type":"other","similarity":0.91} ] }
```
`GET /health` → `{"status":"ok"}` (public).

Credentials: `ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`, `ASTRA_DB_COLLECTION`, `SERVICE_API_KEY`.

### WXO tool registration file
`search_contract_clause.json` — OpenAPI 3.0.3, `operationId: searchClause`, security scheme `ApiKeyAuth` (`in: header`, `name: X-API-Key`), `servers[0].url` = the Code Engine URL. Describe each field so the LLM passes `top_k=3` and a short (2–4 word) topic as `clause_query`.

---

## Service B — `regenerate_pdf` (tool name `rectifyPdf`)

### `POST /rectify_pdf`
Request:
```json
{ "cos_pdf_url": "https://s3…/regeneratepdf/original_everton_abc-123.pdf",
  "instructions": [ {"find": "equal two- and one-half percent (2.5%) of the total dollar",
                     "replace": "equal three percent (3.0%) of the total dollar"} ] }
```
Limits: `instructions` max **100** pairs; `find` / `replace` max **2000** chars each; `cos_pdf_url` max 1024 chars; empty `instructions` → `422`.

Pipeline:
1. **Rule-4 guard (before any download):** normalise both strings (en/em/non-breaking dashes → `-`, special spaces → space, collapse whitespace), then reject the whole request with `422` if `replace` dropped the context words of `find`. A pair is a violation only when BOTH signals fire: (a) `replace` has fewer than 50% of the words of `find`, AND (b) neither the first nor the last word of `find` appears in `replace`. The `422` body contains an instructional message and the list of `violations`, so the agent can self-correct.
2. **Validate `cos_pdf_url`:** must start with `{COS_ENDPOINT}/{COS_BUCKET}/`; object key (query string stripped, so presigned retry URLs work) must match `^(original|rectified)_[A-Za-z0-9_-]{1,200}\.pdf$`; otherwise `422`. This prevents reading arbitrary bucket objects or other hosts.
3. Download from IBM COS using the IAM client (max **25 MB**); `502` on failure.
4. For each `{find, replace}`: `page.search_for(find, TEXT_PRESERVE_LIGATURES)` (with normalisation fallback for ligatures, en/em dashes, non-breaking spaces) → hit rects → white redaction over the original footprint → insert replacement text with font name, size and colour matched from the original span. Multi-line matches use `insert_textbox` with font-size shrink fallback down to 7 pt; white-fill any gap when the replacement is shorter.
5. Upload result as `rectified_{uuid4}.pdf`.
6. Return a presigned URL (HMAC, 3600 s) when `COS_HMAC_*` are set, otherwise the direct COS URL.

Response:
```json
{ "download_url": "https://…/rectified_<uuid>.pdf",
  "changes_applied": ["old → new"],
  "skipped": ["find strings with no match in the PDF"],
  "expires_in": 3600 }
```
Rate limit: **30 requests / 60 s** per client. `GET /health` public.

Credentials: `COS_API_KEY`, `COS_SERVICE_INSTANCE_ID`, `COS_ENDPOINT`, `COS_BUCKET`, `SERVICE_API_KEY`; optional `COS_HMAC_ACCESS_KEY_ID`, `COS_HMAC_SECRET_ACCESS_KEY`.

### WXO tool registration file
`regenerate_pdf.json` — OpenAPI 3.0.3, `operationId: rectifyPdf`, same `ApiKeyAuth` scheme. Response schema must include `skipped` so the agent can report it.

---

## Validation
* `curl /health` works without a key; every other route returns `401/403` without `X-API-Key`.
* Service refuses to start with a 10-character `SERVICE_API_KEY`.
* `searchClause` with `session_id="__template_only__"` returns `vendor: null` and 3 standard entries.
* `rectifyPdf` against `docs/GTA.Everton-Contract.pdf` (uploaded to COS as `original_…pdf`) with a valid pair returns `changes_applied` populated; an unknown `find` is returned in `skipped`.
* `rectifyPdf` with a foreign `cos_pdf_url` returns `422`.

## Cleanup
* Documentation: super simple and non-verbose, max 3–4 pages per .md; place into each service's `docs/`.
* Keep test fixtures (`test_*.json`, `test_*.py`) out of git via `.gitignore`.
