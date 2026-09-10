#!/usr/bin/env bash
# =============================================================================
# logs.sh — Stream logs for the Maximo Knowledge Hub on IBM Cloud Code Engine
#
# USAGE
#   ./deployment/logs.sh [--follow] [--tail <n>]
#
# OPTIONS
#   --follow      Keep streaming new log lines (default: off)
#   --tail <n>    Number of recent lines to show  (default: 100)
#   --help        Print this help and exit
#
# REQUIRED ENV VAR
#   IBMCLOUD_API_KEY   IBM Cloud API key
# =============================================================================
set -euo pipefail

# ── Config (must match deploy.sh) ────────────────────────────────────────────
CE_REGION="${CE_REGION:-eu-de}"
CE_RESOURCE_GROUP="${CE_RESOURCE_GROUP:-bentley-rg}"
CE_PROJECT="${CE_PROJECT:-bentley-integration-server}"
CE_APP_NAME="${CE_APP_NAME:-maximo-knowledge-hub}"
IBMCLOUD_API_KEY="${IBMCLOUD_API_KEY:-}"

# ── Auto-load .env.deploy / .env.deploy.local if present ─────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for env_file in "${SCRIPT_DIR}/.env.deploy" "${SCRIPT_DIR}/.env.deploy.local"; do
  if [[ -f "${env_file}" ]]; then
    set -o allexport; source "${env_file}"; set +o allexport
  fi
done

# ── Colours ───────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
error() { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

# ── Flags ─────────────────────────────────────────────────────────────────────
FOLLOW=false
TAIL=100

while [[ $# -gt 0 ]]; do
  case "$1" in
    --follow)  FOLLOW=true  ; shift ;;
    --tail)    TAIL="$2"    ; shift 2 ;;
    --help)
      sed -n '/^# USAGE/,/^# =/p' "$0" | sed 's/^# \?//'; exit 0 ;;
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

# ── Require API key ───────────────────────────────────────────────────────────
[[ -n "${IBMCLOUD_API_KEY}" ]] \
  || error "IBMCLOUD_API_KEY is not set. Export it or add it to deployment/.env.deploy"

# ── Login + select project ────────────────────────────────────────────────────
info "Logging in to IBM Cloud (region: ${CE_REGION}, resource group: ${CE_RESOURCE_GROUP})"
"${IBMCLOUD}" login \
  --apikey "${IBMCLOUD_API_KEY}" \
  -r       "${CE_REGION}" \
  -g       "${CE_RESOURCE_GROUP}" \
  --quiet  || error "ibmcloud login failed"

info "Selecting Code Engine project: ${CE_PROJECT}"
"${IBMCLOUD}" ce project select --name "${CE_PROJECT}" \
  || error "Could not select project '${CE_PROJECT}'"

# ── Stream logs ───────────────────────────────────────────────────────────────
LOG_ARGS=(--name "${CE_APP_NAME}" --tail "${TAIL}")
[[ "${FOLLOW}" == true ]] && LOG_ARGS+=(--follow)

ok "Fetching logs for '${CE_APP_NAME}' (tail=${TAIL}, follow=${FOLLOW})"
"${IBMCLOUD}" ce application logs "${LOG_ARGS[@]}"
