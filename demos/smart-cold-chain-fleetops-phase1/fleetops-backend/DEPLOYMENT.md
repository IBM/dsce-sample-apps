# FleetOps Backend - Deployment Guide

**Version:** v1.0.5  
**Last Updated:** May 11, 2026

---

## Table of Contents
1. [Quick Deployment](#quick-deployment)
2. [Docker Build & Push](#docker-build--push)
3. [OpenShift Deployment](#openshift-deployment)
4. [WatsonX Orchestrate Integration](#watsonx-orchestrate-integration)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

---

## Quick Deployment

### Local Development
```bash
# 1. Setup
cd fleetops-backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Configure
cp config.yaml config.local.yaml
# Edit config.local.yaml as needed

# 3. Run
uvicorn app.main:app --reload --host 0.0.0.0 --port 8085
```

### Docker

> **Note:** The Docker quick-start below assumes the image has already been built.
> If you haven't built and pushed the image yet, complete the [Docker Build & Push](#docker-build--push) section first.

```bash
# Run
docker run -p 8085:8085 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config.yaml:/app/config.yaml \
  fleetops-backend:latest
```

---

## Docker Build & Push

### Using Podman (Recommended for OpenShift)
```bash
# Build for linux/amd64 platform
podman build --platform linux/amd64 \
  -t <docker image>:<version> \
  -f Dockerfile .

# Login to Docker Hub
podman login docker.io

# Push image
podman push <docker image>:<version>
podman push <docker image>:latest
```

### Using Docker
```bash
# Build
docker build -t <docker image>:<version> .

# Login
docker login docker.io

# Push
docker push <docker image>:<version>
docker push <docker image>:latest
```

### Automated Script
```bash
# Build and push with version tag
./build-and-push.sh <version>

# Build and push as latest
./build-and-push.sh latest
```

---

## OpenShift Deployment

### Prerequisites
- OpenShift CLI (`oc`) installed
- Access to OpenShift cluster
- Docker image already built and pushed to a registry (see [Docker Build & Push](#docker-build--push))

### Quick Deployment (Automated)

Use the provided deployment script for automated deployment with WatsonX integration:

```bash
cd fleetops-backend/k8s
./deploy.sh
```

The script will:
1. Check OpenShift login status
2. Create namespace and resources
3. Prompt for WatsonX Orchestrate credentials (if not already configured)
4. Deploy all Kubernetes resources
5. Wait for deployment to be ready
6. Test health endpoint
7. Display access information

### Manual Deployment (Step-by-Step)

If you prefer manual deployment or need more control:

#### Step 1: Login to OpenShift
```bash
oc login --token=<YOUR_TOKEN> --server=<CLUSTER_URL>
oc project fleetops-backend
```

#### Step 2: Build and Push Image
```bash
# Using the provided script
./build-and-push.sh v1.0.5

# Or manually
podman build --platform linux/amd64 -t <docker image>:<version> .
podman push <docker image>:<version>
```

#### Step 3: Create Namespace (if needed)
```bash
oc apply -f k8s/namespace.yaml
```

#### Step 4: Create Persistent Volume Claim
```bash
oc apply -f k8s/pvc.yaml
```

#### Step 5: Create WatsonX Secret

> **Important:** The secret must exist before applying `deployment.yaml`.
> The deployment references `watsonx-orchestrate-credentials` and will fail to start without it.

**Option A: Using `oc` command**
```bash
oc create secret generic watsonx-orchestrate-credentials \
  --from-literal=WATSONX_ORCHESTRATE_URL="https://api.eu-gb.watson-orchestrate.cloud.ibm.com/instances/YOUR_INSTANCE_ID" \
  --from-literal=WATSONX_ORCHESTRATE_API_KEY="YOUR_API_KEY" \
  --from-literal=WATSONX_ORCHESTRATE_AGENT_WEATHER="WEATHER_AGENT_ID" \
  --from-literal=WATSONX_ORCHESTRATE_AGENT_STATION="STATION_AGENT_ID" \
  --from-literal=WATSONX_ORCHESTRATE_AGENT_ROUTE="ROUTE_AGENT_ID" \
  --from-literal=WATSONX_ORCHESTRATE_AGENT_DECISION="DECISION_AGENT_ID" \
  --from-literal=WATSONX_ORCHESTRATE_AGENT_NOTIFICATION="NOTIFICATION_AGENT_ID" \
  -n fleetops-backend
```

**Option B: Using YAML file**
```bash
# Edit k8s/watsonx-secret.yaml with your credentials, then:
oc apply -f k8s/watsonx-secret.yaml
```

Verify the secret was created:
```bash
oc get secret watsonx-orchestrate-credentials -n fleetops-backend
oc describe secret watsonx-orchestrate-credentials -n fleetops-backend
```

#### Step 6: Deploy Application
```bash
oc apply -f k8s/configmap.yaml
oc apply -f k8s/deployment.yaml
oc apply -f k8s/service.yaml
oc apply -f k8s/route.yaml
```

#### Step 7: Verify Deployment
```bash
# Check pod status
oc get pods -n fleetops-backend

# Check logs
oc logs -f deployment/fleetops-backend -n fleetops-backend

# Get route URL
oc get route fleetops-api -n fleetops-backend
```

---

## WatsonX Orchestrate Integration

### Overview
WatsonX Orchestrate credentials are managed via Kubernetes Secrets and injected as environment variables. The secret is created as part of the [OpenShift deployment steps](#step-5-create-watsonx-secret) above.

### Architecture
```
Kubernetes Secret (watsonx-orchestrate-credentials)
    ↓ (Environment Variables)
Pod (fleetops-backend)
    ↓ (Reads from env vars)
Application (config.yaml + env overrides)
```

### Verify Environment Variables in a Running Pod
```bash
# Get pod name
POD_NAME=$(oc get pods -n fleetops-backend -l app=fleetops,component=backend -o jsonpath='{.items[0].metadata.name}')

# Check environment variables
oc exec $POD_NAME -n fleetops-backend -- env | grep WATSONX
```

### Configuration in config.yaml

The application now supports **environment variable interpolation** in config.yaml using the `${VAR_NAME}` or `${VAR_NAME:default}` syntax:

```yaml
watsonx_orchestrate:
  enabled: true
  # Environment variables are automatically interpolated at runtime
  url: ${WATSONX_ORCHESTRATE_URL}
  api_key: ${WATSONX_ORCHESTRATE_API_KEY}
  agent_weather: ${WATSONX_ORCHESTRATE_AGENT_WEATHER}
  agent_station: ${WATSONX_ORCHESTRATE_AGENT_STATION}
  agent_route: ${WATSONX_ORCHESTRATE_AGENT_ROUTE}
  agent_decision: ${WATSONX_ORCHESTRATE_AGENT_DECISION}
  agent_notification: ${WATSONX_ORCHESTRATE_AGENT_NOTIFICATION}
  timeout: 120
```

**How it works:**
1. The config loader reads `config.yaml`
2. It scans for `${VAR_NAME}` patterns
3. It replaces them with values from environment variables
4. If a variable is not set and no default is provided, it uses an empty string
5. The application validates that all required WatsonX credentials are present

**Startup Validation:**
- If WatsonX Orchestrate is enabled but credentials are missing, the application will fail to start
- This ensures you catch configuration errors early rather than at runtime
- Missing variables are clearly logged with their names

### Updating Credentials
```bash
# Delete existing secret
oc delete secret watsonx-orchestrate-credentials -n fleetops-backend

# Create new secret with updated credentials
oc create secret generic watsonx-orchestrate-credentials \
  --from-literal=WATSONX_ORCHESTRATE_URL="NEW_URL" \
  # ... other credentials

# Restart pods to pick up new values
oc rollout restart deployment/fleetops-backend -n fleetops-backend
```

---

## Configuration

### config.yaml Structure
```yaml
persistence:
  enabled: true
  type: json  # json | astra | db2
  levels:
    initial_data: true
    on_events: true
    interval_seconds: 30
  json:
    data_directory: /app/data

simulation:
  speed_multiplier: 10
  update_interval: 5
  num_trucks: 10
  incident_trucks: 4
  station_spacing_km: 120

watsonx_orchestrate:
  enabled: true
  url: ""  # From environment variable
  api_key: ""  # From environment variable
  agent_weather: ""  # From environment variable
  agent_station: ""  # From environment variable
  agent_route: ""  # From environment variable
  agent_decision: ""  # From environment variable
  agent_notification: ""  # From environment variable
  timeout: 120
```

### Environment Variables
The application reads these environment variables to override config.yaml:

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Application port | No (default: 8085) |
| `PYTHONUNBUFFERED` | Python output buffering | No |
| `WATSONX_ORCHESTRATE_URL` | WatsonX instance URL | Yes (if enabled) |
| `WATSONX_ORCHESTRATE_API_KEY` | WatsonX API key | Yes (if enabled) |
| `WATSONX_ORCHESTRATE_AGENT_WEATHER` | Weather agent ID | Yes (if enabled) |
| `WATSONX_ORCHESTRATE_AGENT_STATION` | Station agent ID | Yes (if enabled) |
| `WATSONX_ORCHESTRATE_AGENT_ROUTE` | Route agent ID | Yes (if enabled) |
| `WATSONX_ORCHESTRATE_AGENT_DECISION` | Decision agent ID | Yes (if enabled) |
| `WATSONX_ORCHESTRATE_AGENT_NOTIFICATION` | Notification agent ID | Yes (if enabled) |

---

## Troubleshooting

### Common Issues

#### 1. Multi-Attach Volume Error
**Symptom:**
```
Warning  FailedAttachVolume  Multi-Attach error for volume "pvc-xxx"
```

**Solution:**
```bash
# Delete old replicasets
oc get replicasets -n fleetops-backend
oc delete replicaset <old-replicaset-name> -n fleetops-backend

# Delete stuck pod
oc delete pod <pod-name> -n fleetops-backend
```

#### 2. Pod CrashLoopBackOff
**Symptom:**
```
Pod status: CrashLoopBackOff
```

**Solution:**
```bash
# Check logs
oc logs <pod-name> -n fleetops-backend

# Common causes:
# - Invalid WatsonX credentials
# - Missing config.yaml
# - Port already in use
# - Insufficient resources
```

#### 3. Secret Not Found
**Symptom:**
```
Error: secrets "watsonx-orchestrate-credentials" not found
```

**Solution:**
```bash
# Create the secret first
oc create secret generic watsonx-orchestrate-credentials \
  --from-literal=WATSONX_ORCHESTRATE_URL="..." \
  # ... other credentials
  -n fleetops-backend
```

#### 4. Disk Space Issues
**Symptom:**
```
Error: [Errno 28] No space left on device
```

**Solution:**
```bash
# Check PVC usage
oc exec <pod-name> -n fleetops-backend -- df -h /app/data

# Clean up old data
oc exec <pod-name> -n fleetops-backend -- rm -rf /app/data/trucks/trucks_*.json
oc exec <pod-name> -n fleetops-backend -- rm -rf /app/data/stations/stations_*.json

# Or increase PVC size (if storage class supports expansion)
oc edit pvc fleetops-data -n fleetops-backend
```

#### 5. Image Pull Errors
**Symptom:**
```
Failed to pull image "<docker image>:<version>"
```

**Solution:**
```bash
# Verify image exists on Docker Hub
podman search docker.io/niteesh18/nndrepo

# Check image pull policy
oc get deployment fleetops-backend -n fleetops-backend -o yaml | grep imagePullPolicy

# Try pulling manually
podman pull <docker image>:<version>
```

### Useful Commands

```bash
# Get all resources
oc get all -n fleetops-backend

# Describe pod for detailed info
oc describe pod <pod-name> -n fleetops-backend

# Check events
oc get events -n fleetops-backend --sort-by='.lastTimestamp'

# View logs with timestamps
oc logs -f <pod-name> -n fleetops-backend --timestamps

# Execute command in pod
oc exec <pod-name> -n fleetops-backend -- <command>

# Port forward for local testing
oc port-forward <pod-name> 8085:8085 -n fleetops-backend

# Rollback deployment
oc rollout undo deployment/fleetops-backend -n fleetops-backend

# Scale deployment
oc scale deployment/fleetops-backend --replicas=2 -n fleetops-backend
```

### Health Checks

```bash
# Get route URL
ROUTE_URL=$(oc get route fleetops-api -n fleetops-backend -o jsonpath='{.spec.host}')

# Test health endpoint
curl -sk https://$ROUTE_URL/health | jq '.'

# Test trucks endpoint
curl -sk https://$ROUTE_URL/api/trucks | jq '.[0]'

# Test specific truck
curl -sk https://$ROUTE_URL/api/trucks/TRUCK-001 | jq '.'
```

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and feature changes.

---

## Support

For issues or questions:
1. Check logs: `oc logs deployment/fleetops-backend -n fleetops-backend`
2. Check pod events: `oc describe pod <pod-name> -n fleetops-backend`
3. Verify configuration: `oc get configmap fleetops-config -n fleetops-backend -o yaml`
4. Check secrets: `oc describe secret watsonx-orchestrate-credentials -n fleetops-backend`

---

**Last Updated:** May 11, 2026  
**Version:** v1.0.5  
**Maintained by:** FleetOps Team
