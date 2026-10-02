#!/usr/bin/env bash
# Build the image and roll it to one container app. Shown for IBM Cloud Code
# Engine; any platform that runs a container with the variables in
# env.example works the same way (see docs/deployment.md).
#
#   scripts/deploy.sh <tag>
#   DEPLOY_ENV="HB_X=1 HB_Y=2" scripts/deploy.sh <tag>   # also set env vars in the same roll
#   DEPLOY_APP=other-app scripts/deploy.sh <tag>         # roll to an app other than CE_APP in .env
#
# Needs in .env: IBMCLOUD_API_KEY, and the deployment names below.
set -euo pipefail
TAG="${1:?usage: deploy.sh <tag>}"
cd "$(dirname "$0")/.."
set -a; source .env; set +a
CE_APP="${DEPLOY_APP:-${CE_APP:-}}"
: "${CE_REGION:=us-south}" "${CE_RESOURCE_GROUP:?set CE_RESOURCE_GROUP in .env}" "${CE_PROJECT:?set CE_PROJECT in .env}"
: "${CE_APP:?set CE_APP in .env}" "${IMAGE:?set IMAGE in .env, e.g. us.icr.io/<namespace>/bob-in-slack}"
docker build --platform linux/amd64 -t "$IMAGE:$TAG" . | tail -1
ibmcloud login --apikey "$IBMCLOUD_API_KEY" -r "$CE_REGION" -g "$CE_RESOURCE_GROUP" -q > /dev/null
ibmcloud ce project select --name "$CE_PROJECT" > /dev/null
ibmcloud cr login --client docker > /dev/null
docker push "$IMAGE:$TAG" | tail -1
ENV_ARGS=(); for kv in ${DEPLOY_ENV:-}; do ENV_ARGS+=(--env "$kv"); done
# A roll restarts the app and wipes its local state; the startup reconcile
# cleans the previous case and, with the attract loop on, spawns a fresh one.
ibmcloud ce app update --name "$CE_APP" --image "${IMAGE/us.icr.io/private.us.icr.io}:$TAG" \
  ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} --wait --wait-timeout 600 | tail -1
url=$(ibmcloud ce app get --name "$CE_APP" --output json | python3 -c "import json,sys; print(json.load(sys.stdin)['status']['url'])")
echo "healthz: $(curl -s -o /dev/null -w '%{http_code}' "$url/healthz")  $url"
