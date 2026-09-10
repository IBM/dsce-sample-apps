#!/usr/bin/env bash
# Dry-run the risk engine with synthetic data — no Kafka connection required.
# Usage: ./scripts/run_dry_run.sh [--scenario <name>] [--count <n>]
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

SCENARIO="${SCENARIO:-supplier_delay}"
COUNT="${COUNT:-8}"

python -m scrc.risk_engine \
  --dry-run \
  --scenario "$SCENARIO" \
  --count "$COUNT" \
  "$@"
