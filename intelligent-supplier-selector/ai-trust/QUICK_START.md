# Quick Start Guide

This guide will help you deploy the AI Guardrails API to IBM Code Engine.

## Prerequisites

- IBM Cloud account
- IBM watsonx.governance service instance
- Docker Desktop or Rancher Desktop installed
- IBM Cloud CLI with Code Engine plugin

## Setup Steps

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-directory>
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.template .env
```

Edit `.env` and add your IBM Cloud credentials:
- `WATSONX_APIKEY` - Your IBM Cloud API key
- `WXG_SERVICE_INSTANCE_ID` - Your watsonx.governance service instance ID
- `WXG_PROJECT_ID` - Your watsonx.governance project ID

### 3. Update Deployment Configuration

Edit `deploy-code-engine.sh` and update these variables if needed:
- `PROJECT_NAME` - Your Code Engine project name
- `APP_NAME` - Your application name
- `REGION` - IBM Cloud region (default: us-south)
- `RESOURCE_GROUP` - Your IBM Cloud resource group ID
- `NAMESPACE` - Your Container Registry namespace

### 4. Deploy to IBM Code Engine

Make sure Docker is running, then execute:

```bash
chmod +x deploy-code-engine.sh
./deploy-code-engine.sh
```

The script will:
1. Build a Docker image
2. Push it to IBM Container Registry
3. Deploy to Code Engine
4. Output your application URL

### 5. Test the API

```bash
# Health check
curl https://your-app-url/api/health

# List available metrics
curl https://your-app-url/api/metrics

# Run an evaluation
curl -X POST https://your-app-url/api/evaluate \
  -H "Content-Type: application/json" \
  -d @example_request.json
```

## Available Endpoints

- `GET /api/health` - Health check
- `GET /api/metrics` - List all available metrics
- `POST /api/evaluate` - Evaluate single text
- `POST /api/evaluate/batch` - Evaluate multiple texts

## Documentation

- [README.md](README.md) - Main documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [API_TESTING.md](API_TESTING.md) - API testing guide
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Integration guide

## Support

For issues and questions, please refer to the documentation files or contact support.
