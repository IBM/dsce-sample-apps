#!/usr/bin/env bash
# deploy_ce.sh - END-TO-END deployment of the QSE Automation Workbench DEMO (STREAM_MODE=mock) on IBM Cloud Code Engine.
#
# Same demo as scripts/deploy_psh.sh, hosted on Code Engine as two applications in one project:
#   qse-workbench-frontend  NGINX + the React UI. PUBLIC https endpoint.
#   qse-workbench-backend   Express API with the recorded run. PROJECT-ONLY endpoint (not reachable from the internet).
# The images are built by Code Engine from a staged copy of the sources (no local container engine needed, and no
# .env file is ever uploaded). The demo replays a RECORDED real run: Headless Bob, GitHub, the QSE CLI and Java are
# never contacted or needed. Real analysis (STREAM_MODE=realtime) needs Headless Bob and shared volumes and is
# not supported on Code Engine; use scripts/deploy_local.sh for it.
#
# What it does:  prerequisite checks -> log in / target -> project -> secret (generated once, kept locally in
#                deployment/.env.codeengine) -> build + deploy backend -> build + deploy frontend -> verify the chain.
#
# Usage:   scripts/deploy_ce.sh [options]
#   --region R                Code Engine region (e.g. us-south, eu-de)   [current target, else us-south]
#   --resource-group G        resource group                              [current target, else default]
#   --project NAME            Code Engine project (created if missing)    [qse-workbench]
#   --no-build                redeploy the existing images with the current configuration (skip the image builds)
#   --down                    delete both applications, the secret and the configmap, then exit (project is kept)
#   --check                   run the prerequisite checks only, change nothing
#   -h, --help                show this help
# Environment:  IBMCLOUD_API_KEY (non-interactive login), CE_REGION, CE_RESOURCE_GROUP, CE_PROJECT.
# Needs:        IBM Cloud CLI 2.x with the code-engine plugin (>= 1.30), and IAM access to create a Code Engine project
#               and apps (Editor/Writer) and to use IBM Cloud Container Registry (Reader, Writer, Manager) because the
#               built images are stored there; Code Engine creates the namespace and registry secret itself.
# Data:         history lives on the instance's ephemeral disk (SQLite). Every deployment, restart or scale event
#               starts from an empty history and recreates the admin account from deployment/.env.codeengine.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
. "$ROOT/scripts/lib/common.sh"

STAGE_ROOT=""
JAR=""
cleanup() { [ -z "$STAGE_ROOT" ] || rm -rf "$STAGE_ROOT"; [ -z "$JAR" ] || rm -f "$JAR"; }
finish() { cleanup; trap - EXIT; exit "${1:-0}"; }
# Same hint as on_exit_hint (common.sh), but the exit status is captured BEFORE cleanup can overwrite it.
exit_trap() {
  local rc=$?
  cleanup
  if [ "$rc" -ne 0 ]; then
    printf '\n%sDeployment did not complete (exit %s).%s Logs, if any, are in %s\n' "$C_RED" "$rc" "$C_RST" "${RUN_DIR#"$ROOT"/}/" >&2
  fi
}
trap exit_trap EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export IBMCLOUD_COLOR=false IBMCLOUD_VERSION_CHECK=false

DEPLOY_DIR="$ROOT/deployment"
SECRETS_FILE="$DEPLOY_DIR/.env.codeengine"
REGION="${CE_REGION:-}"
RG="${CE_RESOURCE_GROUP:-}"
PROJECT="${CE_PROJECT:-qse-workbench}"
BUILD=1
ACTION=deploy
MIN_PLUGIN=1.30.0
BACKEND_APP=qse-workbench-backend
FRONTEND_APP=qse-workbench-frontend
SECRET_NAME=qse-workbench-secrets
CM_NAME=qse-workbench-nginx
# Valid vCPU/memory pairs (docs: supported memory and CPU combinations). Ephemeral storage is bounded by memory.
BACKEND_CPU=0.5;   BACKEND_MEMORY=1G
FRONTEND_CPU=0.25; FRONTEND_MEMORY=0.5G

while [ $# -gt 0 ]; do
  case "$1" in
    --region)         REGION="${2:?--region needs a value}"; shift 2 ;;
    --resource-group) RG="${2:?--resource-group needs a value}"; shift 2 ;;
    --project)        PROJECT="${2:?--project needs a name}"; shift 2 ;;
    --no-build)       BUILD=0; shift ;;
    --down)           ACTION=down; shift ;;
    --check)          ACTION=check; shift ;;
    -h|--help)        awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; trap - EXIT; exit 0 ;;
    *)                die "unknown option: $1 (see --help)" ;;
  esac
done
printf '%s' "$PROJECT" | grep -Eq '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' || die "--project must be 1-63 lowercase letters, digits or hyphens, starting and ending with a letter or digit"
mkdir -p "$RUN_DIR"

# ---- helpers --------------------------------------------------------------------------------
app_exists() { ibmcloud ce app get --name "$1" >/dev/null 2>&1; }
app_url()    { ibmcloud ce app get --name "$1" --output url 2>/dev/null | grep -E '^https?://' | tail -1 || true; }

ce_apply_app() { # name logfile flags...   (create when absent, update when present)
  local name=$1 log=$2
  shift 2
  if app_exists "$name"; then run_logged "update application $name" "$log" ibmcloud ce app update --name "$name" "$@"
  else run_logged "create application $name" "$log" ibmcloud ce app create --name "$name" "$@"; fi
}

# stage_backend / stage_frontend copy ONLY what each Dockerfile needs (explicit allow-list), so no .env file,
# node_modules, local database or test file can reach the Code Engine build.
new_stage_root() { [ -n "$STAGE_ROOT" ] || STAGE_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/qse-ce.XXXXXX"); }
stage_backend() {
  new_stage_root
  local d="$STAGE_ROOT/backend_ctx"
  rm -rf "$d"; mkdir -p "$d"
  ( cd "$ROOT/backend" && cp Dockerfile package.json package-lock.json tsconfig.json tsconfig.build.json "$d/" && cp -R src demo-data "$d/" )
}
stage_frontend() {
  new_stage_root
  local d="$STAGE_ROOT/frontend_ctx"
  rm -rf "$d"; mkdir -p "$d/frontend" "$d/deployment/nginx"
  ( cd "$ROOT/frontend" && cp Dockerfile package.json package-lock.json tsconfig.json vite.config.ts index.html "$d/frontend/" && cp -R public src "$d/frontend/" )
  cp "$DEPLOY_DIR/nginx/default.conf.template" "$d/deployment/nginx/"
}
# check_copy_sources DOCKERFILE CONTEXT -> prints every COPY source (non --from) that is missing from CONTEXT
check_copy_sources() {
  local df=$1 ctx=$2 src
  awk '/^COPY[[:space:]]/ { if ($0 ~ /--from=/) next; for (i = 2; i < NF; i++) if ($i !~ /^--/) print $i }' "$df" | while read -r src; do
    [ -e "$ctx/$src" ] || echo "$src"
  done
}
# The repository template forwards the client Host header. Code Engine routes application-to-application calls by Host,
# so the backend call would go back to the frontend. This variant lets NGINX send the upstream's own host name instead.
# X-Forwarded-Host (the public host, used by the backend's origin check) is unchanged.
make_ce_nginx_template() { # outfile
  mkdir -p "$(dirname "$1")"
  sed 's/proxy_set_header Host \$http_host;/proxy_set_header Host $proxy_host;/' "$DEPLOY_DIR/nginx/default.conf.template" >"$1"
  [ "$(grep -c 'proxy_set_header Host \$proxy_host;' "$1")" -ge 2 ] && ! grep -q 'proxy_set_header Host \$http_host;' "$1"
}

verify_chain() { # base-url
  local base=$1 admin_user admin_pw body login csrf mode bob_state repo repo_id repo_status qse_status exec_json exec_id st t rep len
  JAR=$(mktemp "${TMPDIR:-/tmp}/qse-jar.XXXXXX")
  admin_user=$(env_get "$SECRETS_FILE" ADMIN_USERNAME); admin_user="${admin_user:-admin}"
  admin_pw=$(env_get "$SECRETS_FILE" ADMIN_PASSWORD)
  body=$(ADMIN_USER="$admin_user" ADMIN_PW="$admin_pw" node -e 'process.stdout.write(JSON.stringify({username:process.env.ADMIN_USER,password:process.env.ADMIN_PW}))' 2>/dev/null || ADMIN_USER="$admin_user" ADMIN_PW="$admin_pw" python3 -c 'import json,os;print(json.dumps({"username":os.environ["ADMIN_USER"],"password":os.environ["ADMIN_PW"]}))' 2>/dev/null || true)
  login=$(curl -s -m 20 -c "$JAR" -H 'content-type: application/json' -d "$body" "$base/api/auth/login" 2>/dev/null || true)
  csrf=$(printf '%s' "$login" | json_get csrfToken)
  if [ -z "$csrf" ]; then
    bad "could not sign in as '$admin_user' with the ADMIN_PASSWORD in deployment/.env.codeengine" "the backend may still be starting: ibmcloud ce app logs --application $BACKEND_APP --tail 50"
    return 0
  fi
  ok "signed in as '$admin_user' through the public URL"
  api() { curl -s -m 30 -b "$JAR" -H "x-csrf-token: $csrf" -H 'content-type: application/json' "$@"; }
  mode=$(api "$base/api/settings" | json_get streamMode)
  [ "$mode" = mock ] && ok "GET /api/settings reports streamMode=mock" || bad "GET /api/settings reports streamMode='$mode'"
  bob_state=$(api -X POST -d '{"endpoint":"http://demo.invalid:8000","adapter":"rest-threads","apiBasePath":"/api/v1","authMode":"bearer","apiKey":"demo-key-not-used"}' "$base/api/bob/connect" | json_get state)
  [ "$bob_state" = connected ] && ok "Bob connection (recorded): connected" || bad "demo Bob connection returned state '$bob_state'"
  repo=$(api -X POST -d '{"url":"https://github.com/demo/demo","branch":"main"}' "$base/api/repositories/clone")
  repo_id=$(printf '%s' "$repo" | json_get id); repo_status=$(printf '%s' "$repo" | json_get status)
  [ "$repo_status" = cloned ] && ok "repository (recorded): cloned, $(printf '%s' "$repo" | json_get fileCount) files" || bad "demo repository status '$repo_status'"
  qse_status=$(api -X POST -d '{"mode":"auto"}' "$base/api/qse/configure" | json_get status)
  [ "$qse_status" = valid ] && ok "QSE CLI (recorded): valid" || bad "demo QSE status '$qse_status'"
  if [ -n "$repo_id" ] && [ "$FAILURES" -eq 0 ]; then
    exec_json=$(api -X POST -d "{\"repositoryId\":\"$repo_id\",\"prompt\":\"Code Engine deployment smoke test of the recorded demo\"}" "$base/api/executions")
    exec_id=$(printf '%s' "$exec_json" | json_get id)
    if [ -z "$exec_id" ]; then bad "could not start a demo execution: $(printf '%s' "$exec_json" | cut -c1-120)"
    else
      note "replaying the recorded execution $exec_id (about 20-30 s) ..."
      st=""; t=0
      while [ "$t" -lt 150 ]; do
        st=$(api "$base/api/executions/$exec_id" | json_get status)
        case "$st" in completed|failed|cancelled) break ;; esac
        sleep 3; t=$((t + 3))
      done
      if [ "$st" = completed ]; then
        ok "execution completed (demo replay)"
        rep=$(api "$base/api/executions/$exec_id/report")
        [ "$(printf '%s' "$rep" | json_get mock)" = true ] && ok "report is flagged as DEMO (recorded)" || bad "report is not flagged as a demo"
        len=$(printf '%s' "$rep" | json_get bobMarkdown | wc -c | tr -d ' ')
        [ "${len:-0}" -gt 1000 ] && ok "recorded Bob report retrieved (${len} bytes)" || bad "recorded report is empty"
      else bad "demo execution ended as '$st'" "ibmcloud ce app logs --application $BACKEND_APP --tail 100"; fi
    fi
  fi
  rm -f "$JAR"; JAR=""
}

# ---- login and target (shared by every action) ---------------------------------------------
ensure_login() { # sets LOGGED_IN; in check mode never changes the CLI session
  LOGGED_IN=0
  if ibmcloud iam oauth-tokens >/dev/null 2>&1; then LOGGED_IN=1; ok "logged in to IBM Cloud"
  elif [ -n "${IBMCLOUD_API_KEY:-}" ]; then
    if [ "$ACTION" = check ]; then ok "not logged in; IBMCLOUD_API_KEY is set, so a real run logs in with it"
    elif ibmcloud login --no-region -q >"$RUN_DIR/ibmcloud-login.log" 2>&1; then LOGGED_IN=1; ok "logged in with IBMCLOUD_API_KEY"
    else bad "login with IBMCLOUD_API_KEY failed" "check the key (log: ${RUN_DIR#"$ROOT"/}/ibmcloud-login.log)"; fi
  else
    bad "not logged in to IBM Cloud" "ibmcloud login --sso   (or export IBMCLOUD_API_KEY=<key> for a non-interactive run)"
  fi
}
resolve_target() {
  local cur cur_region cur_rg
  [ "$LOGGED_IN" -eq 1 ] || return 0
  cur=$(ibmcloud target --output json 2>/dev/null || true)
  cur_region=$(printf '%s' "$cur" | json_get region.name); cur_rg=$(printf '%s' "$cur" | json_get resource_group.name)
  REGION="${REGION:-${cur_region:-us-south}}"; RG="${RG:-${cur_rg:-default}}"
  if [ "$ACTION" = check ]; then
    ok "would target region $REGION, resource group $RG (currently: ${cur_region:-none} / ${cur_rg:-none})"
  elif ibmcloud target -r "$REGION" -g "$RG" >"$RUN_DIR/ibmcloud-target.log" 2>&1; then ok "targeting region $REGION, resource group $RG"
  else bad "could not target region '$REGION' / resource group '$RG'" "see ${RUN_DIR#"$ROOT"/}/ibmcloud-target.log; list groups with: ibmcloud resource groups"; fi
}

# ================================================================================================
if [ "$ACTION" = down ]; then
  step "Remove the Code Engine deployment"
  have ibmcloud || die "ibmcloud CLI is not installed"
  ensure_login; resolve_target; abort_if_failed
  if ! ibmcloud ce project select --name "$PROJECT" >"$RUN_DIR/ce-project-select.log" 2>&1; then
    ok "project '$PROJECT' does not exist in $REGION; nothing to remove"; finish 0
  fi
  for a in "$FRONTEND_APP" "$BACKEND_APP"; do
    ibmcloud ce app delete --name "$a" --force --ignore-not-found >"$RUN_DIR/ce-delete-$a.log" 2>&1 && ok "application $a removed (or absent)" || bad "could not delete $a" "see ${RUN_DIR#"$ROOT"/}/ce-delete-$a.log"
  done
  ibmcloud ce configmap delete --name "$CM_NAME" --force --ignore-not-found >/dev/null 2>&1 && ok "configmap $CM_NAME removed (or absent)" || bad "could not delete configmap $CM_NAME"
  ibmcloud ce secret delete --name "$SECRET_NAME" --force --ignore-not-found >/dev/null 2>&1 && ok "secret $SECRET_NAME removed (or absent)" || bad "could not delete secret $SECRET_NAME"
  [ "$FAILURES" -eq 0 ] || die "$FAILURES removal step(s) failed"
  note "kept: project '$PROJECT', the built images in Container Registry, and deployment/.env.codeengine"
  note "delete the project too:  ibmcloud ce project delete --name $PROJECT --hard"
  finish 0
fi

printf '%sQSE Automation Workbench - IBM Cloud Code Engine demo deployment (STREAM_MODE=mock)%s\n' "$C_BLD" "$C_RST"
printf 'Project: %s\n' "$ROOT"

# ================================================================================================
step "Operating system and basic tools"
check_os
check_tool curl    "install curl"
check_tool openssl "install openssl (used to generate the encryption key and password)"
check_tool awk     "install awk"
check_tool sed     "install sed"
check_tool mktemp  "install coreutils (mktemp)"
have node || have python3 || bad "neither node nor python3 is available to parse JSON" "install Node.js or Python 3 (only used by this script)"

step "IBM Cloud CLI and Code Engine plugin"
if ! have ibmcloud; then
  bad "the ibmcloud CLI is not installed" "https://cloud.ibm.com/docs/cli?topic=cli-getting-started  (macOS/Linux: curl -fsSL https://clis.cloud.ibm.com/install/osx | sh)"
else
  ok "$(ibmcloud version 2>/dev/null | head -1)"
  PLUGIN_VER=$(ibmcloud plugin list 2>/dev/null | awk '$1 ~ /^(code-engine|ce)(\[|$)/ { print $2; exit }' || true)
  if [ -z "$PLUGIN_VER" ]; then bad "the code-engine plugin is not installed" "ibmcloud plugin install code-engine"
  elif version_ge "$PLUGIN_VER" "$MIN_PLUGIN"; then ok "code-engine plugin $PLUGIN_VER (>= $MIN_PLUGIN, supports building from source)"
  else bad "code-engine plugin $PLUGIN_VER is older than $MIN_PLUGIN" "ibmcloud plugin update code-engine"; fi
fi

step "IBM Cloud login and target"
LOGGED_IN=0
if have ibmcloud; then ensure_login; resolve_target; fi

step "Project files"
for f in backend/Dockerfile backend/package.json backend/package-lock.json backend/tsconfig.json backend/tsconfig.build.json \
         frontend/Dockerfile frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html \
         deployment/nginx/default.conf.template backend/demo-data/recorded-run.json; do
  if [ -f "$ROOT/$f" ]; then ok "$f"; else bad "$f is missing" "restore it from the repository"; fi
done
for d in backend/src backend/demo-data frontend/src frontend/public; do
  if [ -d "$ROOT/$d" ]; then ok "$d/"; else bad "$d/ is missing" "restore it from the repository"; fi
done
if [ -f "$ROOT/backend/demo-data/recorded-run.json" ]; then
  MISSING=0
  for f in workspace/qse-e2e-report.md workspace/qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_cbom.json workspace/qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_findings_java.json workspace/qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_issue_summary.json; do
    [ -f "$ROOT/backend/demo-data/$f" ] || { bad "recorded demo file missing: backend/demo-data/$f" "restore backend/demo-data from the repository (the demo cannot start without it)"; MISSING=1; }
  done
  [ "$MISSING" -eq 0 ] && ok "recorded demo data complete"
fi

step "Build contexts (what Code Engine will receive)"
if [ "$FAILURES" -gt 0 ]; then
  note "skipped: fix the missing project files first"
else
  stage_backend; stage_frontend
  M=$(check_copy_sources "$STAGE_ROOT/backend_ctx/Dockerfile" "$STAGE_ROOT/backend_ctx" | tr '\n' ' ')
  [ -z "$M" ] && ok "backend context satisfies every COPY in backend/Dockerfile" || bad "backend context lacks: $M" "update stage_backend() in this script"
  M=$(check_copy_sources "$STAGE_ROOT/frontend_ctx/frontend/Dockerfile" "$STAGE_ROOT/frontend_ctx" | tr '\n' ' ')
  [ -z "$M" ] && ok "frontend context satisfies every COPY in frontend/Dockerfile" || bad "frontend context lacks: $M" "update stage_frontend() in this script"
  if find "$STAGE_ROOT" \( -name '.env*' -o -name node_modules -o -name '*.db' -o -name '*.sqlite*' \) | grep -q .; then
    bad "the staged contexts contain a secret or local-state file" "remove it from the source folders being staged"
  else ok "no .env file, node_modules or database in the contexts"; fi
  if make_ce_nginx_template "$STAGE_ROOT/nginx/default.conf.template"; then ok "NGINX template for Code Engine generated (upstream Host header = backend host)"
  else bad "could not adapt deployment/nginx/default.conf.template" "the 'proxy_set_header Host \$http_host;' lines changed; update make_ce_nginx_template()"; fi
fi

step "Network access"
for url in https://cloud.ibm.com https://iam.cloud.ibm.com/identity/.well-known/openid-configuration; do
  code=$(http_code "$url" 8)
  case "$code" in 000) bad "$url is not reachable" "check network, proxy or VPN" ;; *) ok "$url reachable (HTTP $code)" ;; esac
done

if [ "$LOGGED_IN" -eq 1 ]; then
  step "Existing Code Engine resources"
  if ibmcloud ce project get --name "$PROJECT" >/dev/null 2>&1; then
    ok "project '$PROJECT' exists"
    # Selecting a project only changes the local CLI context; nothing is changed in IBM Cloud.
    if ibmcloud ce project select --name "$PROJECT" >/dev/null 2>&1; then
      for a in "$BACKEND_APP" "$FRONTEND_APP"; do
        if app_exists "$a"; then note "$a exists and will be updated"; else note "$a does not exist and will be created"; fi
      done
    else warn "project '$PROJECT' exists but is not active yet (status other than active); the deployment waits for it"; fi
  else note "project '$PROJECT' does not exist yet and will be created"; fi
fi

if [ "$ACTION" = check ]; then
  step "Result"
  if [ "$FAILURES" -gt 0 ]; then bad "$FAILURES check(s) failed"; finish 1; fi
  ok "all prerequisite checks passed (nothing was changed in IBM Cloud)"
  finish 0
fi
abort_if_failed

# ================================================================================================
step "Project '$PROJECT' in $REGION"
if ibmcloud ce project get --name "$PROJECT" >/dev/null 2>&1; then ok "project exists"
else run_logged "create project $PROJECT" "$RUN_DIR/ce-project-create.log" ibmcloud ce project create --name "$PROJECT"; fi
T=0
until ibmcloud ce project select --name "$PROJECT" >"$RUN_DIR/ce-project-select.log" 2>&1; do
  T=$((T + 5)); [ "$T" -le 150 ] || die "project '$PROJECT' did not become active; see ${RUN_DIR#"$ROOT"/}/ce-project-select.log"
  sleep 5
done
ok "project '$PROJECT' selected"
if [ "$BUILD" -eq 0 ]; then
  for a in "$BACKEND_APP" "$FRONTEND_APP"; do app_exists "$a" || die "--no-build needs $a to exist already; run once without --no-build"; done
fi

step "Secrets: deployment/.env.codeengine"
if [ ! -f "$SECRETS_FILE" ]; then
  ( umask 077; printf 'SECRETS_KEYS=%s\nADMIN_USERNAME=admin\nADMIN_PASSWORD=%s\n' "$(gen_secrets_key)" "$(gen_password)" >"$SECRETS_FILE" )
  ok "created deployment/.env.codeengine (SECRETS_KEYS and ADMIN_PASSWORD generated)"
  note "read the admin password with: grep '^ADMIN_PASSWORD=' deployment/.env.codeengine"
fi
chmod 600 "$SECRETS_FILE"
[ -n "$(env_get "$SECRETS_FILE" SECRETS_KEYS)" ] && ok "SECRETS_KEYS present (kept)" || env_ensure "$SECRETS_FILE" SECRETS_KEYS "$(gen_secrets_key)" secret
env_default "$SECRETS_FILE" ADMIN_USERNAME admin
[ -n "$(env_get "$SECRETS_FILE" ADMIN_PASSWORD)" ] || env_ensure "$SECRETS_FILE" ADMIN_PASSWORD "$(gen_password)" secret
PW_LEN=$(env_get "$SECRETS_FILE" ADMIN_PASSWORD | awk '{ print length($0) }')
[ "${PW_LEN:-0}" -ge 12 ] || die "ADMIN_PASSWORD in deployment/.env.codeengine must be at least 12 characters"
if ibmcloud ce secret get --name "$SECRET_NAME" >/dev/null 2>&1; then
  run_logged "update secret $SECRET_NAME" "$RUN_DIR/ce-secret.log" ibmcloud ce secret update --name "$SECRET_NAME" --from-env-file "$SECRETS_FILE"
else
  run_logged "create secret $SECRET_NAME" "$RUN_DIR/ce-secret.log" ibmcloud ce secret create --name "$SECRET_NAME" --format generic --from-env-file "$SECRETS_FILE"
fi

# ================================================================================================
step "Backend: $BACKEND_APP (project-only endpoint, exactly one instance)"
# min=max=1: SQLite, sessions and execution state live in the instance, so a second instance would split them.
# --request-timeout 600 is the Code Engine maximum; live-update streams reconnect after that.
# TRUST_PROXY=2: client -> Code Engine ingress -> NGINX -> backend, so the rate limiter sees the real client address.
BACKEND_ARGS=(--port 8080 --cpu "$BACKEND_CPU" --memory "$BACKEND_MEMORY" --min-scale 1 --max-scale 1 --request-timeout 600 --cluster-local
  --env NODE_ENV=production --env STREAM_MODE=mock --env COOKIE_SECURE=true --env TRUST_PROXY=2
  --env-from-secret "$SECRET_NAME"
  --probe-ready type=http --probe-ready path=/readyz --probe-ready port=8080
  --probe-live type=http --probe-live path=/healthz --probe-live port=8080
  --wait --wait-timeout 600)
[ "$BUILD" -eq 1 ] && BACKEND_ARGS+=(--build-source "$STAGE_ROOT/backend_ctx" --build-strategy dockerfile --build-size medium --build-timeout 900)
ce_apply_app "$BACKEND_APP" "$RUN_DIR/ce-backend.log" "${BACKEND_ARGS[@]}"
BACKEND_URL=$(app_url "$BACKEND_APP")
case "$BACKEND_URL" in
  http://*.svc.cluster.local) ok "backend project-only address: $BACKEND_URL" ;;
  *) die "unexpected backend address '$BACKEND_URL' (expected http://<app>.<id>.svc.cluster.local). Check: ibmcloud ce app get --name $BACKEND_APP" ;;
esac

step "NGINX configuration for Code Engine (configmap $CM_NAME)"
CM_FILE="$STAGE_ROOT/nginx/default.conf.template"
if ibmcloud ce configmap get --name "$CM_NAME" >/dev/null 2>&1; then
  run_logged "update configmap $CM_NAME" "$RUN_DIR/ce-configmap.log" ibmcloud ce configmap update --name "$CM_NAME" --from-file "default.conf.template=$CM_FILE"
else
  run_logged "create configmap $CM_NAME" "$RUN_DIR/ce-configmap.log" ibmcloud ce configmap create --name "$CM_NAME" --from-file "default.conf.template=$CM_FILE"
fi

step "Frontend: $FRONTEND_APP (public endpoint)"
# Login-page prefill (demo convenience). Vite inlines VITE_* values into the public JavaScript, and Code Engine builds
# accept no --build-arg, so the ARG defaults are set in the STAGED copy of frontend/Dockerfile only; the repository
# Dockerfile stays blank. The values come from deployment/.env.codeengine, never from the source tree.
# Opt out with CE_LOGIN_PREFILL=0. It only takes effect when the image is built (not with --no-build).
if [ "$BUILD" -eq 1 ] && [ "${CE_LOGIN_PREFILL:-1}" = 1 ]; then
  PF_USER=$(env_get "$SECRETS_FILE" ADMIN_USERNAME); PF_PASS=$(env_get "$SECRETS_FILE" ADMIN_PASSWORD)
  PF_DF="$STAGE_ROOT/frontend_ctx/frontend/Dockerfile"
  if [ -n "$PF_USER" ] && [ -n "$PF_PASS" ] && printf '%s%s' "$PF_USER" "$PF_PASS" | grep -Eq '^[A-Za-z0-9._-]+$'; then
    sed -e "s/^ARG VITE_DEFAULT_USERNAME=.*/ARG VITE_DEFAULT_USERNAME=\"$PF_USER\"/" \
        -e "s/^ARG VITE_DEFAULT_PASSWORD=.*/ARG VITE_DEFAULT_PASSWORD=\"$PF_PASS\"/" "$PF_DF" >"$PF_DF.new" && mv "$PF_DF.new" "$PF_DF"
    if grep -q "^ARG VITE_DEFAULT_PASSWORD=\"$PF_PASS\"" "$PF_DF"; then
      warn "login page will be PREFILLED with the admin credentials from deployment/.env.codeengine; they are readable by anyone who opens the site (CE_LOGIN_PREFILL=0 disables)"
    else die "could not set the login prefill in the staged frontend Dockerfile"; fi
  else warn "login prefill skipped: ADMIN_USERNAME/ADMIN_PASSWORD missing or contain characters other than letters, digits . _ -"; fi
elif [ "$BUILD" -eq 0 ]; then note "--no-build: the login prefill is baked in at image build time, so the existing image is unchanged"; fi
FRONTEND_ARGS=(--port 8080 --cpu "$FRONTEND_CPU" --memory "$FRONTEND_MEMORY" --min-scale 1 --max-scale 2 --request-timeout 600 --no-cluster-local
  --env "BACKEND_UPSTREAM=$BACKEND_URL"
  --probe-ready type=http --probe-ready path=/nginx-health --probe-ready port=8080
  --probe-live type=http --probe-live path=/nginx-health --probe-live port=8080
  --wait --wait-timeout 600)
# A configmap mount directory must be unique, so add the mount only when the app does not have it yet.
# Passing it again on every run fails with "Mount directory ... is a duplicate".
if ! app_exists "$FRONTEND_APP" || ! ibmcloud ce app get --name "$FRONTEND_APP" --output json 2>/dev/null | grep -q '"mountPath": "/etc/nginx/templates"'; then
  FRONTEND_ARGS+=(--mount-configmap "/etc/nginx/templates=$CM_NAME")
fi
[ "$BUILD" -eq 1 ] && FRONTEND_ARGS+=(--build-source "$STAGE_ROOT/frontend_ctx" --build-dockerfile frontend/Dockerfile --build-strategy dockerfile --build-size medium --build-timeout 900)
ce_apply_app "$FRONTEND_APP" "$RUN_DIR/ce-frontend.log" "${FRONTEND_ARGS[@]}"
FRONTEND_URL=$(app_url "$FRONTEND_APP")
case "$FRONTEND_URL" in
  https://*) ok "frontend public address: $FRONTEND_URL" ;;
  *) die "unexpected frontend address '$FRONTEND_URL'. Check: ibmcloud ce app get --name $FRONTEND_APP" ;;
esac

# ================================================================================================
step "Verify the chain end to end (internet -> NGINX -> backend)"
wait_for_url "$FRONTEND_URL/nginx-health" 120 && ok "NGINX health endpoint answers" || die "NGINX does not answer at $FRONTEND_URL/nginx-health. Logs: ibmcloud ce app logs --application $FRONTEND_APP --tail 100"
if wait_for_url "$FRONTEND_URL/readyz" 90; then ok "backend ready through NGINX (the project-only hop works)"
else die "the backend is not reachable through NGINX at $FRONTEND_URL/readyz. Logs: ibmcloud ce app logs --application $FRONTEND_APP --tail 100 (a 'host not found' or 404 points to BACKEND_UPSTREAM / the Host header)"; fi
verify_chain "$FRONTEND_URL"
[ "$FAILURES" -eq 0 ] || die "verification failed"

# ================================================================================================
ADMIN_USER=$(env_get "$SECRETS_FILE" ADMIN_USERNAME); ADMIN_USER="${ADMIN_USER:-admin}"
printf '\n%s✔ Deployment complete - STREAM_MODE=mock (demo) on IBM Cloud Code Engine%s\n\n' "$C_GRN$C_BLD" "$C_RST"
cat <<EOF
  Open            $FRONTEND_URL
  Sign in         $ADMIN_USER / the ADMIN_PASSWORD in deployment/.env.codeengine   (grep '^ADMIN_PASSWORD=' deployment/.env.codeengine)
                  (the login form is prefilled with these when the image was built with CE_LOGIN_PREFILL=1, the default)
  Check           header shows "Bob: Demo - Connected" and a STREAM_MODE=mock tag
  In the UI       Bob Connection -> Repository -> QSE Configuration -> Execution Workspace (any values are accepted and ignored)

  Region/project  $REGION / $PROJECT   (resource group $RG)
  Logs            ibmcloud ce app logs --application $BACKEND_APP --follow
  Redeploy        scripts/deploy_ce.sh --project $PROJECT   (add --no-build to skip the image builds)
  Remove          scripts/deploy_ce.sh --down --project $PROJECT

  Limits          Execution history is kept on the instance's ephemeral disk: every deployment, restart or scale event
                  starts empty. Live-update streams are cut after 600 s (the Code Engine maximum) and reconnect.
                  The verification run above created one demo execution; it is labelled DEMO.
  Real analysis   not available on Code Engine (needs Headless Bob and shared volumes): scripts/deploy_local.sh
EOF
[ "$WARNINGS" -eq 0 ] || printf '\n%s warning(s) above - review them.\n' "$WARNINGS"
finish 0
