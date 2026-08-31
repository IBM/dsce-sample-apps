# FleetOps AI Agent Orchestration - Architecture Flow

## Overview

The FleetOps AI Agent Orchestration system uses **direct backend integration** where the **backend monitoring system** sequentially calls specialized agents and controls all data flow. The backend receives each agent's output and decides what information to display in the UI.

**Key Principles**:
- **Direct Backend Control**: Backend directly invokes each agent via API calls
- **Sequential Execution**: Backend calls agents one after another: Weather → Station → Route → Decision
- **Output Aggregation**: Backend receives and stores all agent outputs
- **UI Control**: Backend decides what agent data to show in UI based on business logic
- **Decision Authority**: Only the Decision Agent makes recommendations; other agents provide factual data

---

## API Schemas

### Step 0: Backend Initiates Agent Workflow

**Backend receives incident data from its monitoring system:**

The backend system detects a cooling failure incident and gathers the following context data:

```json
{
  "truckId": "string",
  "incidentType": "string",
  "timestamp": "ISO8601 datetime",
  "telemetry": {
    "temperature": "float",
    "coolantStatus": "string",
    "currentLocation": {
      "latitude": "float",
      "longitude": "float"
    }
  },
  "cargo": {
    "type": "string",
    "value": "float",
    "criticalThreshold": "float",
    "timeToSpoilage": "integer (minutes)"
  },
  "currentTrip": {
    "tripId": "string",
    "origin": {
      "name": "string",
      "latitude": "float",
      "longitude": "float"
    },
    "destination": {
      "name": "string",
      "latitude": "float",
      "longitude": "float"
    },
    "plannedRoute": [
      {
        "latitude": "float",
        "longitude": "float",
        "city": "string (optional)",
        "highway": "string (optional)"
      }
    ],
    "estimatedArrival": "ISO8601 datetime"
  }
}
```

The backend then orchestrates calls to each agent sequentially (Weather → Station → Route → Decision) and aggregates their responses for UI presentation.

---

### Step 1: Backend → Weather Agent

```json
POST /agents/weather/analyze
{
  "truckId": "string",
  "currentLocation": {
    "latitude": "float",
    "longitude": "float"
  },
  "destination": {
    "latitude": "float",
    "longitude": "float"
  },
  "routePath": [
    {
      "latitude": "float",
      "longitude": "float",
      "city": "string (optional)"
    }
  ]
}
```

**Weather Agent → Backend**:
```json
{
  "severeWeatherDetected": "boolean",
  "overallWeatherRisk": "integer (0-100)",
  "totalDelayMinutes": "integer",
  "segments": [
    {
      "location": "string",
      "coordinates": {
        "latitude": "float",
        "longitude": "float"
      },
      "condition": "string",
      "severity": "string (CLEAR|MODERATE|SEVERE)",
      "temperature": "float (Fahrenheit)",
      "windSpeed": "float (mph)",
      "visibility": "float (miles)",
      "estimatedDelay": "integer (minutes)"
    }
  ]
}
```

---

### Step 2: Backend → Station Agent

**Backend passes Weather Agent output to Station Agent**:

```json
POST /agents/station/check
{
  "truckId": "string",
  "searchRadius": "float (km)",
  "searchStrategy": "string (along_planned_route | alternative_locations)",
  "plannedRoute": [
    {
      "latitude": "float",
      "longitude": "float",
      "city": "string (optional)",
      "highway": "string (optional)"
    }
  ],
  "requiredCapabilities": ["string"],
  "cargoType": "string"
}
```

**Station Agent → Backend**:
```json
{
  "facilities": [
    {
      "stationId": "string",
      "name": "string",
      "location": {
        "latitude": "float",
        "longitude": "float",
        "address": "string"
      },
      "distance": "float (km)",
      "travelTime": "integer (minutes)",
      "onPlannedRoute": "boolean",
      "baysAvailable": "integer",
      "totalBays": "integer",
      "capabilities": {
        "refrigeration": "boolean",
        "emergencyCooling": "boolean",
        "pharmaceuticalStorage": "boolean"
      },
      "serviceDetails": {
        "capabilityType": "string (e.g., 'emergencyCooling', 'tire_repair', 'mechanical_repair')",
        "available": "boolean",
        "details": "object (optional, capability-specific fields)",
        "serviceFee": "float (optional)"
      },
      "operatingHours": {
        "open24x7": "boolean",
        "currentlyOpen": "boolean",
        "closingTime": "ISO8601 datetime (optional)"
      },
      "score": "integer (0-100)"
    }
  ],
  "totalFacilitiesFound": "integer",
  "searchStrategyUsed": "string (along_planned_route | alternative_locations)"
}
```

---

### Step 3: Backend → Route Agent

**Backend passes Weather and Station Agent outputs to Route Agent**:

```json
POST /agents/route/optimize
{
  "truckId": "string",
  "currentLocation": {
    "latitude": "float",
    "longitude": "float"
  },
  "originalDestination": {
    "latitude": "float",
    "longitude": "float",
    "name": "string"
  },
  "facilities": [
    {
      "stationId": "string",
      "name": "string",
      "latitude": "float",
      "longitude": "float",
      "onPlannedRoute": "boolean"
    }
  ],
  "cargoType": "string"
}
```

**Route Agent → Backend**:
```json
{
  "routes": [
    {
      "routeId": "string",
      "name": "string",
      "destination": {
        "latitude": "float",
        "longitude": "float",
        "facilityName": "string",
        "address": "string (optional)"
      },
      "distance": "float (km)",
      "estimatedDuration": "integer (minutes)",
      "totalDuration": "integer (minutes)",
      "arrivalTime": "ISO8601 datetime",
      "fuelCost": "float",
      "isAlternateRoute": "boolean",
      "waypoints": [
        {
          "latitude": "float",
          "longitude": "float",
          "city": "string",
          "highway": "string (optional)",
          "type": "string (waypoint|destination|facility_location, optional)",
          "note": "string (optional)"
        }
      ]
    }
  ],
  "totalRoutesEvaluated": "integer"
}
```

---

### Step 4: Backend → Decision Agent

**Backend passes all agent outputs (Weather, Station, Route) to Decision Agent**:

```json
POST /agents/decision/orchestrate
{
  "truckId": "string",
  "incidentId": "string",
  "telemetry": {
    "temperature": "float",
    "coolantStatus": "string",
    "location": {
      "latitude": "float",
      "longitude": "float"
    }
  },
  "cargo": {
    "value": "float",
    "criticalThreshold": "float",
    "timeToSpoilage": "integer (minutes)"
  },
  "originalPlan": {
    "destination": "string",
    "estimatedArrival": "ISO8601 datetime"
  },
  "weatherAnalysis": {
    "severeWeatherDetected": "boolean",
    "overallWeatherRisk": "integer",
    "totalDelayMinutes": "integer",
    "segments": [
      {
        "location": "string",
        "condition": "string",
        "severity": "string",
        "estimatedDelay": "integer"
      }
    ]
  },
  "stationAnalysis": {
    "facilities": [
      {
        "stationId": "string",
        "name": "string",
        "travelTime": "integer",
        "onPlannedRoute": "boolean",
        "weatherRisk": "string (optional)",
        "baysAvailable": "integer",
        "serviceAvailable": "boolean",
        "serviceFee": "float (optional)",
        "serviceType": "string (e.g., 'emergencyCooling', 'tire_repair')",
        "score": "integer"
      }
    ],
    "searchStrategyUsed": "string"
  },
  "routeAnalysis": {
    "routes": [
      {
        "routeId": "string",
        "name": "string",
        "destination": {
          "facilityName": "string"
        },
        "totalDuration": "integer",
        "arrivalTime": "ISO8601 datetime",
        "weatherRisk": "string",
        "fuelCost": "float",
        "isAlternateRoute": "boolean"
      }
    ]
  }
}
```

**Decision Agent → Backend**:
```json
{
  "decision": "string (EMERGENCY_REROUTE|CONTINUE|ABORT)",
  "urgency": "string (LOW|MEDIUM|HIGH|CRITICAL)",
  "riskScore": "float (0-100)",
  "riskFactors": [
    {
      "factor": "string",
      "value": "string",
      "points": "float",
      "maxPoints": "float",
      "severity": "string"
    }
  ],
  "selectedRoute": {
    "routeId": "string",
    "name": "string",
    "destination": "string",
    "arrivalTime": "ISO8601 datetime",
    "duration": "integer (minutes)",
    "fuelCost": "float",
    "isAlternateRoute": "boolean"
  },
  "selectedFacility": {
    "stationId": "string",
    "name": "string",
    "onPlannedRoute": "boolean",
    "serviceAvailable": "boolean",
    "serviceFee": "float (optional)",
    "serviceType": "string (e.g., 'emergencyCooling', 'tire_repair')",
    "serviceDuration": "integer (minutes, optional)"
  },
  "rejectedOptions": [
    {
      "type": "string (route|facility)",
      "routeId": "string (optional)",
      "stationId": "string (optional)",
      "name": "string",
      "reason": "string"
    }
  ],
  "recommendation": {
    "action": "string",
    "reasoning": ["string"],
    "estimatedArrival": "ISO8601 datetime",
    "serviceRestored": "ISO8601 datetime (optional)",
    "serviceType": "string (e.g., 'emergencyCooling', 'tire_repair')",
    "safetyBuffer": "integer (minutes)"
  },
  "financialAnalysis": {
    "rerouteCost": "float",
    "breakdown": {
      "additionalFuel": "float",
      "serviceFee": "float"
    },
    "cargoValueAtRisk": "float",
    "netSavings": "float",
    "roi": "float",
    "costAsPercentOfCargo": "float (percentage)"
  },
  "postRecoveryPlan": {
    "serviceRestored": "ISO8601 datetime (optional)",
    "serviceType": "string (e.g., 'emergencyCooling', 'tire_repair')",
    "transferToOriginalDestination": "ISO8601 datetime (optional)",
    "finalArrivalNewYork": "ISO8601 datetime (optional)",
    "totalDelayFromOriginal": "integer (minutes, optional)",
    "cargoCondition": "string (optional)"
  }
}
```

---

### Step 5: Backend Processes All Agent Outputs

**Backend now has all agent outputs:**
- Weather Agent output (weather analysis)
- Station Agent output (facility options)
- Route Agent output (route options)
- Decision Agent output (final recommendation)

**Backend decides what to show in UI based on business logic:**

```json
{
  "decision": "string (EMERGENCY_REROUTE|CONTINUE|ABORT)",
  "urgency": "string (LOW|MEDIUM|HIGH|CRITICAL)",
  "riskScore": "float (0-100)",
  "riskFactors": [
    {
      "factor": "string",
      "value": "string",
      "points": "float",
      "maxPoints": "float",
      "severity": "string"
    }
  ],
  "selectedRoute": {
    "routeId": "string",
    "name": "string",
    "destination": "string",
    "arrivalTime": "ISO8601 datetime",
    "duration": "integer (minutes)",
    "fuelCost": "float",
    "isAlternateRoute": "boolean"
  },
  "selectedFacility": {
    "stationId": "string",
    "name": "string",
    "onPlannedRoute": "boolean",
    "serviceAvailable": "boolean",
    "serviceFee": "float (optional)",
    "serviceType": "string (e.g., 'emergencyCooling', 'tire_repair')",
    "serviceDuration": "integer (minutes, optional)"
  },
  "rejectedOptions": [
    {
      "type": "string (route|facility)",
      "routeId": "string (optional)",
      "stationId": "string (optional)",
      "name": "string",
      "reason": "string"
    }
  ],
  "recommendation": {
    "action": "string",
    "reasoning": ["string"],
    "estimatedArrival": "ISO8601 datetime",
    "serviceRestored": "ISO8601 datetime (optional)",
    "serviceType": "string (e.g., 'emergencyCooling', 'tire_repair')",
    "safetyBuffer": "integer (minutes)"
  },
  "financialAnalysis": {
    "rerouteCost": "float",
    "breakdown": {
      "additionalFuel": "float",
      "serviceFee": "float"
    },
    "cargoValueAtRisk": "float",
    "netSavings": "float",
    "roi": "float",
    "costAsPercentOfCargo": "float (percentage)"
  },
  "postRecoveryPlan": {
    "serviceRestored": "ISO8601 datetime (optional)",
    "serviceType": "string (e.g., 'emergencyCooling', 'tire_repair')",
    "transferToOriginalDestination": "ISO8601 datetime (optional)",
    "finalArrivalNewYork": "ISO8601 datetime (optional)",
    "totalDelayFromOriginal": "integer (minutes, optional)",
    "cargoCondition": "string (optional)"
  }
}
```

---

## Use Case 1: Weather Clear - Search Along Planned Route (Full Example)

**Scenario**: Cooling failure detected at 10:00 AM, weather is clear on planned I-95 route.

**Agent Execution Flow**: Weather → Station → Route → Decision

---


### Step 1: Backend → Weather Agent

```json
POST /agents/weather/analyze
{
  "truckId": "TRUCK-001",
  "currentLocation": {
    "latitude": 41.5234,
    "longitude": -72.8456
  },
  "destination": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "routePath": [
    {
      "latitude": 41.5234,
      "longitude": -72.8456,
      "city": "Meriden, CT"
    },
    {
      "latitude": 41.3082,
      "longitude": -72.9279,
      "city": "New Haven, CT"
    },
    {
      "latitude": 41.0534,
      "longitude": -73.5387,
      "city": "Bridgeport, CT"
    },
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "city": "New York, NY"
    }
  ]
}
```

**Weather Agent → Backend**:
```json
{
  "severeWeatherDetected": false,
  "overallWeatherRisk": 15,
  "totalDelayMinutes": 0,
  "segments": [
    {
      "location": "Meriden, CT",
      "coordinates": {
        "latitude": 41.5234,
        "longitude": -72.8456
      },
      "condition": "clear",
      "severity": "LOW",
      "temperature": 22,
      "windSpeed": 10,
      "visibility": 10,
      "estimatedDelay": 0
    },
    {
      "location": "New Haven, CT",
      "coordinates": {
        "latitude": 41.3082,
        "longitude": -72.9279
      },
      "condition": "partly_cloudy",
      "severity": "LOW",
      "temperature": 21,
      "windSpeed": 12,
      "visibility": 10,
      "estimatedDelay": 0
    },
    {
      "location": "Bridgeport, CT",
      "coordinates": {
        "latitude": 41.0534,
        "longitude": -73.5387
      },
      "condition": "clear",
      "severity": "LOW",
      "temperature": 20,
      "windSpeed": 8,
      "visibility": 10,
      "estimatedDelay": 0
    },
    {
      "location": "New York, NY",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "condition": "clear",
      "severity": "LOW",
      "temperature": 19,
      "windSpeed": 15,
      "visibility": 10,
      "estimatedDelay": 0
    }
  ]
}
```

---

### Step 2: Backend → Station Agent

**Backend Logic**:
```
IF weatherData.severeWeatherDetected == false:
  SET searchStrategy = "along_planned_route"
```

```json
POST /agents/station/check
{
  "truckId": "TRUCK-001",
  "searchRadius": 50,
  "searchStrategy": "along_planned_route",
  "plannedRoute": [
    {
      "latitude": 41.5234,
      "longitude": -72.8456,
      "city": "Meriden, CT",
      "highway": "I-95 South"
    },
    {
      "latitude": 41.3082,
      "longitude": -72.9279,
      "city": "New Haven, CT",
      "highway": "I-95 South"
    },
    {
      "latitude": 41.0534,
      "longitude": -73.5387,
      "city": "Bridgeport, CT",
      "highway": "I-95 South"
    },
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "city": "New York, NY",
      "highway": "I-95 South"
    }
  ],
  "requiredCapabilities": [
    "emergency_cooling",
    "refrigeration",
    "pharmaceutical_storage"
  ],
  "cargoType": "temperature_sensitive_vaccines"
}
```

**Station Agent Logic**:
- `searchStrategy = "along_planned_route"` → Search only near planned route waypoints
- Finds facilities within 50km of I-95 waypoints
- Returns only facilities that are ON the planned route

**Output**: 
```json
{
  "facilities": [
    {
      "stationId": "station-newhaven-001",
      "name": "New Haven Cold Storage",
      "location": {
        "latitude": 41.3095,
        "longitude": -72.9245,
        "address": "500 Harbor Drive, New Haven, CT 06511"
      },
      "distance": 25,
      "travelTime": 30,
      "onPlannedRoute": true,
      "baysAvailable": 2,
      "serviceDetails": {
        "capabilityType": "emergencyCooling",
        "available": true,
        "details": {
          "coolingDuration": 45,
          "temperatureRange": "-20°C to 8°C"
        },
        "serviceFee": 600
      },
      "score": 85
    },
    {
      "stationId": "station-bridgeport-001",
      "name": "Bridgeport Warehouse",
      "location": {
        "latitude": 41.0548,
        "longitude": -73.5412,
        "address": "2000 Commerce Street, Bridgeport, CT 06604"
      },
      "distance": 65,
      "travelTime": 75,
      "onPlannedRoute": true,
      "baysAvailable": 1,
      "serviceDetails": {
        "capabilityType": "emergencyCooling",
        "available": false
      },
      "score": 45
    },
    {
      "stationId": "station-newyork-001",
      "name": "New York Distribution Center",
      "location": {
        "latitude": 40.7145,
        "longitude": -74.0035,
        "address": "500 West Side Avenue, New York, NY 10001"
      },
      "distance": 145,
      "travelTime": 180,
      "onPlannedRoute": true,
      "baysAvailable": 5,
      "serviceDetails": {
        "capabilityType": "emergencyCooling",
        "available": false
      },
      "score": 60
    }
  ],
  "totalFacilitiesFound": 3,
  "searchStrategyUsed": "along_planned_route"
}
```

**Station Agent Logic**:
- `searchStrategy = "along_planned_route"` → Search only near planned route waypoints
- Finds facilities within 50km of I-95 waypoints
- Returns only facilities that are ON the planned route
- All facilities have `onPlannedRoute: true`

---

### Step 3: Backend → Route Agent

```json
POST /agents/route/optimize
{
  "truckId": "TRUCK-001",
  "currentLocation": {
    "latitude": 41.5234,
    "longitude": -72.8456
  },
  "originalDestination": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "name": "New York Distribution Center"
  },
  "facilities": [
    {
      "stationId": "station-newhaven-001",
      "name": "New Haven Cold Storage",
      "latitude": 41.3095,
      "longitude": -72.9245,
      "onPlannedRoute": true
    },
    {
      "stationId": "station-bridgeport-001",
      "name": "Bridgeport Warehouse",
      "latitude": 41.0548,
      "longitude": -73.5412,
      "onPlannedRoute": true
    },
    {
      "stationId": "station-newyork-001",
      "name": "New York Distribution Center",
      "latitude": 40.7145,
      "longitude": -74.0035,
      "onPlannedRoute": true
    }
  ],
  "cargoType": "temperature_sensitive"
}
```

**Route Agent → Backend**:
```json
{
  "routes": [
    {
      "routeId": "route-newhaven",
      "name": "I-95 South to New Haven Cold Storage",
      "destination": {
        "latitude": 41.3095,
        "longitude": -72.9245,
        "facilityName": "New Haven Cold Storage",
        "address": "500 Harbor Drive, New Haven, CT 06511"
      },
      "distance": 25,
      "estimatedDuration": 30,
      "totalDuration": 30,
      "arrivalTime": "2026-04-29T10:30:00.000Z",
      "fuelCost": 10,
      "isAlternateRoute": false,
      "waypoints": [
        {
          "latitude": 41.5234,
          "longitude": -72.8456,
          "city": "Meriden, CT",
          "highway": "I-95 South"
        },
        {
          "latitude": 41.3095,
          "longitude": -72.9245,
          "city": "New Haven, CT",
          "type": "facility_location",
          "note": "Exit I-95 to Harbor Drive"
        }
      ]
    },
    {
      "routeId": "route-bridgeport",
      "name": "I-95 South to Bridgeport Warehouse",
      "destination": {
        "latitude": 41.0548,
        "longitude": -73.5412,
        "facilityName": "Bridgeport Warehouse",
        "address": "2000 Commerce Street, Bridgeport, CT 06604"
      },
      "distance": 65,
      "estimatedDuration": 75,
      "totalDuration": 75,
      "arrivalTime": "2026-04-29T11:15:00.000Z",
      "fuelCost": 22,
      "isAlternateRoute": false,
      "waypoints": [
        {
          "latitude": 41.5234,
          "longitude": -72.8456,
          "city": "Meriden, CT",
          "highway": "I-95 South"
        },
        {
          "latitude": 41.3082,
          "longitude": -72.9279,
          "city": "New Haven, CT",
          "highway": "I-95 South"
        },
        {
          "latitude": 41.0548,
          "longitude": -73.5412,
          "city": "Bridgeport, CT",
          "type": "facility_location",
          "note": "Exit I-95 to Commerce Street"
        }
      ]
    },
    {
      "routeId": "route-newyork",
      "name": "I-95 South to New York Distribution Center",
      "destination": {
        "latitude": 40.7145,
        "longitude": -74.0035,
        "facilityName": "New York Distribution Center",
        "address": "500 West Side Avenue, New York, NY 10001"
      },
      "distance": 145,
      "estimatedDuration": 180,
      "totalDuration": 180,
      "arrivalTime": "2026-04-29T13:00:00.000Z",
      "fuelCost": 48,
      "isAlternateRoute": false,
      "waypoints": [
        {
          "latitude": 41.5234,
          "longitude": -72.8456,
          "city": "Meriden, CT",
          "highway": "I-95 South"
        },
        {
          "latitude": 41.3082,
          "longitude": -72.9279,
          "city": "New Haven, CT",
          "highway": "I-95 South"
        },
        {
          "latitude": 41.0534,
          "longitude": -73.5387,
          "city": "Bridgeport, CT",
          "highway": "I-95 South"
        },
        {
          "latitude": 40.7145,
          "longitude": -74.0035,
          "city": "New York, NY",
          "type": "facility_location",
          "note": "Exit I-95 to West Side Avenue"
        }
      ]
    }
  ],
  "totalRoutesEvaluated": 3
}
```

**Route Agent Logic**:
- All facilities have `onPlannedRoute: true`
- Generates routes following I-95 to each facility
- Waypoints follow the planned route coordinates
- All routes have `isAlternateRoute: false`

---

### Step 4: Backend → Decision Agent

```json
POST /agents/decision/orchestrate
{
  "truckId": "TRUCK-001",
  "incidentId": "incident-20260429-001",
  "telemetry": {
    "temperature": -8.0,
    "coolantStatus": "failure",
    "location": {
      "latitude": 41.5234,
      "longitude": -72.8456
    }
  },
  "cargo": {
    "value": 200000,
    "criticalThreshold": -10,
    "timeToSpoilage": 120
  },
  "originalPlan": {
    "destination": "New York Distribution Center",
    "estimatedArrival": "2026-04-29T13:00:00.000Z"
  },
  "weatherAnalysis": {
    "severeWeatherDetected": false,
    "overallWeatherRisk": 15,
    "totalDelayMinutes": 0,
    "segments": [
      {
        "location": "New Haven, CT",
        "condition": "partly_cloudy",
        "severity": "LOW",
        "estimatedDelay": 0
      }
    ]
  },
  "stationAnalysis": {
    "facilities": [
      {
        "stationId": "station-newhaven-001",
        "name": "New Haven Cold Storage",
        "travelTime": 30,
        "onPlannedRoute": true,
        "baysAvailable": 2,
        "serviceAvailable": true,
        "serviceFee": 600,
        "serviceType": "emergencyCooling",
        "score": 85
      },
      {
        "stationId": "station-bridgeport-001",
        "name": "Bridgeport Warehouse",
        "travelTime": 75,
        "onPlannedRoute": true,
        "baysAvailable": 1,
        "serviceAvailable": false,
        "serviceType": "emergencyCooling",
        "score": 45
      },
      {
        "stationId": "station-newyork-001",
        "name": "New York Distribution Center",
        "travelTime": 180,
        "onPlannedRoute": true,
        "baysAvailable": 5,
        "serviceAvailable": false,
        "serviceType": "emergencyCooling",
        "score": 60
      }
    ],
    "searchStrategyUsed": "along_planned_route"
  },
  "routeAnalysis": {
    "routes": [
      {
        "routeId": "route-newhaven",
        "name": "I-95 South to New Haven Cold Storage",
        "destination": {
          "facilityName": "New Haven Cold Storage"
        },
        "totalDuration": 30,
        "arrivalTime": "2026-04-29T10:30:00.000Z",
        "weatherRisk": "LOW",
        "fuelCost": 10,
        "isAlternateRoute": false
      },
      {
        "routeId": "route-bridgeport",
        "name": "I-95 South to Bridgeport Warehouse",
        "destination": {
          "facilityName": "Bridgeport Warehouse"
        },
        "totalDuration": 75,
        "arrivalTime": "2026-04-29T11:15:00.000Z",
        "weatherRisk": "LOW",
        "fuelCost": 22,
        "isAlternateRoute": false
      },
      {
        "routeId": "route-newyork",
        "name": "I-95 South to New York Distribution Center",
        "destination": {
          "facilityName": "New York Distribution Center"
        },
        "totalDuration": 180,
        "arrivalTime": "2026-04-29T13:00:00.000Z",
        "weatherRisk": "LOW",
        "fuelCost": 48,
        "isAlternateRoute": false
      }
    ]
  }
}
```

**Decision Agent → Backend**:
```json
{
  "decision": "EMERGENCY_REROUTE",
  "urgency": "CRITICAL",
  "riskScore": 75.0,
  "riskFactors": [
    {
      "factor": "Temperature",
      "value": "-8°C",
      "severity": "CRITICAL"
    },
    {
      "factor": "Time Criticality",
      "value": "120 minutes to spoilage",
      "severity": "CRITICAL"
    },
    {
      "factor": "Weather",
      "value": "Clear conditions",
      "severity": "LOW"
    },
    {
      "factor": "Station Availability",
      "value": "Nearest facility with emergency cooling available",
      "severity": "LOW"
    }
  ],
  "selectedRoute": {
    "routeId": "route-newhaven",
    "name": "I-95 South to New Haven Cold Storage",
    "destination": "New Haven Cold Storage",
    "arrivalTime": "2026-04-29T10:30:00.000Z",
    "duration": 30,
    "fuelCost": 10,
    "isAlternateRoute": false
  },
  "selectedFacility": {
    "stationId": "station-newhaven-001",
    "name": "New Haven Cold Storage",
    "onPlannedRoute": true,
    "serviceAvailable": true,
    "serviceFee": 600,
    "serviceType": "emergencyCooling",
    "coolingDuration": 45
  },
  "rejectedOptions": [
    {
      "type": "facility",
      "stationId": "station-bridgeport-001",
      "name": "Bridgeport Warehouse",
      "reason": "No emergency cooling equipment - cannot restore temperature"
    },
    {
      "type": "facility",
      "stationId": "station-newyork-001",
      "name": "New York Distribution Center",
      "reason": "No emergency cooling equipment and arrival time exceeds optimal response window"
    }
  ],
  "recommendation": {
    "action": "Immediate reroute to New Haven Cold Storage",
    "reasoning": [
      "Nearest facility with emergency cooling (30 minutes away)",
      "Arrives well within 120-minute deadline (10:30 AM)",
      "Emergency cooling restores temperature in 45 minutes",
      "Cargo will be stabilized by 11:15 AM (45 min before 12:00 PM deadline)",
      "Clear weather on I-95 route (no delays)",
      "2 bays available for immediate docking"
    ],
    "estimatedArrival": "2026-04-29T10:30:00.000Z",
    "serviceRestored": "2026-04-29T11:15:00.000Z",
    "serviceType": "emergencyCooling",
    "safetyBuffer": 45
  },
  "financialAnalysis": {
    "rerouteCost": 610,
    "breakdown": {
      "additionalFuel": 10,
      "serviceFee": 600
    },
    "cargoValueAtRisk": 200000,
    "netSavings": 199390,
    "roi": 32686,
    "costAsPercentOfCargo": 0.305
  },
  "postRecoveryPlan": {
    "serviceRestored": "2026-04-29T11:15:00.000Z",
    "serviceType": "emergencyCooling",
    "transferToOriginalDestination": "2026-04-29T14:00:00.000Z",
    "finalArrivalNewYork": "2026-04-29T16:30:00.000Z",
    "totalDelayFromOriginal": 210,
    "cargoCondition": "PRESERVED"
  }
}
```

---

### Step 5: Backend Processes All Agent Outputs

**Backend receives the Decision Agent's response and presents it to the UI:**

```json
{
  "decision": "EMERGENCY_REROUTE",
  "urgency": "CRITICAL",
  "riskScore": 75.0,
  "riskFactors": [
    {
      "factor": "Temperature",
      "value": "-8°C",
      "severity": "CRITICAL"
    },
    {
      "factor": "Time Criticality",
      "value": "120 minutes to spoilage",
      "severity": "CRITICAL"
    },
    {
      "factor": "Weather",
      "value": "Clear conditions",
      "severity": "LOW"
    },
    {
      "factor": "Station Availability",
      "value": "Nearest facility with emergency cooling available",
      "severity": "LOW"
    }
  ],
  "selectedRoute": {
    "routeId": "route-newhaven",
    "name": "I-95 South to New Haven Cold Storage",
    "destination": "New Haven Cold Storage",
    "arrivalTime": "2026-04-29T10:30:00.000Z",
    "duration": 30,
    "fuelCost": 10,
    "isAlternateRoute": false
  },
  "selectedFacility": {
    "stationId": "station-newhaven-001",
    "name": "New Haven Cold Storage",
    "onPlannedRoute": true,
    "serviceAvailable": true,
    "serviceFee": 600,
    "serviceType": "emergencyCooling",
    "coolingDuration": 45
  },
  "rejectedOptions": [
    {
      "type": "facility",
      "stationId": "station-bridgeport-001",
      "name": "Bridgeport Warehouse",
      "reason": "No emergency cooling equipment - cannot restore temperature"
    },
    {
      "type": "facility",
      "stationId": "station-newyork-001",
      "name": "New York Distribution Center",
      "reason": "No emergency cooling equipment and arrival time exceeds optimal response window"
    }
  ],
  "recommendation": {
    "action": "Immediate reroute to New Haven Cold Storage",
    "reasoning": [
      "Nearest facility with emergency cooling (30 minutes away)",
      "Arrives well within 120-minute deadline (10:30 AM)",
      "Emergency cooling restores temperature in 45 minutes",
      "Cargo will be stabilized by 11:15 AM (45 min before 12:00 PM deadline)",
      "Clear weather on I-95 route (no delays)",
      "2 bays available for immediate docking"
    ],
    "estimatedArrival": "2026-04-29T10:30:00.000Z",
    "serviceRestored": "2026-04-29T11:15:00.000Z",
    "serviceType": "emergencyCooling",
    "safetyBuffer": 45
  },
  "financialAnalysis": {
    "rerouteCost": 610,
    "breakdown": {
      "additionalFuel": 10,
      "serviceFee": 600
    },
    "cargoValueAtRisk": 200000,
    "netSavings": 199390,
    "roi": 32686,
    "costAsPercentOfCargo": 0.305
  },
  "postRecoveryPlan": {
    "serviceRestored": "2026-04-29T11:15:00.000Z",
    "serviceType": "emergencyCooling",
    "transferToOriginalDestination": "2026-04-29T14:00:00.000Z",
    "finalArrivalNewYork": "2026-04-29T16:30:00.000Z",
    "totalDelayFromOriginal": 210,
    "cargoCondition": "PRESERVED"
  }
}
```

---

### Use Case 2: Severe Weather - Search Alternative Locations

**Scenario**: Cooling failure detected, severe weather on planned route (I-95).

**Agent Execution Flow**: Weather → Station → Route → Decision

#### Step 1: Weather Agent

**Input**:
```json
{
  "truckId": "TRUCK-001",
  "currentLocation": {
    "latitude": 41.5234,
    "longitude": -72.8456
  },
  "destination": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "routePath": [
    {
      "latitude": 41.5234,
      "longitude": -72.8456,
      "city": "Meriden, CT"
    },
    {
      "latitude": 41.3082,
      "longitude": -72.9279,
      "city": "New Haven, CT"
    },
    {
      "latitude": 41.0534,
      "longitude": -73.5387,
      "city": "Bridgeport, CT"
    },
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "city": "New York, NY"
    }
  ]
}
```

**Output**:
```json
{
  "severeWeatherDetected": true,
  "overallWeatherRisk": 75,
  "totalDelayMinutes": 60,
  "segments": [
    {
      "location": "New Haven, CT",
      "coordinates": { "latitude": 41.3082, "longitude": -72.9279 },
      "condition": "thunderstorm",
      "severity": "HIGH",
      "estimatedDelay": 30
    },
    {
      "location": "Bridgeport, CT",
      "coordinates": { "latitude": 41.0534, "longitude": -73.5387 },
      "condition": "rain",
      "severity": "MEDIUM",
      "estimatedDelay": 20
    }
  ]
}
```

#### Step 2: Station Agent
**Input**:
```json
{
  "truckId": "TRUCK-001",
  "searchRadius": 150,
  "searchStrategy": "alternative_locations",
  "plannedRoute": [
    { "latitude": 41.5234, "longitude": -72.8456, "city": "Meriden, CT", "highway": "I-95" },
    { "latitude": 41.3082, "longitude": -72.9279, "city": "New Haven, CT", "highway": "I-95" },
    { "latitude": 41.0534, "longitude": -73.5387, "city": "Bridgeport, CT", "highway": "I-95" },
    { "latitude": 40.7128, "longitude": -74.0060, "city": "New York, NY", "highway": "I-95" }
  ],
  "requiredCapabilities": ["emergency_cooling", "refrigeration"],
  "cargoType": "temperature_sensitive_vaccines"
}
```

**Station Agent Logic**:
- `searchStrategy = "alternative_locations"` → Expand search radius (150km)
- Identifies affected areas: New Haven, Bridgeport (on I-95 with severe weather)
- Searches for facilities in SAFE ZONES (areas NOT affected by weather)
- Returns ONLY facilities that are OFF the planned route (all have `onPlannedRoute: false`)
- All facilities are in safe zones away from I-95 severe weather

**Output**:
```json
{
  "facilities": [
    {
      "stationId": "station-hartford-001",
      "name": "Hartford Emergency Depot",
      "location": {
        "latitude": 41.7658,
        "longitude": -72.6734,
        "address": "1500 Industrial Parkway, Hartford, CT 06120"
      },
      "distance": 45,
      "travelTime": 45,
      "onPlannedRoute": false,
      "baysAvailable": 3,
      "capabilities": {
        "refrigeration": true,
        "emergencyCooling": true,
        "pharmaceuticalStorage": true
      },
      "serviceDetails": {
        "capabilityType": "emergencyCooling",
        "available": true,
        "details": {
          "coolingCapacity": "-30°C in 30 minutes"
        },
        "serviceFee": 800
      },
      "score": 95
    },
    {
      "stationId": "station-waterbury-001",
      "name": "Waterbury Cold Chain Facility",
      "location": {
        "latitude": 41.5582,
        "longitude": -73.0515,
        "address": "200 Freight Street, Waterbury, CT 06702"
      },
      "distance": 35,
      "travelTime": 40,
      "onPlannedRoute": false,
      "baysAvailable": 2,
      "capabilities": {
        "refrigeration": true,
        "emergencyCooling": true,
        "pharmaceuticalStorage": true
      },
      "serviceDetails": {
        "capabilityType": "emergencyCooling",
        "available": true,
        "details": {
          "coolingCapacity": "-25°C in 35 minutes"
        },
        "serviceFee": 700
      },
      "score": 88
    },
    {
      "stationId": "station-danbury-001",
      "name": "Danbury Distribution Hub",
      "location": {
        "latitude": 41.3948,
        "longitude": -73.4540,
        "address": "500 Mill Plain Road, Danbury, CT 06811"
      },
      "distance": 55,
      "travelTime": 60,
      "onPlannedRoute": false,
      "baysAvailable": 4,
      "capabilities": {
        "refrigeration": true,
        "emergencyCooling": true,
        "pharmaceuticalStorage": false
      },
      "serviceDetails": {
        "capabilityType": "emergencyCooling",
        "available": true,
        "details": {
          "coolingCapacity": "-20°C in 40 minutes"
        },
        "serviceFee": 650
      },
      "score": 82
    }
  ],
  "totalFacilitiesFound": 3,
  "searchStrategyUsed": "alternative_locations"
}
```

**Key Point**: ALL facilities have `onPlannedRoute: false` and `weatherRisk: LOW` - they're all in safe zones OFF the I-95 route (Hartford via I-91, Waterbury via Route 8, Danbury via I-84).

#### Step 3: Route Agent
**Input**:
```json
{
  "truckId": "TRUCK-001",
  "currentLocation": {
    "latitude": 41.5234,
    "longitude": -72.8456
  },
  "originalDestination": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "name": "New York Distribution Center"
  },
  "facilities": [
    { "stationId": "station-hartford-001", "name": "Hartford Emergency Depot", "latitude": 41.7658, "longitude": -72.6734, "onPlannedRoute": false },
    { "stationId": "station-waterbury-001", "name": "Waterbury Cold Chain Facility", "latitude": 41.5582, "longitude": -73.0515, "onPlannedRoute": false },
    { "stationId": "station-danbury-001", "name": "Danbury Distribution Hub", "latitude": 41.3948, "longitude": -73.4540, "onPlannedRoute": false }
  ],
  "cargoType": "temperature_sensitive"
}
```

**Route Agent Logic**:
- ALL facilities have `onPlannedRoute: false` → Generate ALTERNATE routes avoiding I-95 weather
- Hartford: via I-91 North
- Waterbury: via Route 8 North
- Danbury: via I-84 West
- All waypoints show DIFFERENT coordinates than planned I-95 route

**Output**:
```json
{
  "routes": [
    {
      "routeId": "route-hartford",
      "name": "I-91 North to Hartford Emergency Depot",
      "destination": {
        "latitude": 41.7658,
        "longitude": -72.6734,
        "facilityName": "Hartford Emergency Depot",
        "address": "1500 Industrial Parkway, Hartford, CT 06120"
      },
      "distance": 45,
      "estimatedDuration": 45,
      "totalDuration": 45,
      "arrivalTime": "2026-04-29T10:45:00.000Z",
      "fuelCost": 15,
      "isAlternateRoute": true,
      "waypoints": [
        {
          "latitude": 41.5234,
          "longitude": -72.8456,
          "city": "Meriden, CT",
          "highway": "Current Location"
        },
        {
          "latitude": 41.6500,
          "longitude": -72.7000,
          "city": "Hartford Area",
          "highway": "I-91 North",
          "note": "Alternate route - avoiding I-95 weather"
        },
        {
          "latitude": 41.7658,
          "longitude": -72.6734,
          "city": "Hartford, CT",
          "type": "facility_location",
          "note": "OFF planned I-95 route - safe zone via I-91"
        }
      ]
    },
    {
      "routeId": "route-waterbury",
      "name": "Route 8 North to Waterbury Cold Chain Facility",
      "destination": {
        "latitude": 41.5582,
        "longitude": -73.0515,
        "facilityName": "Waterbury Cold Chain Facility",
        "address": "200 Freight Street, Waterbury, CT 06702"
      },
      "distance": 35,
      "estimatedDuration": 40,
      "totalDuration": 40,
      "arrivalTime": "2026-04-29T10:40:00.000Z",
      "fuelCost": 12,
      "isAlternateRoute": true,
      "waypoints": [
        {
          "latitude": 41.5234,
          "longitude": -72.8456,
          "city": "Meriden, CT",
          "highway": "Current Location"
        },
        {
          "latitude": 41.5400,
          "longitude": -72.9500,
          "city": "Waterbury Area",
          "highway": "Route 8 North",
          "note": "Alternate route - avoiding I-95 weather"
        },
        {
          "latitude": 41.5582,
          "longitude": -73.0515,
          "city": "Waterbury, CT",
          "type": "facility_location",
          "note": "OFF planned I-95 route - safe zone via Route 8"
        }
      ]
    },
    {
      "routeId": "route-danbury",
      "name": "I-84 West to Danbury Distribution Hub",
      "destination": {
        "latitude": 41.3948,
        "longitude": -73.4540,
        "facilityName": "Danbury Distribution Hub",
        "address": "500 Mill Plain Road, Danbury, CT 06811"
      },
      "distance": 55,
      "estimatedDuration": 60,
      "totalDuration": 60,
      "arrivalTime": "2026-04-29T11:00:00.000Z",
      "fuelCost": 18,
      "isAlternateRoute": true,
      "waypoints": [
        {
          "latitude": 41.5234,
          "longitude": -72.8456,
          "city": "Meriden, CT",
          "highway": "Current Location"
        },
        {
          "latitude": 41.4500,
          "longitude": -73.2000,
          "city": "Danbury Area",
          "highway": "I-84 West",
          "note": "Alternate route - avoiding I-95 weather"
        },
        {
          "latitude": 41.3948,
          "longitude": -73.4540,
          "city": "Danbury, CT",
          "type": "facility_location",
          "note": "OFF planned I-95 route - safe zone via I-84"
        }
      ]
    }
  ],
  "totalRoutesEvaluated": 3
}
```

**Key Points**:
- **ALL routes have `isAlternateRoute: true`** - none follow the planned I-95 route
- **Hartford route**: Via I-91 North (45 min, LOW weather risk)
- **Waterbury route**: Via Route 8 North (40 min, LOW weather risk)
- **Danbury route**: Via I-84 West (60 min, LOW weather risk)
- All waypoints show coordinates DIFFERENT from planned I-95 waypoints
- All facilities are in safe zones away from I-95 severe weather

---

#### Step 4: Decision Agent

**Input**:
```json
{
  "incidentType": "cooling_failure",
  "truckId": "TRUCK-001",
  "cargoValue": 200000,
  "timeToSpoilage": 120,
  "weatherData": {
    "severeWeatherDetected": true,
    "overallWeatherRisk": 75,
    "totalDelayMinutes": 60,
    "segments": [
      {
        "location": "New Haven, CT",
        "condition": "thunderstorm",
        "severity": "SEVERE",
        "estimatedDelay": 30
      },
      {
        "location": "Bridgeport, CT",
        "condition": "rain",
        "severity": "MODERATE",
        "estimatedDelay": 20
      }
    ]
  },
  "facilities": [
    {
      "stationId": "station-hartford-001",
      "name": "Hartford Emergency Depot",
      "onPlannedRoute": false,
      "weatherRisk": "LOW",
      "serviceAvailable": true,
      "serviceFee": 800,
      "serviceType": "emergencyCooling",
      "baysAvailable": 3
    },
    {
      "stationId": "station-waterbury-001",
      "name": "Waterbury Cold Chain Facility",
      "onPlannedRoute": false,
      "weatherRisk": "LOW",
      "serviceAvailable": true,
      "serviceFee": 700,
      "serviceType": "emergencyCooling",
      "baysAvailable": 2
    },
    {
      "stationId": "station-danbury-001",
      "name": "Danbury Distribution Hub",
      "onPlannedRoute": false,
      "weatherRisk": "LOW",
      "serviceAvailable": true,
      "serviceFee": 650,
      "serviceType": "emergencyCooling",
      "baysAvailable": 4
    }
  ],
  "routes": [
    {
      "routeId": "route-hartford",
      "name": "I-91 North to Hartford Emergency Depot",
      "totalDuration": 45,
      "arrivalTime": "2026-04-29T10:45:00.000Z",
      "fuelCost": 15,
      "isAlternateRoute": true,
      "weatherRisk": "LOW"
    },
    {
      "routeId": "route-waterbury",
      "name": "Route 8 North to Waterbury Cold Chain Facility",
      "totalDuration": 40,
      "arrivalTime": "2026-04-29T10:40:00.000Z",
      "fuelCost": 12,
      "isAlternateRoute": true,
      "weatherRisk": "LOW"
    },
    {
      "routeId": "route-danbury",
      "name": "I-84 West to Danbury Distribution Hub",
      "totalDuration": 60,
      "arrivalTime": "2026-04-29T11:00:00.000Z",
      "fuelCost": 18,
      "isAlternateRoute": true,
      "weatherRisk": "LOW"
    }
  ]
}
```

**Output**:
```json
{
  "decision": "EMERGENCY_REROUTE",
  "urgency": "CRITICAL",
  "riskScore": 78.0,
  "riskFactors": [
    {
      "factor": "Temperature",
      "value": "-8°C",
      "severity": "CRITICAL"
    },
    {
      "factor": "Time Criticality",
      "value": "120 minutes to spoilage",
      "severity": "CRITICAL"
    },
    {
      "factor": "Weather",
      "value": "Severe weather on I-95 (thunderstorms)",
      "severity": "HIGH"
    }
  ],
  "selectedRoute": {
    "routeId": "route-waterbury",
    "name": "Route 8 North to Waterbury Cold Chain Facility",
    "destination": "Waterbury Cold Chain Facility",
    "arrivalTime": "2026-04-29T10:40:00.000Z",
    "duration": 40,
    "fuelCost": 12,
    "isAlternateRoute": true
  },
  "selectedFacility": {
    "stationId": "station-waterbury-001",
    "name": "Waterbury Cold Chain Facility",
    "onPlannedRoute": false,
    "serviceAvailable": true,
    "serviceFee": 700,
    "serviceType": "emergencyCooling",
    "coolingDuration": 35
  },
  "rejectedOptions": [
    {
      "type": "route",
      "routeId": "route-hartford",
      "name": "Hartford Emergency Depot",
      "reason": "Waterbury is 5 minutes faster (40 min vs 45 min) with lower cost"
    },
    {
      "type": "route",
      "routeId": "route-danbury",
      "name": "Danbury Distribution Hub",
      "reason": "Arrival time (60 min) cuts too close to spoilage deadline"
    }
  ],
  "recommendation": {
    "action": "Immediate reroute to Waterbury Cold Chain Facility via Route 8 North",
    "reasoning": [
      "Fastest route to emergency cooling (40 minutes)",
      "Avoids I-95 severe weather (thunderstorms in New Haven/Bridgeport)",
      "Arrives with 80-minute safety buffer before spoilage",
      "Emergency cooling restores temperature in 35 minutes",
      "All alternative facilities are in safe zones (LOW weather risk)",
      "2 bays available for immediate docking"
    ],
    "estimatedArrival": "2026-04-29T10:40:00.000Z",
    "serviceRestored": "2026-04-29T11:15:00.000Z",
    "serviceType": "emergencyCooling",
    "safetyBuffer": 80
  },
  "financialAnalysis": {
    "rerouteCost": 712,
    "breakdown": {
      "additionalFuel": 12,
      "serviceFee": 700
    },
    "cargoValueAtRisk": 200000,
    "netSavings": 199288,
    "roi": 27989,
    "costAsPercentOfCargo": 0.356
  },
  "postRecoveryPlan": {
    "serviceRestored": "2026-04-29T11:15:00.000Z",
    "serviceType": "emergencyCooling",
    "transferToOriginalDestination": "2026-04-29T14:30:00.000Z",
    "finalArrivalNewYork": "2026-04-29T17:00:00.000Z",
    "totalDelayFromOriginal": 240,
    "cargoCondition": "PRESERVED"
  }
}
```

