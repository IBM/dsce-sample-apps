#!/bin/bash

# ============================================================================
#   Three-phase Spike Test Runner for retail_spike.jmx
#   Warm-up → Spike → Cool-down
#   Now supports dynamic serverHost passed as CLI argument.
#
#   Usage:
#      ./run_spike.sh <server-hostname>
#
#   Example:
#      ./run_spike.sh retail-backend-retail.tbb-us-east-1....
#
# ============================================================================

# ------------------------------
#  Validate Input
# ------------------------------
SERVER_HOST="$1"

if [ -z "$SERVER_HOST" ]; then
  echo "ERROR: No serverHost provided."
  echo "Usage: ./run_spike.sh <server-hostname>"
  exit 1
fi

echo "============================================================"
echo "  Running Spike Test Against Server Host:"
echo "      $SERVER_HOST"
echo "============================================================"


# ------------------------------
#  Locations
# ------------------------------
JMETER_BIN="/opt/jmeter/apache-jmeter-5.6.3/bin/jmeter"
JMX="./retail_spike.jmx"


# ------------------------------
#  Phase configuration
# ------------------------------

# Phase 1 – Warm-up
WARM_USERS=20
WARM_RAMP=10
WARM_LOOPS=1
WARM_LOG="warmup.jtl"

# Phase 2 – Spike (5 min sustained load)
SPIKE_USERS=300
SPIKE_RAMP=90
SPIKE_LOOPS=80
SPIKE_LOG="spike_5min.jtl"

# Phase 3 – Cool-down
COOL_USERS=40
COOL_RAMP=20
COOL_LOOPS=1
COOL_LOG="cooldown.jtl"


# ------------------------------
#  Execute a test phase
# ------------------------------
run_phase() {
  local USERCOUNT=$1
  local RAMP=$2
  local LOOPS=$3
  local LOG=$4
  local NAME=$5

  echo ""
  echo "============================================================"
  echo " Running Phase: $NAME"
  echo " Users=$USERCOUNT  Ramp=$RAMP  Loops=$LOOPS"
  echo " Log File: $LOG"
  echo " Server Host: $SERVER_HOST"
  echo "============================================================"
  echo ""

  $JMETER_BIN -n \
    -t "$JMX" \
    -l "$LOG" \
    -Jusers="$USERCOUNT" \
    -Jramp="$RAMP" \
    -Jloops="$LOOPS" \
    -JserverHost="$SERVER_HOST"

  echo ""
  echo "Completed Phase: $NAME"
  echo "------------------------------------------------------------"
  echo ""
}


# ============================================================================
#   Run the phases sequentially
# ============================================================================

run_phase "$WARM_USERS"  "$WARM_RAMP"  "$WARM_LOOPS"  "$WARM_LOG"  "1) Warm-up"
sleep 10

run_phase "$SPIKE_USERS" "$SPIKE_RAMP" "$SPIKE_LOOPS" "$SPIKE_LOG" "2) 5-min SPIKE"
sleep 10

run_phase "$COOL_USERS"  "$COOL_RAMP"  "$COOL_LOOPS"  "$COOL_LOG"  "3) Cool-down"

echo "============================================================"
echo "                ALL PHASES COMPLETED"
echo " Warm-up log  : $WARM_LOG"
echo " Spike log    : $SPIKE_LOG"
echo " Cool-down log: $COOL_LOG"
echo "============================================================"

