#!/usr/bin/env bash
# Deploy the agent evaluation demo to IBM Cloud Code Engine, building the image from this folder.
# Secrets are prompted, never stored. Run `ibmcloud login --sso` first; the ce plugin must be installed.
set -euo pipefail
cd "$(dirname "$0")"
APP_NAME="${APP_NAME:-agentops-evaluation-demo}"

read -r -p "Region [us-south]: " REGION; REGION="${REGION:-us-south}"
read -r -p "Resource group: " RESOURCE_GROUP
read -r -p "Code Engine project: " CE_PROJECT
read -r -p "WXO_INSTANCE_URL (https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<id>): " WXO_INSTANCE_URL
read -r -s -p "WXO_API_KEY (hidden): " WXO_API_KEY; echo
for v in RESOURCE_GROUP CE_PROJECT WXO_INSTANCE_URL WXO_API_KEY; do [ -n "${!v}" ] || { echo "$v is required"; exit 1; }; done

ibmcloud target -r "$REGION" -g "$RESOURCE_GROUP"
ibmcloud ce project select --name "$CE_PROJECT"

ibmcloud ce secret delete --name "${APP_NAME}-wxo" --force >/dev/null 2>&1 || true
ibmcloud ce secret create --name "${APP_NAME}-wxo" \
  --from-literal WXO_INSTANCE_URL="$WXO_INSTANCE_URL" \
  --from-literal WXO_API_KEY="$WXO_API_KEY"
unset WXO_API_KEY

# One evaluation job at a time per instance; keep a single instance so job state and result caches are consistent.
COMMON=(--build-source . --strategy dockerfile --port 8080 --env-from-secret "${APP_NAME}-wxo"
        --env WXO_ENV_NAME=demo --env RUN_ROOT=/tmp/agentops-d1-runs)
if ibmcloud ce application get --name "$APP_NAME" >/dev/null 2>&1; then
  ibmcloud ce application update --name "$APP_NAME" "${COMMON[@]}"
else
  ibmcloud ce application create --name "$APP_NAME" "${COMMON[@]}" \
    --min-scale 1 --max-scale 1 --cpu 1 --memory 4G --request-timeout 600
fi

URL=$(ibmcloud ce application get --name "$APP_NAME" --output url)
echo; echo "Deployed: $URL"
echo "--- post-deploy checks ---"
echo -n "health -> "; curl -s "$URL/health"; echo
echo -n "catalog scenarios -> "; curl -s "$URL/api/catalog" | grep -o '"id": *"tc0[0-9][a-z_]*"' | wc -l
echo -n "unknown api path -> "; curl -s -o /dev/null -w "%{http_code}\n" "$URL/api/does-not-exist"
echo -n "free-text chat rejected -> "; curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"scenario":"anything","version":"v2"}' "$URL/api/chat"
echo -n "openapi hidden (expect 404) -> "; curl -s -o /dev/null -w "%{http_code}\n" "$URL/openapi.json"
