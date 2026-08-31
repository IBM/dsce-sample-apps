# FleetOps — IBM Carbon Design System Application

A fleet management dashboard built with IBM Carbon Design System, providing real-time monitoring, AI-powered forecasting, and observability for cold-chain logistics operations.

## Overview

FleetOps is a Node.js/Express web application that acts as a proxy front-end for two backend services:

| Tab | What it shows |
|-----|--------------|
| **Operations** | Real-time fleet map and truck cards with live telemetry from `fleetops-backend` |
| **Forecasting** | AI-powered predictions (IBM Granite TTM model) served by `forecast-backend` |
| **Observe & Optimize** | Instana APM metrics and Turbonomic resource optimization actions |

---

## Prerequisites

Before setting up FleetOps you must have the following services running and accessible:

1. **`fleetops-backend`** — Node.js REST API that provides truck telemetry, alerts, and station data.
2. **`forecast-backend`** — Python FastAPI service running the IBM Granite TTM forecasting model.

Both services are in this repository. Deploy them first and note their public URLs — you will need them when configuring FleetOps.

Optional (for the Observe tab):
- **Instana APM** instance with an API token
- **Turbonomic** instance with credentials

---

## Quick Start (local)

### 1. Install dependencies

```bash
cd FleetOps
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
PORT=4000
NODE_ENV=development
COLDCHAIN_API_URL=https://<your-fleetops-backend-url>
FORECAST_API_URL=https://<your-forecast-backend-url>
```

All other variables are optional and only needed if you are using the Instana/Turbonomic integrations. See `.env.example` for the full list with explanations.

### 3. Start the server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### 4. Open the application

- **Dashboard**: http://localhost:4000
- **Health check**: http://localhost:4000/health

---

## Running with Docker

Build the image:

```bash
docker build -t fleetops:latest .
```

Run with environment variables:

```bash
docker run -p 4000:4000 \
  -e COLDCHAIN_API_URL=https://<your-fleetops-backend-url> \
  -e FORECAST_API_URL=https://<your-forecast-backend-url> \
  fleetops:latest
```

Or use the helper script (reads from `.env`):

```bash
./run-docker.sh
```

---

## Deploying to OpenShift

### Files overview

| File | Purpose |
|------|---------|
| `openshift-rbac.yaml` | ServiceAccount + Role + RoleBinding |
| `openshift-pvc-execution-history.yaml` | PersistentVolumeClaim for execution history |
| `openshift-configmap.yaml` | Non-sensitive configuration (URLs, names) |
| `openshift-secrets.yaml.example` | Template for sensitive credentials |
| `openshift-deployment.yaml` | Deployment + Service + Route |
| `deploy-openshift.sh` | Helper script that applies all the above |

### Step-by-step

**1. Build and push the container image:**

```bash
# Build
docker build -t <your-registry>/<your-namespace>/fleetops:<tag> FleetOps/

# Push
docker push <your-registry>/<your-namespace>/fleetops:<tag>
```

Then update `openshift-deployment.yaml` line 37 with the image you just pushed:
```yaml
image: <your-registry>/<your-namespace>/fleetops:<tag>
```

**2. Log in to OpenShift and switch to your namespace:**

```bash
oc login <your-cluster>
oc project fleetops-backend   # or your chosen namespace
```

**3. Fill in the ConfigMap:**

Edit `openshift-configmap.yaml` and replace every `<placeholder>` with your real values (backend URLs, Instana/Turbonomic settings).

**4. Create the Secret:**

```bash
cp openshift-secrets.yaml.example openshift-secrets.yaml
# Edit openshift-secrets.yaml — base64-encode each value:
#   echo -n 'your-value' | base64
# Then apply:
oc apply -f openshift-secrets.yaml
```

> **Important:** Never commit `openshift-secrets.yaml` with real values. It is already in `.gitignore`.

**5. Update the PVC (if needed):**

Open `openshift-pvc-execution-history.yaml` and update `namespace` and `storageClassName` for your cluster. Run `oc get storageclass` to list available classes.

**6. Deploy everything:**

```bash
./deploy-openshift.sh apply
```

This applies RBAC, PVC, ConfigMap, and Deployment in the correct order and prints the route URL when done.

**6. Verify:**

```bash
# Check pod is running
oc get pods -l app=fleetops

# Check logs
oc logs -f deployment/fleetops

# Test health endpoint
curl https://$(oc get route fleetops -o jsonpath='{.spec.host}')/health

# Test backend connectivity
curl https://$(oc get route fleetops -o jsonpath='{.spec.host}')/api/trucks
```

### Other deploy-openshift.sh commands

```bash
./deploy-openshift.sh status        # show pods, services, routes
./deploy-openshift.sh logs          # tail application logs
./deploy-openshift.sh update-config # re-apply ConfigMap and restart pods
./deploy-openshift.sh delete        # tear down all resources
```

---

## Health Check

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-03-26T05:20:00.000Z",
  "uptime": 123.456,
  "service": "fleetops-carbon-app",
  "coldchainApi": "https://<your-fleetops-backend-url>"
}
```

---

## API Endpoints

FleetOps proxies all API calls to the configured backend services.

### Cold-chain backend (`COLDCHAIN_API_URL`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trucks` | GET | Fleet truck list with telemetry |
| `/api/trucks/:id` | GET | Single truck details |
| `/api/alerts` | GET | Alert history |
| `/api/stations` | GET | Station/depot information |
| `/api/agents` | GET/POST | watsonx Orchestrate agent integration |
| `/api/weather` | GET | Weather conditions along routes |
| `/api/routes` | GET | Route information |

### Forecast backend (`FORECAST_API_URL`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forecast/temperature` | POST | Temperature forecast (96 steps / 8 hours) |
| `/api/forecast/eta` | POST | ETA prediction |
| `/api/forecast/fuel` | POST | Fuel consumption forecast |
| `/api/forecast/maintenance` | POST | Maintenance risk prediction |

### Instana API (server-side, requires `INSTANA_*` env vars)

| Endpoint | Description |
|----------|-------------|
| `/api/instana/service-metrics` | Service call / error / latency metrics |
| `/api/instana/service-timeseries` | Time-series metrics for charts |
| `/api/instana/infra-metrics` | Infrastructure resource metrics |
| `/api/instana/infra-timeseries` | Infrastructure time-series for charts |

### Turbonomic API (server-side, requires `TURBONOMIC_*` env vars)

| Endpoint | Description |
|----------|-------------|
| `/api/turbonomic/actions/pending` | Pending optimization actions |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `4000`) |
| `NODE_ENV` | No | `development` or `production` |
| `COLDCHAIN_API_URL` | **Yes** | URL of the fleetops-backend service |
| `FORECAST_API_URL` | **Yes** | URL of the forecast-backend service |
| `INSTANA_URL` | No | Deep-link URL shown in the Observe tab |
| `TURBONOMIC_URL` | No | Deep-link URL shown in the Observe tab |
| `INSTANA_BASE_URL` | No | Instana tenant base URL |
| `INSTANA_API_TOKEN` | No | Instana API token |
| `INSTANA_SERVICE_NAME` | No | Service name as registered in Instana |
| `INSTANA_DEPLOYMENT_NAME` | No | Kubernetes deployment name in Instana |
| `INSTANA_NAMESPACE` | No | Kubernetes namespace |
| `INSTANA_CLUSTER` | No | Kubernetes cluster name |
| `TURBONOMIC_LOGIN_URL` | No | Turbonomic login endpoint |
| `TURBONOMIC_API_URL` | No | Turbonomic API endpoint |
| `TURBONOMIC_USERNAME` | No | Turbonomic username |
| `TURBONOMIC_PASSWORD` | No | Turbonomic password |
| `TURBONOMIC_DISPLAY_NAME` | No | Entity display name in Turbonomic |

---

## Project Structure

```
FleetOps/
├── server.js                          # Express proxy server
├── package.json                       # Node.js dependencies and scripts
├── Dockerfile                         # Container image definition
├── .env.example                       # Environment variable template
├── .gitignore
├── .dockerignore
├── public/                            # Frontend (served as static files)
│   ├── index.html                     # Main HTML — IBM Carbon shell + tabs
│   ├── app.js                         # Core app init and tab wiring
│   ├── operations-new.js              # Operations tab (fleet map + truck cards)
│   ├── forecast.js                    # Forecasting tab (TTM charts)
│   ├── agents.js                      # Agents tab (watsonx Orchestrate)
│   └── driver-view.js                 # Driver-facing view
├── openshift-rbac.yaml                # ServiceAccount + Role + RoleBinding
├── openshift-pvc-execution-history.yaml  # PVC for execution history
├── openshift-configmap.yaml           # Non-sensitive ConfigMap
├── openshift-secrets.yaml.example     # Secret template (never commit real values)
├── openshift-deployment.yaml          # Deployment + Service + Route
├── deploy-openshift.sh                # OpenShift deployment helper
├── run-docker.sh                      # Local Docker run helper
├── demo-script.sh                     # Demo script for Manual vs Auto mode
└── reset-all-trucks.sh                # Reset all trucks to normal state
```

---

## Demo Scripts

### Reset all trucks to normal state

```bash
./reset-all-trucks.sh
```

### Run the Manual vs Automated mode demo

```bash
# Against local instance (default)
./demo-script.sh

# Against a deployed instance
./demo-script.sh https://fleetops-fleetops-backend.apps.<your-cluster>
```

See [DEMO-GUIDE.md](./DEMO-GUIDE.md) for a full walkthrough.

---

## Troubleshooting

### Map not loading
- Check the browser console for tile request errors.
- The map uses CartoDB tiles — verify they are accessible from your network.

### Forecast charts empty
```bash
# Verify forecast backend is reachable through FleetOps
curl http://localhost:4000/api/forecast/temperature \
  -X POST -H 'Content-Type: application/json' \
  -d '{"truck_id":"TRUCK-001","context_length":512,"prediction_length":96}'
```

### Truck data not updating
```bash
# Verify cold-chain backend is reachable through FleetOps
curl http://localhost:4000/api/trucks
```

### Observe tab showing no metrics
- Confirm `INSTANA_*` and `TURBONOMIC_*` environment variables are set correctly.
- Verify the API token has the necessary read permissions in your Instana tenant.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full solution architecture diagram.

---

## Related Services

| Service | Description |
|---------|-------------|
| `fleetops-backend` | Node.js REST API — truck telemetry, alerts, stations |
| `forecast-backend` | Python FastAPI — IBM Granite TTM forecasting model |

---

**Built with IBM Carbon Design System and IBM Granite TTM**
