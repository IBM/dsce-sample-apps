from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class AlertType(str, Enum):
    """Alert types"""
    WEATHER_ALERT = "WEATHER_ALERT"
    ALT_ROUTE_AVAILABLE = "ALT_ROUTE_AVAILABLE"
    CARGO_THRESHOLD_BREACH = "CARGO_THRESHOLD_BREACH"
    STATION_DIVERSION_REQUIRED = "STATION_DIVERSION_REQUIRED"


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class Alert(BaseModel):
    """Alert model - matches fleetops_simulation_spec_v2.md"""
    alertId: str
    truckId: str
    type: AlertType
    severity: AlertSeverity
    message: str
    timestamp: datetime
    acknowledged: bool = False
    acknowledgedAt: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "alertId": "alert-001",
                "truckId": "TRUCK-001",
                "type": "CARGO_THRESHOLD_BREACH",
                "severity": "CRITICAL",
                "message": "Cargo temperature has exceeded critical threshold. Immediate diversion required.",
                "timestamp": "2026-04-29T10:00:00.000Z",
                "acknowledged": False
            }
        }


class CreateAlertRequest(BaseModel):
    """Request model for creating a new alert"""
    truckId: str = Field(..., description="Truck ID")
    type: AlertType = Field(..., description="Alert type")
    severity: AlertSeverity = Field(..., description="Alert severity")
    message: str = Field(..., description="Alert message")

# Made with Bob
