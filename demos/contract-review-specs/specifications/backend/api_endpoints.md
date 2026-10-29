# API Endpoints to Build
These are the endpoints of the `ui_proxy` service (Spec 4). The two tool services are specified in Spec 3.

```markdown
### Public endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/health` | — | Liveness probe. Returns `{"status":"ok"}`. |
| `GET`  | `/login` | — | Static sign-in page. Redirects (303) to `/` if already signed in. |
| `POST` | `/auth/login` | — | Form login (`username`, `password`). Sets `cr_session` cookie, redirects (303) to `/`. |
| `POST` | `/auth/logout` | — | Revokes the session server-side, clears cookie, redirects (303) to `/login`. Public so an expired session can still sign out. |

### UI and template endpoints (session cookie required)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/` | Session | Serves `index.html` (placeholder `%%PROXY_URL%%` replaced with empty string). |
| `GET`  | `/template_clauses?template_id=` | Session | All standard-template clauses for a template, sorted by `section_id`, max 200. Returns `{template_id, clauses[]}`. |

### Contract review endpoints (session cookie required)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/upload` | Session | Multipart PDF upload. Parses clauses, inserts into AstraDB, stores original in IBM COS. Returns `{session_id, cos_pdf_url, vendor_id, template_id, clause_count, clause_index[], filename}`. |
| `POST` | `/chat` | Session | Forwards a message to the WXO `contract_reviewer` agent with Phase 0 / Phase 1 context injection. Accepts `{message, thread_id?, session_id?, cos_pdf_url?, vendor_id?, template_id?, clause_count?, clause_index?}`. Returns `{reply, thread_id}`. |

### Governance endpoints (session cookie required; proxy to WXO Evaluation API v2)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/governance/evaluations` | Session | List evaluation runs. `?limit=1..50&offset=&sortkey=executed_date\|created_date\|status&sort=asc\|desc`. |
| `GET`  | `/governance/evaluations/status` | Session | Is an evaluation currently running? |
| `GET`  | `/governance/evaluations/{id}` | Session | Single run detail. Optional `?expand=`. |
| `GET`  | `/governance/evaluations/{id}/test_cases` | Session | Per-test-case breakdown (fetches detail with `expand=test_cases` and normalises). |
| `GET`  | `/governance/test_cases` | Session | All registered test cases. `?limit=1..100&page=&sortkey=&sort=`. |
| `GET`  | `/governance/test_cases/{tc_id}` | Session | Single test case. |
| `GET`  | `/governance/test_case_batches` | Session | In-memory upload batch history, newest first. |
| `POST` | `/governance/evaluate` | Session | Trigger a run: `{test_case_ids[]}` (max 200). |
| `POST` | `/governance/test_cases/upload` | Session | Upload `.json` / `.zip` (max 10 MB) of test cases to WXO. |
| `POST` | `/governance/test_cases/from_thread` | Session | Create a test case from a recorded chat thread `{thread_id}`. |
| `POST` | `/governance/test_cases/bulk_delete` | Session | Delete test cases by id `{ids[]}` (max 200) via individual DELETE calls. Returns `{deleted_ids[], failed[]}`. |
| `GET`  | `/governance/runs` | Session | List agent runs (token usage, timing). `?limit=1..100&offset=`. |
| `GET`  | `/governance/runs/{run_id}` | Session | Single run detail. |
| `GET`  | `/governance/threads/{thread_id}/messages` | Session | Thread messages (used to find `trace_id`). |
| `GET`  | `/governance/agent/stats` | Session | Agent analytics aggregated across all runs of this agent. |
```

## Tool service endpoints (Spec 3, `X-API-Key` required except `/health`)
| Service | Method | Endpoint | Description |
|---|---|---|---|
| `search_contract_clause` | `POST` | `/search_clause` | Parallel vector search of standard + vendor clauses. Returns `{standard[], vendor[]}`. |
| `search_contract_clause` | `GET` | `/health` | Liveness (public). |
| `regenerate_pdf` | `POST` | `/rectify_pdf` | Apply find/replace pairs to a COS-hosted PDF. Returns `{download_url, changes_applied[], skipped[], expires_in}`. |
| `regenerate_pdf` | `GET` | `/health` | Liveness (public). |

## Conventions
* JSON in/out uses `snake_case`.
* Errors: `{"detail": "<message>"}` with the proper HTTP status (`400, 401, 403, 413, 415, 422, 429, 502, 503`). Upstream details are never leaked.
* Auth failure: `401 {"detail":"Authentication required."}` (no `WWW-Authenticate`); browser HTML `GET` → `303 /login`.
* Identifier patterns: `session_id`, `thread_id`, resource ids `^[A-Za-z0-9_-]{1,128}$`; `template_id` `^[A-Za-z0-9._-]{1,64}$`; `vendor_id` `^[A-Za-z0-9_-]{1,64}$`.
