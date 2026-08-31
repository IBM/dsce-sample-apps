from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class WeatherCondition(str, Enum):
    """Weather condition types"""
    CLEAR = "CLEAR"
    RAIN = "RAIN"
    HEAVY_RAIN = "HEAVY_RAIN"
    THUNDERSTORM = "THUNDERSTORM"
    SNOW = "SNOW"
    FOG = "FOG"
    HEATWAVE = "HEATWAVE"
    PARTLY_CLOUDY = "partly_cloudy"


class WeatherSeverity(str, Enum):
    """Weather severity levels"""
    CLEAR = "CLEAR"
    LOW = "LOW"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"


class Coordinates(BaseModel):
    """Geographic coordinates"""
    latitude: float
    longitude: float


class WeatherSegment(BaseModel):
    """Weather segment for a route waypoint - matches Schema_Logistics_final.md"""
    location: str = Field(..., description="Location name (e.g., 'Meriden, CT')")
    coordinates: Coordinates
    condition: str = Field(..., description="Weather condition")
    severity: str = Field(..., description="Severity level (CLEAR|LOW|MODERATE|SEVERE)")
    temperature: float = Field(..., description="Temperature in Fahrenheit")
    windSpeed: float = Field(..., description="Wind speed in mph")
    visibility: float = Field(..., description="Visibility in miles")
    estimatedDelay: int = Field(..., description="Estimated delay in minutes")

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Meriden, CT",
                "coordinates": {"latitude": 41.5234, "longitude": -72.8456},
                "condition": "clear",
                "severity": "LOW",
                "temperature": 22,
                "windSpeed": 10,
                "visibility": 10,
                "estimatedDelay": 0
            }
        }


class WeatherAnalysis(BaseModel):
    """Weather analysis response - matches Schema_Logistics_final.md"""
    severeWeatherDetected: bool = Field(..., description="Whether severe weather is detected")
    overallWeatherRisk: int = Field(..., ge=0, le=100, description="Overall weather risk score (0-100)")
    totalDelayMinutes: int = Field(..., description="Total delay in minutes")
    segments: List[WeatherSegment] = Field(..., description="Weather segments along route")

    class Config:
        json_schema_extra = {
            "example": {
                "severeWeatherDetected": False,
                "overallWeatherRisk": 15,
                "totalDelayMinutes": 0,
                "segments": []
            }
        }


class WeatherUpdateRequest(BaseModel):
    """Request to update weather conditions"""
    region: str = Field(..., description="Region identifier")
    condition: WeatherCondition
    severity: WeatherSeverity
    temperature: Optional[float] = None
    windSpeed: Optional[float] = None
    visibility: Optional[float] = None

# Made with Bob
