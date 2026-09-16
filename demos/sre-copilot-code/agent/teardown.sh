#!/usr/bin/env bash
# teardown.sh — Remove the incident_resolution_agent from watsonx Orchestrate
#
# Usage: ./teardown.sh

set -euo pipefail

# ── Load environment variables ────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

: "${WXO_API_KEY:?'WXO_API_KEY is required — set it in .env'}"
: "${WXO_ENV_NAME:?'WXO_ENV_NAME is required — set it in .env'}"

# Resolve orchestrate CLI path
ORCHESTRATE=$(command -v orchestrate 2>/dev/null || echo "/opt/homebrew/bin/orchestrate")

echo "==> Activating WXO environment: ${WXO_ENV_NAME}..."
"$ORCHESTRATE" env activate "${WXO_ENV_NAME}" -a "${WXO_API_KEY}"

echo "==> Removing incident_resolution_agent..."
"$ORCHESTRATE" agents delete -n incident_resolution_agent 2>/dev/null \
  && echo "    Agent removed." \
  || echo "    Agent not found — skipping."

echo "==> Removing analyze_incident tool..."
"$ORCHESTRATE" tools delete -n analyze_incident 2>/dev/null \
  && echo "    Tool removed." \
  || echo "    Tool not found — skipping."

echo ""
echo "✅  Teardown complete."
