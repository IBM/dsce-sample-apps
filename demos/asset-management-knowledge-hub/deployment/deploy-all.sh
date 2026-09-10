#!/usr/bin/env bash
# =============================================================================
# deploy-all.sh — Maximo Knowledge Hub — Full Stack Deployment Orchestrator
#
# Deploys all three services to IBM Cloud Code Engine in strict dependency order:
#
#   1. Ingestion Pipeline  (no upstream dependencies — safe to deploy first)
#   2. MCP Server          (depends on OpenSearch + watsonx; must be live before UI)
#   3. Frontend UI         (requires MCP Server URL + Ingestion Pipeline URL)
#
# Each backend service is deployed by its dedicated script. After each backend
# deploy this script:
#   a) polls Code Engine until the app reports "Ready" (max 5 min each), and
#   b) reads the live HTTPS URL from the temp file written by the sub-script
#      (${SCRIPT_DIR}/.deploy-url-<service>) and auto-injects it into the UI deploy.
#
# The UI is therefore NEVER deployed with placeholder URLs — it will only start
# once both backends are confirmed healthy.
#
# USAGE
#   ./deployment/deploy-all.sh [OPTIONS]
#
# OPTIONS
#   --build-only        Build and push all images; skip Code Engine deploy
#   --deploy-only       Skip build/push; re-deploy all existing images
#   --tag <tag>         Override the image tag for all services  (default: latest)
#   --skip-ingestion    Skip ingestion pipeline deploy
#   --skip-mcp          Skip MCP server deploy
#   --skip-ui           Skip frontend UI deploy
#   --help              Print this help and exit
#
# REQUIRED ENV VARS (or set them in deployment/.env.deploy / .env.deploy.local)
#   IBMCLOUD_API_KEY          IBM Cloud API key
#
#   # OpenSearch (shared by both backend services)
#   OPENSEARCH_HOST           OpenSearch cluster URL  e.g. https://os.example.com:9200
#   OPENSEARCH_USERNAME       OpenSearch username
#   OPENSEARCH_PASSWORD       OpenSearch password
#
#   # watsonx (shared by both backend services)
#   WATSONX_API_KEY           IBM watsonx AI API key
#   WATSONX_PROJECT_ID        watsonx project ID
#
#   # IBM COS (ingestion pipeline only)
#   COS_API_KEY               IBM Cloud Object Storage API key
#   COS_BUCKET_NAME           COS bucket name
#   COS_ENDPOINT              COS endpoint URL
#   COS_BUCKET_INSTANCE_CRN   COS service instance CRN
#
# OPTIONAL ENV VARS
#   BACKEND_API_URL     Override the MCP server URL injected into the UI
#                       (auto-detected from Code Engine if not set)
#   INGEST_API_URL      Override the ingestion URL injected into the UI
#                       (auto-detected from Code Engine if not set)
#   OPENSEARCH_URL      OpenSearch URL injected into the UI nginx proxy
#                       (defaults to OPENSEARCH_HOST)
#   CORS_ORIGIN         Allowed CORS origin for backends
#                       (defaults to the UI's CE URL — auto-detected after UI deploy)
#
# EXAMPLES
#   # Full deploy of all three services
#   export IBMCLOUD_API_KEY=...
#   ./deployment/deploy-all.sh
#
#   # Rebuild + push all images only (no CE deploy)
#   ./deployment/deploy-all.sh --build-only
#
#   # Re-deploy all from existing images (no build)
#   ./deployment/deploy-all.sh --deploy-only
#
#   # Deploy only the backends (UI unchanged)
#   ./deployment/deploy-all.sh --skip-ui
#
#   # Deploy only the UI (backends already up-to-date)
#   ./deployment/deploy-all.sh --skip-ingestion --skip-mcp
# =============================================================================
set -euo pipefail

# ── Prevent Git Bash on Windows from mangling Unix paths ─────────────────────
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

# ── Script directory ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/deploy-all-$(date '+%Y%m%d-%H%M%S').log"
if [[ -z "${LOG_FILE_ACTIVE:-}" ]]; then
  export LOG_FILE_ACTIVE="${LOG_FILE}"
  exec > >(tee -a "${LOG_FILE}") 2>&1
fi
echo "=== Full-stack deploy started at $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
echo "=== Log file: ${LOG_FILE} ==="

# ── Auto-load secrets from .env.deploy ────────────────────────────────────────
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
if [[ -f "${ENV_FILE}" ]]; then
  set -o allexport; source "${ENV_FILE}"; set +o allexport
  echo -e "\033[0;36m[INFO]\033[0m  Loaded secrets from ${ENV_FILE}"
fi

# ── Auto-load secrets from .env.deploy.local (local overrides) ────────────────
ENV_LOCAL_FILE="${SCRIPT_DIR}/.env.deploy.local"
if [[ -f "${ENV_LOCAL_FILE}" ]]; then
  set -o allexport; source "${ENV_LOCAL_FILE}"; set +o allexport
  echo -e "\033[0;36m[INFO]\033[0m  Loaded secrets from ${ENV_LOCAL_FILE}"
fi

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
header()  {
  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  $*${RESET}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
}
step() { echo -e "\n${BOLD}${YELLOW}▶  $*${RESET}"; }

# ── CONFIG ────────────────────────────────────────────────────────────────────
IBMCLOUD_API_KEY="${IBMCLOUD_API_KEY:-}"
CE_REGION="${CE_REGION:-eu-de}"
CE_RESOURCE_GROUP="${CE_RESOURCE_GROUP:-bentley-rg}"
CE_PROJECT="${CE_PROJECT:-bentley-integration-server}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# App names (must match the defaults in each individual deploy script)
MCP_APP_NAME="${MCP_APP_NAME:-mcp-server}"
INGEST_APP_NAME="${INGEST_APP_NAME:-ingestion-pipeline}"
UI_APP_NAME="${UI_APP_NAME:-maximo-knowledge-hub}"

# URL overrides — auto-detected from CE if not explicitly set
BACKEND_API_URL="${BACKEND_API_URL:-}"
INGEST_API_URL="${INGEST_API_URL:-}"
OPENSEARCH_URL="${OPENSEARCH_URL:-${OPENSEARCH_HOST:-}}"

# ── Flags ─────────────────────────────────────────────────────────────────────
MODE="full"
SKIP_INGESTION="false"
SKIP_MCP="false"
SKIP_UI="false"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only)       MODE="build-only"    ; shift ;;
    --deploy-only)      MODE="deploy-only"   ; shift ;;
    --tag)              IMAGE_TAG="$2"       ; shift 2 ;;
    --skip-ingestion)   SKIP_INGESTION="true"; shift ;;
    --skip-mcp)         SKIP_MCP="true"      ; shift ;;
    --skip-ui)          SKIP_UI="true"       ; shift ;;
    --help)
      sed -n '/^# USAGE/,/^# =/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) error "Unknown option: $1. Run with --help for usage." ;;
  esac
done

# ── Detect ibmcloud CLI ───────────────────────────────────────────────────────
if command -v ibmcloud &>/dev/null; then
  IBMCLOUD="ibmcloud"
elif command -v ibmcloud.exe &>/dev/null; then
  IBMCLOUD="ibmcloud.exe"
elif [[ -f "/mnt/c/Program Files/IBM/Cloud/bin/ibmcloud.exe" ]]; then
  IBMCLOUD="/mnt/c/Program Files/IBM/Cloud/bin/ibmcloud.exe"
else
  error "ibmcloud CLI not found. Install from https://cloud.ibm.com/docs/cli"
fi
info "ibmcloud CLI: ${IBMCLOUD}"

# ── Require a non-empty variable ──────────────────────────────────────────────
require_var() {
  local name="$1" value="$2"
  [[ -n "$value" ]] || error "${name} is not set. Export it or add it to ${ENV_FILE}."
}

# ── One-time IBM Cloud login (shared across all sub-script invocations) ───────
# Sub-scripts check `ibmcloud account show` before logging in, so they will
# re-use this session rather than logging in three times.
ibmcloud_login() {
  require_var "IBMCLOUD_API_KEY" "${IBMCLOUD_API_KEY}"

  info "Logging in to IBM Cloud (region: ${CE_REGION}, resource group: ${CE_RESOURCE_GROUP})"
  "${IBMCLOUD}" login \
    --apikey "${IBMCLOUD_API_KEY}" \
    -r       "${CE_REGION}" \
    -g       "${CE_RESOURCE_GROUP}" \
    --quiet  || error "ibmcloud login failed"
  success "IBM Cloud login successful"

  info "Selecting Code Engine project: ${CE_PROJECT}"
  "${IBMCLOUD}" ce project select --name "${CE_PROJECT}" \
    || error "Could not select CE project '${CE_PROJECT}' in region ${CE_REGION}, resource group ${CE_RESOURCE_GROUP}"
  success "CE project selected: ${CE_PROJECT}"
}

# ── Poll CE until the app is Ready ────────────────────────────────────────────
# Used only to confirm the URL is resolvable after a sub-script has already
# reported ready. Uses the same plain-text grep as the sub-scripts — the JSON
# output places "type":"Ready" and "status":"True" on separate lines so a
# single-line grep never matches.
wait_for_ready() {
  local app_name="$1"
  local max_wait="${2:-300}"
  local interval=15
  local elapsed=0

  info "Confirming '${app_name}' is ready (max ${max_wait}s)..."
  while [[ ${elapsed} -lt ${max_wait} ]]; do
    local ready
    ready=$("${IBMCLOUD}" ce application get --name "${app_name}" 2>/dev/null \
      | grep -i "^  Ready" | grep -i "true" || true)
    if [[ -n "${ready}" ]]; then
      success "'${app_name}' confirmed ready"
      return 0
    fi
    info "  (${elapsed}s) '${app_name}' not ready yet — retrying in ${interval}s..."
    sleep "${interval}"
    elapsed=$(( elapsed + interval ))
  done
  error "'${app_name}' did not become ready within ${max_wait}s."
}

# ── Read a live URL from a temp file written by a sub-script ─────────────────
# Falls back to querying CE directly if the file is absent or empty.
read_service_url() {
  local app_name="$1"
  local url_file="$2"
  local url=""

  if [[ -f "${url_file}" ]]; then
    url="$(cat "${url_file}" | tr -d '[:space:]')"
  fi

  if [[ -z "${url}" ]]; then
    info "URL file not found or empty — querying CE for '${app_name}' URL..."
    url=$("${IBMCLOUD}" ce application get --name "${app_name}" \
      --output url 2>/dev/null | tr -d '[:space:]' || true)
  fi

  if [[ -z "${url}" ]]; then
    error "Could not determine URL for '${app_name}'. Is it deployed and ready?"
  fi

  echo "${url}"
}

# ── Pass through the right flags to sub-scripts ───────────────────────────────
sub_flags() {
  local flags=("--tag" "${IMAGE_TAG}")
  [[ "${MODE}" == "build-only"  ]] && flags+=("--build-only")
  [[ "${MODE}" == "deploy-only" ]] && flags+=("--deploy-only")
  echo "${flags[@]}"
}

# =============================================================================
# PRINT PLAN
# =============================================================================
header "Maximo Knowledge Hub — Full Stack Deploy"
echo ""
info "Deployment order (strict dependency chain):"
[[ "${SKIP_INGESTION}" == "true" ]] \
  && warn "  ✗  Step 1: Ingestion Pipeline  (--skip-ingestion)" \
  || info "  ✔  Step 1: Ingestion Pipeline  → deploy-ingestion.sh"
[[ "${SKIP_MCP}" == "true" ]] \
  && warn "  ✗  Step 2: MCP Server          (--skip-mcp)" \
  || info "  ✔  Step 2: MCP Server          → deploy-mcp-server.sh  (after Ingestion is ready)"
[[ "${SKIP_UI}" == "true" ]] \
  && warn "  ✗  Step 3: Frontend UI         (--skip-ui)" \
  || info "  ✔  Step 3: Frontend UI         → deploy.sh             (after MCP + Ingestion are ready)"
echo ""
info "Mode: ${MODE} | Image tag: ${IMAGE_TAG} | CE project: ${CE_PROJECT} | Region: ${CE_REGION}"
echo ""

# =============================================================================
# PRE-FLIGHT: One IBM Cloud login shared across all deploys
# =============================================================================
if [[ "${MODE}" != "build-only" ]]; then
  header "Pre-flight: IBM Cloud login"
  ibmcloud_login
fi

# =============================================================================
# STEP 1 — INGESTION PIPELINE
# =============================================================================
INGEST_URL_FILE="${SCRIPT_DIR}/.deploy-url-ingestion-pipeline"

if [[ "${SKIP_INGESTION}" == "false" ]]; then
  header "Step 1/3 — Ingestion Pipeline"
  step "Running deploy-ingestion.sh..."

  # Remove stale URL file so we don't accidentally use a previous run's URL
  rm -f "${INGEST_URL_FILE}"

  # Export vars the sub-script needs (it also sources .env.deploy, but explicit
  # export ensures overrides from THIS environment take precedence).
  export IMAGE_TAG IBMCLOUD_API_KEY CE_REGION CE_RESOURCE_GROUP CE_PROJECT

  # shellcheck source=deployment/deploy-ingestion.sh
  bash "${SCRIPT_DIR}/deploy-ingestion.sh" $(sub_flags)
  success "deploy-ingestion.sh exited cleanly"

  if [[ "${MODE}" != "build-only" ]]; then
    # The sub-script already calls wait_for_ready() internally.
    # We do a final orchestrator-level confirmation before moving on.
    wait_for_ready "${INGEST_APP_NAME}" 120
    success "Ingestion Pipeline is live"
  fi
else
  warn "Skipping Ingestion Pipeline deploy (--skip-ingestion)"
fi

# =============================================================================
# STEP 2 — MCP SERVER
# (only starts AFTER ingestion is confirmed ready — never in parallel)
# =============================================================================
MCP_URL_FILE="${SCRIPT_DIR}/.deploy-url-mcp-server"

if [[ "${SKIP_MCP}" == "false" ]]; then
  header "Step 2/3 — MCP Server"
  step "Running deploy-mcp-server.sh..."

  # Remove stale URL file
  rm -f "${MCP_URL_FILE}"

  export IMAGE_TAG IBMCLOUD_API_KEY CE_REGION CE_RESOURCE_GROUP CE_PROJECT

  # shellcheck source=deployment/deploy-mcp-server.sh
  bash "${SCRIPT_DIR}/deploy-mcp-server.sh" $(sub_flags)
  success "deploy-mcp-server.sh exited cleanly"

  if [[ "${MODE}" != "build-only" ]]; then
    wait_for_ready "${MCP_APP_NAME}" 120
    success "MCP Server is live"
  fi
else
  warn "Skipping MCP Server deploy (--skip-mcp)"
fi

# =============================================================================
# RESOLVE BACKEND URLS FOR UI
# Both backends must be live before this point — the UI can't be deployed with
# placeholder URLs because they are baked into the nginx runtime config.
# =============================================================================
if [[ "${SKIP_UI}" == "false" && "${MODE}" != "build-only" ]]; then
  header "Resolving backend URLs for UI deploy"

  # ── MCP Server URL ───────────────────────────────────────────────────────
  if [[ -z "${BACKEND_API_URL}" ]]; then
    BACKEND_API_URL=$(read_service_url "${MCP_APP_NAME}" "${MCP_URL_FILE}")
    success "BACKEND_API_URL (auto-detected): ${BACKEND_API_URL}"
  else
    info "BACKEND_API_URL (from env): ${BACKEND_API_URL}"
  fi
  export BACKEND_API_URL

  # ── Ingestion Pipeline URL ───────────────────────────────────────────────
  if [[ -z "${INGEST_API_URL}" ]]; then
    INGEST_API_URL=$(read_service_url "${INGEST_APP_NAME}" "${INGEST_URL_FILE}")
    success "INGEST_API_URL (auto-detected): ${INGEST_API_URL}"
  else
    info "INGEST_API_URL (from env): ${INGEST_API_URL}"
  fi
  export INGEST_API_URL

  # ── OpenSearch URL (UI nginx proxy target) ───────────────────────────────
  if [[ -z "${OPENSEARCH_URL}" ]]; then
    warn "OPENSEARCH_URL is not set — the UI's /opensearch-api proxy will have no target."
    warn "Set OPENSEARCH_URL (or OPENSEARCH_HOST) in your .env.deploy to fix this."
  else
    info "OPENSEARCH_URL: ${OPENSEARCH_URL}"
  fi
  export OPENSEARCH_URL

  # ── CORS_ORIGIN for backends (set to UI URL if not overridden) ───────────
  # If the user hasn't set CORS_ORIGIN already, we use a placeholder here;
  # the individual scripts will use what's exported at the time they run.
  # After the UI deploy, you can re-run --skip-ui to update the backends.
  if [[ -z "${CORS_ORIGIN:-}" ]]; then
    warn "CORS_ORIGIN not set — backends will accept any origin."
    warn "After the UI is deployed, set CORS_ORIGIN to the UI URL and re-run --skip-ui."
  else
    info "CORS_ORIGIN: ${CORS_ORIGIN}"
  fi
  export CORS_ORIGIN="${CORS_ORIGIN:-}"
fi

# =============================================================================
# STEP 3 — FRONTEND UI
# Only runs after both backends are confirmed live and their URLs are resolved.
# =============================================================================
if [[ "${SKIP_UI}" == "false" ]]; then
  header "Step 3/3 — Frontend UI"

  # Guard: in deploy mode the UI requires both backend URLs
  if [[ "${MODE}" != "build-only" ]]; then
    [[ -n "${BACKEND_API_URL}" ]] \
      || error "BACKEND_API_URL is empty — MCP Server must be deployed before the UI. Run without --skip-mcp."
    [[ -n "${INGEST_API_URL}" ]] \
      || error "INGEST_API_URL is empty — Ingestion Pipeline must be deployed before the UI. Run without --skip-ingestion."
  fi

  step "Running deploy.sh (UI)..."

  export IMAGE_TAG IBMCLOUD_API_KEY CE_REGION CE_RESOURCE_GROUP CE_PROJECT

  # shellcheck source=deployment/deploy.sh
  bash "${SCRIPT_DIR}/deploy.sh" $(sub_flags)
  success "deploy.sh exited cleanly"

  if [[ "${MODE}" != "build-only" ]]; then
    wait_for_ready "${UI_APP_NAME}" 180
    success "Frontend UI is live"
  fi
else
  warn "Skipping Frontend UI deploy (--skip-ui)"
fi

# =============================================================================
# FINAL SUMMARY
# =============================================================================
header "Deployment Summary"
echo ""

if [[ "${MODE}" != "build-only" ]]; then
  for entry in \
      "${INGEST_APP_NAME}:Ingestion Pipeline" \
      "${MCP_APP_NAME}:MCP Server" \
      "${UI_APP_NAME}:Frontend UI"; do
    app_name="${entry%%:*}"
    label="${entry##*:}"
    url_file="${SCRIPT_DIR}/.deploy-url-${app_name}"
    url=""
    if [[ -f "${url_file}" ]]; then
      url="$(cat "${url_file}" | tr -d '[:space:]')"
    fi
    if [[ -z "${url}" ]]; then
      url=$("${IBMCLOUD}" ce application get --name "${app_name}" \
        --output url 2>/dev/null | tr -d '[:space:]' || echo "(not deployed)")
    fi
    if [[ "${url}" == "(not deployed)" || -z "${url}" ]]; then
      warn "  ${label} (${app_name}): not deployed / skipped"
    else
      success "  ${label} (${app_name}): ${url}"
    fi
  done
fi

echo ""
success "Full-stack deploy complete."
echo ""
info "Logs saved to: ${LOG_FILE}"
