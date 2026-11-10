# Security Scan Report — QSE Automation Workbench

Scope: `qse-automation-workbench/` (backend, frontend, deployment, scripts). Method: manual source review with source-to-sink tracing, pattern greps, `npm audit`, and one read-only runtime check of the SSRF classifier. Rule IDs are the CodeQL / scanner equivalents; they are not output from a CodeQL run.

## Scope and limits

- **Not scanned dynamically.** No DAST, no fuzzing, and CodeQL itself was not run.
- **Not in git.** `git ls-files` returns nothing for this project, so it is untracked in the parent repo. A "no secrets tracked" check is therefore meaningless. `.gitignore` does exclude `.env`, `.env.*`, `deployment/certs/`, `data/`, `.run/` and `deployment/qse-cli/`.
- **Secrets.** A pattern grep over source, tests, docs, deployment and scripts found only two fake test tokens (`ghp_abcdefghijklmnopqrstuvwxyz0123456789`, [`utils.test.ts:65`](../backend/tests/unit/utils.test.ts), [`security.test.ts:223`](../backend/tests/integration/security.test.ts)). Info only. `.env` files were deliberately not opened.
- **Scripts.** `deploy_ce.sh` has never been run against a real Code Engine deployment (only with a stubbed CLI). Findings 9 and 10 depend on that.

## Summary

| # | Severity | Rule | CWE | Title |
|---|---|---|---|---|
| 1 | **High** | `js/request-forgery` | CWE-918 | SSRF guard bypass via hex-form IPv4-mapped IPv6 (**confirmed at runtime**) |
| 2 | Medium | `config/permissive-ssrf-default` | CWE-918 | Compose defaults allow private-network Bob endpoints |
| 3 | Medium | `config/missing-authentication` | CWE-306 | Bundled Headless Bob profile trusts the network and defaults to empty tokens |
| 4 | Low | `nginx/add-header-inheritance` | CWE-693 | HSTS / Permissions-Policy dropped by location-level `add_header` |
| 5 | Low | `js/clear-text-logging` | CWE-532 | Failed-login log records the submitted username field |
| 6 | Low | `js/insufficient-password-hash` | CWE-916 | scrypt cost below OWASP guidance |
| 7 | Low | `docker/unpinned-base-image` | CWE-1357 | Floating base-image tags; `npm ci` runs lifecycle scripts |
| 8 | Low | `js/missing-rate-limiting` | CWE-770 | PDF render, SSE stream and password change use only the global limiter |
| 9 | Low | `config/cleartext-transmission` | CWE-319 | Bob bearer key sent over operator-chosen `http://` |
| 10 | Low | `config/unverified-trust-proxy` | CWE-348 | `deploy_ce.sh` hard-codes `TRUST_PROXY=2` unverified |
| 11 | Low | `docker/exposed-all-interfaces` | CWE-1327 | Compose publishes HTTP on all interfaces by default |

Dependency audit: **0 known vulnerabilities** in `backend/` and `frontend/` (`npm audit --package-lock-only`, all severities).

---

## High

### 1. SSRF guard bypass via hex-form IPv4-mapped IPv6 — `js/request-forgery` / CWE-918 (Server-Side Request Forgery)

[`backend/src/utils/ssrf.ts:29`](../backend/src/utils/ssrf.ts)

```ts
const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
if (mapped) return ipv4Class(mapped[1]);
...
return 'public';
```

**Root cause.** The classifier only recognises the dotted form `::ffff:a.b.c.d`. The WHATWG `URL` parser, which [`parseEndpoint`](../backend/src/utils/ssrf.ts) uses, normalises the host to hex before it reaches the classifier. Confirmed in this environment:

```
new URL('http://[::ffff:127.0.0.1]/').hostname        -> [::ffff:7f00:1]
new URL('http://[::ffff:169.254.169.254]/').hostname  -> [::ffff:a9fe:a9fe]

classifyAddress('::ffff:7f00:1')      -> public     (should be loopback)
classifyAddress('::ffff:a9fe:a9fe')   -> public     (should be blocked)
classifyAddress('::ffff:a00:1')       -> public     (should be private)
classifyAddress('::7f00:1')           -> public
classifyAddress('64:ff9b::7f00:1')    -> public     (NAT64)
classifyAddress('::ffff:127.0.0.1')   -> loopback   (dotted form is handled)

assertHostAllowedByName(parseEndpoint('http://[::ffff:169.254.169.254]/'), {allowedHosts:[], allowPrivateNetwork:false}) -> ALLOWED
assertHostAllowedByName(parseEndpoint('http://[::ffff:127.0.0.1]/'),       {allowedHosts:[], allowPrivateNetwork:false}) -> ALLOWED
```

IP literals skip DNS, so the connect-time guard in `createGuardedAgent` is not a second line of defence for them. DNS names that resolve to such addresses are also affected, because `dns.lookup` can return the same textual forms.

**Impact.** An authenticated `operator` can point the Bob connection at loopback, RFC 1918 hosts or cloud metadata (`169.254.169.254`) even with `BOB_ALLOW_PRIVATE_NETWORK=false`. The backend then sends the request with the stored bearer key attached and returns capability or error text. On a cloud VM this is a path to instance-metadata credentials. Rated High because the control exists specifically to stop this and fails on a trivial input; exploitability is limited to authenticated operators, and the product is single-tenant.

**Remediation.** Normalise before classifying and deny anything that is not global unicast:

```ts
import net from 'node:net';

const BLOCKED = new net.BlockList();
for (const [n, p] of [['0.0.0.0', 8], ['169.254.0.0', 16], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) BLOCKED.addSubnet(n, p, 'ipv4');
BLOCKED.addSubnet('fe80::', 10, 'ipv6');
BLOCKED.addSubnet('ff00::', 8, 'ipv6');

function unmap(ip: string): string {
  // expand ::ffff:HHHH:HHHH, ::HHHH:HHHH (compat) and 64:ff9b::/96 (NAT64) to dotted IPv4
  const m = /^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (!m) return ip;
  const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

export function classifyAddress(raw: string): AddressClass {
  const ip = unmap(raw.toLowerCase());
  if (net.isIPv4(ip)) return ipv4Class(ip);
  ...existing IPv6 rules...
  // fail closed on 6to4 (2002::/16), Teredo (2001::/32) and other transition ranges
  if (/^(2002:|2001:0?:)/.test(ip)) return 'blocked';
  return 'public';
}
```

Add regression tests for `[::ffff:7f00:1]`, `[::ffff:a9fe:a9fe]`, `[::ffff:a00:1]`, `[::7f00:1]` and `[64:ff9b::7f00:1]` in `backend/tests/integration/security.test.ts`.

---

## Medium

### 2. Compose defaults allow private-network Bob endpoints — CWE-918

[`deployment/docker-compose.yml:80-81`](../deployment/docker-compose.yml)

```yaml
BOB_ALLOWED_HOSTS: ${BOB_ALLOWED_HOSTS:-}
BOB_ALLOW_PRIVATE_NETWORK: ${BOB_ALLOW_PRIVATE_NETWORK:-true}
```

**Root cause.** The code default is `false`; Compose overrides it to `true` with an empty allow-list. `.env.example` sets `BOB_ALLOWED_HOSTS=headless-bob`, but a deployment without that line gets the permissive pair.

**Impact.** Any operator can aim the backend at any loopback or private host. Link-local and metadata ranges stay blocked, subject to finding 1. This turns finding 1 from a bypass of an already-open control into the only barrier.

**Remediation.**

```yaml
BOB_ALLOWED_HOSTS: ${BOB_ALLOWED_HOSTS:-headless-bob}
BOB_ALLOW_PRIVATE_NETWORK: ${BOB_ALLOW_PRIVATE_NETWORK:-false}
```

With the host explicitly allow-listed, private resolution is permitted for that name only.

### 3. Bundled Headless Bob profile trusts the network — `config/missing-authentication` / CWE-306 (Missing Authentication for Critical Function)

[`deployment/docker-compose.yml:130-132`](../deployment/docker-compose.yml)

```yaml
ALLOW_TRUSTED_NETWORK: "true"
BOB_API_KEY: ${BOB_API_KEY:-}
AUTH_TOKENS: ${AUTH_TOKENS:-}
```

**Root cause.** With `--profile bob`, the agent service is configured to accept unauthenticated callers from the Compose network and both credentials default to empty.

**Impact.** Any container on the same Compose network can drive an AI agent that can read the cloned repositories and run tools. I did not read the Headless Bob product source, so confirm its semantics for `ALLOW_TRUSTED_NETWORK` before treating this as exploitable. The service itself is not published to the host.

**Remediation.** Require the tokens when the profile is used:

```yaml
ALLOW_TRUSTED_NETWORK: "false"
BOB_API_KEY: ${BOB_API_KEY:?set BOB_API_KEY when using the bob profile}
AUTH_TOKENS: ${AUTH_TOKENS:?set AUTH_TOKENS when using the bob profile}
```

---

## Low

### 4. HSTS and Permissions-Policy dropped by location-level `add_header` — `nginx/add-header-inheritance` / CWE-693

[`default.tls.conf.template:33`](../deployment/nginx/default.tls.conf.template) sets HSTS at server level; the `location /assets/` (lines 85-86) and `location /` (lines 92-96) blocks declare their own `add_header`. NGINX does not inherit `add_header` from the parent once a child block defines any, so SPA HTML and assets are served without `Strict-Transport-Security` or `Permissions-Policy`. [`default.conf.template`](../deployment/nginx/default.conf.template:67) loses `Permissions-Policy` the same way. Also: CSP carries `style-src 'unsafe-inline'`, and `/healthz` and `/readyz` are reachable publicly.

```nginx
location / {
    add_header Cache-Control "no-store";
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    # ...existing headers
}
```

Put the shared headers in one `include` file and include it in every block that sets its own.

### 5. Failed-login log records the submitted username — `js/clear-text-logging` / CWE-532

[`controllers/index.ts:38`](../backend/src/controllers/index.ts)

```ts
req.log.warn({ username: body.username.slice(0, 64) }, 'failed login');
```

A user who pastes the password into the username field has it written to the log. Remediation: log a short hash, or log only whether the account exists.

```ts
req.log.warn({ user: crypto.createHash('sha256').update(body.username).digest('hex').slice(0, 12) }, 'failed login');
```

### 6. scrypt cost below OWASP guidance — `js/insufficient-password-hash` / CWE-916

[`passwords.ts:5`](../backend/src/utils/passwords.ts)

```ts
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
```

scrypt is an acceptable KDF, but `N=2^14` is under the OWASP minimum (`N=2^17, r=8, p=1`). The existing `DUMMY_HASH` and `timingSafeEqual` use are correct. Raise to `N: 131072` and `maxmem: 256 * 1024 * 1024`. Parameters are stored in the hash string, so existing hashes keep verifying; rehash on next successful login.

### 7. Floating base images and install scripts — `docker/unpinned-base-image` / CWE-1357

[`backend/Dockerfile:2,10`](../backend/Dockerfile), [`frontend/Dockerfile:2,12`](../frontend/Dockerfile) use `node:24-bookworm-slim` and `nginxinc/nginx-unprivileged:1.27-alpine` by tag, and run `npm ci` (line 5) with lifecycle scripts enabled. Pin by digest (`FROM node:24-bookworm-slim@sha256:...`) and use `npm ci --ignore-scripts` unless a dependency needs a build step (check `better-sqlite3`-style native modules first).

### 8. Missing route-level rate limits — `js/missing-rate-limiting` / CWE-770

[`routes/index.ts:30,55,63`](../backend/src/routes/index.ts)

```ts
router.post('/auth/password', authn, h(c.auth.changePassword));
router.get('/executions/:id/stream', h(c.executions.stream));
router.get('/reports/:id/download', h(c.reports.download));
```

All fall back to the global 300/min limiter. `/reports/:id/download?format=pdf` runs a CPU-bound PDF render ([`pdf.service.ts`](../backend/src/services/pdf.service.ts)) on an unbounded Markdown string; the SSE route holds a connection and a 15 s timer per client with no per-user cap; `/auth/password` is a password-guessing oracle for a stolen session. Add `heavy` to the download and password routes, and cap concurrent streams per session.

### 9. Bob bearer key may travel over cleartext HTTP — CWE-319

[`http-client.ts:37`](../backend/src/integrations/headless-bob/http-client.ts) sends `Authorization: Bearer` to whatever scheme the operator saved. `apiBasePath` and `authHeaderName` are not syntax-validated (undici rejects CRLF, so this is not header injection). Remediation: reject `http:` endpoints unless the host is in `BOB_ALLOWED_HOSTS` or resolves to loopback/private, and validate `authHeaderName` against `/^[A-Za-z0-9-]{1,64}$/`.

### 10. `TRUST_PROXY=2` unverified for Code Engine — CWE-348

[`scripts/deploy_ce.sh`](../scripts/deploy_ce.sh) sets `TRUST_PROXY=2` (client → Code Engine ingress → NGINX → backend). I did not confirm the ingress hop count on a live deployment. Too low: all users share the ingress IP and trip the login limiter together. Too high: a client can spoof `X-Forwarded-For` to dodge it. Verify after the first real deploy by checking the client IP the backend logs.

### 11. Compose publishes HTTP on all interfaces — CWE-1327

[`docker-compose.yml:39`](../deployment/docker-compose.yml) `"${HTTP_PORT:-8080}:8080"` binds `0.0.0.0`. For local runs use `"127.0.0.1:${HTTP_PORT:-8080}:8080"`. Session cookies are not `Secure` on plain HTTP (`COOKIE_SECURE=false` is the documented local default).

---

## Informational / design notes

- **Origin check.** `originAllowed` ([`auth.ts:30`](../backend/src/middleware/auth.ts)) accepts requests with no `Origin` header; CSRF protection then rests on the `X-CSRF-Token` check, which uses `timingSafeEqual`. `x-forwarded-host` is trusted, which is safe only because NGINX overwrites it and the backend port is unpublished. Keep it that way.
- **Authorization model.** Single-tenant with roles viewer < operator < admin. Executions, reports and artifacts are not owned per user. This is not IDOR today, but would be if multi-user separation is ever intended. `/admin/rotate-secrets` requires admin.
- **Untrusted repository content.** Cloned third-party repositories are read by an AI agent with tools: prompt-injection and excessive-agency exposure. The workspace mount is read-only by default (`BOB_WORKSPACE_MOUNT_MODE=ro`); keep it that way.
- **QSE CLI allow-list.** [`env.ts`](../backend/src/config/env.ts) defaults `QSE_CLI_ALLOWED_DIRS` to `/opt,/usr/local/bin,/usr/bin`; Compose narrows it to `/opt/qse-cli`. Executable names are limited and the realpath is used. Acceptable.
- **Cookie** has no `__Host-` prefix. Optional hardening.
- **Test tokens** `ghp_abcdefghij…` in two test files are fixtures, not secrets.

## Controls verified (no finding)

| Area | Evidence |
|---|---|
| SQL injection (CWE-89) | All values are bound parameters. The only interpolated fragments come from fixed maps: `cols` in [`execution.repository.ts:175`](../backend/src/repositories/execution.repository.ts) and [`git-repository.repository.ts:83`](../backend/src/repositories/git-repository.repository.ts), and `SORT_SQL` ([`execution.repository.ts:80`](../backend/src/repositories/execution.repository.ts)), keyed by zod enums / typed patches. |
| Command injection (CWE-78) | No `eval`, `exec` or `shell:true`. `runFile` uses `shell:false`, a minimal env, process-group kill and a timeout. |
| Git handling | `--` before the URL, `GIT_ALLOW_PROTOCOL=https`, hooks disabled, `GIT_CONFIG_GLOBAL=/dev/null`, token only via env `http.extraHeader` and redacted, escaping symlinks stripped, origin remote removed, URL/branch regexes reject option-like values. |
| Path traversal (CWE-22) | `isInside` / `realpathInside` on workspace delete ([`repository.service.ts:222-224`](../backend/src/services/repository.service.ts)); artifact downloads go to Bob by `encodeURIComponent` path with a byte cap, and demo files are resolved only from the schema-validated manifest ([`demo.service.ts:75-79`](../backend/src/services/demo.service.ts)). Download filenames are sanitised and served as `application/octet-stream` + `nosniff`. |
| Crypto | AES-256-GCM, random 12-byte IV, kid as AAD, key rotation. Sessions: 32 random bytes, stored as SHA-256; CSRF 24 random bytes ([`auth.repository.ts:58-59`](../backend/src/repositories/auth.repository.ts)). |
| Session / CORS / headers | Cookie HttpOnly + SameSite=Strict (+Secure in production). CORS callback is allow-list only, no `callback(null,true)` fall-through. Helmet on; API CSP `default-src 'none'`. |
| Input validation | zod `.strict()` schemas on bodies and queries. |
| Error handling | No stack traces to clients; 500s are generic. Central `redact()` covers GitHub tokens, Bearer/Basic, URL credentials, `password=`/`token=` pairs. |
| Frontend (CWE-79, CWE-922) | No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.cookie` or `localStorage`. `Markdown.tsx` uses `skipHtml`, a restricted `urlTransform`, and `rel="noopener noreferrer nofollow"`. `sessionStorage` holds only UI state; tests assert the CSRF token is never stored. Credential inputs use `autoComplete` correctly. |
| Containers | Backend UID 1001 with tini, `cap_drop: ALL`, `no-new-privileges`, read-only root FS; frontend is nginx-unprivileged; backend not published; QSE mount read-only. |
| TLS template | TLS 1.2/1.3 only, tickets off, `server_tokens off`, HTTP→HTTPS redirect uses fixed `PUBLIC_HOST`. |
| Secrets in scripts | Deploy scripts generate secrets with `openssl rand`, write `.env` with `umask 077` / `chmod 600`, send the login body via env → JSON (not on the command line), and `bash -n` passes on all four scripts. |
| Dependencies | `npm audit` clean for backend and frontend lockfiles. |

## Prioritised remediation

1. Fix `classifyAddress` and add tests (finding 1).
2. Flip the Compose SSRF defaults and require Bob tokens (findings 2, 3).
3. Repeat security headers in NGINX location blocks (finding 4).
4. Stop logging the raw username; raise scrypt cost (findings 5, 6).
5. Add route-level limits (finding 8); pin images (finding 7).
6. After the first real Code Engine deploy, verify `TRUST_PROXY` (finding 10).
