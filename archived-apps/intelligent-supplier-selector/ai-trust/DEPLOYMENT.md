# AI Guardrails API - Deployment Guide

Complete guide for deploying the AI Guardrails REST API to IBM Code Engine.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Containerization](#docker-containerization)
- [IBM Code Engine Deployment](#ibm-code-engine-deployment)
- [Testing the Deployment](#testing-the-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- Docker Desktop installed and running
- IBM Cloud CLI (`ibmcloud`)
- IBM Cloud Container Registry plugin
- IBM Cloud Code Engine plugin

### Install IBM Cloud CLI
```bash
# macOS
curl -fsSL https://clis.cloud.ibm.com/install/osx | sh

# Linux
curl -fsSL https://clis.cloud.ibm.com/install/linux | sh

# Windows (PowerShell as Administrator)
iex(New-Object Net.WebClient).DownloadString('https://clis.cloud.ibm.com/install/powershell')
```

### Install Required Plugins
```bash
# Container Registry plugin
ibmcloud plugin install container-registry

# Code Engine plugin
ibmcloud plugin install code-engine
```

### IBM Cloud Credentials
You'll need:
- **IBM Cloud API Key** (acts as WATSONX_APIKEY)
- **watsonx.governance Service Instance ID** (WXG_SERVICE_INSTANCE_ID)
- **watsonx.governance Project ID** (WXG_PROJECT_ID)
- **Container Registry Namespace** (create one if you don't have it)

---

## Local Development

### 1. Set Up Environment
```bash
# Copy environment template
cp .env.template .env

# Edit .env with your credentials
nano .env
```

### 2. Create Virtual Environment
```bash
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install --no-deps -r requirements.txt
```

### 4. Run Locally
```bash
python api_server.py
```

The API will be available at http://localhost:8090

---

## Docker Containerization

### 1. Build Docker Image Locally
```bash
docker build -t ai-guardrails-api:latest .
```

### 2. Run Docker Container Locally
```bash
docker run -p 8080:8080 \
  -e WATSONX_APIKEY="your_api_key" \
  -e WXG_SERVICE_INSTANCE_ID="your_instance_id" \
  -e WXG_PROJECT_ID="your_project_id" \
  ai-guardrails-api:latest
```

Test at http://localhost:8080/api/health

### 3. Stop Container
```bash
# Find container ID
docker ps

# Stop container
docker stop <container_id>
```

---

## IBM Code Engine Deployment

### Method 1: Automated Deployment Script (Recommended)

#### 1. Configure the Script
Edit `deploy-code-engine.sh` and update:
```bash
NAMESPACE="your-namespace"  # Your Container Registry namespace
```

#### 2. Set Environment Variables
```bash
export WATSONX_APIKEY="your_ibm_cloud_api_key"
export WXG_SERVICE_INSTANCE_ID="your_service_instance_id"
export WXG_PROJECT_ID="your_project_id"
```

#### 3. Run Deployment
```bash
chmod +x deploy-code-engine.sh
./deploy-code-engine.sh
```

The script will:
1. ✅ Login to IBM Cloud
2. ✅ Build Docker image
3. ✅ Push to Container Registry
4. ✅ Create/update Code Engine project
5. ✅ Deploy application
6. ✅ Display application URL

### Method 2: Manual Deployment

#### Step 1: Login to IBM Cloud
```bash
ibmcloud login --apikey YOUR_API_KEY -r us-south -g Default
```

#### Step 2: Login to Container Registry
```bash
ibmcloud cr login
```

#### Step 3: Create Registry Namespace (if needed)
```bash
# List existing namespaces
ibmcloud cr namespaces

# Create new namespace
ibmcloud cr namespace-add your-namespace
```

#### Step 4: Build and Push Image
```bash
# Build image
docker build -t us.icr.io/your-namespace/ai-guardrails-app:latest .

# Push to registry
docker push us.icr.io/your-namespace/ai-guardrails-app:latest
```

#### Step 5: Create Code Engine Project
```bash
# Create project
ibmcloud ce project create --name ai-guardrails

# Or select existing
ibmcloud ce project select --name ai-guardrails
```

#### Step 5.5: Create Registry Access Secret
Code Engine needs permission to pull images from IBM Container Registry:
```bash
ibmcloud ce registry create --name icr-access \
  --server us.icr.io \
  --username iamapikey \
  --password "YOUR_IBM_CLOUD_API_KEY"
```

#### Step 6: Deploy Application
```bash
ibmcloud ce app create \
  --name guardrails-api \
  --image us.icr.io/your-namespace/ai-guardrails-app:latest \
  --registry-secret icr-access \
  --env WATSONX_APIKEY="your_api_key" \
  --env WXG_SERVICE_INSTANCE_ID="your_instance_id" \
  --env WXG_PROJECT_ID="your_project_id" \
  --env WATSONX_URL="https://us-south.ml.cloud.ibm.com" \
  --env DEBUG_MODE="False" \
  --min-scale 1 \
  --max-scale 5 \
  --cpu 1 \
  --memory 2G \
  --port 8080
```

#### Step 7: Get Application URL
```bash
ibmcloud ce app get --name guardrails-api
```

---

## Testing the Deployment

### 1. Health Check
```bash
curl https://your-app-url.appdomain.cloud/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "AI Guardrails API",
  "timestamp": "2025-12-05T..."
}
```

### 2. List Available Metrics
```bash
curl https://your-app-url.appdomain.cloud/api/metrics
```

### 3. Evaluate Text
```bash
curl -X POST https://your-app-url.appdomain.cloud/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "generated_text": "Hello! How can I help you today?",
    "metrics": ["PII Detection", "Harm Detection"]
  }'
```

### 4. View Logs
```bash
ibmcloud ce app logs --name guardrails-api
```

---

## Updating the Application

### Update Code and Redeploy
```bash
# Make your code changes
# Then run the deployment script again
./deploy-code-engine.sh
```

### Update Environment Variables Only
```bash
ibmcloud ce app update --name guardrails-api \
  --env WATSONX_APIKEY="new_api_key"
```

### Scale the Application
```bash
ibmcloud ce app update --name guardrails-api \
  --min-scale 2 \
  --max-scale 10
```

---

## Troubleshooting

### Issue: Application Not Starting

**Check logs:**
```bash
ibmcloud ce app logs --name guardrails-api --tail 100
```

**Common causes:**
- Missing environment variables
- Invalid credentials
- Insufficient memory/CPU

**Solution:**
```bash
# Increase resources
ibmcloud ce app update --name guardrails-api \
  --memory 4G --cpu 2
```

### Issue: Image Pull Error / Authorization Error

**Symptoms:**
- Error: `UNAUTHORIZED: Authorization required`
- Error: `failed to resolve image to digest`

**Solution - Create Registry Access Secret:**
```bash
# Create registry secret for Code Engine
ibmcloud ce registry create --name icr-access \
  --server us.icr.io \
  --username iamapikey \
  --password "YOUR_IBM_CLOUD_API_KEY"

# Update app to use the secret
ibmcloud ce app update --name guardrails-api \
  --registry-secret icr-access
```

**Check registry access:**
```bash
ibmcloud cr images --restrict your-namespace
```

**Verify the registry secret exists:**
```bash
ibmcloud ce registry list
```

### Issue: API Returns 500 Error

**Check environment variables:**
```bash
ibmcloud ce app get --name guardrails-api
```

**Verify credentials are correct:**
- WATSONX_APIKEY should be valid IBM Cloud API key
- WXG_SERVICE_INSTANCE_ID should match your service instance
- WXG_PROJECT_ID should be a valid project

### Issue: Docker Hub Rate Limit

**Symptoms:**
- Error: `429 Too Many Requests`
- Error: `toomanyrequests: You have reached your unauthenticated pull rate limit`

**Solution:**
```bash
# Sign in to Docker Hub with a personal account
docker login

# This increases rate limit from 100 to 200 pulls per 6 hours
# Note: Rate limits only apply during image build, not runtime
```

**Alternative - Use Docker Hub Pro:**
- Unlimited pulls with Docker Hub Pro subscription

### Issue: Slow Performance

**Increase instances:**
```bash
ibmcloud ce app update --name guardrails-api \
  --min-scale 3 \
  --max-scale 10
```

**Increase resources:**
```bash
ibmcloud ce app update --name guardrails-api \
  --memory 4G \
  --cpu 2
```

---

## Cost Optimization

### Use Minimum Scaling
For development:
```bash
ibmcloud ce app update --name guardrails-api \
  --min-scale 0 \
  --max-scale 1
```
**Note:** `--min-scale 0` means the app will scale to zero when idle (cold start on first request)

### Monitor Usage
```bash
# View app details including resource usage
ibmcloud ce app get --name guardrails-api

# View project resource usage
ibmcloud ce project current
```

---

## Cleanup

### Delete Application
```bash
ibmcloud ce app delete --name guardrails-api
```

### Delete Project
```bash
ibmcloud ce project delete --name ai-guardrails
```

### Delete Container Image
```bash
ibmcloud cr image-rm us.icr.io/your-namespace/ai-guardrails-app:latest
```

---

## Security Best Practices

1. **Never commit `.env` file** - Use `.gitignore`
2. **Rotate API keys regularly** - Update with `app update` command
3. **Use HTTPS only** - Code Engine provides this automatically
4. **Limit API access** - Use IBM Cloud IAM or API Gateway
5. **Monitor logs** - Check for unauthorized access attempts

---

## Additional Resources

- [IBM Code Engine Documentation](https://cloud.ibm.com/docs/codeengine)
- [IBM Container Registry Documentation](https://cloud.ibm.com/docs/Registry)
- [watsonx.governance Documentation](https://www.ibm.com/docs/en/watsonx/governance)
- [Docker Documentation](https://docs.docker.com/)

---

## Support

For issues with:
- **This application**: Create an issue in the repository
- **IBM Code Engine**: IBM Cloud Support
- **watsonx.governance**: IBM watsonx Support
