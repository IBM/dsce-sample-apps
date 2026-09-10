#!/usr/bin/env bash
# Register all JSON schemas in code/schemas/ with Confluent Schema Registry.
# Run from the project root after setup.sh has written .env.
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

python -m scrc.register_schemas --schema-dir code/schemas "$@"
