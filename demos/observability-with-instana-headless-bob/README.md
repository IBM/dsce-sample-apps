# Instana AI Assistant — Autonomous SRE with Headless Bob

## About

The Instana AI Assistant shows how an observability platform can move from *showing* problems to *investigating* them. It puts IBM Instana telemetry for a Kubernetes / OpenShift application (the "Retail Application") in front of an AI assistant, so an SRE can ask a question in plain language and get an answer grounded in the monitoring data, instead of switching between dashboards.

**What it gives you**

- **Infrastructure Insights**: a topology ("digital twin") of the cluster, its worker nodes and pods, with CPU / memory gauges and the issues Instana has raised.
- **Application Insights Dashboard**: error rate, P90 latency, call volume and open incidents for the application and its services, with a selectable timeframe.
- **Autonomous SRE Chat**: ask about application health, traces or an incident. The assistant queries Instana through MCP tools, and **Headless Bob** monitors in the background and posts an alert with a root-cause analysis (RCA) when it sees degradation.

**How it works**

A React UI talks to an Express bridge. In live mode the bridge reads Instana through the `mcp-instana` MCP server and uses the Bob Inference API to reason over what it finds. In mock mode, built-in data and five injectable failure scenarios let you run the whole story offline: inject a failure, watch the alert fire, then read the RCA.

**What it does not do**

The app only reads data and gives advice. Remediation steps in the chat are text; nothing in the app changes a cluster, a deployment or Instana itself. It also has no authentication (see [Security notes](#security-notes)).

## Choosing a data source

A single env var, **`STREAM_MODE`**, chooses where the data comes from:

| `STREAM_MODE` | Data source | Credentials | Use it for |
|---|---|---|---|
| `mock` (**default**) | Mock Retail Application data from a built-in scenario engine | none | Offline / customer demos: shows the full use case end to end (inject failure → alert → RCA) |
| `realtime` | **Live** IBM Instana through the `mcp-instana` MCP server (stdio); Bob Inference API provides the AI | Instana + Bob | Real environments. Nothing on screen is mock data |

Unset or invalid values fall back to `mock` (an invalid value also logs a warning). The active mode is reported by `GET /api/health` (`streamMode`) and shown in the header and status bar.

## Contents

- [About](#about)
- [Choosing a data source](#choosing-a-data-source)
- [Prerequisites](#prerequisites)
- [Quick start (mock mode)](#quick-start-mock-mode)
- [Run in realtime mode](#run-in-realtime-mode)
- [Configuration](#configuration)
- [Tabs](#tabs)
- [Mock mode (`STREAM_MODE=mock`)](#mock-mode-stream_modemock)
- [Realtime mode (`STREAM_MODE=realtime`)](#realtime-mode-stream_moderealtime)
- [Architecture](#architecture)
- [Container image](#container-image)
- [API](#api)
- [Security notes](#security-notes)

## Prerequisites

### Both modes

| Requirement | Version / notes | Check |
|---|---|---|
| Node.js | 20 or later (the container image uses Node 20) | `node --version` |
| npm | Bundled with Node.js | `npm --version` |
| Web browser | Current Chrome, Edge, Firefox or Safari | |
| `curl` | Optional, for the health check | `curl --version` |

### `realtime` mode only

| Requirement | Notes | Check |
|---|---|---|
| `uv` (provides `uvx`) and Python 3 | Runs `mcp-instana` locally (`INSTANA_MCP_COMMAND=uvx`). Not needed in the container image, which pre-installs `mcp-instana` | `uvx --version` |
| IBM Instana tenant URL | `INSTANA_BASE_URL`, reachable from the machine running the bridge | |
| Instana API token | `INSTANA_API_TOKEN`. Read-only scopes suffice; the app never changes Instana | |
| Bob Inference API credentials | `BOB_API_KEY`, `BOB_INSTANCE_ID`, `BOB_TEAM_ID` | |
| Network access | Outbound HTTPS to Instana and to the Bob API (`BOB_API_BASE_URL` if you override it) | |

### Optional

- `podman` or `docker` to build and run the [container image](#container-image).

## Quick start (mock mode)

No `.env` and no credentials are needed.

```bash
npm install
(cd server && npm install)     # bridge dependencies are installed separately
npm run dev                    # UI http://localhost:5173, bridge http://localhost:3001
```

Verify (use your `PORT` instead of 3001 if you set one):

```bash
curl -s localhost:3001/api/health      # expect "status":"ok" and "streamMode":"mock"
```

Single-process mode (the bridge serves the built UI):

```bash
npm run build && npm start             # http://localhost:3001  (PORT overrides)
```

## Run in realtime mode

```bash
cp .env.example .env      # set STREAM_MODE=realtime and fill in the placeholders; never commit .env
npm run dev               # or: npm run build && npm start
curl -s localhost:3001/api/health      # expect "streamMode":"realtime" and "mcpConnected":true
```

The bridge loads `.env` from the project root.

- The bridge exits at start-up if `BOB_API_KEY`, `BOB_INSTANCE_ID` or `BOB_TEAM_ID` is missing.
- If Instana is unreachable it starts without MCP and `/api/health` reports `mcpConnected:false`.

npm scripts: `dev` (bridge + Vite), `server` (bridge only), `client` (Vite only), `build` (UI into `dist/`), `start` (bridge, serves `dist/` when present), `preview`.

## Configuration

See [`.env.example`](.env.example).

| Variable | Mode | Notes |
|---|---|---|
| `STREAM_MODE` | both | `mock` (default) or `realtime` |
| `PORT` | both | Default 3001 (8080 in the image) |
| `INSTANA_BASE_URL`, `INSTANA_API_TOKEN` | realtime | Required |
| `BOB_API_KEY`, `BOB_INSTANCE_ID`, `BOB_TEAM_ID` | realtime | Required |
| `BOB_API_BASE_URL`, `BOB_MODEL` | realtime | Optional |
| `INSTANA_MCP_COMMAND`, `INSTANA_MCP_ARGS` | realtime | `uvx` locally; preset to `mcp-instana` in the image |
| `INSTANA_APP_NAME` | both | Application perspective name (default `Retail Application`) |
| `INSTANA_K8S_CLUSTER` | realtime | Pin the cluster; otherwise the one with the highest CPU requests is auto-selected and the UI says so |
| TLS variables | realtime | Only for corporate CAs |

## Tabs

| Tab | `realtime` | `mock` |
|---|---|---|
| ☸️ **Infrastructure Insights** (default) | `GET /api/infrastructure/digital-twin` → `manage_infrastructure` (`kubernetesNode`, `kubernetesPod`); cluster picker, topology (click a node, or Tab to it and press Enter/Space, to focus it and show its pods), gauges, issues, pods | Mock 3-node OpenShift cluster; same panel plus scenario injector, mock disk / network / agent values |
| 📊 **Application Insights Dashboard** | `GET /api/insights` → `manage_applications`; rate-limit / stale handling | Mock KPIs, services, incidents; timeframe scaling (5m / 15m / 1h / 3h / 24h); scenario injector |
| 🤖 **Autonomous SRE Chat** | `POST /api/prompt` (Bob + MCP tools), `POST /api/headlessbob/diagnose`; Headless Bob monitor column streams alerts over SSE. **Clear chat** (toolbar above the messages, asks to confirm) empties the conversation and its history | Canned, keyword-matched answers and per-scenario RCA after a short delay; the monitor column is pre-attached to the mock SSE stream (no Headless Bob server needed) |

## Mock mode (`STREAM_MODE=mock`)

Everything is generated in-process and labelled: a **MOCK DATA** header badge, a **MOCK DATA** pill on the dashboard and digital twin, a *MOCK* tag on the Headless Bob panel, and every chat answer / RCA starts with a "MOCK DATA" notice. API payloads carry `source: "mock"` / `simulated: true`; trace IDs in canned answers are prefixed `sim-`.

Demo flow:

1. Open **Application Insights Dashboard** or **Infrastructure Insights** (baseline: healthy, ~0.4 % error rate).
2. **Select SRE Anomaly Scenario** and pick one of five failures. The bridge broadcasts a critical SSE alert; all tabs refresh and the affected node/services turn red.

   | Scenario id | Affected services | Node |
   |---|---|---|
   | `db_pool_exhaustion` | shipping-service, payment-service | ocp-worker-02 |
   | `jvm_memory_leak` | payment-service, order-service | ocp-worker-02 |
   | `redis_cache_failure` | cart-service, catalog-service | ocp-worker-01 |
   | `gateway_rate_limit` | payment-service, order-service | ocp-worker-02 |
   | `cpu_throttling_eviction` | order-service, user-auth-service | ocp-worker-03 |

3. In **Autonomous SRE Chat** the alert appears; ask "Give me the health of Retail Application" to get the mock report followed by the scenario's RCA from "Headless Bob".
4. **Reset Baseline** restores normal traffic.

Limits of mock mode: scenario state is global to the process (all browsers share it); answers are keyword-driven (health / trace / generic); the RCA text is pre-written per scenario; remediation is text only. No MCP server or Bob API is started, `GET /api/health` reports `mcpConnected:false`, and `/hb/*`, `/api/tools` and `/api/erroneous-rate` return 404.

## Realtime mode (`STREAM_MODE=realtime`)

Live-only behaviour:

- Node CPU / memory gauges are **requests vs allocatable capacity** (Instana `required_cpu_percentage`, `required_mem_percentage`), not live utilisation. Pod gauges are usage vs the pod's own limits.
- Agent version, disk and network I/O are **not** fetched; the UI does not show them.
- Pod list is capped at 200 per query; the UI flags truncation.
- If Instana returns no data the UI shows an explicit *unavailable*, *stale* or *rate-limited* state. Mock data is never substituted.
- There is **no scenario injector**: `/api/scenarios` and `/api/demo/*` return 404 (`Scenario injection is only available when STREAM_MODE=mock`). The digital twin focuses the node with the worst real Instana severity / pod pressure.
- Remediation is advisory text only. Nothing in the app changes a cluster.

## Architecture

```
Browser (React, Carbon tokens)
   │  /api/*  (JSON, SSE)         /hb/*  (Headless Bob proxy, realtime only)
   ▼
Express bridge  (server/index.mjs, PORT 3001 locally / 8080 in the image)
   │
   ├─ STREAM_MODE=mock    server/mockRoutes.mjs + server/mockData.mjs
   │                      in-memory scenario engine; no network calls
   │
   └─ STREAM_MODE=realtime  MCP stdio ─► mcp-instana (11 tools) ─► your Instana tenant
                          REST      ─► Bob Inference API
```

Project layout:

```
instana-bob-app/
├── src/                 React UI (App.jsx, components/)
├── server/              Express bridge (index.mjs, mockRoutes.mjs, mockData.mjs, package.json)
├── Dockerfile           Multi-stage container build
├── .env.example         Configuration template (copy to .env)
├── vite.config.js       Dev server; proxies /api and /hb to the bridge
└── package.json         UI dependencies and npm scripts
```

## Container image

Multi-stage [`Dockerfile`](Dockerfile): UI build → production bridge dependencies → runtime (Node 20, Python 3, `uv`, pre-installed `mcp-instana`, non-root `node` user, `HEALTHCHECK` on `/api/health`, port 8080). No secrets are baked in. The image defaults to mock mode unless `STREAM_MODE=realtime` is supplied at run time.

```bash
podman build -t instana-bob-live:local .
podman run --rm -p 8080:8080 instana-bob-live:local                       # mock
podman run --rm -p 8080:8080 --env-file .env instana-bob-live:local       # .env with STREAM_MODE=realtime
curl -s localhost:8080/api/health     # "streamMode":"mock" or "realtime" (+ "mcpConnected":true)
```

Docker works the same way with `docker` in place of `podman`.

## API

| Endpoint | Mode | Purpose |
|---|---|---|
| `GET /api/health` | both | `streamMode`, MCP status, tool count, Instana host (no secrets) |
| `GET /api/insights?window=` | both | Application KPIs, services, incidents; live adds `unavailable`/`isStale`/`rateLimited` flags |
| `GET /api/infrastructure/digital-twin?cluster=&window=&force=` | both | Node/pod snapshot (live: 30 s cache; mock: `source:"mock"`) |
| `POST /api/prompt` | both | Chat (live: Bob + Instana MCP tools; mock: canned) |
| `POST /api/headlessbob/diagnose` | both | Root-cause analysis (live: Headless Bob / Bob; mock: per-scenario text) |
| `GET /api/monitor/stream` | both | SSE stream of monitor events: `connected`, `check_start`, `status_tick`, `alert`, `monitor_started`, `monitor_stopped`; realtime mode also emits `bob_running` and `monitor_error` |
| `POST /api/monitor/register` `{url, token?}` | both | Register a Headless Bob server for monitoring (mock: accepted, no-op) |
| `POST /api/monitor/start`, `POST /api/monitor/stop` | both | Start / stop the monitor loop |
| `GET /api/monitor/status` | both | Current monitor state |
| `POST /api/monitor/check_now` | both | Trigger one monitor cycle |
| `GET /api/scenarios` | mock | List scenarios |
| `POST /api/demo/load-data` `{scenarioId}` | mock | Inject a scenario; broadcasts an alert |
| `POST /api/demo/reset-data` | mock | Restore baseline |
| `ANY /hb/*`, `GET /api/tools`, `GET /api/erroneous-rate` | realtime | Headless Bob proxy / MCP tool list / quick KPI |

## Security notes

- The app has **no authentication**, and in `realtime` mode `/hb/*` is an open proxy to Headless Bob. Run it on a trusted network, or put an authenticating gateway in front of it.
- `.env` is git-ignored; keep credentials there or in your platform's secret store, never in the image or the repository.
- Use a read-only Instana API token.

## Specification

[`SPEC.md`](SPEC.md) lists the requirements (with stable IDs), API contract, security requirements, known gaps and acceptance checks. Read it before changing behaviour, and update it in the same change.

[`BUILD_SPEC.md`](BUILD_SPEC.md) is the build-oriented companion: exact file tree, wire contracts, prompts, mock data and ordered milestones with acceptance checks, written so that IBM Bob can recreate the app from an empty directory.

