# FleetOps Post-Git Pull Changes Documentation

**Date**: May 20, 2026  
**Purpose**: Document all changes made to the FleetOps Smart Cold Chain system after the latest git pull for BOB AI Assistant context

---

## Overview

This document captures the current state and recent changes to the FleetOps system to help BOB (AI Assistant) understand the codebase when making future modifications. The system is a smart cold chain logistics platform with real-time truck monitoring, agent-based decision making, and driver-specific views.

---

## System Architecture

### Core Components

1. **Frontend (FleetOps/)** - Node.js/Express server serving web UI
   - Port: 3000
   - Main files: `server.js`, `public/index.html`, `public/driver-view.js`

2. **Backend (fleetops-backend/)** - Python FastAPI service
   - Port: 8005
   - Main files: `app/main.py`, `app/services/simulation_engine.py`

3. **Forecast Backend (forecast-backend/)** - Python forecasting service
   - Time-series forecasting using TTM models

4. **Agent System** - WatsonX Orchestrate integration
   - Decision Agent, Weather Agent, Route Agent, Station Agent, Notification Agent

---

## Current System State

### Active Services
- **Backend API**: Running on `http://localhost:8005`
- **Frontend Server**: Running on `http://localhost:3000`
- **Simulation Engine**: Active with 10 trucks in continuous simulation
- **Persistence**: JSON-based state persistence enabled

### Truck Fleet Status
- **Total Trucks**: 10 (TRUCK-001 through TRUCK-010)
- **Incident-Enabled Trucks**: 
  - TRUCK-001, TRUCK-002: Cargo threshold breach incidents
  - TRUCK-003, TRUCK-004: Weather failure incidents
  - TRUCK-005 through TRUCK-010: Manual trigger only

### Data Persistence
- **Location**: `fleetops-backend/data/`
- **Files**: `trucks.json`, `stations.json`, `alerts.json`, `incidents.json`
- **Auto-save**: Every 60 seconds

---

## Key Features & Functionality

### 1. Driver View Interface

**File**: [`FleetOps/public/driver-view.js`](FleetOps/public/driver-view.js)

**Purpose**: Provides truck-specific view for drivers showing real-time truck status, destination, and notifications.

**Key Functions**:
- [`initDriverMap()`](FleetOps/public/driver-view.js:30-40) - Initializes Leaflet map
- [`updateDriverView(truckId)`](FleetOps/public/driver-view.js:90-142) - Main update function
- [`updateStationInfoPanel(station)`](FleetOps/public/driver-view.js:328-397) - Renders destination station details

**Driver-Truck Mapping**:
```javascript
const driverTruckMap = {
    'mike': 'TRUCK-001',
    'sarah_j': 'TRUCK-002', 
    'carlos': 'TRUCK-003',
    'emily': 'TRUCK-004'
};
```

**Current Implementation Details**:
- Station tile displays destination from `truck.currentTrip.destination.name`
- Fetches station details from `/api/stations` endpoint
- Updates every 5 seconds via polling
- Shows truck telemetry, cargo status, progress, and ETA

### 2. Truck State Management

**File**: [`fleetops-backend/app/models/truck.py`](fleetops-backend/app/models/truck.py)

**Key Models**:
- [`TruckState`](fleetops-backend/app/models/truck.py:31-44) - Complete runtime state
- [`CurrentTrip`](fleetops-backend/app/models/truck.py:19-28) - Trip information with origin/destination
- [`TruckTelemetry`](fleetops-backend/app/models/truck.py:10-16) - Real-time sensor data

**Important Fields**:
- `currentTrip.destination` - Current destination (Location object)
- `originalRoute` - Saved before diversion for recovery
- `diversionState` - Tracks diversion status
- `status` - ACTIVE | DIVERTED | RECOVERING | COMPLETED

### 3. Simulation Engine

**File**: [`fleetops-backend/app/services/simulation_engine.py`](fleetops-backend/app/services/simulation_engine.py)

**Configuration**:
- Simulation speed: 10x accelerated
- Update interval: 5 seconds
- Incident probability: 20% of selected trucks

**Key Responsibilities**:
- Truck position updates
- Cargo temperature simulation
- Incident generation and management
- Alert lifecycle management
- State persistence

### 4. Agent Integration

**WatsonX Orchestrate Agents**:
- **Decision Agent**: Analyzes incidents and recommends actions
- **Weather Agent**: Provides weather forecasts for routes
- **Route Agent**: Optimizes routes based on conditions
- **Station Agent**: Finds suitable stations for diversions
- **Notification Agent**: Sends WhatsApp alerts to drivers

**Environment Variables** (Required):
```bash
WATSONX_ORCHESTRATE_URL
WATSONX_ORCHESTRATE_API_KEY
WATSONX_ORCHESTRATE_AGENT_WEATHER
WATSONX_ORCHESTRATE_AGENT_ROUTE
WATSONX_ORCHESTRATE_AGENT_STATION
WATSONX_ORCHESTRATE_AGENT_DECISION
WATSONX_ORCHESTRATE_AGENT_NOTIFICATION
```

---

## Known Issues & Considerations

### Issue: Driver View Station Display Bug

**Status**: IDENTIFIED - NOT YET FIXED

**Description**: 
When a truck resumes its journey to the original destination after being diverted to an emergency station, the station tile in the driver view continues to show the diverted station instead of updating to show the original destination.

**Journey Flow with Bug**:
1. Truck starts → Original Destination ✅ (displays correctly)
2. Alert triggers → Diverted to Emergency Station ✅ (displays correctly)
3. Issue resolved → Resumes to Original Destination ❌ (BUG: still shows diverted station)

**Root Cause**:
The driver view uses `truck.currentTrip.destination.name` to determine which station to display (lines 116-137 in [`driver-view.js`](FleetOps/public/driver-view.js:116-137)). When a truck resumes its journey, the backend needs to update `currentTrip.destination` back to the original destination, but this update may not be happening correctly.

**Files Involved**:
- Frontend: [`FleetOps/public/driver-view.js`](FleetOps/public/driver-view.js:115-137) - Station display logic
- Backend: [`fleetops-backend/app/services/simulation_engine.py`](fleetops-backend/app/services/simulation_engine.py) - Journey state management
- Model: [`fleetops-backend/app/models/truck.py`](fleetops-backend/app/models/truck.py:19-28) - CurrentTrip model

**Next Steps for BOB**:
1. Examine how `currentTrip.destination` is updated during journey resumption
2. Check if `originalRoute` is properly restored when diversion ends
3. Verify the simulation engine correctly updates truck state on recovery
4. Test the complete flow: original → diverted → resume original

---

## API Endpoints

### Truck Endpoints
- `GET /api/trucks` - Get all trucks
- `GET /api/trucks/{truckId}` - Get specific truck

### Station Endpoints  
- `GET /api/stations` - Get all stations
- `GET /api/stations/{stationId}` - Get specific station

### Alert Endpoints
- `GET /api/alerts?active_only=true` - Get active alerts
- `GET /api/alerts?active_only=false` - Get all alerts

### Agent Endpoints
- `GET /api/agents/notifications/{truckId}` - Get notifications for truck

---

## Development Commands

### Start Backend
```bash
cd fleetops-backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8005
```

### Start Frontend
```bash
cd FleetOps
npm start
```

### Access Points
- Main Dashboard: `http://localhost:3000`
- Driver View: `http://localhost:3000/driver-view.html?driver=mike`
- API Docs: `http://localhost:8005/docs`

---

## File Structure Reference

```
smart-cold-chain/
├── FleetOps/                    # Frontend application
│   ├── server.js               # Express server
│   ├── public/
│   │   ├── index.html          # Main dashboard
│   │   ├── driver-view.js      # Driver interface logic
│   │   ├── app.js              # Main app logic
│   │   └── agents.js           # Agent integration
│   └── package.json
│
├── fleetops-backend/           # Python backend
│   ├── app/
│   │   ├── main.py            # FastAPI application
│   │   ├── models/            # Pydantic models
│   │   │   ├── truck.py       # Truck state models
│   │   │   ├── alert.py       # Alert models
│   │   │   └── incident.py    # Incident models
│   │   ├── services/          # Business logic
│   │   │   ├── simulation_engine.py  # Core simulation
│   │   │   ├── truck_service.py      # Truck management
│   │   │   └── agent_service.py      # Agent integration
│   │   └── api/               # API routes
│   ├── data/                  # Persisted state
│   └── requirements.txt
│
├── forecast-backend/          # Forecasting service
├── agents/                    # Agent YAML configs
└── tools/                     # Agent tools
```

---

## Important Notes for BOB

1. **State Persistence**: All changes to trucks, stations, alerts are auto-saved to JSON files every 60 seconds

2. **Real-time Updates**: Frontend polls backend every 2-5 seconds for updates

3. **Simulation Speed**: 10x accelerated - 1 real second = 10 simulated seconds

4. **Driver View**: Each driver is mapped to a specific truck ID - maintain this mapping

5. **Incident Flow**: Incidents trigger alerts → agents analyze → decisions made → notifications sent

6. **Destination Updates**: When modifying journey logic, ensure `currentTrip.destination` is updated correctly for driver view display

7. **Testing**: Always test the complete journey flow: start → divert → resume to verify UI updates

---

## Recent Changes Summary

### What Was Done
- Analyzed driver view station display logic
- Identified bug in destination display after journey resumption
- Documented current system architecture and state
- Mapped out key files and their relationships

### What Needs Attention
- Fix driver view station tile to show correct destination after resuming from diversion
- Verify backend properly updates `currentTrip.destination` during recovery
- Test complete diversion and recovery flow

---

## Contact & Resources

- **Project**: FleetOps Smart Cold Chain
- **Tech Stack**: Node.js, Python FastAPI, WatsonX Orchestrate
- **Documentation**: See individual README files in each component directory

---

*This document should be updated whenever significant changes are made to the system architecture, data models, or key functionality.*