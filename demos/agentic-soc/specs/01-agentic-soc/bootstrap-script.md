# Agentic SOC — Bootstrap Script Specification (`import-all.sh`)

**Status**: Normative. When building the application from `specs/`, the generated `SOC-APP/import-all.sh` MUST be
**byte-for-byte equivalent in behaviour** to the script in §3. Do not re-derive, reorder, simplify, or "improve" it.
Copy it verbatim. Related contracts: `plan.md` §5.3 (knowledge base), §5.4 (non-interactive auth), §6.0 (tool imports).

---

## 1. Purpose

One command bootstraps an IBM watsonx Orchestrate (WxO) tenant for the SOC pipeline:

```bash
cd SOC-APP && chmod +x import-all.sh && ./import-all.sh
```

It must run **end-to-end with zero interactive prompts**. Every secret comes from `SOC-APP/.env`.

## 2. Files the script depends on (must exist before it runs)

| Path (under `SOC-APP/`) | Purpose |
|---|---|
| `.env` (copied from `.env.example`) | All credentials — see §4 |
| `connections/cos_connection.yaml` | Fallback definition of connection `soc-cos-data` (§5.1) |
| `connections/mailjet_connection.yaml` | Fallback definition of connection `soc-mailjet` (§5.2) |
| `config/*.yaml` (9 files) | Uploaded to COS when `UPLOAD_YAML_TO_COS=true` (§6) |
| `tools/requirements.txt` | `pydantic==2.13.3`, `requests`, `mailjet-rest`, `pyyaml` |
| `tools/offense_tools.py`, `enrichment_tools.py`, `update_offense_status.py`, `close_offense_tool.py`, `notify_tool.py`, `action_tools.py` | Imported in step 5 |
| `knowledge_base/soc_kb.yaml`, `triage_rules.txt`, `action_schemas.txt` | Imported in step 6 |
| `agents/{triage,classification,rca,notify,action,close}_agent.yaml`, `agents/conversational_supervisor_agent.yaml` | Imported in step 7 |

## 3. Normative script — `SOC-APP/import-all.sh`

```bash
#!/bin/bash
# =============================================================================
# SOC — import-all.sh  (v4 — PoC round 03)
# Full environment bootstrap for IBM watsonx Orchestrate.
#
# Run from the SOC-APP/ directory:
#   cd SOC-APP && chmod +x import-all.sh && ./import-all.sh
#
# Prerequisites:
#   1. Copy .env.example to .env and fill in all values:
#        cp .env.example .env
#   2. Upload offense CSV files from SampleData/sanitized/ to your COS bucket
#   3. Then run this script
#
# Changes from v3:
#   - Action Agent removed from pipeline (no action_tools import, no action_agent import)
#   - Knowledge base decoupled: triage/classification/rca agents no longer reference it;
#     only action_agent retains the KB (action_schemas.txt) — kept for reference import
#   - conversational_supervisor_agent added (step-by-step with gates)
# =============================================================================

set -e
# Tool/agent imports use || true so a single failed import does not abort the
# entire script — each step reports its own success/failure message.

# =============================================================================
# Load credentials from .env
# =============================================================================
ENV_FILE="$(dirname "${BASH_SOURCE[0]}")/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌  .env file not found at $ENV_FILE"
  echo "    Copy .env.example to .env and fill in your values:"
  echo "      cp .env.example .env"
  exit 1
fi

# Parse .env manually: skip blank lines and comments, then export each KEY=VALUE.
# Using grep+read instead of `source` avoids bash syntax errors on values that
# contain special characters (colons, parentheses, etc.) such as COS_INSTANCE_CRN.
while IFS='=' read -r key value; do
  # Skip blank lines and comment lines
  [[ -z "$key" || "$key" == \#* ]] && continue
  # Strip CR (CRLF .env files) so keys are never blank/garbled
  key="${key%$'\r'}"; value="${value%$'\r'}"
  # Strip inline comments (everything after an unquoted ' #' or ' #')
  value="${value%%  #*}"
  value="${value%% #*}"
  # Strip surrounding quotes if the user added them
  value="${value#\"}" ; value="${value%\"}"
  value="${value#\'}" ; value="${value%\'}"
  export "$key=$value"
done < <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')

# Validate required variables
required_vars=(
  WXO_ENV_NAME WXO_URL WXO_API_KEY
  COS_API_KEY COS_INSTANCE_CRN COS_ENDPOINT COS_BUCKET
  MAILJET_API_KEY MAILJET_SECRET_KEY
)
missing=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing+=("$var")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "❌  The following required variables are not set in .env:"
  for var in "${missing[@]}"; do
    echo "      $var"
  done
  exit 1
fi

# Set to "false" to skip re-uploading YAML config files to COS
# (can also be set in .env or passed as an environment variable)
UPLOAD_YAML_TO_COS="${UPLOAD_YAML_TO_COS:-false}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅  $1${NC}"; }
info() { echo -e "${YELLOW}➡   $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️   $1${NC}"; }
fail() { echo -e "${RED}❌  $1${NC}"; exit 1; }

echo ""
echo "=================================================="
echo "  SOC — watsonx Orchestrate Setup  (v4)"
echo "=================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
info "Working directory: $SCRIPT_DIR"

# =============================================================================
# STEP 1: Python virtual environment + WxO CLI
# =============================================================================
echo ""
info "Step 1/7: Setting up Python virtual environment..."
rm -rf .venv
python3 -m venv --clear .venv
source ./.venv/bin/activate
.venv/bin/pip install --upgrade ibm-watsonx-orchestrate
.venv/bin/pip install pyyaml requests ibm-cos-sdk mailjet-rest
orchestrate --version
ok "ibm-watsonx-orchestrate CLI ready"

# =============================================================================
# STEP 2: Configure and activate WxO environment
# =============================================================================
echo ""
info "Step 2/7: Configuring watsonx Orchestrate environment..."

# API key always comes from .env via --api-key — never prompted interactively
orchestrate env add -n "$WXO_ENV_NAME" -u "$WXO_URL" 2>/dev/null || true
orchestrate env activate "$WXO_ENV_NAME" --api-key "$WXO_API_KEY" \
  || fail "env activate failed — check WXO_URL and WXO_API_KEY in .env"
ok "WxO environment '$WXO_ENV_NAME' activated"

# =============================================================================
# STEP 3: IBM COS Connection — add connection, configure environments, set credentials
# =============================================================================
echo ""
info "Step 3/7: Registering IBM COS connection and setting credentials..."

# Add connection if not already present (silently succeeds or skips if exists)
orchestrate connections add --app-id soc-cos-data 2>/dev/null || true

# Explicitly ensure both draft and live environment configurations exist
orchestrate connections configure -a soc-cos-data --environment draft -t team -k key_value 2>/dev/null || true
orchestrate connections configure -a soc-cos-data --environment live -t team -k key_value 2>/dev/null || true

# Import YAML connection spec if present
if [ -f "connections/cos_connection.yaml" ]; then
  orchestrate connections import -f connections/cos_connection.yaml 2>/dev/null || true
fi

orchestrate connections set-credentials -a soc-cos-data --environment draft \
  -e "cos_api_key=${COS_API_KEY}" \
  -e "cos_instance_crn=${COS_INSTANCE_CRN}" \
  -e "cos_endpoint=${COS_ENDPOINT}" \
  -e "cos_bucket=${COS_BUCKET}" \
  || warn "Failed to set draft credentials for soc-cos-data"

orchestrate connections set-credentials -a soc-cos-data --environment live \
  -e "cos_api_key=${COS_API_KEY}" \
  -e "cos_instance_crn=${COS_INSTANCE_CRN}" \
  -e "cos_endpoint=${COS_ENDPOINT}" \
  -e "cos_bucket=${COS_BUCKET}" \
  || warn "Failed to set live credentials for soc-cos-data"

ok "soc-cos-data connection configured (draft + live)"

# =============================================================================
# STEP 3b: Mailjet Connection
# =============================================================================
echo ""
info "Step 3b/7: Registering Mailjet connection and setting credentials..."

# Add connection if not already present (silently succeeds or skips if exists)
orchestrate connections add --app-id soc-mailjet 2>/dev/null || true

# Explicitly ensure both draft and live environment configurations exist
orchestrate connections configure -a soc-mailjet --environment draft -t team -k key_value 2>/dev/null || true
orchestrate connections configure -a soc-mailjet --environment live -t team -k key_value 2>/dev/null || true

# Import YAML connection spec if present
if [ -f "connections/mailjet_connection.yaml" ]; then
  orchestrate connections import -f connections/mailjet_connection.yaml 2>/dev/null || true
fi

orchestrate connections set-credentials -a soc-mailjet --environment draft \
  -e "mailjet_api_key=${MAILJET_API_KEY}" \
  -e "mailjet_secret_key=${MAILJET_SECRET_KEY}" \
  || warn "Failed to set draft credentials for soc-mailjet"

orchestrate connections set-credentials -a soc-mailjet --environment live \
  -e "mailjet_api_key=${MAILJET_API_KEY}" \
  -e "mailjet_secret_key=${MAILJET_SECRET_KEY}" \
  || warn "Failed to set live credentials for soc-mailjet"

ok "soc-mailjet connection configured (draft + live)"


# =============================================================================
# STEP 5: Upload YAML config files to COS
# (allowlist, service_path_policy, exfil_tools, proxy_and_lb,
#  privileged_accounts, linux_log_rotation, maintenance_windows)
# These are read at runtime by enrichment_tools.py via _fetch_cos_yaml()
# Skip by running:  UPLOAD_YAML_TO_COS=false ./import-all.sh
# =============================================================================
echo ""
if [ "$UPLOAD_YAML_TO_COS" = "false" ]; then
  info "Step 4/7: Skipping YAML config upload (UPLOAD_YAML_TO_COS=false)"
  ok "YAML config files already in COS — skipped"
else
  info "Step 4/7: Uploading YAML config files to COS bucket '${COS_BUCKET}'..."

  # Use Python + ibm-cos-sdk to upload each config file
  python - <<PYEOF
import ibm_boto3
from ibm_botocore.client import Config

cos = ibm_boto3.client(
    "s3",
    ibm_api_key_id="${COS_API_KEY}",
    ibm_service_instance_id="${COS_INSTANCE_CRN}",
    config=Config(signature_version="oauth"),
    endpoint_url="${COS_ENDPOINT}",
)

bucket = "${COS_BUCKET}"

config_files = [
    ("config/allowlist.yaml",             "allowlist.yaml"),
    ("config/service_path_policy.yaml",   "service_path_policy.yaml"),
    ("config/exfil_tools.yaml",           "exfil_tools.yaml"),
    ("config/proxy_and_lb.yaml",          "proxy_and_lb.yaml"),
    ("config/privileged_accounts.yaml",   "privileged_accounts.yaml"),
    ("config/linux_log_rotation.yaml",    "linux_log_rotation.yaml"),
    ("config/maintenance_windows.yaml",   "maintenance_windows.yaml"),
    ("config/asset_registry.yaml",        "asset_registry.yaml"),
    ("config/threat_intel_feed.yaml",     "threat_intel_feed.yaml"),
]

for local_path, cos_key in config_files:
    try:
        with open(local_path, "rb") as f:
            cos.put_object(Bucket=bucket, Key=cos_key, Body=f.read())
        print(f"  ✅  Uploaded {local_path} -> s3://{bucket}/{cos_key}")
    except FileNotFoundError:
        print(f"  ⚠️   Skipped {local_path} — file not found locally")
    except Exception as e:
        print(f"  ❌  Failed to upload {local_path}: {e}")
PYEOF

  ok "YAML config files uploaded to COS"
  echo ""
  warn "NOTE: The following files are placeholders and need live data before production use:"
  echo "        maintenance_windows.yaml  — populate with maintenance schedule"
  echo "        privileged_accounts.yaml  — add environment-specific accounts"
  echo "        proxy_and_lb.yaml         — add full load balancer / proxy IP list"
  echo ""
  warn "NOTE: asset_registry.yaml and threat_intel_feed.yaml are uploaded from config/ when present."
  warn "      Their current repo contents are DUMMY values (criticality/owner/environment and TI verdicts);"
  warn "      replace them with a CMDB export / real TI feed for meaningful lookup_asset / lookup_threat_intel results."
  warn "      If they are absent from COS, those tools return 'unknown' and the Live report omits those rows."
  echo ""
fi

# =============================================================================
# STEP 6: Tools — import all Python tools
# =============================================================================
echo ""
info "Step 5/7: Importing tools..."

info "  Importing offense_tools.py  (fetch_offense, fetch_offense_events, fetch_rca_events)..."
orchestrate tools import -k python \
  -f tools/offense_tools.py \
  -r tools/requirements.txt \
  -a soc-cos-data \
  && ok "  soc_fetch_offense + fetch_offense_events + fetch_rca_events imported" \
  || warn "  offense_tools import failed — check soc-cos-data connection credentials"

info "  Importing enrichment_tools.py  (13 enrichment tools for v3 triage + classification)..."
orchestrate tools import -k python \
  -f tools/enrichment_tools.py \
  -r tools/requirements.txt \
  -a soc-cos-data \
  && ok "  Enrichment tools imported:" \
  || warn "  enrichment_tools import failed — check soc-cos-data connection credentials"
ok "    soc_fetch_rule_statistics"
ok "    soc_fetch_offense_history"
ok "    soc_lookup_asset"
ok "    soc_lookup_threat_intel"
ok "    soc_fetch_host_baseline"
ok "    soc_check_allowlist"
ok "    soc_check_maintenance_window"
ok "    soc_check_service_path"
ok "    soc_check_exfil_tool"
ok "    soc_check_privileged_account"
ok "    soc_check_linux_log_rotation"
ok "    soc_log_out_of_scope"
ok "    soc_log_suppressed_offense"

info "  Importing update_offense_status.py  (update_offense_severity)..."
orchestrate tools import -k python \
  -f tools/update_offense_status.py \
  -r tools/requirements.txt \
  && ok "  soc_update_offense_severity imported" \
  || warn "  update_offense_status import failed"

info "  Importing close_offense_tool.py  (close_offense)..."
orchestrate tools import -k python \
  -f tools/close_offense_tool.py \
  -r tools/requirements.txt \
  && ok "  soc_close_offense imported" \
  || warn "  close_offense_tool import failed"

info "  Importing notify_tool.py  (notify_tier1 via Mailjet)..."
orchestrate tools import -k python \
  -f tools/notify_tool.py \
  -r tools/requirements.txt \
  -a soc-mailjet \
  && ok "  soc_notify imported" \
  || warn "  soc_notify import failed — check soc-mailjet connection credentials"

info "  Importing action_tools.py  (request_action_approval, execute_approved_action)..."
orchestrate tools import -k python \
  -f tools/action_tools.py \
  -r tools/requirements.txt \
  && ok "  soc_request_action_approval + soc_execute_approved_action imported" \
  || warn "  action_tools import failed"

# =============================================================================
# STEP 7: Knowledge Base
# =============================================================================
echo ""
info "Step 6/7: Importing knowledge base..."

# Verify all required KB files are present before importing
KB_NAME="soc_knowledge_base"
for f in soc_kb.yaml triage_rules.txt action_schemas.txt; do
  [ -f "knowledge_base/$f" ] || fail "knowledge_base/$f not found"
done

# Note: triage_agent, classification_agent, and rca_agent no longer reference
# this knowledge base. Only action_agent uses it (action_schemas.txt).
# The CLI exits 0 even when server-side indexing fails — do not treat exit code as proof of success.
orchestrate knowledge-bases import -f knowledge_base/soc_kb.yaml \
  || fail "knowledge-bases import failed"

# Poll until the KB index reaches 'ready' (up to 3 minutes / 36 × 5 s).
# The CLI's -v JSON contains raw newlines in 'description', so it must be parsed
# with json.loads(..., strict=False); plain jq raises "Invalid control character".
KB_STATE=""
for i in $(seq 1 36); do
  KB_STATE=$(orchestrate knowledge-bases status -n "$KB_NAME" -v 2>/dev/null \
    | python -c 'import sys,json; d=json.loads(sys.stdin.read(),strict=False); print(d.get("built_in_index_status") or "pending")' \
    2>/dev/null || echo "unknown")
  info "  KB index status: $KB_STATE (attempt $i/36)"
  [ "$KB_STATE" = "ready" ] && break
  case "$KB_STATE" in
    failed|error) fail "Knowledge base indexing failed — run: orchestrate knowledge-bases status -n $KB_NAME" ;;
  esac
  sleep 5
done
[ "$KB_STATE" = "ready" ] || fail "Knowledge base did not reach 'ready' within 3 minutes"
ok "  soc_knowledge_base indexed and ready"

# =============================================================================
# STEP 8: Agents — sub-agents first, supervisor last
# Import order matters: supervisor references sub-agents as collaborators,
# so every sub-agent must be registered before supervisor is imported.
# =============================================================================
echo ""
info "Step 7/7: Importing agents..."

# ── Sub-agents ────────────────────────────────────────────────────────────────
orchestrate agents import -f agents/triage_agent.yaml \
  && ok "  soc_triage_agent imported  (v3 — 3 offense types, 9 tools, parallel enrichment)" \
  || warn "  triage_agent import failed"

orchestrate agents import -f agents/classification_agent.yaml \
  && ok "  soc_classification_agent imported  (v3 — M1-M7 router, 15 tools)" \
  || warn "  classification_agent import failed"

orchestrate agents import -f agents/rca_agent.yaml \
  && ok "  soc_rca_agent imported" \
  || warn "  rca_agent import failed"

orchestrate agents import -f agents/notify_agent.yaml \
  && ok "  soc_notify_agent imported" \
  || warn "  notify_agent import failed"

orchestrate agents import -f agents/action_agent.yaml \
  && ok "  soc_action_agent imported" \
  || warn "  action_agent import failed"

orchestrate agents import -f agents/close_agent.yaml \
  && ok "  soc_close_agent imported" \
  || warn "  close_agent import failed"

# ── Supervisor (import after all sub-agents) ─────────────────────────────────
orchestrate agents import -f agents/conversational_supervisor_agent.yaml \
  && ok "  soc_conversational_supervisor imported  (step-by-step with gates)" \
  || warn "  conversational_supervisor_agent import failed"

# =============================================================================
# DONE
# =============================================================================
echo ""
echo "=================================================="
ok "SOC v4 setup complete!"
echo "=================================================="
echo ""
echo "WxO Instance : $WXO_URL"
echo "Environment  : $WXO_ENV_NAME"
echo "COS Bucket   : $COS_BUCKET"
echo ""
echo "── Tool inventory ──────────────────────────────────────────────────"
echo ""
echo "  OFFENSE DATA (offense_tools.py)"
echo "    soc_fetch_offense               — metadata + formattedOffenseType"
echo "    soc_fetch_offense_events         — all events with v3 customProps fields"
echo "    soc_fetch_rca_events             — analyst-curated RCA events"
echo ""
echo "  ENRICHMENT (enrichment_tools.py) — NEW in v3"
echo "    soc_fetch_rule_statistics        — TP rate per QRadar rule (T3, C0)"
echo "    soc_fetch_offense_history        — attacker/rule history (TH, C0)"
echo "    soc_lookup_asset                 — asset criticality (T2b, TF) [DUMMY data]"
echo "    soc_lookup_threat_intel          — TI verdict (TG, N1) [DUMMY data]"
echo "    soc_fetch_host_baseline          — process periodicity (M2, M5, M6)"
echo "    soc_check_allowlist              — approved process/path/IP (M2,M3,M4,M7)"
echo "    soc_check_maintenance_window     — planned outage check (M6-TP-2/3) [NEEDS_LIVE_DATA]"
echo "    soc_check_service_path           — service_path_policy.yaml (M3)"
echo "    soc_check_exfil_tool             — exfil_tools.yaml (M4)"
echo "    soc_check_privileged_account     — privileged_accounts.yaml (M5, M6-TP-3)"
echo "    soc_check_linux_log_rotation     — linux_log_rotation.yaml (M6-TP-1)"
echo "    soc_log_out_of_scope             — audit log for unknown offense types"
echo "    soc_log_suppressed_offense       — audit log for Informational suppression"
echo ""
echo "  OTHER"
echo "    soc_update_offense_severity"
echo "    soc_close_offense"
echo "    soc_notify  (Mailjet email to Tier 1)"
echo ""
echo "── YAML config files in COS ────────────────────────────────────────"
echo ""
echo "  allowlist.yaml             ✅  15 seeded entries (NEEDS_REVIEW)"
echo "  service_path_policy.yaml   ✅  Seeded from offenses 173500/178147/178224"
echo "  exfil_tools.yaml           ✅  Seeded from offense 177254 + public TI"
echo "  proxy_and_lb.yaml          ✅  203.0.0.19 seeded from offense 177507"
echo "  privileged_accounts.yaml   ✅  Universal accounts seeded (must add env-specific)"
echo "  linux_log_rotation.yaml    ✅  Standard paths seeded from offense 177441"
echo "  maintenance_windows.yaml   ⚠️   Empty — must populate before M6 Benign verdicts work"
echo "  asset_registry.yaml        ⚠️   Uploaded only if UPLOAD_YAML_TO_COS=true; repo copy is DUMMY — otherwise lookup_asset returns unknown"
echo "  threat_intel_feed.yaml     ⚠️   Uploaded only if UPLOAD_YAML_TO_COS=true; repo copy is DUMMY — otherwise lookup_threat_intel returns unknown"
echo ""
echo "── Test Cases (v3 expected outcomes) ──────────────────────────────"
echo ""
echo "TRUE POSITIVE — Web exploit, proxy IP rewrite, compromised account:"
echo "  Offense 177507  →  Destination IP | High | M1-TP | severity_override=Critical"
echo "  real_source_ip=203.0.0.21 (NOT 203.0.0.19 nginx server)"
echo ""
echo "TRUE POSITIVE — Malicious service install, relevance=0:"
echo "  Offense 173500  →  Destination IP | Low (T1+TI) | M3-TP"
echo "  Service Filename: C:\\Windows\\Temp\\vmware-vmsvc-SYSTEM2.log"
echo "  must_inspect_events=true enforced (event_count=2, TI rule)"
echo ""
echo "TRUE POSITIVE — rclone exfil via scheduled task:"
echo "  Offense 177254  →  Destination IP | High | M4-TP"
echo "  ehcKySo.exe (sanitised powershell.exe) -> 5 public IPs on port 7001"
echo ""
echo "BENIGN POSITIVE — Kaspersky service install:"
echo "  Offense 178224  →  Destination IP | Medium | M3-BP"
echo "  vendor_match=Kaspersky, permitted path, valid extension"
echo ""
echo "BENIGN POSITIVE — WmiPrvSE.exe privileged object access:"
echo "  Offense 141835  →  Source IP | Low | M7-BP"
echo "  allowlist entry BENIGN-006 matches"
echo ""
echo "BENIGN POSITIVE — MobaXterm CreateRemoteThread:"
echo "  Offense 156271  →  Source IP | Low | M7-BP"
echo "  allowlist entry BENIGN-004 matches"
echo ""
echo "BENIGN POSITIVE — sdbinst PcaSvc shimming:"
echo "  Offense 167679  →  Device Name | Medium | M7-BP"
echo "  allowlist entry BENIGN-001 matches"
echo ""
echo "FALSE POSITIVE — w3wp.exe spawning w3wp.exe (app pool start):"
echo "  Offense 173398  →  Destination IP | Medium | M2-BP"
echo "  allowlist entry BENIGN-008 matches"
echo ""
echo "FALSE POSITIVE — Recurring Non-Issue pattern (C0 stage):"
echo "  Any offense with closed_non_issue_count>=5, distinct_analysts>=2,"
echo "  ever_true_positive=false, rule_tp_rate<0.20"
echo ""
echo "CONVERSATIONAL (step-by-step analyst confirmation):"
echo "  Agent  : soc_conversational_supervisor"
echo "  Message: Investigate offense 167657"
echo "  Flow   : Triage → confirm → Classify → confirm → RCA → confirm → [Notify if TP] → confirm → Close"
echo ""
```

## 4. `.env` contract (`SOC-APP/.env.example`)

The generated `.env.example` MUST contain exactly these keys (placeholders only — never real secrets in the repo):

```dotenv
# IBM watsonx Orchestrate (import-all.sh + server/server.js)
WXO_ENV_NAME=<short-label>            # e.g. soc_dev
WXO_URL=<https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<instance-id>>
WXO_API_KEY=<ibm-cloud-api-key>       # consumed via `orchestrate env activate --api-key`

EXPRESS_PORT=3001

# Agent UUIDs (filled in after import-all.sh, read by server/server.js)
CONV_SUPERVISOR_AGENT_ID=<conversational-supervisor-agent-uuid>
TRIAGE_AGENT_ID=<triage-agent-uuid>
CLASSIFICATION_AGENT_ID=<classification-agent-uuid>
RCA_AGENT_ID=<rca-agent-uuid>
NOTIFICATION_AGENT_ID=<notification-agent-uuid>
ACTION_AGENT_ID=<action-agent-uuid>
CLOSE_AGENT_ID=<close-agent-uuid>

# IBM Cloud Object Storage (import-all.sh)
COS_API_KEY="<cos-api-key>"
COS_INSTANCE_CRN="<crn:v1:bluemix:public:cloud-object-storage:global:a/...::>"
COS_ENDPOINT="<https://s3.<region>.cloud-object-storage.appdomain.cloud>"
COS_BUCKET="<bucket-name>"

# Mailjet (import-all.sh + notify_tool.py)
MAILJET_API_KEY="<mailjet-api-key>"
MAILJET_SECRET_KEY="<mailjet-secret-key>"

# Optional: set to "true" to upload config/*.yaml to COS during bootstrap (default false).
# Set to "true" on the first Live deployment (or whenever the COS bucket does not yet contain the
# 9 config files); otherwise asset/threat-intel lookups return 'unknown' and the Live report omits those rows.
UPLOAD_YAML_TO_COS=false
```

Parser rules the script implements (do not change): lines starting with `#` and blank lines are skipped; `\r` is
stripped; inline comments (` #…`) are removed; surrounding `"`/`'` are stripped; values are exported verbatim. `.env`
is **never** `source`d (values such as `COS_INSTANCE_CRN` contain `:` and `/`).

## 5. Connection definition files

### 5.1 `SOC-APP/connections/cos_connection.yaml`
```yaml
spec_version: v1
kind: connection
app_id: soc-cos-data
environments:
  draft:
    type: team
    kind: key_value
  live:
    type: team
    kind: key_value

# IBM Cloud Object Storage connection for SOC PoC offense CSV data.
# Credentials set via: orchestrate connections set-credentials -a soc-cos-data
# Required keys: cos_api_key, cos_instance_crn, cos_endpoint, cos_bucket
```

### 5.2 `SOC-APP/connections/mailjet_connection.yaml`
```yaml
spec_version: v1
kind: connection
app_id: soc-mailjet
environments:
  draft:
    type: team
    kind: key_value
  live:
    type: team
    kind: key_value
```

Key-value credential names are part of the contract — tools read them via `connections.key_value(app_id)`:
`soc-cos-data` → `cos_api_key`, `cos_instance_crn`, `cos_endpoint`, `cos_bucket`;
`soc-mailjet` → `mailjet_api_key`, `mailjet_secret_key`.

## 6. Step-by-step behaviour (verification checklist)

| # | Script label | Action | Failure behaviour |
|---|---|---|---|
| 0 | Load `.env` | Parse + export; validate 9 required vars | `exit 1` listing missing vars |
| 1 | Step 1/7 | `rm -rf .venv`, create venv, `pip install --upgrade ibm-watsonx-orchestrate`, then `pyyaml requests ibm-cos-sdk mailjet-rest`, `orchestrate --version` | `set -e` aborts |
| 2 | Step 2/7 | `env add` (errors ignored), `env activate … --api-key "$WXO_API_KEY"` | `fail` → exit 1 |
| 3 | Step 3/7 | `connections add --app-id soc-cos-data` (fallback: `connections import -f …`), `set-credentials` for **draft** and **live** | `set -e` aborts |
| 3b | Step 3b/8 | Same for `soc-mailjet` | `set -e` aborts |
| 4 | Step 4/7 | If `UPLOAD_YAML_TO_COS` is `false` (default) skip; otherwise upload the 9 `config/*.yaml` files to the bucket root via `ibm_boto3` (per-file error handling inside Python) | per-file ⚠️/❌ messages |
| 5 | Step 5/7 | Import 6 tool modules with `-k python -r tools/requirements.txt`; `-a soc-cos-data` for `offense_tools.py` and `enrichment_tools.py`, `-a soc-mailjet` for `notify_tool.py`, no `-a` for the other three | `|| warn` — continues |
| 6 | Step 6/7 | Verify 3 KB files, `knowledge-bases import`, poll status every 5 s up to 36× until `ready` | `fail` → exit 1 |
| 7 | Step 7/7 | Import agents in order: triage, classification, rca, notify, action, close, **then** conversational supervisor | `|| warn` — continues |
| — | Summary | Print instance/env/bucket, tool inventory, COS config status, 9 test-case expectations | — |

Notes (intentional, do not "fix"): step labels (`Step N/7`, `Step 3b/8`) and the `# STEP n` comment numbers are
inconsistent in the reference script; `rm -rf .venv` makes every run a clean install; the header "Changes from v3"
comment is historical and retained.

## 7. Acceptance criteria

- [ ] `bash -n SOC-APP/import-all.sh` passes.
- [ ] Script text matches §3 (diff shows no functional differences).
- [ ] Running it with a populated `.env` never prompts for any input.
- [ ] With `WXO_API_KEY` empty it exits 1 before any `orchestrate` call and lists `WXO_API_KEY` as missing.
- [ ] Both connections exist with credentials in `draft` and `live`.
- [ ] 6 tool modules import; KB reaches `ready`; 7 agents import (supervisor last).
