#!/usr/bin/env bash
# Re-activate the ADK environment from the key file without echoing the key.
set -euo pipefail
KEY=$("${PYTHON:-python3}" -c 'import json,os;print(json.load(open(os.path.expanduser(os.environ.get("WXO_API_KEY_FILE","~/.wxo-demo-key.json"))))["apikey"])' 2>/dev/null)
"${ORC:-orchestrate}" env activate "${1:-${WXO_ENV:-demo}}" --api-key "$KEY" 2>&1 | grep -E "now active|ERROR" | grep -v ":ibm_watsonx" | sed 's/\x1b\[[0-9;]*m//g'
