#!/usr/bin/env python3
"""
FleetOps TTM Forecasting Service
Implements 4 forecasting use cases using Granite TTM model
"""

import os
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration from .env
FLEETOPS_API_BASE_URL = os.getenv("FLEETOPS_API_BASE_URL", "http://localhost:3000")
CONTEXT_LENGTH = int(os.getenv("CONTEXT_LENGTH", "512"))
PREDICTION_LENGTH = int(os.getenv("PREDICTION_LENGTH", "96"))
FREQUENCY = os.getenv("FREQUENCY", "1min")
TTM_MODEL_PATH = os.getenv("TTM_MODEL_PATH", "ibm-granite/granite-timeseries-ttm-v1")
USE_TTM_MODEL = os.getenv("USE_TTM_MODEL", "False").lower() == "true"

# Import TTM model wrapper
from services.ttm_model import get_ttm_model


class FleetOpsForecastingService:
    """Main forecasting service for FleetOps cold-chain management"""
    
    def __init__(self):
        self.ttm_model = None
        self.fleet_data = None
        
    def initialize_model(self):
        """
        Initialize TTM model
        
        This is where the TTM model gets loaded:
        1. Gets the global TTM model instance
        2. Model is loaded from HuggingFace (if USE_TTM_MODEL=true)
        3. Model is ready for forecasting
        """
        print("🔄 Initializing TTM model...")
        self.ttm_model = get_ttm_model()
        
        if self.ttm_model.is_loaded():
            print("✅ TTM Model initialized and ready")
        else:
            print("⚠️  Using mock forecasts (TTM model not enabled)")
        
    def fetch_fleet_data(self) -> Dict:
        """Fetch all FleetOps data from API"""
        try:
            response = requests.get(f"{FLEETOPS_API_BASE_URL}/api/persistence/data", timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'success':
                self.fleet_data = data['data']
                return self.fleet_data
            else:
                raise Exception("API returned error status")
                
        except Exception as e:
            print(f"❌ Error fetching fleet data: {e}")
            # Return mock data for development
            return self._get_mock_data()
    
    def _get_mock_data(self) -> Dict:
        """Mock data for development/testing"""
        return {
            'trucks': [],
            'weather': [],
            'stations': [],
            'alerts': [],
            'incidents': []
        }
    
    # ========================================================================
    # USE CASE 1: Temperature Breach Prediction
    # ========================================================================
    
    def forecast_temperature_breach(self, truck_id: str, frequency: Optional[str] = None) -> Dict:
        """
        Predict temperature breaches for a specific truck
        Returns forecast, risk assessment, and recommendations
        
        Args:
            truck_id: Truck identifier
            frequency: Optional time series frequency (defaults to FREQUENCY from .env)
        """
        freq = frequency or FREQUENCY
        if not self.fleet_data:
            self.fetch_fleet_data()
        
        # Find truck
        truck = next((t for t in self.fleet_data['trucks'] 
                     if t['truckId'] == truck_id), None)
        
        if not truck:
            return {'error': f'Truck {truck_id} not found'}
        
        # Extract current state
        current_temp = truck['telemetry']['temperature']
        critical_threshold = truck['cargo']['criticalThreshold']
        cargo_value = truck['cargo']['value']
        cargo_type = truck['cargo']['type']
        
        # Simulate historical data (in production, query actual history)
        historical_df = self._simulate_temperature_history(current_temp, hours=8, freq=freq)
        
        # Generate forecast (placeholder - will use TTM model)
        predicted_temps, predicted_timestamps = self._generate_temperature_forecast(
            historical_df, current_temp, critical_threshold, freq=freq
        )
        
        # Assess breach risk
        risk_assessment = self._assess_breach_risk(
            predicted_temps, critical_threshold, cargo_value, current_temp
        )
        
        return {
            'truck_id': truck_id,
            'cargo_type': cargo_type,
            'cargo_value': cargo_value,
            'current_temperature': current_temp,
            'critical_threshold': critical_threshold,
            'frequency': freq,
            'historical': {
                'timestamps': historical_df['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S').tolist(),
                'temperatures': historical_df['temperature'].tolist()
            },
            'forecast': {
                'timestamps': [ts.strftime('%Y-%m-%d %H:%M:%S') for ts in predicted_timestamps],
                'temperatures': predicted_temps.tolist()
            },
            'risk_assessment': risk_assessment
        }
    
    def _simulate_temperature_history(self, current_temp: float, hours: int = 8, freq: str = None) -> pd.DataFrame:
        """Simulate historical temperature data"""
        freq = freq or FREQUENCY
        # Use CONTEXT_LENGTH to ensure we have enough points for TTM model
        num_points = CONTEXT_LENGTH
        timestamps = pd.date_range(end=pd.Timestamp.now(), periods=num_points, freq=freq)
        
        # Generate realistic temperature variations
        trend = np.linspace(current_temp - 2, current_temp, num_points)
        noise = np.random.normal(0, 0.5, num_points)
        spikes = np.random.choice([0, 0, 0, 0, 1], num_points) * np.random.uniform(-1, 1, num_points)
        
        temperatures = trend + noise + spikes
        
        return pd.DataFrame({
            'timestamp': timestamps,
            'temperature': temperatures
        })
    
    def _generate_temperature_forecast(self, historical_df: pd.DataFrame,
                                      current_temp: float,
                                      critical_threshold: float,
                                      freq: str = None) -> Tuple[np.ndarray, List]:
        """
        Generate temperature forecast using TTM model
        
        This is where TTM model is INVOKED for prediction:
        1. Prepare historical data in TTM format
        2. Call ttm_model.forecast() to get predictions
        3. Return predicted temperatures and timestamps
        
        Args:
            historical_df: Historical temperature data
            current_temp: Current temperature
            critical_threshold: Critical temperature threshold
            freq: Time series frequency (defaults to FREQUENCY from .env)
        """
        freq = freq or FREQUENCY
        
        # Generate future timestamps starting from NOW (not from last historical point)
        # This ensures forecast extends into the future
        now = pd.Timestamp.now()
        future_timestamps = pd.date_range(
            start=now,
            periods=PREDICTION_LENGTH,
            freq=freq
        )
        
        # Try to use real TTM model if available
        if self.ttm_model and self.ttm_model.is_loaded():
            try:
                # Prepare data for TTM model
                ttm_input = historical_df.copy()
                ttm_input['id'] = 'temperature'
                ttm_input['value'] = ttm_input['temperature']
                
                # INVOKE TTM MODEL HERE
                print(f"   🔮 Invoking TTM model for temperature forecast...")
                predicted_temps = self.ttm_model.forecast(ttm_input)
                
                print(f"   ✅ TTM forecast complete: {len(predicted_temps)} predictions")
                return predicted_temps, future_timestamps.tolist()
                
            except Exception as e:
                print(f"   ⚠️  TTM forecast failed: {e}, using mock forecast")
        
        # Fallback: Mock forecast for development
        print(f"   📊 Using mock forecast (TTM not available)")
        if critical_threshold < 0:  # Frozen cargo
            drift = np.linspace(0, 5, PREDICTION_LENGTH)
        else:  # Fresh cargo
            drift = np.linspace(0, 3, PREDICTION_LENGTH)
        
        noise = np.random.normal(0, 0.3, PREDICTION_LENGTH)
        predicted_temps = current_temp + drift + noise
        
        return predicted_temps, future_timestamps.tolist()
    
    def _assess_breach_risk(self, predicted_temps: np.ndarray, 
                           critical_threshold: float,
                           cargo_value: float,
                           current_temp: float) -> Dict:
        """Assess risk of temperature breach"""
        
        # Check for breach
        if critical_threshold < 0:  # Frozen cargo
            breach_mask = predicted_temps > critical_threshold
        else:  # Fresh cargo
            breach_mask = predicted_temps > critical_threshold
        
        breach_indices = np.where(breach_mask)[0]
        
        if len(breach_indices) == 0:
            return {
                'risk_score': 0,
                'time_to_breach': None,
                'action': 'NORMAL',
                'message': '✅ No breach predicted in next 96 minutes',
                'recommendations': ['Continue normal monitoring']
            }
        
        # Calculate risk metrics
        first_breach_idx = breach_indices[0]
        time_to_breach = first_breach_idx
        temp_delta = abs(predicted_temps[first_breach_idx] - critical_threshold)
        
        # Risk score calculation
        time_factor = max(0, 100 - time_to_breach)
        temp_factor = min(100, (temp_delta / abs(critical_threshold)) * 100)
        value_factor = min(100, (cargo_value / 500000) * 100)
        
        risk_score = int(0.5 * time_factor + 0.3 * temp_factor + 0.2 * value_factor)
        
        # Determine action level
        if time_to_breach < 30 or risk_score > 80:
            action = 'CRITICAL'
            recommendations = [
                '🚨 IMMEDIATE ACTION REQUIRED',
                'Activate emergency cooling',
                'Find nearest station with emergency cooling',
                'Alert driver and dispatch',
                f'Potential loss: ${cargo_value:,.2f}'
            ]
        elif time_to_breach < 60 or risk_score > 50:
            action = 'WARNING'
            recommendations = [
                '⚠️ Enhanced monitoring required',
                'Prepare emergency cooling activation',
                'Check route for alternative stations',
                'Monitor weather conditions'
            ]
        elif time_to_breach < 90:
            action = 'MONITOR'
            recommendations = [
                '👀 Increased monitoring',
                'Continue current route',
                'Prepare contingency plans'
            ]
        else:
            action = 'NORMAL'
            recommendations = ['✅ Continue normal operations']
        
        return {
            'risk_score': risk_score,
            'time_to_breach': int(time_to_breach),
            'action': action,
            'message': f'{action}: Breach predicted in {time_to_breach} minutes',
            'predicted_breach_temp': float(predicted_temps[first_breach_idx]),
            'temp_delta': float(temp_delta),
            'recommendations': recommendations
        }
    
    # ========================================================================
    # USE CASE 2: Station Availability Forecast
    # ========================================================================
    
    def forecast_station_availability(self, station_id: Optional[str] = None, frequency: Optional[str] = None) -> Dict:
        """
        Predict station bay availability for next 4 hours
        
        Args:
            station_id: Optional station ID to filter
            frequency: Optional time series frequency (defaults to FREQUENCY from .env)
        """
        freq = frequency or FREQUENCY
        if not self.fleet_data:
            self.fetch_fleet_data()
        
        # Filter stations
        if station_id:
            stations = [s for s in self.fleet_data['stations']
                       if s['stationId'] == station_id]
            if not stations:
                # Station not found - return error
                return {
                    'error': f'Station {station_id} not found',
                    'timestamp': datetime.now().isoformat(),
                    'forecast_horizon': '4 hours',
                    'frequency': freq,
                    'stations': []
                }
        else:
            # Get top 5 busiest stations (least available bays = busiest)
            stations = sorted(self.fleet_data['stations'],
                            key=lambda x: x.get('baysAvailable', 10),
                            reverse=False)[:5]
        
        forecasts = []
        for station in stations:
            # Generate forecast for this station
            forecast = self._generate_station_forecast(station, freq=freq)
            forecasts.append(forecast)
        
        return {
            'timestamp': datetime.now().isoformat(),
            'forecast_horizon': '4 hours',
            'frequency': freq,
            'stations': forecasts
        }
    
    def _generate_station_forecast(self, station: Dict, freq: str = None) -> Dict:
        """Generate availability forecast for a single station"""
        freq = freq or FREQUENCY
        bays_available = station.get('baysAvailable', 0)
        total_bays = station.get('totalBays', 10)
        current_occupancy = total_bays - bays_available
        
        # Simulate forecast (in production, use TTM model)
        forecast_points = 240  # 4 hours at 1-minute intervals
        timestamps = pd.date_range(
            start=pd.Timestamp.now(),
            periods=forecast_points,
            freq=freq
        )
        
        # Simulate occupancy pattern (daily cycle)
        hour = datetime.now().hour
        base_occupancy = current_occupancy
        
        # Peak hours: 8-10 AM, 2-4 PM
        occupancy_forecast = []
        for i, ts in enumerate(timestamps):
            hour_of_day = ts.hour
            minute_offset = i / 60.0
            
            # Simulate daily pattern
            if 8 <= hour_of_day < 10 or 14 <= hour_of_day < 16:
                # Peak hours - higher occupancy
                trend = min(total_bays, base_occupancy + np.random.randint(0, 3))
            elif 12 <= hour_of_day < 14 or 18 <= hour_of_day < 20:
                # Moderate hours
                trend = base_occupancy + np.random.randint(-1, 2)
            else:
                # Off-peak hours
                trend = max(0, base_occupancy + np.random.randint(-2, 1))
            
            occupancy_forecast.append(max(0, min(total_bays, trend)))
        
        # Calculate availability
        availability_forecast = [total_bays - occ for occ in occupancy_forecast]
        
        # Calculate utilization percentage
        utilization_forecast = [(occ / total_bays * 100) if total_bays > 0 else 0 for occ in occupancy_forecast]
        
        # Assess congestion risk
        avg_availability = np.mean(availability_forecast)
        congestion_risk = 'HIGH' if avg_availability < 2 else 'MEDIUM' if avg_availability < 5 else 'LOW'
        
        return {
            'station_id': station.get('stationId', 'unknown'),
            'station_name': station.get('name', 'Unknown Station'),
            'region': station.get('region', 'Unknown'),
            'current_available': bays_available,
            'total_bays': total_bays,
            'forecast': {
                'timestamps': [ts.strftime('%Y-%m-%d %H:%M:%S') for ts in timestamps[::15]],  # Every 15 min
                'available_bays': availability_forecast[::15],
                'utilization_percent': utilization_forecast[::15]
            },
            'recommendations': self._get_station_recommendations(congestion_risk, station)
        }
    
    def _get_station_recommendations(self, risk: str, station: Dict) -> List[str]:
        """Generate recommendations based on congestion risk"""
        if risk == 'HIGH':
            return [
                f'⚠️ High congestion expected at {station["name"]}',
                'Consider alternative stations',
                'Schedule deliveries during off-peak hours',
                'Implement reservation system'
            ]
        elif risk == 'MEDIUM':
            return [
                f'Moderate congestion at {station["name"]}',
                'Monitor bay availability',
                'Have backup station ready'
            ]
        else:
            return [
                f'✅ Good availability at {station["name"]}',
                'Normal operations'
            ]
    
    # ========================================================================
    # USE CASE 3: Weather Impact Forecast
    # ========================================================================
    
    def forecast_weather_impact(self, truck_id: str, frequency: Optional[str] = None) -> Dict:
        """
        Predict weather impact on truck operations
        
        Args:
            truck_id: Truck identifier
            frequency: Optional time series frequency (defaults to FREQUENCY from .env)
        """
        if not self.fleet_data:
            self.fetch_fleet_data()
        
        # Find truck
        truck = next((t for t in self.fleet_data['trucks']
                     if t['truckId'] == truck_id), None)
        
        if not truck:
            return {'error': f'Truck {truck_id} not found'}
        
        # Extract location data from truck telemetry and trip
        telemetry = truck.get('telemetry', {})
        current_trip = truck.get('currentTrip', {})
        
        current_location = telemetry.get('currentLocation', {})
        destination = current_trip.get('destination', {})
        planned_route = current_trip.get('plannedRoute', [])
        
        # Generate weather forecast along the route
        weather_forecast = self._generate_weather_forecast(
            current_location,
            destination,
            planned_route
        )
        
        # Assess impact
        impact_assessment = self._assess_weather_impact(weather_forecast, truck)
        
        return {
            'truck_id': truck_id,
            'current_location': current_location,
            'destination': destination,
            'weather_forecast': weather_forecast,
            'impact_assessment': impact_assessment
        }
    
    def _generate_weather_forecast(self, current_loc: Dict, destination: Dict,
                                   planned_route: List[Dict] = None) -> Dict:
        """
        Generate weather forecast along route
        
        Args:
            current_loc: Current location with latitude/longitude
            destination: Destination with latitude/longitude
            planned_route: List of waypoints along the planned route
        """
        # Simulate weather forecast (in production, use weather API + TTM)
        forecast_hours = 6
        timestamps = pd.date_range(
            start=pd.Timestamp.now(),
            periods=forecast_hours,
            freq='1h'  # Use lowercase 'h' for hourly (pandas requirement)
        )
        
        # Extract location info for context
        current_lat = current_loc.get('latitude', 0)
        current_lon = current_loc.get('longitude', 0)
        dest_lat = destination.get('latitude', 0)
        dest_lon = destination.get('longitude', 0)
        
        # Get route cities for context (if available)
        route_cities = []
        if planned_route:
            route_cities = [wp.get('city', 'Unknown') for wp in planned_route if wp.get('city')]
        
        # Simulate weather conditions along the route
        # In production, this would call a weather API for each waypoint
        base_temp = 25  # Base temperature
        conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Rain', 'Heavy Rain']
        
        hourly_forecast = []
        for i, ts in enumerate(timestamps):
            # Simulate temperature variation based on time of day
            hour = ts.hour
            if 6 <= hour < 12:  # Morning
                temp_modifier = np.random.uniform(-3, 2)
            elif 12 <= hour < 18:  # Afternoon (warmer)
                temp_modifier = np.random.uniform(0, 5)
            else:  # Evening/Night (cooler)
                temp_modifier = np.random.uniform(-5, 0)
            
            temp = base_temp + temp_modifier
            
            # Simulate precipitation
            precip_chance = np.random.uniform(0, 100)
            condition = np.random.choice(conditions, p=[0.4, 0.3, 0.2, 0.08, 0.02])
            
            # Get approximate location along route for this hour
            route_progress = i / forecast_hours
            if route_cities and len(route_cities) > 1:
                city_index = min(int(route_progress * len(route_cities)), len(route_cities) - 1)
                location_context = route_cities[city_index]
            else:
                location_context = f"En route ({current_lat:.2f}, {current_lon:.2f})"
            
            hourly_forecast.append({
                'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
                'temperature': round(temp, 1),
                'condition': condition,
                'precipitation_chance': round(precip_chance, 1),
                'wind_speed': round(np.random.uniform(5, 25), 1),
                'location': location_context
            })
        
        return {
            'forecast_start': timestamps[0].strftime('%Y-%m-%d %H:%M:%S'),
            'forecast_end': timestamps[-1].strftime('%Y-%m-%d %H:%M:%S'),
            'route_summary': {
                'current_location': f"{current_lat:.4f}, {current_lon:.4f}",
                'destination': f"{dest_lat:.4f}, {dest_lon:.4f}",
                'waypoints': len(planned_route) if planned_route else 0,
                'cities': route_cities if route_cities else []
            },
            'hourly': hourly_forecast
        }
    
    def _assess_weather_impact(self, weather_forecast: Dict, truck: Dict) -> Dict:
        """Assess weather impact on operations"""
        hourly = weather_forecast['hourly']
        
        # Check for adverse conditions
        has_rain = any(h['condition'] in ['Rain', 'Heavy Rain'] for h in hourly)
        high_wind = any(h['wind_speed'] > 20 for h in hourly)
        extreme_temp = any(h['temperature'] > 35 or h['temperature'] < 0 for h in hourly)
        
        # Calculate risk score
        risk_score = 0
        if has_rain:
            risk_score += 30
        if high_wind:
            risk_score += 25
        if extreme_temp:
            risk_score += 45
        
        # Determine impact level
        if risk_score > 70:
            impact = 'HIGH'
            recommendations = [
                '🚨 Severe weather expected',
                'Consider delaying departure',
                'Activate enhanced monitoring',
                'Prepare emergency protocols'
            ]
        elif risk_score > 40:
            impact = 'MEDIUM'
            recommendations = [
                '⚠️ Adverse weather conditions',
                'Reduce speed and increase following distance',
                'Monitor temperature more frequently',
                'Have contingency plans ready'
            ]
        else:
            impact = 'LOW'
            recommendations = [
                '✅ Favorable weather conditions',
                'Normal operations',
                'Continue monitoring'
            ]
        
        return {
            'impact_level': impact,
            'risk_score': risk_score,
            'has_rain': has_rain,
            'high_wind': high_wind,
            'extreme_temperature': extreme_temp,
            'recommendations': recommendations
        }
    
    # ========================================================================
    # USE CASE 4: Fleet Optimization
    # ========================================================================
    
    def forecast_fleet_optimization(self, frequency: Optional[str] = None) -> Dict:
        """
        Holistic fleet-wide risk assessment and optimization
        
        Args:
            frequency: Optional time series frequency (defaults to FREQUENCY from .env)
        """
        if not self.fleet_data:
            self.fetch_fleet_data()
        
        # Analyze each truck
        truck_assessments = []
        for truck in self.fleet_data['trucks']:
            assessment = self._assess_truck_risk(truck)
            truck_assessments.append(assessment)
        
        # Sort by risk score
        truck_assessments.sort(key=lambda x: x['risk_score'], reverse=True)
        
        # Generate fleet-wide recommendations
        fleet_recommendations = self._generate_fleet_recommendations(truck_assessments)
        
        # Calculate fleet metrics
        total_cargo_value = sum(t['cargo']['value'] for t in self.fleet_data['trucks'])
        at_risk_cargo_value = sum(a['cargo_value'] for a in truck_assessments if a['risk_score'] > 50)
        high_priority_trucks = len([a for a in truck_assessments if a['risk_score'] > 70])
        average_risk_score = int(sum(a['risk_score'] for a in truck_assessments) / len(truck_assessments)) if truck_assessments else 0
        
        # Convert truck assessments to truck insights format
        truck_insights = []
        for assessment in truck_assessments:  # Process ALL trucks
            # Get weather risk (simplified)
            weather_risk = 30  # Placeholder
            
            # Get FORECAST-BASED temperature risk (AI prediction)
            truck_id = assessment['truck_id']
            
            # Try to get forecast risk, with detailed error handling
            temperature_risk = None
            try:
                temp_forecast = self.forecast_temperature_breach(truck_id, frequency)
                
                # Check if we got valid forecast data
                if isinstance(temp_forecast, dict):
                    if 'risk_assessment' in temp_forecast:
                        if 'risk_score' in temp_forecast['risk_assessment']:
                            temperature_risk = temp_forecast['risk_assessment']['risk_score']
                            print(f"✅ {truck_id}: Got forecast risk = {temperature_risk}%")
                        else:
                            print(f"⚠️ {truck_id}: risk_assessment has no risk_score key")
                    else:
                        print(f"⚠️ {truck_id}: No risk_assessment in forecast response")
                else:
                    print(f"⚠️ {truck_id}: Forecast response is not a dict: {type(temp_forecast)}")
                    
            except Exception as e:
                print(f"❌ {truck_id}: Forecast API call failed: {e}")
            
            # Fallback: Calculate from current temperature if forecast failed
            if temperature_risk is None:
                print(f"⚠️ {truck_id}: Using fallback calculation")
                temp = assessment['temperature']
                threshold = assessment['critical_threshold']
                
                if threshold < 0:  # Frozen cargo
                    if temp > threshold:
                        temp_delta = temp - threshold
                        temperature_risk = min(100, int((temp_delta / abs(threshold)) * 100))
                    else:
                        temperature_risk = 0
                else:  # Fresh cargo
                    if temp > threshold:
                        temp_delta = temp - threshold
                        temperature_risk = min(100, int((temp_delta / threshold) * 100))
                    else:
                        temperature_risk = 0
                print(f"   Fallback result: {temperature_risk}%")
            
            # Recalculate composite risk using ACTUAL temperature risk
            # Temperature: 40%, Weather: 30%, Cargo Value: 20%, Route: 10%
            cargo_value = assessment['cargo_value']
            value_risk = min(100, (cargo_value / 500000) * 100)
            # route_risk = 30  # Placeholder for route complexity
            
            composite_risk_score = int(
                0.5 * temperature_risk +
                0.3 * weather_risk +
                0.2 * value_risk 
                # +
                # 0.1 * route_risk
            )
            
            # Update priority based on composite risk
            if composite_risk_score > 70:
                priority = 'HIGH'
            elif composite_risk_score > 40:
                priority = 'MEDIUM'
            else:
                priority = 'LOW'
            
            # Calculate time to breach (simplified)
            temp_margin = abs(assessment['temperature'] - assessment['critical_threshold'])
            time_to_breach = int(temp_margin * 10) if composite_risk_score > 50 else None
            
            # Determine recommended action based on composite risk
            if composite_risk_score > 70:
                recommended_action = "Immediate intervention required - reroute to nearest station"
            elif composite_risk_score > 40:
                recommended_action = "Monitor closely - prepare contingency plan"
            else:
                recommended_action = "Continue normal operations"
            
            truck_insights.append({
                'truck_id': assessment['truck_id'],
                'cargo_value': assessment['cargo_value'],
                'composite_risk_score': composite_risk_score,  # Now uses ACTUAL forecast-based composite
                'temperature_risk': temperature_risk,  # ACTUAL forecast risk
                'weather_risk': weather_risk,
                'recommended_action': recommended_action,
                'priority': priority,  # Updated priority
                'estimated_delay': 0,  # Placeholder
                'time_to_breach': time_to_breach
            })
        
        return {
            'fleet_summary': {
                'total_trucks': len(self.fleet_data['trucks']),
                'high_risk_trucks': len([a for a in truck_assessments if a['risk_score'] > 70]),
                'medium_risk_trucks': len([a for a in truck_assessments if 40 < a['risk_score'] <= 70]),
                'low_risk_trucks': len([a for a in truck_assessments if a['risk_score'] <= 40]),
                'total_cargo_value': total_cargo_value,
                'at_risk_cargo_value': at_risk_cargo_value,
                'high_priority_trucks': high_priority_trucks,
                'average_risk_score': average_risk_score
            },
            'truck_insights': truck_insights
        }
    
    def _assess_truck_risk(self, truck: Dict) -> Dict:
        """Assess individual truck risk"""
        # Temperature risk
        temp = truck['telemetry']['temperature']
        threshold = truck['cargo']['criticalThreshold']
        temp_margin = abs(temp - threshold)
        temp_risk = max(0, 100 - (temp_margin / abs(threshold)) * 100)
        
        # Location risk (distance to destination)
        # Simplified - in production, calculate actual distance
        location_risk = 30  # Placeholder
        
        # Cargo value risk
        cargo_value = truck['cargo']['value']
        value_risk = min(100, (cargo_value / 500000) * 100)
        
        # Combined risk score
        risk_score = int(0.5 * temp_risk + 0.3 * location_risk + 0.2 * value_risk)
        
        # Safely get destination name
        destination_name = 'Unknown'
        if 'destination' in truck:
            if isinstance(truck['destination'], dict):
                destination_name = truck['destination'].get('name', 'Unknown')
            else:
                destination_name = str(truck['destination'])
        
        return {
            'truck_id': truck['truckId'],
            'risk_score': risk_score,
            'temperature': temp,
            'critical_threshold': threshold,
            'cargo_type': truck['cargo']['type'],
            'cargo_value': cargo_value,
            'destination': destination_name,
            'priority': 'HIGH' if risk_score > 70 else 'MEDIUM' if risk_score > 40 else 'LOW'
        }
    
    def _generate_fleet_recommendations(self, assessments: List[Dict]) -> List[str]:
        """Generate fleet-wide recommendations"""
        high_risk = [a for a in assessments if a['risk_score'] > 70]
        
        recommendations = []
        
        if len(high_risk) > 0:
            recommendations.append(f'🚨 {len(high_risk)} trucks require immediate attention')
            recommendations.append('Prioritize high-risk trucks for intervention')
            recommendations.append('Consider rerouting to nearest stations')
        
        if len(high_risk) > 5:
            recommendations.append('⚠️ Fleet-wide alert: Multiple high-risk situations')
            recommendations.append('Activate emergency response team')
        
        if len(high_risk) == 0:
            recommendations.append('✅ Fleet operating within normal parameters')
            recommendations.append('Continue standard monitoring')
        
        return recommendations


# Create global instance
_forecasting_service = None

def get_forecasting_service() -> FleetOpsForecastingService:
    """Get global forecasting service instance"""
    global _forecasting_service
    if _forecasting_service is None:
        _forecasting_service = FleetOpsForecastingService()
    return _forecasting_service

# Made with Bob
