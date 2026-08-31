"""Data generation utilities for realistic simulation data with predefined routes"""
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Optional
from ..models.route import Location, RouteWaypoint
from ..models.station import Station, StationLocation, StationCapabilities, OperatingHours, ServiceDetails
from ..models.weather import WeatherSegment, Coordinates, WeatherCondition, WeatherSeverity
from ..models.cargo import Cargo
from .geo_utils import calculate_distance, interpolate_waypoints, calculate_eta_minutes, calculate_fuel_cost

# Global tracking for unique station names across all trucks
_GLOBAL_STATION_NAMES: set = set()
_GLOBAL_CITY_COUNTER: dict = {}

# I-95 corridor cities (North to South) - kept for backward compatibility
I95_CORRIDOR = [
    ("Boston, MA", 42.3601, -71.0589),
    ("Providence, RI", 41.8240, -71.4128),
    ("New Haven, CT", 41.3082, -72.9279),
    ("Bridgeport, CT", 41.1865, -73.1952),
    ("Stamford, CT", 41.0534, -73.5387),
    ("New York, NY", 40.7128, -74.0060),
    ("Newark, NJ", 40.7357, -74.1724),
    ("Trenton, NJ", 40.2206, -74.7597),
    ("Philadelphia, PA", 39.9526, -75.1652),
    ("Wilmington, DE", 39.7391, -75.5398),
    ("Baltimore, MD", 39.2904, -76.6122),
    ("Washington, DC", 38.9072, -77.0369),
    ("Fredericksburg, VA", 38.3032, -77.4605),
    ("Richmond, VA", 37.5407, -77.4360),
    ("Petersburg, VA", 37.2279, -77.4019),
    ("Rocky Mount, NC", 35.9382, -77.7905),
    ("Raleigh, NC", 35.7796, -78.6382),
    ("Fayetteville, NC", 35.0527, -78.8784),
    ("Lumberton, NC", 34.6182, -79.0089),
    ("Florence, SC", 34.1954, -79.7626),
    ("Santee, SC", 33.4843, -80.4812),
    ("Charleston, SC", 32.7765, -79.9311),
    ("Savannah, GA", 32.0809, -81.0912),
    ("Brunswick, GA", 31.1500, -81.4915),
    ("Jacksonville, FL", 30.3322, -81.6557),
    ("Daytona Beach, FL", 29.2108, -81.0228),
    ("Port St. Lucie, FL", 27.2939, -80.3503),
    ("West Palm Beach, FL", 26.7153, -80.0534),
    ("Fort Lauderdale, FL", 26.1224, -80.1373),
    ("Miami, FL", 25.7617, -80.1918),
]

# Define 10 unique highway routes across the US (each ~250km)
# Each route is assigned to a specific truck with origin and destination
PREDEFINED_ROUTES = {
    "TRUCK-001": {
        "highway": "I-95",
        "origin": {"name": "Boston, MA", "lat": 42.3601, "lon": -71.0589},
        "destination": {"name": "New York, NY", "lat": 40.7128, "lon": -74.0060}
    },
    "TRUCK-002": {
        "highway": "I-95",
        "origin": {"name": "Philadelphia, PA", "lat": 39.9526, "lon": -75.1652},
        "destination": {"name": "Washington, DC", "lat": 38.9072, "lon": -77.0369}
    },
    "TRUCK-003": {
        "highway": "I-75",
        "origin": {"name": "Atlanta, GA", "lat": 33.7490, "lon": -84.3880},
        "destination": {"name": "Macon, GA", "lat": 32.8407, "lon": -83.6324}
    },
    "TRUCK-004": {
        "highway": "I-75",
        "origin": {"name": "Cincinnati, OH", "lat": 39.1031, "lon": -84.5120},
        "destination": {"name": "Dayton, OH", "lat": 39.7589, "lon": -84.1916}
    },
    "TRUCK-005": {
        "highway": "I-10",
        "origin": {"name": "San Antonio, TX", "lat": 29.4241, "lon": -98.4936},
        "destination": {"name": "Austin, TX", "lat": 30.2672, "lon": -97.7431}
    },
    "TRUCK-006": {
        "highway": "I-10",
        "origin": {"name": "Phoenix, AZ", "lat": 33.4484, "lon": -112.0740},
        "destination": {"name": "Tucson, AZ", "lat": 32.2226, "lon": -110.9747}
    },
    "TRUCK-007": {
        "highway": "I-80",
        "origin": {"name": "Omaha, NE", "lat": 41.2565, "lon": -95.9345},
        "destination": {"name": "Des Moines, IA", "lat": 41.5868, "lon": -93.6250}
    },
    "TRUCK-008": {
        "highway": "I-40",
        "origin": {"name": "Memphis, TN", "lat": 35.1495, "lon": -90.0490},
        "destination": {"name": "Little Rock, AR", "lat": 34.7465, "lon": -92.2896}
    },
    "TRUCK-009": {
        "highway": "I-5",
        "origin": {"name": "Seattle, WA", "lat": 47.6062, "lon": -122.3321},
        "destination": {"name": "Portland, OR", "lat": 45.5152, "lon": -122.6784}
    },
    "TRUCK-010": {
        "highway": "I-90",
        "origin": {"name": "Cleveland, OH", "lat": 41.4993, "lon": -81.6944},
        "destination": {"name": "Erie, PA", "lat": 42.1292, "lon": -80.0851}
    }
}


def generate_route_pair() -> Tuple[Location, Location]:
    """Generate origin-destination pair (legacy function for compatibility)"""
    # This function is kept for backward compatibility
    # It will be overridden by truck-specific generation in truck_service
    truck_id = "TRUCK-001"  # Default
    return generate_route_pair_for_truck(truck_id)


def generate_route_pair_for_truck(truck_id: str) -> Tuple[Location, Location]:
    """Generate origin-destination pair for a specific truck from predefined routes"""
    if truck_id not in PREDEFINED_ROUTES:
        raise ValueError(f"No predefined route for {truck_id}")
    
    route_config = PREDEFINED_ROUTES[truck_id]
    origin_data = route_config["origin"]
    dest_data = route_config["destination"]
    
    origin = Location(
        name=f"{origin_data['name']} Distribution Center",
        latitude=origin_data['lat'],
        longitude=origin_data['lon']
    )
    
    destination = Location(
        name=f"{dest_data['name']} Distribution Center",
        latitude=dest_data['lat'],
        longitude=dest_data['lon']
    )
    
    return origin, destination


def generate_trip_id() -> str:
    """Generate a unique trip ID"""
    return f"TRIP-{uuid.uuid4().hex[:8].upper()}"


def generate_route_waypoints(origin: Location, destination: Location, truck_id: Optional[str] = None) -> List[RouteWaypoint]:
    """Generate waypoints between origin and destination with 5 intermediate points for stations
    
    Args:
        origin: Starting location
        destination: Ending location
        truck_id: Optional truck ID for logging/debugging
    """
    waypoints = []
    
    # Get highway info if truck_id is provided
    highway = "I-95"  # default
    if truck_id and truck_id in PREDEFINED_ROUTES:
        highway = PREDEFINED_ROUTES[truck_id]["highway"]
    
    # Create 7 waypoints total: origin + 5 intermediate + destination
    # This ensures we have exactly 5 stations along the route (at intermediate points)
    num_segments = 6  # 6 segments = 7 waypoints
    
    for i in range(num_segments + 1):
        progress = i / num_segments
        
        # Interpolate coordinates
        lat = origin.latitude + (destination.latitude - origin.latitude) * progress
        lon = origin.longitude + (destination.longitude - origin.longitude) * progress
        
        # Determine waypoint type
        if i == 0:
            wp_type = "waypoint"
            city = origin.name.split(" Distribution")[0]
        elif i == num_segments:
            wp_type = "destination"
            city = destination.name.split(" Distribution")[0]
        else:
            wp_type = "waypoint"
            city = f"Waypoint {i}"
        
        waypoint = RouteWaypoint(
            latitude=lat,
            longitude=lon,
            city=city,
            highway=highway,
            type=wp_type,
            note=f"Progress: {int(progress * 100)}%"
        )
        waypoints.append(waypoint)
    
    return waypoints


def generate_stations_along_route(
    truck_id: str,
    origin: Location,
    destination: Location,
    waypoints: List[RouteWaypoint]
) -> List[Station]:
    """Generate exactly 5 stations for a truck, placed at 50km intervals along the route"""
    stations = []
    route_config = PREDEFINED_ROUTES.get(truck_id, {})
    highway = route_config.get("highway", "I-95")
    
    # Use waypoints 1-5 (skip origin at 0 and destination at 6) for station placement
    # This gives us exactly 5 stations evenly spaced along the route
    for i in range(1, 6):
        waypoint = waypoints[i]
        station_number = i
        
        # Calculate distance from origin for this waypoint
        distance_from_origin = calculate_distance(
            origin.latitude, origin.longitude,
            waypoint.latitude, waypoint.longitude
        )
        
        # Generate unique station name
        base_city = origin.name.split(" Distribution")[0]
        station_name = f"{highway} Service Plaza {station_number} - {base_city} Route"
        
        # Ensure uniqueness
        counter = 1
        original_name = station_name
        while station_name in _GLOBAL_STATION_NAMES:
            station_name = f"{original_name} #{counter}"
            counter += 1
        _GLOBAL_STATION_NAMES.add(station_name)
        
        # Create station at this waypoint matching the actual Station model
        station = Station(
            stationId=f"STN-{truck_id}-{station_number:02d}",
            name=station_name,
            location=StationLocation(
                latitude=waypoint.latitude,
                longitude=waypoint.longitude,
                address=f"{highway} Mile Marker {int(distance_from_origin * 0.621371)}"
            ),
            region=base_city.split(",")[1].strip() if "," in base_city else "US",
            distance=distance_from_origin,
            travelTime=int(distance_from_origin / 80 * 60),  # Assuming 80 km/h average speed
            onPlannedRoute=True,
            baysAvailable=random.randint(3, 8),
            totalBays=10,
            capabilities=StationCapabilities(
                refrigeration=True,
                emergencyCooling=True,
                pharmaceuticalStorage=True
            ),
            serviceDetails=ServiceDetails(
                capabilityType="emergencyCooling",
                available=True,
                details={"coolingCapacity": "500kW", "responseTime": "15min"},
                serviceFee=150.0
            ),
            operatingHours=OperatingHours(
                open24x7=True,
                currentlyOpen=True,
                closingTime=None
            ),
            score=random.randint(75, 95),
            status="AVAILABLE"
        )
        stations.append(station)
    
    return stations


def generate_weather_segments(waypoints: List[RouteWaypoint]) -> List[WeatherSegment]:
    """Generate weather conditions for route segments"""
    segments = []
    
    for i in range(len(waypoints) - 1):
        start = waypoints[i]
        end = waypoints[i + 1]
        
        # Random weather conditions - use only valid enum values
        conditions = random.choice([
            WeatherCondition.CLEAR,
            WeatherCondition.PARTLY_CLOUDY,
            WeatherCondition.RAIN,
            WeatherCondition.HEAVY_RAIN,
            WeatherCondition.FOG
        ])
        
        # Determine severity based on condition
        if conditions in [WeatherCondition.CLEAR, WeatherCondition.PARTLY_CLOUDY]:
            severity = WeatherSeverity.LOW
        elif conditions == WeatherCondition.FOG:
            severity = WeatherSeverity.MODERATE
        else:
            severity = random.choice([WeatherSeverity.MODERATE, WeatherSeverity.SEVERE])
        
        # Create location names from coordinates
        start_location = f"Waypoint {i+1}"
        
        segment = WeatherSegment(
            location=start_location,
            coordinates=Coordinates(latitude=start.latitude, longitude=start.longitude),
            condition=conditions.value.lower(),
            severity=severity.value,
            temperature=random.uniform(60, 85),  # Fahrenheit
            windSpeed=random.uniform(5, 25),
            visibility=random.uniform(5, 10),
            estimatedDelay=random.randint(0, 30) if severity != WeatherSeverity.CLEAR else 0
        )
        segments.append(segment)
    
    return segments


def generate_cargo() -> Cargo:
    """Generate cargo with temperature requirements matching the Cargo model"""
    cargo_types = [
        "temperature_sensitive_vaccines",
        "fresh_produce",
        "frozen_foods",
        "dairy_products",
        "pharmaceuticals"
    ]
    cargo_type = random.choice(cargo_types)
    
    # Temperature thresholds and spoilage times based on cargo type (in Celsius)
    cargo_configs = {
        "temperature_sensitive_vaccines": {
            "threshold": -10.0,
            "spoilage_time": 120,
            "value_range": (150000, 300000)
        },
        "fresh_produce": {
            "threshold": 4.0,
            "spoilage_time": 180,
            "value_range": (20000, 50000)
        },
        "frozen_foods": {
            "threshold": -18.0,
            "spoilage_time": 240,
            "value_range": (30000, 80000)
        },
        "dairy_products": {
            "threshold": 4.0,
            "spoilage_time": 150,
            "value_range": (15000, 40000)
        },
        "pharmaceuticals": {
            "threshold": 8.0,
            "spoilage_time": 90,
            "value_range": (100000, 250000)
        }
    }
    
    config = cargo_configs[cargo_type]
    value_min, value_max = config["value_range"]
    
    # Set initial temperature slightly above threshold to create urgency
    initial_temp = config["threshold"] + random.uniform(1, 3)
    
    return Cargo(
        type=cargo_type,
        value=random.uniform(value_min, value_max),
        criticalThreshold=config["threshold"],
        timeToSpoilage=config["spoilage_time"],
        currentTemperature=initial_temp,
        condition="GOOD"
    )

# Made with Bob
