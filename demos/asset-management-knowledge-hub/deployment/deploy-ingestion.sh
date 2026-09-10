#!/usr/bin/env bash
# =============================================================================
# deploy-ingestion.sh — Maximo Knowledge Hub Ingestion Pipeline
#
# Builds the container image from deployment/Dockerfile.ingestion,
# pushes it to IBM Cloud Container Registry (ICR), and creates or
# updates the ingestion pipeline application on IBM Cloud Code Engine.
#
# USAGE
#   ./deployment/deploy-ingestion.sh [OPTIONS]
#
# OPTIONS
#   --build-only        Build and push the image, skip Code Engine deploy
#   --deploy-only       Skip build/push, re-deploy the existing image
#   --local             Build and run locally with Podman (no push/deploy)
#   --tag <tag>         Override the image tag          (default: latest)
#   --help              Print this help and exit
#
# REQUIRED ENV VARS (or set them in deployment/.env.deploy)
#   IBMCLOUD_API_KEY          IBM Cloud API key
#   OPENSEARCH_HOST           OpenSearch cluster URL  e.g. https://os.example.com:9200
#   OPENSEARCH_USERNAME       OpenSearch username
#   OPENSEARCH_PASSWORD       OpenSearch password
#   WATSONX_API_KEY           IBM watsonx AI API key
#   WATSONX_PROJECT_ID        watsonx project ID
#   COS_API_KEY               IBM Cloud Object Storage API key
#   COS_BUCKET_NAME           COS bucket name for document ingestion
#   COS_ENDPOINT              COS endpoint URL
#   COS_BUCKET_INSTANCE_CRN   COS service instance CRN
#   CORS_ORIGIN               Allowed CORS origin (the frontend's public URL)
#
# OPTIONAL ENV VARS
#   OPENSEARCH_INDEX          Index name               (default: maximo-documents)
#   OPENSEARCH_VERIFY_SSL     Verify TLS certs          (default: 0)
#   WATSONX_URL               watsonx service endpoint  (default: https://us-south.ml.cloud.ibm.com)
#   WATSONX_MODEL_ID           Generation model ID       (default: ibm/granite-3-8b-instruct)
#   WATSONX_EMBEDDING_MODEL_ID Embedding model ID        (default: ibm/slate-30m-english-rtrvr-v2)
#   COS_REGION                COS region                (default: us-south)
#   BACKEND_PORT              Ingestion API port        (default: 8080)
#
# DEFAULTS (pre-configured — no need to override unless changed)
#   ICR_REGISTRY       = de.icr.io
#   ICR_NAMESPACE      = maximo-kh
#   ICR_IMAGE_NAME     = ingestion-pipeline
#   CE_REGION          = eu-de
#   CE_RESOURCE_GROUP  = bentley-rg
#   CE_PROJECT         = bentley-integration-server
#   CE_APP_NAME        = ingestion-pipeline
#
# EXAMPLES
#   # Full build → push → deploy
#   export IBMCLOUD_API_KEY=your-api-key
#   export OPENSEARCH_HOST=https://opensearch.example.com:9200
#   export OPENSEARCH_USERNAME=admin
#   export OPENSEARCH_PASSWORD=<password>
#   export WATSONX_API_KEY=<your-wx-key>
#   export WATSONX_PROJECT_ID=your-project-id
#   export COS_API_KEY=your-cos-key
#   export COS_BUCKET_NAME=maximo-docs
#   export COS_ENDPOINT=https://s3.us-south.cloud-object-storage.appdomain.cloud
#   export COS_BUCKET_INSTANCE_CRN=crn:v1:bluemix:public:cloud-object-storage:...
#   export CORS_ORIGIN=https://maximo-knowledge-hub.<project>.eu-de.codeengine.appdomain.cloud
#   ./deployment/deploy-ingestion.sh
#
#   # Build + run locally in Podman (no IBM Cloud required)
#   ./deployment/deploy-ingestion.sh --local
# =============================================================================
set -euo pipefail

# ── Prevent Git Bash on Windows from mangling Unix paths ─────────────────────
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

# ── Script directory ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Logging — tee every run to a timestamped file in deployment/logs/ ─────────
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/deploy-ingestion-$(date '+%Y%m%d-%H%M%S').log"
if [[ -z "${LOG_FILE_ACTIVE:-}" ]]; then
  export LOG_FILE_ACTIVE="${LOG_FILE}"
  exec > >(tee -a "${LOG_FILE}") 2>&1
fi
echo "=== Deploy started at $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
echo "=== Log file: ${LOG_FILE} ==="

# ── Auto-load secrets from .env.deploy if present ────────────────────────────
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
if [[ -f "${ENV_FILE}" ]]; then
  set -o allexport; source "${ENV_FILE}"; set +o allexport
  echo -e "\033[0;36m[INFO]\033[0m  Loaded secrets from ${ENV_FILE}"
fi

# ── Auto-load secrets from .env.deploy.local if present ──────────────────────
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
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

# ── CONFIG ────────────────────────────────────────────────────────────────────
ICR_REGISTRY="${ICR_REGISTRY:-de.icr.io}"
ICR_NAMESPACE="${ICR_NAMESPACE:-maximo-kh}"
ICR_IMAGE_NAME="${ICR_IMAGE_NAME:-ingestion-pipeline}"
IBMCLOUD_API_KEY="${IBMCLOUD_API_KEY:-}"
CE_REGION="${CE_REGION:-eu-de}"
CE_RESOURCE_GROUP="${CE_RESOURCE_GROUP:-bentley-rg}"
CE_PROJECT="${CE_PROJECT:-bentley-integration-server}"
CE_APP_NAME="${CE_APP_NAME:-ingestion-pipeline}"
CE_PORT="${CE_PORT:-8080}"
CE_CPU="${CE_CPU:-1}"
CE_MEMORY="${CE_MEMORY:-2G}"
CE_MIN_SCALE="${CE_MIN_SCALE:-1}"
CE_MAX_SCALE="${CE_MAX_SCALE:-5}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
LOCAL_PORT="${LOCAL_PORT:-8081}"

# Runtime env vars injected into the running container
OPENSEARCH_HOST="${OPENSEARCH_HOST:-}"
OPENSEARCH_USERNAME="${OPENSEARCH_USERNAME:-}"
OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-}"
OPENSEARCH_INDEX="${OPENSEARCH_INDEX:-maximo-documents}"
OPENSEARCH_VERIFY_SSL="${OPENSEARCH_VERIFY_SSL:-0}"
WATSONX_API_KEY="${WATSONX_API_KEY:-}"
WATSONX_PROJECT_ID="${WATSONX_PROJECT_ID:-}"
WATSONX_URL="${WATSONX_URL:-https://us-south.ml.cloud.ibm.com}"
WATSONX_MODEL_ID="${WATSONX_MODEL_ID:-ibm/granite-3-8b-instruct}"
WATSONX_EMBEDDING_MODEL_ID="${WATSONX_EMBEDDING_MODEL_ID:-ibm/slate-30m-english-rtrvr-v2}"
COS_API_KEY="${COS_API_KEY:-}"
COS_BUCKET_NAME="${COS_BUCKET_NAME:-}"
COS_ENDPOINT="${COS_ENDPOINT:-}"
COS_BUCKET_INSTANCE_CRN="${COS_BUCKET_INSTANCE_CRN:-}"
COS_REGION="${COS_REGION:-us-south}"
# COS HMAC credentials (optional — only needed for S3-compatible ingestion path)
COS_HMAC_ACCESS_KEY_ID="${COS_HMAC_ACCESS_KEY_ID:-}"
COS_HMAC_SECRET_ACCESS_KEY="${COS_HMAC_SECRET_ACCESS_KEY:-}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
CORS_ORIGIN="${CORS_ORIGIN:-}"
# Confluent / Apache Kafka (optional — leave blank to disable Kafka ingestion)
KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-}"
KAFKA_SECURITY_PROTOCOL="${KAFKA_SECURITY_PROTOCOL:-SASL_SSL}"
KAFKA_SASL_MECHANISM="${KAFKA_SASL_MECHANISM:-PLAIN}"
KAFKA_API_KEY="${KAFKA_API_KEY:-}"
KAFKA_API_SECRET="${KAFKA_API_SECRET:-}"
KAFKA_TOPICS="${KAFKA_TOPICS:-}"
KAFKA_GROUP_ID="${KAFKA_GROUP_ID:-maximo-knowledge-hub}"
SCHEMA_REGISTRY_URL="${SCHEMA_REGISTRY_URL:-}"
SCHEMA_REGISTRY_API_KEY="${SCHEMA_REGISTRY_API_KEY:-}"
SCHEMA_REGISTRY_API_SECRET="${SCHEMA_REGISTRY_API_SECRET:-}"

# ── Flags ─────────────────────────────────────────────────────────────────────
MODE="full"

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

# ── Repo root ─────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
  if command -v cygpath &>/dev/null; then
    REPO_ROOT="$(cygpath -m "${REPO_ROOT}")"
  elif pwd -W &>/dev/null; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -W)"
  fi
fi
info "Repo root: ${REPO_ROOT}"

# ── Detect container runtime ──────────────────────────────────────────────────
if command -v podman &>/dev/null; then
  RUNTIME="podman"
elif command -v docker &>/dev/null; then
  RUNTIME="docker"
else
  error "Neither podman nor docker found. Please install one."
fi
info "Container runtime: ${RUNTIME}"

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

# ── Helper: require a non-empty variable ─────────────────────────────────────
require_var() {
  local name="$1" value="$2"
  [[ -n "$value" ]] || error "${name} is not set. Export it or add it to ${ENV_FILE}."
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

  local image="${ICR_IMAGE_NAME}:local"
  local container_name="${CE_APP_NAME}"

  if ${RUNTIME} ps -a --format "{{.Names}}" 2>/dev/null | grep -q "^${container_name}$"; then
    warn "Stopping existing container '${container_name}'..."
    ${RUNTIME} stop "${container_name}" &>/dev/null || true
    ${RUNTIME} rm   "${container_name}" &>/dev/null || true
  fi

  info "Building image → ${image}"
  ${RUNTIME} build \
    --file "${REPO_ROOT}/deployment/Dockerfile.ingestion" \
    --tag  "${image}" \
    "${REPO_ROOT}"

  info "Starting container on http://localhost:${LOCAL_PORT}"
  ${RUNTIME} run -d \
    -p "${LOCAL_PORT}:8080" \
    -e OPENSEARCH_HOST="${OPENSEARCH_HOST:-https://host.containers.internal:9200}" \
    -e OPENSEARCH_USERNAME="${OPENSEARCH_USERNAME:-admin}" \
    -e OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-admin}" \
    -e OPENSEARCH_INDEX="${OPENSEARCH_INDEX}" \
    -e OPENSEARCH_VERIFY_SSL="${OPENSEARCH_VERIFY_SSL}" \
    -e WATSONX_API_KEY="${WATSONX_API_KEY:-}" \
    -e WATSONX_PROJECT_ID="${WATSONX_PROJECT_ID:-}" \
    -e WATSONX_URL="${WATSONX_URL}" \
    -e WATSONX_MODEL_ID="${WATSONX_MODEL_ID}" \
    -e WATSONX_EMBEDDING_MODEL_ID="${WATSONX_EMBEDDING_MODEL_ID}" \
    -e COS_API_KEY="${COS_API_KEY:-}" \
    -e COS_BUCKET_NAME="${COS_BUCKET_NAME:-}" \
    -e COS_ENDPOINT="${COS_ENDPOINT:-}" \
    -e COS_BUCKET_INSTANCE_CRN="${COS_BUCKET_INSTANCE_CRN:-}" \
    -e COS_REGION="${COS_REGION}" \
    -e COS_HMAC_ACCESS_KEY_ID="${COS_HMAC_ACCESS_KEY_ID:-}" \
    -e COS_HMAC_SECRET_ACCESS_KEY="${COS_HMAC_SECRET_ACCESS_KEY:-}" \
    -e BACKEND_PORT="${BACKEND_PORT}" \
    -e CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3002}" \
    -e KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-}" \
    -e KAFKA_SECURITY_PROTOCOL="${KAFKA_SECURITY_PROTOCOL}" \
    -e KAFKA_SASL_MECHANISM="${KAFKA_SASL_MECHANISM}" \
    -e KAFKA_API_KEY="${KAFKA_API_KEY:-}" \
    -e KAFKA_API_SECRET="${KAFKA_API_SECRET:-}" \
    -e KAFKA_TOPICS="${KAFKA_TOPICS:-}" \
    -e KAFKA_GROUP_ID="${KAFKA_GROUP_ID}" \
    -e SCHEMA_REGISTRY_URL="${SCHEMA_REGISTRY_URL:-}" \
    -e SCHEMA_REGISTRY_API_KEY="${SCHEMA_REGISTRY_API_KEY:-}" \
    -e SCHEMA_REGISTRY_API_SECRET="${SCHEMA_REGISTRY_API_SECRET:-}" \
    --name "${container_name}" \
    "${image}"

  sleep 2
  local status
  status=$(${RUNTIME} inspect "${container_name}" --format "{{.State.Status}}" 2>/dev/null)
  if [[ "$status" == "running" ]]; then
    success "Container is running — Ingestion Pipeline at http://localhost:${LOCAL_PORT}"
    info    "Health endpoint: curl http://localhost:${LOCAL_PORT}/health"
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

  local full_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/${ICR_IMAGE_NAME}:${IMAGE_TAG}"
  local local_image="${ICR_IMAGE_NAME}:${IMAGE_TAG}"

  # ── Scrub stale ICR tags ──────────────────────────────────────────────────
  for stale in \
      "private.${ICR_REGISTRY}/${ICR_NAMESPACE}/${ICR_IMAGE_NAME}:${IMAGE_TAG}" \
      "${ICR_REGISTRY}/${ICR_NAMESPACE}/${ICR_IMAGE_NAME}:${IMAGE_TAG}"; do
    if ${RUNTIME} image exists "${stale}" 2>/dev/null; then
      info "Removing stale tag: ${stale}"
      ${RUNTIME} rmi "${stale}" 2>/dev/null || true
    fi
  done

  # ── Build ──
  info "Building image → ${local_image}"
  ${RUNTIME} build \
    --file "${REPO_ROOT}/deployment/Dockerfile.ingestion" \
    --tag  "${local_image}" \
    "${REPO_ROOT}"
  success "Build complete"

  # ── Log in to IBM Cloud ──
  info "Logging in to IBM Cloud (region: ${CE_REGION}, resource group: ${CE_RESOURCE_GROUP})"
  "${IBMCLOUD}" login \
    --apikey "${IBMCLOUD_API_KEY}" \
    -r       "${CE_REGION}" \
    -g       "${CE_RESOURCE_GROUP}" \
    --quiet  || error "ibmcloud login failed"

  info "Logging in to IBM Container Registry (${ICR_REGISTRY})"
  "${IBMCLOUD}" cr region-set "${CE_REGION}" || error "ibmcloud cr region-set failed"
  "${IBMCLOUD}" cr login || error "ibmcloud cr login failed"

  # ── Ensure ICR namespace exists ──
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

  require_var "ICR_NAMESPACE"          "${ICR_NAMESPACE}"
  require_var "IBMCLOUD_API_KEY"       "${IBMCLOUD_API_KEY}"
  require_var "CE_PROJECT"             "${CE_PROJECT}"
  require_var "OPENSEARCH_HOST"        "${OPENSEARCH_HOST}"
  require_var "OPENSEARCH_USERNAME"    "${OPENSEARCH_USERNAME}"
  require_var "OPENSEARCH_PASSWORD"    "${OPENSEARCH_PASSWORD}"
  require_var "WATSONX_API_KEY"        "${WATSONX_API_KEY}"
  require_var "WATSONX_PROJECT_ID"     "${WATSONX_PROJECT_ID}"
  require_var "COS_API_KEY"            "${COS_API_KEY}"
  require_var "COS_BUCKET_NAME"        "${COS_BUCKET_NAME}"
  require_var "COS_ENDPOINT"           "${COS_ENDPOINT}"
  require_var "COS_BUCKET_INSTANCE_CRN" "${COS_BUCKET_INSTANCE_CRN}"
  require_var "CORS_ORIGIN"            "${CORS_ORIGIN}"

  local full_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/${ICR_IMAGE_NAME}:${IMAGE_TAG}"

  if ! "${IBMCLOUD}" account show &>/dev/null; then
    info "Logging in to IBM Cloud (region: ${CE_REGION}, resource group: ${CE_RESOURCE_GROUP})"
    "${IBMCLOUD}" login \
      --apikey "${IBMCLOUD_API_KEY}" \
      -r       "${CE_REGION}" \
      -g       "${CE_RESOURCE_GROUP}" \
      --quiet  || error "ibmcloud login failed"
  fi

  info "Selecting Code Engine project: ${CE_PROJECT}"
  "${IBMCLOUD}" ce project select --name "${CE_PROJECT}" \
    || error "Could not select project '${CE_PROJECT}'. Does it exist in ${CE_REGION}, ${CE_RESOURCE_GROUP}?"

  # ── Ensure ICR pull secret exists ────────────────────────────────────────
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

  # ── Ensure CE generic secret exists for app credentials ──────────────────
  # Storing all secrets in a CE generic secret keeps them out of revision
  # history and ibmcloud CLI output. The secret is created or fully replaced
  # on every deploy so any rotated credentials take effect immediately.
  local env_secret="${CE_APP_NAME}-secrets"
  info "Creating/replacing CE generic secret '${env_secret}'..."
  "${IBMCLOUD}" ce secret delete --name "${env_secret}" --force &>/dev/null || true
  "${IBMCLOUD}" ce secret create \
    --name    "${env_secret}" \
    --format  "generic" \
    --from-literal "OPENSEARCH_HOST=${OPENSEARCH_HOST}" \
    --from-literal "OPENSEARCH_USERNAME=${OPENSEARCH_USERNAME}" \
    --from-literal "OPENSEARCH_PASSWORD=${OPENSEARCH_PASSWORD}" \
    --from-literal "OPENSEARCH_INDEX=${OPENSEARCH_INDEX}" \
    --from-literal "OPENSEARCH_VERIFY_SSL=${OPENSEARCH_VERIFY_SSL}" \
    --from-literal "WATSONX_API_KEY=${WATSONX_API_KEY}" \
    --from-literal "WATSONX_PROJECT_ID=${WATSONX_PROJECT_ID}" \
    --from-literal "WATSONX_URL=${WATSONX_URL}" \
    --from-literal "WATSONX_MODEL_ID=${WATSONX_MODEL_ID}" \
    --from-literal "WATSONX_EMBEDDING_MODEL_ID=${WATSONX_EMBEDDING_MODEL_ID}" \
    --from-literal "COS_API_KEY=${COS_API_KEY}" \
    --from-literal "COS_BUCKET_NAME=${COS_BUCKET_NAME}" \
    --from-literal "COS_ENDPOINT=${COS_ENDPOINT}" \
    --from-literal "COS_BUCKET_INSTANCE_CRN=${COS_BUCKET_INSTANCE_CRN}" \
    --from-literal "COS_REGION=${COS_REGION}" \
    --from-literal "COS_HMAC_ACCESS_KEY_ID=${COS_HMAC_ACCESS_KEY_ID}" \
    --from-literal "COS_HMAC_SECRET_ACCESS_KEY=${COS_HMAC_SECRET_ACCESS_KEY}" \
    --from-literal "BACKEND_PORT=${BACKEND_PORT}" \
    --from-literal "CORS_ORIGIN=${CORS_ORIGIN}" \
    --from-literal "KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS}" \
    --from-literal "KAFKA_SECURITY_PROTOCOL=${KAFKA_SECURITY_PROTOCOL}" \
    --from-literal "KAFKA_SASL_MECHANISM=${KAFKA_SASL_MECHANISM}" \
    --from-literal "KAFKA_API_KEY=${KAFKA_API_KEY}" \
    --from-literal "KAFKA_API_SECRET=${KAFKA_API_SECRET}" \
    --from-literal "KAFKA_TOPICS=${KAFKA_TOPICS}" \
    --from-literal "KAFKA_GROUP_ID=${KAFKA_GROUP_ID}" \
    --from-literal "SCHEMA_REGISTRY_URL=${SCHEMA_REGISTRY_URL}" \
    --from-literal "SCHEMA_REGISTRY_API_KEY=${SCHEMA_REGISTRY_API_KEY}" \
    --from-literal "SCHEMA_REGISTRY_API_SECRET=${SCHEMA_REGISTRY_API_SECRET}" \
    || error "Failed to create CE generic secret '${env_secret}'"
  success "CE generic secret '${env_secret}' ready"

  # ── Create or update the application ─────────────────────────────────────
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

  # Wait until CE confirms the app is healthy before returning the URL
  wait_for_ready "${CE_APP_NAME}"

  local app_url
  app_url=$("${IBMCLOUD}" ce application get --name "${CE_APP_NAME}" --output url 2>/dev/null || true)
  if [[ -n "${app_url}" ]]; then
    success "Live URL: ${app_url}"
  else
    info "Run '${IBMCLOUD} ce application get --name ${CE_APP_NAME} --output url' to get the URL."
  fi

  # Write URL to a temp file so the orchestrator can read it
  if [[ -n "${app_url}" ]]; then
    local url_file="${SCRIPT_DIR}/.deploy-url-ingestion-pipeline"
    echo "${app_url}" > "${url_file}"
    info "URL written to ${url_file}"
  fi
}

# =============================================================================
# MAIN
# =============================================================================
header "Maximo Knowledge Hub — Ingestion Pipeline Deploy"
info "Mode: ${MODE} | Tag: ${IMAGE_TAG}"

case "${MODE}" in
  local)        run_local ;;
  build-only)   build_and_push ;;
  deploy-only)  deploy_to_ce ;;
  full)         build_and_push; deploy_to_ce ;;
esac

success "Done."
