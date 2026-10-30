# Agentic SOC — Technical Plan

**Feature**: Automated QRadar Offense Response Pipeline
**Status**: Implemented

---

## 1. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Frontend framework | Next.js | ^16.3.0 | App Router, standalone output for containers, server components |
| UI library | React | ^19.2.8 | Hooks-based functional components |
| Styling | Tailwind CSS | ^3.4.19 | Utility-first, PostCSS plugin, custom CSS variables for dark theme |
| Backend proxy | Express.js | ^4.19.2 | Lightweight, `app.get('*')` catch-all (requires v4, not v5) |
| Agent platform | IBM watsonx Orchestrate | Cloud | Hosts 7 agents + 21 Python tools |
| LLM | `groq/openai/gpt-oss-120b` | N/A | Style: `react_core` |
| Data store | IBM Cloud Object Storage | S3-compatible | Offense CSVs + YAML config files |
| Email delivery | Mailjet | REST API | HTML incident email reports |
| Containerization | Red Hat UBI 9 | nodejs-22-minimal | IBM Cloud Code Engine deployment |
| Language (tools) | Python | 3.11+ | WxO tool execution runtime |
| IAM | IBM Cloud IAM | iam.cloud.ibm.com | Token exchange for WxO + COS |

---

## 2. Deployment Architecture

### 2.1 Container Images (IBM Cloud Code Engine)

**Frontend container** (`Dockerfile.frontend`):
- Builder: `ubi9/nodejs-22:latest` → Runtime: `ubi9/nodejs-22-minimal:latest`
- Output: Next.js Standalone (`.next/standalone`)
- Port: 3000, Hostname: `0.0.0.0`
- Entrypoint: `CMD ["node", "server.js"]`

**Backend container** (`Dockerfile.backend`):
- Builder: `ubi9/nodejs-22:latest` → Runtime: `ubi9/nodejs-22-minimal:latest`
- Artifacts: `node_modules/`, `server/`, `agents/`, `tools/`, `connections/`, `config/`, `knowledge_base/`
- Port: 3001
- Entrypoint: `CMD ["node", "server/server.js"]`

### 2.2 Inter-Service Networking
- Frontend → Backend via `BACKEND_URL` env var (Code Engine) or `http://localhost:3001` (local dev).
- Routes NOT in next.config.js rewrites (`/api/poc-stages/*`, `/api/chat-conv/:runId`) are handled by Next.js Route Handlers to bypass the 30s http-proxy socket timeout. In Live Mode, these handlers are **pure pass-throughs** to Express (see `contracts/api-contracts.md` §2).

---

## 3. Backend Design (`server/server.js`)

### 3.1 IAM Token Cache
```
_tokenCache = { token: '', expiresAt: 0 }
TOKEN_TTL_MS = 50 * 60 * 1000   // 50 minutes
```
- Cache hit: `_tokenCache.token && Date.now() < _tokenCache.expiresAt`
- Cache miss: POST to IAM exchange endpoint → store `{ token, expiresAt: now + TTL }`

### 3.2 Platform Detection (`getPlatform(serviceUrl)`)
| URL substring | Platform | IAM endpoint |
|---|---|---|
| `watson-orchestrate.cloud.ibm.com` | `ibm_cloud` | `iam.cloud.ibm.com/identity/token` (form-encoded) |
| `watson-orchestrate.ibm.com` | `aws_or_saas` | `iam.platform.saas.ibm.com/siusermgr/api/1.0/apikeys/token` (JSON) |
| Other | `on_prem` | same as `aws_or_saas` |

### 3.3 Run Lifecycle (PoC Stages)
1. `POST /api/poc-stages/:stageKey/run` → create WxO run → return `{ runId, threadId, startedAt }` immediately
2. Browser polls `GET /api/poc-stages/:stageKey/run/:runId` every 4 seconds
3. Express polls WxO `GET /runs/:runId` → when `status == completed`, fetch `/events`, extract text+traces+analytics
4. Return full `RunDetails` to browser

### 3.4 WxO Embed JWT (`GET /api/wxo-token`)
- RS256 signature using Node built-in `crypto.createSign('RSA-SHA256')`
- Claims: `{ sub: 'embed-user', iat, exp: iat + 3600 }`
- **No `jsonwebtoken` package**

---

## 4. Frontend Design

### 4.1 State Architecture (`page.tsx`)
All application state lives in `SOCDashboard` component. UI look-and-feel: `ui-design.md`.
```typescript
mockMode: boolean                // default true on UI load; persisted in localStorage('soc_mock_mode')
stages: StageConfig[]            // pipeline stage configurations (DEFAULT_STAGES until /api/config answers)
runs: Record<string, StageState> // keyed by stage key (triage, classification, ...)
runsRef: MutableRefObject<...>   // always-latest copy of runs (updated together via updateRunsState)
selectedOffenseId: string        // currently selected offense
globalPrompt: string             // "Analyze QRadar Offense {id}"
serviceConfigured: boolean       // WxO credentials present (from /api/config)
running: boolean                 // pipeline execution in progress
statusMessage: string            // Navbar sub-bar text
showGuide / executionOpen / analyticsOpen / configViewerOpen / reportModalOpen / actionApprovalOpen: boolean
```
**Mode Handlers**: `handleToggleMockMode` (switches between Mock and Live WxO), `handleLoadMockResults` (instant pre-population for rapid demos).

### 4.2 Prompt Chaining (`buildPromptForStage`)
| Stage | Prompt |
|---|---|
| `triage` | `base` only |
| `classification` | `Offense ID: {id}\n\n{base}\n\n[TRIAGE RESULT]:\n{triageOutput}` |
| `rca` | `{base}` + triage section (if present) + classification section (if present) |
| `notification` | `{base}` + rca section (if present), else classification section |
| `action` | `{base}` + triage + classification + rca sections (each if present) |
| `close` | `{base}` + triage + classification + rca + action sections (each if present) |

### 4.3 Stage Runner (`runStage`) — Mock Demo & Live WxO Paths
1. Build prompt (`buildPromptForStage` or per-stage override).
2. **Mock Mode branch (`mockMode = true`)**:
   - **Action stage**: open `ActionApprovalPanel` and wait for human-in-the-loop analyst adjudication in Mock Mode only.
   - **RCA stage**: enables `IncidentReportModal` and all RCA report download triggers (also enabled in Live Mode — see below).
   - Progressive simulated reasoning delays (~5.0s total).
   - Generates realistic run details via `buildMockRunDetails(stageKey, offenseId, startedAt)`.
   - Populates Output, Tools (with arguments & response), Traces, and Analytics tabs without requiring or contacting an active WxO instance (presents high-fidelity live appearance for customer demos).
3. **Live Mode branch (`mockMode = false`)**:
   - Omits `ActionApprovalPanel` only (no client-side approval gate in Live Mode).
   - Keeps `IncidentReportModal` and all RCA report triggers (banner, stage-card **Report** button, floating pill) available once the RCA (or Classification) stage output exists, per US-05 / FR-08.
   - Submits prompt directly to live WxO instance: `POST /api/poc-stages/{stageKey}/run` `{ prompt }` → `{ runId, threadId, startedAt }`.
   - Polls `GET /api/poc-stages/{stageKey}/run/{runId}?startedAt=…&threadId=…` every 4 s (up to 360 s deadline).
   - On completion, stores `{ prompt, loading:false, run }` with real WxO `outputText`, `analytics`, `traces`, and `raw` payload.
   - The Live Incident Report is generated by a block parser over `runs.<stage>.run.outputText` (see §4.5), never from the static `PocOffense` object.

### 4.4 UI Specification
Theme, exact Tailwind classes, component props and the tool-output rendering algorithm are defined in
[`ui-design.md`](./ui-design.md). It is normative.

### 4.5 Live Report Generation (`reportGenerator`)
- `generateIncidentReportHtml` and `generateIncidentReportMarkdown` take `{ offense, runs, mockMode }`.
- **Mock Mode** (`mockMode = true`): may use the static `offense` and mock outputs.
- **Live Mode** (`mockMode = false`): uses only the parsed stage outputs. `offense` contributes at most the selected offense id.
- A parser module (e.g. `src/lib/parseStageOutput.ts`) exposes `parseTriage`, `parseClassification`, `parseRca`, `parseAction`, `parseNotification`, `parseClosure`. Each returns an object of optional string/list fields keyed by the labels in `data-model.md` §3.1–§3.6. The parsers follow `data-model.md` §3.8 (label-based, tolerant of `═══` delimiters, absent-value normalisation).
- A mapper applies the field table in `data-model.md` §3.7 (RCA → Classification → Triage precedence) and omits any section or row whose value is absent. MITRE is derived by splitting the RCA `MITRE ATT&CK` string; there is no separate technique-id field.
- Hard-coded per-offense values (MITRE, tools used, entry point, `10.x.x.x` placeholders) are forbidden in Live mode.

---

## 5. Agent Architecture (IBM watsonx Orchestrate)

### 5.1 Agent Summary
| Agent | WxO Name | Kind | Collaborators | Tools |
|---|---|---|---|---|
| Conversational Supervisor | `soc_conversational_supervisor` | native | 5 sub-agents | None (collaborators only) |
| Triage | `soc_triage_agent` | native | None | 8 tools |
| Classification | `soc_classification_agent` | native | None | 13 tools |
| RCA | `soc_rca_agent` | native | None | 3 tools |
| Notify | `soc_notify_agent` | native | None | 1 tool |
| Action | `soc_action_agent` | native | None | 2 tools + KB |
| Close | `soc_close_agent` | native | None | 1 tool |

### 5.2 PoC Pipeline Constraint
The Conversational Supervisor does **NOT** call `soc_action_agent`. It is explicitly excluded.
The Action Agent exists as a standalone WxO agent only.

### 5.3 Knowledge Base (`soc_knowledge_base`) — Normative Bootstrap Contract

**Files** (all three must sit in the same folder, `SOC-APP/knowledge_base/`):
`soc_kb.yaml`, `triage_rules.txt`, `action_schemas.txt`.

**`soc_kb.yaml`**
```yaml
spec_version: v1
kind: knowledge_base
name: soc_knowledge_base
description: >
  SOC knowledge base containing QRadar triage rules, classification rules,
  RCA investigation framework and remediation action schemas.
documents:
  - path: triage_rules.txt        # bare file names ONLY
  - path: action_schemas.txt
vector_index:
  embeddings_model_name: ibm/slate-125m-english-rtrvr-v2
```

Rules (each one is a verified failure mode):
1. **Document paths are relative to the YAML file's own folder**, not to the shell's cwd. Use bare names
   (`triage_rules.txt`). `knowledge_base/triage_rules.txt` fails with `FileNotFoundError`.
2. **Embeddings model must be exactly `ibm/slate-125m-english-rtrvr-v2`.** Any other id (e.g. the `-v2`-less
   `ibm/slate-125m-english-rtrvr`) is accepted by the CLI but fails server-side during indexing with
   `model_not_supported`. Omitting `vector_index` entirely is also valid (platform default).
3. **The `orchestrate` CLI exits `0` even when server-side indexing fails.** The bootstrap script MUST NOT
   treat the exit code as proof of success and MUST NOT print an unconditional ✅ after the import.
4. **`sleep 25` is not an acceptable readiness check.** The script MUST poll
   `orchestrate knowledge-bases status -n soc_knowledge_base -v` until `built_in_index_status == "ready"`
   (poll every 5 s, up to 3 min). The CLI's `-v` JSON contains raw newlines in `description`, so it MUST be parsed
   with `json.loads(..., strict=False)`; plain `json.load` / `jq` raises `Invalid control character`.
5. **Import is idempotent.** Re-running updates the existing KB and re-ingests both documents (CLI prints
   `Document "…" already exists … Updating...`). These warnings are expected, not errors.
6. **Agent binding key is `knowledge_base:` (singular), not `knowledge_bases:`.** The ADK agent schema ignores
   unknown keys, so `knowledge_bases:` imports without error but leaves the agent with **no** KB attached.
   `soc_action_agent` MUST declare:
   ```yaml
   knowledge_base:
     - soc_knowledge_base
   ```
   (`workspace_config.yaml` keeps `knowledge_bases: ./knowledge_base` — that is a folder-path key, a different schema.)
7. **Import order:** the KB step runs after tools and **before** `soc_action_agent` is imported, so the agent never
   references a KB that does not exist yet. No other agent references the KB.
8. **Use the latest `ibm-watsonx-orchestrate` CLI** (script installs it unpinned; validated on 2.17.0 and 2.19.0).

**Reference bootstrap step (replaces the old `import` + `sleep 25`):**
```bash
KB_NAME="soc_knowledge_base"
for f in soc_kb.yaml triage_rules.txt action_schemas.txt; do
  [ -f "knowledge_base/$f" ] || fail "knowledge_base/$f not found"
done

orchestrate knowledge-bases import -f knowledge_base/soc_kb.yaml \
  || fail "knowledge-bases import failed"

KB_STATE=""
for i in $(seq 1 36); do
  KB_STATE=$(orchestrate knowledge-bases status -n "$KB_NAME" -v 2>/dev/null \
    | python -c 'import sys,json; d=json.loads(sys.stdin.read(),strict=False); print(d.get("built_in_index_status") or "pending")' \
    2>/dev/null || echo "unknown")
  info "  KB index status: $KB_STATE (attempt $i/36)"
  [ "$KB_STATE" = "ready" ] && break
  case "$KB_STATE" in failed|error) fail "Knowledge base indexing failed — run: orchestrate knowledge-bases status -n $KB_NAME";; esac
  sleep 5
done
[ "$KB_STATE" = "ready" ] || fail "Knowledge base did not reach 'ready' within 3 minutes"
ok "  soc_knowledge_base indexed and ready"
```
`fail` exits the script, so the Action agent is never imported against a missing/unindexed KB.

### 5.4 Bootstrap Authentication — Non-Interactive, `.env` Only (Normative)

> **The complete, verbatim `SOC-APP/import-all.sh` (plus the `.env.example` key list and both connection YAMLs) is
> specified in [`bootstrap-script.md`](./bootstrap-script.md). That file is normative: the generated script MUST
> replicate it exactly. The rules below summarise its authentication behaviour.**

`import-all.sh` MUST run end-to-end without prompting the user for any secret. `orchestrate env activate`
falls back to an interactive `Please enter WXO API key:` prompt whenever no API key is passed, so the script MUST
guarantee the key is always supplied from `SOC-APP/.env`.

Rules:
1. **Single source of truth is `SOC-APP/.env`** (copied from `.env.example`). The script loads it at start with the
   line-by-line `KEY=VALUE` parser (not `source`) and `export`s every variable. Strip `\r` (CRLF) as well as quotes
   and inline comments from values, so a `.env` saved on Windows does not yield a blank/garbled key.
2. **Fail fast before any CLI call** if `WXO_ENV_NAME`, `WXO_URL`, `WXO_API_KEY`, `COS_*` or `MAILJET_*` is empty
   (the `required_vars` check). The script never falls through to a prompt.
3. **Activate with the key from `.env`, never interactively:**
   ```bash
   orchestrate env add -n "$WXO_ENV_NAME" -u "$WXO_URL" 2>/dev/null || true      # already-exists is fine
   orchestrate env activate "$WXO_ENV_NAME" --api-key "$WXO_API_KEY" \
     || fail "env activate failed — check WXO_URL and WXO_API_KEY in .env"
   ```
   `--api-key` (`-a`) is the only supported non-interactive path. Do not pipe answers (`<<< "y"`) into
   `env activate`, and do not `read`/`getpass` for the key anywhere in the script.
4. **Connection secrets also come from `.env`** — `connections set-credentials` receives `COS_*` / `MAILJET_*` via
   `-e key=value` flags (draft and live). No secret is typed by hand.
5. **Never echo secret values** to the console or commit `.env` (it is git-ignored / `.ceignore`d).
6. If the script still prompts for a key, the cause is an empty `WXO_API_KEY` in `.env` (or a stale script that omits
   `--api-key`); fix `.env` / the script — do not type the key at the prompt.


---

## 6. Python Tool Architecture

### 6.0 Normative Import Block (verified failure mode)
Every tool module that uses a connection (`offense_tools.py`, `enrichment_tools.py`, `notify_tool.py`) MUST use exactly these imports:
```python
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType, ExpectedCredentials
from ibm_watsonx_orchestrate.agent_builder.tools import ToolPermission, tool
from ibm_watsonx_orchestrate.run import connections
```
`ExpectedCredentials` lives in `ibm_watsonx_orchestrate.agent_builder.connections` (alongside `ConnectionType`).
It is **NOT** exported from `ibm_watsonx_orchestrate.agent_builder.tools`. Importing it from there fails
`orchestrate tools import` with:
`Failed to load python module from file tools/offense_tools.py: cannot import name 'ExpectedCredentials' from 'ibm_watsonx_orchestrate.agent_builder.tools'`.
`agent_builder.tools` exports only `tool`, `ToolPermission` (and related tool types). Tools with no connection
(`update_offense_status.py`, `close_offense_tool.py`, `action_tools.py`) import only `ToolPermission, tool`.

### 6.1 COS Authentication Pattern
All COS-backed tools share:
- `expected_credentials=[ExpectedCredentials(app_id="soc-cos-data", type=ConnectionType.KEY_VALUE)]`
- `_get_cos_creds()` helper with safe `or {}` fallback
- `_get_iam_token()` with in-memory cache (60s safety window before expiry)
- `_fetch_csv()` strips UTF-8 BOM (`\ufeff`) before CSV parsing

### 6.2 Tool File → WxO Name Mapping
| File | Exported tools |
|---|---|
| `offense_tools.py` | `soc_fetch_offense`, `soc_fetch_offense_events`, `soc_fetch_rca_events` |
| `enrichment_tools.py` | 13 tools (rule stats, asset, TI, history, host baseline, allowlist, maintenance, service path, exfil, privileged account, log rotation, log out-of-scope, log suppressed) |
| `update_offense_status.py` | `soc_update_offense_severity` |
| `close_offense_tool.py` | `soc_close_offense` |
| `notify_tool.py` | `soc_notify` |
| `action_tools.py` | `soc_request_action_approval`, `soc_execute_approved_action` |

---

## 7. IBM COS Object Naming

All files at bucket root (no subdirectories):
```
Offense_{id}.csv
Offense_{id}_Events.csv
Offense_{id}_RCA_Relevant_Events.csv   # optional
allowlist.yaml
service_path_policy.yaml
exfil_tools.yaml
proxy_and_lb.yaml
privileged_accounts.yaml
linux_log_rotation.yaml
maintenance_windows.yaml
asset_registry.yaml
threat_intel_feed.yaml
triage_agent.yaml ... conversational_supervisor_agent.yaml   # 7 agent YAMLs (for Config Viewer)
```

---

## 8. Testing Strategy

### 8.1 Live Acceptance Tests
Run the 25 offenses through live WxO and validate:
- 8 True Positive offenses → PATH 1 route (RCA executed)
- 17 Non-Issue offenses → PATH 2 route (direct close)
- No crashes on offense ID 999999 (NOT_FOUND)
- For every completed stage the **Tools (N)** tab lists the tools the agent actually called with Arguments + Response

### 8.2 Live WxO Smoke Tests
After `import-all.sh`:
- All 7 agents deployable without errors
- All 21 tool functions importable without errors
- At least 1 TP offense (167657) and 1 FP offense (141835) run end-to-end

### 8.3 UI Conformance
- Default load in Mock Mode presents full 5-stage pipeline telemetry without network dependencies.
- Navbar segmented switch toggles between Mock Mode and Live WxO.
- Live WxO mode connects to watsonx Orchestrate instance and runs agents exclusively on WxO.

### 8.4 Frontend Build Test
```bash
npm run build   # must succeed with no TypeScript errors
npm run test    # node --check server/server.js
```

---

## 9. Environment Variables Reference

| Variable | Used by | Description |
|---|---|---|
| `WXO_URL` | Express + import-all.sh | WxO instance URL |
| `WXO_API_KEY` | Express + import-all.sh | IBM Cloud API key |
| `WXO_ENV_NAME` | import-all.sh | WxO environment label |
| `COS_API_KEY` | import-all.sh | IBM COS API key |
| `COS_INSTANCE_CRN` | import-all.sh | COS instance CRN |
| `COS_ENDPOINT` | import-all.sh | COS endpoint URL |
| `COS_BUCKET` | import-all.sh | COS bucket name |
| `MAILJET_API_KEY` | import-all.sh | Mailjet API key |
| `MAILJET_SECRET_KEY` | import-all.sh | Mailjet secret key |
| `TRIAGE_AGENT_ID` | Express | Triage agent UUID |
| `CLASSIFICATION_AGENT_ID` | Express | Classification agent UUID |
| `RCA_AGENT_ID` | Express | RCA agent UUID |
| `NOTIFICATION_AGENT_ID` | Express | Notify agent UUID |
| `ACTION_AGENT_ID` | Express | Action agent UUID |
| `CLOSE_AGENT_ID` | Express | Close agent UUID |
| `CONV_SUPERVISOR_AGENT_ID` | Express | Conversational supervisor UUID |
| `EXPRESS_PORT` | Express | Backend port (default: 3001) |
| `BACKEND_URL` | Next.js rewrites | Full backend URL (Code Engine) |
| `WXO_EMBED_PRIVATE_KEY` | Express | RS256 private key for WxO embed JWT |

---

## 10. Quickstart (Local Development)

```bash
# 1. Clone and install
cd SOC-APP
cp .env.example .env
# Fill in .env with your credentials

# 2. Install Node dependencies
npm install

# 3. Bootstrap WxO (first time only)
chmod +x import-all.sh
./import-all.sh

# 4. Start both servers
npm run dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```
