#!/usr/bin/env bash
# Re-validate the Bob Shell behaviors this service depends on. Run before
# rolling a new Bob version (the semantics below have changed silently before).
#
#   BOB_BIN=<bob binary> ./scripts/verify_bob_version.sh
#
# Offline checks always run. The live ACP check runs when BOBSHELL_API_KEY is
# set (costs a few cents): it proves that permission requests arrive with the
# expected option kinds, that a read-only turn cannot write, and that an
# approved turn can. Pass --readonly to also run scripts/verify_readonly.sh.
set -uo pipefail
BOB="${BOB_BIN:-bob}"
fail=0

echo "== bob --version"; $BOB --version | head -2

echo "== bob acp option set"
expected="--accept-license --auto-approve --disable-mcp --disable-subagents --log-level --trust"
actual=$($BOB acp --help 2>&1 | grep -oE '^\s+--[a-z-]+' | tr -d ' ' | sort | tr '\n' ' ' | sed 's/ $//')
for opt in $expected; do
  echo "$actual" | grep -qw -- "$opt" || { echo "FAIL: bob acp lost option $opt"; fail=1; }
done
for opt in $actual; do
  echo "$expected" | grep -qw -- "$opt" || echo "NOTE: new bob acp option $opt (review docs/bob-shell-behavior.md)"
done
[ $fail -eq 0 ] && echo "PASS: bob acp options as expected"

if [ -n "${BOBSHELL_API_KEY:-}" ]; then
  echo "== live ACP permission semantics"
  WORK=$(mktemp -d)
  HB_BOB_BIN="$BOB" python3 - "$WORK" <<'PY' || fail=1
import sys, json
sys.path.insert(0, "src")
from bob_runtime import BobRuntime, RunConfig
root = sys.argv[1]
rt = BobRuntime(root=root, bob_bin=__import__("os").environ["HB_BOB_BIN"])
try:
    ro = rt.run("Create a file named probe.txt containing hello", tenant="verify", session="ro",
                config=RunConfig(allow_writes=False, timeout_seconds=120))
    rw = rt.run("Create a file named probe.txt containing hello", tenant="verify", session="rw",
                config=RunConfig(allow_writes=True, timeout_seconds=120))
finally:
    rt.shutdown()
from pathlib import Path
ok = True
perms = (ro.stats.raw.get("permissions") if ro.stats else None) or []
if not perms:
    print("FAIL: read-only turn produced no permission request (did Bob stop asking?)"); ok = False
elif perms[0]["decision"] != "reject" or (Path(root)/"tenants/verify/sessions/ro/probe.txt").exists():
    print("FAIL: read-only turn was able to write"); ok = False
else:
    print("PASS: read-only turn refused the write; option id seen:", perms[0]["optionId"])
if not (Path(root)/"tenants/verify/sessions/rw/probe.txt").exists():
    print("FAIL: approved turn did not write (permission answer not honored?)"); ok = False
else:
    print("PASS: approved turn wrote; option id seen:", (rw.stats.raw["permissions"] or [{}])[0].get("optionId"))
print("stop reasons:", ro.stats.raw.get("stop_reason"), rw.stats.raw.get("stop_reason"))
# The command deny-list inspects the permission request's title and rawInput.
# Report what this Bob version actually sends so the deny-list can be trusted.
rt = BobRuntime(root=root, bob_bin=__import__("os").environ["HB_BOB_BIN"])
try:
    ex = rt.run("Run the shell command `echo probe`", tenant="verify", session="cmd",
                config=RunConfig(allow_writes=True, timeout_seconds=120))
    for perm in (ex.stats.raw.get("permissions") if ex.stats else None) or []:
        print("execute permission seen:", json.dumps(perm))
    if not any(p.get("kind") == "execute" for p in (ex.stats.raw.get("permissions") or [])):
        print("NOTE: no execute-kind permission request observed; check docs/bob-shell-behavior.md")
finally:
    rt.shutdown()
sys.exit(0 if ok else 1)
PY
else
  echo "== live ACP check skipped (set BOBSHELL_API_KEY to run it)"
fi

if [ "${1:-}" = "--readonly" ]; then
  BOB_BIN="$BOB" ./scripts/verify_readonly.sh || fail=1
fi

[ $fail -eq 0 ] && echo "ALL CHECKS PASSED" || { echo "SOME CHECKS FAILED"; exit 1; }
