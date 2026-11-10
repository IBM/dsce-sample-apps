#!/usr/bin/env bash
# Shared helpers for scripts/deploy_local.sh and scripts/deploy_psh.sh.
# Sourced, never executed. Works with bash 3.2 (the macOS default). The caller must set ROOT.

STEP_NO=0
WARNINGS=0
FAILURES=0
BACKED_UP=""
RUN_DIR="${ROOT:?ROOT must be set before sourcing common.sh}/.run"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'; C_BLD=$'\033[1m'; C_RST=$'\033[0m'
else
  C_RED=''; C_GRN=''; C_YEL=''; C_BLD=''; C_RST=''
fi

# ---- output ---------------------------------------------------------------------------------
step()  { STEP_NO=$((STEP_NO + 1)); printf '\n%s[%s] %s%s\n' "$C_BLD" "$STEP_NO" "$*" "$C_RST"; }
ok()    { printf '  %s✔%s %s\n' "$C_GRN" "$C_RST" "$*"; }
note()  { printf '      %s\n' "$*"; }
warn()  { WARNINGS=$((WARNINGS + 1)); printf '  %s!%s %s\n' "$C_YEL" "$C_RST" "$*"; }
bad()   { FAILURES=$((FAILURES + 1)); printf '  %s✘%s %s\n' "$C_RED" "$C_RST" "$1"; if [ -n "${2:-}" ]; then printf '      fix: %s\n' "$2"; fi; return 0; }
die()   { printf '\n%s✘ %s%s\n' "$C_RED" "$*" "$C_RST" >&2; exit 1; }
abort_if_failed() {
  if [ "$FAILURES" -gt 0 ]; then
    die "$FAILURES prerequisite check(s) failed. Fix the items marked ✘ above and run the script again."
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

# ---- versions -------------------------------------------------------------------------------
# version_ge A B  ->  success when dotted version A >= B
version_ge() {
  awk -v a="$1" -v b="$2" 'BEGIN {
    na = split(a, x, "."); nb = split(b, y, "."); n = (na > nb ? na : nb)
    for (i = 1; i <= n; i++) { xi = x[i] + 0; yi = y[i] + 0; if (xi > yi) exit 0; if (xi < yi) exit 1 }
    exit 0 }'
}

java_major() {
  local v
  v=$(java -version 2>&1 | sed -n 's/.*version "\([^"]*\)".*/\1/p' | head -1 || true)
  case "$v" in
    1.*) echo "${v#1.}" | cut -d. -f1 ;;
    *)   echo "$v" | cut -d. -f1 ;;
  esac
}

# ---- processes and ports --------------------------------------------------------------------
port_pids() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | sort -u || true; }
proc_cmd()  { ps -p "$1" -o command= 2>/dev/null || true; }
proc_cwd()  { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true; }

stop_pid() {
  local pid=$1 i
  kill "$pid" 2>/dev/null || return 0
  for i in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 1
  done
  kill -9 "$pid" 2>/dev/null || true
}

# pidfile_alive FILE PATTERN -> prints the pid when FILE names a live process whose command matches PATTERN
pidfile_alive() {
  local file=$1 pattern=$2 pid
  [ -f "$file" ] || return 0
  pid=$(cat "$file" 2>/dev/null || true)
  [ -n "$pid" ] || return 0
  if kill -0 "$pid" 2>/dev/null && proc_cmd "$pid" | grep -q -- "$pattern"; then echo "$pid"; fi
  return 0
}

# ---- http -----------------------------------------------------------------------------------
http_code() { curl -s -o /dev/null -m "${2:-5}" -w '%{http_code}' "$1" 2>/dev/null || echo 000; }

wait_for_url() { # url seconds [expected-code]
  local url=$1 secs=$2 want=${3:-200} i=0 code
  while [ "$i" -lt "$secs" ]; do
    code=$(http_code "$url" 3)
    [ "$code" = "$want" ] && return 0
    sleep 1; i=$((i + 1))
  done
  return 1
}

run_with_timeout() { # seconds cmd...   (macOS has no timeout(1))
  local t=$1 pid watcher rc=0
  shift
  "$@" &
  pid=$!
  ( sleep "$t"; kill "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  watcher=$!
  wait "$pid" 2>/dev/null || rc=$?
  kill "$watcher" 2>/dev/null || true
  wait "$watcher" 2>/dev/null || true
  return "$rc"
}

in_dir() { local d=$1; shift; ( cd "$d" && "$@" ); }

run_logged() { # label logfile cmd...  (runs in the background, prints a heartbeat, shows the log on failure)
  local label=$1 log=$2 pid rc=0
  shift 2
  mkdir -p "$(dirname "$log")"
  printf '  … %s (log: %s) ' "$label" "${log#"$ROOT"/}"
  "$@" >"$log" 2>&1 </dev/null &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do printf '.'; sleep 3; done
  wait "$pid" || rc=$?
  printf '\n'
  if [ "$rc" -ne 0 ]; then
    printf '  --- last lines of %s ---\n' "$log" >&2
    tail -n 30 "$log" >&2
    die "$label failed (exit $rc)"
  fi
  ok "$label"
}

json_get() { # key path (a.b) ; JSON on stdin ; prints "" when absent
  local key=$1
  if have node; then
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v==null?v:v[k]}catch{v=""}console.log(v==null?"":v)})' "$key"
  elif have python3; then
    python3 -c 'import sys, json
try:
    v = json.load(sys.stdin)
    for k in sys.argv[1].split("."):
        v = v.get(k) if isinstance(v, dict) else None
    print("" if v is None else v)
except Exception:
    print("")' "$key"
  else
    die "node or python3 is needed to read JSON responses"
  fi
}

# ---- secrets and .env files -----------------------------------------------------------------
gen_secrets_key() { echo "k1:$(openssl rand -base64 32)"; }
gen_password()    { openssl rand -base64 24 | tr -d '/+=' | cut -c1-20; }

env_get() { # file key -> last value; trailing CR and one pair of surrounding quotes removed (as dotenv/compose do)
  [ -f "$1" ] || return 0
  awk -v k="$2" 'index($0, k "=") == 1 { v = substr($0, length(k) + 2) }
    END { sub(/\r$/, "", v)
          if (length(v) >= 2 && ((substr(v, 1, 1) == "\"" && substr(v, length(v)) == "\"") || (substr(v, 1, 1) == "\047" && substr(v, length(v)) == "\047"))) v = substr(v, 2, length(v) - 2)
          print v }' "$1"
}

env_backup() { # once per file per run; the copy keeps mode 600 because it can hold secrets
  case "$BACKED_UP" in *"|$1|"*) return 0 ;; esac
  local bak="$1.bak.$(date +%Y%m%d%H%M%S)"
  cp -p "$1" "$bak"
  chmod 600 "$bak"
  BACKED_UP="$BACKED_UP|$1|"
  note "backup of the existing file: ${bak#"$ROOT"/}"
}

env_set() { # file key value  (replaces every KEY= line with one, appends when absent)
  local file=$1 tmp
  tmp=$(mktemp "$file.XXXXXX")
  KEY="$2" VAL="$3" awk 'BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VAL"]; done = 0 }
    index($0, k "=") == 1 { if (!done) { print k "=" v; done = 1 } ; next }
    { print }
    END { if (!done) print k "=" v }' "$file" >"$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$file"
}

env_ensure() { # file key value [secret]  -> make KEY=value, logging the change without printing secrets
  local file=$1 key=$2 val=$3 secret=${4:-} cur
  cur=$(env_get "$file" "$key")
  [ "$cur" = "$val" ] && return 0
  env_backup "$file"
  env_set "$file" "$key" "$val"
  if [ -n "$secret" ]; then ok "set $key"
  elif [ -n "$cur" ]; then ok "set $key=$val (was: $cur)"
  else ok "set $key=$val"; fi
}

env_default() { # file key value [secret]  -> only when missing or empty
  [ -n "$(env_get "$1" "$2")" ] || env_ensure "$@"
}

list_contains() { # "a,b,c" item
  printf '%s' "$1" | tr ',' '\n' | awk -v i="$2" '$0 == i { f = 1 } END { exit !f }'
}

# ---- misc -----------------------------------------------------------------------------------
free_mb() { df -Pk "$1" | awk 'NR == 2 { printf "%d", $4 / 1024 }'; }

check_os() {
  case "$(uname -s)" in
    Darwin) ok "operating system: macOS ($(uname -m))" ;;
    Linux)  ok "operating system: Linux ($(uname -m))" ;;
    *)      bad "unsupported operating system: $(uname -s)" "use macOS or Linux (on Windows use WSL 2)" ;;
  esac
}

check_tool() { # name hint
  if have "$1"; then ok "$1 found"; else bad "$1 is not installed" "$2"; fi
}

on_exit_hint() { # installed as an EXIT trap by the callers
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    printf '\n%sDeployment did not complete (exit %s).%s Logs, if any, are in %s\n' "$C_RED" "$rc" "$C_RST" "${RUN_DIR#"$ROOT"/}/" >&2
  fi
}
