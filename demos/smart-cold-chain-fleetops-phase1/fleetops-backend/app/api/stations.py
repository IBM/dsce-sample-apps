"""Station API endpoints"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from pydantic import BaseModel, Field
from ..models.station import Station, StationUpdateRequest, StationResponse
from ..models.route import RouteWaypoint
from ..services.station_service import station_service
from ..services.truck_service import truck_service
from ..utils.geo_utils import calculate_distance, calculate_eta_minutes

router = APIRouter()


class StationSearchRequest(BaseModel):
    """Request model for station search - matches changed_schema.md Station Agent input"""
    truckId: str = Field(..., description="Truck ID")
    searchRadius: float = Field(..., description="Search radius in km")
    searchStrategy: str = Field(..., description="along_planned_route | alternative_locations")
    plannedRoute: List[RouteWaypoint] = Field(..., description="Planned route waypoints")
    requiredCapabilities: List[str] = Field(default_factory=list, description="Required capabilities")
    cargoType: str = Field(..., description="Cargo type")


@router.get("/stations", response_model=List[Station])
async def get_all_stations():
    """Get all stations across all routes"""
    return station_service.get_all_stations()


@router.get("/stations/{station_id}", response_model=Station)
async def get_station(station_id: str):
    """Get specific station by ID"""
    station = station_service.get_station(station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")
    return station


@router.post("/stations/search", response_model=StationResponse)
async def search_stations(request: StationSearchRequest):
    """
    Search for stations based on truck location, search radius, and strategy.
    This endpoint matches the Station Agent input schema from changed_schema.md.
    
    Parameters:
    - truckId: Truck ID to search stations for
    - searchRadius: Search radius in km (e.g., 50, 100, 150)
    - searchStrategy: "along_planned_route" or "alternative_locations"
    - plannedRoute: List of waypoints defining the planned route
    - requiredCapabilities: List of required capabilities (e.g., ["emergencyCooling"])
    - cargoType: Type of cargo being transported
    
    Returns:
    - facilities: List of stations matching criteria
    - totalFacilitiesFound: Total number of stations found
    - searchStrategyUsed: Strategy that was used
    """
    # Get truck
    truck = truck_service.get_truck(request.truckId)
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {request.truckId} not found")
    
    # Get truck's current location
    current_lat = truck.telemetry.currentLocation.latitude
    current_lon = truck.telemetry.currentLocation.longitude
    
    # Get all stations
    all_stations = station_service.get_all_stations()
    
    # Filter stations based on search strategy
    if request.searchStrategy == "along_planned_route":
        # Filter stations within search radius of planned route waypoints
        filtered_stations = []
        for station in all_stations:
            # Check if station is within search radius of any waypoint
            for waypoint in request.plannedRoute:
                dist = calculate_distance(
                    waypoint.latitude, waypoint.longitude,
                    station.location.latitude, station.location.longitude
                )
                if dist <= request.searchRadius:
                    # Calculate distance from truck's current location
                    station.distance = round(calculate_distance(
                        current_lat, current_lon,
                        station.location.latitude, station.location.longitude
                    ), 2)
                    station.travelTime = calculate_eta_minutes(station.distance)
                    station.onPlannedRoute = True
                    filtered_stations.append(station)
                    break  # Don't add same station multiple times
    else:
        # alternative_locations: Search all stations within radius of current location
        filtered_stations = []
        for station in all_stations:
            dist = calculate_distance(
                current_lat, current_lon,
                station.location.latitude, station.location.longitude
            )
            if dist <= request.searchRadius:
                station.distance = round(dist, 2)
                station.travelTime = calculate_eta_minutes(station.distance)
                station.onPlannedRoute = False
                filtered_stations.append(station)
    
    # Filter by required capabilities if specified
    if request.requiredCapabilities:
        capability_filtered = []
        for station in filtered_stations:
            has_all_capabilities = True
            for capability in request.requiredCapabilities:
                if capability == "emergencyCooling" and not station.capabilities.emergencyCooling:
                    has_all_capabilities = False
                    break
                elif capability == "refrigeration" and not station.capabilities.refrigeration:
                    has_all_capabilities = False
                    break
                elif capability == "pharmaceuticalStorage" and not station.capabilities.pharmaceuticalStorage:
                    has_all_capabilities = False
                    break
            if has_all_capabilities:
                capability_filtered.append(station)
        filtered_stations = capability_filtered
    
    # Filter by availability
    available_stations = [
        s for s in filtered_stations
        if s.status == "AVAILABLE" and s.baysAvailable > 0
    ]
    
    # Sort by distance
    available_stations.sort(key=lambda s: s.distance or float('inf'))
    
    return StationResponse(
        facilities=available_stations,
        totalFacilitiesFound=len(available_stations),
        searchStrategyUsed=request.searchStrategy
    )


@router.patch("/stations/{station_id}", response_model=Station)
async def update_station(station_id: str, update: StationUpdateRequest):
    """Update station availability and status"""
    station = station_service.update_station(station_id, update)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")
    return station

# Made with Bob
