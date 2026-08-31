from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class Location(BaseModel):
    """Location with coordinates and name"""
    name: str
    latitude: float
    longitude: float


class RouteWaypoint(BaseModel):
    """Route waypoint - matches Schema_Logistics_final.md"""
    latitude: float
    longitude: float
    city: Optional[str] = None
    highway: Optional[str] = None
    type: Optional[str] = Field(None, description="waypoint|destination|facility_location")
    note: Optional[str] = None


class RouteMetrics(BaseModel):
    """Route metrics and timing information"""
    distance: float = Field(..., description="Distance in kilometers")
    estimatedDuration: int = Field(..., description="Estimated duration in minutes")
    weatherDelay: int = Field(..., description="Weather delay in minutes")
    totalDuration: int = Field(..., description="Total duration in minutes")
    arrivalTime: datetime = Field(..., description="Estimated arrival time")
    fuelCost: float = Field(..., description="Fuel cost in USD")
    isAlternateRoute: bool = Field(False, description="Whether this is an alternate route")


class Route(BaseModel):
    """Complete route information"""
    routeId: str
    name: str
    origin: Location
    destination: Location
    waypoints: List[RouteWaypoint]
    metrics: RouteMetrics
    
    class Config:
        json_schema_extra = {
            "example": {
                "routeId": "route-001",
                "name": "Boston to New York via I-95",
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
                "waypoints": [],
                "metrics": {
                    "distance": 350.5,
                    "estimatedDuration": 240,
                    "weatherDelay": 0,
                    "totalDuration": 240,
                    "arrivalTime": "2026-04-29T13:00:00.000Z",
                    "fuelCost": 125.50,
                    "isAlternateRoute": False
                }
            }
        }


class RouteResponse(BaseModel):
    """Route agent response - matches Schema_Logistics_final.md"""
    routes: List[dict] = Field(..., description="List of route options")
    totalRoutesEvaluated: int


class WaypointUpdateRequest(BaseModel):
    """Request to update route waypoints"""
    truckId: str
    waypoints: List[RouteWaypoint]

# Made with Bob
