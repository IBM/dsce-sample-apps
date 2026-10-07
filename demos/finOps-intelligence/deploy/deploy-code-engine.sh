#!/usr/bin/env bash
# ==============================================================================
# Script: deploy-code-engine.sh
# Description: Automated Build, Push to IBM Cloud Container Registry (ICR),
#              and Deploy to IBM Cloud Code Engine.
# ==============================================================================

set -euo pipefail

# Resolve script directory and project root so script works regardless of where it's executed from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Configuration defaults (can be overridden with environment variables)
IBMCLOUD_REGION="${IBMCLOUD_REGION:-us-south}"
RESOURCE_GROUP="${RESOURCE_GROUP:-dsce-project}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-icr}"  # 'icr', 'docker.io', 'ghcr.io', or custom host
ICR_NAMESPACE="${ICR_NAMESPACE:-finops-demo}"
IMAGE_NAME="${IMAGE_NAME:-turbo-cloud-demo}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CE_PROJECT_NAME="${CE_PROJECT_NAME:-finops-intelligence-project}"
CE_APP_NAME="${CE_APP_NAME:-finops-intelligence}"

# Code Engine requires project and app names to be strictly lower case alphanumeric characters and hyphens
CE_PROJECT_NAME="$(echo "${CE_PROJECT_NAME}" | tr '[:upper:]' '[:lower:]')"
CE_APP_NAME="$(echo "${CE_APP_NAME}" | tr '[:upper:]' '[:lower:]')"
CONTAINER_PORT="8080"
MIN_SCALE="${MIN_SCALE:-0}"
MAX_SCALE="${MAX_SCALE:-3}"
CPU="${CPU:-0.5}"
MEMORY="${MEMORY:-1G}"
REGISTRY_SECRET="${REGISTRY_SECRET:-}"

# Configure image URL based on registry type
if [ "${IMAGE_REGISTRY}" = "icr" ]; then
    # Map IBM Cloud region to correct IBM Cloud Container Registry (ICR) host
    case "${IBMCLOUD_REGION}" in
        us-south|us-east) DEFAULT_ICR_HOST="us.icr.io" ;;
        eu-de)            DEFAULT_ICR_HOST="de.icr.io" ;;
        eu-gb)            DEFAULT_ICR_HOST="uk.icr.io" ;;
        eu-es)            DEFAULT_ICR_HOST="es.icr.io" ;;
        jp-tok)           DEFAULT_ICR_HOST="jp.icr.io" ;;
        jp-osa)           DEFAULT_ICR_HOST="jp2.icr.io" ;;
        au-syd)           DEFAULT_ICR_HOST="au.icr.io" ;;
        ca-tor)           DEFAULT_ICR_HOST="ca.icr.io" ;;
        ca-mon)           DEFAULT_ICR_HOST="ca2.icr.io" ;;
        br-sao)           DEFAULT_ICR_HOST="br.icr.io" ;;
        in-che)           DEFAULT_ICR_HOST="in.icr.io" ;;
        *)                DEFAULT_ICR_HOST="icr.io" ;;
    esac
    ICR_HOST="${ICR_HOST:-$DEFAULT_ICR_HOST}"
    FULL_IMAGE="${ICR_HOST}/${ICR_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"
elif [ "${IMAGE_REGISTRY}" = "docker.io" ]; then
    FULL_IMAGE="docker.io/${ICR_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"
elif [ "${IMAGE_REGISTRY}" = "ghcr.io" ]; then
    FULL_IMAGE="ghcr.io/${ICR_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"
else
    FULL_IMAGE="${IMAGE_REGISTRY}/${ICR_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"
fi

echo "=========================================================="
echo " IBM Cloud Code Engine Deployment Script"
echo " App:              ${CE_APP_NAME}"
echo " Region:           ${IBMCLOUD_REGION}"
echo " Resource Group:   ${RESOURCE_GROUP}"
echo " Project:          ${CE_PROJECT_NAME}"
echo " Image:            ${FULL_IMAGE}"
echo "=========================================================="

# 1. Check prerequisites
if ! command -v ibmcloud &> /dev/null; then
    echo "ERROR: 'ibmcloud' CLI is not installed. Please install IBM Cloud CLI."
    exit 1
fi

if ! command -v podman &> /dev/null; then
    echo "ERROR: 'podman' CLI is not installed. Podman is required for local build & push."
    exit 1
fi

# Ensure Code Engine and Container Registry plugins are installed
echo "Checking IBM Cloud plugins..."
ibmcloud plugin install code-engine -f >/dev/null 2>&1 || true
ibmcloud plugin install container-registry -f >/dev/null 2>&1 || true

# 2. Target region and resource group
echo "Targeting region '${IBMCLOUD_REGION}' and resource group '${RESOURCE_GROUP}'..."
ibmcloud target -r "${IBMCLOUD_REGION}" -g "${RESOURCE_GROUP}"

# 3. Ensure Container Registry namespace & login (if using ICR)
if [ "${IMAGE_REGISTRY}" = "icr" ]; then
    echo "Verifying ICR namespace '${ICR_NAMESPACE}'..."
    if ! ibmcloud cr namespace-list | grep -qw "${ICR_NAMESPACE}"; then
        echo "Creating ICR namespace '${ICR_NAMESPACE}'..."
        ibmcloud cr namespace-add "${ICR_NAMESPACE}"
    fi

    # 4. Log in Podman to IBM Cloud Container Registry
    echo "Logging Podman into ICR..."
    ibmcloud cr login --client podman
fi

# 5. Build Container Image with Podman (targeting linux/amd64 for Code Engine compatibility, docker format for healthcheck support)
echo "Building container image with Podman: ${FULL_IMAGE}..."
podman build --format docker --platform linux/amd64 -t "${FULL_IMAGE}" -f "${SCRIPT_DIR}/Dockerfile" "${PROJECT_ROOT}"

# 6. Push Container Image to ICR
echo "Pushing image to Container Registry..."
podman push "${FULL_IMAGE}"

# 7. Select or create Code Engine project
echo "Selecting / Creating Code Engine project '${CE_PROJECT_NAME}'..."
if ! ibmcloud ce project get --name "${CE_PROJECT_NAME}" >/dev/null 2>&1; then
    echo "Creating new Code Engine project '${CE_PROJECT_NAME}'..."
    ibmcloud ce project create --name "${CE_PROJECT_NAME}"
fi

ibmcloud ce project select --name "${CE_PROJECT_NAME}"

# 8. Ensure Code Engine has registry access credentials for private image pull
SECRET_ARG=()
if [ "${IMAGE_REGISTRY}" = "icr" ]; then
    SECRET_NAME="ce-icr-secret"
    if ! ibmcloud ce secret get --name "${SECRET_NAME}" >/dev/null 2>&1; then
        echo "Configuring registry pull secret for Code Engine..."
        API_KEY="${IBMCLOUD_API_KEY:-}"
        if [ -z "${API_KEY}" ]; then
            KEY_JSON=$(ibmcloud iam api-key-create "ce-pull-${CE_APP_NAME}" -d "Key for Code Engine to pull from ICR" --output json 2>/dev/null || true)
            if [ -n "${KEY_JSON}" ]; then
                API_KEY=$(echo "${KEY_JSON}" | grep -o '"apikey": "[^"]*' | cut -d'"' -f4)
            fi
        fi

        if [ -n "${API_KEY}" ]; then
            echo "Creating registry secret '${SECRET_NAME}'..."
            ibmcloud ce secret create --name "${SECRET_NAME}" --format registry --server "${ICR_HOST}" --username iamapikey --password "${API_KEY}"
            SECRET_ARG=(--registry-secret "${SECRET_NAME}")
        else
            echo "WARNING: Could not automatically generate IAM API key. If the pull fails, provide IBMCLOUD_API_KEY environment variable."
        fi
    else
        SECRET_ARG=(--registry-secret "${SECRET_NAME}")
    fi
elif [ -n "${REGISTRY_SECRET}" ]; then
    SECRET_ARG=(--registry-secret "${REGISTRY_SECRET}")
fi

# 9. Deploy or Update Application on Code Engine
echo "Deploying application '${CE_APP_NAME}'..."
if ibmcloud ce app get --name "${CE_APP_NAME}" >/dev/null 2>&1; then
    echo "Application exists. Updating existing application..."
    ibmcloud ce app update \
        --name "${CE_APP_NAME}" \
        --image "${FULL_IMAGE}" \
        "${SECRET_ARG[@]}" \
        --port "${CONTAINER_PORT}" \
        --min-scale "${MIN_SCALE}" \
        --max-scale "${MAX_SCALE}" \
        --cpu "${CPU}" \
        --memory "${MEMORY}" \
        --probe-ready type=http \
        --probe-ready path=/health \
        --probe-ready port="${CONTAINER_PORT}" \
        --probe-live type=http \
        --probe-live path=/health \
        --probe-live port="${CONTAINER_PORT}"
else
    echo "Creating new Code Engine application..."
    ibmcloud ce app create \
        --name "${CE_APP_NAME}" \
        --image "${FULL_IMAGE}" \
        "${SECRET_ARG[@]}" \
        --port "${CONTAINER_PORT}" \
        --min-scale "${MIN_SCALE}" \
        --max-scale "${MAX_SCALE}" \
        --cpu "${CPU}" \
        --memory "${MEMORY}" \
        --probe-ready type=http \
        --probe-ready path=/health \
        --probe-ready port="${CONTAINER_PORT}" \
        --probe-live type=http \
        --probe-live path=/health \
        --probe-live port="${CONTAINER_PORT}"
fi

echo "=========================================================="
echo " Deployment Complete!"
echo " Retrieve Application URL:"
ibmcloud ce app get --name "${CE_APP_NAME}" --output url
echo "=========================================================="
