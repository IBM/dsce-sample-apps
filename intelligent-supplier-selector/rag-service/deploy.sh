#!/bin/bash

# Deployment script for IBM Code Engine
# This script automates the deployment of the Health Coverage Q&A server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="health-coverage-qa"
PROJECT_NAME="health-coverage-qa"
IMAGE_NAME="qa-server"
REGISTRY="us.icr.io"
NAMESPACE="health-coverage"
IMAGE_TAG="latest"

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists ibmcloud; then
    print_error "IBM Cloud CLI not found. Please install it first."
    exit 1
fi

if ! command_exists docker; then
    print_error "Docker not found. Please install it first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it with your watsonx credentials."
    exit 1
fi

# Login to IBM Cloud
print_info "Checking IBM Cloud login status..."
if ! ibmcloud target >/dev/null 2>&1; then
    print_warning "Not logged in to IBM Cloud. Initiating login..."
    ibmcloud login --sso
fi

# Select or create Code Engine project
print_info "Setting up Code Engine project..."
if ibmcloud ce project get --name "$PROJECT_NAME" >/dev/null 2>&1; then
    print_info "Project '$PROJECT_NAME' already exists. Selecting it..."
    ibmcloud ce project select --name "$PROJECT_NAME"
else
    print_info "Creating new project '$PROJECT_NAME'..."
    ibmcloud ce project create --name "$PROJECT_NAME"
    ibmcloud ce project select --name "$PROJECT_NAME"
fi

# Login to IBM Container Registry
print_info "Logging into IBM Container Registry..."
ibmcloud cr login

# Create namespace if it doesn't exist
print_info "Checking Container Registry namespace..."
if ! ibmcloud cr namespace-list | grep -q "$NAMESPACE"; then
    print_info "Creating namespace '$NAMESPACE'..."
    ibmcloud cr namespace-add "$NAMESPACE"
fi

# Build Docker image
FULL_IMAGE_NAME="$REGISTRY/$NAMESPACE/$IMAGE_NAME:$IMAGE_TAG"
print_info "Building Docker image: $FULL_IMAGE_NAME"
docker build -t "$FULL_IMAGE_NAME" .

# Push to registry
print_info "Pushing image to IBM Container Registry..."
docker push "$FULL_IMAGE_NAME"

# Create or update secrets
print_info "Setting up secrets..."
if ibmcloud ce secret get --name watsonx-credentials >/dev/null 2>&1; then
    print_info "Updating existing secret..."
    ibmcloud ce secret delete --name watsonx-credentials --force
fi
ibmcloud ce secret create --name watsonx-credentials --from-env-file .env

# Deploy or update application
print_info "Deploying application..."
if ibmcloud ce application get --name "$APP_NAME" >/dev/null 2>&1; then
    print_info "Application exists. Updating..."
    ibmcloud ce application update --name "$APP_NAME" \
        --image "$FULL_IMAGE_NAME" \
        --env-from-secret watsonx-credentials
else
    print_info "Creating new application..."
    ibmcloud ce application create --name "$APP_NAME" \
        --image "$FULL_IMAGE_NAME" \
        --env-from-secret watsonx-credentials \
        --port 5000 \
        --min-scale 1 \
        --max-scale 5 \
        --cpu 1 \
        --memory 2G \
        --concurrency 100
fi

# Wait for application to be ready
print_info "Waiting for application to be ready..."
sleep 10

# Get application URL
APP_URL=$(ibmcloud ce application get --name "$APP_NAME" --output json | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

if [ -n "$APP_URL" ]; then
    print_info "Application deployed successfully!"
    echo ""
    echo "=========================================="
    echo "Application URL: $APP_URL"
    echo "Health Check: $APP_URL/api/health"
    echo "=========================================="
    echo ""

    # Test health endpoint
    print_info "Testing health endpoint..."
    if curl -s "$APP_URL/api/health" | grep -q "healthy"; then
        print_info "Health check passed!"
    else
        print_warning "Health check failed. Check logs with: ibmcloud ce application logs --name $APP_NAME"
    fi
else
    print_error "Failed to retrieve application URL"
    exit 1
fi

print_info "Deployment complete!"
