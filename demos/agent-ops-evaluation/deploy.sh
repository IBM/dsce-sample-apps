#!/usr/bin/env bash
# Import the demo tools and agents into the ACTIVE watsonx Orchestrate environment.
# Every asset is prefixed agentops_d1_. The script refuses to import a name that already exists
# unless it was created by the caller (checked via the agents API), so it is safe on an instance shared with other work.
set -euo pipefail
cd "$(dirname "$0")"
ORC="${ORC:-orchestrate}"
NOISE='hashlib\|Traceback (most\|File "/Users/.*pyenv\|globals\[\|return __\|raise Value\|ValueError: unsup\|\^\^\|code for hash'
run() { "$ORC" "$@" 2>&1 | grep -v "$NOISE" || true; }

ENV_NAME=$("$ORC" env list 2>/dev/null | awk '/\(active\)/{print $1}')
[ -n "$ENV_NAME" ] || { echo "no active orchestrate env"; exit 1; }
echo "active env: $ENV_NAME"

echo "== collision check"
"${PYTHON:-python3}" scripts/collision_check.py

echo "== tools"
run tools import -k python -f tools/agentops_d1_loan_tools.py
echo "== worker agents"
for a in agentops_d1_intake_agent agentops_d1_credit_risk_agent agentops_d1_compliance_agent_v1 agentops_d1_compliance_agent_v2; do
  run agents import -f agents/$a.yaml
done
echo "== orchestrators"
run agents import -f agents/agentops_d1_loan_orchestrator_v1.yaml
run agents import -f agents/agentops_d1_loan_orchestrator_v2.yaml
echo "== done"
