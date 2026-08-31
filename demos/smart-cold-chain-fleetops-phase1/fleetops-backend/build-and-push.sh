#!/bin/bash

# Build and Push Script for FleetOps Backend
# Uses Podman to build and push to Docker Hub

set -e  # Exit on error

# Configuration
REGISTRY="docker.io"
REPOSITORY="<docker repo>"
IMAGE_NAME="fleetops-backend"
VERSION="${1:-latest}"  # Use first argument or 'latest'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}FleetOps Backend - Build & Push${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if podman is installed
if ! command -v podman &> /dev/null; then
    echo -e "${RED}Error: Podman is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  Registry: $REGISTRY"
echo "  Repository: $REPOSITORY"
echo "  Image: $IMAGE_NAME"
echo "  Version: $VERSION"
echo "  Full Tag: $REGISTRY/$REPOSITORY:$VERSION"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# Build the image for Linux AMD64 (OpenShift platform)
echo -e "${YELLOW}Step 1: Building Docker image for linux/amd64...${NC}"
podman build \
    --platform linux/amd64 \
    --tag $IMAGE_NAME:$VERSION \
    --tag $IMAGE_NAME:latest \
    --tag $REGISTRY/$REPOSITORY:$VERSION \
    --tag $REGISTRY/$REPOSITORY:latest \
    --file Dockerfile \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""

# Check if logged in to Docker Hub
echo -e "${YELLOW}Step 2: Checking Docker Hub authentication...${NC}"
if ! podman login --get-login $REGISTRY &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Docker Hub. Please login:${NC}"
    podman login $REGISTRY
fi

echo ""

# Push the image
echo -e "${YELLOW}Step 3: Pushing image to Docker Hub...${NC}"
podman push $REGISTRY/$REPOSITORY:$VERSION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Push successful${NC}"
else
    echo -e "${RED}✗ Push failed${NC}"
    exit 1
fi

# Also push latest tag if version is not 'latest'
if [ "$VERSION" != "latest" ]; then
    echo -e "${YELLOW}Step 4: Pushing 'latest' tag...${NC}"
    podman push $REGISTRY/$REPOSITORY:latest
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Latest tag pushed${NC}"
    else
        echo -e "${RED}✗ Latest tag push failed${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build and Push Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Image Details:${NC}"
echo "  Full Image: $REGISTRY/$REPOSITORY:$VERSION"
echo "  Size: $(podman images $REGISTRY/$REPOSITORY:$VERSION --format '{{.Size}}')"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Update k8s/deployment.yaml with image: $REGISTRY/$REPOSITORY:$VERSION"
echo "  2. Deploy to OpenShift: ./deploy.sh"
echo ""
echo -e "${YELLOW}Verify on Docker Hub:${NC}"
echo "  https://hub.docker.com/r/$REPOSITORY/tags"
echo ""

# Made with Bob
