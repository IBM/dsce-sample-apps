#!/usr/bin/env bash
# deploy_psh.sh - END-TO-END deployment of the QSE Automation Workbench DEMO with STREAM_MODE=mock.
#
# Runs the frontend (NGINX) and backend in containers. The demo replays a RECORDED real run:
# Headless Bob, GitHub, the QSE CLI and Java are NEVER contacted or needed.
#
# What it does:  prerequisite checks -> stop a local (realtime) Workbench -> create/repair
#                deployment/.env -> build + start containers -> verify the whole chain.
#
# Usage:   scripts/deploy_psh.sh [options]
#   --runtime podman|docker   container runtime            [auto: podman, else docker]
#   --port N                  host port for the UI         [8080]
#   --tls                     also serve HTTPS on :8443 (needs deployment/certs/tls.crt + tls.key)
#   --production              NODE_ENV=production + COOKIE_SECURE=true (needs HTTPS in front)
#   --no-build                reuse existing images (skip --build)
#   --reset-data              delete the demo volumes (history, admin account) before starting, so the
#                             admin account is recreated from ADMIN_PASSWORD in deployment/.env
#   --down                    stop and remove the demo containers, then exit
#   --check                   run the prerequisite checks only, change nothing
#   -h, --help                show this help
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
. "$ROOT/scripts/lib/common.sh"
trap on_exit_hint EXIT

DEPLOY_DIR="$ROOT/deployment"
ENV_FILE="$DEPLOY_DIR/.env"
RUNTIME="${RUNTIME:-}"
HTTP_PORT_WANTED="${HTTP_PORT:-8080}"
USE_TLS=0
PRODUCTION=0
BUILD=1
RESET_DATA=0
ACTION=deploy
MIN_FREE_MB=3000
PROJECT=qse-workbench

while [ $# -gt 0 ]; do
  case "$1" in
    --runtime)    RUNTIME="${2:?--runtime needs podman or docker}"; shift 2 ;;
    --port)       HTTP_PORT_WANTED="${2:?--port needs a value}"; shift 2 ;;
    --tls)        USE_TLS=1; shift ;;
    --production) PRODUCTION=1; shift ;;
    --no-build)   BUILD=0; shift ;;
    --reset-data) RESET_DATA=1; shift ;;
    --down)       ACTION=down; shift ;;
    --check)      ACTION=check; shift ;;
    -h|--help)    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; trap - EXIT; exit 0 ;;
    *)            die "unknown option: $1 (see --help)" ;;
  esac
done
case "$HTTP_PORT_WANTED" in ''|*[!0-9]*) die "--port must be a number" ;; esac
mkdir -p "$RUN_DIR"

# ---- choose the runtime ---------------------------------------------------------------------
if [ -z "$RUNTIME" ]; then
  if have podman; then RUNTIME=podman; elif have docker; then RUNTIME=docker; else RUNTIME=podman; fi
fi
case "$RUNTIME" in podman|docker) ;; *) die "--runtime must be podman or docker" ;; esac

compose() { # run compose from deployment/ with the right files
  local files=(-f docker-compose.yml)
  [ "$USE_TLS" -eq 1 ] && files+=(-f docker-compose.tls.yml)
  ( cd "$DEPLOY_DIR" && "$RUNTIME" compose "${files[@]}" "$@" )
}

compose_filtered() { compose "$@" 2>&1 | grep -v 'Executing external compose provider' | grep -v '^$' || true; }

# ================================================================================================
if [ "$ACTION" = down ]; then
  step "Stopping the demo containers"
  have "$RUNTIME" || die "$RUNTIME is not installed"
  compose down 2>&1 | grep -v 'Executing external compose provider' | grep -v '^$' | sed 's/^/      /' || true
  ok "demo containers stopped (named volumes kept; 'compose down -v' also deletes the demo history)"
  trap - EXIT
  exit 0
fi

printf '%sQSE Automation Workbench - demo deployment (STREAM_MODE=mock)%s\n' "$C_BLD" "$C_RST"
printf 'Project: %s\n' "$ROOT"

# ================================================================================================
step "Operating system and basic tools"
check_os
check_tool curl    "install curl"
check_tool openssl "install openssl (used to generate the encryption key and password)"
check_tool lsof    "install lsof (used to find processes holding ports)"
check_tool awk     "install awk"
have node || have python3 || bad "neither node nor python3 is available to parse JSON" "install Node.js or Python 3 (only used by this script)"

step "Container runtime: $RUNTIME"
COMPOSE_OK=0
if ! have "$RUNTIME"; then
  if [ "$RUNTIME" = podman ]; then bad "podman is not installed" "install Podman (brew install podman) or rerun with --runtime docker"
  else bad "docker is not installed" "install Docker with Compose v2 or use --runtime podman"; fi
else
  ok "$("$RUNTIME" --version)"
  if [ "$RUNTIME" = podman ]; then
    if [ "$(uname -s)" = Darwin ]; then
      MACHINE=$(podman machine list --format '{{.Name}} {{.Running}}' 2>/dev/null | head -1 || true)
      case "$MACHINE" in
        *true*) ok "podman machine running (${MACHINE%% *})" ;;
        "")     bad "no podman machine exists" "podman machine init && podman machine start" ;;
        *)      if [ "$ACTION" = check ]; then bad "podman machine is not running" "podman machine start"
                else
                  note "starting podman machine (${MACHINE%% *}) ..."
                  podman machine start >"$RUN_DIR/podman-machine.log" 2>&1 && ok "podman machine started" || bad "could not start the podman machine" "podman machine start (log: ${RUN_DIR#"$ROOT"/}/podman-machine.log)"
                fi ;;
      esac
    fi
    if [ -z "${DOCKER_HOST:-}" ] && [ "$(uname -s)" = Darwin ]; then
      SOCK=$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}' 2>/dev/null | head -1 || true)
      if [ -n "$SOCK" ]; then
        export DOCKER_HOST="unix://$SOCK"
        ok "DOCKER_HOST set to the podman socket for this run (needed when 'podman compose' picks docker-compose)"
      fi
    fi
  else
    if docker info >/dev/null 2>&1; then ok "docker daemon reachable"; else bad "the docker daemon is not reachable" "start Docker Desktop / the docker service"; fi
  fi
  if "$RUNTIME" compose version >/dev/null 2>&1; then COMPOSE_OK=1; ok "$RUNTIME compose available"; else bad "'$RUNTIME compose' does not work" "install Compose v2 (podman: brew install docker-compose, then see README Setup B step 2)"; fi
  if "$RUNTIME" info >/dev/null 2>&1; then ok "$RUNTIME engine reachable"; else bad "cannot talk to the $RUNTIME engine" "$RUNTIME info shows the error"; fi
fi

step "Project files"
for f in backend/Dockerfile frontend/Dockerfile deployment/docker-compose.yml deployment/nginx/default.conf.template .env.example backend/demo-data/recorded-run.json .dockerignore backend/package-lock.json frontend/package-lock.json; do
  if [ -f "$ROOT/$f" ]; then ok "$f"; else bad "$f is missing" "restore it from the repository"; fi
done
if [ -f "$ROOT/backend/demo-data/recorded-run.json" ]; then
  MISSING=0
  for f in workspace/qse-e2e-report.md workspace/qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_cbom.json workspace/qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_findings_java.json workspace/qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_issue_summary.json; do
    [ -f "$ROOT/backend/demo-data/$f" ] || { bad "recorded demo file missing: backend/demo-data/$f" "restore backend/demo-data from the repository (the demo cannot start without it)"; MISSING=1; }
  done
  [ "$MISSING" -eq 0 ] && ok "recorded demo data complete"
fi
if [ "$USE_TLS" -eq 1 ]; then
  [ -f "$DEPLOY_DIR/certs/tls.crt" ] && [ -f "$DEPLOY_DIR/certs/tls.key" ] && ok "TLS certificate and key present" || bad "deployment/certs/tls.crt and tls.key are required for --tls" "create them (see docs/DEPLOYMENT.md) or drop --tls"
fi

step "Disk space"
FREE=$(free_mb "$ROOT")
if [ "$FREE" -ge "$MIN_FREE_MB" ]; then ok "${FREE} MB free (images need ~1 GB; builds need more)"
else bad "only ${FREE} MB free" "free at least $MIN_FREE_MB MB"; fi

step "Network access (image pulls and npm packages during the build)"
for url in https://registry-1.docker.io/v2/ https://registry.npmjs.org/; do
  code=$(http_code "$url" 8)
  case "$code" in 000) bad "$url is not reachable" "the build downloads base images and npm packages; check network, proxy or VPN" ;; *) ok "$url reachable (HTTP $code)" ;; esac
done

step "Ports"
OURS=""
if [ "$COMPOSE_OK" -eq 1 ]; then OURS=$("$RUNTIME" ps --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Names}}' 2>/dev/null | tr '\n' ' ' || true); fi
PIDS=$(port_pids "$HTTP_PORT_WANTED")
if [ -z "$PIDS" ]; then ok "port $HTTP_PORT_WANTED is free"
elif [ -n "$OURS" ]; then ok "port $HTTP_PORT_WANTED is held by this project's containers ($OURS) - they will be recreated"
else
  for pid in $PIDS; do
    cmd=$(proc_cmd "$pid")
    case "$cmd" in
      *dist/server.js*|*vite*) note "a local Workbench holds port $HTTP_PORT_WANTED (pid $pid); the full run stops it first" ;;
      *) bad "port $HTTP_PORT_WANTED is in use by pid $pid: $(echo "$cmd" | cut -c1-80)" "stop it, or pick another port with --port" ;;
    esac
  done
fi
if [ "$USE_TLS" -eq 1 ]; then
  [ -z "$(port_pids "$(env_get "$ENV_FILE" HTTPS_PORT | sed 's/^$/8443/')")" ] || [ -n "$OURS" ] || bad "the HTTPS port is in use" "free it or change HTTPS_PORT"
fi

if [ "$ACTION" = check ]; then
  step "Result"
  if [ "$FAILURES" -gt 0 ]; then bad "$FAILURES check(s) failed"; trap - EXIT; exit 1; fi
  ok "all prerequisite checks passed (nothing was changed)"
  trap - EXIT
  exit 0
fi
abort_if_failed

# ================================================================================================
step "Stop a local (realtime) Workbench that would clash on port $HTTP_PORT_WANTED"
STOPPED_LOCAL=0
for pid in $(port_pids "$HTTP_PORT_WANTED"); do
  case "$(proc_cmd "$pid")" in
    *dist/server.js*|*tsx*server.ts*) stop_pid "$pid"; ok "stopped local backend (pid $pid)"; STOPPED_LOCAL=1 ;;
  esac
done
for pid in $(pidfile_alive "$RUN_DIR/ui.pid" "vite") $(port_pids 5173); do
  if proc_cmd "$pid" | grep -q "vite" && [ "$(proc_cwd "$pid")" = "$ROOT/frontend" ]; then stop_pid "$pid"; ok "stopped local UI (pid $pid)"; STOPPED_LOCAL=1; fi
done
rm -f "$RUN_DIR/backend.pid" "$RUN_DIR/ui.pid"
[ "$STOPPED_LOCAL" -eq 1 ] || ok "no local Workbench was running"
if [ -n "$(port_pids "$HTTP_PORT_WANTED")" ] && [ -z "$OURS" ]; then die "port $HTTP_PORT_WANTED is still in use"; fi

if [ "$RESET_DATA" -eq 1 ]; then
  step "Reset demo data (--reset-data)"
  compose down -v >"$RUN_DIR/compose-reset.log" 2>&1 && ok "containers and demo volumes removed (history and admin account deleted)" || die "could not remove the demo volumes; see ${RUN_DIR#"$ROOT"/}/compose-reset.log"
fi

step "Configuration: deployment/.env (STREAM_MODE=mock)"
if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/.env.example" "$ENV_FILE"; chmod 600 "$ENV_FILE"
  ok "created deployment/.env from .env.example"
fi
chmod 600 "$ENV_FILE"
if [ -z "$(env_get "$ENV_FILE" SECRETS_KEYS)" ]; then env_ensure "$ENV_FILE" SECRETS_KEYS "$(gen_secrets_key)" secret; else ok "SECRETS_KEYS present (kept)"; fi
env_default "$ENV_FILE" ADMIN_USERNAME admin
if [ -z "$(env_get "$ENV_FILE" ADMIN_PASSWORD)" ]; then
  env_ensure "$ENV_FILE" ADMIN_PASSWORD "$(gen_password)" secret
  note "generated admin password - read it with: grep '^ADMIN_PASSWORD=' deployment/.env"
fi
PW_LEN=$(env_get "$ENV_FILE" ADMIN_PASSWORD | awk '{ print length($0) }')
[ "${PW_LEN:-0}" -ge 12 ] || die "ADMIN_PASSWORD in deployment/.env must be at least 12 characters"
env_ensure "$ENV_FILE" STREAM_MODE mock
env_ensure "$ENV_FILE" HTTP_PORT "$HTTP_PORT_WANTED"
if [ "$PRODUCTION" -eq 1 ]; then
  env_ensure "$ENV_FILE" NODE_ENV production
  env_ensure "$ENV_FILE" COOKIE_SECURE true
  warn "production mode forces secure cookies: sign-in only works over HTTPS (use --tls or a TLS proxy)"
else
  env_ensure "$ENV_FILE" NODE_ENV development
  env_ensure "$ENV_FILE" COOKIE_SECURE false
fi
# The demo never reads the CLI, but Compose still mounts this folder. Make it a real, empty, local one so the mount cannot fail.
mkdir -p "$DEPLOY_DIR/qse-cli"
CLI_DIR=$(env_get "$ENV_FILE" QSE_CLI_HOST_DIR)
case "$CLI_DIR" in
  ""|./*) ok "QSE_CLI_HOST_DIR mount is the empty local folder deployment/qse-cli (unused by the demo)" ;;
  *) if [ -d "$CLI_DIR" ]; then ok "QSE_CLI_HOST_DIR=$CLI_DIR exists (unused by the demo)"; else env_ensure "$ENV_FILE" QSE_CLI_HOST_DIR ./qse-cli; fi ;;
esac
[ "$(env_get "$ENV_FILE" STREAM_MODE)" = mock ] || die "STREAM_MODE is not mock after configuration - check deployment/.env for duplicate lines"
if compose config >"$RUN_DIR/compose-config.txt" 2>"$RUN_DIR/compose-config.err"; then ok "compose configuration is valid"
else cat "$RUN_DIR/compose-config.err" >&2; die "docker-compose.yml did not validate with this .env"; fi
grep -q 'STREAM_MODE: mock' "$RUN_DIR/compose-config.txt" || die "compose does not pass STREAM_MODE=mock to the backend"
rm -f "$RUN_DIR/compose-config.txt" "$RUN_DIR/compose-config.err"

# ================================================================================================
step "Build and start the containers (no Headless Bob profile)"
UP_ARGS=(up -d)
[ "$BUILD" -eq 1 ] && UP_ARGS+=(--build)
run_logged "$RUNTIME compose ${UP_ARGS[*]}" "$RUN_DIR/compose-up.log" compose "${UP_ARGS[@]}"
RUNNING_BOB=$("$RUNTIME" ps --format '{{.Names}}' 2>/dev/null | grep "^$PROJECT-headless-bob" || true)
[ -z "$RUNNING_BOB" ] || warn "a Headless Bob container is running ($RUNNING_BOB) from an earlier --profile bob run; the demo does not use it"

step "Wait for the containers to become healthy"
WAIT=0
while [ "$WAIT" -lt 120 ]; do
  H_BACK=$("$RUNTIME" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$PROJECT-backend-1" 2>/dev/null || echo missing)
  H_FRONT=$("$RUNTIME" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$PROJECT-frontend-1" 2>/dev/null || echo missing)
  [ "$H_BACK" = healthy ] && [ "$H_FRONT" = healthy ] && break
  sleep 3; WAIT=$((WAIT + 3))
done
if [ "$H_BACK" = healthy ] && [ "$H_FRONT" = healthy ]; then ok "backend and frontend are healthy"
else
  "$RUNTIME" logs --tail 30 "$PROJECT-backend-1" >&2 2>&1 || true
  die "containers did not become healthy (backend: $H_BACK, frontend: $H_FRONT). See: $RUNTIME compose logs"
fi

# ================================================================================================
step "Verify the chain end to end"
BASE="http://127.0.0.1:$HTTP_PORT_WANTED"
[ "$USE_TLS" -eq 1 ] && TLS_NOTE=" (HTTPS: https://localhost:$(env_get "$ENV_FILE" HTTPS_PORT | sed 's/^$/8443/'))"
[ "$(http_code "$BASE/nginx-health" 5)" = 200 ] && ok "NGINX health endpoint answers" || bad "NGINX health endpoint does not answer at $BASE/nginx-health"
MODE_LOG=$("$RUNTIME" logs "$PROJECT-backend-1" 2>&1 | grep -o 'STREAM_MODE=[a-z]*:[^"]*' | head -1 || true)
case "$MODE_LOG" in
  "STREAM_MODE=mock:"*) ok "backend log: ${MODE_LOG%%.*}." ;;
  *) bad "backend log does not confirm STREAM_MODE=mock ('$MODE_LOG')" "run: $RUNTIME compose logs backend | grep STREAM_MODE" ;;
esac
ENV_IN_CONTAINER=$("$RUNTIME" exec "$PROJECT-backend-1" printenv STREAM_MODE 2>/dev/null || true)
[ "$ENV_IN_CONTAINER" = mock ] && ok "container environment: STREAM_MODE=mock" || bad "container STREAM_MODE is '$ENV_IN_CONTAINER'"

JAR=$(mktemp "${TMPDIR:-/tmp}/qse-jar.XXXXXX")
trap 'rm -f "$JAR"; on_exit_hint' EXIT
ADMIN_USER=$(env_get "$ENV_FILE" ADMIN_USERNAME); ADMIN_USER="${ADMIN_USER:-admin}"
LOGIN_BODY=$(ADMIN_USER="$ADMIN_USER" ADMIN_PW="$(env_get "$ENV_FILE" ADMIN_PASSWORD)" node -e 'process.stdout.write(JSON.stringify({username:process.env.ADMIN_USER,password:process.env.ADMIN_PW}))' 2>/dev/null || python3 -c 'import json,os;print(json.dumps({"username":os.environ["ADMIN_USER"],"password":os.environ["ADMIN_PW"]}))' 2>/dev/null || true)
LOGIN=$(curl -s -m 10 -c "$JAR" -H 'content-type: application/json' -d "$LOGIN_BODY" "$BASE/api/auth/login" 2>/dev/null || true)
CSRF=$(printf '%s' "$LOGIN" | json_get csrfToken)
if [ -n "$CSRF" ]; then
  ok "signed in as '$ADMIN_USER'"
  api() { curl -s -m 15 -b "$JAR" -H "x-csrf-token: $CSRF" -H 'content-type: application/json' "$@"; }
  MODE=$(api "$BASE/api/settings" | json_get streamMode)
  [ "$MODE" = mock ] && ok "GET /api/settings reports streamMode=mock" || bad "GET /api/settings reports streamMode='$MODE'"
  BOB_STATE=$(api -X POST -d '{"endpoint":"http://demo.invalid:8000","adapter":"rest-threads","apiBasePath":"/api/v1","authMode":"bearer","apiKey":"demo-key-not-used"}' "$BASE/api/bob/connect" | json_get state)
  [ "$BOB_STATE" = connected ] && ok "Bob connection (recorded): connected" || bad "demo Bob connection returned state '$BOB_STATE'"
  REPO=$(api -X POST -d '{"url":"https://github.com/demo/demo","branch":"main"}' "$BASE/api/repositories/clone")
  REPO_ID=$(printf '%s' "$REPO" | json_get id); REPO_STATUS=$(printf '%s' "$REPO" | json_get status)
  [ "$REPO_STATUS" = cloned ] && ok "repository (recorded): cloned, $(printf '%s' "$REPO" | json_get fileCount) files" || bad "demo repository status '$REPO_STATUS'"
  QSE_STATUS=$(api -X POST -d '{"mode":"auto"}' "$BASE/api/qse/configure" | json_get status)
  [ "$QSE_STATUS" = valid ] && ok "QSE CLI (recorded): valid" || bad "demo QSE status '$QSE_STATUS'"
  if [ -n "$REPO_ID" ] && [ "$FAILURES" -eq 0 ]; then
    EXEC=$(api -X POST -d "{\"repositoryId\":\"$REPO_ID\",\"prompt\":\"Deployment smoke test of the recorded demo\"}" "$BASE/api/executions")
    EXEC_ID=$(printf '%s' "$EXEC" | json_get id)
    if [ -z "$EXEC_ID" ]; then bad "could not start a demo execution: $(printf '%s' "$EXEC" | cut -c1-120)"
    else
      note "replaying the recorded execution $EXEC_ID (about 20-30 s) ..."
      ST=""; T=0
      while [ "$T" -lt 120 ]; do
        ST=$(api "$BASE/api/executions/$EXEC_ID" | json_get status)
        case "$ST" in completed|failed|cancelled) break ;; esac
        sleep 3; T=$((T + 3))
      done
      if [ "$ST" = completed ]; then
        ok "execution completed (demo replay)"
        REP=$(api "$BASE/api/executions/$EXEC_ID/report")
        [ "$(printf '%s' "$REP" | json_get mock)" = true ] && ok "report is flagged as DEMO (recorded)" || bad "report is not flagged as a demo"
        LEN=$(printf '%s' "$REP" | json_get bobMarkdown | wc -c | tr -d ' ')
        [ "${LEN:-0}" -gt 1000 ] && ok "recorded Bob report retrieved (${LEN} bytes)" || bad "recorded report is empty"
      else bad "demo execution ended as '$ST'" "$RUNTIME compose logs backend"; fi
    fi
  fi
else
  warn "could not sign in with ADMIN_PASSWORD from deployment/.env. The admin account is created only when the demo database is empty; if it already exists use its original password, or recreate it with: scripts/deploy_psh.sh --reset-data (deletes the demo history)."
fi
rm -f "$JAR"
[ "$FAILURES" -eq 0 ] || die "verification failed"

# ================================================================================================
printf '\n%s✔ Deployment complete - STREAM_MODE=mock (demo)%s\n\n' "$C_GRN$C_BLD" "$C_RST"
cat <<EOF
  Open            http://localhost:$HTTP_PORT_WANTED${TLS_NOTE:-}
  Sign in         $ADMIN_USER / the ADMIN_PASSWORD in deployment/.env   (grep '^ADMIN_PASSWORD=' deployment/.env)
  Check           header shows "Bob: Demo - Connected" and a STREAM_MODE=mock tag
  In the UI       Bob Connection -> Repository -> QSE Configuration -> Execution Workspace (any values are accepted and ignored)

  Logs            $RUNTIME compose -f deployment/docker-compose.yml logs -f backend
  Stop            scripts/deploy_psh.sh --down
  Real analysis   scripts/deploy_local.sh   (stops these containers first)

  The verification run above created one demo execution in the demo history; it is labelled DEMO.
EOF
[ "$WARNINGS" -eq 0 ] || printf '\n%s warning(s) above - review them.\n' "$WARNINGS"
trap - EXIT
