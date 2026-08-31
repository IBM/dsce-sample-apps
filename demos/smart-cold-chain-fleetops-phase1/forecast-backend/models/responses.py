"""
Pydantic response models for API validation
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    service: str = Field(..., description="Service name")
    timestamp: str = Field(..., description="Current timestamp")
    ttm_model_enabled: bool = Field(..., description="Whether TTM model is enabled")


class HistoricalData(BaseModel):
    """Historical time series data"""
    timestamps: List[str] = Field(..., description="Historical timestamps")
    temperatures: List[float] = Field(..., description="Historical temperatures")


class ForecastData(BaseModel):
    """Forecast time series data"""
    timestamps: List[str] = Field(..., description="Forecast timestamps")
    temperatures: List[float] = Field(..., description="Forecast temperatures")


class RiskAssessment(BaseModel):
    """Risk assessment details"""
    risk_score: int = Field(..., ge=0, le=100, description="Risk score (0-100)")
    time_to_breach: Optional[int] = Field(None, description="Minutes until breach")
    action: str = Field(..., description="Recommended action level")
    message: str = Field(..., description="Risk message")
    predicted_breach_temp: Optional[float] = Field(None, description="Predicted breach temperature")
    temp_delta: Optional[float] = Field(None, description="Temperature delta from threshold")
    recommendations: List[str] = Field(..., description="List of recommendations")


class TemperatureForecastResponse(BaseModel):
    """Temperature forecast response"""
    truck_id: str = Field(..., description="Truck identifier")
    cargo_type: str = Field(..., description="Type of cargo")
    cargo_value: float = Field(..., description="Cargo value in USD")
    current_temperature: float = Field(..., description="Current temperature in Celsius")
    critical_threshold: float = Field(..., description="Critical temperature threshold")
    frequency: str = Field(..., description="Time series frequency used for forecast")
    historical: HistoricalData = Field(..., description="Historical temperature data")
    forecast: ForecastData = Field(..., description="Forecast temperature data")
    risk_assessment: RiskAssessment = Field(..., description="Risk assessment")


class StationForecast(BaseModel):
    """Individual station forecast"""
    timestamps: List[str] = Field(..., description="Forecast timestamps")
    available_bays: List[int] = Field(..., description="Predicted available bays")
    utilization_percent: List[float] = Field(..., description="Utilization percentage")


class StationDetails(BaseModel):
    """Station details with forecast"""
    station_id: str = Field(..., description="Station identifier")
    station_name: str = Field(..., description="Station name")
    region: str = Field(..., description="Geographic region")
    current_available: int = Field(..., description="Currently available bays")
    total_bays: int = Field(..., description="Total number of bays")
    forecast: StationForecast = Field(..., description="Availability forecast")
    recommendations: List[str] = Field(..., description="Recommendations")


class StationForecastResponse(BaseModel):
    """Station availability forecast response"""
    timestamp: str = Field(..., description="Forecast generation timestamp")
    forecast_horizon: str = Field(..., description="Forecast time horizon")
    frequency: str = Field(..., description="Time series frequency used for forecast")
    stations: List[StationDetails] = Field(..., description="List of station forecasts")


class WeatherCondition(BaseModel):
    """Weather condition at a location"""
    city: str = Field(..., description="City name")
    condition: str = Field(..., description="Weather condition")
    severity: str = Field(..., description="Severity level")
    temperature: float = Field(..., description="Temperature in Celsius")
    estimated_delay: int = Field(..., description="Estimated delay in minutes")


class WeatherForecastResponse(BaseModel):
    """Weather impact forecast response"""
    truck_id: str = Field(..., description="Truck identifier")
    current_location: Dict[str, Any] = Field(..., description="Current location")
    destination: Dict[str, Any] = Field(..., description="Destination")
    weather_forecast: Dict[str, Any] = Field(..., description="Weather forecast data")
    impact_assessment: Dict[str, Any] = Field(..., description="Impact assessment")


class FleetSummary(BaseModel):
    """Fleet-wide summary metrics"""
    total_trucks: int = Field(..., description="Total number of trucks")
    high_risk_trucks: int = Field(..., description="Number of high risk trucks (score > 70)")
    medium_risk_trucks: int = Field(..., description="Number of medium risk trucks (40 < score <= 70)")
    low_risk_trucks: int = Field(..., description="Number of low risk trucks (score <= 40)")
    total_cargo_value: float = Field(..., description="Total cargo value")
    at_risk_cargo_value: float = Field(..., description="At-risk cargo value")
    high_priority_trucks: int = Field(..., description="Number of high priority trucks")
    average_risk_score: int = Field(..., description="Average risk score")


class TruckInsight(BaseModel):
    """Individual truck insight"""
    truck_id: str = Field(..., description="Truck identifier")
    cargo_value: float = Field(..., description="Cargo value")
    composite_risk_score: int = Field(..., description="Composite risk score")
    temperature_risk: int = Field(..., description="Temperature risk score")
    weather_risk: int = Field(..., description="Weather risk score")
    recommended_action: str = Field(..., description="Recommended action")
    priority: str = Field(..., description="Priority level")
    estimated_delay: int = Field(..., description="Estimated delay in minutes")
    time_to_breach: Optional[int] = Field(None, description="Time to breach in minutes")


class FleetOptimizationResponse(BaseModel):
    """Fleet optimization response"""
    fleet_summary: FleetSummary = Field(..., description="Fleet summary metrics")
    truck_insights: List[TruckInsight] = Field(..., description="Individual truck insights")

# Made with Bob
