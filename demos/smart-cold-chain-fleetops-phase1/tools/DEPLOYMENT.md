# Tools — Deployment Guide

This guide covers everything needed to import the FleetOps tools into a
watsonx Orchestrate environment (draft or live).

---

## Prerequisites

Before you begin, ensure the following are in place:

1. **watsonx Orchestrate instance** — a SaaS or on-prem instance with at least
   the *Essentials* plan (draft environment access required).

2. **ADK CLI installed** — version 2.x or later.
   ```bash
   pip install ibm-watsonx-orchestrate
   orchestrate --version
   ```

3. **ADK CLI authenticated** — add your instance and activate it:
   ```bash
   orchestrate env add -n my-env -u https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<id> --activate
   orchestrate env activate my-env --api-key <your-api-key>
   ```

4. **FleetOps backends running** — you need two running backend services and
   their public HTTPS URLs before proceeding:
   - **FleetOps Core API** — serves truck data, station search
     (e.g. `https://fleetops-api.<your-cluster>`)
   - **FleetOps Forecasting API** — serves WhatsApp notifications
     (e.g. `https://fleetops-forecasting.<your-cluster>`)

   The connection credentials step below is **required** — tools will raise a
   clear error at invocation time if either URL is missing.

---

## Overview

| Tool | File | Connection required |
|---|---|---|
| `get_route_weather_forecast` | `weather_forecast/weather_forecast_tool.py` | `fleetops_api` |
| `search_stations` | `station_tool/station_search_tool.py` | `fleetops_api` |
| `route_optimizer` | `RouteOptimization/tools.py` | *(none)* |
| `analyze_decision` | `decision_tool/decision_analysis_tool.py` | *(none)* |
| `send_whatsapp_notification` | `whatsapp_notification/whatsapp_notification_tool.py` | `forecast_api` |

API URLs are injected at runtime via **key-value connections** — no `.env`
files are uploaded to the platform.

---

## Step 1 — Set up connections

### 1a. Import connection schemas

```bash
orchestrate connections import -f tools/connections/fleetops_api.yaml
orchestrate connections import -f tools/connections/forecast_api.yaml
```

### 1b. Set credentials for each environment

Replace the placeholder URLs with the actual backend hosts for your deployment.

```bash
# fleetops_api — used by weather_forecast and station_tool
FLEETOPS_URL=https://<your-fleetops-core-api-host>

for env in draft live; do
    orchestrate connections set-credentials -a fleetops_api --env $env \
        -e "FLEETOPS_API_URL=${FLEETOPS_URL}" \
        -e "FLEETOPS_API_BASE_URL=${FLEETOPS_URL}"
done

# forecast_api — used by whatsapp_notification
FORECAST_URL=https://<your-fleetops-forecasting-api-host>

for env in draft live; do
    orchestrate connections set-credentials -a forecast_api --env $env \
        -e "FORECAST_API_URL=${FORECAST_URL}"
done
```

> **Note:** This step is required. If either URL is not set, the corresponding
> tool will raise a `RuntimeError` on first invocation with instructions on how
> to fix it.

---

## Step 2 — Import tools

```bash
# Weather Forecast Tool
orchestrate tools import \
    -k python \
    -f tools/weather_forecast/weather_forecast_tool.py \
    -r tools/weather_forecast/requirements.txt \
    -p tools/weather_forecast \
    -a fleetops_api

# Station Search Tool
orchestrate tools import \
    -k python \
    -f tools/station_tool/station_search_tool.py \
    -r tools/station_tool/requirements.txt \
    -a fleetops_api

# Route Optimizer Tool (no connection needed)
orchestrate tools import \
    -k python \
    -f tools/RouteOptimization/tools.py \
    -r tools/RouteOptimization/requirements.txt

# Decision Analysis Tool (no connection needed)
orchestrate tools import \
    -k python \
    -f tools/decision_tool/decision_analysis_tool.py

# WhatsApp Notification Tool
orchestrate tools import \
    -k python \
    -f tools/whatsapp_notification/whatsapp_notification_tool.py \
    -r tools/whatsapp_notification/requirements.txt \
    -a forecast_api
```

Verify all 5 tools are registered:
```bash
orchestrate tools list
```

---

## Step 3 — Import and deploy agents

```bash
# Import agent definitions
orchestrate agents import -f agents/weather_advisor.yaml
orchestrate agents import -f agents/station-agent.yaml
orchestrate agents import -f agents/RouteOptimizationAgent.yaml
orchestrate agents import -f agents/decision-agent.yaml
orchestrate agents import -f agents/notification-agent.yaml

# Deploy each agent to make it live
orchestrate agents deploy -n weather_advisor
orchestrate agents deploy -n station_agent
orchestrate agents deploy -n RouteOptimizationAgent
orchestrate agents deploy -n decision_agent
orchestrate agents deploy -n notification_agent
```

---

## Local Development

To run or test tool scripts locally without a running Orchestrate server,
emulate the connections by exporting the `WXO_CONNECTION_*` variables that
Orchestrate injects at runtime:

```bash
# Copy the example and edit with your URLs
cp tools/.env.example tools/.env

# Load into your shell
set -a && source tools/.env && set +a
```

The `WXO_SECURITY_SCHEMA_*` and `WXO_CONNECTION_*` variable names are the
exact names the Orchestrate runtime uses, so the same code path executes in
both environments.

---

## Updating a tool

Re-run the same `orchestrate tools import` command with the updated file.
The tool is matched by its function name and updated in place.

```bash
# Example: re-import station tool after code changes
orchestrate tools import \
    -k python \
    -f tools/station_tool/station_search_tool.py \
    -r tools/station_tool/requirements.txt \
    -a fleetops_api
```
