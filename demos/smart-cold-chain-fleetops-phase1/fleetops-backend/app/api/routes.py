"""Route API endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
from ..models.route import RouteWaypoint
from ..services.truck_service import truck_service
from ..utils.data_generator import I95_CORRIDOR
import random

router = APIRouter()


@router.get("/routes/waypoints/{truck_id}")
async def get_truck_waypoints(truck_id: str):
    """
    Get waypoints for a specific truck from CURRENT LOCATION to destination.
    Returns remaining route from current position plus 2 alternative routes.
    
    This endpoint dynamically generates routes based on where the truck is NOW,
    not from the original origin. As the truck moves, the routes update accordingly.
    """
    truck = truck_service.get_truck(truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
    
    # Get truck's current position
    current_lat = truck.telemetry.currentLocation.latitude
    current_lon = truck.telemetry.currentLocation.longitude
    
    # Get destination
    dest_lat = truck.currentTrip.destination.latitude
    dest_lon = truck.currentTrip.destination.longitude
    
    # Generate remaining waypoints from CURRENT location to destination
    remaining_waypoints = _generate_waypoints_from_current(
        current_lat, current_lon,
        dest_lat, dest_lon,
        truck.currentTrip.destination.name
    )
    
    # Generate 2 alternative routes from CURRENT location
    alternative_routes = []
    for i in range(2):
        alt_waypoints = _generate_alternative_from_current(
            current_lat, current_lon,
            dest_lat, dest_lon,
            truck.currentTrip.destination.name,
            variation=i+1
        )
        alternative_routes.append({
            "routeId": f"{truck_id}-alt-route-{i+1}",
            "routeName": f"Alternative Route {i+1}",
            "waypoints": alt_waypoints,
            "routeType": "alternative"
        })
    
    return {
        "truckId": truck_id,
        "currentLocation": {
            "latitude": current_lat,
            "longitude": current_lon,
            "address": f"Current Position"
        },
        "destination": truck.currentTrip.destination,
        "plannedRoute": {
            "waypoints": remaining_waypoints,
            "routeType": "planned",
            "routeName": "Remaining Route (from current location)",
            "routeId": "planned-route-current"
        },
        "alternativeRoutes": alternative_routes,
        "totalRoutes": len(alternative_routes) + 1
    }


def _generate_waypoints_from_current(
    current_lat: float, 
    current_lon: float,
    dest_lat: float,
    dest_lon: float,
    dest_name: str
) -> List[RouteWaypoint]:
    """
    Generate waypoints from current location to destination.
    Finds the nearest city in I-95 corridor to current position and generates route from there.
    """
    # Find nearest city to current location
    min_dist = float('inf')
    start_idx = 0
    
    for i, (city, lat, lon) in enumerate(I95_CORRIDOR):
        dist = ((lat - current_lat) ** 2 + (lon - current_lon) ** 2) ** 0.5
        if dist < min_dist:
            min_dist = dist
            start_idx = i
    
    # Find destination city index
    dest_idx = len(I95_CORRIDOR) - 1
    for i, (city, lat, lon) in enumerate(I95_CORRIDOR):
        if abs(lat - dest_lat) < 0.1 and abs(lon - dest_lon) < 0.1:
            dest_idx = i
            break
    
    # Generate waypoints from nearest city to destination
    waypoints = []
    
    # Add current position as first waypoint
    nearest_city = I95_CORRIDOR[start_idx][0]
    waypoints.append(RouteWaypoint(
        latitude=current_lat,
        longitude=current_lon,
        city=f"Current Position near {nearest_city}",
        highway="I-95"
    ))
    
    # Add intermediate cities
    for i in range(start_idx + 1, dest_idx + 1):
        city, lat, lon = I95_CORRIDOR[i]
        waypoints.append(RouteWaypoint(
            latitude=lat,
            longitude=lon,
            city=city,
            highway="I-95"
        ))
    
    # Ensure destination is included
    if len(waypoints) == 0 or (waypoints[-1].latitude != dest_lat or waypoints[-1].longitude != dest_lon):
        waypoints.append(RouteWaypoint(
            latitude=dest_lat,
            longitude=dest_lon,
            city=dest_name,
            highway="I-95"
        ))
    
    return waypoints


def _generate_alternative_from_current(
    current_lat: float,
    current_lon: float,
    dest_lat: float,
    dest_lon: float,
    dest_name: str,
    variation: int = 1
) -> List[RouteWaypoint]:
    """
    Generate alternative route from current location to destination.
    Uses different highways and waypoint strategies.
    """
    # Find nearest city to current location
    min_dist = float('inf')
    start_idx = 0
    
    for i, (city, lat, lon) in enumerate(I95_CORRIDOR):
        dist = ((lat - current_lat) ** 2 + (lon - current_lon) ** 2) ** 0.5
        if dist < min_dist:
            min_dist = dist
            start_idx = i
    
    # Find destination city index
    dest_idx = len(I95_CORRIDOR) - 1
    for i, (city, lat, lon) in enumerate(I95_CORRIDOR):
        if abs(lat - dest_lat) < 0.1 and abs(lon - dest_lon) < 0.1:
            dest_idx = i
            break
    
    # Different strategies for each variation
    if variation == 1:
        step = 2  # Skip every other city (faster route)
        highway = "US-1"
    else:
        step = 3  # Skip every 3rd city (inland route)
        highway = "US-301"
    
    waypoints = []
    
    # Add current position
    nearest_city = I95_CORRIDOR[start_idx][0]
    waypoints.append(RouteWaypoint(
        latitude=current_lat,
        longitude=current_lon,
        city=f"Current Position near {nearest_city}",
        highway=highway
    ))
    
    # Add intermediate waypoints with variation
    for i in range(start_idx + step, dest_idx + 1, step):
        idx = min(i, len(I95_CORRIDOR) - 1)
        city, lat, lon = I95_CORRIDOR[idx]
        
        # Add VERY slight random offset for variation to keep on land
        # Reduced from ±0.02 (±2.2km) to ±0.005 (±0.55km) to prevent water placement
        lat_offset = random.uniform(-0.005, 0.005)
        lon_offset = random.uniform(-0.005, 0.005)
        
        waypoints.append(RouteWaypoint(
            latitude=lat + lat_offset,
            longitude=lon + lon_offset,
            city=city,
            highway=highway
        ))
    
    # Ensure destination is included
    if len(waypoints) == 0 or (waypoints[-1].latitude != dest_lat or waypoints[-1].longitude != dest_lon):
        waypoints.append(RouteWaypoint(
            latitude=dest_lat,
            longitude=dest_lon,
            city=dest_name,
            highway=highway
        ))
    
    return waypoints


# Made with Bob
