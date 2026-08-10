#!/bin/bash

# Load variables from .env
set -o allexport
source .env
set +o allexport

orchestrate connections set-credentials --app-id cos_credential --env live -e "COS_API_KEY=${COS_API_KEY}" -e "COS_ENDPOINT=${COS_ENDPOINT}" -e "COS_SERVICE_INSTANCE_ID=${COS_SERVICE_INSTANCE_ID}" -e "COS_BUCKET_NAME=${COS_BUCKET_NAME}"
orchestrate connections set-credentials --app-id cos_credential --env draft -e "COS_API_KEY=${COS_API_KEY}" -e "COS_ENDPOINT=${COS_ENDPOINT}" -e "COS_SERVICE_INSTANCE_ID=${COS_SERVICE_INSTANCE_ID}" -e "COS_BUCKET_NAME=${COS_BUCKET_NAME}"

orchestrate connections set-credentials --app-id wxai_credential --env live -e "WATSONX_APIKEY=${WATSONX_APIKEY}" -e "WATSONX_PROJECT_ID=${WATSONX_PROJECT_ID}" -e "WATSONX_URL=${WATSONX_URL}"
orchestrate connections set-credentials --app-id wxai_credential --env draft -e "WATSONX_APIKEY=${WATSONX_APIKEY}" -e "WATSONX_PROJECT_ID=${WATSONX_PROJECT_ID}" -e "WATSONX_URL=${WATSONX_URL}"
