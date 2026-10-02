#!/usr/bin/env bash
# Start the backend locally (port 8080) using the ADK env URL and the key file; nothing is echoed.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python3}"
export WXO_INSTANCE_URL="${WXO_INSTANCE_URL:-$($PY -c 'import yaml,os;print(yaml.safe_load(open(os.path.expanduser("~/.config/orchestrate/config.yaml")))["environments"][os.environ.get("WXO_ENV","demo")]["wxo_url"])' 2>/dev/null)}"
export WXO_API_KEY="${WXO_API_KEY:-$($PY -c 'import json,os;print(json.load(open(os.path.expanduser(os.environ.get("WXO_API_KEY_FILE","~/.wxo-demo-key.json"))))["apikey"])' 2>/dev/null)}"
export RUN_ROOT="${RUN_ROOT:-$PWD/results/app-runs}"
exec "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8080}" "$@"
