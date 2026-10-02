#!/usr/bin/env bash
# Run an orchestrate command with WO_API_KEY available for token refresh (key never echoed).
# Usage: ./orc.sh evaluations evaluate -c evaluations/eval_config_v2.yaml
set -euo pipefail
export WO_API_KEY
WO_API_KEY=$("${PYTHON:-python3}" -c 'import json,os;print(json.load(open(os.path.expanduser(os.environ.get("WXO_API_KEY_FILE","~/.wxo-demo-key.json"))))["apikey"])' 2>/dev/null)
exec "${ORC:-orchestrate}" "$@"
