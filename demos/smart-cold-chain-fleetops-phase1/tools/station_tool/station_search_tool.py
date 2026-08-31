"""
Station Search Tool for FleetOps AI Agent Orchestration

This tool calls the real FleetOps Station Search API endpoint to search for service facilities
based on search strategy and requirements.

API Endpoint: POST <FLEETOPS_API_BASE_URL>/api/stations/search

Requires the 'fleetops_api' key-value connection with key FLEETOPS_API_BASE_URL.
Local emulation:
    export WXO_SECURITY_SCHEMA_fleetops_api=key_value_creds
    export WXO_CONNECTION_fleetops_api_FLEETOPS_API_BASE_URL=https://<your-host>
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import math
import requests
from ibm_watsonx_orchestrate.agent_builder.tools import tool
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType
from ibm_watsonx_orchestrate.run import connections


class LocationCoordinates(BaseModel):
    """Geographic coordinates"""
    latitude: float = Field(description="Latitude coordinate")
    longitude: float = Field(description="Longitude coordinate")


class RouteWaypoint(BaseModel):
    """Waypoint on the planned route"""
    latitude: float = Field(description="Latitude coordinate")
    longitude: float = Field(description="Longitude coordinate")
    city: Optional[str] = Field(None, description="City name (optional)")
    highway: Optional[str] = Field(None, description="Highway identifier (optional)")


class StationSearchInput(BaseModel):
    """Input schema for station search"""
    truckId: str = Field(description="Identifier for the truck requiring service")
    searchRadius: float = Field(description="Maximum search distance in kilometers")
    searchStrategy: str = Field(
        description="Search strategy: 'along_planned_route' or 'alternative_locations'"
    )
    plannedRoute: List[RouteWaypoint] = Field(
        description="Array of waypoints defining the truck's planned route"
    )
    requiredCapabilities: List[str] = Field(
        description="Array of required facility capabilities (e.g., 'refrigeration', 'emergencyCooling')"
    )
    cargoType: str = Field(description="Type of cargo requiring service")


class FacilityLocation(BaseModel):
    """Facility location details"""
    latitude: float
    longitude: float
    address: str


class FacilityCapabilities(BaseModel):
    """Facility capabilities - dynamically populated based on requirements"""
    pass  # Will be populated dynamically based on requiredCapabilities


class ServiceDetails(BaseModel):
    """Generic service details for any capability type"""
    capabilityType: str = Field(description="Type of service capability (e.g., 'emergencyCooling', 'tire_repair', 'mechanical_repair')")
    available: bool = Field(description="Whether this service is currently available")
    details: Optional[Dict[str, Any]] = Field(None, description="Capability-specific details (e.g., coolingCapacity, equipmentType, certifications)")
    serviceFee: Optional[float] = Field(None, description="Service fee in USD")


class OperatingHours(BaseModel):
    """Facility operating hours"""
    open24x7: bool
    currentlyOpen: bool
    closingTime: Optional[str] = None


class Facility(BaseModel):
    """Facility information"""
    stationId: str
    name: str
    location: FacilityLocation
    distance: float = Field(description="Distance in kilometers")
    travelTime: int = Field(description="Estimated travel time in minutes")
    onPlannedRoute: bool = Field(
        description="Whether facility is on the planned route"
    )
    baysAvailable: int = Field(description="Number of available loading bays")
    totalBays: int = Field(description="Total number of loading bays")
    capabilities: Dict[str, bool] = Field(
        description="Facility capabilities matching requiredCapabilities"
    )
    serviceDetails: Optional[ServiceDetails] = Field(None, description="Service-specific details for primary required capability")
    operatingHours: OperatingHours
    score: int = Field(description="Facility score from 0-100")


class StationSearchOutput(BaseModel):
    """Output schema for station search"""
    facilities: List[Facility] = Field(
        description="List of facilities matching search criteria"
    )
    totalFacilitiesFound: int = Field(
        description="Total number of facilities found"
    )
    searchStrategyUsed: str = Field(
        description="Search strategy that was used: 'along_planned_route' or 'alternative_locations'"
    )


@tool(expected_credentials=[{'app_id': 'fleetops_api', 'type': ConnectionType.KEY_VALUE}])
def search_stations(input_data: StationSearchInput) -> StationSearchOutput:
    """
    Search for service facilities based on search strategy and requirements.

    This function calls the real FleetOps Station Search API endpoint:
    POST <FLEETOPS_API_BASE_URL>/api/stations/search

    The API base URL is provided via the 'fleetops_api' key-value connection
    (key: FLEETOPS_API_BASE_URL). For local testing, export:
        WXO_SECURITY_SCHEMA_fleetops_api=key_value_creds
        WXO_CONNECTION_fleetops_api_FLEETOPS_API_BASE_URL=https://<your-host>

    Args:
        input_data (StationSearchInput): Search parameters including truck ID, search radius,
            search strategy, planned route, required capabilities, and cargo type.

    Returns:
        StationSearchOutput: List of matching facilities with scores, distances, and availability.
    """
    # Resolve API base URL from connection — raises clearly if connection is not configured
    try:
        conn = connections.key_value('fleetops_api')
        fleetops_api_base_url = conn.FLEETOPS_API_BASE_URL
    except Exception as e:
        raise RuntimeError(
            "The 'fleetops_api' key-value connection is not configured. "
            "Set FLEETOPS_API_BASE_URL via: orchestrate connections set-credentials -a fleetops_api "
            "--env draft -e 'FLEETOPS_API_BASE_URL=https://<your-host>'"
        ) from e
    if not fleetops_api_base_url:
        raise RuntimeError(
            "FLEETOPS_API_BASE_URL is not set in the 'fleetops_api' connection. "
            "Run: orchestrate connections set-credentials -a fleetops_api "
            "--env draft -e 'FLEETOPS_API_BASE_URL=https://<your-host>'"
        )

    stations_search_endpoint = f"{fleetops_api_base_url}/api/stations/search"

    try:
        # Prepare request payload matching the API schema
        request_payload = {
            "truckId": input_data.truckId,
            "searchRadius": input_data.searchRadius,
            "searchStrategy": input_data.searchStrategy,
            "plannedRoute": [
                {
                    "latitude": wp.latitude,
                    "longitude": wp.longitude,
                    "city": wp.city,
                    "highway": wp.highway,
                    "type": "waypoint",
                    "note": ""
                }
                for wp in input_data.plannedRoute
            ],
            "requiredCapabilities": input_data.requiredCapabilities,
            "cargoType": input_data.cargoType
        }
        
        # Call the real API endpoint
        response = requests.post(
            stations_search_endpoint,
            json=request_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        # Check if request was successful
        response.raise_for_status()
        
        # Parse the API response
        api_response = response.json()
        
        # The API returns the data in the format we need
        # Convert API response to our output schema
        facilities = []
        for facility_data in api_response.get("facilities", []):
            facility = Facility(
                stationId=facility_data["stationId"],
                name=facility_data["name"],
                location=FacilityLocation(
                    latitude=facility_data["location"]["latitude"],
                    longitude=facility_data["location"]["longitude"],
                    address=facility_data["location"]["address"]
                ),
                distance=facility_data["distance"],
                travelTime=facility_data["travelTime"],
                onPlannedRoute=facility_data["onPlannedRoute"],
                baysAvailable=facility_data["baysAvailable"],
                totalBays=facility_data["totalBays"],
                capabilities=facility_data["capabilities"],
                serviceDetails=(
                    ServiceDetails(**facility_data["serviceDetails"])
                    if facility_data.get("serviceDetails")
                    else None
                ),
                operatingHours=OperatingHours(**facility_data["operatingHours"]),
                score=facility_data["score"]
            )
            facilities.append(facility)
        
        return StationSearchOutput(
            facilities=facilities,
            totalFacilitiesFound=api_response.get("totalFacilitiesFound", len(facilities)),
            searchStrategyUsed=api_response.get("searchStrategyUsed", input_data.searchStrategy)
        )
        
    except requests.exceptions.RequestException as e:
        # Handle API errors gracefully
        print(f"Error calling FleetOps Station Search API: {str(e)}")
        # Return empty result on error
        return StationSearchOutput(
            facilities=[],
            totalFacilitiesFound=0,
            searchStrategyUsed=input_data.searchStrategy
        )
    except Exception as e:
        # Handle any other errors
        print(f"Unexpected error in search_stations: {str(e)}")
        return StationSearchOutput(
            facilities=[],
            totalFacilitiesFound=0,
            searchStrategyUsed=input_data.searchStrategy
        )


# Tool metadata for watsonx Orchestrate
__tool_name__ = "search_stations"
__tool_description__ = "Search for service facilities based on search strategy, location, and capability requirements. Returns facilities with distance, availability, and scoring information."
