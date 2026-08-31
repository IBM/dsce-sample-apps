"""Admin API endpoints for persistence management."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

router = APIRouter()

# This will be injected by main.py
persistence_service = None


def set_persistence_service(service):
    """Set the persistence service instance."""
    global persistence_service
    persistence_service = service


class ResetRequest(BaseModel):
    """Request model for resetting persistence."""
    confirm: bool
    entities: str = "all"  # "all" or comma-separated list: "trucks,stations,weather,alerts,incidents"


@router.get("/persistence-status")
async def get_persistence_status() -> Dict[str, Any]:
    """Get persistence system status.
    
    Returns:
        Dictionary with persistence status information
    """
    if not persistence_service:
        return {
            "enabled": False,
            "message": "Persistence service not initialized"
        }
    
    if not persistence_service.enabled:
        return {
            "enabled": False,
            "message": "Persistence disabled in configuration"
        }
    
    try:
        status = await persistence_service.adapter.get_status()
        return {
            "enabled": True,
            **status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting status: {str(e)}")


@router.post("/reset-persistence")
async def reset_persistence(request: ResetRequest) -> Dict[str, Any]:
    """Manual reset of persisted data.
    
    Args:
        request: Reset request with confirmation
        
    Returns:
        Dictionary with reset status
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required to reset data")
    
    try:
        if request.entities == "all":
            # Reset all data
            success = await persistence_service.adapter.reset_all()
            if success:
                return {
                    "status": "success",
                    "message": "All persistence data reset successfully",
                    "entities_reset": ["trucks", "stations", "weather", "alerts", "incidents"]
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to reset data")
        else:
            # Reset specific entities
            entities = [e.strip() for e in request.entities.split(",")]
            reset_results = {}
            
            for entity in entities:
                if entity == "trucks":
                    await persistence_service.adapter.save_trucks([])
                    reset_results["trucks"] = "reset"
                elif entity == "stations":
                    await persistence_service.adapter.save_stations([])
                    reset_results["stations"] = "reset"
                elif entity == "weather":
                    await persistence_service.adapter.save_weather([])
                    reset_results["weather"] = "reset"
                elif entity == "alerts":
                    await persistence_service.adapter.save_alerts([])
                    reset_results["alerts"] = "reset"
                elif entity == "incidents":
                    await persistence_service.adapter.save_incidents([])
                    reset_results["incidents"] = "reset"
                else:
                    reset_results[entity] = "unknown entity"
            
            return {
                "status": "success",
                "message": f"Reset completed for: {', '.join(entities)}",
                "results": reset_results
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting data: {str(e)}")


@router.post("/save-state")
async def manual_save_state() -> Dict[str, Any]:
    """Manually trigger a state save.
    
    Returns:
        Dictionary with save status
    """
    if not persistence_service or not persistence_service.enabled:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        # This will be implemented when we integrate with simulation engine
        return {
            "status": "success",
            "message": "Manual save triggered (requires simulation engine integration)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving state: {str(e)}")

# Made with Bob
