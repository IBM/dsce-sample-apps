# Agentic SOC — Task Breakdown

**Feature**: Automated QRadar Offense Response Pipeline
**Status**: Implemented (tasks documented for reference and future enhancement)

---

## Task Completion Key
- [x] Completed
- [ ] Pending

---

## Phase 1: Foundation & Data Layer

### TASK-001 — Python Tool Infrastructure
**Files**: `SOC-APP/tools/offense_tools.py`, `SOC-APP/tools/requirements.txt`
**Status**: [x]

- [x] Import `ConnectionType, ExpectedCredentials` from `ibm_watsonx_orchestrate.agent_builder.connections` (NOT from `agent_builder.tools`); `ToolPermission, tool` from `agent_builder.tools` — see `plan.md` §6.0
- [x] Implement `_get_cos_creds()` with safe `or {}` fallback
- [x] Implement `_get_iam_token()` with 60s safety-window in-memory cache
- [x] Implement `_fetch_csv()` with UTF-8 BOM (`\ufeff`) stripping
- [x] Implement `soc_fetch_offense` — returns `OffenseOutput` with `found=False` guard
- [x] Implement `soc_fetch_offense_events` — returns `EventsOutput`
- [x] Implement `soc_fetch_rca_events` — returns `EventsOutput` for RCA-relevant events
- [x] Write `requirements.txt`: `pydantic==2.13.3`, `requests`, `mailjet-rest`, `pyyaml`

**Acceptance Criteria**:
- `soc_fetch_offense` returns `found=False` for unknown offense IDs (never throws)
- UTF-8 BOM is stripped before CSV parsing (no `\ufeffid` header issues)
- IAM token is cached; second call within 50 min does not make an IAM HTTP request

---

### TASK-002 — Enrichment Tools
**Files**: `SOC-APP/tools/enrichment_tools.py`
**Status**: [x]

- [x] `soc_fetch_rule_statistics` → `RuleStatisticsOutput`
- [x] `soc_fetch_offense_history` → `OffenseHistoryOutput`
- [x] `soc_lookup_asset` → `AssetOutput`
- [x] `soc_lookup_threat_intel` → `ThreatIntelOutput`
- [x] `soc_fetch_host_baseline` → baseline output
- [x] `soc_check_allowlist` → allowlist match output
- [x] `soc_check_maintenance_window` → window match output
- [x] `soc_check_service_path` → policy output
- [x] `soc_check_exfil_tool` → exfil tool match
- [x] `soc_check_privileged_account` → privilege check output
- [x] `soc_check_linux_log_rotation` → log rotation output
- [x] `soc_log_out_of_scope` → log entry output
- [x] `soc_log_suppressed_offense` → log entry output

**Acceptance Criteria**:
- All 13 tools importable via `orchestrate tools import -k python -f tools/enrichment_tools.py -r tools/requirements.txt -a soc-cos-data`
- All tools handle COS connectivity errors gracefully (return `found=False` or safe defaults)

---

### TASK-003 — Action, Close, Notify Tools
**Files**: `SOC-APP/tools/action_tools.py`, `SOC-APP/tools/close_offense_tool.py`, `SOC-APP/tools/notify_tool.py`, `SOC-APP/tools/update_offense_status.py`
**Status**: [x]

- [x] `soc_request_action_approval` — creates approval request record
- [x] `soc_execute_approved_action` — executes a pre-approved action
- [x] `soc_close_offense` — marks offense as closed with classification + close note
- [x] `soc_notify` — generates HTML report and delivers via Mailjet REST API
- [x] `soc_update_offense_severity` — updates severity record in COS

---

## Phase 2: Agent Definitions

### TASK-004 — Triage Agent YAML
**Files**: `SOC-APP/agents/triage_agent.yaml`
**Status**: [x]

- [x] 3-step structure: Guard Checks → Context Enrichment → Severity Rules → Output
- [x] 10 severity rules implemented (T0–T9 + TA–TI adjustments)
- [x] TRIAGE RESULT plain-text output block with all required fields
- [x] Tools declared: 8 tools
- [x] `style: react_core`, `enable_cot: true`

**Acceptance Criteria**:
- Offense 167657 → `triage_severity: High` (or `Critical`)
- Offense 141835 → `triage_severity: Low` (relevance=0 → base Low, not Informational)
- Offense 999999 → `triage_severity: NOT_FOUND`, no other tools called

---

### TASK-005 — Classification Agent YAML
**Files**: `SOC-APP/agents/classification_agent.yaml`
**Status**: [x]

- [x] 10-step structure (C0 history → C1 FP check → fetch events → route to M1–M7)
- [x] Detection modules M1 (Web Exploit), M2 (Suspicious PS), M3 (Process/Service), M4 (Data Exfil), M5 (System Abuse), M6 (Log Clearing), M7 (Catch-all)
- [x] CLASSIFICATION RESULT plain-text output block

**Acceptance Criteria**:
- 8 TP offenses → `True Positive` verdict
- 17 Non-Issue offenses → `False Positive` or `Benign Positive` verdict
- No false negatives on test dataset

---

### TASK-006 — RCA, Notify, Action, Close Agent YAMLs
**Files**: `SOC-APP/agents/rca_agent.yaml`, `SOC-APP/agents/notify_agent.yaml`, `SOC-APP/agents/action_agent.yaml`, `SOC-APP/agents/close_agent.yaml`
**Status**: [x]

- [x] RCA: 7-step structure with MITRE ATT&CK mapping, 5 determination types
- [x] Notify: HTML report generation + `soc_notify` tool call
- [x] Action: approval-gated execution (NOT in PoC supervisor pipeline)
- [x] Close: close reason/note mapping logic

---

### TASK-007 — Conversational Supervisor Agent YAML
**Files**: `SOC-APP/agents/conversational_supervisor_agent.yaml`
**Status**: [x]

- [x] 6-part structure: Intent Detection, Silent Prerequisites, Step-by-Step Flow, Presentation Format, Close Mapping, Direct Q&A
- [x] 7 intents (A–G + Fallback)
- [x] PATH 1 (Full Investigation) + PATH 2 (Direct Close) routing logic
- [x] Collaborators: 5 sub-agents (no `soc_action_agent`)

---

## Phase 3: Backend

### TASK-008 — Express Server (`server.js`)
**Files**: `SOC-APP/server/server.js`
**Status**: [x]

- [x] IAM token cache (50-min TTL, in-memory)
- [x] Platform detection (`ibm_cloud` / `aws_or_saas` / `on_prem`)
- [x] `POST /api/poc-stages/:stageKey/run` — create WxO run, return immediately
- [x] `GET /api/poc-stages/:stageKey/run/:runId` — poll + extract text/traces/analytics
- [x] `POST /api/chat-conv` — conversational supervisor run creation
- [x] `GET /api/chat-conv/:runId` — conversational supervisor run polling
- [x] `GET /api/config` — service config endpoint
- [x] `GET /api/wxo-token` — RS256 JWT (no `jsonwebtoken` package)
- [x] `GET /health` — health check
- [x] Catch-all `app.get('*', ...)` — Express 4 compatible

**Acceptance Criteria**:
- `npm run test` (`node --check server/server.js`) passes
- Returns `{ serviceConfigured: false }` when env vars absent
- IAM token not logged or serialised

---

## Phase 4: Frontend

### TASK-009 — TypeScript Types
**Files**: `SOC-APP/src/types/index.ts`
**Status**: [x]

- [x] `StageConfig`, `TraceItem`, `AnalyticsData`, `RunDetails`, `StageState`, `ConfigResponse`
- [x] `SampleOffense`, `PocOffense`, `ActionItem`, `PocConfigResponse`
- [x] `Window` global augmentation for WxO embed

---

### TASK-010 — Sample Offense Data
**Files**: `SOC-APP/src/data/sampleOffenses.ts`, `SOC-APP/src/data/defaultStages.ts`
**Status**: [x]

- [x] 25 `PocOffense` records in `sampleOffenses.ts`
- [x] `TRUE_POSITIVE_IDS` and `NON_ISSUE_IDS` exports
- [x] 5 `StageConfig` entries in `defaultStages.ts` (triage → action; no `close` in defaults)

---

### TASK-011 — Dual-Mode Architecture (Mock Demo Default & Live WxO Toggle)
**Files**: `SOC-APP/src/data/mockPipelineData.ts`, `SOC-APP/src/app/page.tsx`, `SOC-APP/src/components/Navbar.tsx`, `SOC-APP/src/components/WxoChatWidget.tsx`
**Status**: [x]

- [x] Retain and maintain `mockPipelineData.ts` for high-fidelity demo execution (`buildMockRunDetails`, `getMockSupervisorChatResponse`).
- [x] `page.tsx`: initialize `mockMode` state (default `true` on first-ever load, persisted in `localStorage('soc_mock_mode')` and restored on every load without WxO override), `handleToggleMockMode`, `handleLoadMockResults`, dual `runStage` execution paths.
- [x] `page.tsx`: Action approval gate (`ActionApprovalPanel` + `actionApprovalResolverRef`) operates in Mock Mode only; Live mode bypasses it and communicates directly with WxO endpoints. RCA Incident Report triggers (`IncidentReportModal`, banner, Report button, floating pill) are available in **both** modes (US-05); in Live mode the report is built from parsed stage outputs (TASK-015).
- [x] `Navbar.tsx`: support segmented mode switch ("Mock Mode" / "Live WxO"), SIMULATION / LIVE WXO badge, dynamic connection pill ("Simulation Engine" / "WxO Connected" / "WxO Disconnected"), and sub-bar status indicators.
- [x] `WxoChatWidget.tsx`: support `mockMode` prop to provide simulated responses or call `/api/chat-conv`.
- [x] Next.js route handlers pass through live requests to Express backend for Live WxO execution.

**Acceptance Criteria**:
- On first-ever UI load (no `localStorage` entry), Mock mode is active by default.
- On subsequent loads the persisted mode choice is restored, except when `/api/config` reports `serviceConfigured = false` (or the request fails), in which case Mock mode is forced on (see spec FR-01).
- In Mock mode, all stages execute realistically without contacting a live WxO instance, providing a purely live appearance for customer demos.
- Users can toggle between Mock Mode and Live WxO mode via Navbar at any time.
- In Live mode, agents execute directly on the connected WxO instance. If WxO is not configured on load, Mock mode is forced on and persisted, so "WxO Disconnected" is not shown after a reload. Toggling to Live manually while unconfigured still shows the warning.
- Deployed-parity (see spec FR-01 and ui-design §14.9): the UI contains **no** `WxO Off` button, `WxO disconnected (demo)` pill, `WxO instance disconnected — pipeline will not run.` sub-bar text, or `WxO instance not connected…` hero banner; Run buttons are never disabled by WxO connectivity; exactly 5 stage cards (`5 stages`) are shown.

---

### TASK-012 — UI Components (per `ui-design.md`)
**Files**: `SOC-APP/src/components/*.tsx`, `SOC-APP/src/app/globals.css`, `SOC-APP/tailwind.config.js`
**Status**: [x]

- [x] `Navbar.tsx` — brand, mode toggle segmented switch, WxO status pill, Clear, Run Pipeline, status sub-bar
- [x] `OffenseSelector.tsx` — dropdown of 25 offenses with severity/module/outcome pills and stats row
- [x] `StageCard.tsx` — compact card; tabs **Output / Tools (N) / Traces (N) / Prompt**; tool-call cards with Arguments + Response; `extractToolCalls()`; Thread/Run ID, Duration, Tools/Traces telemetry
- [x] `AnalyticsVisualizer.tsx` — KPI cards + duration bar chart + tool-call donut
- [x] `PipelineFlow.tsx` — 5-node static visual pipeline with status rings
- [x] `ConfigViewer.tsx` — collapsible agent/policy YAML inspector
- [x] `IncidentReportModal.tsx` — Preview + Markdown Source tabs; HTML / Markdown download; Print / PDF
- [x] `ActionApprovalPanel.tsx` — inline amber approve/reject panel
- [x] `ConversationalSupervisorWidget.tsx` — WxO embed script injector (active in live mode)
- [x] `WxoChatWidget.tsx` — floating chat panel (supports mock & live modes)
- [x] Theme: Tailwind v3 dark palette (`#080a12` / `#0d1117` / `#0a0c16`, indigo accent) exactly as in `ui-design.md` §2–3

---

### TASK-013 — Main Dashboard (`page.tsx`)
**Files**: `SOC-APP/src/app/page.tsx`
**Status**: [x]

- [x] All React state defined (mockMode, stages, runs, selectedOffenseId, etc.)
- [x] `mockMode` defaults to `true` on load (persisted in `localStorage('soc_mock_mode')`)
- [x] `buildPromptForStage` prompt chaining logic
- [x] Sequential pipeline execution (`runAllStages`)
- [x] Dual `runStage` path: simulated reasoning (~5s) in Mock Mode, real POST + poll in Live Mode
- [x] `fetchConfig` on mount (loads stages from Express via `/api/config`)
- [x] Hero banner, RCA-ready banner, floating "View RCA Report" pill, footer (`ui-design.md` §3)

---

### TASK-014 — API Route Handlers
**Files**: `SOC-APP/src/app/api/**/*.ts`
**Status**: [ ] (pass-through behaviour pending TASK-011)

- [x] `config/route.ts` — GET, returns `{ success, serviceConfigured, stages }` (no `mode` field)
- [x] `config-files/route.ts` — GET, direct COS fetch via `ibm-cos-sdk`
- [ ] `poc-stages/[stageKey]/run/route.ts` — POST pass-through to Express (`AbortSignal.timeout(30_000)`), text passthrough
- [ ] `poc-stages/[stageKey]/run/[runId]/route.ts` — GET pass-through (`AbortSignal.timeout(90_000)`); timeout → 504 `retryable:true`, other error → 502 `retryable:true`
- [ ] `chat-conv/route.ts` — delete (a Route Handler would shadow the `next.config.js` rewrite; `POST /api/chat-conv` is served by the rewrite)
- [ ] `chat-conv/[runId]/route.ts` — GET pass-through (`AbortSignal.timeout(55_000)`)

---

### TASK-015 — Report Generator
**Files**: `SOC-APP/src/lib/reportGenerator.ts`, `SOC-APP/src/lib/parseStageOutput.ts`
**Status**: [ ]

- [ ] `parseStageOutput.ts`: `parseTriage`, `parseClassification`, `parseRca`, `parseAction`, `parseNotification`, `parseClosure` per `data-model.md` §3.1–§3.6 and §3.8 (label-based; tolerant of `═══` delimiters; `N/A` / `unknown` / `none` / empty → absent).
- [ ] `parseRca` splits `MITRE ATT&CK` (`Tactic: Technique — T-number`) into tactic / technique / technique id; parses `Evidence Summary` sub-lines (`Network`, `Payload`, `Process`, `Scope`), `Attack Timeline` entries and `Recommended Actions` bullets as lists.
- [ ] `parseClassification` parses the multi-line `rca:` bullet list plus `key_evidence`, `category`, `real_source_ip`, `source_ip_corrected`, `compromised_account`, `events_total`, `close_reason`, `close_note`.
- [ ] `generateIncidentReportHtml({ offense, runs, mockMode })` → HTML string
- [ ] `generateIncidentReportMarkdown({ offense, runs, mockMode })` → Markdown string
- [ ] Live mode (`mockMode = false`): every row/section comes from the field table in `data-model.md` §3.7; absent values are omitted (never printed as "N/A"/"Unknown"); no static `offense` fields, no per-offense hard-coded MITRE / tools / entry point, no `10.x.x.x` placeholders.
- [ ] Mock mode (`mockMode = true`): existing static/mock generation retained.
- [ ] Report button enabled in Live mode when RCA **or** Classification output exists; disabled with tooltip "No analysis output available yet" otherwise.
- [ ] Client-side download trigger in `IncidentReportModal` (Blob + `URL.createObjectURL`)
- [ ] Unit tests: feed sample blocks (copied from `data-model.md` §3) to each parser and assert no output contains the literal text "N/A", "Unknown" or `10.x.x.x` for Live mode.

---

## Phase 5: Infrastructure

### TASK-016 — Bootstrap Script
**Files**: `SOC-APP/import-all.sh`, `SOC-APP/.env.example`, `SOC-APP/connections/cos_connection.yaml`, `SOC-APP/connections/mailjet_connection.yaml`
**Status**: [x]

> Source of truth: [`bootstrap-script.md`](./bootstrap-script.md). Copy the script in its §3 **verbatim** (no re-derivation);
> create the connection YAMLs from its §5 and `.env.example` from its §4. Verify with `bash -n` and a diff against §3.

- [x] Python venv creation + `ibm-watsonx-orchestrate` CLI install
- [x] WxO environment activation — non-interactive: `orchestrate env activate "$WXO_ENV_NAME" --api-key "$WXO_API_KEY"`, key read only from `SOC-APP/.env` (CRLF/quotes/inline comments stripped); script never prompts for a key — see `plan.md` §5.4
- [x] COS connection registration (`soc-cos-data`)
- [x] Mailjet connection registration (`soc-mailjet`)
- [x] YAML config file upload to COS
- [x] 6 tool module imports
- [x] Knowledge base deployment — import, then **poll** `knowledge-bases status` until `ready` (fail the script otherwise); no fixed `sleep`. See `plan.md` §5.3
- [x] `soc_action_agent` binds the KB with `knowledge_base:` (singular), not `knowledge_bases:`
- [x] KB document paths are bare file names (relative to `soc_kb.yaml`'s folder); embeddings model `ibm/slate-125m-english-rtrvr-v2`
- [x] 6 sub-agent imports + supervisor import with collaborator binding

---

### TASK-017 — Container Images
**Files**: `SOC-APP/Dockerfile.frontend`, `SOC-APP/Dockerfile.backend`
**Status**: [x]

- [x] Frontend: UBI9 multi-stage build → standalone output → port 3000
- [x] Backend: UBI9 multi-stage build → `npm ci --omit=dev` → port 3001
- [x] `.ceignore` excludes `node_modules/`, `.next/`, `.git/`, `*.log`, `.env`

---

## Phase 6: Future Enhancements

### TASK-018 — Live QRadar API Integration
**Status**: [ ] Phase 2

- [ ] Replace COS CSV reads with live QRadar REST API calls
- [ ] Implement QRadar API authentication in enrichment tools
- [ ] Update `soc_fetch_offense` to call QRadar `/api/siem/offenses/{id}`

---

### TASK-019 — ServiceNow / SOAR Integration
**Status**: [ ] Phase 2

- [ ] Add SOAR ticket creation tool
- [ ] Integrate Close Agent with ServiceNow case management
- [ ] Link RCA reports to SOAR incidents

---

### TASK-020 — Analyst Feedback Loop
**Status**: [ ] Phase 3

- [ ] Capture analyst verdict overrides
- [ ] Store feedback in COS for rule TP-rate recalibration
- [ ] Dashboard showing classification accuracy metrics
