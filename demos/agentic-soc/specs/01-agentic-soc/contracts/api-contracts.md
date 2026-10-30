# Agentic SOC — API Contracts

**Feature**: Automated QRadar Offense Response Pipeline

---

## 1. Express Backend API (`server/server.js`, port 3001)

Base URL: `http://localhost:3001` (local) / `BACKEND_URL` (Code Engine)

All responses include `{ "success": true|false, ... }`.
Frontend checks both `res.ok` AND `response.success`.
Error shape: `{ "success": false, "error": "<message>", "details": <body|null> }`.

---

### `GET /api/config`

Returns stage configuration and service readiness.

**Response 200:**
```json
{
  "success": true,
  "serviceConfigured": true,
  "stages": [
    { "key": "triage",         "label": "Triage",         "agentId": "<uuid>", "instruction": "..." },
    { "key": "classification", "label": "Classification", "agentId": "<uuid>", "instruction": "..." },
    { "key": "rca",            "label": "RCA",            "agentId": "<uuid>", "instruction": "..." },
    { "key": "notification",   "label": "Notification",   "agentId": "<uuid>", "instruction": "..." },
    { "key": "action",         "label": "Action",         "agentId": "<uuid>", "instruction": "..." },
    { "key": "close",          "label": "Close",          "agentId": "<uuid>", "instruction": "..." }
  ]
}
```

`serviceConfigured = Boolean(SERVICE_URL && API_KEY)` (`WXO_URL`/`WATSONX_SERVICE_URL` and `WXO_API_KEY`/`WATSONX_API_KEY`).
Stage objects have exactly 4 fields: `key`, `label`, `agentId`, `instruction`.

---

### `POST /api/poc-stages/:stageKey/run`

Creates a WxO agent run for the given stage. Returns immediately with run ID.

**Request:**
```json
{ "prompt": "Analyze QRadar Offense 167657\n\n[TRIAGE RESULT]:\n...", "threadId": "<optional>" }
```

**Response 200:**
```json
{
  "success": true,
  "runId": "<uuid>",
  "threadId": "<uuid|null>",
  "taskId": "<uuid|null>",
  "startedAt": "2025-01-01T00:00:00.000Z"
}
```

**Errors:** unknown stage → 404 `Unknown stage: <key>`; missing prompt → 400 `prompt is required`;
no service URL → 500 `Missing WATSONX_SERVICE_URL`; upstream failure → `error.statusCode || 500`
`{ "success": false, "error": "<message>", "details": <body|null> }`.

---

### `GET /api/poc-stages/:stageKey/run/:runId`

Polls a WxO run for completion. Called every 4 seconds by the browser.

**Response — still running:**
```json
{ "success": true, "completed": false, "status": "running" }
```

**Response — completed** (`run` is nested; the UI reads `payload.run`; `failed`/`cancelled` are also returned as `completed:true`):
```json
{
  "success": true,
  "completed": true,
  "stage": { "key": "triage", "label": "Triage", "agentId": "<uuid>" },
  "run": {
    "threadId": "<uuid|null>",
    "runId": "<uuid>",
    "taskId": null,
    "messageId": null,
    "status": "completed",
    "outputText": "TRIAGE RESULT\noffense_id: 167657\n...",
    "analytics": {
      "status": "completed",
      "durationMs": 42300,
      "toolCalls": 7,
      "traceCount": 12,
      "startedAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:42.300Z"
    },
    "traces": [ /* WxO run events / step history */ ],
    "raw": { /* full WxO run details incl. result.data.message.step_history */ }
  }
}
```

**`traces` and `raw` are REQUIRED** — the StageCard **Tools** tab (`ui-design.md` §7.6) derives every tool call
(name, arguments, response) from `raw.result.data.message.step_history` and from `traces[]`
(`step_history → step_details → tool_calls / tool_response`). Dropping either field empties the Tools tab.

**`run.outputText` is the report's data source.** In Live mode the Incident Report is built by parsing `outputText` (plain-text blocks per `data-model.md` §3.1–§3.6). `outputText` MUST be the agent's final text as returned by WxO (`result.data.message.content[0].text`), unmodified — not a summary, markdown re-render or truncated copy — otherwise the report fields cannot be mapped.


---

### `POST /api/chat-conv`

Creates a conversational supervisor run.

**Request:**
```json
{
  "message": "Investigate offense 167657",
  "threadId": "<uuid-or-null>"
}
```

**Response 200:**
```json
{
  "success": true,
  "runId": "<uuid>",
  "threadId": "<uuid|null>",
  "startedAt": "2025-01-01T00:00:00.000Z"
}
```

---

### `GET /api/chat-conv/:runId`

Polls the conversational supervisor run.

**Response — completed** (flat — no nested `run`):
```json
{
  "success": true,
  "completed": true,
  "threadId": "<uuid|null>",
  "runId": "<uuid>",
  "status": "completed",
  "outputText": "✅ **Triage — Offense 167657**\n| Field | Value |\n...",
  "analytics": { "status": "completed", "durationMs": 0, "toolCalls": 0, "traceCount": 0, "startedAt": "…", "updatedAt": null },
  "traces": []
}
```

---

### `GET /api/wxo-token`

Returns a WxO embed JWT for the `ConversationalSupervisorWidget`.

**Response — success:**
```json
{ "success": true, "token": "<RS256-JWT>" }
```

**Response — key not configured (HTTP 200, not 503):**
```json
{ "success": false, "error": "WXO_EMBED_PRIVATE_KEY is not configured in .env" }
```

---

### `GET /health`

Health check endpoint.

**Response 200:**
```json
{ "status": "healthy", "serviceConfigured": true, "convSupervisorConfigured": true, "pipeline": "SOC 5-Agent Pipeline" }
```

---

## 2. Next.js Layer (port 3000)

In Mock Mode (default), stage runs and telemetry are handled client-side by `mockPipelineData.ts` without network roundtrips to WxO.
In Live Mode, Next.js Route Handlers bypass the 30-second http-proxy socket timeout for long-running WxO calls by proxying directly to Express.
They act as **pure pass-throughs** to Express for live execution: forwarding requests, maintaining streaming/text responses, and handling timeout signals.
Bodies are forwarded as text (`new NextResponse(body, { status, headers })`).
All use `export const maxDuration = 120;` and `params` as a `Promise` (`const { stageKey } = await params;`).

---

### `GET /api/config`, `POST /api/chat-conv`, `GET /api/wxo-token`, `GET /health`, `/api/runs/*`

Proxied to Express by `next.config.js` rewrites (not Route Handlers). `/api/config` returns exactly the Express shape in §1
(no `mode` field).

---

### `POST /api/poc-stages/[stageKey]/run`

Express base: `process.env.BACKEND_URL?.replace(/\/api.*$/, '') || 'http://localhost:3001'`.
Forwards body to Express with `AbortSignal.timeout(30_000)`. Returns Express status + body unchanged.

---

### `GET /api/poc-stages/[stageKey]/run/[runId]`

Forwards the query string (`startedAt`, `threadId`) to Express with `AbortSignal.timeout(90_000)`.
On `err.name === 'TimeoutError' || err.code === 23` → **504**
`{ "success": false, "completed": false, "status": "running", "error": "…", "retryable": true }`;
any other fetch error → **502** with the same shape (`retryable: true`). The UI keeps polling on `retryable`.

---

### `GET /api/chat-conv/[runId]`

Express base: `process.env.EXPRESS_BASE_URL || 'http://localhost:3001'`. `AbortSignal.timeout(55_000)`; text pass-through.

---

### `GET /api/config-files`

Route Handler — fetches the fixed file manifest directly from IBM COS using `ibm-cos-sdk` (`Promise.all`, bucket root).
Required env: `COS_API_KEY`, `COS_INSTANCE_CRN`, `COS_ENDPOINT`, `COS_BUCKET`.

**Response 200:**
```json
{ "files": [ { "id": "triage-instructions", "label": "Triage Logic", "group": "Agents", "content": "spec_version: v1\n…" } ] }
```

| id | label | group | COS key |
|---|---|---|---|
| `triage-instructions` | Triage Logic | Agents | `triage_agent.yaml` |
| `classification-instructions` | Classification Logic | Agents | `classification_agent.yaml` |
| `rca-instructions` | RCA Logic | Agents | `rca_agent.yaml` |
| `notification-instructions` | Notification Logic | Agents | `notify_agent.yaml` |
| `action-instructions` | Action Logic | Agents | `action_agent.yaml` |
| `close-instructions` | Close Logic | Agents | `close_agent.yaml` |
| `allowlist` | allowlist.yaml | Config | `allowlist.yaml` |
| `exfil-tools` | exfil_tools.yaml | Config | `exfil_tools.yaml` |
| `maintenance-windows` | maintenance_windows.yaml | Config | `maintenance_windows.yaml` |
| `privileged-accounts` | privileged_accounts.yaml | Config | `privileged_accounts.yaml` |
| `service-path-policy` | service_path_policy.yaml | Config | `service_path_policy.yaml` |

Per-file read error → content is `# Could not fetch "{key}" from COS bucket "{bucket}"\n# Error: {message}` (file not skipped).
Missing `COS_BUCKET` → 500 `{ "error": "COS_BUCKET env var is not set" }`; other COS env missing → 500 `{ "error": "Missing COS env vars: …" }`.

---

## 3. WxO Platform API (upstream, called by Express)

### Create Run
```
POST https://{host}/instances/{instanceId}/v1/orchestrate/runs
Authorization: Bearer {iamToken}
Content-Type: application/json

{
  "agent_id": "{uuid}",
  "message": { "role": "user", "content": "{prompt}" },
  "thread_id": "{uuid}"    // optional
}
```

**Response 200:**
```json
{ "run_id": "...", "thread_id": "...", "task_id": "...", "status": "running" }
```

### Poll Run
```
GET https://{host}/instances/{instanceId}/v1/orchestrate/runs/{runId}
Authorization: Bearer {iamToken}
```

### Fetch Run Events
```
GET https://{host}/instances/{instanceId}/v1/orchestrate/runs/{runId}/events
Authorization: Bearer {iamToken}
```

### IAM Token Exchange (IBM Cloud)
```
POST https://iam.cloud.ibm.com/identity/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={API_KEY}
```

### IAM Token Exchange (SaaS/On-Prem)
```
POST https://iam.platform.saas.ibm.com/siusermgr/api/1.0/apikeys/token
Content-Type: application/json

{ "apikey": "{API_KEY}" }
```
