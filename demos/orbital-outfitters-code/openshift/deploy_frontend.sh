#!/usr/bin/env bash
# deploy_frontend.sh — Build, push, and rollout the frontend image only
# Usage: ./openshift/deploy_frontend.sh
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

# ── Build and push frontend image ─────────────────────────────────────────────
echo "→ Building frontend..."
docker builder prune -f
docker build --no-cache --platform linux/amd64 \
  -f openshift/Dockerfile.frontend \
  --build-arg VITE_BACKEND_URL="" \
  -t "${REGISTRY}/frontend:latest" .
docker push "${REGISTRY}/frontend:latest"

# ── Target cluster ─────────────────────────────────────────────────────────────
echo "→ Targeting cluster..."
ibmcloud target -g "${IBM_CLOUD_RESOURCE_GROUP}"
ibmcloud oc cluster config --cluster "${ROKS_CLUSTER_NAME}" --admin

# ── Rollout ────────────────────────────────────────────────────────────────────
echo "→ Rolling out frontend..."
oc rollout restart deployment/frontend -n "${NAMESPACE}"
oc rollout status  deployment/frontend -n "${NAMESPACE}"

echo ""
echo "✓ Frontend deploy complete."
echo ""
echo "Route:"
oc get route orbital-suppliers -n "${NAMESPACE}" 2>/dev/null || echo "(route not yet available)"
