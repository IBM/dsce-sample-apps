#!/usr/bin/env bash
# deploy_backend.sh — Build, push, and rollout the backend image only
# Usage: ./openshift/deploy_backend.sh
set -euo pipefail

NAMESPACE=orbital-suppliers

# ── Load .env ──────────────────────────────────────────────────────────────────
set -a; source .env; set +a

ICR_HOST="${ICR_HOSTNAME:-us.icr.io}"
ICR_NS="${ICR_NAMESPACE:-orbital-suppliers}"
REGISTRY="${ICR_HOST}/${ICR_NS}"

# ── Login to ICR ───────────────────────────────────────────────────────────────
echo "→ Logging into ICR..."
ibmcloud cr login --client docker

# ── Build and push backend image ──────────────────────────────────────────────
echo "→ Building backend..."
docker build --platform linux/amd64 \
  -f openshift/Dockerfile.backend \
  -t "${REGISTRY}/backend:latest" .
docker push "${REGISTRY}/backend:latest"

# ── Target cluster ─────────────────────────────────────────────────────────────
echo "→ Targeting cluster..."
ibmcloud target -g "${IBM_CLOUD_RESOURCE_GROUP}"
ibmcloud oc cluster config --cluster "${ROKS_CLUSTER_NAME}" --admin

# ── Rollout ────────────────────────────────────────────────────────────────────
echo "→ Rolling out backend..."
oc rollout restart deployment/backend -n "${NAMESPACE}"
oc rollout status  deployment/backend -n "${NAMESPACE}"

echo ""
echo "✓ Backend deploy complete."
