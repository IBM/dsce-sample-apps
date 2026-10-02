#!/usr/bin/env bash
# Live check: the READONLY_DISABLED_GROUPS list actually blocks file writes.
# Bob silently ignores unknown tool-group names, so this MUST be re-run after
# any Bob version bump or change to the group list. Costs ~$0.03.
#
# Usage: BOB_BIN=<bob binary> ./scripts/verify_readonly.sh
# Requires BOBSHELL_API_KEY in env (source .env first).

set -uo pipefail
BOB="${BOB_BIN:-bob}"

GROUPS_LIST=$(python3 - <<'PY'
import sys
sys.path.insert(0, "src")
from headless_bob.jobs import READONLY_DISABLED_GROUPS
print(",".join(READONLY_DISABLED_GROUPS))
PY
)

WORK=$(mktemp -d)
mkdir -p "$WORK/home" "$WORK/proj"
echo "disabling groups: $GROUPS_LIST"
( cd "$WORK/proj" && HOME="$WORK/home" perl -e 'alarm shift; exec @ARGV' 120 \
    $BOB run --accept-license -f stream-json --max-turns 3 -w "$WORK/proj" --trust \
    --disable-tool-groups "$GROUPS_LIST" \
    "Create a file named blocked.txt containing hello" >/dev/null 2>&1 )

if [ -f "$WORK/proj/blocked.txt" ]; then
  echo "FAIL: file was created — read-only enforcement is BROKEN"
  exit 1
fi
echo "PASS: file creation blocked — read-only enforcement holds"
