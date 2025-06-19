#!/bin/bash

# File to store environment variables
ENV_FILE=".env"

# Create or overwrite the .env file
{
  echo "VITE_BACKEND_URL=${VITE_BACKEND_URL}"
  echo "VITE_API_KEY=${VITE_API_KEY}"
  echo "VITE_CHATBOT_NAME=${VITE_CHATBOT_NAME}"
  echo "VITE_WELCOME_MESSAGE=${VITE_WELCOME_MESSAGE}"
  echo "VITE_ENABLE_CHAT=${VITE_ENABLE_CHAT}"
} > "$ENV_FILE"
echo "VITE_BACKEND_URL=${VITE_BACKEND_URL}"
echo "VITE_API_KEY=${VITE_API_KEY}"
echo "VITE_CHATBOT_NAME=${VITE_CHATBOT_NAME}"
echo "VITE_WELCOME_MESSAGE=${VITE_WELCOME_MESSAGE}"
echo "VITE_ENABLE_CHAT=${VITE_ENABLE_CHAT}"
echo ".env file created"