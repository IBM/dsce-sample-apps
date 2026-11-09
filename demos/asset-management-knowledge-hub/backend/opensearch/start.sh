#!/usr/bin/env bash
# =============================================================================
# backend/opensearch/start.sh
#
# Manage the local OpenSearch container for Maximo Knowledge Hub.
#
# Uses podman.exe so the command always targets the Windows Podman machine,
# regardless of whether this script runs from Git Bash, WSL, or PowerShell.
#
# Matches .env:
#   OPENSEARCH_HOST=https://localhost:9200
#   OPENSEARCH_USERNAME=admin
#   OPENSEARCH_PASSWORD=StrongPass@123!
#   OPENSEARCH_VERIFY_SSL=false
#
# USAGE (from repo root):
#   bash backend/opensearch/start.sh start     — create volume + run container
#   bash backend/opensearch/start.sh stop      — stop + remove container
#   bash backend/opensearch/start.sh restart   — stop then start
#   bash backend/opensearch/start.sh status    — show container state
#   bash backend/opensearch/start.sh health    — query /_cluster/health
#   bash backend/opensearch/start.sh logs      — tail live logs (Ctrl+C to quit)
#   bash backend/opensearch/start.sh reset     — stop + delete volume (wipes all data!)
# =============================================================================

set -euo pipefail

CONTAINER="maximo-opensearch"
DASH_CONTAINER="maximo-opensearch-dashboards"
NETWORK="maximo-opensearch-net"
VOLUME="maximo-opensearch-data"
IMAGE="docker.io/opensearchproject/opensearch:2.11.0"
DASH_IMAGE="docker.io/opensearchproject/opensearch-dashboards:2.11.0"
OS_USER="admin"
OS_PASS="admin"

# Ports
HTTP_PORT=9200
PERF_PORT=9600
DASH_PORT=5601

CMD="${1:-start}"

# ── Resolve podman binary ──────────────────────────────────────────────────────
# Prefer podman.exe (Windows native) so we always talk to the correct Podman machine.
if command -v podman.exe &>/dev/null; then
  PODMAN="podman.exe"
elif command -v podman &>/dev/null; then
  PODMAN="podman"
else
  printf '\033[31m[✗]\033[0m podman / podman.exe not found on PATH.\n' >&2
  printf '    Install Podman Desktop from https://podman-desktop.io and ensure it is on PATH.\n' >&2
  exit 1
fi

# ── Colour helpers ─────────────────────────────────────────────────────────────
info() { printf '\033[36m[*]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[✓]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[✗]\033[0m %s\n' "$*" >&2; exit 1; }

# ── ensure shared network exists ──────────────────────────────────────────────
ensure_network() {
  if ! $PODMAN network exists "$NETWORK" 2>/dev/null; then
    info "Creating Podman network '$NETWORK'..."
    $PODMAN network create "$NETWORK"
    ok "Network created."
  fi
}

# ── stop ──────────────────────────────────────────────────────────────────────
do_stop() {
  if ! $PODMAN container exists "$CONTAINER" 2>/dev/null; then
    warn "Container '$CONTAINER' not found — nothing to stop."
  else
    info "Stopping '$CONTAINER'..."
    $PODMAN stop "$CONTAINER" 2>/dev/null || true
    $PODMAN rm   "$CONTAINER" 2>/dev/null || true
    ok "Stopped and removed. Volume '$VOLUME' preserved (data safe)."
  fi
  # Also stop the dashboard if running
  if $PODMAN container exists "$DASH_CONTAINER" 2>/dev/null; then
    info "Stopping '$DASH_CONTAINER'..."
    $PODMAN stop "$DASH_CONTAINER" 2>/dev/null || true
    $PODMAN rm   "$DASH_CONTAINER" 2>/dev/null || true
    ok "Dashboard stopped."
  fi
}

# ── reset (wipe data) ─────────────────────────────────────────────────────────
do_reset() {
  warn "This will DELETE all OpenSearch data in volume '$VOLUME'!"
  read -rp "  Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || { warn "Cancelled."; return; }
  do_stop
  info "Removing volume '$VOLUME'..."
  $PODMAN volume rm "$VOLUME" 2>/dev/null || true
  ok "Volume deleted. Run 'start' to create a fresh instance."
}

# ── start ─────────────────────────────────────────────────────────────────────
do_start() {
  # 1 — create named volume (idempotent)
  if ! $PODMAN volume exists "$VOLUME" 2>/dev/null; then
    info "Creating volume '$VOLUME'..."
    $PODMAN volume create "$VOLUME"
    ok "Volume created."
  else
    ok "Volume '$VOLUME' already exists."
  fi

  # 2 — handle existing container
  if $PODMAN container exists "$CONTAINER" 2>/dev/null; then
    state=$($PODMAN inspect "$CONTAINER" --format "{{.State.Status}}" 2>/dev/null || echo "unknown")
    if [[ "$state" == "running" ]]; then
      ok "'$CONTAINER' is already running."
      do_health
      return
    fi
    info "Removing stopped container '$CONTAINER'..."
    $PODMAN rm "$CONTAINER"
  fi

  # 3 — ensure shared network then run the container
  ensure_network
  info "Starting OpenSearch (HTTPS :${HTTP_PORT}, security enabled)..."
  $PODMAN run -d \
    --name    "$CONTAINER" \
    --network "$NETWORK" \
    -p "${HTTP_PORT}:9200" \
    -p "${PERF_PORT}:9600" \
    -e "discovery.type=single-node" \
    -e "OPENSEARCH_INITIAL_ADMIN_PASSWORD=${OS_PASS}" \
    -e "DISABLE_SECURITY_PLUGIN=false" \
    -e "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m" \
    -v "${VOLUME}:/usr/share/opensearch/data:z" \
    "$IMAGE"

  ok "Container started. Waiting for cluster health (up to 120 s)..."
  echo ""

  # 4 — poll cluster health via exec (avoids host TLS trust issues)
  ready=0
  for i in $(seq 1 24); do
    sleep 5
    result=$($PODMAN exec "$CONTAINER" \
      curl -sk -u "${OS_USER}:${OS_PASS}" \
      "https://localhost:9200/_cluster/health" 2>/dev/null || true)
    if echo "$result" | grep -qE '"status":"(green|yellow)"'; then
      ready=1
      break
    fi
    printf '  ... attempt %2d / 24  (response: %s)\n' "$i" "${result:0:80}"
  done

  echo ""
  if [[ $ready -eq 1 ]]; then
    printf '\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n'
    printf '\033[32m ✅  OpenSearch is UP  →  https://localhost:%s\033[0m\n' "$HTTP_PORT"
    printf '\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n'
    echo ""
    echo "  Next step      : bash backend/opensearch/setup-indexes.sh"
    echo "  Start dashboard: bash backend/opensearch/start.sh dashboard"
    echo "  Health         : bash backend/opensearch/start.sh health"
    echo "  Tail logs      : bash backend/opensearch/start.sh logs"
    echo "  Stop           : bash backend/opensearch/start.sh stop"
    echo ""
  else
    die "OpenSearch did not become healthy in 120 s. Run: bash backend/opensearch/start.sh logs"
  fi
}

# ── status ────────────────────────────────────────────────────────────────────
do_status() {
  $PODMAN ps -a --filter "name=^${CONTAINER}$" \
    --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}"
}

# ── health ────────────────────────────────────────────────────────────────────
do_health() {
  info "Querying cluster health at https://localhost:${HTTP_PORT}/_cluster/health ..."
  $PODMAN exec "$CONTAINER" \
    curl -sk -u "${OS_USER}:${OS_PASS}" \
    "https://localhost:9200/_cluster/health?pretty"
}

# ── dashboard ─────────────────────────────────────────────────────────────────
do_dashboard() {
  # Ensure OpenSearch is running first
  if ! $PODMAN container exists "$CONTAINER" 2>/dev/null; then
    die "OpenSearch is not running. Run: bash backend/opensearch/start.sh start"
  fi
  state=$($PODMAN inspect "$CONTAINER" --format "{{.State.Status}}" 2>/dev/null || echo "unknown")
  [[ "$state" == "running" ]] || die "OpenSearch container is not running (state: $state). Start it first."

  ensure_network

  # Connect OpenSearch to the network if not already connected
  if ! $PODMAN network inspect "$NETWORK" --format "{{range .Containers}}{{.Name}} {{end}}" 2>/dev/null | grep -q "$CONTAINER"; then
    info "Connecting '$CONTAINER' to network '$NETWORK'..."
    $PODMAN network connect "$NETWORK" "$CONTAINER" 2>/dev/null || true
  fi

  # Remove existing dashboard container if stopped
  if $PODMAN container exists "$DASH_CONTAINER" 2>/dev/null; then
    dash_state=$($PODMAN inspect "$DASH_CONTAINER" --format "{{.State.Status}}" 2>/dev/null || echo "unknown")
    if [[ "$dash_state" == "running" ]]; then
      ok "Dashboard is already running → http://localhost:${DASH_PORT}"
      return
    fi
    info "Removing stopped dashboard container..."
    $PODMAN rm "$DASH_CONTAINER" 2>/dev/null || true
  fi

  info "Starting OpenSearch Dashboards on http://localhost:${DASH_PORT} ..."
  $PODMAN run -d \
    --name    "$DASH_CONTAINER" \
    --network "$NETWORK" \
    -p "${DASH_PORT}:5601" \
    -e "OPENSEARCH_HOSTS=https://${CONTAINER}:9200" \
    -e "OPENSEARCH_USERNAME=${OS_USER}" \
    -e "OPENSEARCH_PASSWORD=${OS_PASS}" \
    -e "OPENSEARCH_SSL_VERIFICATIONMODE=none" \
    -e "SERVER_HOST=0.0.0.0" \
    "$DASH_IMAGE"

  info "Waiting for Dashboard to become ready (up to 120 s)..."
  ready=0
  for i in $(seq 1 24); do
    sleep 5
    status=$(curl -sk -o /dev/null -w "%{http_code}" "http://localhost:${DASH_PORT}/api/status" 2>/dev/null || true)
    if [[ "$status" == "200" ]]; then
      ready=1
      break
    fi
    printf '  ... attempt %2d / 24  (HTTP %s)\n' "$i" "$status"
  done

  echo ""
  if [[ $ready -eq 1 ]]; then
    printf '\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n'
    printf '\033[32m ✅  OpenSearch Dashboards → http://localhost:%s\033[0m\n' "$DASH_PORT"
    printf '\033[32m     Login: %s / %s\033[0m\n' "$OS_USER" "$OS_PASS"
    printf '\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n'
    echo ""
    echo "  Stop: bash backend/opensearch/start.sh stop"
    echo ""
  else
    warn "Dashboard did not become ready in 120 s."
    warn "Check logs: $PODMAN logs $DASH_CONTAINER"
  fi
}

# ── logs ──────────────────────────────────────────────────────────────────────
do_logs() {
  info "Tailing logs for '$CONTAINER' (Ctrl+C to stop)..."
  $PODMAN logs -f "$CONTAINER"
}

do_dashboard_logs() {
  info "Tailing dashboard logs for '$DASH_CONTAINER' (Ctrl+C to stop)..."
  $PODMAN logs -f "$DASH_CONTAINER"
}

# ── dispatch ──────────────────────────────────────────────────────────────────
case "$CMD" in
  start)           do_start          ;;
  stop)            do_stop           ;;
  restart)         do_stop; do_start ;;
  status)          do_status         ;;
  health)          do_health         ;;
  logs)            do_logs           ;;
  reset)           do_reset          ;;
  dashboard)       do_dashboard      ;;
  dashboard-logs)  do_dashboard_logs ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|health|logs|reset|dashboard|dashboard-logs}"
    exit 1
    ;;
esac
