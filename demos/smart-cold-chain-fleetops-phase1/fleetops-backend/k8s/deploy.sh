#!/bin/bash

# FleetOps Backend Deployment Script for OpenShift
# Supports WatsonX Orchestrate integration with Kubernetes Secrets

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}FleetOps Backend - OpenShift Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if oc CLI is installed
if ! command -v oc &> /dev/null; then
    echo -e "${RED}Error: OpenShift CLI (oc) is not installed${NC}"
    echo "Install from: https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html"
    exit 1
fi

# Check if logged in to OpenShift
echo -e "${YELLOW}Checking OpenShift login status...${NC}"
if ! oc whoami &> /dev/null; then
    echo -e "${RED}Error: Not logged in to OpenShift${NC}"
    echo ""
    echo "Please login first:"
    echo "  oc login <cluster-url> --token=<your-token>"
    echo "  OR"
    echo "  oc login <cluster-url> -u <username> -p <password>"
    exit 1
fi

CURRENT_USER=$(oc whoami)
CURRENT_SERVER=$(oc whoami --show-server)
echo -e "${GREEN}✓ Logged in as: $CURRENT_USER${NC}"
echo -e "${GREEN}✓ Server: $CURRENT_SERVER${NC}"
echo ""

# Navigate to k8s directory
cd "$(dirname "$0")"

# Deploy namespace
echo -e "${BLUE}Step 1: Creating namespace...${NC}"
oc apply -f namespace.yaml
echo -e "${GREEN}✓ Namespace created/updated${NC}"
echo ""

# Switch to namespace
oc project fleetops-backend

# Handle WatsonX Orchestrate Secret
echo -e "${BLUE}Step 2: Configuring WatsonX Orchestrate credentials...${NC}"
if oc get secret watsonx-orchestrate-credentials -n fleetops-backend &> /dev/null; then
    echo -e "${YELLOW}⚠️  WatsonX Orchestrate secret already exists${NC}"
    read -p "Do you want to update it? (y/n): " update_secret
    if [[ $update_secret == "y" ]]; then
        echo ""
        echo "Please provide your WatsonX Orchestrate credentials:"
        echo ""
        
        read -p "WatsonX Orchestrate URL: " WATSONX_URL
        read -p "WatsonX API Key: " WATSONX_API_KEY
        read -p "Weather Agent ID: " AGENT_WEATHER
        read -p "Station Agent ID: " AGENT_STATION
        read -p "Route Agent ID: " AGENT_ROUTE
        read -p "Decision Agent ID: " AGENT_DECISION
        
        echo ""
        echo "Updating WatsonX Orchestrate secret..."
        
        oc delete secret watsonx-orchestrate-credentials -n fleetops-backend
        oc create secret generic watsonx-orchestrate-credentials \
            --from-literal=WATSONX_ORCHESTRATE_URL="$WATSONX_URL" \
            --from-literal=WATSONX_ORCHESTRATE_API_KEY="$WATSONX_API_KEY" \
            --from-literal=WATSONX_ORCHESTRATE_AGENT_WEATHER="$AGENT_WEATHER" \
            --from-literal=WATSONX_ORCHESTRATE_AGENT_STATION="$AGENT_STATION" \
            --from-literal=WATSONX_ORCHESTRATE_AGENT_ROUTE="$AGENT_ROUTE" \
            --from-literal=WATSONX_ORCHESTRATE_AGENT_DECISION="$AGENT_DECISION" \
            -n fleetops-backend
        
        echo -e "${GREEN}✓ Secret updated${NC}"
    else
        echo -e "${YELLOW}ℹ️  Using existing secret${NC}"
    fi
else
    echo -e "${YELLOW}📝 WatsonX Orchestrate secret not found${NC}"
    echo ""
    echo "Please provide your WatsonX Orchestrate credentials:"
    echo ""
    
    read -p "WatsonX Orchestrate URL: " WATSONX_URL
    read -p "WatsonX API Key: " WATSONX_API_KEY
    read -p "Weather Agent ID: " AGENT_WEATHER
    read -p "Station Agent ID: " AGENT_STATION
    read -p "Route Agent ID: " AGENT_ROUTE
    read -p "Decision Agent ID: " AGENT_DECISION
    
    echo ""
    echo "Creating WatsonX Orchestrate secret..."
    
    oc create secret generic watsonx-orchestrate-credentials \
        --from-literal=WATSONX_ORCHESTRATE_URL="$WATSONX_URL" \
        --from-literal=WATSONX_ORCHESTRATE_API_KEY="$WATSONX_API_KEY" \
        --from-literal=WATSONX_ORCHESTRATE_AGENT_WEATHER="$AGENT_WEATHER" \
        --from-literal=WATSONX_ORCHESTRATE_AGENT_STATION="$AGENT_STATION" \
        --from-literal=WATSONX_ORCHESTRATE_AGENT_ROUTE="$AGENT_ROUTE" \
        --from-literal=WATSONX_ORCHESTRATE_AGENT_DECISION="$AGENT_DECISION" \
        -n fleetops-backend
    
    echo -e "${GREEN}✓ Secret created${NC}"
fi
echo ""

# Deploy ConfigMap
echo -e "${BLUE}Step 3: Creating ConfigMap...${NC}"
oc apply -f configmap.yaml
echo -e "${GREEN}✓ ConfigMap created/updated${NC}"
echo ""

# Deploy PVC
echo -e "${BLUE}Step 4: Creating PersistentVolumeClaim...${NC}"
oc apply -f pvc.yaml
echo -e "${GREEN}✓ PVC created/updated${NC}"
echo ""

# Wait for PVC to be bound
echo -e "${YELLOW}Waiting for PVC to be bound...${NC}"
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    status=$(oc get pvc fleetops-data -n fleetops-backend -o jsonpath='{.status.phase}' 2>/dev/null || echo "Pending")
    if [ "$status" == "Bound" ]; then
        echo -e "${GREEN}✓ PVC is bound${NC}"
        break
    fi
    echo -n "."
    sleep 2
    elapsed=$((elapsed + 2))
done
echo ""

if [ "$status" != "Bound" ]; then
    echo -e "${YELLOW}Warning: PVC not bound yet. It may take a few minutes.${NC}"
    echo -e "${YELLOW}Check status with: oc get pvc -n fleetops-backend${NC}"
fi
echo ""

# Clean up old ReplicaSets to prevent volume attachment issues
echo -e "${BLUE}Step 5: Cleaning up old ReplicaSets...${NC}"
OLD_RS=$(oc get replicasets -n fleetops-backend -o name | grep "fleetops-backend" | wc -l)
if [ "$OLD_RS" -gt 1 ]; then
    echo -e "${YELLOW}Found $OLD_RS replicasets. Cleaning up old ones...${NC}"
    oc get replicasets -n fleetops-backend -o name | grep "fleetops-backend" | while read rs; do
        DESIRED=$(oc get $rs -n fleetops-backend -o jsonpath='{.spec.replicas}')
        if [ "$DESIRED" == "0" ]; then
            echo "Deleting $rs"
            oc delete $rs -n fleetops-backend
        fi
    done
    echo -e "${GREEN}✓ Old ReplicaSets cleaned up${NC}"
else
    echo -e "${GREEN}✓ No old ReplicaSets to clean up${NC}"
fi
echo ""

# Deploy application
echo -e "${BLUE}Step 6: Creating Deployment...${NC}"
oc apply -f deployment.yaml
echo -e "${GREEN}✓ Deployment created/updated${NC}"
echo ""

# Deploy Service
echo -e "${BLUE}Step 7: Creating Service...${NC}"
oc apply -f service.yaml
echo -e "${GREEN}✓ Service created/updated${NC}"
echo ""

# Deploy Route
echo -e "${BLUE}Step 8: Creating Route...${NC}"
oc apply -f route.yaml
echo -e "${GREEN}✓ Route created/updated${NC}"
echo ""

# Wait for deployment to be ready
echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
oc rollout status deployment/fleetops-backend -n fleetops-backend --timeout=5m

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Get deployment info
POD_NAME=$(oc get pods -n fleetops-backend -l app=fleetops,component=backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
IMAGE=$(oc get deployment fleetops-backend -n fleetops-backend -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")

if [ -n "$IMAGE" ]; then
    echo -e "${YELLOW}Deployment Info:${NC}"
    echo "  Image: $IMAGE"
    echo "  Pod:   $POD_NAME"
    echo ""
fi

# Get route URL
ROUTE_URL=$(oc get route fleetops-api -n fleetops-backend -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
if [ -n "$ROUTE_URL" ]; then
    echo -e "${YELLOW}Application URL:${NC}"
    echo "  https://$ROUTE_URL"
    echo ""
    echo -e "${YELLOW}API Endpoints:${NC}"
    echo "  Health:    https://$ROUTE_URL/health"
    echo "  Trucks:    https://$ROUTE_URL/api/trucks"
    echo "  Agents:    https://$ROUTE_URL/api/agents"
    echo "  Stations:  https://$ROUTE_URL/api/stations"
    echo "  Weather:   https://$ROUTE_URL/api/weather"
    echo "  Alerts:    https://$ROUTE_URL/api/alerts"
    echo "  Docs:      https://$ROUTE_URL/docs"
    echo ""
fi

echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View pods:        oc get pods -n fleetops-backend"
echo "  View logs:        oc logs -f deployment/fleetops-backend -n fleetops-backend"
echo "  View events:      oc get events -n fleetops-backend --sort-by='.lastTimestamp'"
echo "  Check secret:     oc describe secret watsonx-orchestrate-credentials -n fleetops-backend"
echo "  Scale replicas:   oc scale deployment/fleetops-backend --replicas=2 -n fleetops-backend"
echo "  Rollback:         oc rollout undo deployment/fleetops-backend -n fleetops-backend"
echo "  Delete all:       oc delete namespace fleetops-backend"
echo ""

# Test health endpoint
if [ -n "$ROUTE_URL" ]; then
    echo -e "${YELLOW}Testing health endpoint...${NC}"
    sleep 5  # Give it a moment to start
    if curl -s -k "https://$ROUTE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Health check passed!${NC}"
        echo ""
        echo "Testing API response:"
        curl -s -k "https://$ROUTE_URL/health" | jq '.' 2>/dev/null || curl -s -k "https://$ROUTE_URL/health"
    else
        echo -e "${YELLOW}⚠ Health check not responding yet. Give it a minute to start up.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Deployment successful!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Monitor logs: oc logs -f deployment/fleetops-backend -n fleetops-backend"
echo "2. Test API: curl -sk https://$ROUTE_URL/api/trucks"
echo "3. Check WatsonX agents: curl -sk https://$ROUTE_URL/api/agents"
echo ""

# Made with Bob
