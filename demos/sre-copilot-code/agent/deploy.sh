#!/usr/bin/env bash
# deploy.sh — Deploy the incident_resolution_agent to watsonx Orchestrate
# Run this ONCE before starting the demo stack.
#
# Prerequisites:
#   pip install ibm-watsonx-orchestrate
#   orchestrate env add --name <WXO_ENV_NAME> --url <WXO_INSTANCE_URL>
#
# Usage:
#   cp ../.env.example ../.env   # fill in WXO_API_KEY, WXO_ENV_NAME
#   chmod +x deploy.sh
#   ./deploy.sh

set -euo pipefail

# ── Load environment variables ────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
  echo "==> Loaded .env from $ENV_FILE"
fi

: "${WXO_API_KEY:?'WXO_API_KEY is required — set it in .env'}"
: "${WXO_ENV_NAME:?'WXO_ENV_NAME is required — set it in .env'}"

# ── Validate ADK is installed ──────────────────────────────────────────────────
# Resolve orchestrate CLI path — works whether on PATH or via Homebrew
ORCHESTRATE=$(command -v orchestrate 2>/dev/null || echo "/opt/homebrew/bin/orchestrate")

echo "==> Checking orchestrate CLI..."
"$ORCHESTRATE" --version

# ── Activate environment ───────────────────────────────────────────────────────
echo "==> Activating WXO environment: ${WXO_ENV_NAME}..."
"$ORCHESTRATE" env activate "${WXO_ENV_NAME}" -a "${WXO_API_KEY}"

# ── Import tool ────────────────────────────────────────────────────────────────
echo "==> Importing analyze_incident tool..."
"$ORCHESTRATE" tools import -k python -f "$(dirname "$0")/tools/analyze_incident.py"

# ── Import agent ───────────────────────────────────────────────────────────────
echo "==> Importing incident_resolution_agent..."
"$ORCHESTRATE" agents import -f "$(dirname "$0")/agent.yaml"

echo ""
echo "✅  Agent deployment complete."
echo "    Verify with: orchestrate agents list"
echo "    Test with:   orchestrate chat --agent incident_resolution_agent"
echo ""
echo "── Next step ────────────────────────────────────────────────────────────"
echo "    Run ./deploy_controls.sh to deploy PII Filter, Content Guardrails,"
echo "    and Secrets Detector controls to the agent."
echo "    Controls are optional but required for the Admin Panel toggles to work."
