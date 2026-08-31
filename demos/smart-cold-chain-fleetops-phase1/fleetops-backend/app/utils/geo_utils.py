"""Geographic utility functions for distance and route calculations"""
from geopy.distance import geodesic
from typing import Tuple, List
import math


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates in kilometers
    
    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate
        
    Returns:
        Distance in kilometers
    """
    return geodesic((lat1, lon1), (lat2, lon2)).kilometers


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate bearing between two coordinates in degrees
    
    Args:
        lat1, lon1: Start coordinate
        lat2, lon2: End coordinate
        
    Returns:
        Bearing in degrees (0-360)
    """
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    diff_lon = math.radians(lon2 - lon1)
    
    x = math.sin(diff_lon) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - (
        math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(diff_lon)
    )
    
    initial_bearing = math.atan2(x, y)
    initial_bearing = math.degrees(initial_bearing)
    bearing = (initial_bearing + 360) % 360
    
    return bearing


def interpolate_waypoints(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    num_points: int
) -> List[Tuple[float, float]]:
    """
    Generate intermediate waypoints between two coordinates
    
    Args:
        start_lat, start_lon: Start coordinate
        end_lat, end_lon: End coordinate
        num_points: Number of intermediate points to generate
        
    Returns:
        List of (latitude, longitude) tuples
    """
    waypoints = []
    for i in range(num_points + 1):
        fraction = i / num_points
        lat = start_lat + (end_lat - start_lat) * fraction
        lon = start_lon + (end_lon - start_lon) * fraction
        waypoints.append((lat, lon))
    
    return waypoints


def calculate_eta_minutes(distance_km: float, avg_speed_kmh: float = 95.0) -> int:
    """
    Calculate estimated time of arrival in minutes
    
    Args:
        distance_km: Distance in kilometers
        avg_speed_kmh: Average speed in km/h (default: 95 km/h for highway)
        
    Returns:
        ETA in minutes
    """
    hours = distance_km / avg_speed_kmh
    return int(hours * 60)


def calculate_fuel_cost(distance_km: float, fuel_price_per_liter: float = 1.50, 
                       consumption_per_100km: float = 35.0) -> float:
    """
    Calculate fuel cost for a given distance
    
    Args:
        distance_km: Distance in kilometers
        fuel_price_per_liter: Fuel price per liter in USD
        consumption_per_100km: Fuel consumption per 100km in liters
        
    Returns:
        Fuel cost in USD
    """
    liters_needed = (distance_km / 100) * consumption_per_100km
    return round(liters_needed * fuel_price_per_liter, 2)


def find_nearest_point_on_route(
    current_lat: float,
    current_lon: float,
    route_waypoints: List[Tuple[float, float]]
) -> Tuple[int, float]:
    """
    Find the nearest waypoint on a route to current position
    
    Args:
        current_lat, current_lon: Current position
        route_waypoints: List of (lat, lon) tuples representing the route
        
    Returns:
        Tuple of (waypoint_index, distance_km)
    """
    min_distance = float('inf')
    nearest_index = 0
    
    for i, (lat, lon) in enumerate(route_waypoints):
        distance = calculate_distance(current_lat, current_lon, lat, lon)
        if distance < min_distance:
            min_distance = distance
            nearest_index = i
    
    return nearest_index, min_distance


def is_point_on_route(
    point_lat: float,
    point_lon: float,
    route_waypoints: List[Tuple[float, float]],
    threshold_km: float = 50.0
) -> bool:
    """
    Check if a point is within threshold distance of a route
    
    Args:
        point_lat, point_lon: Point to check
        route_waypoints: List of (lat, lon) tuples representing the route
        threshold_km: Maximum distance in km to consider "on route"
        
    Returns:
        True if point is within threshold of route
    """
    _, min_distance = find_nearest_point_on_route(point_lat, point_lon, route_waypoints)
    return min_distance <= threshold_km

# Made with Bob
