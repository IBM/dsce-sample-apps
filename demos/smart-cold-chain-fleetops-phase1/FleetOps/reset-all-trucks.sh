#!/bin/bash

###############################################################################
# Reset All Trucks to Normal State
# Use this before starting a demo to ensure clean slate
###############################################################################

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
FLEETOPS_URL="http://localhost:4000"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  Resetting All Trucks to Normal State${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check if FleetOps is running
echo -e "${YELLOW}Checking FleetOps availability...${NC}"
if ! curl -s -f "$FLEETOPS_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ FleetOps is not running at $FLEETOPS_URL${NC}"
    echo ""
    echo "Please start FleetOps first:"
    echo "  cd FleetOps"
    echo "  ./run-docker.sh"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ FleetOps is running${NC}"
echo ""

# List of all trucks
TRUCKS=("TRUCK-001" "TRUCK-002" "TRUCK-003" "TRUCK-004" "TRUCK-005")

echo -e "${CYAN}Resetting trucks to normal state (-16.0°C)...${NC}"
echo ""

# Reset each truck
for TRUCK in "${TRUCKS[@]}"; do
    echo -e "${YELLOW}Resetting $TRUCK...${NC}"
    RESPONSE=$(curl -s -X POST "$FLEETOPS_URL/api/demo/reset-truck/$TRUCK")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ $TRUCK reset to normal (-16.0°C)${NC}"
    else
        echo -e "${RED}❌ Failed to reset $TRUCK${NC}"
        echo "Response: $RESPONSE"
    fi
    echo ""
done

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  All Trucks Reset Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${CYAN}Current Fleet Status:${NC}"
echo "  All trucks should now be at -16.0°C (normal)"
echo "  All trucks should show 'normal' coolant status"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Open FleetOps dashboard: $FLEETOPS_URL"
echo "  2. Verify all trucks show green status"
echo "  3. Start your demo with: ./demo-script.sh"
echo ""
echo -e "${CYAN}Quick Commands:${NC}"
echo "  # Check truck status"
echo "  curl $FLEETOPS_URL/api/trucks"
echo ""
echo "  # Make a truck critical for testing"
echo "  curl -X POST $FLEETOPS_URL/api/demo/force-critical/TRUCK-003"
echo ""
echo "  # Reset a specific truck"
echo "  curl -X POST $FLEETOPS_URL/api/demo/reset-truck/TRUCK-003"
echo ""

# Made with Bob