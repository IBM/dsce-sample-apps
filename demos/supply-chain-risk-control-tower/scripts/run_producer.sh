#!/usr/bin/env bash
# Run the synthetic event producer from project root.
# Usage: ./scripts/run_producer.sh [--scenario <name>] [--count <n>] [--interval <s>]
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
COUNT="${COUNT:-100}"
INTERVAL="${INTERVAL:-1}"

python -m scrc.producer \
  --scenario "$SCENARIO" \
  --count "$COUNT" \
  --interval "$INTERVAL" \
  "$@"
