"""Alert API endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
import uuid
from datetime import datetime
from ..models.alert import Alert, CreateAlertRequest
from ..services.simulation_engine import simulation_engine

router = APIRouter()


@router.get("/alerts", response_model=List[Alert])
async def get_all_alerts(active_only: bool = False):
    """
    Get all alerts
    
    Args:
        active_only: If True, return only unacknowledged (active) alerts
    """
    all_alerts = simulation_engine.get_all_alerts()
    if active_only:
        return [alert for alert in all_alerts if not alert.acknowledged]
    return all_alerts


@router.get("/alerts/{truck_id}", response_model=List[Alert])
async def get_truck_alerts(truck_id: str):
    """Get alerts for specific truck"""
    alerts = simulation_engine.get_truck_alerts(truck_id)
    return alerts


@router.post("/alerts", response_model=Alert)
async def create_alert(request: CreateAlertRequest):
    """
    Create a new alert for a truck.
    This endpoint allows external systems or agents to create alerts.
    """
    # Generate alert ID
    alert_id = f"alert-{uuid.uuid4().hex[:8]}"
    
    # Create alert
    alert = Alert(
        alertId=alert_id,
        truckId=request.truckId,
        type=request.type,
        severity=request.severity,
        message=request.message,
        timestamp=datetime.utcnow(),
        acknowledged=False
    )
    
    # Store alert in simulation engine
    simulation_engine.alerts[alert_id] = alert
    
    return alert

# Made with Bob

@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    """
    Delete an alert by ID.
    This is used when an alert is resolved.
    """
    if alert_id in simulation_engine.alerts:
        del simulation_engine.alerts[alert_id]
        return {"status": "success", "message": f"Alert {alert_id} deleted"}
    else:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")


@router.delete("/alerts/history/cleanup")
async def cleanup_alert_history(before_date: str = None):
    """
    Delete old alert records from the history file.
    
    Args:
        before_date: ISO format date (e.g., "2026-05-10T00:00:00").
                     Deletes all alerts saved before this date.
                     If not provided, deletes all history.
    
    Returns:
        Number of alerts deleted
    """
    from pathlib import Path
    import json
    from datetime import datetime
    from ..services.persistence_service import get_persistence_service
    
    persistence = get_persistence_service()
    if not persistence.enabled or not persistence.adapter:
        raise HTTPException(status_code=503, detail="Persistence not enabled")
    
    try:
        alerts_file = Path(persistence.adapter.alerts_dir) / "alerts_history.json"
        
        if not alerts_file.exists():
            return {"status": "success", "deleted_count": 0, "message": "No history file found"}
        
        # Load existing alerts
        with open(alerts_file, 'r') as f:
            all_alerts = json.load(f)
        
        original_count = len(all_alerts)
        
        if before_date:
            # Parse the date
            cutoff_date = datetime.fromisoformat(before_date.replace('Z', '+00:00'))
            
            # Filter alerts - keep only those saved after cutoff date
            filtered_alerts = [
                alert for alert in all_alerts
                if alert.get('saved_at') and
                datetime.fromisoformat(alert['saved_at'].replace('Z', '+00:00')) >= cutoff_date
            ]
        else:
            # Delete all history
            filtered_alerts = []
        
        deleted_count = original_count - len(filtered_alerts)
        
        # Save filtered alerts
        with open(alerts_file, 'w') as f:
            json.dump(filtered_alerts, f, indent=2, default=str)
        
        return {
            "status": "success",
            "deleted_count": deleted_count,
            "remaining_count": len(filtered_alerts),
            "message": f"Deleted {deleted_count} alert records"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cleaning up alerts: {str(e)}")

