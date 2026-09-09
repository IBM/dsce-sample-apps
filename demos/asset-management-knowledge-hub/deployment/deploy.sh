#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Maximo Knowledge Hub Frontend (UI only)
#
# Builds the frontend container image (nginx + Vite SPA), pushes it to IBM
# Cloud Container Registry (ICR), and creates or updates the frontend
# application on IBM Cloud Code Engine.
#
# NOTE: This script deploys the UI only. To deploy the full stack in the
# correct dependency order (Ingestion → MCP Server → UI), use:
#   ./deployment/deploy-all.sh
#
# Individual service scripts:
#   ./deployment/deploy-ingestion.sh   — Ingestion Pipeline
#   ./deployment/deploy-mcp-server.sh  — MCP Server
#   ./deployment/deploy.sh             — Frontend UI  (this script)
#
# USAGE
#   ./deployment/deploy.sh [OPTIONS]
#
# OPTIONS
#   --build-only        Build and push the image, skip Code Engine deploy
#   --deploy-only       Skip build/push, re-deploy the existing image
#   --local             Build and run locally with Podman (no push/deploy)
#   --tag <tag>         Override the image tag          (default: latest)
#   --help              Print this help and exit
#
# REQUIRED ENV VARS (or set them in deployment/.env.deploy)
#   IBMCLOUD_API_KEY      IBM Cloud API key
#   BACKEND_API_URL       MCP server URL deployed on Code Engine
#   INGEST_API_URL        Ingestion pipeline URL deployed on Code Engine
#   OPENSEARCH_URL        OpenSearch cluster URL
#
# DEFAULTS (pre-configured — no need to override unless changed)
#   ICR_REGISTRY       = de.icr.io  (public endpoint — use private.de.icr.io only inside IBM Cloud network)
#   ICR_NAMESPACE      = maximo-kh
#   CE_REGION          = eu-de
#   CE_RESOURCE_GROUP  = bentley-rg
#   CE_PROJECT         = bentley-integration-server
#   CE_APP_NAME        = maximo-knowledge-hub
#
# EXAMPLES
#   # Full build → push → deploy
#   export IBMCLOUD_API_KEY=your-api-key
#   export BACKEND_API_URL=https://mcp-server.<project>.eu-de.codeengine.appdomain.cloud
#   export INGEST_API_URL=https://ingestion-pipeline.<project>.eu-de.codeengine.appdomain.cloud
#   export OPENSEARCH_URL=https://opensearch.example.com:9200
#   ./deployment/deploy.sh
#
#   # Build + run locally in Podman (no IBM Cloud required)
#   ./deployment/deploy.sh --local
# =============================================================================
set -euo pipefail

# ── Prevent Git Bash on Windows from mangling Unix paths ─────────────────────
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

# ── Script directory (works regardless of where the script is called from) ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Logging — tee every run to a timestamped file in deployment/logs/ ────────
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/deploy-$(date '+%Y%m%d-%H%M%S').log"
# Re-exec with tee so stdout+stderr both go to console AND the log file.
# Only do this on the first exec (LOG_FILE_ACTIVE not yet set).
if [[ -z "${LOG_FILE_ACTIVE:-}" ]]; then
  export LOG_FILE_ACTIVE="${LOG_FILE}"
  exec > >(tee -a "${LOG_FILE}") 2>&1
fi
echo "=== Deploy started at $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
echo "=== Log file: ${LOG_FILE} ==="

# ── Auto-load secrets from .env.deploy if present ────────────────────────────
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  set -o allexport; source "${ENV_FILE}"; set +o allexport
  echo -e "\033[0;36m[INFO]\033[0m  Loaded secrets from ${ENV_FILE}"
fi

# ── Auto-load secrets from .env.deploy.local if present ──────────────────────
ENV_LOCAL_FILE="${SCRIPT_DIR}/.env.deploy.local"
if [[ -f "${ENV_LOCAL_FILE}" ]]; then
  # shellcheck source=/dev/null
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
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

# ── CONFIG — override via env vars or edit directly ───────────────────────────
ICR_REGISTRY="${ICR_REGISTRY:-de.icr.io}"
ICR_NAMESPACE="${ICR_NAMESPACE:-maximo-kh}"
IBMCLOUD_API_KEY="${IBMCLOUD_API_KEY:-}"
CE_REGION="${CE_REGION:-eu-de}"
CE_RESOURCE_GROUP="${CE_RESOURCE_GROUP:-bentley-rg}"
CE_PROJECT="${CE_PROJECT:-bentley-integration-server}"
CE_APP_NAME="${CE_APP_NAME:-maximo-knowledge-hub}"
CE_PORT="${CE_PORT:-8080}"
CE_CPU="${CE_CPU:-0.5}"
CE_MEMORY="${CE_MEMORY:-1G}"
CE_MIN_SCALE="${CE_MIN_SCALE:-1}"
CE_MAX_SCALE="${CE_MAX_SCALE:-3}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
LOCAL_PORT="${LOCAL_PORT:-3003}"

# Backend runtime env vars injected into the running container
BACKEND_API_URL="${BACKEND_API_URL:-}"
INGEST_API_URL="${INGEST_API_URL:-}"
OPENSEARCH_URL="${OPENSEARCH_URL:-}"

# ── Flags ─────────────────────────────────────────────────────────────────────
MODE="full"          # full | build-only | deploy-only | local

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only)  MODE="build-only"  ; shift ;;
    --deploy-only) MODE="deploy-only" ; shift ;;
    --local)       MODE="local"       ; shift ;;
    --tag)         IMAGE_TAG="$2"     ; shift 2 ;;
    --help)
      sed -n '/^# USAGE/,/^# =/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) error "Unknown option: $1. Run with --help for usage." ;;
  esac
done

# ── Repo root (script is in deployment/, run from anywhere) ───────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
  if command -v cygpath &>/dev/null; then
    REPO_ROOT="$(cygpath -m "${REPO_ROOT}")"
  elif pwd -W &>/dev/null; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -W)"
  fi
fi
info "Repo root: ${REPO_ROOT}"

# ── Detect container runtime (podman preferred, docker fallback) ──────────────
if command -v podman &>/dev/null; then
  RUNTIME="podman"
elif command -v docker &>/dev/null; then
  RUNTIME="docker"
else
  error "Neither podman nor docker found. Please install one."
fi
info "Container runtime: ${RUNTIME}"

# ── Detect ibmcloud CLI (native or via Windows .exe from WSL) ────────────────
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

# ── Helper: require a non-empty variable ─────────────────────────────────────
require_var() {
  local name="$1" value="$2"
  [[ -n "$value" ]] || error "${name} is not set. Export it or edit the CONFIG section in deploy.sh."
}

# ── Helper: poll CE until the app reaches "ready" status ─────────────────────
# Usage: wait_for_ready <app_name> [max_wait_seconds]
#
# NOTE: ibmcloud ce application get --output json places "type":"Ready" and
# "status":"True" on SEPARATE lines, so a single-line grep never matches.
# Use plain-text output and look for the "Ready    true" Conditions line instead.
wait_for_ready() {
  local app_name="$1"
  local max_wait="${2:-300}"
  local interval=15
  local elapsed=0

  info "Waiting for '${app_name}' to become ready (max ${max_wait}s)..."
  while [[ ${elapsed} -lt ${max_wait} ]]; do
    local ready
    ready=$("${IBMCLOUD}" ce application get --name "${app_name}" 2>/dev/null \
      | grep -i "^  Ready" | grep -i "true" || true)
    if [[ -n "${ready}" ]]; then
      success "'${app_name}' is ready"
      return 0
    fi
    info "  status check (${elapsed}s elapsed) — not ready yet, retrying in ${interval}s..."
    sleep "${interval}"
    elapsed=$(( elapsed + interval ))
  done
  error "'${app_name}' did not reach ready state within ${max_wait}s. Check CE logs."
}

# =============================================================================
# STEP 1 — LOCAL MODE
# =============================================================================
run_local() {
  header "Local Podman test"

  local image="maximo-frontend:local"
  local container_name="${CE_APP_NAME}"

  # Stop + remove any existing container with the same name
  if ${RUNTIME} ps -a --format "{{.Names}}" 2>/dev/null | grep -q "^${container_name}$"; then
    warn "Stopping existing container '${container_name}'..."
    ${RUNTIME} stop "${container_name}" &>/dev/null || true
    ${RUNTIME} rm   "${container_name}" &>/dev/null || true
  fi

  info "Building image → ${image}"
  ${RUNTIME} build \
    --file "${REPO_ROOT}/deployment/Dockerfile" \
    --tag  "${image}" \
    "${REPO_ROOT}"

  info "Starting container on http://localhost:${LOCAL_PORT}"
  ${RUNTIME} run -d \
    -p "${LOCAL_PORT}:8080" \
    -e BACKEND_API_URL="${BACKEND_API_URL:-http://host.containers.internal:6868}" \
    -e INGEST_API_URL="${INGEST_API_URL:-http://host.containers.internal:8080}" \
    -e OPENSEARCH_URL="${OPENSEARCH_URL:-https://host.containers.internal:9200}" \
    --name "${container_name}" \
    "${image}"

  sleep 2
  local status
  status=$(${RUNTIME} inspect "${container_name}" --format "{{.State.Status}}" 2>/dev/null)
  if [[ "$status" == "running" ]]; then
    success "Container is running — open http://localhost:${LOCAL_PORT}"
    info    "Health endpoint: curl http://localhost:${LOCAL_PORT}/nginx-health"
    info    "Logs:            ${RUNTIME} logs -f ${container_name}"
    info    "Stop:            ${RUNTIME} stop ${container_name}"
  else
    ${RUNTIME} logs "${container_name}" || true
    error "Container failed to start (status: ${status})"
  fi
}

# =============================================================================
# STEP 2 — BUILD + PUSH TO ICR
# =============================================================================
build_and_push() {
  header "Build & push to IBM Container Registry"

  require_var "ICR_NAMESPACE"   "${ICR_NAMESPACE}"
  require_var "IBMCLOUD_API_KEY" "${IBMCLOUD_API_KEY}"

  local full_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/${CE_APP_NAME}:${IMAGE_TAG}"
  local local_image="${CE_APP_NAME}:${IMAGE_TAG}"

  # ── Scrub any stale ICR tags from previous runs before building ──────────────
  # Podman re-applies all existing tags when reusing cached layers, so a tag
  # from a previous run (e.g. private.de.icr.io/...) will silently carry over
  # into the new build unless we remove it first.
  for stale in \
      "private.${ICR_REGISTRY}/${ICR_NAMESPACE}/${CE_APP_NAME}:${IMAGE_TAG}" \
      "${ICR_REGISTRY}/${ICR_NAMESPACE}/${CE_APP_NAME}:${IMAGE_TAG}"; do
    if ${RUNTIME} image exists "${stale}" 2>/dev/null; then
      info "Removing stale tag: ${stale}"
      ${RUNTIME} rmi "${stale}" 2>/dev/null || true
    fi
  done

  # ── Build ──
  info "Building image → ${local_image}"
  ${RUNTIME} build \
    --file "${REPO_ROOT}/deployment/Dockerfile" \
    --tag  "${local_image}" \
    "${REPO_ROOT}"
  success "Build complete"

  # ── Log in to ICR ──
  info "Logging in to IBM Cloud (region: ${CE_REGION}, resource group: ${CE_RESOURCE_GROUP})"
  "${IBMCLOUD}" login \
    --apikey "${IBMCLOUD_API_KEY}" \
    -r       "${CE_REGION}" \
    -g       "${CE_RESOURCE_GROUP}" \
    --quiet  || error "ibmcloud login failed"

  info "Logging in to IBM Container Registry (${ICR_REGISTRY})"
  "${IBMCLOUD}" cr region-set "${CE_REGION}" || error "ibmcloud cr region-set failed"
  "${IBMCLOUD}" cr login || error "ibmcloud cr login failed"

  # ── Ensure ICR namespace exists (creates it if missing, no-op if already present) ──
  if ! "${IBMCLOUD}" cr namespace-list 2>/dev/null | grep -qw "${ICR_NAMESPACE}"; then
    info "ICR namespace '${ICR_NAMESPACE}' not found — creating..."
    "${IBMCLOUD}" cr namespace-add "${ICR_NAMESPACE}" \
      || error "Failed to create ICR namespace '${ICR_NAMESPACE}'"
    success "ICR namespace '${ICR_NAMESPACE}' created"
  else
    info "ICR namespace '${ICR_NAMESPACE}' already exists"
  fi

  # ── Tag + push ──
  info "Tagging → ${full_image}"
  ${RUNTIME} tag "${local_image}" "${full_image}"

  info "Pushing → ${full_image}"
  ${RUNTIME} push "${full_image}"
  success "Image pushed: ${full_image}"
}

# =============================================================================
# STEP 3 — DEPLOY TO CODE ENGINE
# =============================================================================
deploy_to_ce() {
  header "Deploy to IBM Code Engine"

  require_var "ICR_NAMESPACE"   "${ICR_NAMESPACE}"
  require_var "IBMCLOUD_API_KEY" "${IBMCLOUD_API_KEY}"
  require_var "CE_PROJECT"       "${CE_PROJECT}"
  require_var "BACKEND_API_URL"  "${BACKEND_API_URL}"
  require_var "INGEST_API_URL"   "${INGEST_API_URL}"
  require_var "OPENSEARCH_URL"   "${OPENSEARCH_URL}"

  local full_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/${CE_APP_NAME}:${IMAGE_TAG}"

  # Ensure logged in (may already be from build_and_push)
  if ! "${IBMCLOUD}" account show &>/dev/null; then
    info "Logging in to IBM Cloud (region: ${CE_REGION}, resource group: ${CE_RESOURCE_GROUP})"
    "${IBMCLOUD}" login \
      --apikey "${IBMCLOUD_API_KEY}" \
      -r       "${CE_REGION}" \
      -g       "${CE_RESOURCE_GROUP}" \
      --quiet  || error "ibmcloud login failed"
  fi

  info "Selecting Code Engine project: ${CE_PROJECT} (resource group: ${CE_RESOURCE_GROUP})"
  "${IBMCLOUD}" ce project select --name "${CE_PROJECT}" \
    || error "Could not select project '${CE_PROJECT}'. Does it exist in region ${CE_REGION}, resource group ${CE_RESOURCE_GROUP}?"

  # ── Ensure ICR pull secret exists in Code Engine ─────────────────────────────
  local icr_secret="icr-${ICR_NAMESPACE}"
  if ! "${IBMCLOUD}" ce secret get --name "${icr_secret}" &>/dev/null; then
    info "Registry pull secret '${icr_secret}' not found — creating..."
    "${IBMCLOUD}" ce secret create \
      --name     "${icr_secret}" \
      --format   "registry" \
      --server   "${ICR_REGISTRY}" \
      --username "iamapikey" \
      --password "${IBMCLOUD_API_KEY}" \
      || error "Failed to create registry pull secret '${icr_secret}'"
    success "Registry pull secret '${icr_secret}' created"
  else
    info "Registry pull secret '${icr_secret}' already exists"
  fi

  # ── Ensure CE generic secret exists for nginx proxy targets ──────────────────
  # Storing proxy URLs in a CE generic secret keeps them out of revision history.
  # The secret is created or fully replaced on every deploy so any URL changes
  # (e.g. after redeploying a backend) take effect immediately.
  local env_secret="${CE_APP_NAME}-secrets"
  info "Creating/replacing CE generic secret '${env_secret}'..."
  "${IBMCLOUD}" ce secret delete --name "${env_secret}" --force &>/dev/null || true
  "${IBMCLOUD}" ce secret create \
    --name    "${env_secret}" \
    --format  "generic" \
    --from-literal "BACKEND_API_URL=${BACKEND_API_URL}" \
    --from-literal "INGEST_API_URL=${INGEST_API_URL}" \
    --from-literal "OPENSEARCH_URL=${OPENSEARCH_URL}" \
    || error "Failed to create CE generic secret '${env_secret}'"
  success "CE generic secret '${env_secret}' ready"

  # Check if app already exists → update vs create
  if "${IBMCLOUD}" ce application get --name "${CE_APP_NAME}" &>/dev/null; then
    info "Application '${CE_APP_NAME}' exists — updating..."
    "${IBMCLOUD}" ce application update \
      --name              "${CE_APP_NAME}" \
      --image             "${full_image}" \
      --env-from-secret   "${env_secret}" \
      || error "application update failed"
    success "Application updated"
  else
    info "Application '${CE_APP_NAME}' not found — creating..."
    "${IBMCLOUD}" ce application create \
      --name              "${CE_APP_NAME}" \
      --image             "${full_image}" \
      --registry-secret   "${icr_secret}" \
      --port              "${CE_PORT}" \
      --cpu               "${CE_CPU}" \
      --memory            "${CE_MEMORY}" \
      --min-scale         "${CE_MIN_SCALE}" \
      --max-scale         "${CE_MAX_SCALE}" \
      --env-from-secret   "${env_secret}" \
      || error "application create failed"
    success "Application created"
  fi

  # Wait until CE confirms the UI app is healthy
  wait_for_ready "${CE_APP_NAME}"

  # Print the live URL
  local app_url
  app_url=$("${IBMCLOUD}" ce application get --name "${CE_APP_NAME}" --output url 2>/dev/null || true)
  if [[ -n "${app_url}" ]]; then
    success "Live URL: ${app_url}"
  else
    info "Run '${IBMCLOUD} ce application get --name ${CE_APP_NAME} --output url' to get the URL."
  fi

  # Write URL to a temp file for reference
  if [[ -n "${app_url}" ]]; then
    local url_file="${SCRIPT_DIR}/.deploy-url-ui"
    echo "${app_url}" > "${url_file}"
    info "URL written to ${url_file}"
  fi
}

# =============================================================================
# MAIN
# =============================================================================
header "Maximo Knowledge Hub — Frontend UI Deploy"
info "Mode: ${MODE} | Tag: ${IMAGE_TAG}"

case "${MODE}" in
  local)        run_local ;;
  build-only)   build_and_push ;;
  deploy-only)  deploy_to_ce ;;
  full)         build_and_push; deploy_to_ce ;;
esac

success "Done."
