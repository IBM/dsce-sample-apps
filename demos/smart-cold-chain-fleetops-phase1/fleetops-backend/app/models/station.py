from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class StationCapabilities(BaseModel):
    """Station capabilities"""
    refrigeration: bool = Field(False, description="Has refrigeration capability")
    emergencyCooling: bool = Field(False, description="Has emergency cooling capability")
    pharmaceuticalStorage: bool = Field(False, description="Has pharmaceutical storage capability")


class ServiceDetails(BaseModel):
    """Generic service details - can represent any capability type"""
    capabilityType: str = Field(..., description="Type of service (e.g., 'emergencyCooling', 'tire_repair', 'mechanical_repair')")
    available: bool = Field(..., description="Whether the service is currently available")
    details: Optional[Dict[str, Any]] = Field(None, description="Capability-specific fields (e.g., coolingCapacity, equipmentType)")
    serviceFee: Optional[float] = Field(None, description="Service fee if applicable")


class OperatingHours(BaseModel):
    """Station operating hours"""
    open24x7: bool
    currentlyOpen: bool
    closingTime: Optional[str] = None


class StationLocation(BaseModel):
    """Station location details"""
    latitude: float
    longitude: float
    address: str


class Station(BaseModel):
    """Station model - matches changed_schema.md"""
    stationId: str
    name: str
    location: StationLocation
    region: Optional[str] = None
    distance: Optional[float] = Field(None, description="Distance from truck in km")
    travelTime: Optional[int] = Field(None, description="Travel time in minutes")
    onPlannedRoute: bool = Field(False, description="Whether station is on planned route")
    baysAvailable: int = Field(..., description="Number of available bays")
    totalBays: int = Field(..., description="Total number of bays")
    capabilities: StationCapabilities
    serviceDetails: Optional[ServiceDetails] = Field(None, description="Generic service details for any capability type")
    operatingHours: OperatingHours
    score: int = Field(..., ge=0, le=100, description="Station score (0-100)")
    status: str = Field("AVAILABLE", description="Station status (AVAILABLE|UNAVAILABLE|OFFLINE)")

    class Config:
        json_schema_extra = {
            "example": {
                "stationId": "station-newhaven-001",
                "name": "New Haven Cold Storage",
                "location": {
                    "latitude": 41.3095,
                    "longitude": -72.9245,
                    "address": "500 Harbor Drive, New Haven, CT 06511"
                },
                "region": "Connecticut",
                "distance": 25,
                "travelTime": 30,
                "onPlannedRoute": True,
                "baysAvailable": 2,
                "totalBays": 5,
                "capabilities": {
                    "refrigeration": True,
                    "emergencyCooling": True,
                    "pharmaceuticalStorage": True
                },
                "serviceDetails": {
                    "capabilityType": "emergencyCooling",
                    "available": True,
                    "details": {
                        "coolingCapacity": "500 cubic feet",
                        "equipmentType": "Industrial Refrigeration Unit"
                    },
                    "serviceFee": 500.0
                },
                "operatingHours": {
                    "open24x7": True,
                    "currentlyOpen": True
                },
                "score": 85,
                "status": "AVAILABLE"
            }
        }


class StationResponse(BaseModel):
    """Station agent response - matches changed_schema.md"""
    facilities: List[Station]
    totalFacilitiesFound: int
    searchStrategyUsed: str = Field(..., description="along_planned_route | alternative_locations")


class StationUpdateRequest(BaseModel):
    """Request to update station"""
    baysAvailable: Optional[int] = None
    status: Optional[str] = None

# Made with Bob
