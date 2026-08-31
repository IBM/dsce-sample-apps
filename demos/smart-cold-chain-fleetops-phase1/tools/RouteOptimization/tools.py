"""
FleetOps Route Optimization Tool
IBM Watsonx Orchestrate ADK Implementation
Simplified to use pre-calculated facility scores
"""

from typing import Dict, List, Any
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from ibm_watsonx_orchestrate.agent_builder.tools import tool


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class Destination(BaseModel):
    """Destination information"""
    latitude: float
    longitude: float
    facilityName: str
    address: str


class Waypoint(BaseModel):
    """Route waypoint"""
    latitude: float
    longitude: float
    city: str
    type: str


class Route(BaseModel):
    """Route information"""
    routeId: str
    name: str
    destination: Destination
    distance: float
    estimatedDuration: int
    totalDuration: int
    arrivalTime: str
    fuelCost: float
    isAlternateRoute: bool
    waypoints: List[Waypoint]


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def calculate_fuel_cost(distance_km: float) -> float:
    """
    Calculate fuel cost
    Fuel efficiency: 2.5 km/l
    Diesel price: 1.15 USD/l
    """
    FUEL_EFFICIENCY_KM_PER_L = 2.5
    DIESEL_PRICE_USD_PER_L = 1.15
    liters = distance_km / FUEL_EFFICIENCY_KM_PER_L
    return round(liters * DIESEL_PRICE_USD_PER_L, 2)


def calculate_arrival_time(duration_minutes: int) -> str:
    """Calculate arrival time from current time"""
    arrival = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
    return arrival.strftime("%Y-%m-%dT%H:%M:%S.000Z")


# ============================================================================
# ROUTE CREATION
# ============================================================================

def create_route(
    facility: Dict[str, Any],
    route_id: str,
    route_name: str,
    rank: int
) -> Route:
    """
    Create a route object from facility data.
    Uses pre-calculated distance and travelTime from the facility.
    """
    
    # Extract facility location
    location = facility.get("location", {})
    facility_lat = location.get("latitude")
    facility_lon = location.get("longitude")
    
    if facility_lat is None or facility_lon is None:
        raise ValueError(f"Facility missing location coordinates")
    
    # Use pre-calculated distance and travel time from facility
    distance = facility.get("distance", 0.0)
    travel_time = facility.get("travelTime", 0)
    
    # Calculate fuel cost based on distance
    fuel_cost = calculate_fuel_cost(distance)
    
    # Calculate arrival time
    arrival_time = calculate_arrival_time(travel_time)
    
    # Create waypoint (facility location)
    waypoint = Waypoint(
        latitude=facility_lat,
        longitude=facility_lon,
        city=facility.get("name", "Facility"),
        type="facility_stop"
    )
    
    # Create destination
    destination = Destination(
        latitude=facility_lat,
        longitude=facility_lon,
        facilityName=facility.get("name", "Unknown Facility"),
        address=location.get("address", "")
    )
    
    # Determine if this is an alternate route (rank > 1)
    is_alternate = rank > 1
    
    # Create route
    return Route(
        routeId=route_id,
        name=route_name,
        destination=destination,
        distance=round(distance, 2),
        estimatedDuration=travel_time,
        totalDuration=travel_time,
        arrivalTime=arrival_time,
        fuelCost=fuel_cost,
        isAlternateRoute=is_alternate,
        waypoints=[waypoint]
    )


# ============================================================================
# MAIN TOOL
# ============================================================================

@tool(
    name="route_optimizer",
    description="Optimizes truck rerouting by ranking facilities based on their pre-calculated scores"
)
def route_optimizer(
    truckId: str,
    currentLocation: Dict[str, float],
    originalDestination: Dict[str, Any],
    facilities: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Route Optimization Tool for FleetOps

    Ranks facilities by their pre-calculated scores (highest first) and returns
    route recommendations. The score already considers distance, availability,
    capabilities, and other factors.

    Args:
        truckId (str): Truck identifier
        currentLocation (Dict[str, float]): Current GPS coordinates with keys 'latitude' and 'longitude'
        originalDestination (Dict[str, Any]): Original destination with keys 'latitude', 'longitude', and 'name'
        facilities (List[Dict[str, Any]]): List of facility options with pre-calculated scores

    Returns:
        Dict[str, Any]: Dictionary with ranked routes (best score first) and totalRoutesEvaluated
    """
    
    if not facilities:
        return {
            "routes": [],
            "totalRoutesEvaluated": 0
        }
    
    # Step 1: Sort facilities by score (highest first)
    # The score already considers all factors: distance, availability, capabilities, etc.
    sorted_facilities = sorted(
        facilities,
        key=lambda f: f.get("score", 0),
        reverse=True  # Highest score first
    )
    
    # Step 2: Create route objects for each facility
    routes = []
    for rank, facility in enumerate(sorted_facilities, 1):
        try:
            # Validate facility has required data
            location = facility.get("location", {})
            if location.get("latitude") is None or location.get("longitude") is None:
                continue
            
            # Create route with rank-based naming
            route_id = f"route-{rank}"
            route_name = f"Route Option {rank}"
            
            route = create_route(
                facility=facility,
                route_id=route_id,
                route_name=route_name,
                rank=rank
            )
            
            routes.append(route)
            
        except Exception as e:
            # Skip facilities with errors
            continue
    
    # Step 3: Return formatted response
    return {
        "routes": [route.model_dump() for route in routes],
        "totalRoutesEvaluated": len(routes)
    }


# Made with Bob
