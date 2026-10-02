#!/usr/bin/env bash
# Run the built image locally against the instance and exercise health, catalog, one chat and one evaluation job.
# Usage: scripts/test-container.sh [image] [port]
set -euo pipefail
cd "$(dirname "$0")/.."
IMG="${1:-agentops-d1-demo:dev}"; PORT="${2:-8081}"
PY="${PYTHON:-python3}"
ENVF=$(mktemp); chmod 600 "$ENVF"; trap 'rm -f "$ENVF"; docker rm -f agentops-d1-test >/dev/null 2>&1 || true' EXIT
{
  echo "WXO_INSTANCE_URL=${WXO_INSTANCE_URL:-$($PY -c 'import yaml,os;print(yaml.safe_load(open(os.path.expanduser("~/.config/orchestrate/config.yaml")))["environments"][os.environ.get("WXO_ENV","demo")]["wxo_url"])' 2>/dev/null)}"
  echo "WXO_API_KEY=${WXO_API_KEY:-$($PY -c 'import json,os;print(json.load(open(os.path.expanduser(os.environ.get("WXO_API_KEY_FILE","~/.wxo-demo-key.json"))))["apikey"])' 2>/dev/null)}"
  echo "JOB_START_COOLDOWN_S=0"
} > "$ENVF"
docker rm -f agentops-d1-test >/dev/null 2>&1 || true
docker run -d --name agentops-d1-test --platform linux/amd64 --env-file "$ENVF" -p "$PORT:8080" "$IMG" >/dev/null
echo -n "waiting for health"; for i in $(seq 1 60); do curl -sf "localhost:$PORT/health" >/dev/null && break; echo -n .; sleep 3; done; echo
curl -s "localhost:$PORT/health"; echo
echo -n "catalog scenarios: "; curl -s "localhost:$PORT/api/catalog" | grep -o '"id": *"tc0[0-9][a-z_]*"' | wc -l
echo -n "free text rejected: "; curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{"scenario":"x","version":"v2"}' "localhost:$PORT/api/chat"
echo -n "openapi hidden: "; curl -s -o /dev/null -w "%{http_code}\n" "localhost:$PORT/openapi.json"
echo "chat tc04 v2:"; curl -s -N -X POST "localhost:$PORT/api/chat" -H 'content-type: application/json' -d '{"scenario":"tc04_low_credit_denied","version":"v2"}' | grep -o '"type": "\(tool_call\|done\|error\)"[^}]*' | grep -o '"name": "[a-z_0-9]*"\|"type": "done"\|"type": "error"' | tr '\n' ' '; echo
J=$(curl -s -X POST "localhost:$PORT/api/jobs/evaluate_v2" -H 'content-type: application/json' -d '{"force":true}'); JID=$(echo "$J" | $PY -c "import json,sys; print(json.load(sys.stdin).get('job',{}).get('job_id',''))" 2>/dev/null)
echo "job: $JID"; curl -s -N "localhost:$PORT/api/jobs/$JID/stream" | tail -c 300000 | $PY -c "
import sys,json
last=[l for l in sys.stdin.read().split('\n') if l.startswith('data:')][-1]; d=json.loads(last[5:]); r=d.get('result',{})
print('evaluate_v2 in container:', d.get('status'), d.get('error'), '| journey', r.get('journey_success'), '/', r.get('total'), '| duration', r.get('duration_s'))" 2>/dev/null
echo "container user: $(docker exec agentops-d1-test id -u) ; processes: $(docker exec agentops-d1-test ps -eo comm= 2>/dev/null | sort -u | tr '\n' ' ')"
