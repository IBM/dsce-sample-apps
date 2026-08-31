#!/bin/bash

###############################################################################
# FleetOps Docker Run Script
# Uses .env file for configuration
###############################################################################

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  Starting FleetOps Docker Container${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Stop and remove existing container if running
if [ "$(docker ps -aq -f name=fleetops)" ]; then
    echo -e "${YELLOW}Stopping existing container...${NC}"
    docker stop fleetops 2>/dev/null
    docker rm fleetops 2>/dev/null
fi

# Run container with .env file
echo -e "${YELLOW}Starting new container...${NC}"
docker run -d \
  --name fleetops \
  -p 4000:4000 \
  --env-file .env \
  fleetops:latest

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  FleetOps Started Successfully!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "${BLUE}Access the application:${NC}"
    echo "  🌐 Dashboard: http://localhost:4000"
    echo "  🏥 Health:    http://localhost:4000/health"
    echo ""
    echo -e "${BLUE}View logs:${NC}"
    echo "  docker logs -f fleetops"
    echo ""
    echo -e "${BLUE}Stop container:${NC}"
    echo "  docker stop fleetops"
    echo ""
else
    echo -e "${RED}❌ Failed to start container${NC}"
    exit 1
fi

# Made with Bob