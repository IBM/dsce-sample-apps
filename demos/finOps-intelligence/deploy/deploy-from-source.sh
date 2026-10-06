#!/usr/bin/env bash
# ==============================================================================
# Script: deploy-from-source.sh
# Description: Directly builds from local source and deploys onto IBM Cloud Code Engine
#              without needing local Docker installed.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IBMCLOUD_REGION="${IBMCLOUD_REGION:-us-south}"
RESOURCE_GROUP="${RESOURCE_GROUP:-default}"
CE_PROJECT_NAME="${CE_PROJECT_NAME:-finops-turbo-project}"
CE_APP_NAME="${CE_APP_NAME:-turbo-cloud-demo}"

# Code Engine requires project and app names to be strictly lower case alphanumeric characters and hyphens
CE_PROJECT_NAME="$(echo "${CE_PROJECT_NAME}" | tr '[:upper:]' '[:lower:]')"
CE_APP_NAME="$(echo "${CE_APP_NAME}" | tr '[:upper:]' '[:lower:]')"
CONTAINER_PORT="8080"
MIN_SCALE="${MIN_SCALE:-0}"
MAX_SCALE="${MAX_SCALE:-3}"
CPU="${CPU:-0.5}"
MEMORY="${MEMORY:-1G}"

echo "=========================================================="
echo " IBM Cloud Code Engine - Direct Source-to-Cloud Deploy"
echo " App:              ${CE_APP_NAME}"
echo " Region:           ${IBMCLOUD_REGION}"
echo " Project:          ${CE_PROJECT_NAME}"
echo " Dockerfile:       deploy/Dockerfile"
echo "=========================================================="

ibmcloud target -r "${IBMCLOUD_REGION}" -g "${RESOURCE_GROUP}"

# Ensure project exists
if ! ibmcloud ce project get --name "${CE_PROJECT_NAME}" >/dev/null 2>&1; then
    echo "Creating new Code Engine project '${CE_PROJECT_NAME}'..."
    ibmcloud ce project create --name "${CE_PROJECT_NAME}"
fi

ibmcloud ce project select --name "${CE_PROJECT_NAME}"

# Deploy directly from local source
echo "Submitting local build and deploying application..."
if ibmcloud ce app get --name "${CE_APP_NAME}" >/dev/null 2>&1; then
    ibmcloud ce app update \
        --name "${CE_APP_NAME}" \
        --build-source "${PROJECT_ROOT}" \
        --build-dockerfile deploy/Dockerfile \
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
    ibmcloud ce app create \
        --name "${CE_APP_NAME}" \
        --build-source "${PROJECT_ROOT}" \
        --build-dockerfile deploy/Dockerfile \
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
ibmcloud ce app get --name "${CE_APP_NAME}" --output url
echo "=========================================================="
