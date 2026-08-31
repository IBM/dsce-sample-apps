"""Truck API endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
from ..models.truck import TruckState, TruckUpdateRequest, CargoTemperatureUpdate
from ..models.route import RouteWaypoint
from ..services.truck_service import truck_service

router = APIRouter()


@router.get("/trucks", response_model=List[TruckState])
async def get_all_trucks():
    """Get all trucks"""
    return truck_service.get_all_trucks()


@router.get("/trucks/{truck_id}", response_model=TruckState)
async def get_truck(truck_id: str):
    """Get specific truck"""
    truck = truck_service.get_truck(truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
    return truck


@router.get("/trucks/{truck_id}/telemetry")
async def get_truck_telemetry(truck_id: str):
    """Get truck telemetry"""
    truck = truck_service.get_truck(truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
    return truck.telemetry


@router.post("/trucks/update")
async def update_truck(truck_id: str, update: TruckUpdateRequest):
    """
    Update truck state including route changes via currentTrip.
    
    Supports updating:
    - telemetry: Truck sensor data
    - cargo: Cargo status and temperature
    - currentTrip: Route information (plannedRoute, destination, etc.)
    - status: Truck operational status
    - diversionState: Diversion information
    - recoveryState: Recovery information
    
    Changes persist in memory until application restart.
    
    Example - Update route:
    {
        "currentTrip": {
            "tripId": "trip-001",
            "origin": {...},
            "destination": {...},
            "plannedRoute": [
                {"latitude": 40.7128, "longitude": -74.0060, "city": "New York", "highway": "I-95", "type": "city_waypoint"},
                ...
            ],
            "estimatedArrival": "2026-04-29T13:00:00.000Z",
            "currentWaypointIndex": 0,
            "distanceTraveled": 0,
            "distanceRemaining": 350
        },
        "status": "DIVERTED"
    }
    """
    truck = truck_service.update_truck(truck_id, **update.dict(exclude_none=True))
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
    return truck


@router.patch("/trucks/{truck_id}/cargo-temperature")
async def update_cargo_temperature(truck_id: str, update: CargoTemperatureUpdate):
    """Update cargo temperature"""
    truck = truck_service.update_cargo_temperature(
        truck_id,
        update.temperature,
        update.coolantStatus
    )
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
    return truck


@router.get("/trucks/{truck_id}/cargo")
async def get_cargo(truck_id: str):
    """Get cargo status"""
    truck = truck_service.get_truck(truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
    return truck.cargo

# Made with Bob

