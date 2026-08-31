"""Weather API endpoints"""
from fastapi import APIRouter, HTTPException
from typing import Dict, List
from ..models.weather import WeatherAnalysis, WeatherUpdateRequest, WeatherSegment
from ..services.weather_service import weather_service

router = APIRouter()


@router.get("/weather", response_model=Dict[str, List[WeatherSegment]])
async def get_all_weather():
    """Get all weather data"""
    return weather_service.get_all_weather()


@router.get("/weather/analyze/{truck_id}", response_model=WeatherAnalysis)
async def analyze_weather(truck_id: str):
    """Analyze weather for truck route"""
    analysis = weather_service.get_weather_analysis(truck_id)
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Weather data for truck {truck_id} not found")
    return analysis


@router.post("/weather/update")
async def update_weather(region: str, update: WeatherUpdateRequest):
    """Update weather conditions for a region"""
    success = weather_service.update_weather(region, update)
    if not success:
        raise HTTPException(status_code=404, detail=f"Region {region} not found")
    return {"status": "updated", "region": region}


@router.delete("/weather/{region}")
async def delete_weather_region(region: str):
    """Delete weather data for a region"""
    success = weather_service.delete_weather_region(region)
    if not success:
        raise HTTPException(status_code=404, detail=f"Region {region} not found")
    return {"status": "deleted", "region": region}

# Made with Bob
