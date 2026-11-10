#!/usr/bin/env bash
# deploy_local.sh - END-TO-END deployment of the QSE Automation Workbench with STREAM_MODE=realtime.
#
# Everything runs directly on this machine:
#   Headless Bob (already running, http://127.0.0.1:8000)  <-  backend (:8080)  <-  Vite UI (:5173)
#   QSE CLI + Java + git + the licence you already accepted
#
# What it does:  prerequisite checks -> stop demo containers -> create/repair the root .env ->
#                install + build -> start backend and UI -> verify the whole chain.
# What it never does: accept the IBM QSE licence, start or modify Headless Bob, print secrets.
#
# Usage:   scripts/deploy_local.sh [options]
#   --qse-dir DIR     directory that contains the QSE CLI (cli.sh / qse-cli)   [auto-detected]
#   --bob-url URL     Headless Bob address                                      [http://127.0.0.1:8000]
#   --workspace DIR   where repositories are cloned                             [$HOME/qse-workspaces]
#   --skip-install    do not run npm ci / build (use what is already there)
#   --stop            stop the backend and UI started by this script, then exit
#   --check           run the prerequisite checks only, change nothing
#   -h, --help        show this help
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
. "$ROOT/scripts/lib/common.sh"
trap on_exit_hint EXIT

ENV_FILE="$ROOT/.env"
BOB_URL="${BOB_URL:-http://127.0.0.1:8000}"
WORKSPACE_ROOT_DIR="${WORKSPACE_ROOT_DIR:-$HOME/qse-workspaces}"
QSE_DIR="${QSE_DIR:-}"
SKIP_INSTALL=0
ACTION=deploy
BACKEND_PORT=8080
UI_PORT=5173
MIN_NODE=22.13
MIN_JAVA=17
MIN_FREE_MB=1500

while [ $# -gt 0 ]; do
  case "$1" in
    --qse-dir)      QSE_DIR="${2:?--qse-dir needs a value}"; shift 2 ;;
    --bob-url)      BOB_URL="${2:?--bob-url needs a value}"; shift 2 ;;
    --workspace)    WORKSPACE_ROOT_DIR="${2:?--workspace needs a value}"; shift 2 ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --stop)         ACTION=stop; shift ;;
    --check)        ACTION=check; shift ;;
    -h|--help)      sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; trap - EXIT; exit 0 ;;
    *)              die "unknown option: $1 (see --help)" ;;
  esac
done

BOB_URL="${BOB_URL%/}"
mkdir -p "$RUN_DIR"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
UI_PID_FILE="$RUN_DIR/ui.pid"

# ================================================================================================
# Pids listening on $1 that are this project's own process: command matches $2, cwd is $ROOT/$3.
# Lets the script restart a Workbench that was started by hand, but never kills unrelated processes.
project_port_pids() {
  local port=$1 pattern=$2 subdir=$3 pid
  for pid in $(port_pids "$port"); do
    if proc_cmd "$pid" | grep -q -- "$pattern" && [ "$(proc_cwd "$pid")" = "$ROOT/$subdir" ]; then echo "$pid"; fi
  done
}

stop_started_processes() {
  local pid stopped=0
  pid=$(pidfile_alive "$BACKEND_PID_FILE" "dist/server.js")
  if [ -n "$pid" ]; then stop_pid "$pid"; ok "stopped backend (pid $pid)"; stopped=1; fi
  pid=$(pidfile_alive "$UI_PID_FILE" "vite")
  if [ -n "$pid" ]; then stop_pid "$pid"; ok "stopped UI (pid $pid)"; stopped=1; fi
  rm -f "$BACKEND_PID_FILE" "$UI_PID_FILE"
  for pid in $(project_port_pids "$BACKEND_PORT" "dist/server.js" backend) $(project_port_pids "$UI_PORT" "vite" frontend); do
    stop_pid "$pid"; ok "stopped Workbench process started by hand (pid $pid)"; stopped=1
  done
  [ "$stopped" -eq 1 ] || note "nothing started by this script is running"
}

if [ "$ACTION" = stop ]; then
  step "Stopping the Workbench started by deploy_local.sh"
  stop_started_processes
  trap - EXIT
  exit 0
fi

printf '%sQSE Automation Workbench - local deployment (STREAM_MODE=realtime)%s\n' "$C_BLD" "$C_RST"
printf 'Project: %s\n' "$ROOT"

# ================================================================================================
step "Operating system and basic tools"
check_os
check_tool curl    "install curl"
check_tool openssl "install openssl (used to generate the encryption key and password)"
check_tool lsof    "install lsof (used to find processes holding ports)"
check_tool awk     "install awk"
have node || have python3 || bad "neither node nor python3 is available to parse JSON" "install Node.js (below)"

step "Node.js and npm (backend runtime and UI build)"
if have node; then
  NODE_V=$(node -v | sed 's/^v//')
  if version_ge "$NODE_V" "$MIN_NODE"; then ok "node $NODE_V (needs >= $MIN_NODE)"
  else bad "node $NODE_V is too old" "install Node.js >= $MIN_NODE (the backend uses the built-in node:sqlite)"; fi
else bad "node is not installed" "install Node.js >= $MIN_NODE"; fi
check_tool npm "npm ships with Node.js"

step "Git (the backend clones repositories with it)"
check_tool git "install git"
if have git; then ok "$(git --version)"; fi

step "Java (the QSE CLI is a Java program)"
if have java; then
  JV=$(java_major)
  if [ -n "$JV" ] && [ "$JV" -ge "$MIN_JAVA" ] 2>/dev/null; then ok "java $JV (needs >= $MIN_JAVA)"
  else bad "java version '$JV' is too old or unreadable" "install Java $MIN_JAVA or newer"; fi
else bad "java is not installed" "install Java $MIN_JAVA or newer (for example: brew install openjdk@17)"; fi

step "Network access to GitHub (cloning)"
GH=$(http_code https://github.com 8)
case "$GH" in
  200|301|302) ok "github.com reachable (HTTP $GH)" ;;
  *)           bad "github.com is not reachable (HTTP $GH)" "check your network, proxy or VPN; the real flow clones from GitHub" ;;
esac

step "Disk space"
mkdir -p "$WORKSPACE_ROOT_DIR"
FREE=$(free_mb "$WORKSPACE_ROOT_DIR")
if [ "$FREE" -ge "$MIN_FREE_MB" ]; then ok "${FREE} MB free for clones (needs >= $MIN_FREE_MB MB)"
else bad "only ${FREE} MB free in $WORKSPACE_ROOT_DIR" "free at least $MIN_FREE_MB MB"; fi

step "QSE CLI (location, executable bit, version, licence)"
if [ -z "$QSE_DIR" ]; then
  QSE_DIR=$(env_get "$ENV_FILE" QSE_CLI_ALLOWED_DIRS | cut -d, -f1)
  for cand in "$QSE_DIR" /usr/local/bin/qse-cli-artifacts "$HOME/qse-cli" /opt/qse-cli; do
    if [ -n "$cand" ] && { [ -f "$cand/cli.sh" ] || [ -f "$cand/qse-cli" ]; }; then QSE_DIR="$cand"; break; fi
    QSE_DIR=""
  done
fi
QSE_BIN=""
if [ -n "$QSE_DIR" ]; then
  QSE_DIR="${QSE_DIR%/}"
  for n in cli.sh qse-cli; do [ -f "$QSE_DIR/$n" ] && { QSE_BIN="$QSE_DIR/$n"; break; }; done
fi
if [ -z "$QSE_BIN" ]; then
  bad "QSE CLI not found" "install IBM Quantum Safe Explorer and pass its directory: scripts/deploy_local.sh --qse-dir /path/to/qse-cli-artifacts"
else
  ok "QSE CLI directory: $QSE_DIR"
  if [ -x "$QSE_BIN" ]; then ok "executable: $QSE_BIN"; else bad "$QSE_BIN is not executable" "chmod +x '$QSE_BIN'"; fi
  QSE_VERSION_ARGS=$(env_get "$ENV_FILE" QSE_CLI_VERSION_ARGS); QSE_VERSION_ARGS="${QSE_VERSION_ARGS:--v}"
  # Run exactly like the backend does: real HOME, no stdin (so the licence prompt cannot hang the script).
  # (cwd = the CLI directory, because its launcher resolves its jars relative to it.)
  QSE_OUT=$(cd "$QSE_DIR" && run_with_timeout 40 "$QSE_BIN" $QSE_VERSION_ARGS </dev/null 2>&1 || true)
  if printf '%s' "$QSE_OUT" | grep -Eqi 'license agreement (has|have) not been accepted'; then
    bad "the QSE licence has not been accepted for user '$(id -un)'" "run '$QSE_BIN' yourself once and read/accept IBM's licence. This script never accepts it for you."
  elif printf '%s' "$QSE_OUT" | grep -Eqi 'version[[:space:]]*[:=][[:space:]]*v?[0-9]'; then
    ok "version: $(printf '%s' "$QSE_OUT" | grep -Ei 'version[[:space:]]*[:=]' | head -1 | sed 's/[[:space:]]\{2,\}/ /g')"
    ok "licence accepted for user '$(id -un)'"
  else
    bad "'$QSE_BIN $QSE_VERSION_ARGS' did not print a version" "run it by hand to see why; output starts: $(printf '%s' "$QSE_OUT" | head -1 | cut -c1-80)"
  fi
fi

step "Headless Bob on this machine ($BOB_URL)"
BOB_HEALTH=$(http_code "$BOB_URL/healthz" 6)
if [ "$BOB_HEALTH" = 200 ]; then
  ok "Headless Bob answers /healthz"
  case "$BOB_URL" in
    http://127.0.0.1:*|http://localhost:*) ok "loopback address (required: a Bob without AUTH_TOKENS rejects any other Host header)" ;;
    *) warn "$BOB_URL is not loopback; Bob answers 403 'Invalid Host header' unless it has AUTH_TOKENS configured" ;;
  esac
  BOB_PORT=$(printf '%s' "$BOB_URL" | sed -n 's#^[a-z]*://[^:/]*:\([0-9]*\).*#\1#p')
  BOB_PID=$(port_pids "${BOB_PORT:-8000}" | head -1)
  if [ -n "$BOB_PID" ]; then
    case "$(proc_cmd "$BOB_PID")" in
      *docker*|*podman*|*gvproxy*|*vfkit*) bad "port ${BOB_PORT:-8000} belongs to a container runtime, not to a Bob on this machine" "real analysis needs Bob running directly on your laptop (npm start in the Headless Bob project); stop the Bob container" ;;
      *) ok "Bob process: pid $BOB_PID" ;;
    esac
  fi
else
  bad "Headless Bob is not reachable at $BOB_URL (HTTP $BOB_HEALTH)" "start it first: cd <headless-bob>/assets/headlessbob && npm start   (this script does not start Bob)"
fi

step "Demo containers (they also use port 8080)"
if have podman; then
  DEMO_RUNNING=$(podman ps --format '{{.Names}}' 2>/dev/null | grep '^qse-workbench-' || true)
  if [ -n "$DEMO_RUNNING" ]; then
    if [ "$ACTION" = check ]; then bad "demo containers are running: $(echo "$DEMO_RUNNING" | tr '\n' ' ')" "cd deployment && podman compose down (the full run does this for you)"
    else
      note "stopping: $(echo "$DEMO_RUNNING" | tr '\n' ' ')"
      ( cd "$ROOT/deployment" && podman compose down >"$RUN_DIR/compose-down.log" 2>&1 ) || warn "podman compose down reported a problem; see ${RUN_DIR#"$ROOT"/}/compose-down.log"
      [ -z "$(podman ps --format '{{.Names}}' 2>/dev/null | grep '^qse-workbench-' || true)" ] && ok "demo containers stopped" || bad "demo containers are still running" "cd deployment && podman compose down"
    fi
  else ok "no Workbench containers running"; fi
elif have docker; then
  [ -z "$(docker ps --format '{{.Names}}' 2>/dev/null | grep '^qse-workbench-' || true)" ] && ok "no Workbench containers running" || bad "demo containers are running" "cd deployment && docker compose down"
else ok "no container runtime installed (not needed for this flow)"; fi

step "Ports"
for spec in "$BACKEND_PORT:backend" "$UI_PORT:UI"; do
  port=${spec%%:*}; what=${spec##*:}
  pids=$(port_pids "$port")
  if [ -z "$pids" ]; then ok "port $port is free ($what)"; continue; fi
  ours=""
  if [ "$what" = backend ]; then ours=$(project_port_pids "$port" "dist/server.js" backend)
  else ours=$(project_port_pids "$port" "vite" frontend); fi
  if [ -n "$ours" ] && [ "$(printf '%s\n' "$ours" | sort)" = "$(printf '%s\n' "$pids" | sort)" ]; then
    ok "port $port held by this project's $what (pid $(echo $ours)) - it will be restarted"
  else
    for pid in $pids; do
      if proc_cmd "$pid" | grep -q gvproxy && [ -n "${DEMO_RUNNING:-}" ]; then
        note "port $port is forwarded to the demo containers (pid $pid); the full run stops them first"; continue
      fi
      bad "port $port ($what) is in use by pid $pid: $(proc_cmd "$pid" | cut -c1-80)" "stop it (kill $pid), or for containers: cd deployment && podman compose down"
    done
  fi
done

if [ "$ACTION" = check ]; then
  step "Result"
  if [ "$FAILURES" -gt 0 ]; then bad "$FAILURES check(s) failed"; trap - EXIT; exit 1; fi
  ok "all prerequisite checks passed (nothing was changed)"
  trap - EXIT
  exit 0
fi
abort_if_failed

# ================================================================================================
step "Configuration: $ENV_FILE (STREAM_MODE=realtime)"
if [ ! -f "$ENV_FILE" ]; then
  [ -f "$ROOT/.env.example" ] || die ".env.example is missing"
  cp "$ROOT/.env.example" "$ENV_FILE"; chmod 600 "$ENV_FILE"
  ok "created .env from .env.example"
fi
chmod 600 "$ENV_FILE"
CURRENT_KEYS=$(env_get "$ENV_FILE" SECRETS_KEYS)
if [ -z "$CURRENT_KEYS" ]; then env_ensure "$ENV_FILE" SECRETS_KEYS "$(gen_secrets_key)" secret; else ok "SECRETS_KEYS present (kept - changing it would make the stored Bob key unreadable)"; fi
env_default "$ENV_FILE" ADMIN_USERNAME admin
if [ -z "$(env_get "$ENV_FILE" ADMIN_PASSWORD)" ]; then
  NEW_PASSWORD=$(gen_password)
  env_ensure "$ENV_FILE" ADMIN_PASSWORD "$NEW_PASSWORD" secret
  note "generated admin password - read it with: grep '^ADMIN_PASSWORD=' .env"
fi
PW_LEN=$(env_get "$ENV_FILE" ADMIN_PASSWORD | awk '{ print length($0) }')
[ "${PW_LEN:-0}" -ge 12 ] || die "ADMIN_PASSWORD in .env must be at least 12 characters"
env_ensure "$ENV_FILE" STREAM_MODE realtime
env_ensure "$ENV_FILE" NODE_ENV development
env_ensure "$ENV_FILE" COOKIE_SECURE false
env_ensure "$ENV_FILE" EXECUTION_STRATEGY colocated
env_ensure "$ENV_FILE" WORKSPACE_ROOT "$WORKSPACE_ROOT_DIR"
env_ensure "$ENV_FILE" QSE_CLI_ALLOWED_DIRS "$QSE_DIR"
env_ensure "$ENV_FILE" QSE_CLI_SEARCH_DIRS "$QSE_DIR"
env_default "$ENV_FILE" QSE_CLI_VERSION_ARGS -v
env_default "$ENV_FILE" BOB_ALLOW_PRIVATE_NETWORK true
# BOB_ALLOWED_HOSTS: a non-empty allow-list that omits the Bob host blocks the connection.
BOB_HOST=$(printf '%s' "$BOB_URL" | sed -n 's#^[a-z]*://\([^:/]*\).*#\1#p')
ALLOWED=$(env_get "$ENV_FILE" BOB_ALLOWED_HOSTS)
if [ -n "$ALLOWED" ] && ! list_contains "$ALLOWED" "$BOB_HOST"; then env_ensure "$ENV_FILE" BOB_ALLOWED_HOSTS "$ALLOWED,$BOB_HOST"; fi
if [ "$(env_get "$ENV_FILE" STREAM_MODE)" != realtime ]; then die "STREAM_MODE is not realtime after configuration - check .env for duplicate lines"; fi
ok "STREAM_MODE=realtime, EXECUTION_STRATEGY=colocated, WORKSPACE_ROOT=$WORKSPACE_ROOT_DIR"

# ================================================================================================
step "Install dependencies and build"
if [ "$SKIP_INSTALL" -eq 1 ]; then
  [ -f "$ROOT/backend/dist/server.js" ] || die "--skip-install given but backend/dist/server.js does not exist"
  [ -d "$ROOT/frontend/node_modules" ] || die "--skip-install given but frontend/node_modules does not exist"
  warn "skipped npm ci / build (--skip-install)"
else
  run_logged "backend: npm ci"    "$RUN_DIR/backend-install.log" in_dir "$ROOT/backend"  npm ci --no-audit --no-fund
  run_logged "backend: build"     "$RUN_DIR/backend-build.log"   in_dir "$ROOT/backend"  npm run build
  run_logged "frontend: npm ci"   "$RUN_DIR/frontend-install.log" in_dir "$ROOT/frontend" npm ci --no-audit --no-fund
fi
[ -f "$ROOT/backend/demo-data/recorded-run.json" ] || warn "backend/demo-data is missing; harmless in realtime"

# ================================================================================================
step "Start the backend (:$BACKEND_PORT)"
stop_started_processes >/dev/null
( cd "$ROOT/backend" && nohup node --env-file-if-exists=../.env --env-file-if-exists=.env dist/server.js >"$RUN_DIR/backend.log" 2>&1 </dev/null & echo $! >"$BACKEND_PID_FILE" )
BPID=$(cat "$BACKEND_PID_FILE")
if wait_for_url "http://127.0.0.1:$BACKEND_PORT/readyz" 40; then ok "backend ready (pid $BPID)"
else
  tail -n 25 "$RUN_DIR/backend.log" >&2 || true
  die "backend did not become ready within 40 s (log: ${RUN_DIR#"$ROOT"/}/backend.log)"
fi
if grep -q 'STREAM_MODE=realtime' "$RUN_DIR/backend.log"; then ok "backend log confirms STREAM_MODE=realtime"
else die "backend did not report STREAM_MODE=realtime - check .env"; fi
grep -q 'RECORDED DEMO DATA' "$RUN_DIR/backend.log" && die "backend started in demo mode"

step "Start the UI (:$UI_PORT)"
# Optional login prefill: forwarded only when .env sets VITE_DEFAULT_USERNAME / VITE_DEFAULT_PASSWORD (Vite does not read the root .env).
( cd "$ROOT/frontend" && nohup env VITE_API_PROXY="http://127.0.0.1:$BACKEND_PORT" VITE_DEFAULT_USERNAME="$(env_get "$ENV_FILE" VITE_DEFAULT_USERNAME)" VITE_DEFAULT_PASSWORD="$(env_get "$ENV_FILE" VITE_DEFAULT_PASSWORD)" npx --no-install vite --host 127.0.0.1 --port "$UI_PORT" --strictPort >"$RUN_DIR/ui.log" 2>&1 </dev/null & echo $! >"$UI_PID_FILE" )
UPID=$(cat "$UI_PID_FILE")
if wait_for_url "http://127.0.0.1:$UI_PORT/" 40; then ok "UI ready (pid $UPID)"
else
  tail -n 25 "$RUN_DIR/ui.log" >&2 || true
  die "UI did not start within 40 s (log: ${RUN_DIR#"$ROOT"/}/ui.log)"
fi

# ================================================================================================
step "Verify the chain end to end"
if [ "$(http_code "http://127.0.0.1:$UI_PORT/api/auth/session" 5)" != 000 ]; then ok "UI proxies /api to the backend"; else bad "UI cannot reach the backend through its proxy"; fi
JAR=$(mktemp "${TMPDIR:-/tmp}/qse-jar.XXXXXX")
trap 'rm -f "$JAR"; on_exit_hint' EXIT
ADMIN_USER=$(env_get "$ENV_FILE" ADMIN_USERNAME); ADMIN_USER="${ADMIN_USER:-admin}"
LOGIN_BODY=$(ADMIN_USER="$ADMIN_USER" ADMIN_PW="$(env_get "$ENV_FILE" ADMIN_PASSWORD)" node -e 'process.stdout.write(JSON.stringify({username:process.env.ADMIN_USER,password:process.env.ADMIN_PW}))' 2>/dev/null || true)
LOGIN=$(curl -s -m 10 -c "$JAR" -H 'content-type: application/json' -d "$LOGIN_BODY" "http://127.0.0.1:$UI_PORT/api/auth/login" 2>/dev/null || true)
CSRF=$(printf '%s' "$LOGIN" | json_get csrfToken)
if [ -n "$CSRF" ]; then
  ok "signed in as '$ADMIN_USER'"
  SETTINGS=$(curl -s -m 10 -b "$JAR" "http://127.0.0.1:$UI_PORT/api/settings" 2>/dev/null || true)
  MODE=$(printf '%s' "$SETTINGS" | json_get streamMode)
  if [ "$MODE" = realtime ]; then ok "GET /api/settings reports streamMode=realtime"; else bad "GET /api/settings reports streamMode='$MODE'" "check STREAM_MODE in .env and restart"; fi
else
  warn "could not sign in with ADMIN_PASSWORD from .env. The admin account is only created the first time a database is empty; if backend/data/db/workbench.sqlite already exists, use its original password, or stop the backend and delete backend/data/ to start over (this removes history)."
fi
rm -f "$JAR"
BOB_CAPS=$(curl -s -m 6 -o /dev/null -w '%{http_code}' "$BOB_URL/healthz" 2>/dev/null || echo 000)
[ "$BOB_CAPS" = 200 ] && ok "Headless Bob still healthy" || bad "Headless Bob stopped answering ($BOB_CAPS)"
[ "$FAILURES" -eq 0 ] || die "verification failed"

# ================================================================================================
printf '\n%s✔ Deployment complete - STREAM_MODE=realtime%s\n\n' "$C_GRN$C_BLD" "$C_RST"
cat <<EOF
  Open            http://localhost:$UI_PORT          (not :$BACKEND_PORT)
  Sign in         $ADMIN_USER / the ADMIN_PASSWORD in .env   (grep '^ADMIN_PASSWORD=' .env)
  Bob address     $BOB_URL        API key = the token your Headless Bob is configured with (an entry of its AUTH_TOKENS)
  Next in the UI  Bob Connection -> Repository -> QSE Configuration -> Execution Workspace

  Logs            ${RUN_DIR#"$ROOT"/}/backend.log   ${RUN_DIR#"$ROOT"/}/ui.log
  Stop            scripts/deploy_local.sh --stop
  Demo instead    scripts/deploy_psh.sh
EOF
[ "$WARNINGS" -eq 0 ] || printf '\n%s warning(s) above - review them.\n' "$WARNINGS"
trap - EXIT
