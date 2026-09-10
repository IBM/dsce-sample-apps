#!/usr/bin/env bash
set -euo pipefail

# Supply Chain Risk Control Tower — test runner
#
# Runs the risk logic unit tests from scripts/tests/.
# Tests cover: risk band thresholds, days-of-supply calculation,
# and a full end-to-end CRITICAL scenario scoring check.
#
# No Kafka connection required — all tests use in-memory synthetic data.
#
# Usage:
#   bash scripts/run_tests.sh
#
# Prerequisites:
#   pip install -e ".[dev]"   (installs pytest)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"

cd "$PROJECT_ROOT"

# Activate .venv if present and not already active
if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  if [[ -f "$PROJECT_ROOT/.venv/bin/activate" ]]; then
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.venv/bin/activate"
  elif [[ -f "$PROJECT_ROOT/.venv/Scripts/activate" ]]; then
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.venv/Scripts/activate"
  fi
fi

if ! command -v pytest >/dev/null 2>&1; then
  echo "ERROR: pytest not found. Install dev dependencies first:"
  echo "  pip install -e \".[dev]\""
  exit 1
fi

echo "Running risk logic tests in $TESTS_DIR"
echo

pytest -v "$TESTS_DIR"
