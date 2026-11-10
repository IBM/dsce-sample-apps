# API reference

All application endpoints are under `/api` and return JSON (except downloads and the SSE stream). Probes `/healthz` and `/readyz` are at the root, unauthenticated.

## Conventions

- **Authentication:** cookie session (`qse_sid`, `HttpOnly`, `SameSite=Strict`, `Secure` in production). `POST /api/auth/login` sets it.
- **CSRF:** every non-`GET` request needs the header `X-CSRF-Token` (returned by `login` and `me`) and, if an `Origin` header is sent, it must match the service host or `CORS_ALLOWED_ORIGINS`.
- **Roles:** `viewer` (read), `operator` (read + run/configure), `admin` (+ rotate secrets). Roles are ranked, so higher roles include lower ones.
- **Errors:**

```json
{ "error": { "code": "validation_error", "message": "…", "requestId": "uuid", "details": [] } }
```

  `requestId` equals the `X-Request-Id` response header and appears in every server log line for that request.
- **Rate limits:** general (`RATE_LIMIT_*`), stricter for "heavy" mutating routes, and a login limit. Exceeding returns `429`.
- **Secrets are write-only.** API keys and tokens are accepted on input and only a hint (`••••abcd`) or a boolean (`hasToken`) is ever returned.
- Internal filesystem paths are not returned, except the QSE CLI path and its Bob-visible path (operator configuration data).

## Authentication

| Method & path | Role | Body | Response |
|---|---|---|---|
| `POST /auth/login` | – | `{username, password}` | `{user, csrfToken}` |
| `POST /auth/logout` | any | – | `204` |
| `GET /auth/me` | any | – | `{user, csrfToken}` |
| `POST /auth/password` | any | `{currentPassword, newPassword (≥12)}` | `204`. **All** of the user's sessions, including the current one, are revoked; sign in again. |

## Bob connection

| Method & path | Role | Notes |
|---|---|---|
| `GET /bob/status` | any | Returns `BobConnection` (below). |
| `POST /bob/connect` | operator | Body `{endpoint, adapter: "rest-threads"\|"acp", apiBasePath, authMode: "bearer"\|"header"\|"none", authHeaderName, apiKey?}`. Saves config; the key is encrypted. Omit `apiKey` to keep the stored one. Blocked address ranges (metadata, link-local, reserved) and, by default, private/loopback targets → `400 endpoint_not_allowed`. With `STREAM_MODE=mock` nothing is contacted: the address and key are discarded and the response is a connected demo state (`mock: true`). |
| `POST /bob/test-connection` | operator | Resolves the host (SSRF-guarded), authenticates, checks readiness, fetches capabilities. Returns the updated `BobConnection`. |
| `POST /bob/disconnect` | operator | Deletes the stored key and endpoint. |

`BobConnection.state` ∈ `not_configured | connecting | connected | auth_failed | connection_failed`. `capabilities` is `null` until a successful test, then `{adapter, runtimeReady, features{streaming,cancellation,fileDownloads,threads,continuation}, limits{timeoutMs,maxMessageCharacters,maxConcurrentRuns,maxDownloadBytes}}`.

## Repositories

| Method & path | Role | Notes |
|---|---|---|
| `POST /repositories/validate` | operator | `{url, branch, token?}`. Uses `git ls-remote`; returns `{valid, owner, name, branch, commit}`. |
| `POST /repositories/clone` | operator | Same body. Returns `202` with the repository (`status: "cloning"`); poll `GET /repositories` or `/:id`. |
| `GET /repositories` , `GET /repositories/:id` | any | Includes `progress[]`, `fileCount`, `commit`, `lastClonedAt`, `workspaceLabel` (relative label, not an absolute path), `hasToken`. |
| `POST /repositories/:id/reclone` | operator | `{branch?, token?}`; returns `202`. Removes the checkout and clones again. |
| `DELETE /repositories/:id` | operator | Deletes the checkout and stored token. History is kept. |

URL rules: `https` only, host in `GITHUB_ALLOWED_HOSTS`, `owner/repo` path only, no credentials, query or fragment.

## QSE CLI

| Method & path | Role | Notes |
|---|---|---|
| `GET /qse/discover` | operator | Candidates from `QSE_CLI_PATH`, `PATH` and `QSE_CLI_SEARCH_DIRS`: `{candidates[{path, source, executable, allowed}], searched}`. |
| `POST /qse/configure` | operator | `{mode: "auto"\|"manual", path?, versionArgs?}`. Saves then validates. Manual paths must be absolute, inside `QSE_CLI_ALLOWED_DIRS`, and have an allowed executable name. |
| `POST /qse/validate` | operator | Re-checks existence, permissions and runs the version command (no shell, timeout, minimal environment). |
| `GET /qse/status` | any | `{status, mode, executablePath, bobVisiblePath, reachableFromBob, version, validatedAt, message, versionArgs, strategy}`. |

`status` ∈ `not_configured | discovered | valid | invalid`.

## Executions

| Method & path | Role | Notes |
|---|---|---|
| `POST /executions` | operator | `{repositoryId, prompt (≤ MAX_PROMPT_CHARS)}`. Preconditions are re-checked server-side: Bob connected, repository cloned, QSE valid **and reachable from Bob**. `409` with a specific code otherwise. Returns `202` with the `Execution` (`queued`). |
| `GET /executions` | any | Query: `search, status, sort (createdAt\|durationMs\|status\|repositoryName), direction, page, pageSize (≤100)` → `{items, total, page, pageSize}`. |
| `GET /executions/prompts` | any | Recent distinct prompts for the history picker. |
| `GET /executions/:id` | any | `Execution` with `steps[]` (`source: backend\|headless-bob`). |
| `GET /executions/:id/stream` | any | **SSE**. Events: `execution` (full snapshot), `log` (one log line, `id:` = log ID). Resume with `?after=<logId>` or `Last-Event-ID`. |
| `POST /executions/:id/cancel` | operator | Calls Bob's cancel endpoint where supported; Returns `202`; status goes `cancelling` → `cancelled`. |
| `GET /executions/:id/logs?after=` | any | Persisted, redacted logs. |
| `GET /executions/:id/report` | any | `Report` (404 if none). |
| `GET /executions/:id/artifacts` | any | Artifact metadata. |
| `GET /executions/:id/artifacts/:artifactId/download` | any | Only for artifacts the backend retrieved; served as an attachment with `nosniff`. |

Execution statuses: `queued | running | cancelling | completed | failed | cancelled`.

Step keys: `validate_config`, `prepare_repo`, `validate_qse`, `prepare_context`, `submit_prompt` (backend) → `bob_processing` (**headless-bob**) → `retrieve_results`, `generate_report`, `completed` (backend). `mock: true` marks executions replayed from the recorded demo (`STREAM_MODE=mock`); they were not run by Headless Bob.

## Reports

| Method & path | Role | Notes |
|---|---|---|
| `GET /reports/:id` | any | `Report`: `{id, executionId, source, sourceDetail, mock, generatedAt, sections[], bobMarkdown, markdown, execution, artifacts}`. `source` ∈ `headless-bob-file \| headless-bob-output \| unavailable`. |
| `GET /reports/:id/download?format=markdown\|pdf\|json` | any | Attachment. Demo reports have `-DEMO` in the file name and a banner inside. |
| `GET /reports/:id/export` | any | JSON bundle: report + logs. |

## Settings and administration

| Method & path | Role | Notes |
|---|---|---|
| `GET /settings` | any | Effective non-secret configuration, execution strategy, limits, shared mount **labels and Bob-side paths**, key ID. |
| `POST /admin/rotate-secrets` | admin | Re-encrypts the stored Bob key and repository tokens with the first key in `SECRETS_KEYS`. |

## Probes

| Path | Meaning |
|---|---|
| `GET /healthz` | Process is alive. |
| `GET /readyz` | `200` when the database responds and the server is accepting work, `503` during shutdown. |
