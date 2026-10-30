# Agentic SOC — Quickstart Guide

**Feature**: Automated QRadar Offense Response Pipeline

---

## Prerequisites

| Requirement | Minimum version |
|---|---|
| Node.js | 18+ |
| Python | 3.11+ |
| IBM watsonx Orchestrate instance | instance URL + IBM Cloud API key |
| IBM Cloud Object Storage bucket | offense CSVs + YAML config files pre-uploaded |
| Mailjet account | API key + secret key (for email notifications) |

---

## Step 1 — Configure Credentials

```bash
cd SOC-APP
cp .env.example .env
# Open .env and fill in all values
```

`.env` (required for Live WxO mode; Mock Demo mode runs without WxO credentials):
```env
WXO_ENV_NAME=soc_dev
WXO_URL=https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<INSTANCE_ID>
WXO_API_KEY=<ibm_cloud_api_key>
COS_API_KEY=<cos_api_key>
COS_INSTANCE_CRN=crn:v1:bluemix:public:cloud-object-storage:global:a/<acct>:<inst>::
COS_ENDPOINT=https://s3.<region>.cloud-object-storage.appdomain.cloud
COS_BUCKET=<bucket_name>
MAILJET_API_KEY=<mailjet_api_key>
MAILJET_SECRET_KEY=<mailjet_secret_key>
```

---

## Step 2 — Install Node Dependencies

```bash
cd SOC-APP
npm install
```

---

## Step 3 — Bootstrap WxO (First Time Only)

Creates the WxO environment from `.env`, registers the COS + Mailjet connections, optionally uploads YAML configs to COS
(`UPLOAD_YAML_TO_COS=true`), imports all tools, the knowledge base and all agents into WxO. Offense CSVs must already be
in the COS bucket. The script is specified verbatim in [`bootstrap-script.md`](./bootstrap-script.md) and never prompts for secrets.

```bash
cd SOC-APP
chmod +x import-all.sh
./import-all.sh
```

---

## Step 4 — Retrieve Agent IDs (After Bootstrap)

After `import-all.sh` completes, retrieve each agent's UUID from the WxO UI and add to `.env`:

```env
TRIAGE_AGENT_ID=<uuid>
CLASSIFICATION_AGENT_ID=<uuid>
RCA_AGENT_ID=<uuid>
NOTIFICATION_AGENT_ID=<uuid>
ACTION_AGENT_ID=<uuid>
CLOSE_AGENT_ID=<uuid>
CONV_SUPERVISOR_AGENT_ID=<uuid>
```

---

## Step 5 — Start the Application

```bash
cd SOC-APP
npm run dev
```

- Frontend dashboard: http://localhost:3000
- Backend API proxy: http://localhost:3001

---

## Step 6 — Test the Pipeline

Open http://localhost:3000 and:
1. **Mock Demo Mode (Default)**: The application loads in Mock Mode by default.
   - Select offense **167657** (True Positive — Web Exploit).
   - Click **Run Pipeline** (or click "⚡ Pre-populate" for instant results).
   - Observe simulated stages running with realistic telemetry, tool calls, and outputs.
2. **Live WxO Mode**:
   - Toggle the Navbar segmented switch from **Mock Mode** to **Live WxO**.
   - With backend and `.env` configured, click **Run Pipeline**.
   - Watch live agents execute on your watsonx Orchestrate instance.
3. Click any stage card to inspect tabs: **Output**, **Tools (N)**, **Traces (N)**, **Prompt**.
4. When the Action stage starts, approve/reject proposed remediation in the amber **Action Approval Required** panel.
5. After RCA completes, open the Incident Report from the teal banner / "Report" button / floating "View RCA Report" pill.

---

## Troubleshooting

| Symptom | Solution |
|---|---|
| Navbar pill shows amber "WxO not configured" / stage fails with `Missing WATSONX_SERVICE_URL` | Check `WXO_URL` and `WXO_API_KEY` are set in `.env` and restart `npm run dev` |
| Tools tab shows "No tool calls captured." | The run completed but WxO returned no `step_history`; check `raw` in the Traces tab and the agent's tool bindings |
| `import-all.sh` fails on a single tool | Re-run: `orchestrate tools import -k python -f tools/<failed>.py -r tools/requirements.txt` |
| Tool import: `cannot import name 'ExpectedCredentials' from 'ibm_watsonx_orchestrate.agent_builder.tools'` | Wrong import path. Use `from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType, ExpectedCredentials` and keep `from ibm_watsonx_orchestrate.agent_builder.tools import ToolPermission, tool`. See `plan.md` §6.0 |
| `import-all.sh` prompts `Please enter WXO API key:` | `WXO_API_KEY` is empty/unreadable in `SOC-APP/.env`, or the script calls `orchestrate env activate` without `--api-key`. The script must pass `--api-key "$WXO_API_KEY"` and never ask interactively. See `plan.md` §5.4 |
| `import-all.sh` stops at "Importing knowledge base" / KB step fails | Re-run only the KB: `cd SOC-APP && source .venv/bin/activate && orchestrate knowledge-bases import -f knowledge_base/soc_kb.yaml`, then `orchestrate knowledge-bases status -n soc_knowledge_base` until `Built In Index Status` = `ready`. See `plan.md` §5.3 |
| KB import: `FileNotFoundError: knowledge_base/triage_rules.txt` | Document paths in `soc_kb.yaml` must be bare names (`triage_rules.txt`); they resolve relative to the YAML's folder |
| KB import: `Model '…' was not found` / `model_not_supported` | `embeddings_model_name` must be `ibm/slate-125m-english-rtrvr-v2` (or remove `vector_index`). The CLI still exits 0 on this error — read the output |
| KB import prints `Document "…" already exists … Updating...` | Expected on re-runs; not an error |
| Action agent never uses the KB payload schemas | `action_agent.yaml` must use `knowledge_base:` (singular). `knowledge_bases:` is silently ignored on import |
| Config Viewer shows empty | Check COS credentials in `.env` |
| Triage returns `NOT_FOUND` | Verify offense CSV exists in COS bucket root |
| Port already in use | `npm run kill-ports` then `npm run dev` |
