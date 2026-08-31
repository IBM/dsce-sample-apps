# FleetOps — Architecture

## Solution Architecture

```mermaid
graph TB
    subgraph "Data Source Layer"
        IoT[Python IoT Simulator<br/>GPS & Temperature Data]
        NodeApp[fleetops-backend<br/>Node.js REST API]
        IoT -->|HTTP POST| NodeApp
    end

    subgraph "Observation Layer - Instana"
        Instana[Instana APM<br/>Application Performance Monitoring]
        NodeApp -->|Telemetry| Instana
        Instana -->|Business Breach<br/>Temp > -10°C| Alert1[Alert Trigger]
        Instana -->|Performance Breach<br/>Latency Spike| Alert2[Alert Trigger]
    end

    subgraph "Resource Optimization Layer - Turbonomic"
        Turbo[Turbonomic<br/>Infrastructure Auto-Pilot]
        Alert2 --> Turbo
        Turbo -->|Scale CPU/RAM| NodeApp
        Turbo -->|Optimization Actions| Dashboard
    end

    subgraph "AI Forecasting Layer"
        ForecastBackend[forecast-backend<br/>Python FastAPI + IBM Granite TTM]
        NodeApp -->|Historical Telemetry| ForecastBackend
    end

    subgraph "FleetOps Dashboard"
        Dashboard[FleetOps Carbon Dashboard<br/>Single Pane of Glass]
        NodeApp -->|Fleet Data| Dashboard
        Instana -->|Metrics & Charts| Dashboard
        Turbo -->|Actions & History| Dashboard
        ForecastBackend -->|Predictions| Dashboard

        subgraph "Tab 1: Operations"
            Map[Real-time Map<br/>Truck Locations]
            Gauges[Temperature Gauges<br/>Breach Indicators]
            Alerts[Alert Feed<br/>Severity Levels]
        end

        subgraph "Tab 2: Forecasting"
            TempForecast[Temperature Forecast<br/>96-step TTM Prediction]
            ETAForecast[ETA Prediction]
            FuelForecast[Fuel Consumption Forecast]
            MaintForecast[Maintenance Risk Prediction]
        end

        subgraph "Tab 3: Observe & Optimize"
            ObservePanel[Application Observability<br/>Instana Metrics]
            OptimizePanel[Resource Optimization<br/>Turbonomic Actions]
        end
    end

    style IoT fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style NodeApp fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style Instana fill:#a6c8ff,stroke:#0043ce,stroke-width:2px,color:#000
    style Turbo fill:#a6c8ff,stroke:#0043ce,stroke-width:2px,color:#000
    style ForecastBackend fill:#a6c8ff,stroke:#0043ce,stroke-width:2px,color:#000
    style Dashboard fill:#0f62fe,color:#fff,stroke:#002d9c,stroke-width:3px
    style Map fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style Gauges fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style Alerts fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style TempForecast fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style ETAForecast fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style FuelForecast fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style MaintForecast fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style ObservePanel fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style OptimizePanel fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
```

## Implementation Status

### ✅ Implemented Components
- **Python IoT Simulator** — Streaming GPS & temperature data
- **fleetops-backend (Node.js)** — REST API gateway with telemetry, alerts, stations, and agent endpoints
- **forecast-backend (Python FastAPI)** — IBM Granite TTM model serving temperature, ETA, fuel, and maintenance forecasts
- **Instana Integration** — Real-time APM metrics in the Observe tab
- **Turbonomic Integration** — Resource optimization actions in the Observe tab
- **FleetOps Dashboard** — IBM Carbon Design System UI with 3 tabs

### 🚀 Planned Components
- **watsonx Orchestrate Agents** — Weather, route, station, and decision agents (see ARCHITECTURE_WITH_AGENTS.md)
- **webMethods Integration** — Automated remediation workflows
- **Apptio/FinOps** — Cost tracking and ROI reporting

---

## Data Flow

### Normal Operation
```
IoT Simulator → fleetops-backend → Instana (Monitoring) → FleetOps Dashboard (Display)
                                 → forecast-backend (TTM) → FleetOps Dashboard (Forecasting)
```

### Breach Detection
```
IoT Simulator (Temp Spike)
  → fleetops-backend (Receives Alert)
  → Instana (Detects Breach)
  → Turbonomic (Scales Resources)
  → FleetOps Dashboard (Shows Alert + Action)
```

---

## Technology Stack

### Frontend
- **IBM Carbon Design System** — UI components and design language
- **Leaflet.js** — Interactive maps
- **Chart.js** — Performance and forecast charts
- **Vanilla JavaScript** — No framework overhead

### Backend (FleetOps)
- **Node.js + Express** — REST API proxy server
- **Axios** — HTTP client for backend calls

### Backend Services
- **fleetops-backend** — Node.js, real-time telemetry and alert management
- **forecast-backend** — Python FastAPI, IBM Granite TTM model

### Integrations
- **Instana APM** — Application observability
- **Turbonomic** — Resource optimization
- **OpenShift** — Container orchestration

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "OpenShift Cluster"
        subgraph "fleetops-backend Namespace"
            IoTPod[Python IoT Simulator Pod<br/>Port: 8080]
            NodePod[fleetops-backend Pod<br/>Port: 3000]
            ForecastPod[forecast-backend Pod<br/>Port: 8000]
            FleetPod[FleetOps Dashboard Pod<br/>Port: 4000]

            IoTRoute[Route: coldchain-iot]
            NodeRoute[Route: fleetops-api]
            ForecastRoute[Route: fleetops-forecasting]
            FleetRoute[Route: fleetops]

            IoTPod --> IoTRoute
            NodePod --> NodeRoute
            ForecastPod --> ForecastRoute
            FleetPod --> FleetRoute
        end
    end

    subgraph "External Services (optional)"
        InstanaCloud[Instana SaaS]
        TurboCloud[Turbonomic]
    end

    FleetPod -->|Proxy /api/*| NodePod
    FleetPod -->|Proxy /api/forecast/*| ForecastPod
    FleetPod -->|API Calls| InstanaCloud
    FleetPod -->|API Calls| TurboCloud
    IoTPod -->|Telemetry| NodePod

    style IoTPod fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style NodePod fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style ForecastPod fill:#d0e2ff,stroke:#0f62fe,stroke-width:2px,color:#000
    style FleetPod fill:#0f62fe,color:#fff,stroke:#002d9c,stroke-width:3px
    style InstanaCloud fill:#a6c8ff,stroke:#0043ce,stroke-width:2px,color:#000
    style TurboCloud fill:#a6c8ff,stroke:#0043ce,stroke-width:2px,color:#000
```

---

## Future Enhancements

### Phase 2: watsonx Orchestrate Agents
See [ARCHITECTURE_WITH_AGENTS.md](./ARCHITECTURE_WITH_AGENTS.md) for the full agent architecture design.

### Phase 3: webMethods Integration
- Automated emergency cooling commands
- WhatsApp driver alerts
- ERP integration for bay reservation
- AI-powered route optimization

### Phase 4: Financial Visibility
- Apptio/FinOps integration
- Real-time cost tracking
- ROI calculations and reporting

---

**Built with IBM Carbon Design System and IBM Granite TTM**
