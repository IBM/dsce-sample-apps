# FleetOps Forecasting Backend - FastAPI

## Overview

FastAPI-based forecasting service for FleetOps cold-chain management using Granite TTM (Tiny Time Mixer) model. Provides AI-powered predictions for temperature breaches, station availability, weather impact, and fleet optimization.

## Project Structure

```
forecast-backend/
├── main.py                      # FastAPI application entry point
├── .env.example                 # Environment template
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Docker image definition
├── .dockerignore               # Docker build exclusions
├── models/
│   └── responses.py            # Pydantic response models
├── services/
│   ├── forecasting_service.py  # Core forecasting logic
│   └── ttm_model.py            # TTM model wrapper
└── README.md                   # This file
```

## Quick Start

### 1. Setup Environment

```bash
cd forecast-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your settings
nano .env
```

### 3. Run the Service

```bash
# Start the server
python3 main.py

# Server will start on http://0.0.0.0:5001
```

### 4. Access API Documentation

- **Swagger UI**: http://localhost:5001/docs
- **ReDoc**: http://localhost:5001/redoc
- **Health Check**: http://localhost:5001/health

## API Endpoints

### 1. Health Check
```
GET /health
```

**Purpose**: Check service health and TTM model status

**Response:**
```json
{
  "status": "healthy",
  "service": "fleetops-forecasting",
  "timestamp": "2026-05-06T12:00:00Z",
  "ttm_model_enabled": true
}
```

**Example:**
```bash
curl http://localhost:5001/health
```

---

### 2. Temperature Breach Prediction
```
GET /api/forecast/temperature/{truck_id}?frequency={optional}
```

**Purpose**: Predicts temperature breaches for a specific truck using TTM model

**FleetOps API Input:**
- `GET {FLEETOPS_API_BASE_URL}/api/trucks/{truck_id}` - Fetches truck telemetry data

**How it Works:**
1. Fetches current truck telemetry from FleetOps API
2. Simulates 512 historical temperature data points (CONTEXT_LENGTH)
3. Invokes TTM model to predict next 96 time steps (PREDICTION_LENGTH)
4. Analyzes predictions for potential breaches
5. Calculates risk score based on:
   - Time to breach
   - Temperature delta from threshold
   - Cargo value at risk
6. Provides actionable recommendations

**Parameters:**
- `truck_id` (required): Truck identifier (e.g., TRUCK-001)
- `frequency` (optional): Time series frequency (default: 1min)
  - Examples: `1min`, `5min`, `15min`, `1h`

**Response Fields:**
- `truck_id`: Truck identifier
- `cargo_type`: Type of cargo being transported
- `cargo_value`: Value of cargo in USD
- `current_temperature`: Current temperature reading
- `critical_threshold`: Temperature threshold for cargo
- `frequency`: Time series frequency used
- `historical`: 512 historical temperature readings
- `forecast`: 96 predicted temperature values
- `risk_assessment`:
  - `risk_score`: 0-100 risk score
  - `time_to_breach`: Minutes until predicted breach (null if none)
  - `action`: CRITICAL/WARNING/MONITOR/NORMAL
  - `message`: Human-readable risk message
  - `recommendations`: List of recommended actions

**Example:**
```bash
# Default frequency (1min)
curl http://localhost:5001/api/forecast/temperature/TRUCK-001

# Custom frequency (5min intervals)
curl "http://localhost:5001/api/forecast/temperature/TRUCK-001?frequency=5min"

# Hourly forecast
curl "http://localhost:5001/api/forecast/temperature/TRUCK-001?frequency=1h"
```

**Use Cases:**
- Proactive breach prevention
- Route optimization based on temperature risk
- Cargo value protection
- Compliance monitoring

---

### 3. Station Availability Forecast
```
GET /api/forecast/station?station_id={optional}&frequency={optional}
```

**Purpose**: Forecasts bay availability at cold storage stations

**FleetOps API Input:**
- `GET {FLEETOPS_API_BASE_URL}/api/stations` - Fetches all station data with occupancy

**How it Works:**
1. Fetches current station occupancy from FleetOps API
2. Identifies top 5 busiest stations (or specific station if provided)
3. Simulates occupancy patterns based on:
   - Time of day (peak hours: 8-10 AM, 2-4 PM)
   - Current occupancy levels
   - Historical patterns
4. Generates 240-point forecast (4 hours at 1-min intervals)
5. Calculates utilization percentages
6. Assesses congestion risk

**Parameters:**
- `station_id` (optional): Specific station to forecast
- `frequency` (optional): Time series frequency (default: 1min)

**Response Fields:**
- `timestamp`: Forecast generation time
- `forecast_horizon`: Time span of forecast
- `frequency`: Time series frequency used
- `stations`: Array of station forecasts
  - `station_id`: Station identifier
  - `station_name`: Station name
  - `region`: Geographic region
  - `current_available`: Currently available bays
  - `total_bays`: Total bay capacity
  - `forecast`:
    - `timestamps`: Forecast time points
    - `available_bays`: Predicted available bays
    - `utilization_percent`: Predicted utilization %
  - `recommendations`: Actionable recommendations

**Example:**
```bash
# All stations
curl "http://localhost:5001/api/forecast/station"

# Specific station
curl "http://localhost:5001/api/forecast/station?station_id=station-123"

# With custom frequency
curl "http://localhost:5001/api/forecast/station?frequency=5min"
```

**Use Cases:**
- Delivery scheduling optimization
- Congestion avoidance
- Resource allocation
- Customer service improvement

---

### 4. Weather Impact Forecast
```
GET /api/forecast/weather/{truck_id}?frequency={optional}
```

**Purpose**: Predicts weather impact on truck operations along the planned route

**FleetOps API Input:**
- `GET {FLEETOPS_API_BASE_URL}/api/trucks/{truck_id}` - Fetches truck telemetry, location, and route data

**How it Works:**
1. Extracts current location from `telemetry.currentLocation` (latitude/longitude)
2. Extracts destination from `currentTrip.destination`
3. Extracts planned route waypoints from `currentTrip.plannedRoute`
4. Generates 6-hour weather forecast along the route
5. Simulates weather conditions at each waypoint/city
6. Analyzes weather conditions:
   - Temperature extremes
   - Precipitation
   - Wind speed
7. Calculates composite risk score
8. Estimates potential delays
9. Provides route-specific recommendations

**Parameters:**
- `truck_id` (required): Truck identifier
- `frequency` (optional): Time series frequency (default: 1min)

**Response Fields:**
- `truck_id`: Truck identifier
- `current_location`: Current GPS coordinates (from telemetry)
  - `latitude`: Current latitude
  - `longitude`: Current longitude
- `destination`: Destination coordinates (from currentTrip)
  - `name`: Destination name
  - `latitude`: Destination latitude
  - `longitude`: Destination longitude
- `weather_forecast`:
  - `forecast_start`: Start time
  - `forecast_end`: End time
  - `route_summary`: Route information
    - `current_location`: Current coordinates
    - `destination`: Destination coordinates
    - `waypoints`: Number of waypoints
    - `cities`: List of cities along route
  - `hourly`: Array of hourly forecasts (6 hours)
    - `timestamp`: Time point
    - `temperature`: Temperature in Celsius
    - `condition`: Weather condition
    - `precipitation_chance`: Precipitation probability (%)
    - `wind_speed`: Wind speed (km/h)
    - `location`: City/location context for this forecast
- `impact_assessment`:
  - `impact_level`: HIGH/MEDIUM/LOW
  - `risk_score`: 0-100 risk score
  - `has_rain`: Boolean
  - `high_wind`: Boolean
  - `extreme_temperature`: Boolean
  - `recommendations`: List of actions

**Example:**
```bash
# Default forecast
curl http://localhost:5001/api/forecast/weather/TRUCK-001

# With custom frequency
curl "http://localhost:5001/api/forecast/weather/TRUCK-001?frequency=5min"
```

**Use Cases:**
- Route planning
- Delay prediction
- Safety management
- Customer communication

---

### 5. Fleet Optimization
```
GET /api/forecast/fleet?frequency={optional}
```

**Purpose**: Holistic fleet-wide risk assessment and optimization

**FleetOps API Input:**
- `GET {FLEETOPS_API_BASE_URL}/api/trucks` - Fetches all active trucks with telemetry

**How it Works:**
1. Fetches all active trucks from FleetOps API
2. For each truck, performs **direct risk assessment** (does NOT call other forecast APIs):
   
   **Temperature Risk (50% weight):**
   - Extracts current temperature from `telemetry.temperature`
   - Extracts critical threshold from `cargo.criticalThreshold`
   - Calculates temperature margin: `abs(current_temp - threshold)`
   - Risk score: `100 - (margin / threshold) * 100`
   - Higher risk when temperature is closer to threshold
   
   **Location Risk (30% weight):**
   - Currently uses placeholder value (30)
   - In production: would calculate distance to destination
   - Could factor in route complexity, traffic, weather zones
   
   **Cargo Value Risk (20% weight):**
   - Extracts cargo value from `cargo.value`
   - Risk score: `min(100, (cargo_value / 500000) * 100)`
   - Higher value cargo = higher risk
   
   **Composite Risk Score:**
   - Formula: `0.5 × temp_risk + 0.3 × location_risk + 0.2 × value_risk`
   - Range: 0-100
   - Thresholds: >70 = HIGH, 40-70 = MEDIUM, <40 = LOW

3. Sorts trucks by composite risk score (highest first)
4. Generates truck-specific insights for top 10 highest-risk trucks
5. Calculates fleet-wide metrics:
   - Total trucks and risk distribution
   - Total cargo value and at-risk cargo value
   - High-priority truck count
   - Average fleet risk score
6. Provides actionable recommendations

**Note:** This endpoint performs its own lightweight risk calculation and does NOT call the other forecast APIs (temperature, weather, station). This makes it fast and efficient for fleet-wide overview.

**Parameters:**
- `frequency` (optional): Time series frequency (default: 1min)

**Response Fields:**
- `fleet_summary`:
  - `total_trucks`: Total number of trucks in fleet
  - `high_risk_trucks`: Count of high-risk trucks (score > 70)
  - `medium_risk_trucks`: Count of medium-risk trucks (40-70)
  - `low_risk_trucks`: Count of low-risk trucks (< 40)
  - `total_cargo_value`: Total cargo value across all trucks
  - `at_risk_cargo_value`: Value of cargo in high-risk trucks (score > 50)
  - `high_priority_trucks`: Count of trucks requiring immediate attention (score > 70)
  - `average_risk_score`: Fleet-wide average risk score
  
- `truck_insights`: Array of top 10 highest-risk trucks (sorted by composite_risk_score)
  - `truck_id`: Truck identifier
  - `cargo_value`: Value of cargo in USD
  - `composite_risk_score`: Overall risk score (0-100)
    - Calculated as: `0.5 × temp_risk + 0.3 × location_risk + 0.2 × value_risk`
  - `temperature_risk`: Temperature component of risk (0-100)
    - Based on proximity to critical threshold
  - `weather_risk`: Weather component (currently placeholder: 30)
    - In production: would factor in route weather conditions
  - `recommended_action`: Specific action based on risk level
    - HIGH (>70): "Immediate intervention required - reroute to nearest station"
    - MEDIUM (40-70): "Monitor closely - prepare contingency plan"
    - LOW (<40): "Continue normal operations"
  - `priority`: Risk priority level (HIGH/MEDIUM/LOW)
  - `estimated_delay`: Estimated delay in minutes (currently placeholder: 0)
  - `time_to_breach`: Estimated minutes until temperature breach
    - Calculated as: `temp_margin × 10` (simplified)
    - `null` if risk score < 50

**Example:**
```bash
# Fleet overview
curl http://localhost:5001/api/forecast/fleet

# With custom frequency
curl "http://localhost:5001/api/forecast/fleet?frequency=5min"
```

**Use Cases:**
- Fleet-wide monitoring
- Resource prioritization
- Risk management
- Executive dashboards

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | 0.0.0.0 | Server bind address |
| `SERVER_PORT` | 5001 | Server port |
| `FLEETOPS_API_BASE_URL` | https://fleetops-api... | FleetOps Backend API URL |
| `CONTEXT_LENGTH` | 512 | TTM context window (historical points) |
| `PREDICTION_LENGTH` | 96 | TTM forecast horizon (future points) |
| `FREQUENCY` | 1min | Default time series frequency |
| `USE_TTM_MODEL` | True | Enable actual TTM model |
| `TTM_MODEL_PATH` | ibm-granite/granite-timeseries-ttm-r2 | TTM model path |
| `DEVICE` | cpu | Device for model (cpu/cuda) |
| `CORS_ORIGINS` | http://localhost:3000,... | Allowed CORS origins |
| `LOG_LEVEL` | INFO | Logging level |

### Frequency Parameter

The `frequency` parameter controls the time intervals for forecasting:

**Supported Values:**
- `1min` - 1-minute intervals (default)
- `5min` - 5-minute intervals
- `15min` - 15-minute intervals
- `1h` - 1-hour intervals (lowercase 'h')
- `1d` - Daily intervals (lowercase 'd')

**Important**: Use lowercase for time units (pandas requirement)
- ✅ `1h` (correct)
- ❌ `1H` (will cause error)

## TTM Model Integration

### Current Status
- ✅ TTM model enabled (`USE_TTM_MODEL=True`)
- ✅ Model: `ibm-granite/granite-timeseries-ttm-r2`
- ✅ Context length: 512 historical points
- ✅ Prediction length: 96 future points (fixed for TTM compatibility)

### How TTM Works
1. **Input**: 512 historical temperature readings
2. **Processing**: TTM analyzes patterns and trends
3. **Output**: 96 predicted temperature values
4. **Fallback**: Mock forecasts if TTM fails

### Model Performance
- **Accuracy**: Production-grade time series forecasting
- **Speed**: ~2-3 seconds per prediction
- **Reliability**: Automatic fallback to mock data

## Deployment

### Option 1: Docker (Recommended)

**Build Image:**
```bash
cd FleetOps/forecast-backend

# Build with TTM model preloaded (~5-10 minutes)
docker build -t fleetops-forecasting:latest .
```

**Run Container:**
```bash
# Using environment file
docker run -d \
  --name fleetops-forecasting \
  -p 5001:5001 \
  --env-file .env \
  fleetops-forecasting:latest

# Using environment variables
docker run -d \
  --name fleetops-forecasting \
  -p 5001:5001 \
  -e FLEETOPS_API_BASE_URL="https://your-api-url.com" \
  -e USE_TTM_MODEL=True \
  -e FREQUENCY=1min \
  fleetops-forecasting:latest
```

**Docker Features:**
- ✅ TTM model preloaded during build (no runtime download)
- ✅ Python 3.11 slim base image
- ✅ Non-root user for security
- ✅ Health check endpoint
- ✅ Optimized layer caching
- ✅ ~2-3GB image size (includes TTM model)

**Manage Container:**
```bash
# View logs
docker logs -f fleetops-forecasting

# Check health
curl http://localhost:5001/health

# Stop container
docker stop fleetops-forecasting

# Remove container
docker rm fleetops-forecasting
```

**Push to Registry:**
```bash
# Tag for registry
docker tag fleetops-forecasting:latest your-registry/fleetops-forecasting:latest

# Push
docker push your-registry/fleetops-forecasting:latest
```

### Option 2: Using Uvicorn
```bash
uvicorn main:app --host 0.0.0.0 --port 5001 --workers 4
```

### Option 3: OpenShift (Recommended for IBM Cloud / TechZone)

The repository includes ready-to-use manifests and a deployment script under `forecast-backend/`:

| File | Purpose |
|------|---------|
| `openshift-configmap.yaml` | Non-sensitive runtime configuration |
| `openshift-secret.yaml` | Sensitive credentials (Twilio, etc.) |
| `openshift-deployment.yaml` | Deployment, Service, and Route |
| `deploy-openshift.sh` | Helper script wrapping `oc apply` |

**Prerequisites:**
- OpenShift CLI (`oc`) installed and logged in
- Target project `fleetops-backend` exists (`oc new-project fleetops-backend`)

**1. Build and push the container image:**

```bash
# Build (TTM model is preloaded during build — takes ~5-10 min)
docker build -t <your-registry>/<your-namespace>/fleetops-forecasting:<tag> forecast-backend/

# Push
docker push <your-registry>/<your-namespace>/fleetops-forecasting:<tag>
```

Then update `openshift-deployment.yaml` line 21 with the image you just pushed:
```yaml
image: <your-registry>/<your-namespace>/fleetops-forecasting:<tag>
```

**2. Edit secrets before deploying**

Open `openshift-secret.yaml` and set your real credentials:
```yaml
stringData:
  TWILIO_AUTH_TOKEN: "<your-auth-token>"
  TWILIO_ACCOUNT_SID: "<your-account-sid>"
  TWILIO_FROM_NUMBER: "whatsapp:+14155238886"
  DEMO_PHONE_NUMBER: "+<your-phone>"
```

**3. Edit the ConfigMap (optional)**

`openshift-configmap.yaml` contains the `FLEETOPS_API_BASE_URL` and other tunables. Update `FLEETOPS_API_BASE_URL` to point at your FleetOps backend route.

**4. Deploy using the script**

```bash
cd forecast-backend

# Full deploy (ConfigMap → Secret → Deployment/Service/Route)
./deploy-openshift.sh apply

# Update config only and restart pods
./deploy-openshift.sh update-config

# Tail logs
./deploy-openshift.sh logs

# Show pods / service / route status
./deploy-openshift.sh status

# Tear everything down
./deploy-openshift.sh delete
```

After a successful `apply`, the script prints:
```
==========================================
Service URL: https://<route-host>
Health Check: https://<route-host>/health
API Docs:     https://<route-host>/docs
==========================================
```

> **Note:** Build time is ~5–10 minutes as the TTM model (~2–3 GB) is preloaded into the image during `docker build`.

## API Response Examples

### Temperature Forecast Response
```json
{
  "truck_id": "TRUCK-001",
  "cargo_type": "biological_samples",
  "cargo_value": 314494.67,
  "current_temperature": -11.2,
  "critical_threshold": -20.0,
  "frequency": "5min",
  "historical": {
    "timestamps": ["2026-05-06 06:00:00", "2026-05-06 06:05:00", ...],
    "temperatures": [-11.5, -11.8, -12.1, ...]
  },
  "forecast": {
    "timestamps": ["2026-05-06 14:30:00", "2026-05-06 14:35:00", ...],
    "temperatures": [-12.1, -12.5, -12.8, ...]
  },
  "risk_assessment": {
    "risk_score": 45,
    "time_to_breach": null,
    "action": "NORMAL",
    "message": "✅ No breach predicted in next 96 minutes",
    "recommendations": ["Continue normal monitoring"]
  }
}
```

### Fleet Optimization Response
```json
{
  "fleet_summary": {
    "total_trucks": 10,
    "high_risk_trucks": 2,
    "medium_risk_trucks": 3,
    "low_risk_trucks": 5,
    "total_cargo_value": 2977654.03,
    "at_risk_cargo_value": 1205559.58,
    "high_priority_trucks": 2,
    "average_risk_score": 35
  },
  "truck_insights": [
    {
      "truck_id": "TRUCK-003",
      "cargo_value": 487641.28,
      "composite_risk_score": 73,
      "temperature_risk": 51,
      "weather_risk": 30,
      "recommended_action": "Immediate intervention required - reroute to nearest station",
      "priority": "HIGH",
      "estimated_delay": 0,
      "time_to_breach": 18
    }
  ]
}
```
