#!/usr/bin/env bash
# ==============================================================================
# IBM Cloud Code Engine — End-to-End Deployment Script
# Project: Instana AI Assistant & Autonomous SRE observability Platform (observability)
# Engine: Podman + IBM Cloud Container Registry (ICR) + Code Engine
# ==============================================================================
set -euo pipefail

# ── Color Output Helpers ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}ℹ [INFO]${NC} $1"; }
success() { echo -e "${GREEN}✔ [SUCCESS]${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠ [WARN]${NC} $1"; }
error()   { echo -e "${RED}✖ [ERROR]${NC} $1" >&2; }
header()  { echo -e "\n${BLUE}${BOLD}================================================================${NC}"; echo -e "${BLUE}${BOLD}  $1${NC}"; echo -e "${BLUE}${BOLD}================================================================${NC}\n"; }

# ── Resolve Paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ── Configuration Defaults ────────────────────────────────────────────────────
APP_NAME="${APP_NAME:-instana-bob-observability}"
CE_PROJECT_NAME="${CE_PROJECT_NAME:-instana-observability-project}"
RESOURCE_GROUP="${RESOURCE_GROUP:-Default}"
REGION="${IBMCLOUD_REGION:-us-south}"
ICR_REGISTRY="${ICR_REGISTRY:-us.icr.io}"
ICR_NAMESPACE="${ICR_NAMESPACE:-instana-observability}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
CONTAINER_IMAGE="${ICR_REGISTRY}/${ICR_NAMESPACE}/${APP_NAME}:${IMAGE_TAG}"

APP_PORT=8085
APP_CPU="1"
APP_MEMORY="2G"
MIN_SCALE="${MIN_SCALE:-1}"
MAX_SCALE="${MAX_SCALE:-3}"
VISIBILITY="public"

header "Deploying Instana AI Assistant observability to IBM Cloud Code Engine"
echo "  • Application Name:   ${APP_NAME}"
echo "  • Code Engine Project:${CE_PROJECT_NAME}"
echo "  • Target Region:      ${REGION}"
echo "  • Resource Group:     ${RESOURCE_GROUP}"
echo "  • Container Registry: ${ICR_REGISTRY}/${ICR_NAMESPACE}"
echo "  • Image Target:       ${CONTAINER_IMAGE}"
echo "  • Container Engine:   podman (Linux amd64 target)"
echo "  • App Port:           ${APP_PORT}"
echo "  • Sizing & Sched:     CPU: ${APP_CPU}, Memory: ${APP_MEMORY}, Scale: [${MIN_SCALE}..${MAX_SCALE}]"
echo ""

# ── Step 1: Check Prerequisites ──────────────────────────────────────────────
header "Step 1: Validating CLI Prerequisites"

if ! command -v ibmcloud &>/dev/null; then
  error "IBM Cloud CLI ('ibmcloud') is not installed."
  echo "Please install it from: https://cloud.ibm.com/docs/cli?topic=cli-install-ibmcloud-cli"
  exit 1
fi
success "IBM Cloud CLI is available."

# Check and install required plugins
PLUGINS=$(ibmcloud plugin list)

if ! echo "${PLUGINS}" | grep -q "code-engine"; then
  info "Installing IBM Cloud Code Engine plugin..."
  ibmcloud plugin install code-engine -f
fi
success "Code Engine CLI plugin is installed."

if ! echo "${PLUGINS}" | grep -q "container-registry"; then
  info "Installing IBM Cloud Container Registry plugin..."
  ibmcloud plugin install container-registry -f
fi
success "Container Registry CLI plugin is installed."

# Verify Podman
if ! command -v podman &>/dev/null; then
  warn "Podman CLI is not installed locally. The script will use Code Engine remote build if local podman is unavailable."
else
  success "Podman CLI is available: $(podman --version)"
fi

# ── Step 2: Authentication & Context Targeting ────────────────────────────────
header "Step 2: Checking IBM Cloud Authentication"

if [ -n "${IBMCLOUD_API_KEY:-}" ]; then
  info "Authenticating to IBM Cloud via API Key..."
  ibmcloud login --apikey "${IBMCLOUD_API_KEY}" -r "${REGION}" -g "${RESOURCE_GROUP}"
else
  # Check if already authenticated
  if ! ibmcloud target &>/dev/null; then
    warn "Not authenticated to IBM Cloud. Initiating interactive login..."
    ibmcloud login -r "${REGION}" -g "${RESOURCE_GROUP}"
  else
    info "Already authenticated. Setting region and resource group target..."
    ibmcloud target -r "${REGION}" -g "${RESOURCE_GROUP}" || true
  fi
fi
success "Target set to Region: ${REGION}, Resource Group: ${RESOURCE_GROUP}"

# ── Step 3: Setup or Select Code Engine Project ───────────────────────────────
header "Step 3: Initializing Code Engine Project"

if ibmcloud ce project get --name "${CE_PROJECT_NAME}" &>/dev/null; then
  info "Found existing Code Engine project: '${CE_PROJECT_NAME}'. Selecting..."
  ibmcloud ce project select --name "${CE_PROJECT_NAME}"
else
  info "Creating Code Engine project: '${CE_PROJECT_NAME}'..."
  ibmcloud ce project create --name "${CE_PROJECT_NAME}"
  ibmcloud ce project select --name "${CE_PROJECT_NAME}"
fi
success "Code Engine project '${CE_PROJECT_NAME}' is active."

# ── Step 4: Setup Container Registry Namespace ────────────────────────────────
header "Step 4: Configuring IBM Cloud Container Registry (ICR)"

ibmcloud cr region-set "${REGION}" &>/dev/null || true

# Check if namespace exists, create if missing
if ! ibmcloud cr namespace-list | grep -q "^${ICR_NAMESPACE}[[:space:]]"; then
  info "Creating Container Registry namespace: '${ICR_NAMESPACE}'..."
  ibmcloud cr namespace-add "${ICR_NAMESPACE}" || warn "Namespace may already exist or cannot be auto-created."
else
  info "Container Registry namespace '${ICR_NAMESPACE}' exists."
fi

# Ensure Code Engine has registry access secret for ICR
REGISTRY_SECRET="ce-auto-icr-${ICR_REGISTRY//./-}"
if ! ibmcloud ce secret get --name "${REGISTRY_SECRET}" &>/dev/null; then
  info "Creating Code Engine registry access secret for ${ICR_REGISTRY}..."
  ibmcloud ce secret create --name "${REGISTRY_SECRET}" --format registry \
    --server "${ICR_REGISTRY}" \
    --username "iamapikey" \
    --password "${IBMCLOUD_API_KEY:-$(ibmcloud iam api-key-create ce-deploy-temp -d 'Temporary key for Code Engine pull' --output json 2>/dev/null | grep -o '\"apikey\": \"[^\"]*' | cut -d'\"' -f4 || echo 'iamapikey')}" \
    &>/dev/null || warn "Could not create registry secret; Code Engine may use automatic ICR binding."
fi

# ── Step 5: Containerize with Podman & Push to ICR ─────────────────────────────
header "Step 5: Containerizing observability Project & Pushing to IBM Container Registry"

if command -v podman &>/dev/null; then
  info "Authenticating Podman with IBM Cloud Container Registry (${ICR_REGISTRY})..."
  if [ -n "${IBMCLOUD_API_KEY:-}" ]; then
    echo "${IBMCLOUD_API_KEY}" | podman login -u iamapikey --password-stdin "${ICR_REGISTRY}"
  else
    # Use ibmcloud cr login with podman client
    ibmcloud cr login --client podman 2>/dev/null || ibmcloud cr login || true
  fi
  success "Podman logged into ${ICR_REGISTRY}."

  info "Building container image with Podman (targeting linux/amd64 for IBM Code Engine)..."
  podman build \
    --platform linux/amd64 \
    --format docker \
    -t "${CONTAINER_IMAGE}" \
    -f Dockerfile .
  success "Container image '${CONTAINER_IMAGE}' built successfully."

  info "Pushing container image to IBM Container Registry: ${CONTAINER_IMAGE}..."
  podman push "${CONTAINER_IMAGE}"
  success "Container image pushed to IBM Cloud Container Registry (${CONTAINER_IMAGE})."
else
  info "Local Podman not detected. Utilizing IBM Cloud Code Engine source-to-image remote build..."
  
  ibmcloud ce buildrun submit \
    --name "${APP_NAME}-build-${IMAGE_TAG}" \
    --source . \
    --image "${CONTAINER_IMAGE}" \
    --size medium \
    --wait
  success "Remote Code Engine build & ICR push completed."
fi

# ── Step 6: Deploy / Update Code Engine Application ───────────────────────────
header "Step 6: Deploying Application to Code Engine"

if ibmcloud ce app get --name "${APP_NAME}" &>/dev/null; then
  info "Updating existing Code Engine application '${APP_NAME}'..."
  ibmcloud ce app update \
    --name "${APP_NAME}" \
    --image "${CONTAINER_IMAGE}" \
    --port "${APP_PORT}" \
    --cpu "${APP_CPU}" \
    --memory "${APP_MEMORY}" \
    --min-scale "${MIN_SCALE}" \
    --max-scale "${MAX_SCALE}" \
    --visibility "${VISIBILITY}"
else
  info "Creating new Code Engine application '${APP_NAME}'..."
  ibmcloud ce app create \
    --name "${APP_NAME}" \
    --image "${CONTAINER_IMAGE}" \
    --port "${APP_PORT}" \
    --cpu "${APP_CPU}" \
    --memory "${APP_MEMORY}" \
    --min-scale "${MIN_SCALE}" \
    --max-scale "${MAX_SCALE}" \
    --visibility "${VISIBILITY}"
fi
success "Code Engine application deployed."

# ── Step 7: Verification & Health Check ───────────────────────────────────────
header "Step 7: Verification & Public URL"

APP_URL=$(ibmcloud ce app get --name "${APP_NAME}" --output json | grep -o '\"url\": \"[^\"]*' | head -n 1 | cut -d'\"' -f4 || echo "")

if [ -z "${APP_URL}" ]; then
  APP_URL=$(ibmcloud ce app get --name "${APP_NAME}" | awk '/^URL:/ {print $2}')
fi

echo ""
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}  🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo ""
echo -e "  🌐 ${BOLD}Live Application URL:${NC}  ${CYAN}${APP_URL}${NC}"
echo -e "  📦 ${BOLD}Deployed ICR Image:${NC}    ${CONTAINER_IMAGE}"
echo -e "  ⚙️  ${BOLD}Code Engine Project:${NC}   ${CE_PROJECT_NAME}"
echo -e "  📍 ${BOLD}Region:${NC}                ${REGION}"
echo ""

# Probe health endpoint
if [ -n "${APP_URL}" ]; then
  info "Probing application health endpoint (${APP_URL}/api/health)..."
  sleep 3
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health" || echo "000")
  if [ "${HTTP_STATUS}" = "200" ]; then
    success "Health check passed (HTTP 200 OK)."
  else
    warn "Health probe returned HTTP ${HTTP_STATUS}. App is starting up or accessible at the main URL."
  fi
fi

echo ""
echo -e "To view live logs in real time, run:"
echo -e "  ${YELLOW}ibmcloud ce app logs --name ${APP_NAME} -f${NC}"
echo ""
