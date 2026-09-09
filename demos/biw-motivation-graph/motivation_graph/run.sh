#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BIW Motivation Graph — v2 DataFabric startup script
#
# Builds the full pipeline then launches API + opens all UIs.
#
# Usage:
#   ./run.sh              # full build (v2 dual-write lakehouse) + start API + open UIs
#   ./run.sh --demo       # CLI demo sequence (segments 1 + 2)
#   ./run.sh --seg1       # Segment 1 only (streaming + B4 money shot)
#   ./run.sh --seg2       # Segment 2 only (Motivation Graph payoff)
#   ./run.sh --stack      # Start local OSS docker-compose stack first, then full flow
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")"

# ── Resolve python / pip commands ────────────────────────────────────────────
PYTHON=$(command -v python3 || command -v python)
PIP=$(command -v pip3 || command -v pip)

DEMO=false
SEG1=false
SEG2=false
STACK=false

for arg in "$@"; do
  case $arg in
    --demo)   DEMO=true  ;;
    --seg1)   SEG1=true  ;;
    --seg2)   SEG2=true  ;;
    --stack)  STACK=true ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   BIW Motivation Graph — v2 DataFabric Demo Pipeline            ║"
echo "║   Seed: 20260812  |  All event data synthetic                   ║"
echo "║   Architecture: dual-write streaming lakehouse                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ── Optional: start local OSS stack ──────────────────────────────────────────
if $STACK; then
  echo "[stack] Starting local OSS stack via setup_local.py (auto-detects Docker / Homebrew / in-process)…"
  $PYTHON setup_local.py
fi

# ── Install dependencies ──────────────────────────────────────────────────────
if ! $PYTHON -c "import duckdb" 2>/dev/null; then
  echo "[setup] Installing Python dependencies…"
  $PIP install -r requirements.txt -q
fi

# ── Build pipeline ────────────────────────────────────────────────────────────
echo ""
echo "[build] Running v2 pipeline build…"
$PYTHON demo_runner.py --build

# ── Demo / segment mode ───────────────────────────────────────────────────────
if $SEG1; then
  $PYTHON demo_runner.py --seg1
  exit 0
fi

if $SEG2; then
  $PYTHON demo_runner.py --seg2
  exit 0
fi

if $DEMO; then
  $PYTHON demo_runner.py --demo
  exit 0
fi

# ── Start API server ──────────────────────────────────────────────────────────
echo ""
API_PORT="${PORT:-5050}"
if lsof -iTCP:"$API_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[api] Port $API_PORT is already in use; reusing the existing API server."
  API_PID=""
else
  echo "[api] Starting Flask API on http://localhost:$API_PORT …"
  PORT="$API_PORT" $PYTHON api.py &
  API_PID=$!
  sleep 1.5
fi

# ── Open UI ───────────────────────────────────────────────────────────────────
CONSOLE_UI="$(pwd)/ui/console.html"
APP_UI="$(pwd)/ui/app.html"
CONTROL_UI="$(pwd)/ui/control_view.html"

if command -v open &>/dev/null; then          # macOS
  if [ -f "$CONSOLE_UI" ]; then
    open "$CONSOLE_UI"
  else
    open "$CONTROL_UI"
    sleep 0.5
    open "$APP_UI"
  fi
elif command -v xdg-open &>/dev/null; then    # Linux
  if [ -f "$CONSOLE_UI" ]; then
    xdg-open "$CONSOLE_UI"
  else
    xdg-open "$CONTROL_UI"
    xdg-open "$APP_UI"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  API:             http://localhost:$API_PORT"
echo ""
echo "  v2 DataFabric endpoints:"
echo "    Sources (B6):  http://localhost:$API_PORT/api/v2/sources"
echo "    Pipeline:      http://localhost:$API_PORT/api/v2/pipeline/status"
echo "    B3 query:      http://localhost:$API_PORT/api/v2/federation/b3"
echo "    B4 moneyshot:  http://localhost:$API_PORT/api/v2/federation/b4"
echo "    Event inject:  POST http://localhost:$API_PORT/api/v2/events/inject"
echo "    Nudge (B5):    http://localhost:$API_PORT/api/nudge/seller-rachel-001"
echo ""
echo "  UIs:"
if [ -f "$CONSOLE_UI" ]; then
  echo "    Demo console:  file://$CONSOLE_UI"
else
  echo "    Control view:  file://$CONTROL_UI"
  echo "    Nudge UI:      file://$APP_UI"
fi
echo ""
if [ -n "$API_PID" ]; then
  echo "  Stop API:  kill $API_PID   (or Ctrl+C)"
else
  echo "  Stop API:  reuse existing process on port $API_PORT"
fi
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  Local OSS stack (if not using IBM-managed services):"
echo "    docker compose up -d     → Kafka · Cassandra · MinIO · Trino"
echo "    docker compose down -v   → tear down"
echo ""

if [ -n "$API_PID" ]; then
  wait $API_PID
fi
