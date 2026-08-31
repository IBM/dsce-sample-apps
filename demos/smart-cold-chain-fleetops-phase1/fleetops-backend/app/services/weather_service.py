"""Weather service for managing weather conditions"""
from typing import List, Dict, Optional
from ..models.weather import WeatherSegment, WeatherAnalysis, WeatherUpdateRequest, WeatherCondition, WeatherSeverity
from ..models.truck import TruckState
from ..utils.data_generator import generate_weather_segments
import random


class WeatherService:
    """Service for managing weather conditions"""
    
    def __init__(self):
        self.weather_by_truck: Dict[str, List[WeatherSegment]] = {}
        self.weather_by_region: Dict[str, WeatherSegment] = {}
    
    def generate_weather_for_truck(self, truck_state: TruckState) -> WeatherAnalysis:
        """Generate weather conditions for truck's route"""
        waypoints = truck_state.currentTrip.plannedRoute
        segments = generate_weather_segments(waypoints)
        
        # Store weather segments
        self.weather_by_truck[truck_state.truckId] = segments
        
        # Store by region for updates
        for segment in segments:
            region_key = f"{segment.location}"
            self.weather_by_region[region_key] = segment
        
        # Calculate overall analysis
        severe_weather = any(
            seg.severity in ["SEVERE", "MODERATE"] and 
            seg.condition in ["HEAVY_RAIN", "THUNDERSTORM", "SNOW", "FOG"]
            for seg in segments
        )
        
        total_delay = sum(seg.estimatedDelay for seg in segments)
        
        # Calculate risk score (0-100)
        risk_score = 0
        for seg in segments:
            if seg.severity == "SEVERE":
                risk_score += 30
            elif seg.severity == "MODERATE":
                risk_score += 15
            elif seg.severity == "LOW":
                risk_score += 5
        
        risk_score = min(risk_score, 100)
        
        return WeatherAnalysis(
            severeWeatherDetected=severe_weather,
            overallWeatherRisk=risk_score,
            totalDelayMinutes=total_delay,
            segments=segments
        )
    
    def get_weather_analysis(self, truck_id: str) -> Optional[WeatherAnalysis]:
        """Get weather analysis for truck"""
        segments = self.weather_by_truck.get(truck_id)
        if not segments:
            return None
        
        severe_weather = any(
            seg.severity in ["SEVERE", "MODERATE"] and 
            seg.condition in ["HEAVY_RAIN", "THUNDERSTORM", "SNOW", "FOG"]
            for seg in segments
        )
        
        total_delay = sum(seg.estimatedDelay for seg in segments)
        
        risk_score = 0
        for seg in segments:
            if seg.severity == "SEVERE":
                risk_score += 30
            elif seg.severity == "MODERATE":
                risk_score += 15
            elif seg.severity == "LOW":
                risk_score += 5
        
        risk_score = min(risk_score, 100)
        
        return WeatherAnalysis(
            severeWeatherDetected=severe_weather,
            overallWeatherRisk=risk_score,
            totalDelayMinutes=total_delay,
            segments=segments
        )
    
    def get_all_weather(self) -> Dict[str, List[WeatherSegment]]:
        """Get all weather data"""
        return self.weather_by_truck
    
    def update_weather(self, region: str, update: WeatherUpdateRequest) -> bool:
        """Update weather for a region"""
        # Find segments matching region
        updated = False
        
        for truck_id, segments in self.weather_by_truck.items():
            for segment in segments:
                if region.lower() in segment.location.lower():
                    segment.condition = update.condition.value
                    segment.severity = update.severity.value
                    
                    if update.temperature is not None:
                        segment.temperature = update.temperature
                    if update.windSpeed is not None:
                        segment.windSpeed = update.windSpeed
                    if update.visibility is not None:
                        segment.visibility = update.visibility
                    
                    # Recalculate delay based on severity
                    if update.severity == WeatherSeverity.SEVERE:
                        segment.estimatedDelay = random.randint(30, 90)
                    elif update.severity == WeatherSeverity.MODERATE:
                        segment.estimatedDelay = random.randint(10, 30)
                    else:
                        segment.estimatedDelay = 0
                    
                    updated = True
        
        return updated
    
    def delete_weather_region(self, region: str) -> bool:
        """Delete weather data for a region"""
        deleted = False
        
        for truck_id, segments in self.weather_by_truck.items():
            original_len = len(segments)
            self.weather_by_truck[truck_id] = [
                seg for seg in segments
                if region.lower() not in seg.location.lower()
            ]
            if len(self.weather_by_truck[truck_id]) < original_len:
                deleted = True
        
        return deleted
    
    def mutate_weather(self):
        """Randomly mutate weather conditions (for simulation)"""
        for truck_id, segments in self.weather_by_truck.items():
            for segment in segments:
                # Low probability of weather change
                if random.random() < 0.05:  # 5% chance per segment
                    # Change to a different condition
                    current_severity = segment.severity
                    
                    if current_severity == "CLEAR" or current_severity == "LOW":
                        # Can worsen
                        if random.random() < 0.3:
                            segment.condition = random.choice([
                                "RAIN", "partly_cloudy", "FOG"
                            ])
                            segment.severity = "MODERATE"
                            segment.estimatedDelay = random.randint(5, 15)
                    elif current_severity == "MODERATE":
                        # Can improve or worsen
                        if random.random() < 0.5:
                            # Improve
                            segment.condition = "clear"
                            segment.severity = "LOW"
                            segment.estimatedDelay = 0
                        else:
                            # Worsen
                            segment.condition = random.choice([
                                "HEAVY_RAIN", "THUNDERSTORM"
                            ])
                            segment.severity = "SEVERE"
                            segment.estimatedDelay = random.randint(30, 60)
                    elif current_severity == "SEVERE":
                        # Can only improve
                        if random.random() < 0.4:
                            segment.condition = "RAIN"
                            segment.severity = "MODERATE"
                            segment.estimatedDelay = random.randint(10, 20)


# Global instance
weather_service = WeatherService()

# Made with Bob
