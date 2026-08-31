from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .cargo import Cargo
from .route import Location, RouteWaypoint
from .incident import DiversionState, RecoveryState
from .weather import Coordinates


class TruckTelemetry(BaseModel):
    """Truck telemetry data - matches Schema_Logistics_final.md"""
    temperature: float = Field(..., description="Current temperature in Celsius")
    coolantStatus: str = Field(..., description="Coolant status (OK|FAILURE|WARNING)")
    currentLocation: Coordinates
    speed: Optional[float] = Field(None, description="Current speed in km/h")
    fuelLevel: Optional[float] = Field(None, description="Fuel level percentage")


class CurrentTrip(BaseModel):
    """Current trip information - matches changed_schema.md (no alternative routes in truck state)"""
    tripId: str
    origin: Location
    destination: Location
    plannedRoute: List[RouteWaypoint]
    estimatedArrival: datetime
    currentWaypointIndex: int = Field(0, description="Current position in route")
    distanceTraveled: float = Field(0, description="Distance traveled in km")
    distanceRemaining: float = Field(0, description="Distance remaining in km")


class TruckState(BaseModel):
    """Complete truck runtime state - matches fleetops_simulation_spec_v2.md"""
    truckId: str
    incidentId: Optional[str] = None
    incidentType: Optional[str] = None
    timestamp: datetime
    telemetry: TruckTelemetry
    cargo: Cargo
    currentTrip: CurrentTrip
    originalRoute: Optional[CurrentTrip] = Field(None, description="Original route before diversion, used for resuming after alert resolution")
    diversionState: Optional[DiversionState] = None
    recoveryState: Optional[RecoveryState] = None
    alertState: Optional[dict] = None
    status: str = Field("ACTIVE", description="ACTIVE|DIVERTED|RECOVERING|COMPLETED")

    class Config:
        json_schema_extra = {
            "example": {
                "truckId": "TRUCK-001",
                "incidentId": None,
                "incidentType": None,
                "timestamp": "2026-04-29T10:00:00.000Z",
                "telemetry": {
                    "temperature": -8.0,
                    "coolantStatus": "OK",
                    "currentLocation": {
                        "latitude": 41.5234,
                        "longitude": -72.8456
                    },
                    "speed": 95.0,
                    "fuelLevel": 75.0
                },
                "cargo": {
                    "type": "temperature_sensitive_vaccines",
                    "value": 200000,
                    "criticalThreshold": -10,
                    "timeToSpoilage": 120
                },
                "currentTrip": {
                    "tripId": "trip-001",
                    "origin": {
                        "name": "Boston Distribution Center",
                        "latitude": 42.3601,
                        "longitude": -71.0589
                    },
                    "destination": {
                        "name": "New York Distribution Center",
                        "latitude": 40.7128,
                        "longitude": -74.0060
                    },
                    "plannedRoute": [],
                    "estimatedArrival": "2026-04-29T13:00:00.000Z",
                    "currentWaypointIndex": 0,
                    "distanceTraveled": 0,
                    "distanceRemaining": 350
                },
                "status": "ACTIVE"
            }
        }


class Truck(BaseModel):
    """Basic truck information from source API"""
    truckId: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    licensePlate: Optional[str] = None
    capacity: Optional[float] = None


class TruckUpdateRequest(BaseModel):
    """Request to update truck state - supports updating route via currentTrip"""
    telemetry: Optional[TruckTelemetry] = None
    cargo: Optional[Cargo] = None
    currentTrip: Optional[CurrentTrip] = None
    status: Optional[str] = None
    diversionState: Optional[DiversionState] = None
    recoveryState: Optional[RecoveryState] = None


class CargoTemperatureUpdate(BaseModel):
    """Request to update cargo temperature"""
    temperature: float
    coolantStatus: Optional[str] = None

# Made with Bob
