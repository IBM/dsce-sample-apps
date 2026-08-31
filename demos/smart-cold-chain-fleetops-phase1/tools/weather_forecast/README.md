# Weather Forecast Tool

A watsonx Orchestrate Python tool that provides weather forecasts along truck routes based on provided route path waypoints.

## Overview

This tool generates weather forecasts for each waypoint in a provided route path, determines the estimated arrival time at each waypoint based on average speed, and provides weather forecasts for each location. It also generates alerts for hazardous weather conditions that may affect the journey.

## Features

- **Route Path Based Forecasts**: Generates weather forecasts for specific waypoints in the route path
- **Time-based Forecasts**: Provides weather predictions for specific arrival times at each waypoint
- **Weather Alerts**: Identifies and alerts on hazardous conditions including:
  - High temperatures (>30°C) that may stress cooling systems
  - Severe weather (heavy rain, snow)
  - Low visibility conditions
  - High wind speeds (>50 km/h)
- **Mock Data**: Currently uses simulated weather data for demonstration purposes

## Tool Parameters

### Input

- `truck_id` (str): Unique identifier for the truck
- `current_location` (Dict[str, float]): Current location with 'latitude' and 'longitude' keys. Example: `{'latitude': 42.36, 'longitude': -71.05}`
- `destination` (Dict[str, float]): Destination location with 'latitude' and 'longitude' keys. Example: `{'latitude': 40.71, 'longitude': -74.00}`
- `route_path` (List[Dict[str, Any]]): List of waypoints defining the route path. Each waypoint should have 'latitude' and 'longitude' keys. Optional 'city' key can be included. Example: `[{'latitude': 42.0, 'longitude': -71.5, 'city': 'Providence'}, ...]`
- `estimated_arrival` (str): Estimated arrival time at destination in ISO 8601 format (e.g., '2026-04-30T10:00:00Z')
- `inject_weather_condition` (str, optional): Weather condition to inject into a random zone along the route. Options: `'heavy_rain'`, `'snow'`, `'extreme_heat'`, `'fog'`, `'high_winds'`, `'clear'`

### Output

Returns a dictionary containing:

```json
{
  "truckId": "TRUCK-001",
  "generatedAt": "2026-04-30T06:00:00Z",
  "currentLocation": {
    "latitude": 42.36,
    "longitude": -71.05
  },
  "destination": {
    "latitude": 40.71,
    "longitude": -74.00
  },
  "totalDistance": 306.5,
  "averageSpeed": 80.5,
  "waypoints": [
    {
      "distanceFromCurrent": 50,
      "coordinates": {
        "latitude": 41.8234,
        "longitude": -72.1234,
        "city": "New Haven"
      },
      "estimatedArrivalTime": "2026-04-30T06:37:00Z",
      "weather": {
        "temperature": 22.5,
        "humidity": 65,
        "conditions": "partly_cloudy",
        "windSpeed": 15,
        "precipitation": "none",
        "visibility": 10
      }
    }
  ],
  "alerts": [
    {
      "severity": "warning",
      "type": "high_temperature",
      "location": {"latitude": 41.2345, "longitude": -73.4567},
      "distanceFromCurrent": 150,
      "estimatedTime": "2026-04-30T08:00:00Z",
      "message": "High ambient temperature (32°C) may stress cooling system",
      "recommendation": "Monitor coolant levels closely and consider reducing speed"
    }
  ],
  "summary": {
    "overallConditions": "favorable",
    "criticalAlerts": 0,
    "warnings": 1,
    "totalWaypoints": 6
  },
  "injectedWeatherZone": {
    "condition": "heavy_rain",
    "startDistance": 100,
    "endDistance": 200,
    "waypointsAffected": 3
  }
}
```

**Note:** The `injectedWeatherZone` field only appears when `inject_weather_condition` parameter is provided.

## Installation

### Prerequisites

- Python 3.8 or higher
- IBM watsonx Orchestrate ADK installed
- Active watsonx Orchestrate environment

### Import the Tool

```bash
# Import the tool into watsonx Orchestrate
orchestrate tools import -k python -f weather_forecast_tool.py
```

## Usage

### In an Agent

The tool can be called by watsonx Orchestrate agents to get weather forecasts along routes:

```python
# Example 1: Random weather (default)
result = get_route_weather_forecast(
    truck_id="TRUCK-001",
    current_location={'latitude': 42.1234, 'longitude': -71.5678},
    destination={'latitude': 40.7128, 'longitude': -74.0060},
    route_path=[
        {'latitude': 42.0, 'longitude': -72.0, 'city': 'Hartford'},
        {'latitude': 41.5, 'longitude': -72.5, 'city': 'New Haven'},
        {'latitude': 41.0, 'longitude': -73.0, 'city': 'Bridgeport'},
        {'latitude': 40.7128, 'longitude': -74.0060, 'city': 'New York'}
    ],
    estimated_arrival="2026-04-30T10:00:00Z"
)

# Example 2: Inject specific weather condition
result = get_route_weather_forecast(
    truck_id="TRUCK-002",
    current_location={'latitude': 42.1234, 'longitude': -71.5678},
    destination={'latitude': 40.7128, 'longitude': -74.0060},
    route_path=[
        {'latitude': 42.0, 'longitude': -72.0},
        {'latitude': 41.5, 'longitude': -72.5},
        {'latitude': 41.0, 'longitude': -73.0},
        {'latitude': 40.7128, 'longitude': -74.0060}
    ],
    estimated_arrival="2026-04-30T10:00:00Z",
    inject_weather_condition="heavy_rain"  # Inject heavy rain zone
)
```

### Use Cases

1. **Route Planning**: Identify weather hazards before departure
2. **Real-time Monitoring**: Check weather conditions along active routes
3. **Delivery Optimization**: Adjust schedules based on weather forecasts
4. **Safety Alerts**: Warn drivers of dangerous conditions ahead
5. **Cooling System Management**: Alert when high temperatures may affect refrigerated cargo

## Weather Injection Feature

### How It Works

When you specify `inject_weather_condition`, the tool:
1. Randomly selects a continuous zone of 1-2 consecutive waypoints from the route path
2. Applies the specified weather condition to that zone
3. Generates random weather for all other waypoints
4. Returns details about the injected zone in the response

This creates realistic "weather fronts" where conditions change along the route.

### Supported Injection Conditions

| Condition | Temperature | Humidity | Wind | Visibility | Alerts Triggered |
|-----------|-------------|----------|------|------------|------------------|
| `heavy_rain` | 15-20°C | 75-95% | 25-45 km/h | 4-8 km | Severe weather, Low visibility |
| `snow` | -5 to 5°C | 70-90% | 35-60 km/h | 3-6 km | Critical weather, Low visibility |
| `extreme_heat` | 32-40°C | 35-55% | 10-25 km/h | 10 km | High temperature |
| `fog` | 10-18°C | 85-98% | 5-15 km/h | 1-4 km | Low visibility |
| `high_winds` | 15-25°C | 50-70% | 50-70 km/h | 8-10 km | High winds |
| `clear` | 20-28°C | 40-60% | 5-15 km/h | 10 km | None |

### Use Cases for Weather Injection

1. **Testing Alert Systems**: Inject `extreme_heat` to verify cooling system alerts trigger correctly
2. **Training Scenarios**: Inject `snow` to train agents on winter weather response
3. **Demo Purposes**: Inject `heavy_rain` to showcase severe weather handling
4. **Route Planning**: Inject various conditions to test route optimization logic

## Weather Conditions

The tool simulates various weather conditions:

- **clear**: Clear skies
- **partly_cloudy**: Partially cloudy
- **cloudy**: Overcast
- **light_rain**: Light rain
- **rain**: Moderate rain
- **heavy_rain**: Heavy rain (triggers alert)
- **fog**: Foggy conditions (triggers visibility alert)
- **snow**: Snow (triggers critical alert)

## Alert Types

1. **high_temperature**: Ambient temperature >30°C
2. **severe_weather**: Heavy rain or snow conditions
3. **low_visibility**: Visibility <8km
4. **high_winds**: Wind speed >50 km/h

## Future Enhancements

- Integration with real weather APIs (OpenWeatherMap, Weather.com)
- Historical weather data analysis
- Route optimization based on weather
- Integration with traffic data
- Support for multiple route alternatives

## License

Part of the Smart Cold-Chain IoT Simulator project.