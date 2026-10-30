# Agentic SOC — Feature Specification

**Feature**: Automated QRadar Offense Response Pipeline
**Version**: 1.0 (PoC)
**Status**: Implemented and deployed on IBM Cloud Code Engine
**Baseline**: This specification describes the application **as deployed** on IBM Cloud Code Engine
(project `Agentic-SOC`, region `au-syd`; apps `agentic-soc-frontend` and `agentic-soc-backend`),
verified against the running apps on 2026-10-22. Where the deployed behaviour differs from
the repository source, this document follows the deployed behaviour. See §6 for the deployment
baseline and §7 for known deployment limitations.
**UI**: Default Mock Mode for realistic demo presentation; toggleable to Live Mode for real watsonx Orchestrate instance execution — see [`ui-design.md`](./ui-design.md).

---

## 1. Overview

An IBM watsonx Orchestrate multi-agent pipeline that automates the full QRadar security offense
response lifecycle — from triage through root cause analysis to remediation — replacing
repetitive Tier-1 and Tier-2 SOC analyst work. The deployed dashboard exposes a **5-agent
pipeline**: Triage → Classification → RCA → Notification → Action.

---

## 2. User Stories

### US-01: Run Full Offense Investigation
**As a** SOC analyst,
**I want to** select a QRadar offense ID and trigger the full automated pipeline,
**So that** I receive a complete triage → classification → RCA → notification → action report.

**Acceptance Criteria:**
- Offense is triaged with Critical/High/Medium/Low/Informational severity.
- Classification produces TP/FP/BP/Needs-RCA verdict with confidence level.
- RCA report is generated with 5-dimension analysis + MITRE ATT&CK mapping.
- Notification stage produces the incident notification (HTML incident email via Mailjet in Live mode).
- Action stage records the remediation decision.
- **Run Pipeline** executes all 5 stages sequentially, in order, for every offense; the dashboard does
  not skip stages based on verdict (PATH routing in FR-03 is applied by the agents / Conversational
  Supervisor, not by the dashboard).
- If a stage fails, the status bar reports `"{Label} failed — continuing pipeline…"` and the next stage still runs.
- A closed-offense audit trail is produced by the agents' close tooling (the Classification agent carries `close_offense`); the dashboard has **no separate Close stage card**.

---

### US-02: Inspect Agent Output and Tool Calls
**As a** SOC analyst (or demo presenter),
**I want to** see, for every stage, the agent's final answer **and** every tool the agent called with its arguments and response in both Mock Demo and Live modes,
**So that** I can verify how each verdict was reached and demonstrate full SOC investigation capabilities.

**Acceptance Criteria:**
- Every `StageCard` has four tabs: **Output**, **Tools (N)**, **Traces (N)**, **Prompt** (see `ui-design.md` §7).
- Output tab shows `run.outputText` (from mock pipeline data in Mock mode, or directly returned by WxO in Live mode), with a Copy button.
- Tools tab lists each tool call as a card: tool name, `#N`, **Arguments** (JSON) and **Response** (JSON/text), extracted via `extractToolCalls` (`ui-design.md` §7.6).
- Traces tab shows the trace array as JSON.
- Expanded card shows Thread ID, Run ID, Duration and `Tools / Traces` counts.
- Analytics section aggregates duration, unique tool-call count, trace count and completed-stage count.
- In Mock mode, realistic high-fidelity data simulates end-to-end execution without requiring an active WxO instance. In Live mode, the Express backend returns `traces` and `raw` (full WxO run) on every completed poll so the tabs are populated from real agent execution.
- If an upstream error is returned by the backend (for example an IAM / WxO failure), the UI shows the real error text in the Navbar status bar and on the stage card; it is not replaced by simulated data.
- Each stage card lists its stage's agent name, "Step N of 5" label, accent colour and tool list (served by the frontend's own `/api/config`, see §6.3).

---

### US-03: Conversational Offense Investigation
**As a** SOC analyst,
**I want to** investigate offenses via natural language chat with the Conversational Supervisor,
**So that** I can ask targeted questions ("is offense 167657 a true positive?") without running the full pipeline.

**Acceptance Criteria:**
- A floating chat button (`WxoChatWidget`, bottom-right) is available in **both** modes, with placeholder `Ask the supervisor agent…`.
- In Mock mode the widget answers locally with simulated supervisor responses for the selected offense (~0.75 s).
- In Live mode the widget calls `POST /api/chat-conv` then polls `GET /api/chat-conv/:runId`.
- The embedded WxO chat (`ConversationalSupervisorWidget`) renders only when Live mode is active **and** `serviceConfigured` is true.
- Supervisor detects intent (full investigation / triage only / classify only / RCA / close / status / question).
- Prerequisite stages run silently when a downstream stage is requested directly.
- Each step gate asks for analyst confirmation before proceeding.
- NOT_FOUND / ALREADY_CLOSED / OUT_OF_SCOPE offenses halt immediately with a clear message.
- No raw JSON or tool output is ever surfaced to the analyst.

---

### US-04: Action Approval (Mock Mode Only)
**As a** SOC analyst (in Mock Demo mode),
**I want to** review and approve/reject proposed remediation actions (block IP, isolate host) via the Action Approval Panel,
**So that** no irreversible action executes without my explicit approval during demonstration walkthroughs.

**Acceptance Criteria:**
- **Mock Mode Only**: When the Action stage starts in Mock mode, the panel opens (status `[Action] Action Approval Required — Waiting for analyst review…`) and displays each proposed action with target, action type, and justification, awaiting human-in-the-loop analyst adjudication.
- Analyst can approve or reject each action individually, or use **Approve All Actions**.
- Approved actions are recorded in the simulated audit trail and reflected in the Action output (adjudication summary with ✅ EXECUTED / ❌ REJECTED by Analyst).
- **Live Mode**: The panel is never opened; the Action stage runs directly against the live WxO Action agent endpoint without client-side mock gating.

---

### US-05: Incident Report Export
**As a** SOC analyst,
**I want to** download a complete incident investigation report after the RCA stage completes,
**So that** I can share it with management or demonstrate executive report generation.

**Acceptance Criteria:**
- Once the RCA stage has `status = completed` — **in either Mock or Live mode** — the teal "Root Cause Investigation Report Ready for Download" banner, the RCA stage-card **Report** button / callouts, and the floating bottom-left **View RCA Report** pill are shown. `IncidentReportModal` is always mounted.
- Report includes: offense metadata, triage verdict, classification verdict, 5-dimension RCA evidence, MITRE ATT&CK, chronological timeline, recommended actions — built from stage outputs.
- **Mock mode**: the report is generated from the mock/static offense and mock stage outputs.
- **Live mode**: the report MUST be generated **only** from the parsed `run.outputText` of the completed stages (RCA, Classification, Triage, and, when present, Action, Notify and Close), following FR-08 and [`data-model.md`](./data-model.md) §3.7–§3.8. Static offense data and placeholder values (e.g. `10.x.x.x`, `203.0.x.x`) MUST NOT appear in a Live report.
- In Live mode a field whose value is absent from every stage output (empty, `N/A`, `unknown`, `none`) is **omitted** from the report. The literal strings "N/A" / "Unknown" MUST NOT be printed as report values.
- Modal has **Preview** and **Markdown Source** tabs.
- Export as HTML file (`Incident_Report_Offense_{id}.html`, opens in browser, printable).
- Export as Markdown file (`Incident_Report_Offense_{id}.md`), plus Print / PDF and Copy Markdown.

---

### US-06: Config Inspection
**As a** SOC engineer,
**I want to** inspect the live agent YAML instructions and policy YAML files,
**So that** I can verify the active configuration without SSH-ing into the server.

**Acceptance Criteria:**
- ConfigViewer panel ("Agent & Config Files") shows the 6 agent YAMLs fetched from IBM COS (group `Agents`).
- ConfigViewer shows 5 policy YAMLs (allowlist, exfil_tools, maintenance_windows, privileged_accounts, service_path_policy) fetched from COS (group `Config`).
- Panel is collapsible; default closed.
- Graceful error shown if COS credentials are not configured: `GET /api/config-files` returns HTTP 500 `{ "error": "COS_BUCKET env var is not set" }` (or `Missing COS env vars: …`) and the panel shows `No files loaded — check COS configuration.`
- `/api/config-files` is served by the **frontend** container (Next.js Route Handler), so it needs the `COS_*` variables on the frontend app — see §7.

---

## 3. Functional Requirements

### FR-01: Dual-Mode Execution (Mock Demo Default & Live WxO Toggle)
- Initial state is **Mock Mode**. On load the saved choice in `localStorage('soc_mock_mode')` is restored if present.
- After restoring, the dashboard calls `GET /api/config` and applies it:
  - `serviceConfigured = false` → Mock Mode is **forced on**, `localStorage('soc_mock_mode')` is overwritten with `true`, status bar shows `⚡ Self-Contained Simulation Engine Active.`
  - `/api/config` request fails → Mock Mode is forced on (not persisted), same status text.
  - `serviceConfigured = true` and the user is in Live Mode → status `watsonx Orchestrate agent endpoints connected.`
- `serviceConfigured` is computed **by the frontend container** from its own `WXO_URL`/`WATSONX_SERVICE_URL` and `WXO_API_KEY`/`WATSONX_API_KEY`. On the Code Engine deployment the frontend has neither, so it is always `false` (see §7).
- **Mock Mode (Demo)**:
  - Designed for customer demonstrations and sales/tech presentations.
  - Each stage runs ~5.0 s of simulated reasoning with progressive status messages (`Initiating agent reasoning…` → `Executing security tools…` → `Synthesizing findings…`), then completes via `buildMockRunDetails` with duration fixed at 5000 ms; no network call is made.
  - **No live WxO instance is required or contacted** — Mock Mode works without any credentials.
  - Displays realistic execution delays, tool execution traces, structured output blocks, analytics, human-in-the-loop action approval gating, and RCA incident report generation.
  - An icon-only ⚡ (Zap) pre-populate button (tooltip `Instantly pre-populate all stage responses for this offense`) is shown in the Agent Execution header in Mock Mode only.
- **Live Mode (WxO Connected)**:
  - User toggles via the Navbar segmented switch (`Mock Mode` / `Live WxO`); the toggle is always allowed.
  - Toggle status messages: configured → `Live watsonx Orchestrate endpoint execution active.`; not configured → `⚠️ Live mode selected, but WxO credentials not configured in .env. Simulation mode is recommended.`
  - The Navbar pill shows `WxO Connected` (blue) or `WxO Disconnected` (amber); Mock shows `Simulation Engine` (emerald).
  - Stage runs go `POST /api/poc-stages/{stageKey}/run` → poll `GET /api/poc-stages/{stageKey}/run/{runId}` (see FR-07 for how the frontend Route Handlers behave when WxO is not configured on the frontend).
  - The Action Approval Panel is never opened in Live Mode; the RCA report surfaces follow US-05 (shown in both modes).
  - Before running a stage whose prompt is empty, status shows `Please enter a scenario prompt before executing {Label}.`
- **No "WxO not connected" experience (deployed behaviour — MUST be replicated)**:
  - On load the dashboard is **always usable**: with no WxO credentials it silently starts in Mock Mode (badge `SIMULATION`, pill `Simulation Engine`, status `⚡ Simulation Mode Active — Running end-to-end WxO multi-agent pipeline.` → `⚡ Self-Contained Simulation Engine Active.` after `/api/config`).
  - The UI MUST NOT render any of: a `WxO Off` control, a `WxO disconnected (demo)` pill, a `WxO instance disconnected — pipeline will not run.` sub-bar message, a `WxO instance not connected. Stage runs will fail immediately…` hero warning banner, or a `Toggle WxO Live…` instruction.
  - `Run Pipeline` (Navbar and Agent Execution header) and every per-stage `Run` button are **never disabled or visually greyed because of WxO connectivity**; they are disabled only while a run is in progress.
  - The **only** place a disconnected state is ever shown is the amber `WxO Disconnected` Navbar pill (plus amber `AlertTriangle` sub-bar icon and the `⚠️ Live mode selected, but WxO credentials not configured in .env. Simulation mode is recommended.` status), and only after the user **manually** selects `Live WxO` while `serviceConfigured = false`. Reloading the page returns to Mock Mode (see above).
  - There is a single mode control: the segmented `Mock Mode` / `Live WxO` switch. No separate on/off WxO button exists.

### FR-02: 5-Stage Sequential Pipeline
Stages run in strict sequential order, as returned by the frontend `/api/config`:
`triage → classification → rca → notification → action`
Each stage's output is prepended to the next stage's prompt (prompt chaining). The prompt builder also supports a `close` stage (triage + classification + RCA + action sections), but no `close` stage is configured in the deployed UI, so it is never shown or executed (see §7, item 4).

### FR-03: PATH Routing
Applied by the agents and the Conversational Supervisor (not by the dashboard's **Run Pipeline**, which always runs all 5 stages):
- **PATH 1** (Full Investigation): TP or Needs-RCA classification, or Critical/High/Medium severity with TP verdict.
- **PATH 2** (Direct Close): FP or BP classification, OR Low/Informational severity.
- Medium severity + FP or BP → PATH 2.
- Critical/High + BP → PATH 1.

### FR-04: Per-Stage Independent Execution
- Each stage card on the dashboard can be run independently (not only sequentially).
- Stage outputs persist in React state for the page session only.
- Rerunning a stage overwrites its previous output.
- Selecting a different offense clears per-stage prompt overrides and closes the Action Approval Panel.

### FR-05: Session and Mode State
- Pipeline execution outputs live in React state (`runs`, `runsRef`); a browser refresh clears stage outputs.
- Mode selection (`mockMode`) is persisted in `localStorage('soc_mock_mode')` on every toggle and defaults to `true`; per FR-01, it is overwritten with `true` on load whenever the frontend reports `serviceConfigured = false`.
- The `Clear` button resets all stage outputs and traces and closes the Action Approval Panel.

### FR-06: Analytics per Stage
- Each completed stage displays: status, duration (ms), tool call count, trace item count, started_at.

### FR-07: Frontend API Layer Behaviour
The frontend container serves these as Next.js Route Handlers:
- `GET /api/config` → `{ success, serviceConfigured, stages, mode }` with `mode = "live_capable"` when `serviceConfigured`, else `"mock_default"`. Each of the 5 stages carries `key, label, agentName, agentId, instruction, tools[], stepLabel ("Step N of 5"), color`. **This handler shadows the backend's `/api/config`** (which lists 6 stages), so the UI sees only the 5 frontend stages.
- `POST /api/poc-stages/:stageKey/run` → forwards to the backend only when the frontend has both `WXO_URL` and `WXO_API_KEY`; otherwise (and on a failed upstream call) it returns a **simulated** run: `{ success:true, runId:"mock-run-{offenseId}-{stage}-{ts}", threadId:"mock-thread-…", taskId:"mock-task-{stage}", startedAt, mock:true }`.
- `GET /api/poc-stages/:stageKey/run/:runId` → a `runId` starting with `mock-` returns completed mock run details immediately; any other `runId` is forwarded to the backend (`BACKEND_URL`) and the backend's status and body (including errors) are returned unchanged; if the backend is unreachable it falls back to mock details.
- `POST /api/chat-conv` and `GET /api/chat-conv/:runId` → same pattern (mock when WxO / `CONV_SUPERVISOR_AGENT_ID` are not set on the frontend or when `runId` starts with `mock-`).
- `GET /api/config-files` → reads the 11 manifest files directly from IBM COS (US-06).
- `/api/runs/*`, `/api/chat`, `/api/wxo-token`, `/health` are `next.config.js` rewrites whose destination is fixed at **build time** (see §7, item 3).

### FR-08: Live Report Data Mapping
- In Live mode the Incident Report (Preview, HTML export, Markdown export, Copy Markdown) is built by parsing the plain-text agent blocks in `runs.<stage>.run.outputText` (formats in [`data-model.md`](./data-model.md) §3.1–§3.6) and mapping fields per the table in `data-model.md` §3.7.
- Parsing is label-based and tolerant of the `═══` delimiters and padded RCA labels (`data-model.md` §3.8). The RCA `MITRE ATT&CK` value (`Tactic: Technique — T-number`) is split into tactic, technique and technique ID.
- Source precedence per field is RCA → Classification → Triage (→ Action / Notify / Close for their own sections). The first non-absent value wins.
- Absent values (`N/A`, `unknown`, `none`, empty) are never rendered as such; the field or section is omitted. No value is invented or taken from static offense data (`PocOffense`, `sampleOffenses`) or mock data in Live mode.
- Multi-valued data present in an output block (e.g. `Attacker IP List`, several Recommended Actions, several Evidence lines) MUST be rendered in full, not collapsed to the first item.
- The report is available once the RCA **or** Classification output exists; otherwise the Report button is disabled with the tooltip "No analysis output available yet".
- Completeness limits of the underlying data (event sampling, unavailable enrichment, redacted payloads) are documented in `data-model.md` §3.9; the report MUST NOT assert more than the stage outputs state.

---

## 4. Out of Scope

- Live QRadar SIEM API integration (CSV-from-COS only, Phase 2 is live API).
- ServiceNow / SOAR integration (removed).
- Forensic evidence collection.
- Analyst feedback loop / LLM fine-tuning.
- Mobile application (web dashboard only).
- Multi-tenant or multi-region deployment.
- Fully autonomous remediation (analyst approval always required).
- A Close stage card in the dashboard (the backend and mock data support a `close` stage; the deployed UI does not expose it).
- The legacy `agentic-soc-ui` Code Engine app (see §6.1).

---

## 5. Edge Cases

- **Offense ID not found**: Triage returns `NOT_FOUND`; the agents halt; the dashboard still lets later stages run on user request.
- **Offense already closed**: Triage returns `ALREADY_CLOSED`; no further processing by the agents.
- **Out-of-scope offense type**: Triage returns `OUT_OF_SCOPE`; logs via `soc_log_out_of_scope`.
- **Tool failure in Triage**: Affected field set to `"unknown"`; triage still produces a verdict; reasoning records the failure. In the Live report such `unknown` fields are omitted (FR-08), not printed.
- **Live report with missing stage output**: Only the fields that depend on the missing stage are omitted; the report is built from the stages that did produce output (FR-08).
- **Asset registry / threat-intel files not in COS**: `soc_lookup_asset` / `soc_lookup_threat_intel` return `unknown`; asset criticality, internet-facing, OS family and TI verdict rows are omitted from the Live report (see `data-model.md` §3.9).
- **WxO not configured on the frontend (Code Engine default)**: Live-mode runs return simulated `mock-run-…` ids and mock outputs (`mock:true`); no error is shown. The status bar still reads `[Label] Run created (mock-run…) — agent is processing…`.
- **Backend reachable but WxO/IAM rejects the call** (e.g. `BXNIM0415E Provided API key could not be found`): the backend returns `{ success:false, error }`; the frontend passes it through; the UI shows the error in the status bar and on the stage card. Poll responses with `retryable:true` continue polling.
- **Backend unreachable from the frontend**: Poll Route Handler falls back to mock run details.
- **Low event count (≤ 5)**: Triage never downgrades; always sets `must_inspect_events = true`.
- **Relevance = 0**: Triage produces at minimum Low severity (never Informational); event inspection not skipped.
- **COS credentials absent on the frontend**: Config Viewer shows `No files loaded — check COS configuration.`; the pipeline is unaffected.
- **Conversational supervisor not configured on the backend**: `POST /api/chat-conv` → HTTP 500 `CONV_SUPERVISOR_AGENT_ID is not set in .env`; `GET /api/wxo-token` → HTTP 200 `{ success:false, error:"WXO_EMBED_PRIVATE_KEY is not configured in .env" }`.
- **Invalid offense ID (e.g. 999999)**: System must not crash; returns NOT_FOUND response cleanly.
- **Unknown stage key at the backend**: `POST /api/poc-stages/bogus/run` → 404 `{ success:false, error:"Unknown stage: bogus" }`.

---

## 6. Deployment Baseline — IBM Cloud Code Engine

### 6.1 Project and Applications

Code Engine project `Agentic-SOC` · region `au-syd` · resource group `richa-rg` · tag `env:priyanshu`.
Subdomain `2fzgycrrx0uz` → public URLs `https://{app}.2fzgycrrx0uz.au-syd.codeengine.appdomain.cloud`.

| App | Image (IBM Container Registry, `au.icr.io/soc-images/…:latest`) | Port | Role |
|---|---|---|---|
| `agentic-soc-frontend` | `agentic-soc-frontend` | 3000 | Next.js 16 standalone dashboard (Mock/Live UI, Route Handlers) |
| `agentic-soc-backend` | `agentic-soc-backend` | 3001 | Express WxO proxy (+ static `server/public` page at `/`) |
| `agentic-soc-ui` | `agentic-soc-ui` | 3000 | Earlier standalone UI build (no `BACKEND_URL`, no build record); `/api/config` returns HTTP 500. **Legacy — not part of the replicated system.** |

Pull credentials: registry secret `icr-secret` on every app.

### 6.2 Runtime Configuration (frontend and backend)

| Setting | Frontend | Backend |
|---|---|---|
| CPU / memory / ephemeral storage | 0.5 vCPU / 1 G / 400 M | 0.5 vCPU / 1 G / 400 M |
| Min / max scale | 1 / 10 | 1 / 10 |
| Concurrency / request timeout | 100 / 300 s | 100 / 300 s |
| Scale-down delay | 0 | 0 |
| Readiness probe | TCP on listening port | TCP on listening port |
| Liveness probe | none | HTTP `GET /health`, initial delay 10 s, interval 10 s, timeout 1 s, failure threshold 1 |
| Literal env vars | `BACKEND_URL=https://agentic-soc-backend.2fzgycrrx0uz.au-syd.codeengine.appdomain.cloud`, `NODE_ENV=production` | `EXPRESS_PORT=3001` |
| Secret env vars | none | all keys of generic secret `soc-app-secrets` (below) |
| Build | local source `SOC-APP`, `Dockerfile.frontend`, strategy `dockerfile-medium`, timeout 600 s | local source `SOC-APP`, `Dockerfile.backend`, strategy `dockerfile-medium`, timeout 600 s |

Code Engine also injects `CE_APP`, `CE_DOMAIN`, `CE_PROJECT_ID`, `CE_REGION`, `CE_SUBDOMAIN`, `CE_API_BASE_URL`.

Secret `soc-app-secrets` (generic) holds exactly: `COS_API_KEY`, `COS_BUCKET`, `COS_ENDPOINT`, `COS_INSTANCE_CRN`, `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `WXO_API_KEY`, `WXO_ENV_NAME`, `WXO_URL`. Secret values are never recorded in the repository or in specs. It is attached to the **backend only**. Not set on either app: `CONV_SUPERVISOR_AGENT_ID`, `WXO_EMBED_PRIVATE_KEY`, per-stage `*_AGENT_ID` (the backend uses its built-in default agent ids).

### 6.3 Observable Endpoints

| Call | Result |
|---|---|
| Backend `GET /health` | `200 {"status":"healthy","serviceConfigured":true,"convSupervisorConfigured":false,"pipeline":"SOC 5-Agent Pipeline"}` |
| Backend `GET /api/config` | `200 {success:true, serviceConfigured:true, stages:[…6 entries: triage, classification, rca, notification, action, close; fields key,label,agentId,instruction…]}` |
| Frontend `GET /api/config` | `200 {success:true, serviceConfigured:false, mode:"mock_default", stages:[…5 entries: triage … action, each with agentName, tools, stepLabel, color]}` |
| Frontend `POST /api/poc-stages/triage/run` | `200` simulated run with `mock:true` (frontend has no WxO env) |
| Frontend `GET /api/poc-stages/{stage}/run/mock-…` | `200` completed mock run details |
| Frontend `GET /api/poc-stages/{stage}/run/{non-mock id}` | backend response passed through unchanged (currently an IAM error, see §7 item 5) |
| Frontend `GET /api/config-files` | `500 {"error":"COS_BUCKET env var is not set"}` |
| Frontend `POST /api/chat-conv` | `200` simulated run with `mock:true` |
| Frontend `GET /health`, `/api/wxo-token`, `/api/runs/*` | `500 Internal Server Error` (see §7 item 3) |

### 6.4 Container Images

- Frontend (`Dockerfile.frontend`): builder `registry.access.redhat.com/ubi9/nodejs-22` (`npm ci`, `npm run build`) → runtime `ubi9/nodejs-22-minimal`; copies `.next/standalone`, `.next/static`, `public`; `USER 1001:0`; `PORT=3000`, `NODE_ENV=production`, `HOSTNAME=0.0.0.0`; `CMD ["node","server.js"]`.
- Backend (`Dockerfile.backend`): builder `ubi9/nodejs-22` (`npm ci --omit=dev`) → runtime `ubi9/nodejs-22-minimal`; copies `node_modules`, `server/`, `agents/`, `tools/`, `connections/`, `config/`, `knowledge_base/`; `USER 1001:0`; `EXPRESS_PORT=3001`, `NODE_ENV=production`; `CMD ["node","server/server.js"]`.
- `.ceignore` excludes `node_modules/`, `.next/`, `.git/`, `*.log`, `.env`, `.DS_Store`.

---

## 7. Known Deployment Limitations (current deployed behaviour)

These are properties of the deployed system that a faithful replica must reproduce (or consciously fix):

1. **Frontend has no WxO/COS credentials.** `soc-app-secrets` is attached to the backend only. Consequently `serviceConfigured` is always `false` in the dashboard, Mock Mode is forced on every load, "Live" runs return simulated data, and Config Viewer shows no files.
2. **Five-stage UI vs. six-stage backend.** The frontend `/api/config` handler shadows the backend's, so the `close` agent exists server-side (and in mock data) but never appears in the dashboard.
3. **Rewrites point at `localhost:3001`.** `next.config.js` rewrite destinations are evaluated at build time, so the runtime `BACKEND_URL` does not affect `/api/runs/*`, `/api/chat`, `/api/wxo-token` or `/health` on the frontend (they return 500). Only the Route Handlers that read `BACKEND_URL` at request time reach the backend.
4. **Close stage not exposed** in `DEFAULT_STAGES` (5 entries), although the prompt builder and mock generator handle `close`.
5. **Backend WxO credential is currently rejected.** A non-mock poll that reaches the backend returns IAM error `BXNIM0415E — Provided API key could not be found`; real Live Mode will not complete until a valid `WXO_API_KEY` is stored in `soc-app-secrets`.
6. **Conversational supervisor and embed JWT unconfigured** on the backend (`convSupervisorConfigured:false`).
7. **Legacy third app** `agentic-soc-ui` remains deployed and is not functional for `/api/config`.
