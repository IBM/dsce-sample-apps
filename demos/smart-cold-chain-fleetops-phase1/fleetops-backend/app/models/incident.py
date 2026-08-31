from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class IncidentType(str, Enum):
    """Incident types"""
    WEATHER_FAILURE = "WEATHER_FAILURE"
    CARGO_THRESHOLD_BREACH = "CARGO_THRESHOLD_BREACH"


class IncidentSeverity(str, Enum):
    """Incident severity levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Incident(BaseModel):
    """Incident model - matches fleetops_simulation_spec_v2.md"""
    incidentId: str
    incidentType: IncidentType
    severity: IncidentSeverity
    createdAt: datetime
    resolved: bool = False
    resolvedAt: Optional[datetime] = None
    truckId: str
    description: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "incidentId": "incident-001",
                "incidentType": "CARGO_THRESHOLD_BREACH",
                "severity": "HIGH",
                "createdAt": "2026-04-29T10:00:00.000Z",
                "resolved": False,
                "truckId": "TRUCK-001",
                "description": "Cargo temperature exceeded critical threshold"
            }
        }


class DiversionState(BaseModel):
    """Diversion state when truck is diverted"""
    diverted: bool = True
    reason: Optional[str] = None
    targetStationId: Optional[str] = None
    stationId: Optional[str] = None  # Alias for targetStationId
    alternativeRoute: Optional[str] = None
    distanceKm: Optional[float] = None
    etaMinutes: Optional[int] = None
    estimatedDelay: Optional[int] = None


class RecoveryState(BaseModel):
    """Recovery state after station arrival"""
    coolingRestoredAt: Optional[datetime] = None
    cargoCondition: str = Field(..., description="GOOD|AT_RISK|SPOILED")
    stationArrivalTime: Optional[datetime] = None

# Made with Bob
