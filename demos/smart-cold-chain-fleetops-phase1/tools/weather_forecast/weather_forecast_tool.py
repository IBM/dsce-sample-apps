#!/usr/bin/env python3
"""
Weather Forecast Tool for watsonx Orchestrate
Provides weather forecasts along truck routes by fetching truck data from FleetOps Cold-Chain Simulation Backend API

Requires the 'fleetops_api' key-value connection with key FLEETOPS_API_URL.
Local emulation:
    export WXO_SECURITY_SCHEMA_fleetops_api=key_value_creds
    export WXO_CONNECTION_fleetops_api_FLEETOPS_API_URL=https://<your-host>
"""

import math
import random
import requests
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional
from ibm_watsonx_orchestrate.agent_builder.tools import tool
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType
from ibm_watsonx_orchestrate.run import connections

API_TIMEOUT = 10


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance in kilometers between two GPS coordinates using Haversine formula.
    
    Args:
        lat1: Latitude of first point
        lon1: Longitude of first point
        lat2: Latitude of second point
        lon2: Longitude of second point
    
    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def _interpolate_coordinates(start_lat: float, start_lon: float, 
                            end_lat: float, end_lon: float, 
                            fraction: float) -> Dict[str, float]:
    """
    Interpolate coordinates along a straight line between start and end points.
    
    Args:
        start_lat: Starting latitude
        start_lon: Starting longitude
        end_lat: Ending latitude
        end_lon: Ending longitude
        fraction: Fraction of distance (0.0 to 1.0)
    
    Returns:
        Dictionary with latitude and longitude
    """
    lat = start_lat + (end_lat - start_lat) * fraction
    lon = start_lon + (end_lon - start_lon) * fraction
    
    return {
        'latitude': round(lat, 6),
        'longitude': round(lon, 6)
    }


def _generate_mock_weather(distance_from_current: float, base_temp: float = 20.0,
                          forced_condition: str | None = None) -> Dict[str, Any]:
    """
    Generate mock weather data for a waypoint.
    
    Args:
        distance_from_current: Distance from current position in km
        base_temp: Base temperature to vary from
        forced_condition: Optional forced weather condition
    
    Returns:
        Dictionary with weather data
    """
    # Define weather profiles for forced conditions
    weather_profiles = {
        'heavy_rain': {
            'conditions': ['rain', 'heavy_rain'],
            'temp_range': (15, 20),
            'humidity_range': (75, 95),
            'wind_range': (25, 45),
            'visibility_range': (4, 8)
        },
        'snow': {
            'conditions': ['snow'],
            'temp_range': (-5, 5),
            'humidity_range': (70, 90),
            'wind_range': (35, 60),
            'visibility_range': (3, 6)
        },
        'extreme_heat': {
            'conditions': ['clear', 'partly_cloudy'],
            'temp_range': (32, 40),
            'humidity_range': (35, 55),
            'wind_range': (10, 25),
            'visibility_range': (10, 10)
        },
        'fog': {
            'conditions': ['fog'],
            'temp_range': (10, 18),
            'humidity_range': (85, 98),
            'wind_range': (5, 15),
            'visibility_range': (1, 4)
        },
        'high_winds': {
            'conditions': ['cloudy', 'partly_cloudy'],
            'temp_range': (15, 25),
            'humidity_range': (50, 70),
            'wind_range': (50, 70),
            'visibility_range': (8, 10)
        },
        'clear': {
            'conditions': ['clear'],
            'temp_range': (20, 28),
            'humidity_range': (40, 60),
            'wind_range': (5, 15),
            'visibility_range': (10, 10)
        }
    }
    
    if forced_condition and forced_condition in weather_profiles:
        # Use forced condition profile
        profile = weather_profiles[forced_condition]
        conditions = random.choice(profile['conditions'])
        temperature = round(random.uniform(*profile['temp_range']), 1)
        humidity = random.randint(*profile['humidity_range'])
        wind_speed = random.randint(*profile['wind_range'])
        visibility = random.randint(*profile['visibility_range'])
    else:
        # Generate mostly favorable weather (80% clear/partly cloudy)
        temp_variation = random.uniform(-3, 5)
        temperature = round(base_temp + temp_variation, 1)
        humidity = random.randint(40, 70)
        wind_speed = random.randint(5, 20)
        
        # 80% chance of favorable conditions
        if random.random() < 0.8:
            conditions = random.choice(['clear', 'clear', 'partly_cloudy', 'partly_cloudy', 'cloudy'])
            visibility = 10
        else:
            # 20% chance of less favorable but still manageable conditions
            conditions = random.choice(['cloudy', 'light_rain'])
            visibility = 10 if conditions == 'cloudy' else 8
    
    precipitation = 'none'
    if 'rain' in conditions:
        precipitation = 'rain'
    elif conditions == 'snow':
        precipitation = 'snow'
    
    return {
        'temperature': temperature,
        'humidity': humidity,
        'conditions': conditions,
        'windSpeed': wind_speed,
        'precipitation': precipitation,
        'visibility': visibility
    }


def _generate_weather_alerts(waypoints: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate weather alerts based on waypoint conditions.
    
    Args:
        waypoints: List of waypoint dictionaries with weather data
    
    Returns:
        List of alert dictionaries
    """
    alerts = []
    
    for waypoint in waypoints:
        weather = waypoint['weather']
        
        # High temperature alert
        if weather['temperature'] > 30:
            alerts.append({
                'severity': 'warning',
                'type': 'high_temperature',
                'location': waypoint['coordinates'],
                'distanceFromCurrent': waypoint['distanceFromCurrent'],
                'estimatedTime': waypoint['estimatedArrivalTime'],
                'message': f"High ambient temperature ({weather['temperature']}°C) may stress cooling system",
                'recommendation': 'Monitor coolant levels closely and consider reducing speed'
            })
        
        # Severe weather alert
        if weather['conditions'] in ['heavy_rain', 'snow']:
            alerts.append({
                'severity': 'critical' if weather['conditions'] == 'snow' else 'warning',
                'type': 'severe_weather',
                'location': waypoint['coordinates'],
                'distanceFromCurrent': waypoint['distanceFromCurrent'],
                'estimatedTime': waypoint['estimatedArrivalTime'],
                'message': f"Severe weather conditions ({weather['conditions']}) ahead",
                'recommendation': 'Reduce speed and increase following distance. Consider alternate route if conditions worsen.'
            })
        
        # Low visibility alert
        if weather['visibility'] < 8:
            alerts.append({
                'severity': 'warning',
                'type': 'low_visibility',
                'location': waypoint['coordinates'],
                'distanceFromCurrent': waypoint['distanceFromCurrent'],
                'estimatedTime': waypoint['estimatedArrivalTime'],
                'message': f"Low visibility ({weather['visibility']}km) due to {weather['conditions']}",
                'recommendation': 'Use fog lights and reduce speed'
            })
        
        # High wind alert
        if weather['windSpeed'] > 50:
            alerts.append({
                'severity': 'warning',
                'type': 'high_winds',
                'location': waypoint['coordinates'],
                'distanceFromCurrent': waypoint['distanceFromCurrent'],
                'estimatedTime': waypoint['estimatedArrivalTime'],
                'message': f"High wind speeds ({weather['windSpeed']} km/h) expected",
                'recommendation': 'Reduce speed and be prepared for crosswinds'
            })
    
    return alerts


def _fetch_truck_data(truck_id: str, fleetops_api_url: str) -> Dict[str, Any]:
    """
    Fetch truck data from the FleetOps Cold-Chain Simulation Backend API.

    Args:
        truck_id: Unique identifier for the truck
        fleetops_api_url: Base URL of the FleetOps backend API

    Returns:
        Dictionary containing truck data from the API

    Raises:
        Exception: If API call fails or truck not found
    """
    # Construct the API endpoint
    api_url = f"{fleetops_api_url}/api/trucks/{truck_id}"
    
    try:
        # Make the API request
        response = requests.get(api_url, timeout=API_TIMEOUT)
        response.raise_for_status()
        
        truck_data = response.json()
        return truck_data
        
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to fetch truck data from FleetOps Cold-Chain Simulation Backend API: {str(e)}")


def _extract_route_data(truck_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract route-related data from truck API response.
    
    The FleetOps API returns data in this structure:
    - telemetry.currentLocation
    - currentTrip.destination
    - currentTrip.plannedRoute
    - currentTrip.estimatedArrival
    
    Args:
        truck_data: Raw truck data from API
    
    Returns:
        Dictionary containing extracted route data
    
    Raises:
        ValueError: If required fields are missing
    """
    try:
        # Extract current location from telemetry
        if 'telemetry' in truck_data and 'currentLocation' in truck_data['telemetry']:
            current_location = {
                'latitude': truck_data['telemetry']['currentLocation']['latitude'],
                'longitude': truck_data['telemetry']['currentLocation']['longitude']
            }
        elif 'currentLocation' in truck_data:
            # Fallback to top-level currentLocation if exists
            current_location = {
                'latitude': truck_data['currentLocation']['latitude'],
                'longitude': truck_data['currentLocation']['longitude']
            }
        else:
            raise ValueError("Missing currentLocation in truck data")
        
        # Extract destination from currentTrip
        if 'currentTrip' in truck_data and 'destination' in truck_data['currentTrip']:
            destination = {
                'latitude': truck_data['currentTrip']['destination']['latitude'],
                'longitude': truck_data['currentTrip']['destination']['longitude']
            }
        elif 'destination' in truck_data:
            # Fallback to top-level destination if exists
            destination = {
                'latitude': truck_data['destination']['latitude'],
                'longitude': truck_data['destination']['longitude']
            }
        else:
            raise ValueError("Missing destination in truck data")
        
        # Extract route path from currentTrip.plannedRoute
        route_path = []
        if 'currentTrip' in truck_data and 'plannedRoute' in truck_data['currentTrip']:
            for waypoint in truck_data['currentTrip']['plannedRoute']:
                wp = {
                    'latitude': waypoint['latitude'],
                    'longitude': waypoint['longitude']
                }
                # Include city if available
                if 'city' in waypoint:
                    wp['city'] = waypoint['city']
                route_path.append(wp)
        elif 'routePath' in truck_data and truck_data['routePath']:
            # Fallback to top-level routePath if exists
            for waypoint in truck_data['routePath']:
                wp = {
                    'latitude': waypoint['latitude'],
                    'longitude': waypoint['longitude']
                }
                if 'city' in waypoint:
                    wp['city'] = waypoint['city']
                route_path.append(wp)
        
        # If no route path provided, use destination as single waypoint
        if not route_path:
            route_path = [destination.copy()]
        
        # Extract estimated arrival from currentTrip
        estimated_arrival = None
        if 'currentTrip' in truck_data and 'estimatedArrival' in truck_data['currentTrip']:
            estimated_arrival = truck_data['currentTrip']['estimatedArrival']
        elif 'estimatedArrival' in truck_data:
            # Fallback to top-level estimatedArrival
            estimated_arrival = truck_data['estimatedArrival']
        elif 'eta' in truck_data:
            # Fallback to eta field
            estimated_arrival = truck_data['eta']
        
        if not estimated_arrival:
            # If no ETA provided, estimate based on current time + 4 hours
            estimated_arrival = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat() + 'Z'
        
        return {
            'current_location': current_location,
            'destination': destination,
            'route_path': route_path,
            'estimated_arrival': estimated_arrival
        }
        
    except KeyError as e:
        raise ValueError(f"Missing required field in truck data: {str(e)}")


@tool(
    name="get_route_weather_forecast",
    display_name="Get Route Weather Forecast",
    description="Fetches weather forecast along a truck route by retrieving truck data from FleetOps Cold-Chain Simulation Backend API. "
                "Only requires truck_id - all route information is automatically fetched from the API. "
                "Generates weather predictions for each waypoint in the route path with time-specific forecasts. "
                "Most waypoints have favorable weather conditions. Can inject specific weather conditions "
                "into 1-2 consecutive waypoints for testing scenarios. "
                "Useful for planning routes, identifying weather hazards, and optimizing delivery schedules.",
    expected_credentials=[{'app_id': 'fleetops_api', 'type': ConnectionType.KEY_VALUE}]
)
def get_route_weather_forecast(
    truck_id: str,
    inject_weather_condition: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get weather forecast along a truck route by fetching route data from FleetOps Cold-Chain Simulation Backend API.

    This tool automatically retrieves truck information including current location, destination,
    route path, and estimated arrival time from the FleetOps Cold-Chain Simulation Backend API.
    It then generates weather forecasts for each waypoint in the route path, determines the
    estimated arrival time at each waypoint based on average speed, and provides weather forecasts
    for each location. Most waypoints will have favorable weather conditions (clear/partly cloudy).
    It generates alerts for hazardous weather conditions that may affect the journey.

    The FleetOps API URL is provided via the 'fleetops_api' key-value connection
    (key: FLEETOPS_API_URL). For local testing, export:
        WXO_SECURITY_SCHEMA_fleetops_api=key_value_creds
        WXO_CONNECTION_fleetops_api_FLEETOPS_API_URL=https://<your-host>

    Optionally, you can inject a specific weather condition into 1-2 consecutive waypoints
    to simulate weather fronts or test specific scenarios.

    Args:
        truck_id (str): Unique identifier for the truck (e.g., 'TRUCK-001').
        inject_weather_condition (Optional[str]): Optional weather condition to inject. Options: 'heavy_rain', 'snow', 'extreme_heat', 'fog', 'high_winds', 'clear'.

    Returns:
        Dict[str, Any]: Weather forecast including waypoints, alerts, and summary for the truck route.
    """
    # Resolve API URL from connection — raises clearly if connection is not configured
    try:
        conn = connections.key_value('fleetops_api')
        fleetops_api_url = conn.FLEETOPS_API_URL
    except Exception as e:
        raise RuntimeError(
            "The 'fleetops_api' key-value connection is not configured. "
            "Set FLEETOPS_API_URL via: orchestrate connections set-credentials -a fleetops_api "
            "--env draft -e 'FLEETOPS_API_URL=https://<your-host>'"
        ) from e
    if not fleetops_api_url:
        raise RuntimeError(
            "FLEETOPS_API_URL is not set in the 'fleetops_api' connection. "
            "Run: orchestrate connections set-credentials -a fleetops_api "
            "--env draft -e 'FLEETOPS_API_URL=https://<your-host>'"
        )

    try:
        # Fetch truck data from FleetOps Cold-Chain Simulation Backend API
        truck_data = _fetch_truck_data(truck_id, fleetops_api_url)
        
        # Extract route information from truck data
        route_data = _extract_route_data(truck_data)
        current_location = route_data['current_location']
        destination = route_data['destination']
        route_path = route_data['route_path']
        estimated_arrival = route_data['estimated_arrival']
        
        # Validate extracted data
        if 'latitude' not in current_location or 'longitude' not in current_location:
            raise ValueError("current_location must have 'latitude' and 'longitude' keys")
        
        if 'latitude' not in destination or 'longitude' not in destination:
            raise ValueError("destination must have 'latitude' and 'longitude' keys")
        
        if not route_path or len(route_path) == 0:
            raise ValueError("route_path must contain at least one waypoint")
        
        # Parse estimated arrival time and ensure it's timezone-aware
        try:
            eta = datetime.fromisoformat(estimated_arrival.replace('Z', '+00:00'))
        except ValueError:
            eta = datetime.fromisoformat(estimated_arrival)
        
        # Ensure eta is timezone-aware
        if eta.tzinfo is None:
            eta = eta.replace(tzinfo=timezone.utc)
        
        # Make current_time timezone-aware to match eta
        current_time = datetime.now(timezone.utc)
        
        # Extract current coordinates
        current_lat = current_location['latitude']
        current_lon = current_location['longitude']
        
        # Calculate total distance from current position through all route path waypoints
        total_distance = 0.0
        cumulative_distances = [0.0]  # Distance from current position to each waypoint
        
        # Calculate distance from current position to first waypoint
        prev_lat, prev_lon = current_lat, current_lon
        for waypoint in route_path:
            if 'latitude' not in waypoint or 'longitude' not in waypoint:
                raise ValueError("Each waypoint in route_path must have 'latitude' and 'longitude' keys")
            
            distance = _haversine_distance(
                prev_lat, prev_lon,
                waypoint['latitude'], waypoint['longitude']
            )
            total_distance += distance
            cumulative_distances.append(total_distance)
            prev_lat, prev_lon = waypoint['latitude'], waypoint['longitude']
        
        # Calculate time remaining and average speed
        time_remaining = (eta - current_time).total_seconds() / 3600  # hours
        if time_remaining <= 0:
            time_remaining = 1  # Minimum 1 hour to avoid division by zero
        
        average_speed = total_distance / time_remaining  # km/h
        
        # Determine injection zone if weather condition is specified
        num_waypoints = len(route_path)
        injection_zone = None
        if inject_weather_condition and num_waypoints >= 2:
            # Randomly select a continuous zone of 1-2 waypoints
            zone_length = random.randint(1, min(2, num_waypoints))
            # Don't start at first waypoint, leave some buffer
            max_start = num_waypoints - zone_length
            zone_start_idx = random.randint(1, max(1, max_start)) if max_start > 0 else 0
            zone_end_idx = zone_start_idx + zone_length - 1
            
            injection_zone = {
                'start_idx': zone_start_idx,
                'end_idx': zone_end_idx,
                'condition': inject_weather_condition
            }
        
        # Generate weather forecasts for each waypoint in the route path
        waypoints = []
        for i, waypoint in enumerate(route_path):
            distance_from_current = cumulative_distances[i + 1]  # +1 because cumulative_distances[0] is 0
            
            coords = {
                'latitude': round(waypoint['latitude'], 6),
                'longitude': round(waypoint['longitude'], 6)
            }
            
            # Include city if provided
            if 'city' in waypoint:
                coords['city'] = waypoint['city']
            
            # Calculate estimated arrival time at this waypoint
            hours_to_waypoint = distance_from_current / average_speed
            waypoint_eta = current_time + timedelta(hours=hours_to_waypoint)
            
            # Check if this waypoint is in the injection zone
            forced_condition = None
            if injection_zone and injection_zone['start_idx'] <= i <= injection_zone['end_idx']:
                forced_condition = injection_zone['condition']
            
            # Generate mock weather for this waypoint
            weather = _generate_mock_weather(distance_from_current, forced_condition=forced_condition)
            
            waypoints.append({
                'distanceFromCurrent': round(distance_from_current, 1),
                'coordinates': coords,
                'estimatedArrivalTime': waypoint_eta.isoformat() + 'Z',
                'weather': weather
            })
        
        # Generate alerts based on weather conditions
        alerts = _generate_weather_alerts(waypoints)
        
        # Generate summary
        critical_alerts = len([a for a in alerts if a['severity'] == 'critical'])
        warning_alerts = len([a for a in alerts if a['severity'] == 'warning'])
        
        if critical_alerts > 0:
            overall_conditions = 'hazardous'
        elif warning_alerts > 2:
            overall_conditions = 'challenging'
        elif warning_alerts > 0:
            overall_conditions = 'caution_advised'
        else:
            overall_conditions = 'favorable'
        
        result = {
            'truckId': truck_id,
            'generatedAt': current_time.isoformat() + 'Z',
            'currentLocation': current_location,
            'destination': destination,
            'totalDistance': round(total_distance, 1),
            'averageSpeed': round(average_speed, 1),
            'waypoints': waypoints,
            'alerts': alerts,
            'summary': {
                'overallConditions': overall_conditions,
                'criticalAlerts': critical_alerts,
                'warnings': warning_alerts,
                'totalWaypoints': len(waypoints)
            }
        }
        
        # Add injection zone info if applicable
        if injection_zone:
            start_distance = waypoints[injection_zone['start_idx']]['distanceFromCurrent']
            end_distance = waypoints[injection_zone['end_idx']]['distanceFromCurrent']
            result['injectedWeatherZone'] = {
                'condition': injection_zone['condition'],
                'startDistance': start_distance,
                'endDistance': end_distance,
                'waypointsAffected': injection_zone['end_idx'] - injection_zone['start_idx'] + 1
            }
        
        return result
        
    except Exception as e:
        return {
            'error': True,
            'message': f"Failed to generate weather forecast: {str(e)}",
            'truckId': truck_id,
            'generatedAt': datetime.now(timezone.utc).isoformat() + 'Z'
        }

# Made with Bob
