#!/usr/bin/env bash
# deploy.sh — deploy or update the product_search agent to watsonx Orchestrate
#
# Usage:
#   ./agent/deploy.sh              # deploy (create)
#   ./agent/deploy.sh --update     # update an existing deployment
#
# Prerequisites:
#   - venv/bin/orchestrate is available (pip install ibm-watsonx-orchestrate)
#   - .env is present with WO_INSTANCE_URL and WO_API_KEY
#   - The ibm_cloud environment has been registered:
#       orchestrate env add -n ibm_cloud -u "$WO_INSTANCE_URL"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_ORCHESTRATE="$PROJECT_ROOT/venv/bin/orchestrate"
YAML_FILE="$SCRIPT_DIR/product_search.yaml"

# Load .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

echo "==> Activating ibm_cloud environment..."
"$VENV_ORCHESTRATE" env activate ibm_cloud --api-key "$WO_API_KEY"

if [ "${1:-}" = "--update" ]; then
  echo "==> Updating agent from $YAML_FILE ..."
  "$VENV_ORCHESTRATE" agents update --file "$YAML_FILE"
else
  echo "==> Creating agent from $YAML_FILE ..."
  "$VENV_ORCHESTRATE" agents create --file "$YAML_FILE"
fi

echo ""
echo "==> Deployment complete. Listing agents:"
"$VENV_ORCHESTRATE" agents list

echo ""
echo "==> Active environments:"
"$VENV_ORCHESTRATE" env list

echo ""
echo "Copy the agent ID and environment ID into .env as WO_AGENT_ID and WO_ENVIRONMENT_ID."
