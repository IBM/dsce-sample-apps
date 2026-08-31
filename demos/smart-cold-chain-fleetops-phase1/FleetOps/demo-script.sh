#!/bin/bash

###############################################################################
# FleetOps Demo Script
# Demonstrates Manual vs Automated mode by forcing trucks into a critical state.
#
# Usage:
#   ./demo-script.sh [FLEETOPS_URL]
#
# Arguments:
#   FLEETOPS_URL  Base URL of the running FleetOps app.
#                 Defaults to http://localhost:4000
#
# Examples:
#   ./demo-script.sh                                  # local dev
#   ./demo-script.sh https://fleetops.example.com    # deployed instance
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration — accept URL from argument, then .env, then default
FLEETOPS_URL="${1:-${FLEETOPS_URL:-http://localhost:4000}}"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  🎬 FleetOps Demo Script${NC}"
echo -e "${BLUE}  Manual vs Automated Mode Demonstration${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check if FleetOps is running
echo -e "${YELLOW}Checking if FleetOps is running...${NC}"
if ! curl -s -f "$FLEETOPS_URL/health" > /dev/null; then
    echo -e "${RED}❌ FleetOps not responding${NC}"
    echo "Please start FleetOps first:"
    echo "  cd FleetOps && npm start"
    exit 1
fi
echo -e "${GREEN}✅ FleetOps is running${NC}"
echo ""

# Show demo info
echo -e "${CYAN}Demo Endpoints Available:${NC}"
curl -s "$FLEETOPS_URL/api/demo/info" | grep -E "method|path|description" || echo "Demo endpoints ready"
echo ""

# ============================================================================
# PHASE 1: MANUAL MODE DEMO
# ============================================================================

echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  PHASE 1: MANUAL MODE DEMONSTRATION${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""

echo -e "${CYAN}Step 1: Forcing TRUCK-003 to CRITICAL state...${NC}"
RESPONSE=$(curl -s -X POST "$FLEETOPS_URL/api/demo/force-critical/TRUCK-003")
echo "$RESPONSE" | grep -q "success.*true" && echo -e "${GREEN}✅ TRUCK-003 is now CRITICAL (-5.0°C)${NC}" || echo -e "${RED}❌ Failed${NC}"
echo ""

echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  ⏸️  DEMO PAUSE - MANUAL MODE                         ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}NOW DEMONSTRATE:${NC}"
echo "  1. Open FleetOps dashboard: $FLEETOPS_URL"
echo "  2. Show Operations tab - TRUCK-003 is RED/CRITICAL"
echo "  3. Go to Guardrails tab - Click 'Start Monitor'"
echo "  4. Go to Observe & Optimize - Execute Turbonomic action"
echo "  5. Wait 10-20 seconds for scaling detection"
echo "  6. Show Activity Log: '⚠️ Manual intervention required'"
echo "  7. Return to Operations - Manually send 'Emergency_Cooling_On'"
echo "  8. Show Activity Log: Manual command sent"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Press ENTER when ready to continue to Phase 2...     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
read -p ""
echo ""

# ============================================================================
# PHASE 2: AUTOMATED MODE DEMO
# ============================================================================

echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  PHASE 2: AUTOMATED MODE DEMONSTRATION${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""

echo -e "${CYAN}Step 2: Forcing TRUCK-004 to CRITICAL state...${NC}"
RESPONSE=$(curl -s -X POST "$FLEETOPS_URL/api/demo/force-critical/TRUCK-004")
echo "$RESPONSE" | grep -q "success.*true" && echo -e "${GREEN}✅ TRUCK-004 is now CRITICAL (-5.0°C)${NC}" || echo -e "${RED}❌ Failed${NC}"
echo ""

echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  ⏸️  DEMO PAUSE - AUTOMATED MODE                      ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}NOW DEMONSTRATE:${NC}"
echo "  1. Click 'Auto' button in header (switch to automated mode)"
echo "  2. Show Operations tab - TRUCK-004 is RED/CRITICAL"
echo "  3. Execute Turbonomic action again"
echo "  4. Show Activity Log: '🚀 Automated sequence executing'"
echo "  5. Watch automation:"
echo "     - Emergency_Cooling_On sent automatically"
echo "     - Truck rerouted to nearest station"
echo "     - Resume original route after 5 minutes"
echo "  6. Show Instana metrics improving"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Press ENTER when ready to finish demo...             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
read -p ""
echo ""

# ============================================================================
# CLEANUP AND RESULTS
# ============================================================================

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  Demo Complete!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

echo -e "${CYAN}Current Truck Status:${NC}"
curl -s "$FLEETOPS_URL/api/trucks" | grep -E "TRUCK-003|TRUCK-004" || echo "Check dashboard"
echo ""

echo -e "${CYAN}Active Alerts:${NC}"
ALERT_COUNT=$(curl -s "$FLEETOPS_URL/api/alerts" | grep -c "critical" || echo "0")
echo "$ALERT_COUNT critical alerts"
echo ""

echo -e "${GREEN}✅ Demo script finished successfully!${NC}"
echo ""
echo -e "${YELLOW}Optional: Reset trucks to normal state${NC}"
echo "  curl -X POST $FLEETOPS_URL/api/demo/reset-truck/TRUCK-003"
echo "  curl -X POST $FLEETOPS_URL/api/demo/reset-truck/TRUCK-004"
echo ""

# Made with Bob