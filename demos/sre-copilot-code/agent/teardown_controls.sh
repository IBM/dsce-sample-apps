#!/usr/bin/env bash
# teardown_controls.sh — Remove agent controls from watsonx Orchestrate
#
# Removes the 3 controls deployed by deploy_controls.sh:
#   • incident_pii_filter
#   • incident_guardrails
#   • incident_secrets_detection
#
# Usage:
#   cd agent
#   ./teardown_controls.sh
#
# Note: This only removes the control bindings.
#       The agent itself is NOT affected. Run teardown.sh to remove the agent.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
echo "==> Activating WXO environment: ${WXO_ENV_NAME}..."
"$ORCHESTRATE" env activate "${WXO_ENV_NAME}" -a "${WXO_API_KEY}"

# ── Helper: delete control by name, tolerate 'not found' ─────────────────────
delete_control() {
  local name="$1"
  echo ""
  echo "==> Removing control: ${name}..."
  if "$ORCHESTRATE" controls delete --name "${name}" 2>&1 | grep -qiE "not found|does not exist|no.*control"; then
    echo "    Not found — skipping (already removed)"
  else
    echo "    Removed ✓"
  fi
}

delete_control "incident_pii_filter"
delete_control "incident_guardrails"
delete_control "incident_secrets_detection"

echo ""
echo "✅  Controls teardown complete."
echo "    Run ./teardown.sh to also remove the agent and tool."
