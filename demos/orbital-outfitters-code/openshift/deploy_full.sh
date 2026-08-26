#!/usr/bin/env bash
# deploy_full.sh — Build, push all images, and deploy Orbital Suppliers to OpenShift (ROKS)
# Usage: ./openshift/deploy_full.sh [prod]
set -euo pipefail

OVERLAY=${1:-prod}
NAMESPACE=orbital-suppliers

# ── Load .env ──────────────────────────────────────────────────────────────────
set -a; source .env; set +a

ICR_HOST="${ICR_HOSTNAME:-us.icr.io}"
ICR_NS="${ICR_NAMESPACE:-orbital-suppliers}"
REGISTRY="${ICR_HOST}/${ICR_NS}"

# ── Login to ICR ───────────────────────────────────────────────────────────────
echo "→ Logging into ICR..."
ibmcloud cr login --client docker

# ── Build and push images ──────────────────────────────────────────────────────
echo "→ Building frontend..."
docker build --no-cache --platform linux/amd64 \
  -f openshift/Dockerfile.frontend \
  --build-arg VITE_BACKEND_URL="" \
  -t "${REGISTRY}/frontend:latest" .
docker push "${REGISTRY}/frontend:latest"

echo "→ Building backend..."
docker build --platform linux/amd64 \
  -f openshift/Dockerfile.backend \
  -t "${REGISTRY}/backend:latest" .
docker push "${REGISTRY}/backend:latest"

echo "→ Building vector-db..."
docker build --platform linux/amd64 \
  -f openshift/Dockerfile.vector-db \
  -t "${REGISTRY}/vector-db:latest" .
docker push "${REGISTRY}/vector-db:latest"

echo "→ Building embed job..."
docker build --platform linux/amd64 \
  -f openshift/jobs/Dockerfile.embed \
  -t "${REGISTRY}/embed:latest" .
docker push "${REGISTRY}/embed:latest"

# ── Target cluster ─────────────────────────────────────────────────────────────
echo "→ Targeting cluster..."
ibmcloud target -g "${IBM_CLOUD_RESOURCE_GROUP}"
ibmcloud oc cluster config --cluster "${ROKS_CLUSTER_NAME}" --admin

# ── Namespace and ICR pull secret ──────────────────────────────────────────────
echo "→ Creating namespace..."
oc apply -f openshift/manifests/base/namespace.yaml

echo "→ Wiring ICR pull secret..."
oc get secret all-icr-io -n default -o json | \
  python3 -c "
import sys, json
s = json.load(sys.stdin)
s['metadata'] = {'name': s['metadata']['name'], 'namespace': '${NAMESPACE}'}
print(json.dumps(s))
" | oc apply -f - || true
oc secrets link default all-icr-io --for=pull -n "${NAMESPACE}" || true

# ── Secrets (never committed) ──────────────────────────────────────────────────
echo "→ Creating secrets..."
oc create secret generic app-secrets -n "${NAMESPACE}" \
  --from-literal=DB_USER="${DB_USER}" \
  --from-literal=DB_PASSWORD="${DB_PASSWORD}" \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=PASSWORD_HASH_SECRET="${PASSWORD_HASH_SECRET}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=USER_PASSWORD="${USER_PASSWORD}" \
  --from-literal=WO_API_KEY="${WO_API_KEY}" \
  --from-literal=WO_INSTANCE_URL="${WO_INSTANCE_URL_PRIVATE:-$WO_INSTANCE_URL}" \
  --from-literal=WO_AGENT_ID="${WO_AGENT_ID:-}" \
  --from-literal=WO_ENVIRONMENT_ID="${WO_ENVIRONMENT_ID:-}" \
  --dry-run=client -o yaml | oc apply -f -

# ── Patch DB_HOST_PRIVATE into the prod overlay ────────────────────────────────
echo "→ Patching DB_HOST_PRIVATE in prod overlay..."
sed -i.bak "s|REPLACE_WITH_DB_HOST_PRIVATE|${DB_HOST_PRIVATE:-$DB_HOST}|g" \
  openshift/manifests/overlays/prod/kustomization.yaml

# ── Apply manifests ────────────────────────────────────────────────────────────
echo "→ Applying kustomize overlay: ${OVERLAY}..."
oc kustomize "openshift/manifests/overlays/${OVERLAY}" | oc apply -f -

# ── Restore the overlay placeholder ───────────────────────────────────────────
mv openshift/manifests/overlays/prod/kustomization.yaml.bak \
   openshift/manifests/overlays/prod/kustomization.yaml 2>/dev/null || true

echo ""
echo "✓ Deploy complete. Checking pods..."
oc get pods -n "${NAMESPACE}"
echo ""
echo "Route:"
oc get route orbital-suppliers -n "${NAMESPACE}" 2>/dev/null || echo "(route not yet available)"
