#!/usr/bin/env bash
# ── Building Blocks Q&A Bot — OpenShift Deploy Script ────────────────────────
# Usage:
#   export BOB_API_KEY=<your-key>
#   ./deploy.sh [NAMESPACE]          # default namespace: bb-qa-bot
#
# Prerequisites:
#   - oc CLI installed and logged in  (oc whoami)
#   - BOB_API_KEY environment variable set
#   - Sufficient quota for 2 Deployments, 2 PVCs, 2 builds
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NAMESPACE="${1:-bb-qa-bot}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Preflight ─────────────────────────────────────────────────────────────────
echo "▶ Checking prerequisites..."
command -v oc   >/dev/null 2>&1 || { echo "❌ oc CLI not found"; exit 1; }
oc whoami       >/dev/null 2>&1 || { echo "❌ Not logged in to OpenShift (run: oc login)"; exit 1; }

if [[ -z "${BOB_API_KEY:-}" ]]; then
  echo "❌ BOB_API_KEY environment variable is not set"
  echo "   export BOB_API_KEY=<your-key>"
  exit 1
fi

echo "✅ Logged in as: $(oc whoami)"
echo "✅ Server:       $(oc whoami --show-server)"
echo "✅ Namespace:    $NAMESPACE"
echo ""

# ── Namespace ─────────────────────────────────────────────────────────────────
echo "▶ Creating project $NAMESPACE (if not exists)..."
oc new-project "$NAMESPACE" 2>/dev/null || oc project "$NAMESPACE"

# ── Secret ────────────────────────────────────────────────────────────────────
echo "▶ Creating/updating credentials secret..."
oc create secret generic bb-qa-credentials \
  --from-literal=BOB_API_KEY="$BOB_API_KEY" \
  --from-literal=AUTH_TOKENS="{\"app\":\"$BOB_API_KEY\"}" \
  --dry-run=client -o yaml | oc apply -f -

# ── Shared KB PVC ─────────────────────────────────────────────────────────────
echo "▶ Creating shared KB PersistentVolumeClaim..."
oc apply -f "$SCRIPT_DIR/kb-pvc.yaml"

# ── KB seed — copy directly into PVC via a temporary pod ─────────────────────
# ConfigMap has a 256KB limit so we can't store the 328KB KB file there.
# Instead: spin up a busybox pod that mounts the PVC, copy the file in via
# `oc cp`, then delete the pod.
KB_FILE="$ROOT_DIR/crawler/knowledge-base.json"
if [[ -f "$KB_FILE" ]]; then
  echo "▶ Seeding KB into PVC via temporary pod..."

  # Launch a pod as root just long enough to chmod /kb, then oc cp into it.
  # We need root briefly so the CephFS mount is writable before oc cp runs.
  oc run kb-seeder \
    --image=busybox \
    --restart=Never \
    --overrides='{
      "spec": {
        "containers": [{
          "name": "kb-seeder",
          "image": "busybox",
          "command": ["sh", "-c", "chmod 777 /kb && sleep 300"],
          "volumeMounts": [{"name":"kb","mountPath":"/kb"}]
        }],
        "volumes": [{"name":"kb","persistentVolumeClaim":{"claimName":"kb-data"}}]
      }
    }' \
    --command -- sh -c "chmod 777 /kb && sleep 300" 2>/dev/null || true

  echo "   Waiting for kb-seeder pod to be ready..."
  oc wait pod/kb-seeder --for=condition=Ready --timeout=60s

  echo "   Copying knowledge-base.json into PVC..."
  oc cp "$KB_FILE" kb-seeder:/kb/knowledge-base.json

  echo "   Cleaning up seeder pod..."
  oc delete pod kb-seeder --ignore-not-found=true

  echo "✅ KB seeded ($(wc -c < "$KB_FILE" | tr -d ' ') bytes)"
else
  echo "⚠  $KB_FILE not found — skipping KB seed (use Refresh KB in the UI)"
fi

# ── Network Policies ──────────────────────────────────────────────────────────
echo "▶ Applying network policies..."
oc apply -f "$SCRIPT_DIR/networkpolicy.yaml"

# ── Headless Bob — Build ──────────────────────────────────────────────────────
echo "▶ Applying Headless Bob BuildConfig + ImageStream..."
oc apply -f "$SCRIPT_DIR/headless-bob/build.yaml"

echo "▶ Building Headless Bob image (streaming logs)..."
oc start-build headless-bob \
  --from-dir="$ROOT_DIR/headless-bob/assets/headlessbob" \
  --follow

# ── Headless Bob — Deploy ─────────────────────────────────────────────────────
echo "▶ Patching namespace into Headless Bob deployment manifest..."
sed "s|NAMESPACE|$NAMESPACE|g" "$SCRIPT_DIR/headless-bob/app.yaml" | oc apply -f -

echo "▶ Waiting for Headless Bob to be ready..."
oc rollout status deployment/headless-bob --timeout=3m

# ── bb-qa-app — Build ─────────────────────────────────────────────────────────
echo "▶ Applying bb-qa-app BuildConfig + ImageStream..."
oc apply -f "$SCRIPT_DIR/bb-qa-app/build.yaml"

echo "▶ Building bb-qa-app image (streaming logs)..."
oc start-build bb-qa-app \
  --from-dir="$ROOT_DIR/bb-qa-app" \
  --follow

# ── bb-qa-app — Deploy ────────────────────────────────────────────────────────
echo "▶ Patching namespace into bb-qa-app deployment manifest..."
sed "s|NAMESPACE|$NAMESPACE|g" "$SCRIPT_DIR/bb-qa-app/app.yaml" | oc apply -f -

echo "▶ Waiting for bb-qa-app to be ready..."
oc rollout status deployment/bb-qa-app --timeout=3m

# ── Done ──────────────────────────────────────────────────────────────────────
ROUTE=$(oc get route bb-qa-app -o jsonpath='{.spec.host}' 2>/dev/null || echo "pending")
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅  Building Blocks Q&A Bot deployed successfully!"
echo ""
echo "  🌐  URL:  https://$ROUTE"
echo "  🔧  Bob:  $(oc get route headless-bob -o jsonpath='{.spec.host}' 2>/dev/null || echo 'internal only')"
echo ""
echo "  Useful commands:"
echo "    oc get pods                        # check pod status"
echo "    oc logs -f deployment/headless-bob # Bob logs"
echo "    oc logs -f deployment/bb-qa-app    # UI logs"
echo "    oc get pvc                         # check volumes"
echo "════════════════════════════════════════════════════════"
