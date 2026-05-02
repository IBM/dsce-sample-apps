#!/bin/bash

# IBM Code Engine Deployment Script for AI Guardrails Application
# This script builds and deploys the containerized application to IBM Code Engine

set -e  # Exit on error

# ========================================
# Configuration - Update these values
# ========================================
PROJECT_NAME="ai-guardrails"
APP_NAME="guardrails-api"
REGION="us-south"
RESOURCE_GROUP="eid-68db1294cf0a1dab9d10f8ea"

# Container Registry Configuration
REGISTRY="us.icr.io"
NAMESPACE="ai-guardrails-demo"  # IBM Cloud Container Registry namespace
IMAGE_NAME="ai-guardrails-app"
IMAGE_TAG="latest"

# Environment variables for the application (will be prompted if not set)
WATSONX_APIKEY="${WATSONX_APIKEY}"
WXG_SERVICE_INSTANCE_ID="${WXG_SERVICE_INSTANCE_ID}"
WATSONX_URL="${WATSONX_URL:-https://us-south.ml.cloud.ibm.com}"
WXG_PROJECT_ID="${WXG_PROJECT_ID}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================
# Helper Functions
# ========================================
print_header() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}\n"
}

print_step() {
    echo -e "\n${YELLOW}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ========================================
# Main Script
# ========================================
print_header "IBM Code Engine Deployment Script"

# Check if required environment variables are set
print_step "Checking environment variables..."

if [ -z "$WATSONX_APIKEY" ]; then
    print_error "WATSONX_APIKEY not set"
    read -sp "Enter your IBM Cloud API Key: " WATSONX_APIKEY
    echo
fi

if [ -z "$WXG_SERVICE_INSTANCE_ID" ]; then
    print_error "WXG_SERVICE_INSTANCE_ID not set"
    read -p "Enter your watsonx.governance Service Instance ID: " WXG_SERVICE_INSTANCE_ID
fi

if [ -z "$WXG_PROJECT_ID" ]; then
    print_error "WXG_PROJECT_ID not set"
    read -p "Enter your watsonx.governance Project ID: " WXG_PROJECT_ID
fi

print_success "Environment variables configured"

# Step 1: Login to IBM Cloud
print_step "Step 1: Logging in to IBM Cloud..."
if ibmcloud login --apikey "$WATSONX_APIKEY" -r "$REGION" -g "$RESOURCE_GROUP"; then
    print_success "Logged in to IBM Cloud"
else
    print_error "Failed to login to IBM Cloud"
    exit 1
fi

# Step 2: Login to IBM Container Registry
print_step "Step 2: Logging in to IBM Container Registry..."
if ibmcloud cr login; then
    print_success "Logged in to IBM Container Registry"
else
    print_error "Failed to login to Container Registry"
    exit 1
fi

# Step 3: Build Docker image
print_step "Step 3: Building Docker image..."
FULL_IMAGE_NAME="$REGISTRY/$NAMESPACE/$IMAGE_NAME:$IMAGE_TAG"
print_info "Image: $FULL_IMAGE_NAME"

if docker build --platform linux/amd64 -t "$FULL_IMAGE_NAME" .; then
    print_success "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Step 4: Push image to IBM Container Registry
print_step "Step 4: Pushing image to IBM Container Registry..."
if docker push "$FULL_IMAGE_NAME"; then
    print_success "Image pushed to registry"
else
    print_error "Failed to push image"
    exit 1
fi

# Step 5: Target Code Engine project (create if doesn't exist)
print_step "Step 5: Setting up Code Engine project..."
if ibmcloud ce project select --name "$PROJECT_NAME" 2>/dev/null; then
    print_success "Selected existing project: $PROJECT_NAME"
else
    print_info "Creating new project: $PROJECT_NAME"
    if ibmcloud ce project create --name "$PROJECT_NAME"; then
        print_success "Project created"
    else
        print_error "Failed to create project"
        exit 1
    fi
fi

# Step 6: Create or update the application
print_step "Step 6: Deploying application to Code Engine..."

# Check if app exists
if ibmcloud ce app get --name "$APP_NAME" &>/dev/null; then
    print_info "Application exists. Updating..."
    ibmcloud ce app update --name "$APP_NAME" \
        --image "$FULL_IMAGE_NAME" \
        --env WATSONX_APIKEY="$WATSONX_APIKEY" \
        --env WXG_SERVICE_INSTANCE_ID="$WXG_SERVICE_INSTANCE_ID" \
        --env WATSONX_URL="$WATSONX_URL" \
        --env WXG_PROJECT_ID="$WXG_PROJECT_ID" \
        --env DEBUG_MODE="False" \
        --min-scale 1 \
        --max-scale 5 \
        --cpu 1 \
        --memory 2G \
        --port 8080
    print_success "Application updated"
else
    print_info "Creating new application..."
    ibmcloud ce app create --name "$APP_NAME" \
        --image "$FULL_IMAGE_NAME" \
        --env WATSONX_APIKEY="$WATSONX_APIKEY" \
        --env WXG_SERVICE_INSTANCE_ID="$WXG_SERVICE_INSTANCE_ID" \
        --env WATSONX_URL="$WATSONX_URL" \
        --env WXG_PROJECT_ID="$WXG_PROJECT_ID" \
        --env DEBUG_MODE="False" \
        --min-scale 1 \
        --max-scale 5 \
        --cpu 1 \
        --memory 2G \
        --port 8080
    print_success "Application created"
fi

# Step 7: Get application URL
print_header "Deployment Complete!"

APP_URL=$(ibmcloud ce app get --name "$APP_NAME" --output json 2>/dev/null | grep -o '"url":"[^"]*' | cut -d'"' -f4)

if [ -n "$APP_URL" ]; then
    echo -e "${GREEN}Application URL:${NC}"
    echo -e "${BLUE}$APP_URL${NC}"

    echo -e "\n${GREEN}API Endpoints:${NC}"
    echo -e "  Health Check:    ${BLUE}$APP_URL/api/health${NC}"
    echo -e "  List Metrics:    ${BLUE}$APP_URL/api/metrics${NC}"
    echo -e "  Evaluate:        ${BLUE}$APP_URL/api/evaluate${NC} (POST)"
    echo -e "  Batch Evaluate:  ${BLUE}$APP_URL/api/evaluate/batch${NC} (POST)"

    echo -e "\n${YELLOW}Test the API:${NC}"
    echo -e "curl $APP_URL/api/health"
else
    print_error "Could not retrieve application URL"
fi

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo -e "  View logs:       ${BLUE}ibmcloud ce app logs --name $APP_NAME${NC}"
echo -e "  View app info:   ${BLUE}ibmcloud ce app get --name $APP_NAME${NC}"
echo -e "  Update app:      ${BLUE}./deploy-code-engine.sh${NC}"
echo -e "  Delete app:      ${BLUE}ibmcloud ce app delete --name $APP_NAME${NC}"

print_header "Done!"
