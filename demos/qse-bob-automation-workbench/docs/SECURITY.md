# Security model

This document describes the controls that are implemented, where they live, and what is **not** covered.

## Trust boundaries

```
Browser ──(session cookie + CSRF)──> NGINX ──> Backend ──(Bearer token, SSRF-guarded)──> Headless Bob
                                               │
                                               ├── git (https only) ──> GitHub
                                               └── QSE CLI version check (no shell)
```

- The browser never sees the Bob API key, GitHub tokens, session secrets, or absolute workspace paths.
- Repository content is **untrusted data**. It is never executed by the Workbench, and the prompt instructs Bob to treat it as data.
- Headless Bob is a **trusted-but-powerful** component: it runs with `--trust` and can execute commands. Treat the shared volumes accordingly (see below).

## Secrets

| Item | Handling |
|---|---|
| Bob API key, GitHub tokens | Encrypted with **AES-256-GCM** (`SecretBox`) before they touch SQLite. Random 96-bit nonce per value; key ID stored with the ciphertext. |
| Key ring | `SECRETS_KEYS=kid:base64,…`. First key encrypts; others only decrypt. **Rotation:** add a new first key, restart, `POST /api/admin/rotate-secrets` (Settings → Re-encrypt). Replace the Bob key itself via Bob Connection. |
| API responses | Only a hint (`••••abcd`) or boolean is returned; never the value. |
| Logs | A redactor strips registered secrets, bearer tokens, `Authorization` headers, `token=`/`password=` patterns and GitHub token formats from structured logs **and** execution logs before persisting. |
| Git token | Passed via `GIT_CONFIG_*` environment variables as an HTTP header, never in argv, the URL, `.git/config`, or on disk. |
| Browser storage | No secrets. Only a non-sensitive prompt draft and selected IDs in `sessionStorage`. Password/API-key inputs are cleared after submit. |
| User passwords | scrypt (N=16384, r=8, p=1) with per-user salt, constant-time comparison. |
| Sessions | Random 256-bit ID in an `HttpOnly`, `SameSite=Strict`, `Secure` (production) cookie; only a **hash** is stored server-side. Absolute and idle expiry. Password change revokes all sessions. |

## Application security

- **Authentication and authorisation:** every `/api` route except login requires a session; roles `viewer < operator < admin` are enforced per route.
- **CSRF:** `X-CSRF-Token` (per-session, constant-time compared) plus an `Origin`/host check on all non-safe methods. Verified: a request with a foreign `Origin` is rejected with `403`.
- **CORS:** disabled by default; only origins in `CORS_ALLOWED_ORIGINS` get credentialed access.
- **Rate limiting:** general, "heavy" (process-spawning/remote calls) and login (10 per 15 min by default).
- **Input validation:** every body and query is parsed with zod `strict()` schemas; unknown fields are rejected. JSON body limit 64 kB.
- **Headers:** helmet on the API (`default-src 'none'`, HSTS, `nosniff`, no referrer); NGINX adds a strict CSP (`script-src 'self'`), `X-Frame-Options: DENY`, `Permissions-Policy`, and HSTS on the TLS variant.
- **Untrusted Markdown:** reports are rendered with raw HTML disabled and only `http(s):`, `mailto:` and `#` links allowed (`rel="noopener noreferrer nofollow"`).
- **Downloads:** artifacts are served as attachments with `nosniff`; only artifacts the backend already retrieved (size-limited) are downloadable.
- **Errors:** a central handler returns a stable shape with a correlation ID and never leaks stack traces or internal paths.

## SSRF protection (Bob endpoint)

1. Only `http`/`https`, no embedded credentials.
2. **IP literals are classified when saving.** The URL parser first normalises decimal/hex/octal spellings to dotted form. Link-local/metadata (`169.254.0.0/16`, `fe80::/10`, AWS IPv6 metadata), unspecified, multicast and reserved ranges are **always** rejected (`endpoint_not_allowed`); private and loopback literals are rejected unless `BOB_ALLOW_PRIVATE_NETWORK=true` or the host is in `BOB_ALLOWED_HOSTS`.
3. Hostnames are resolved by a **guarded DNS lookup at connect time**; every resolved address is checked: link-local (incl. cloud metadata `169.254.169.254`), multicast and reserved ranges are always blocked; loopback, RFC 1918, CGNAT (`100.64/10`) and IPv6 unique-local ranges are blocked unless `BOB_ALLOW_PRIVATE_NETWORK=true` or the host is allow-listed. Checking at connect time defeats DNS-rebinding.
4. Optional `BOB_ALLOWED_HOSTS` allow-list.
5. Redirects are not followed.

Docker Compose defaults to `BOB_ALLOW_PRIVATE_NETWORK=true` because a container name resolves to a private address. Pair it with `BOB_ALLOWED_HOSTS=<bob host>` so only your Bob host qualifies.

## Execution security

- **No shell anywhere.** All child processes (git, QSE version check) use `spawn(file, args[], {shell:false})`, a minimal environment (no inherited secrets), a timeout, an output cap, and their own process group so the whole tree is killed on timeout/cancel.
- **Git:** `https` only (`GIT_ALLOW_PROTOCOL`), hooks disabled (`core.hooksPath=/dev/null`), no prompts, no credential helper, no submodule recursion, LFS smudge disabled, system/global config disabled, host allow-list, strict `owner/repo` and branch validation (no `..`, `@{`, `//`), branch passed after `--`.
- **Isolated workspaces:** each clone lives in a random directory under `WORKSPACE_ROOT`. All paths are resolved and checked to remain inside the root (path traversal and symlink escape tests included). After cloning, **symlinks pointing outside the checkout are removed**.
- **QSE CLI:** absolute path required; must be inside `QSE_CLI_ALLOWED_DIRS`; file name must be in `QSE_CLI_EXECUTABLE_NAMES`; `realpath` is re-checked (no symlink escape); must be a regular, executable file; version args are length/charset-limited. It is run only with the configured version arguments, never with user-supplied arguments.
- **Repository scripts are never run.** The Workbench does not build, install or execute repository content.
- **Timeouts and limits:** clone (`CLONE_TIMEOUT_MS`), QSE validation, execution (`EXECUTION_TIMEOUT_MS`), concurrency, prompt size, artifact size/count.
- **Container hardening (Compose):** non-root user (uid 1001 backend, 101 NGINX), `read_only` root filesystem, `cap_drop: ALL`, `no-new-privileges`, tmpfs for `/tmp`; the backend port is **not published**.

## Shared-volume risk (important)

Headless Bob can execute commands. With the shared-volume strategy Bob sees the cloned repository and the QSE CLI:

- The **QSE CLI volume is mounted read-only** in both containers.
- The **workspaces volume is read-only in Bob by default** (`BOB_WORKSPACE_MOUNT_MODE=ro`). Bob writes its report to *its own* workspace, which the backend retrieves through the Headless Bob file API, so it does not need write access to the clones. Set `rw` only if your QSE CLI must write next to the sources.
- Do not mount anything else, and do not run Bob with access to host sockets or credentials it does not need.
- A prompt-injection payload in a repository could try to steer Bob. The prompt marks repository content as untrusted data and forbids following instructions found there, but this is a mitigation, not a guarantee. Review reports of untrusted repositories accordingly and keep Bob's network and credentials minimal.

## Operational readiness

- `/healthz` (liveness), `/readyz` (database + accepting work; 503 during shutdown) and Docker `HEALTHCHECK`s on both images.
- Graceful shutdown on `SIGTERM`/`SIGINT` with a hard stop after 25 s; interrupted executions are marked failed on the next start.
- Structured JSON logs (pino) with correlation IDs (`X-Request-Id`, accepted from the caller if well-formed).
- Configuration validated at start; invalid configuration aborts with a clear message. `NODE_ENV=production` forces secure cookies.
- Dependency scanning: run `npm audit --omit=dev` in `backend` and `frontend` (part of the quality gates).

## Demo mode (`STREAM_MODE=mock`)

- Nothing external is contacted: no Headless Bob request, no `git`, no QSE CLI. The entered Bob address, API key and repository token are discarded and never stored.
- Content is a recording of one real run; paths were replaced with placeholders and the files are checked at start. A missing or altered recording aborts start-up.
- Every execution, log batch, report, file name and screen is labelled `DEMO`, so a replay cannot be mistaken for a live result.
- Authentication, CSRF, roles and rate limiting stay on. Artifact downloads are looked up by recorded name, never by a caller-supplied path.
- In `realtime`, the recording is not loaded and no demo code path can run.

## Production checklist

- [ ] Strong, unique `SECRETS_KEYS` (stored in a secret manager, not in git) and `ADMIN_PASSWORD`; change the admin password after first login.
- [ ] TLS in front of the Workbench (use `docker-compose.tls.yml` or your ingress); `COOKIE_SECURE=true`.
- [ ] `STREAM_MODE=realtime` for real use (the default is `mock`, which only replays recorded demo data).
- [ ] `BOB_ALLOWED_HOSTS` set to your Bob host; Bob not exposed publicly.
- [ ] Headless Bob `AUTH_TOKENS` are long, random, and dedicated to the Workbench.
- [ ] Workspaces volume mounted read-only in Bob unless required.
- [ ] Backups of the `workbench-data` volume (database + history) and a copy of the key ring.
- [ ] Network egress for the backend limited to GitHub and Bob; for Bob to what the QSE CLI needs.
- [ ] Log shipping and alerting on `/readyz`.
- [ ] Image scanning and `npm audit` in CI.

## Known limitations

- Single bootstrap admin; there is no user-management UI (additional users would need a repository-level addition).
- SQLite is single-node. Scale-out requires replacing the `repositories/` layer.
- Redaction is pattern-based: a secret in an unrecognised format that Bob prints would not be masked in stored Bob output.
- Rate-limit state is in memory (per process).
- Egress restriction beyond the SSRF guard is a deployment concern (network policy / firewall), not enforced in code.
