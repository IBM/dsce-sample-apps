# IBM Cloud Code Engine Deployment Guide

This directory contains the deployment configuration to containerize and host the **IBM Cloudability + IBM Turbonomic Continuous FinOps Demo** application on **IBM Cloud Code Engine** (serverless container platform).

---

## 📁 Directory Contents

| File | Purpose |
| :--- | :--- |
| [`deploy/Dockerfile`](deploy/Dockerfile) | Production multi-stage Docker build (Node.js 20 build stage + unprivileged Nginx runner stage). |
| [`deploy/nginx.conf`](deploy/nginx.conf) | Hardened Nginx configuration supporting SPA routing, asset caching, security headers, and `/health` probe. |
| [`deploy/.dockerignore`](deploy/.dockerignore) | Docker build context exclusions. |
| [`.ceignore`](.ceignore) | Code Engine source-to-image build context exclusions. |
| [`deploy/deploy-code-engine.sh`](deploy/deploy-code-engine.sh) | Automated bash script to build (using Podman), push to IBM Cloud Container Registry (ICR), and deploy to Code Engine. |
| [`deploy/deploy-from-source.sh`](deploy/deploy-from-source.sh) | Script to build and deploy directly from local source to Code Engine without local container tools. |
| [`deploy/terraform/main.tf`](deploy/terraform/main.tf) | Infrastructure as Code (Terraform) configuration for Code Engine project & app. |

---

## 🚀 Deployment Options

### Option 1: Automated Script (Podman + ICR)

Ensure you have logged into IBM Cloud:
```bash
ibmcloud login --sso
```

Make the script executable and run:
```bash
chmod +x deploy/deploy-code-engine.sh
./deploy/deploy-code-engine.sh
```

You can customize parameters via environment variables:
```bash
IBMCLOUD_REGION=us-south \
ICR_NAMESPACE=my-finops-ns \
CE_PROJECT_NAME=finops-demo-project \
CE_APP_NAME=turbo-cloud-demo \
./deploy/deploy-code-engine.sh
```

---

### Option 2: Direct Source-to-Cloud Deploy (No Local Container Runtime Needed)

Code Engine can pull your local source directory and build the container image directly in the cloud:

```bash
chmod +x deploy/deploy-from-source.sh
./deploy/deploy-from-source.sh
```

Or manually using IBM Cloud CLI:
```bash
ibmcloud ce project select --name finops-turbo-project
ibmcloud ce app create \
  --name turbo-cloud-demo \
  --build-source . \
  --build-dockerfile deploy/Dockerfile \
  --port 8080 \
  --min-scale 0 \
  --max-scale 3 \
  --cpu 0.5 \
  --memory 1G \
  --probe-ready type=http \
  --probe-ready path=/health \
  --probe-ready port=8080 \
  --probe-live type=http \
  --probe-live path=/health \
  --probe-live port=8080
```

---

### Option 3: Manual Step-by-Step CLI

1. **Target Region and Resource Group**:
   ```bash
   ibmcloud target -r us-south -g default
   ```

2. **Log in to IBM Cloud Container Registry**:
   ```bash
   ibmcloud cr login
   ```

3. **Build and Push Container Image**:
   ```bash
   ibmcloud cr login --client podman
   podman build --format docker --platform linux/amd64 -t us.icr.io/<your-namespace>/turbo-cloud-demo:latest -f deploy/Dockerfile .
   podman push us.icr.io/<your-namespace>/turbo-cloud-demo:latest
   ```

4. **Create Code Engine Project**:
   ```bash
   ibmcloud ce project create --name finops-turbo-project
   ibmcloud ce project select --name finops-turbo-project
   ```

5. **Deploy the Application**:
   ```bash
   ibmcloud ce app create \
     --name turbo-cloud-demo \
     --image us.icr.io/<your-namespace>/turbo-cloud-demo:latest \
     --port 8080 \
     --min-scale 0 \
     --max-scale 3 \
     --cpu 0.5 \
     --memory 1G \
     --probe-ready type=http \
     --probe-ready path=/health \
     --probe-ready port=8080 \
     --probe-live type=http \
     --probe-live path=/health \
     --probe-live port=8080
   ```

6. **Get Application URL**:
   ```bash
   ibmcloud ce app get --name turbo-cloud-demo --output url
   ```

---

### Option 4: Deploy using Terraform

1. Change directory to Terraform folder:
   ```bash
   cd deploy/terraform
   ```

2. Create `terraform.tfvars` from example:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

3. Run Terraform:
   ```bash
   terraform init
   terraform apply
   ```

---

## ⚙️ Architecture & Specifications

- **Container Port:** `8080` (Non-privileged Nginx)
- **Base Images:**
  - Build stage: `node:20-alpine`
  - Runtime stage: `nginxinc/nginx-unprivileged:alpine-slim`
- **Healthcheck & Probes:** `/health` (HTTP 200 OK)
- **Recommended Code Engine Sizing:**
  - CPU: `0.5` vCPU
  - Memory: `1G`
  - Autoscaling: `min-scale: 0` (scale-to-zero when idle), `max-scale: 3`
