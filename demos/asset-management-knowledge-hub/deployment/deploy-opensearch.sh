#!/usr/bin/env bash
# =============================================================================
# deploy-opensearch.sh — Maximo Knowledge Hub OpenSearch on IBM Code Engine
#
# Deploys the OpenSearch 2.11.0 container to IBM Cloud Code Engine using
# ephemeral storage (no persistent volume mount). Index data is rebuilt by
# the ingestion pipeline after each deploy — see deploy-ingestion.sh.
#
# WHY NO VOLUME:
#   The OpenSearch security plugin writes the .opendistro_security index on
#   first boot. With a COS/s3fs persistent data store, each write takes ~23–43s
#   causing the security init thread to time out and loop forever. Using
#   ephemeral (local) storage gives instant writes so security auto-inits
#   cleanly — exactly how the local Podman container works.
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  Architecture                                                           │
# │                                                                         │
# │  IBM Code Engine — two CE Apps in the same project                      │
# │                                                                         │
# │  ┌───────────────────────────────────────┐                             │
# │  │  maximo-opensearch (CE App, min=1)    │                             │
# │  │  opensearch:2.11.0  port 9200         │                             │
# │  │  ephemeral storage (4G)               │                             │
# │  └──────────────────┬────────────────────┘                             │
# │                     │ HTTPS :443 (CE ingress → HTTP :9200)             │
# │  ┌──────────────────▼────────────────────┐                             │
# │  │  maximo-dashboards (CE App, min=1)    │                             │
# │  │  opensearch-dashboards:2.11.0 :5601   │                             │
# │  └───────────────────────────────────────┘                             │
# └─────────────────────────────────────────────────────────────────────────┘
#
# WHAT THIS SCRIPT DOES
#   1. Log in to IBM Cloud
#   2. Push opensearch:2.11.0 + opensearch-dashboards:2.11.0 to ICR
#      (CE cannot pull from docker.io directly — ICR mirror required)
#   3. Deploy (or update) the OpenSearch CE App:
#        image  : de.icr.io/<namespace>/maximo-opensearch:2.11.0
#        port   : 9200
#        storage: ephemeral (no COS/NFS volume)
#        scale  : min=1  (never go to zero — stateful DB)
#   4. Deploy (or update) the OpenSearch Dashboards CE App:
#        image  : de.icr.io/<namespace>/maximo-dashboards:2.11.0
#        port   : 5601
#        env    : OPENSEARCH_HOSTS → OpenSearch CE App URL
#        scale  : min=1
#   5. Wait for the OpenSearch cluster to become healthy
#   6. Create the two application indexes (idempotent):
#        • maximo-documents       (document RAG chunks)
#        • maximo_web_knowledge   (web-crawled content from spiderbot)
#   7. Print a ready-to-paste .env.deploy snippet
#
# USAGE
#   ./deployment/deploy-opensearch.sh [OPTIONS]
#
# OPTIONS
#   --deploy-only       Skip image mirror step; re-deploy from existing ICR images
#   --indexes-only      Skip all infra steps; only create/update indexes
#                       (requires OPENSEARCH_HOST, OPENSEARCH_USERNAME,
#                        OPENSEARCH_PASSWORD to already be set)
#   --skip-dashboard    Deploy OpenSearch only; skip the Dashboards app
#   --force-indexes     Drop and recreate existing indexes  ⚠ DESTROYS DATA
#   --tag <tag>         OpenSearch + Dashboards image tag  (default: 2.11.0)
#   --help              Print this help and exit
#
# REQUIRED ENV VARS (set in deployment/.env.deploy or export before running)
#   IBMCLOUD_API_KEY        IBM Cloud API key
#   OPENSEARCH_PASSWORD     Strong password for the OpenSearch admin user
#                           Min 8 chars, mix of upper/lower/digit/special
#
# OPTIONAL ENV VARS
#   CE_REGION               IBM Cloud region            (default: eu-de)
#   CE_RESOURCE_GROUP       Resource group name         (default: bentley-rg)
#   CE_PROJECT              Code Engine project         (default: bentley-integration-server)
#   ICR_REGISTRY            ICR hostname                (default: de.icr.io)
#   ICR_NAMESPACE           ICR namespace               (default: maximo-kh)
#   CE_APP_NAME             OpenSearch CE app name      (default: maximo-opensearch)
#   CE_DASH_APP_NAME        Dashboards CE app name      (default: maximo-dashboards)
#   CE_CPU                  vCPU for OpenSearch         (default: 2)
#   CE_MEMORY               RAM for OpenSearch          (default: 4G)
#   CE_DASH_CPU             vCPU for Dashboards         (default: 0.5)
#   CE_DASH_MEMORY          RAM for Dashboards          (default: 1G)
#   OPENSEARCH_USERNAME     Admin username              (default: admin)
#   OPENSEARCH_IMAGE_TAG    OpenSearch image tag        (default: 2.11.0)
#
# EXAMPLES
#   # Full deploy (provision storage + mirror image + deploy CE + create indexes)
#   export IBMCLOUD_API_KEY=your-api-key
#   export OPENSEARCH_PASSWORD='MyStr0ng!Pass'
#   ./deployment/deploy-opensearch.sh
#
#   # Re-deploy CE app only (image already in ICR, storage already bound)
#   ./deployment/deploy-opensearch.sh --deploy-only
#
#   # Create / update indexes only (CE app already running)
#   export OPENSEARCH_HOST=https://maximo-opensearch.<project>.eu-de.codeengine.appdomain.cloud
#   export OPENSEARCH_USERNAME=admin
#   export OPENSEARCH_PASSWORD='MyStr0ng!Pass'
#   ./deployment/deploy-opensearch.sh --indexes-only
#
#   # Wipe and recreate indexes (DESTROYS ALL DATA)
#   ./deployment/deploy-opensearch.sh --indexes-only --force-indexes
# =============================================================================
set -euo pipefail

# ── Prevent Git Bash on Windows from mangling Unix paths (e.g. /usr/share/…) ─
# Without this, Git Bash converts absolute paths like /usr/share/opensearch/data
# into C:/Program Files/Git/usr/share/opensearch/data before passing them to
# ibmcloud CE commands, causing "mount directory must be absolute" errors.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

# ── Script directory ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/deploy-opensearch-$(date '+%Y%m%d-%H%M%S').log"
if [[ -z "${LOG_FILE_ACTIVE:-}" ]]; then
  export LOG_FILE_ACTIVE="${LOG_FILE}"
  exec > >(tee -a "${LOG_FILE}") 2>&1
fi
echo "=== OpenSearch deploy started at $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
echo "=== Log file: ${LOG_FILE} ==="

# ── Auto-load secrets ─────────────────────────────────────────────────────────
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
if [[ -f "${ENV_FILE}" ]]; then
  set -o allexport; source "${ENV_FILE}"; set +o allexport
  echo -e "\033[0;36m[INFO]\033[0m  Loaded secrets from ${ENV_FILE}"
fi
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

# ── Helper: poll CE until the app's revision reaches Ready=True ──────────────
# Must be called BEFORE polling the HTTP endpoint — CE needs to reconcile the
# ingress after create/update before the pod serves traffic.
# Usage: wait_for_ce_ready <app_name> [max_seconds]
wait_for_ce_ready() {
  local app_name="$1"
  local max_wait="${2:-300}"
  local interval=10
  local elapsed=0

  info "Waiting for CE revision of '${app_name}' to reach Ready=True (max ${max_wait}s)..."
  while [[ ${elapsed} -lt ${max_wait} ]]; do
    # CE JSON places "type":"Ready" and "status":"True" on separate lines, so
    # a single-line grep never matches. Instead: fetch plain-text output and
    # look for the "Ready    true" line that `ibmcloud ce application get`
    # (non-JSON) prints in the Conditions table.
    local ready
    ready=$("${IBMCLOUD}" ce application get --name "${app_name}" 2>/dev/null \
      | grep -i "^  Ready" | grep -i "true" || true)
    if [[ -n "${ready}" ]]; then
      success "CE revision of '${app_name}' is Ready"
      return 0
    fi
    info "  (${elapsed}s) revision not ready yet — retrying in ${interval}s..."
    sleep "${interval}"
    elapsed=$(( elapsed + interval ))
  done
  error "CE revision of '${app_name}' did not reach Ready=True within ${max_wait}s. Check CE logs."
}

# ── CONFIG ────────────────────────────────────────────────────────────────────
IBMCLOUD_API_KEY="${IBMCLOUD_API_KEY:-}"
CE_REGION="${CE_REGION:-eu-de}"
CE_RESOURCE_GROUP="${CE_RESOURCE_GROUP:-bentley-rg}"
CE_PROJECT="${CE_PROJECT:-bentley-integration-server}"

ICR_REGISTRY="${ICR_REGISTRY:-de.icr.io}"
ICR_NAMESPACE="${ICR_NAMESPACE:-maximo-kh}"

CE_APP_NAME="${CE_APP_NAME:-maximo-opensearch}"
CE_PORT="${CE_PORT:-9200}"
CE_CPU="${CE_CPU:-2}"
CE_MEMORY="${CE_MEMORY:-4G}"
CE_MIN_SCALE="${CE_MIN_SCALE:-1}"   # MUST be ≥ 1 — never scale to zero
CE_MAX_SCALE="${CE_MAX_SCALE:-1}"   # single-node only

# OpenSearch image — must be defined before DASH_SOURCE_IMAGE
OPENSEARCH_IMAGE_TAG="${OPENSEARCH_IMAGE_TAG:-2.11.0}"
OPENSEARCH_SOURCE_IMAGE="docker.io/opensearchproject/opensearch:${OPENSEARCH_IMAGE_TAG}"

# OpenSearch Dashboards
CE_DASH_APP_NAME="${CE_DASH_APP_NAME:-maximo-dashboards}"
CE_DASH_PORT="${CE_DASH_PORT:-5601}"
CE_DASH_CPU="${CE_DASH_CPU:-0.5}"
CE_DASH_MEMORY="${CE_DASH_MEMORY:-1G}"
DASH_SOURCE_IMAGE="docker.io/opensearchproject/opensearch-dashboards:${OPENSEARCH_IMAGE_TAG}"
DEPLOY_DASHBOARD="true"

# OpenSearch credentials
OPENSEARCH_USERNAME="${OPENSEARCH_USERNAME:-admin}"
OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-}"

# Index names — must match backend/shared/config/__init__.py
INDEX_DOCUMENTS="maximo-documents"
INDEX_WEB_KNOWLEDGE="maximo_web_knowledge"

# Populated later by deploy / used in --indexes-only mode
OPENSEARCH_HOST="${OPENSEARCH_HOST:-}"

# ── Flags ─────────────────────────────────────────────────────────────────────
MODE="full"           # full | deploy-only | indexes-only
FORCE_INDEXES="false"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy-only)     MODE="deploy-only"     ; shift ;;
    --indexes-only)    MODE="indexes-only"    ; shift ;;
    --skip-dashboard)  DEPLOY_DASHBOARD="false"; shift ;;
    --force-indexes)   FORCE_INDEXES="true"   ; shift ;;
    --tag)             OPENSEARCH_IMAGE_TAG="$2"; shift 2
                       OPENSEARCH_SOURCE_IMAGE="docker.io/opensearchproject/opensearch:${OPENSEARCH_IMAGE_TAG}"
                       DASH_SOURCE_IMAGE="docker.io/opensearchproject/opensearch-dashboards:${OPENSEARCH_IMAGE_TAG}" ;;
    --help)
      sed -n '/^# USAGE/,/^# =/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) error "Unknown option: $1. Run with --help for usage." ;;
  esac
done

# ── Detect container runtime ──────────────────────────────────────────────────
if command -v podman &>/dev/null; then
  RUNTIME="podman"
elif command -v docker &>/dev/null; then
  RUNTIME="docker"
else
  if [[ "${MODE}" != "indexes-only" ]]; then
    error "Neither podman nor docker found. Please install one."
  fi
  RUNTIME=""
fi
[[ -n "${RUNTIME}" ]] && info "Container runtime: ${RUNTIME}"

# ── Detect ibmcloud CLI ───────────────────────────────────────────────────────
if command -v ibmcloud &>/dev/null; then
  IBMCLOUD="ibmcloud"
elif command -v ibmcloud.exe &>/dev/null; then
  IBMCLOUD="ibmcloud.exe"
elif [[ -f "/mnt/c/Program Files/IBM/Cloud/bin/ibmcloud.exe" ]]; then
  IBMCLOUD="/mnt/c/Program Files/IBM/Cloud/bin/ibmcloud.exe"
else
  if [[ "${MODE}" != "indexes-only" ]]; then
    error "ibmcloud CLI not found. Install from https://cloud.ibm.com/docs/cli"
  fi
  IBMCLOUD=""
fi
[[ -n "${IBMCLOUD}" ]] && info "ibmcloud CLI: ${IBMCLOUD}"

# ── Detect curl ───────────────────────────────────────────────────────────────
command -v curl &>/dev/null || error "curl is required but not found."

# ── Helper: require a non-empty variable ─────────────────────────────────────
require_var() {
  local name="$1" value="$2"
  [[ -n "$value" ]] || error "${name} is not set. Export it or add it to ${ENV_FILE}."
}

# ── Resolve the real curl binary (not the PowerShell/Git Bash alias) ─────────
# On Windows/MSYS, `curl` may be aliased to PowerShell's Invoke-WebRequest which
# doesn't support -u, -k, or -s. Use curl.exe from System32 when available,
# otherwise fall back to the PATH curl.
_CURL_BIN=""
for _c in "/c/Windows/System32/curl.exe" "curl.exe" "curl"; do
  if command -v "${_c}" &>/dev/null || [[ -x "${_c}" ]]; then
    _CURL_BIN="${_c}"
    break
  fi
done
[[ -z "${_CURL_BIN}" ]] && error "curl not found — install curl or add it to PATH."

# ── Helper: curl against the OpenSearch REST API (self-signed cert) ───────────
os_curl() {
  # os_curl METHOD PATH [JSON_BODY]
  local method="$1" path="$2" body="${3:-}"
  local curl_cmd=(
    "${_CURL_BIN}" -s -k
    -u "${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD}"
    -X "${method}"
    "${OPENSEARCH_HOST}${path}"
  )
  [[ -n "$body" ]] && curl_cmd+=(-H "Content-Type: application/json" -d "${body}")
  "${curl_cmd[@]}"
}

os_status() {
  "${_CURL_BIN}" -s -k -o /dev/null -w "%{http_code}" \
    -u "${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD}" \
    "${OPENSEARCH_HOST}${1}"
}

# =============================================================================
# STEP 1 — IBM CLOUD LOGIN
# =============================================================================
ibmcloud_login() {
  header "IBM Cloud Login"
  require_var "IBMCLOUD_API_KEY" "${IBMCLOUD_API_KEY}"

  if ! "${IBMCLOUD}" account show &>/dev/null; then
    info "Logging in (region: ${CE_REGION}, resource group: ${CE_RESOURCE_GROUP})"
    "${IBMCLOUD}" login \
      --apikey "${IBMCLOUD_API_KEY}" \
      -r       "${CE_REGION}" \
      -g       "${CE_RESOURCE_GROUP}" \
      --quiet  || error "ibmcloud login failed"
    success "Logged in"
  else
    info "Already logged in"
  fi

  info "Selecting Code Engine project: ${CE_PROJECT}"
  "${IBMCLOUD}" ce project select --name "${CE_PROJECT}" \
    || error "Could not select project '${CE_PROJECT}'. Does it exist in ${CE_REGION}, ${CE_RESOURCE_GROUP}?"
  success "Project selected"
}

# =============================================================================
# STEP 2b — MIRROR DASHBOARDS IMAGE TO ICR
# =============================================================================
mirror_dashboard_to_icr() {
  local icr_dash_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/maximo-dashboards:${OPENSEARCH_IMAGE_TAG}"
  local local_dash_tag="maximo-dashboards:${OPENSEARCH_IMAGE_TAG}"

  # Scrub stale tags
  for stale in \
      "private.${ICR_REGISTRY}/${ICR_NAMESPACE}/maximo-dashboards:${OPENSEARCH_IMAGE_TAG}" \
      "${icr_dash_image}"; do
    if ${RUNTIME} image exists "${stale}" 2>/dev/null; then
      info "Removing stale tag: ${stale}"
      ${RUNTIME} rmi "${stale}" 2>/dev/null || true
    fi
  done

  info "Pulling ${DASH_SOURCE_IMAGE} ..."
  ${RUNTIME} pull "${DASH_SOURCE_IMAGE}" \
    || error "Failed to pull ${DASH_SOURCE_IMAGE}"
  success "Dashboards pull complete"

  ${RUNTIME} tag "${DASH_SOURCE_IMAGE}" "${local_dash_tag}"
  ${RUNTIME} tag "${local_dash_tag}"    "${icr_dash_image}"

  info "Pushing → ${icr_dash_image}"
  ${RUNTIME} push "${icr_dash_image}" || error "Failed to push ${icr_dash_image}"
  success "Dashboards image pushed: ${icr_dash_image}"

  export ICR_DASH_IMAGE="${icr_dash_image}"
}

# =============================================================================
# STEP 2 — MIRROR OPENSEARCH IMAGE TO ICR
# =============================================================================
# Code Engine cannot pull directly from docker.io in all configurations.
# We pull the image locally, tag it for ICR, and push it. This also means
# the exact image version is locked in your private registry.
# =============================================================================
mirror_image_to_icr() {
  header "Mirror OpenSearch image to IBM Container Registry"

  local icr_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/maximo-opensearch:${OPENSEARCH_IMAGE_TAG}"
  local local_tag="maximo-opensearch:${OPENSEARCH_IMAGE_TAG}"

  # ── Scrub stale tags ──────────────────────────────────────────────────────
  for stale in \
      "private.${ICR_REGISTRY}/${ICR_NAMESPACE}/maximo-opensearch:${OPENSEARCH_IMAGE_TAG}" \
      "${icr_image}"; do
    if ${RUNTIME} image exists "${stale}" 2>/dev/null; then
      info "Removing stale tag: ${stale}"
      ${RUNTIME} rmi "${stale}" 2>/dev/null || true
    fi
  done

  # ── Pull from docker.io ───────────────────────────────────────────────────
  info "Pulling ${OPENSEARCH_SOURCE_IMAGE} ..."
  ${RUNTIME} pull "${OPENSEARCH_SOURCE_IMAGE}" \
    || error "Failed to pull ${OPENSEARCH_SOURCE_IMAGE}"
  success "Pull complete"

  # ── Tag for ICR ───────────────────────────────────────────────────────────
  ${RUNTIME} tag "${OPENSEARCH_SOURCE_IMAGE}" "${local_tag}"
  ${RUNTIME} tag "${local_tag}" "${icr_image}"

  # ── Log in to IBM Cloud + ICR ─────────────────────────────────────────────
  info "Logging in to IBM Container Registry (${ICR_REGISTRY})"
  "${IBMCLOUD}" cr region-set "${CE_REGION}" || error "ibmcloud cr region-set failed"
  "${IBMCLOUD}" cr login       || error "ibmcloud cr login failed"

  # ── Ensure namespace exists ───────────────────────────────────────────────
  if ! "${IBMCLOUD}" cr namespace-list 2>/dev/null | grep -qw "${ICR_NAMESPACE}"; then
    info "ICR namespace '${ICR_NAMESPACE}' not found — creating..."
    "${IBMCLOUD}" cr namespace-add "${ICR_NAMESPACE}" \
      || error "Failed to create ICR namespace '${ICR_NAMESPACE}'"
    success "ICR namespace '${ICR_NAMESPACE}' created"
  else
    info "ICR namespace '${ICR_NAMESPACE}' already exists"
  fi

  # ── Push ─────────────────────────────────────────────────────────────────
  info "Pushing → ${icr_image}"
  ${RUNTIME} push "${icr_image}" || error "Failed to push ${icr_image}"
  success "Image pushed: ${icr_image}"

  # Export for deploy step
  export ICR_OPENSEARCH_IMAGE="${icr_image}"
}

# =============================================================================
# STEP 3 — ENSURE ICR PULL SECRET IN CODE ENGINE
# =============================================================================
ensure_pull_secret() {
  # NOTE: ALL output from this function except the final echo MUST go to
  # stderr. This function is called as secret_name=$(ensure_pull_secret) so
  # anything written to stdout gets captured into the variable, corrupting it.
  local secret_name="icr-${ICR_NAMESPACE}"
  if ! "${IBMCLOUD}" ce secret get --name "${secret_name}" &>/dev/null; then
    info "Registry pull secret '${secret_name}' not found — creating..." >&2
    "${IBMCLOUD}" ce secret create \
      --name     "${secret_name}" \
      --format   "registry" \
      --server   "${ICR_REGISTRY}" \
      --username "iamapikey" \
      --password "${IBMCLOUD_API_KEY}" \
      || error "Failed to create registry pull secret '${secret_name}'"
    success "Registry pull secret '${secret_name}' created" >&2
  else
    info "Registry pull secret '${secret_name}' already exists" >&2
  fi
  echo "icr-${ICR_NAMESPACE}"
}

# =============================================================================
# STEP 4 — DEPLOY OPENSEARCH AS A CODE ENGINE APP
# =============================================================================
deploy_ce_app() {
  header "Deploy OpenSearch to Code Engine"

  require_var "IBMCLOUD_API_KEY"    "${IBMCLOUD_API_KEY}"
  require_var "OPENSEARCH_PASSWORD" "${OPENSEARCH_PASSWORD}"

  local icr_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/maximo-opensearch:${OPENSEARCH_IMAGE_TAG}"
  local secret_name
  secret_name=$(ensure_pull_secret)

  # ── Store OpenSearch credentials in a CE generic secret ──────────────────
  # Injected wholesale via --env-from-secret (no colon selector) to avoid
  # Git Bash mangling the NAME:KEY=VALUE colon syntax.
  # Three keys are stored so both OpenSearch and Dashboards get the names
  # they each expect when the whole secret is mounted as env vars:
  #   OPENSEARCH_INITIAL_ADMIN_PASSWORD  — OpenSearch bootstrap admin password
  #   OPENSEARCH_PASSWORD                — Dashboards OPENSEARCH_PASSWORD env var
  #   OPENSEARCH_USERNAME                — shared username (both services)
  local os_secret_name="opensearch-credentials"
  if ! "${IBMCLOUD}" ce secret get --name "${os_secret_name}" &>/dev/null; then
    info "Creating CE secret '${os_secret_name}' for OpenSearch credentials..."
    "${IBMCLOUD}" ce secret create \
      --name    "${os_secret_name}" \
      --format  generic \
      --from-literal "OPENSEARCH_INITIAL_ADMIN_PASSWORD=${OPENSEARCH_PASSWORD}" \
      --from-literal "OPENSEARCH_PASSWORD=${OPENSEARCH_PASSWORD}" \
      --from-literal "OPENSEARCH_USERNAME=${OPENSEARCH_USERNAME}" \
      || error "Failed to create CE secret '${os_secret_name}'"
    success "CE secret '${os_secret_name}' created"
  else
    info "CE secret '${os_secret_name}' already exists — updating password..."
    "${IBMCLOUD}" ce secret update \
      --name    "${os_secret_name}" \
      --from-literal "OPENSEARCH_INITIAL_ADMIN_PASSWORD=${OPENSEARCH_PASSWORD}" \
      --from-literal "OPENSEARCH_PASSWORD=${OPENSEARCH_PASSWORD}" \
      --from-literal "OPENSEARCH_USERNAME=${OPENSEARCH_USERNAME}" \
      || warn "Could not update CE secret '${os_secret_name}' — continuing with existing"
  fi

  # ── Env flags for OpenSearch ──────────────────────────────────────────────
  # --env-from-secret injects the whole secret (no colon — avoids Git Bash
  # drive-letter mangling of NAME:KEY syntax).
  # OPENSEARCH_JAVA_OPTS only accepts JVM heap/GC flags — NOT -E settings.
  #
  # DISABLE_INSTALL_DEMO_CONFIG=false — the demo installer MUST run because:
  #   1. It generates the self-signed TLS certs needed by the transport SSL layer.
  #      With DISABLE_INSTALL_DEMO_CONFIG=true those certs are never created and
  #      the security plugin crashes on startup with "keystore_filepath must be set".
  #   2. In OpenSearch 2.11+ the demo installer reads OPENSEARCH_INITIAL_ADMIN_PASSWORD
  #      and bcrypt-hashes it into internal_users.yml — this is the ONLY supported
  #      way to set the admin password via env var at first boot.
  #      IMPORTANT: the password must contain NO shell-special characters (!, $, etc.)
  #      because the demo installer runs in bash and the env var is expanded inline.
  local env_flags=(
    --env-from-secret "${os_secret_name}"
    --env "DISABLE_SECURITY_PLUGIN=false"
    --env "DISABLE_INSTALL_DEMO_CONFIG=false"
    --env "OPENSEARCH_JAVA_OPTS=-Xms1g -Xmx1g"
  )

  # ── CE --argument flags pass $@ directly to the opensearch binary ─────────
  # The opensearch script forwards all positional args as -E settings to the
  # JVM. This is the only way to pass dot-notation settings without putting
  # dots in a CE env-var key (which CE rejects).
  #
  # Security is ENABLED (no plugins.security.disabled flag) because:
  #   - No COS/NFS volume is used — ephemeral storage has instant writes so
  #     the security plugin's .opendistro_security init succeeds on first boot.
  #     This mirrors exactly how the local Podman container works.
  #   - ssl.http.enabled=false: CE ingress terminates TLS externally and
  #     speaks plain HTTP to the container on port 9200. Enabling HTTP-layer
  #     SSL inside the container causes 502 Bad Gateway from CE ingress.
  #   - allow_default_init_securityindex=true: lets the plugin bootstrap
  #     the security index automatically without needing securityadmin.sh.
  local arg_flags=(
    --argument "-Ediscovery.type=single-node"
    --argument "-Ecluster.name=maximo-knowledge-hub"
    --argument "-Enode.name=maximo-opensearch-node1"
    --argument "-Enetwork.host=0.0.0.0"
    --argument "-Eplugins.security.ssl.http.enabled=false"
    --argument "-Eplugins.security.allow_default_init_securityindex=true"
  )

  # ── Create or update (ephemeral storage only — no volume mount) ──────────
  # NOTE: --mount-rm strips any stale COS/NFS volume mount that may have been
  # attached in a previous run. CE rejects an update that re-specifies an
  # already-mounted path ("duplicate mount"), so we remove it unconditionally.
  # The flag is a no-op when no mount exists, so it is safe to always pass it.
  if "${IBMCLOUD}" ce application get --name "${CE_APP_NAME}" &>/dev/null; then
    info "Application '${CE_APP_NAME}' exists — updating..."
    "${IBMCLOUD}" ce application update \
      --name  "${CE_APP_NAME}" \
      --image "${icr_image}" \
      "${env_flags[@]}" \
      "${arg_flags[@]}" \
      || error "application update failed"
    success "Application updated"
  else
    info "Application '${CE_APP_NAME}' not found — creating..."
    "${IBMCLOUD}" ce application create \
      --name              "${CE_APP_NAME}" \
      --image             "${icr_image}" \
      --registry-secret   "${secret_name}" \
      --port              "${CE_PORT}" \
      --cpu               "${CE_CPU}" \
      --memory            "${CE_MEMORY}" \
      --min-scale         "${CE_MIN_SCALE}" \
      --max-scale         "${CE_MAX_SCALE}" \
      "${env_flags[@]}" \
      "${arg_flags[@]}" \
      || error "application create failed"
    success "Application created"
  fi

  # ── Wait for CE revision to be Ready before handing off to health check ───
  # Without this, wait_for_cluster starts polling immediately and gets empty
  # responses while CE is still reconciling the ingress and starting the pod.
  wait_for_ce_ready "${CE_APP_NAME}" 300

  # ── Resolve public URL ────────────────────────────────────────────────────
  local app_url
  app_url=$("${IBMCLOUD}" ce application get \
    --name "${CE_APP_NAME}" --output url 2>/dev/null || true)

  if [[ -n "${app_url}" ]]; then
    # CE exposes HTTPS on 443 but OpenSearch listens on 9200 internally.
    # CE terminates TLS at the ingress and forwards to port 9200 on the container.
    # The public URL is already HTTPS — use it directly.
    OPENSEARCH_HOST="${app_url}"
    success "CE Application URL: ${OPENSEARCH_HOST}"
    export OPENSEARCH_HOST
  else
    warn "Could not retrieve application URL automatically."
    warn "Run: ${IBMCLOUD} ce application get --name ${CE_APP_NAME} --output url"
    warn "Then set OPENSEARCH_HOST and re-run: ./deployment/deploy-opensearch.sh --indexes-only"
  fi
}

# =============================================================================
# STEP 5b — DEPLOY OPENSEARCH DASHBOARDS AS A CODE ENGINE APP
# =============================================================================
deploy_dashboard() {
  header "Deploy OpenSearch Dashboards to Code Engine"

  local icr_dash_image="${ICR_REGISTRY}/${ICR_NAMESPACE}/maximo-dashboards:${OPENSEARCH_IMAGE_TAG}"
  local secret_name="icr-${ICR_NAMESPACE}"

  require_var "OPENSEARCH_HOST"     "${OPENSEARCH_HOST}"
  require_var "OPENSEARCH_USERNAME" "${OPENSEARCH_USERNAME}"
  require_var "OPENSEARCH_PASSWORD" "${OPENSEARCH_PASSWORD}"

  # Dashboards connects to OpenSearch over the CE-internal URL.
  # OPENSEARCH_HOSTS points to the OpenSearch app's public CE HTTPS URL.
  # Password is referenced from the CE secret created in deploy_ce_app to
  # avoid shell-special-character rejection on inline --env values.
  # --env-from-secret NAME (no colon) injects all keys from the secret.
  # The opensearch-credentials secret contains OPENSEARCH_USERNAME and
  # OPENSEARCH_INITIAL_ADMIN_PASSWORD — Dashboards needs them as
  # OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD respectively.
  # We inject the whole secret (gives OPENSEARCH_USERNAME directly) and
  # add OPENSEARCH_PASSWORD as an explicit alias pointing at the same secret.
  local os_secret_name="opensearch-credentials"
  local dash_env_flags=(
    --env             "OPENSEARCH_HOSTS=${OPENSEARCH_HOST}"
    --env-from-secret "${os_secret_name}"
    --env             "OPENSEARCH_SSL_VERIFICATIONMODE=none"
    --env             "SERVER_HOST=0.0.0.0"
    --env             "SERVER_BASEPATH="
    --env             "DISABLE_SECURITY_DASHBOARDS_PLUGIN=false"
  )

  if "${IBMCLOUD}" ce application get --name "${CE_DASH_APP_NAME}" &>/dev/null; then
    info "Application '${CE_DASH_APP_NAME}' exists — updating..."
    "${IBMCLOUD}" ce application update \
      --name  "${CE_DASH_APP_NAME}" \
      --image "${icr_dash_image}" \
      "${dash_env_flags[@]}" \
      || error "dashboards application update failed"
    success "Dashboards application updated"
  else
    info "Application '${CE_DASH_APP_NAME}' not found — creating..."
    "${IBMCLOUD}" ce application create \
      --name            "${CE_DASH_APP_NAME}" \
      --image           "${icr_dash_image}" \
      --registry-secret "${secret_name}" \
      --port            "${CE_DASH_PORT}" \
      --cpu             "${CE_DASH_CPU}" \
      --memory          "${CE_DASH_MEMORY}" \
      --min-scale       1 \
      --max-scale       1 \
      "${dash_env_flags[@]}" \
      || error "dashboards application create failed"
    success "Dashboards application created"
  fi

  # Resolve + store the Dashboards public URL
  local dash_url
  dash_url=$("${IBMCLOUD}" ce application get \
    --name "${CE_DASH_APP_NAME}" --output url 2>/dev/null || true)

  if [[ -n "${dash_url}" ]]; then
    DASHBOARDS_URL="${dash_url}"
    export DASHBOARDS_URL
    success "Dashboards URL: ${DASHBOARDS_URL}"
  else
    warn "Could not retrieve Dashboards URL. Run:"
    warn "  ${IBMCLOUD} ce application get --name ${CE_DASH_APP_NAME} --output url"
  fi
}

# =============================================================================
# STEP 6 — WAIT FOR CLUSTER HEALTH
# =============================================================================
wait_for_cluster() {
  header "Cluster Health Check"
  require_var "OPENSEARCH_HOST"     "${OPENSEARCH_HOST}"
  require_var "OPENSEARCH_USERNAME" "${OPENSEARCH_USERNAME}"
  require_var "OPENSEARCH_PASSWORD" "${OPENSEARCH_PASSWORD}"

  info "Polling ${OPENSEARCH_HOST}/_cluster/health ..."
  info "(OpenSearch takes ~60–90 s to initialise on first boot)"
  echo ""

  local deadline=$(( $(date +%s) + 300 ))   # 5-minute timeout
  local attempt=0

  while true; do
    attempt=$(( attempt + 1 ))
    local result
    result=$(os_curl GET "/_cluster/health" 2>/dev/null || true)
    local status
    # grep -oP (Perl regex) may not be available in all environments (e.g. Git Bash on Windows).
    # Use a sed fallback that is portable across GNU grep and BSD grep.
    status=$(echo "${result}" | grep -o '"status":"[^"]*"' 2>/dev/null \
      | head -1 | sed 's/.*"status":"\([^"]*\)"/\1/' || echo "unknown")
    [[ -z "${status}" ]] && status="unknown"

    if [[ "${status}" == "green" || "${status}" == "yellow" ]]; then
      echo ""
      success "Cluster is healthy (status: ${status})"
      break
    fi

    if (( $(date +%s) > deadline )); then
      echo ""
      error "Cluster did not become healthy in 5 min. Last response: ${result:-<empty>}"
    fi

    printf "  [attempt %2d]  status: %-10s  (waiting 15s...)\n" "${attempt}" "${status:-waiting}"
    sleep 15
  done
}

# =============================================================================
# STEP 7 — CREATE INDEXES
# =============================================================================

# Index mappings match backend/opensearch/setup-indexes.sh exactly,
# with number_of_replicas=0 (single-node cluster cannot replicate).
DOC_MAPPING='{
  "settings": {
    "number_of_shards":   1,
    "number_of_replicas": 0,
    "index": { "refresh_interval": "5s" }
  },
  "mappings": {
    "properties": {
      "documentId":  { "type": "keyword" },
      "fileName":    { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 512 } } },
      "content":     { "type": "text", "analyzer": "english" },
      "chunkIndex":  { "type": "integer" },
      "indexedAt":   { "type": "date" },
      "metadata": {
        "properties": {
          "assetnum": { "type": "keyword" },
          "category": { "type": "keyword" },
          "version":  { "type": "keyword" },
          "source":   { "type": "keyword" },
          "section":  { "type": "text" }
        }
      }
    }
  }
}'

WEB_MAPPING='{
  "settings": {
    "number_of_shards":   1,
    "number_of_replicas": 0,
    "index": { "refresh_interval": "5s" }
  },
  "mappings": {
    "properties": {
      "url":        { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } } },
      "title":      { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 512 } } },
      "siteLabel":  { "type": "keyword" },
      "topic":      { "type": "text",  "fields": { "keyword": { "type": "keyword" } } },
      "content":    { "type": "text",  "analyzer": "english" },
      "crawledAt":  { "type": "date" },
      "chunkIndex": { "type": "integer" }
    }
  }
}'

create_index() {
  local name="$1" mapping="$2"

  info "Checking index '${name}'..."
  local http_status
  http_status=$(os_status "/${name}")

  if [[ "${http_status}" == "200" ]]; then
    if [[ "${FORCE_INDEXES}" == "true" ]]; then
      warn "Dropping index '${name}' (--force-indexes) ..."
      os_curl DELETE "/${name}" > /dev/null
      success "Index '${name}' dropped"
    else
      success "Index '${name}' already exists — skipping (use --force-indexes to recreate)"
      return
    fi
  fi

  info "Creating index '${name}'..."
  local result
  result=$(os_curl PUT "/${name}" "${mapping}")

  if echo "${result}" | grep -q '"acknowledged":true'; then
    success "Index '${name}' created"
  else
    error "Failed to create index '${name}': ${result}"
  fi
}

setup_indexes() {
  header "Create Application Indexes"

  create_index "${INDEX_DOCUMENTS}"     "${DOC_MAPPING}"
  create_index "${INDEX_WEB_KNOWLEDGE}" "${WEB_MAPPING}"

  echo ""
  info "Index summary:"
  os_curl GET "/_cat/indices/${INDEX_DOCUMENTS},${INDEX_WEB_KNOWLEDGE}?v&h=index,health,status,docs.count,store.size" \
    2>/dev/null || true
  echo ""
}

# =============================================================================
# STEP 8 — WAIT FOR DASHBOARDS
# =============================================================================
wait_for_dashboards() {
  header "Dashboards Health Check"
  require_var "DASHBOARDS_URL" "${DASHBOARDS_URL:-}"

  info "Polling ${DASHBOARDS_URL}/api/status (up to 3 minutes)..."
  info "(Dashboards takes ~60 s to connect to OpenSearch on first boot)"
  echo ""

  local deadline=$(( $(date +%s) + 180 ))
  local attempt=0

  while true; do
    attempt=$(( attempt + 1 ))
    local http_code
    http_code=$("${_CURL_BIN}" -s -k -o /dev/null -w "%{http_code}" \
      -u "${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD}" \
      "${DASHBOARDS_URL}/api/status" 2>/dev/null || echo "000")

    if [[ "${http_code}" == "200" ]]; then
      echo ""
      success "Dashboards is ready (HTTP 200)"
      break
    fi

    if (( $(date +%s) > deadline )); then
      echo ""
      warn "Dashboards did not respond within 3 min (last HTTP: ${http_code})."
      warn "It may still be starting — check: ${DASHBOARDS_URL}/api/status"
      return   # non-fatal — OpenSearch itself is already healthy
    fi

    printf "  [attempt %2d]  HTTP %-4s  (waiting 15s...)\n" "${attempt}" "${http_code}"
    sleep 15
  done
}

# =============================================================================
# STEP 9 — PRINT ENV SNIPPET
# =============================================================================
print_env_snippet() {
  header "Ready-to-paste .env.deploy snippet"

  echo ""
  echo -e "${BOLD}${GREEN}Add these to deployment/.env.deploy:${RESET}"
  echo ""
  echo "# ── OpenSearch (Code Engine + File Storage) ─────────────────────────────────"
  echo "OPENSEARCH_HOST=${OPENSEARCH_HOST}"
  echo "OPENSEARCH_USERNAME=${OPENSEARCH_USERNAME}"
  echo "OPENSEARCH_PASSWORD=${OPENSEARCH_PASSWORD}"
  echo "OPENSEARCH_INDEX=maximo-documents"
  echo "OPENSEARCH_VERIFY_SSL=0"
  echo ""
  echo "# ── Also used by the Frontend UI nginx proxy ─────────────────────────────────"
  echo "OPENSEARCH_URL=${OPENSEARCH_HOST}"
  echo ""
  if [[ -n "${DASHBOARDS_URL:-}" ]]; then
    echo "# ── OpenSearch Dashboards ────────────────────────────────────────────────────"
    echo "# Login: ${OPENSEARCH_USERNAME} / <your password>"
    echo "DASHBOARDS_URL=${DASHBOARDS_URL}"
    echo ""
  fi
  echo -e "${YELLOW}[NOTE]${RESET}  OpenSearch uses a self-signed TLS certificate."
  echo -e "        OPENSEARCH_VERIFY_SSL=0 is correct for this deployment."
  echo -e "        The CE ingress provides an IBM-signed public HTTPS certificate"
  echo -e "        to clients; the self-signed cert is only used container-internally."
  echo ""
}

# =============================================================================
# MAIN
# =============================================================================
header "Maximo Knowledge Hub — OpenSearch + Dashboards Deploy (Code Engine + File Storage)"
info "Mode: ${MODE} | Image tag: ${OPENSEARCH_IMAGE_TAG} | Dashboard: ${DEPLOY_DASHBOARD}"
echo ""

case "${MODE}" in

  full)
    require_var "IBMCLOUD_API_KEY"    "${IBMCLOUD_API_KEY}"
    require_var "OPENSEARCH_PASSWORD" "${OPENSEARCH_PASSWORD}"
    ibmcloud_login
    mirror_image_to_icr
    [[ "${DEPLOY_DASHBOARD}" == "true" ]] && mirror_dashboard_to_icr
    deploy_ce_app
    if [[ -n "${OPENSEARCH_HOST}" ]]; then
      [[ "${DEPLOY_DASHBOARD}" == "true" ]] && deploy_dashboard
      wait_for_cluster
      [[ -n "${DASHBOARDS_URL:-}" ]] && wait_for_dashboards
      setup_indexes
      print_env_snippet
    else
      warn "OPENSEARCH_HOST not resolved — skipping dashboard + index creation."
      warn "Once the app URL is known, run:"
      warn "  export OPENSEARCH_HOST=<url>"
      warn "  ./deployment/deploy-opensearch.sh --indexes-only"
    fi
    ;;

  deploy-only)
    require_var "IBMCLOUD_API_KEY"    "${IBMCLOUD_API_KEY}"
    require_var "OPENSEARCH_PASSWORD" "${OPENSEARCH_PASSWORD}"
    ibmcloud_login
    deploy_ce_app
    if [[ -n "${OPENSEARCH_HOST}" ]]; then
      [[ "${DEPLOY_DASHBOARD}" == "true" ]] && deploy_dashboard
      wait_for_cluster
      [[ -n "${DASHBOARDS_URL:-}" ]] && wait_for_dashboards
      setup_indexes
      print_env_snippet
    fi
    ;;

  indexes-only)
    require_var "OPENSEARCH_HOST"     "${OPENSEARCH_HOST}"
    require_var "OPENSEARCH_USERNAME" "${OPENSEARCH_USERNAME}"
    require_var "OPENSEARCH_PASSWORD" "${OPENSEARCH_PASSWORD}"
    wait_for_cluster
    setup_indexes
    ;;

esac

echo ""
success "Done."
