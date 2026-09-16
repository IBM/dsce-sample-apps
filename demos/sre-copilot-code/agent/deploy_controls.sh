#!/usr/bin/env bash
# deploy_controls.sh — Deploy agent controls to watsonx Orchestrate
#
# Deploys 3 controls to the incident_resolution_agent:
#   1. PII Filter (priority 10)      — masks IPs, emails, phone numbers
#   2. Content Guardrails (priority 20) — blocks jailbreaks, harmful content
#   3. Secrets Detector (priority 30)   — redacts API keys, JWT tokens
#
# Prerequisites:
#   • The agent must already be deployed (run agent/deploy.sh first)
#   • orchestrate env must be activated (done by deploy.sh or manually)
#
# Usage:
#   cd agent
#   ./deploy_controls.sh
#
# Re-deploy:
#   Run again — controls import is idempotent (creates or updates by name)
#
# Verify after deploy:
#   orchestrate controls list --agent "Incident Resolution Agent"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROLS_DIR="${SCRIPT_DIR}/controls"
ENV_FILE="${SCRIPT_DIR}/../.env"

# ── Load environment variables ────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
  echo "==> Loaded .env from $ENV_FILE"
fi

: "${WXO_API_KEY:?'WXO_API_KEY is required — set it in .env'}"
: "${WXO_ENV_NAME:?'WXO_ENV_NAME is required — set it in .env'}"

# ── Resolve orchestrate CLI ────────────────────────────────────────────────────
ORCHESTRATE=$(command -v orchestrate 2>/dev/null || echo "/opt/homebrew/bin/orchestrate")

echo ""
echo "==> Checking orchestrate CLI..."
"$ORCHESTRATE" --version

# ── Activate environment ───────────────────────────────────────────────────────
echo ""
echo "==> Activating WXO environment: ${WXO_ENV_NAME}..."
"$ORCHESTRATE" env activate "${WXO_ENV_NAME}" -a "${WXO_API_KEY}"

# ── Deploy controls (order matters — lower priority fires first) ───────────────
# Note: controls import will fail with a clear error if the agent does not exist.
# Run agent/deploy.sh first if you haven't already.

echo ""
echo "==> [1/3] Deploying PII Filter (priority 10)..."
"$ORCHESTRATE" controls import -f "${CONTROLS_DIR}/pii_filter.yaml"
echo "    PII Filter ✓"

echo ""
echo "==> [2/3] Deploying Content Guardrails (priority 20)..."
"$ORCHESTRATE" controls import -f "${CONTROLS_DIR}/guardrails.yaml"
echo "    Content Guardrails ✓"

echo ""
echo "==> [3/3] Deploying Secrets Detector (priority 30)..."
"$ORCHESTRATE" controls import -f "${CONTROLS_DIR}/secrets_detection.yaml"
echo "    Secrets Detector ✓"

# ── Verify ─────────────────────────────────────────────────────────────────────
echo ""
echo "==> Verifying deployed controls..."
"$ORCHESTRATE" controls list --agent "incident_resolution_agent"

echo ""
echo "✅  Controls deployment complete."
echo ""
echo "    Controls are deployed in OFF state by default."
echo "    Toggle them ON/OFF via the Admin Panel in the demo UI."
echo "    URL: http://localhost:3000  →  ⚙️  Settings → Admin Panel"
echo ""
echo "    To remove all controls:  ./teardown_controls.sh"
