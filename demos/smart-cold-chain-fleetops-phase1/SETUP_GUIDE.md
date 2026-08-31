# Smart Cold-Chain Guardrail Platform — Deploy on OpenShift

> **IBM DSCE Demo Asset · Cold-Chain Logistics**
>
> Deploy the AI-powered cold-chain logistics platform on OpenShift.
> This guide walks you through registering five watsonx Orchestrate agents and tools,
> deploying three backend services to OpenShift, and exploring every dashboard feature —
> from real-time fleet telemetry and IBM Granite TTM forecasting to the live 5-agent decision pipeline.

**Requires:** Python 3.12+ · Node.js 18+ · watsonx Orchestrate SaaS · OpenShift · Podman / Docker

---

## Architecture Overview

```
Browser  https://<dashboard-route>.apps.<cluster>
     |
     v
+------------------------------------------------------------------+
|  FleetOps Dashboard  (Node.js + IBM Carbon)   port 4000          |
|  5 tabs: Operations . Forecasting . Agents . Observe . Driver    |
|  Express proxy --> rewrites /api/*  and  /forecast/*            |
+-------------+---------------------+-----------------------------+
              |                     |
              v                     v
+-------------------------+  +----------------------------------+
|  FleetOps Backend       |  |  Forecast Backend  (FastAPI)     |
|  (FastAPI / Python 3.12)|  |  IBM Granite TTM-R2 model        |
|  port 8085              |  |  port 5001                       |
|  10-truck fleet sim     |  |  Temperature . Station . Weather |
|  Incident engine        |  |  Fleet optimisation forecasts    |
|  WatsonX agent invoke   |  +----------------------------------+
+------------+------------+
             |  POST /api/agents/{id}/invoke
             v
+------------------------------------------------------------------+
|  watsonx Orchestrate  (cloud)                                    |
|                                                                  |
|  weather_advisor --> station_agent --> RouteOptimizationAgent   |
|                                            |                     |
|                                   decision_agent                 |
|                                            |                     |
|                                 notification_agent               |
|                                (WhatsApp driver alert)           |
+------------------------------------------------------------------+
```

---

## Services at a glance

| Component | Count |
|---|---|
| OpenShift services | 3 (fleetops-backend, forecast-backend, FleetOps dashboard) |
| watsonx Orchestrate agents | 5 (Weather → Station → Route → Decision → Notify) |
| Python tools in Orchestrate | 5 (weather · station · route · decision · whatsapp) |
| Dashboard tabs | 5 (Operations · Forecasting · Agents · Observe & Optimize · Driver View) |

---

## Before You Begin — Prerequisites

| Requirement | Version / Notes | Check command |
|---|---|---|
| Python | 3.12 or higher | `python3 --version` |
| Node.js | 18 or higher | `node --version` |
| npm | 9 or higher | `npm --version` |
| Git | Any recent version | `git --version` |
| Docker | Required — for building and pushing service images to a registry | `docker --version` |
| OpenShift CLI (`oc`) | Logged in to your OpenShift cluster | `oc whoami` |
| watsonx Orchestrate instance | Active SaaS instance with API key | IBM Cloud console |
| Orchestrate CLI (`orchestrate`) | ADK CLI authenticated to your instance | `orchestrate env list` |
| Instana account | Active Instana APM tenant with an API token — required for the Observe tab | Instana console → Settings → API Tokens |
| Turbonomic account | Active Turbonomic instance with username & password — required for the Observe tab | Turbonomic console login |
| Twilio account | Account SID, Auth Token, and a WhatsApp-enabled number — required for driver WhatsApp alerts | console.twilio.com |

> **ℹ️ Note:** Instana, Turbonomic, and Twilio are **not strictly required** to deploy.
> You can proceed without them — the core fleet simulation, AI agents, and forecasting will work fully.
> However, the **Observe & Optimize** tab will show no metrics, and the **driver WhatsApp notification**
> will not be sent at the end of an agent workflow.

### Install the ADK CLI and register your Orchestrate environment

Create a dedicated virtual environment for the ADK CLI so it does not conflict with the per-service virtual environments created in later steps.

```bash
# 1. Create and activate a virtual environment for the ADK CLI
python3 -m venv adk-venv
source adk-venv/bin/activate      # Windows: adk-venv\Scripts\activate

# 2. Install the IBM watsonx Orchestrate ADK
pip install ibm-watsonx-orchestrate==2.10

# 3. Register your Orchestrate environment (--url is required)
orchestrate env add --name myenv \
    --url https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<INSTANCE_ID>

# 4. Activate the environment (you will be prompted for your API key)
orchestrate env activate myenv

# 5. Verify -- 'myenv' should be listed as active
orchestrate env list
```

> **💡 Tip:** Keep this terminal open. The `adk-venv` environment must remain active
> whenever you run `orchestrate` CLI commands in Steps 1 and 2.

### Clone the repository

```bash
git clone --branch fleetops-v2 https://github.ibm.com/shanmsel/smart-cold-chain.git
cd smart-cold-chain
```

---

## Step 1 — Import Python tools into watsonx Orchestrate

Five Python tools must be registered in your Orchestrate instance before any agent can run.
Each tool lives under its own directory inside `tools/`.
Run these commands with the `adk-venv` environment active (`source adk-venv/bin/activate`).

### 1a — Import connection schemas

Three tools call live backends and receive their URLs through **key-value connections**.
Register both connection definitions now — before importing any tools — so the `-a` flag works
in the import commands below.

```bash
orchestrate connections import -f tools/connections/fleetops_api.yaml
orchestrate connections import -f tools/connections/forecast_api.yaml
```

> **ℹ️ Note:** You will set the actual backend URLs on these connections in Step 6a,
> after the OpenShift services are deployed. The connections must exist now so the tools
> can reference them; they can carry placeholder values until Step 6a.

### 1b — Import the five tools

### Tool 1 — Weather Forecast

Provides per-waypoint weather forecasts along truck routes with severity classification
(CLEAR / MODERATE / SEVERE) and optional weather injection for demo scenarios.

```bash
orchestrate tools import -k python \
    -f tools/weather_forecast/weather_forecast_tool.py \
    -r tools/weather_forecast/requirements.txt \
    -a fleetops_api
```

### Tool 2 — Station Search

Searches FleetOps stations for facilities matching capability requirements (e.g. `emergencyCooling`)
within a configurable radius, along or off the planned route.

```bash
orchestrate tools import -k python \
    -f tools/station_tool/station_search_tool.py \
    -r tools/station_tool/requirements.txt \
    -a fleetops_api
```

### Tool 3 — Route Optimizer

Scores and ranks alternative routes to candidate facilities using a weighted formula:
Duration 40%, Distance 25%, Cost 20%, Capability 15%.

```bash
orchestrate tools import -k python \
    -f tools/RouteOptimization/tools.py \
    -r tools/RouteOptimization/requirements.txt
```

### Tool 4 — Decision Analysis

Synthesises telemetry, cargo data, weather segments, station facilities, and ranked routes
into a risk-scored decision with financial analysis and post-recovery plan.

```bash
orchestrate tools import -k python \
    -f tools/decision_tool/decision_analysis_tool.py
```

### Tool 5 — WhatsApp Notification

Formats the Decision Agent output into a driver-friendly message and dispatches it
via the Twilio WhatsApp API.

```bash
orchestrate tools import -k python \
    -f tools/whatsapp_notification/whatsapp_notification_tool.py \
    -r tools/whatsapp_notification/requirements.txt \
    -a forecast_api
```

### Verify all five tools are registered

```bash
orchestrate tools list

# Expected -- five entries:
#   get_route_weather_forecast
#   search_stations
#   route_optimizer
#   analyze_decision
#   send_whatsapp_notification
```

---

## Step 2 — Import and deploy the five agents into watsonx Orchestrate

Each YAML file in `agents/` defines an Orchestrate native agent with its LLM, tools, instructions,
and output schema. The workflow is two stages:
- **import** — lands each agent in the **draft** environment for testing
- **deploy** — promotes it to the **live** environment so it is reachable by the FleetOps backend at runtime

| # | Agent YAML file | Name in Orchestrate | Role |
|---|---|---|---|
| 1 | `agents/weather_advisor.yaml` | `weather_advisor` | Per-segment weather severity along the route |
| 2 | `agents/station-agent.yaml` | `station_agent` | Finds nearby facilities matching capability requirements |
| 3 | `agents/RouteOptimizationAgent.yaml` | `RouteOptimizationAgent` | Scores and ranks alternative routes to candidate facilities |
| 4 | `agents/decision-agent.yaml` | `decision_agent` | Risk assessment, facility selection, financial analysis |
| 5 | `agents/notification-agent.yaml` | `notification_agent` | Sends WhatsApp alert to driver after the decision |

### 2a — Import all five agents (lands in draft)

```bash
orchestrate agents import -f agents/weather_advisor.yaml
orchestrate agents import -f agents/station-agent.yaml
orchestrate agents import -f agents/RouteOptimizationAgent.yaml
orchestrate agents import -f agents/decision-agent.yaml
orchestrate agents import -f agents/notification-agent.yaml
```

### 2b — Deploy all five agents to live

Deploying promotes each agent from **draft** to **live**, making it callable via the Orchestrate REST API.

```bash
orchestrate agents deploy --name weather_advisor
orchestrate agents deploy --name station_agent
orchestrate agents deploy --name RouteOptimizationAgent
orchestrate agents deploy --name decision_agent
orchestrate agents deploy --name notification_agent
```

### 2c — Verify all five agents are live

```bash
orchestrate agents list

# Expected -- five entries, each showing status: live
#   weather_advisor
#   station_agent
#   RouteOptimizationAgent
#   decision_agent
#   notification_agent
```

### 2d — Retrieve agent IDs (needed in Step 3)

The FleetOps backend invokes each agent by its Orchestrate **instance UUID**, not by name.

```bash
orchestrate agents list --verbose

# Note the 'id' field for each agent.
# IDs look like: a16f0e60-3de1-44a4-a28a-2f2525e1da7a
```

> **⚠️ Important:** Copy all five UUIDs before moving to Step 3.

---

## Step 3 — Configure and deploy the FleetOps simulation backend to OpenShift

Follow the **OpenShift Deployment → Manual Deployment** section in
`fleetops-backend/DEPLOYMENT.md`. The notes below cover things not mentioned
in that file that you will miss if skipped.

> **⚠️ Before step 2 — update `REPOSITORY` in `build-and-push.sh`**
>
> Line 10 has a placeholder `REPOSITORY="<docker repo>"`. Set it to your Docker Hub
> repository name and run the script from `fleetops-backend/`, not from `k8s/`.

> **⚠️ Before step 6 — update the image in `k8s/deployment.yaml`**
>
> Line 34 contains `image: <docker image path>`. Replace it with the image you
> pushed in step 2, e.g. `docker.io/<your-org>/fleetops-backend:<version>`,
> before running `oc apply -f k8s/deployment.yaml`.

> **⚠️ Step 5 — WatsonX secret requires all 7 keys including notification agent**
>
> Use the agent UUIDs from Step 2d. The `DEPLOYMENT.md` secret command includes all 7 keys.

> **💡 Note the route URL after step 7** — you will need it as `FLEETOPS_API_BASE_URL`
> when configuring the Forecast backend (Step 4) and the dashboard (Step 5).
>
> ```bash
> oc get route fleetops-api -n fleetops-backend -o jsonpath='{.spec.host}'
> ```

---

## Step 4 — Deploy the Forecast backend to OpenShift

The Forecast backend is a Python FastAPI service that loads the **IBM Granite TTM-R2**
(Tiny Time Mixer) model and serves four forecast endpoints used by the Forecasting tab.
Follow the OpenShift deployment option from `forecast-backend/README.md` (Option 3).

### 4a — Build and push the container image

The TTM model (~2–3 GB) is preloaded into the image during build — allow 5–10 minutes.
Run from the repository root.

```bash
# Build
docker build -t <your-registry>/<your-namespace>/fleetops-forecasting:<tag> forecast-backend/

# Push
docker push <your-registry>/<your-namespace>/fleetops-forecasting:<tag>
```

> **⚠️ Update `openshift-deployment.yaml` line 25** with the image you just pushed:
> `image: <your-registry>/<your-namespace>/fleetops-forecasting:<tag>`

### 4b — Edit `openshift-secret.yaml` — Twilio credentials

Open `forecast-backend/openshift-secret.yaml` and fill in your Twilio credentials.
These are used by the WhatsApp notification tool to send driver alerts.

```yaml
# forecast-backend/openshift-secret.yaml
stringData:
  TWILIO_AUTH_TOKEN: "<your-twilio-auth-token>"
  TWILIO_ACCOUNT_SID: "<your-twilio-account-sid>"
  TWILIO_FROM_NUMBER: "whatsapp:+14155238886"
  DEMO_PHONE_NUMBER: "+<your-phone-number>"
```

### 4c — Edit `openshift-configmap.yaml` — point to FleetOps backend

Open `forecast-backend/openshift-configmap.yaml` and update `FLEETOPS_API_BASE_URL`
to the route URL you noted at the end of Step 3. All other values can stay at their defaults.

```yaml
# forecast-backend/openshift-configmap.yaml — key values to verify
FLEETOPS_API_BASE_URL: "https://fleetops-api-fleetops-backend.apps.<your-cluster>"  # from Step 3
FREQUENCY: "1min"          # must be lowercase — 1min / 5min / 1h (NOT 1H)
USE_TTM_MODEL: "True"
DEVICE: "cpu"
CONTEXT_LENGTH: "512"
PREDICTION_LENGTH: "96"
```

> **🔴 Frequency case matters:** Use lowercase pandas frequency strings —
> `1min`, `5min`, `1h`.
> The value `1H` (uppercase H) causes a pandas `ValueError` at startup.

### 4d — Deploy using the script

The `deploy-openshift.sh` script applies the ConfigMap, Secret, Deployment, Service,
and Route in one command. Run it from `forecast-backend/` with `oc` already logged in.

```bash
# From forecast-backend/
cd forecast-backend

# Full deploy (ConfigMap → Secret → Deployment / Service / Route)
./deploy-openshift.sh apply
```

Other useful script commands:

```bash
# Update config only and restart pods (after editing configmap)
./deploy-openshift.sh update-config

# Tail pod logs
./deploy-openshift.sh logs

# Show pods / service / route status
./deploy-openshift.sh status

# Tear everything down
./deploy-openshift.sh delete
```

### 4e — Verify the deployment

```bash
# Get route URL
FORECAST_ROUTE=$(oc get route fleetops-forecasting -n fleetops-backend -o jsonpath='{.spec.host}')

# Health check
curl -sk https://$FORECAST_ROUTE/health

# Expected:
# { "status": "healthy", "service": "fleetops-forecasting", "ttm_model_enabled": true }
```

> **💡 Note the forecast route URL** — you will need it as `FORECAST_API_URL`
> when configuring the FleetOps dashboard in Step 5.

---

## Step 5 — Configure and deploy the FleetOps dashboard to OpenShift

The FleetOps dashboard is a Node.js/Express application that serves the IBM Carbon Design System
UI and proxies all API calls to the two backends deployed in Steps 3 and 4.
Full deployment instructions are in `FleetOps/README.md` → **Deploying to OpenShift**.

> **ℹ️ Prerequisites:** You must have the route URLs from Step 3 (fleetops-backend)
> and Step 4 (forecast-backend) before starting this step. Both services must be running.

### 5a — Files overview

| File | Purpose |
|---|---|
| `openshift-rbac.yaml` | ServiceAccount + Role + RoleBinding |
| `openshift-pvc-execution-history.yaml` | PersistentVolumeClaim for execution history |
| `openshift-configmap.yaml` | Non-sensitive configuration (backend URLs, Instana/Turbonomic settings) |
| `openshift-secrets.yaml.example` | Template for sensitive credentials (Instana token, Turbonomic password) |
| `openshift-deployment.yaml` | Deployment + Service + Route — **image placeholder must be updated** before deploying (see 5b) |
| `deploy-openshift.sh` | Helper script — applies RBAC, PVC, ConfigMap and Deployment in order |

### 5b — Build and push the container image

Run from the repository root.

```bash
# Build
docker build -t <your-registry>/<your-namespace>/fleetops:<tag> FleetOps/

# Push
docker push <your-registry>/<your-namespace>/fleetops:<tag>
```

> **⚠️ Update `openshift-deployment.yaml` line 41** with the image you just pushed:
> `image: <your-registry>/<your-namespace>/fleetops:<tag>`

### 5c — Required edits before deploying

On OpenShift there is no `.env` file. All variables are injected via two manifest files
loaded by `openshift-deployment.yaml` through `envFrom`.

> **⚠️ 1 — Edit `openshift-configmap.yaml`**
>
> Replace every `<placeholder>` with your real values:
>
> ```yaml
> # ── Required: Backend URLs ─────────────────────────────────────────────────
> COLDCHAIN_API_URL: "https://<fleetops-backend-route>.apps.<your-cluster>"  # from Step 3
> FORECAST_API_URL:  "https://<forecast-backend-route>.apps.<your-cluster>"  # from Step 4
>
> # ── Instana (Observe tab) ──────────────────────────────────────────────────
> INSTANA_URL:             "https://<your-instana-tenant>.instana.io"
> INSTANA_BASE_URL:        "https://<your-instana-tenant>.instana.io"
> INSTANA_SERVICE_NAME:    "<service-name-as-registered-in-instana>"
> INSTANA_DEPLOYMENT_NAME: "<kubernetes-deployment-name>"
> INSTANA_NAMESPACE:       "<kubernetes-namespace>"
> INSTANA_CLUSTER:         "<kubernetes-cluster-name>"
>
> # ── Turbonomic (Observe tab) ───────────────────────────────────────────────
> TURBONOMIC_URL:          "https://<your-turbonomic-host>/app/#/view/main/live/<entity-id>/overview"
> TURBONOMIC_LOGIN_URL:    "https://<your-turbonomic-host>/api/v3/login"
> TURBONOMIC_API_URL:      "https://<your-turbonomic-api-host>/api/v3"
> TURBONOMIC_DISPLAY_NAME: "<deployment-display-name-in-turbonomic>"
> ```

> **⚠️ 2 — Edit `openshift-pvc-execution-history.yaml`**
>
> Update the two placeholders before applying:
> - `namespace: <your-namespace>` → set to `fleetops-backend` (the same namespace used in Steps 3 and 4)
> - `storageClassName` → run `oc get storageclass` to find an available class on your cluster

> **⚠️ 3 — Create `openshift-secrets.yaml` from the example**
>
> The `deploy-openshift.sh` script deliberately **skips secrets** and warns you to apply them manually first.
> Base64-encode each value and apply before running the script:
>
> ```bash
> cd FleetOps
> cp openshift-secrets.yaml.example openshift-secrets.yaml
> # base64-encode each credential, e.g.:
> echo -n 'your-instana-token' | base64
> # Edit openshift-secrets.yaml and paste the encoded values, then:
> oc apply -f openshift-secrets.yaml -n fleetops-backend
> ```

### 5d — Login and switch to namespace

```bash
oc login <your-cluster>
oc project fleetops-backend
```

> **ℹ️ Note:** `deploy-openshift.sh` has `PROJECT="fleetops-backend"` hardcoded on line 8.
> If you are using a different namespace, update that value in the script before running it.

### 5e — Deploy

Run from the `FleetOps/` directory. The script applies RBAC, PVC, ConfigMap,
and Deployment in the correct order and prints the route URL on completion.

```bash
cd FleetOps
./deploy-openshift.sh apply
```

### 5f — Verify the deployment

```bash
# Check pod is running
oc get pods -l app=fleetops

# Check logs
oc logs -f deployment/fleetops

# Get the route URL
oc get route fleetops -o jsonpath='{.spec.host}'

# Test health endpoint
curl https://$(oc get route fleetops -o jsonpath='{.spec.host}')/health

# Expected:
# {
#   "status": "healthy",
#   "service": "fleetops-carbon-app",
#   "coldchainApi": "https://<fleetops-backend-route>"
# }
```

> **💡 All three services are now running on OpenShift.** Open the route URL in your
> browser to access the FleetOps dashboard.

---

## Step 6 — Set backend URLs and re-import the three backend-dependent tools

The two connection schemas were already registered in Step 1a. Now that both OpenShift backends
are running, set the real URLs on each connection and re-import the three tools that call them
so Orchestrate injects the correct URL at runtime.

> **ℹ️ Have the two OpenShift route URLs from earlier steps ready before you begin:**
> - **FleetOps backend route** — from Step 3 (`oc get route fleetops-api -n fleetops-backend`)
> - **Forecast backend route** — from Step 4 (`oc get route fleetops-forecasting -n fleetops-backend`)

### Which tools need a URL

| Tool | Connection | URL key(s) injected | URL to use |
|---|---|---|---|
| `get_route_weather_forecast` | `fleetops_api` | `FLEETOPS_API_URL` | FleetOps backend route (Step 3) |
| `search_stations` | `fleetops_api` | `FLEETOPS_API_BASE_URL` | FleetOps backend route (Step 3) |
| `send_whatsapp_notification` | `forecast_api` | `FORECAST_API_URL` | Forecast backend route (Step 4) |
| `route_optimizer` | none | — | — |
| `analyze_decision` | none | — | — |

### 6a — Set the backend URLs on each connection

Replace the placeholders with your actual OpenShift route URLs.
Both `draft` and `live` environments are set so tools work in both.

```bash
# fleetops_api — used by weather_forecast and station_tool
# Use the FleetOps backend route URL from Step 3
orchestrate connections set-credentials -a fleetops_api --env draft \
    -e "FLEETOPS_API_URL=https://<fleetops-api-route>.apps.<your-cluster>" \
    -e "FLEETOPS_API_BASE_URL=https://<fleetops-api-route>.apps.<your-cluster>"

orchestrate connections set-credentials -a fleetops_api --env live \
    -e "FLEETOPS_API_URL=https://<fleetops-api-route>.apps.<your-cluster>" \
    -e "FLEETOPS_API_BASE_URL=https://<fleetops-api-route>.apps.<your-cluster>"

# forecast_api — used by whatsapp_notification
# Use the Forecast backend route URL from Step 4
orchestrate connections set-credentials -a forecast_api --env draft \
    -e "FORECAST_API_URL=https://<forecast-backend-route>.apps.<your-cluster>"

orchestrate connections set-credentials -a forecast_api --env live \
    -e "FORECAST_API_URL=https://<forecast-backend-route>.apps.<your-cluster>"
```

### 6b — Re-import the three backend-dependent tools

Re-import only the three tools that call a backend. The `-a <connection-name>` flag was already
set in Step 1b — re-importing here picks up the real URLs you just set in Step 6a.
Tool 3 (Route Optimizer) and Tool 4 (Decision Analysis) do not need to be re-imported.

**Tool 1 — Weather Forecast** (uses `fleetops_api`)

```bash
orchestrate tools import -k python \
    -f tools/weather_forecast/weather_forecast_tool.py \
    -r tools/weather_forecast/requirements.txt \
    -p tools/weather_forecast \
    -a fleetops_api
```

**Tool 2 — Station Search** (uses `fleetops_api`)

```bash
orchestrate tools import -k python \
    -f tools/station_tool/station_search_tool.py \
    -r tools/station_tool/requirements.txt \
    -a fleetops_api
```

**Tool 5 — WhatsApp Notification** (uses `forecast_api`)

```bash
orchestrate tools import -k python \
    -f tools/whatsapp_notification/whatsapp_notification_tool.py \
    -r tools/whatsapp_notification/requirements.txt \
    -a forecast_api
```

### 6c — Verify all five tools are registered

```bash
orchestrate tools list

# Expected — five entries:
#   get_route_weather_forecast
#   search_stations
#   route_optimizer
#   analyze_decision
#   send_whatsapp_notification
```

---

## Step 7 — Run the demo scenarios

Open the FleetOps dashboard route URL from Step 5 in your browser. The IBM Carbon dark-theme
interface loads with tabs visible based on the active persona. Use the **persona dropdown
at the top-right corner** of the UI to switch between personas:

| Persona | Tabs available |
|---|---|
| **FleetOps Manager** | Operations · Forecasting · Agents |
| **SRE** | Observe & Optimize |
| **Driver** | Driver View |

---

### Scenario A — Real-time fleet monitoring · `Operations` tab *(FleetOps Manager persona)*

1. Click the **Operations** tab.
2. The Leaflet map loads with **10 truck markers**. Green markers indicate normal status; red pulsing markers indicate a critical incident.
3. Click any truck marker on the map to open a popup showing current location, speed, and cargo details.
4. Scroll the **Truck Cards** panel on the right. Each card shows a colour-coded temperature gauge:
   - Green — temperature below −15 °C (optimal)
   - Orange — −15 °C to −10 °C (warning threshold)
   - Red — above −10 °C (critical breach)
5. Wait 10 seconds — the map and all truck cards **auto-refresh** as trucks move along their routes.
6. Identify a truck with a **CRITICAL** badge and note its truck ID for use in Scenario C.

**Expected result:** Map renders with all 10 trucks on their routes across the US, auto-refreshing every 10 seconds. Critical trucks show pulsing red markers alongside orange or red temperature gauges on their cards.

---

### Scenario B — TTM temperature breach forecast · `Forecasting` tab *(FleetOps Manager persona)*

1. Click the **Forecasting** tab.
2. Use the **truck selector dropdown** at the top to choose a truck (e.g. `TRUCK-001`).
3. The **Temperature Forecast** chart renders: 512 historical readings followed by 96 predicted future steps (next 8 hours).
4. Read the **Risk Assessment** panel below the chart:
   - **Risk score** — 0 to 100 composite score
   - **Time to breach** — estimated minutes until predicted threshold violation
   - **Action label** — NORMAL, MONITOR, WARNING, or CRITICAL
   - **Recommendations** — list of suggested actions
5. Switch trucks using the selector — TTM inference takes ~2–3 seconds and the chart re-renders automatically.
6. Scroll down to review the **Station Availability** and **Weather Impact** charts.
7. Wait 30 seconds — all three charts **auto-refresh** with updated TTM forecasts.

**Expected result:** All charts load within ~3 seconds per truck. A truck with an active cooling incident shows a sharp upward temperature trend, a CRITICAL risk score, and a non-null time-to-breach value.

---

### Scenario C — Live 5-agent decision pipeline · `Agents` tab *(FleetOps Manager persona)*

1. Click the **Agents** tab.
2. Five **agent tiles** are displayed — Weather Advisor, Station Facility Search, Route Optimization, Decision & Recommendation, Driver Notification. All show **IDLE** status.
3. Open the **"Select Truck"** dropdown and choose the CRITICAL truck noted in Scenario A.
4. No button press is needed — selecting a truck **automatically triggers** the full pipeline. Each tile cycles through:
   - **PENDING** — agent is queued
   - **RUNNING** — agent executing in Orchestrate (spinner visible)
   - **COMPLETED** — agent finished (green checkmark)
5. Agents execute sequentially: Weather → Station → Route → Decision → Notification (~60–120 seconds total).
6. Watch the **Activity Log** at the bottom — each agent completion appends a timestamped entry.
7. Once all five tiles show **COMPLETED**, click any tile to open its **detail modal** with the full structured JSON output.

**Expected result:** All five tiles reach COMPLETED. The Decision tile modal shows a JSON object with `"decision": "EMERGENCY_REROUTE"` (or similar), a numeric risk score, selected facility and route, financial analysis, and a post-recovery plan.

---

### Scenario D — Inspect agent output in the detail modal · `Agents` tab *(FleetOps Manager persona)*

1. Click the **Decision & Recommendation** tile to open its modal and review:
   - `decision` — EMERGENCY_REROUTE / CONTROLLED_REROUTE / CONTINUE / ABORT
   - `urgency` — LOW / MEDIUM / HIGH / CRITICAL
   - `riskScore` — composite 0–100 (temperature 40 pts + time 20 pts + weather 30 pts + station 10 pts)
   - `selectedFacility` — nearest facility with required capability and open bays
   - `selectedRoute` — highest-scored route with ETA and fuel cost
   - `financialAnalysis.netSavings` — cargo value saved minus reroute cost
   - `postRecoveryPlan` — timeline: cooling restoration → transfer → final arrival
2. Open the **Weather Advisor** modal. Review per-segment severity (CLEAR / MODERATE / SEVERE) and `totalDelayMinutes`.
3. Open the **Station Facility Search** modal. Review ranked facilities with bay availability, distance, travel time, and capability flags.
4. Open the **Route Optimization** modal. Review scored routes sorted by the weighted formula (Duration 40%, Distance 25%, Cost 20%, Capability 15%).

**Expected result:** Each modal shows well-formed JSON. The decision is fully traceable from weather risk through facility scoring to the final route selection and financial justification.

---

### Scenario E — Cross-tab navigation · `Forecasting` → `Agents` *(FleetOps Manager persona)*

1. Click the **Forecasting** tab and select a truck with a CRITICAL forecast risk score.
2. Locate the **"Analyse with AI Agents"** button near the risk assessment panel.
3. Click the button — the dashboard automatically switches to the **Agents** tab with that truck pre-selected.
4. The 5-agent pipeline starts immediately for the pre-selected truck — no further interaction required.

**Expected result:** The Agents tab opens with the same truck pre-selected and the pipeline running automatically, demonstrating end-to-end handoff from predictive analytics to agentic decision-making in a single click.

---

### Scenario F — Observe & Optimize · `Observe & Optimize` tab *(SRE persona)*

1. Switch to the **SRE** persona using the dropdown at the top-right corner. The **Observe & Optimize** tab becomes available.
2. Review the **IBM Instana** and **IBM Turbonomic** integration panels showing deep-links to APM and resource-management dashboards.
3. If `INSTANA_URL` and `TURBONOMIC_URL` are configured in `openshift-configmap.yaml`, the panels load live observability data and cost optimisation recommendations.
4. Without those credentials, the panels render the integration architecture description.

**Expected result:** The tab loads with IBM Carbon-styled integration panels. Clicking the Instana or Turbonomic links opens the respective dashboards in a new browser tab.

---

### Scenario G — Driver-facing summary · `Driver View` tab *(Driver persona)*

1. Switch to the **Driver** persona using the dropdown at the top-right corner. The **Driver View** tab becomes available.
2. Review driver-facing information: current cargo temperature, next waypoint, route status, and active alerts.
3. After completing Scenario C, return to this tab. The Decision Agent rerouting recommendation renders in a driver-friendly format — clear language, no raw JSON.
4. The urgency level (LOW / MEDIUM / HIGH / CRITICAL) controls the visual styling of the alert banner.

**Expected result:** A clean driver summary shows route status, cargo temperature, and the latest agent recommendation with the selected facility name, estimated arrival, and urgency level.

---

## Quick API Reference

| Service | Endpoint | Method | Description |
|---|---|---|---|
| FleetOps backend | `/health` | GET | Health check with simulation and Orchestrate status |
| FleetOps backend | `/api/trucks` | GET | All 10 trucks with real-time telemetry |
| FleetOps backend | `/api/trucks/{truckId}` | GET | Single truck state — cargo, temperature, route |
| FleetOps backend | `/api/routes/waypoints/{truckId}` | GET | Planned route and alternatives with waypoints |
| FleetOps backend | `/api/stations/search` | POST | Search stations by radius and capability requirements |
| FleetOps backend | `/api/agents/execute` | POST | Trigger the full 5-agent pipeline for a given truck |
| Forecast backend | `/api/forecast/temperature/{truck_id}` | GET | TTM temperature breach prediction — 96-step forecast |
| Forecast backend | `/api/forecast/station` | GET | Station bay availability forecast — 240-step forecast |
| Forecast backend | `/api/forecast/weather/{truck_id}` | GET | Weather impact time-series along route |
| Forecast backend | `/api/forecast/fleet` | GET | Fleet-wide optimisation forecast |
| Dashboard | `/health` | GET | Node proxy health with configured backend URLs |
| Dashboard | `/api/*` | — | Transparent proxy forwarded to FleetOps backend |

---

## What You Built

| Component | Technology | Runs on |
|---|---|---|
| Fleet simulation + agent orchestration API | Python 3.12 · FastAPI · APScheduler | OpenShift |
| IBM Granite TTM forecasting API | Python · FastAPI · Hugging Face Transformers | OpenShift |
| Cold-chain operations dashboard | Node.js · Express · IBM Carbon Design System | OpenShift |
| Weather Advisor agent | watsonx Orchestrate native agent · LLM: gpt-oss-120b | Cloud (Orchestrate) |
| Station Facility Search agent | watsonx Orchestrate native agent · LLM: gpt-oss-120b | Cloud (Orchestrate) |
| Route Optimization agent | watsonx Orchestrate native agent · LLM: gpt-oss-120b | Cloud (Orchestrate) |
| Decision & Recommendation agent | watsonx Orchestrate native agent · LLM: gpt-oss-120b | Cloud (Orchestrate) |
| Driver Notification agent | watsonx Orchestrate native agent · Twilio WhatsApp | Cloud (Orchestrate) |
