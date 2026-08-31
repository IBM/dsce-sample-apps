"""API endpoints for persistence data retrieval."""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

router = APIRouter()

# This will be injected by main.py
persistence_service = None


def set_persistence_service(service):
    """Set the persistence service instance."""
    global persistence_service
    persistence_service = service


@router.get("/data")
async def get_all_persisted_data() -> Dict[str, Any]:
    """Get all persisted data.
    
    Returns:
        Dictionary containing all persisted entities
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        data = await persistence_service.load_state()
        return {
            "status": "success",
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}")


@router.get("/data/trucks")
async def get_persisted_trucks() -> Dict[str, Any]:
    """Get persisted truck data.
    
    Returns:
        Dictionary containing truck data
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        trucks = await persistence_service.adapter.load_trucks()
        return {
            "status": "success",
            "count": len(trucks),
            "trucks": trucks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading trucks: {str(e)}")


@router.get("/data/stations")
async def get_persisted_stations() -> Dict[str, Any]:
    """Get persisted station data.
    
    Returns:
        Dictionary containing station data
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        stations = await persistence_service.adapter.load_stations()
        return {
            "status": "success",
            "count": len(stations),
            "stations": stations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading stations: {str(e)}")


@router.get("/data/weather")
async def get_persisted_weather() -> Dict[str, Any]:
    """Get persisted weather data.
    
    Returns:
        Dictionary containing weather data
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        weather = await persistence_service.adapter.load_weather()
        return {
            "status": "success",
            "count": len(weather),
            "weather": weather
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading weather: {str(e)}")


@router.get("/data/alerts")
async def get_persisted_alerts() -> Dict[str, Any]:
    """Get persisted alert data.
    
    Returns:
        Dictionary containing alert data
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        alerts = await persistence_service.adapter.load_alerts()
        return {
            "status": "success",
            "count": len(alerts),
            "alerts": alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading alerts: {str(e)}")


@router.get("/data/incidents")
async def get_persisted_incidents() -> Dict[str, Any]:
    """Get persisted incident data.
    
    Returns:
        Dictionary containing incident data
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        incidents = await persistence_service.adapter.load_incidents()
        return {
            "status": "success",
            "count": len(incidents),
            "incidents": incidents
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading incidents: {str(e)}")

# Made with Bob
