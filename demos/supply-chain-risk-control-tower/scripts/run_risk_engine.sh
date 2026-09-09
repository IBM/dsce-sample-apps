#!/usr/bin/env bash
# Run the risk engine from project root (connects to real Confluent Cloud topics).
# Usage: ./scripts/run_risk_engine.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Activate virtual environment if present
if [[ -f ".venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
elif [[ -f ".venv/Scripts/activate" ]]; then
  # shellcheck disable=SC1091
  source .venv/Scripts/activate
fi

python -m scrc.risk_engine "$@"
