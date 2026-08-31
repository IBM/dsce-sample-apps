"""Truck service for managing truck state and operations"""
from typing import List, Dict, Optional
import random
from datetime import datetime, timedelta
from ..models.truck import Truck, TruckState, TruckTelemetry, CurrentTrip
from ..models.cargo import Cargo
from ..models.route import Location, RouteWaypoint
from ..models.weather import Coordinates
from ..utils.data_generator import (
    generate_route_pair,
    generate_route_pair_for_truck,
    generate_route_waypoints,
    generate_cargo,
    generate_trip_id
)
from ..utils.geo_utils import calculate_distance, calculate_eta_minutes


class TruckService:
    """Service for managing truck fleet"""
    
    def __init__(self):
        self.trucks: Dict[str, TruckState] = {}
    
    def generate_trucks(self) -> List[Truck]:
        """Generate 10 trucks locally"""
        trucks = []
        truck_makes = ["Volvo", "Freightliner", "Kenworth", "Peterbilt", "Mack"]
        truck_models = ["VNL", "Cascadia", "T680", "579", "Anthem"]
        
        for i in range(1, 11):
            truck = Truck(
                truckId=f"TRUCK-{i:03d}",
                make=truck_makes[(i-1) % len(truck_makes)],
                model=truck_models[(i-1) % len(truck_models)],
                year=2020 + (i % 4),
                licensePlate=f"FL-{1000+i}",
                capacity=53.0  # 53-foot trailer standard
            )
            trucks.append(truck)
        
        return trucks
    
    async def initialize_fleet(self) -> List[TruckState]:
        """Initialize fleet with 10 trucks and generate their initial state"""
        trucks = self.generate_trucks()
        
        for truck in trucks:
            # Generate truck-specific route from predefined routes
            origin, destination = generate_route_pair_for_truck(truck.truckId)
            waypoints = generate_route_waypoints(origin, destination, truck.truckId)
            
            # Calculate route metrics
            total_distance = 0
            for i in range(len(waypoints) - 1):
                total_distance += calculate_distance(
                    waypoints[i].latitude, waypoints[i].longitude,
                    waypoints[i + 1].latitude, waypoints[i + 1].longitude
                )
            
            eta_minutes = calculate_eta_minutes(total_distance)
            estimated_arrival = datetime.utcnow() + timedelta(minutes=eta_minutes)
            
            # Generate cargo
            cargo = generate_cargo()
            
            # Create truck state
            truck_state = TruckState(
                truckId=truck.truckId,
                timestamp=datetime.utcnow(),
                telemetry=TruckTelemetry(
                    temperature=cargo.currentTemperature or -15.0,
                    coolantStatus="OK",
                    currentLocation=Coordinates(
                        latitude=waypoints[0].latitude,
                        longitude=waypoints[0].longitude
                    ),
                    speed=95.0,
                    fuelLevel=100.0
                ),
                cargo=cargo,
                currentTrip=CurrentTrip(
                    tripId=generate_trip_id(),
                    origin=origin,
                    destination=destination,
                    plannedRoute=waypoints,
                    estimatedArrival=estimated_arrival,
                    currentWaypointIndex=0,
                    distanceTraveled=0,
                    distanceRemaining=total_distance
                ),
                status="ACTIVE"
            )
            
            self.trucks[truck.truckId] = truck_state
        
        return list(self.trucks.values())
    
    def get_all_trucks(self) -> List[TruckState]:
        """Get all truck states"""
        return list(self.trucks.values())
    
    def get_truck(self, truck_id: str) -> Optional[TruckState]:
        """Get specific truck state"""
        return self.trucks.get(truck_id)
    
    def update_truck(self, truck_id: str, **updates) -> Optional[TruckState]:
        """
        Update truck state with support for nested updates.
        Handles route updates via currentTrip field.
        Changes persist until application restart.
        """
        if truck_id not in self.trucks:
            return None
        
        truck = self.trucks[truck_id]
        
        # Update fields - handle nested objects properly
        for key, value in updates.items():
            # Allow None values for fields that need to be explicitly cleared
            # These fields should be set to None when resolving incidents/alerts
            clearable_fields = ['incidentType', 'alertState']
            
            if value is None and key not in clearable_fields:
                continue
                
            if hasattr(truck, key):
                # For nested objects, reconstruct Pydantic models from dicts if needed
                if key == 'telemetry' and isinstance(value, dict):
                    from ..models.truck import TruckTelemetry
                    setattr(truck, key, TruckTelemetry(**value))
                elif key == 'cargo' and isinstance(value, dict):
                    from ..models.cargo import Cargo
                    setattr(truck, key, Cargo(**value))
                elif key == 'currentTrip' and isinstance(value, dict):
                    from ..models.truck import CurrentTrip
                    setattr(truck, key, CurrentTrip(**value))
                elif key == 'diversionState' and isinstance(value, dict):
                    from ..models.incident import DiversionState
                    setattr(truck, key, DiversionState(**value))
                elif key == 'recoveryState' and isinstance(value, dict):
                    from ..models.incident import RecoveryState
                    setattr(truck, key, RecoveryState(**value))
                else:
                    # For simple fields or already-constructed objects, just set the value
                    setattr(truck, key, value)
        
        truck.timestamp = datetime.utcnow()
        
        # Persist changes - they remain in memory until app restart
        self.trucks[truck_id] = truck
        
        return truck
    
    def update_cargo_temperature(self, truck_id: str, temperature: float, 
                                coolant_status: Optional[str] = None) -> Optional[TruckState]:
        """Update cargo temperature"""
        truck = self.trucks.get(truck_id)
        if not truck:
            return None
        
        truck.cargo.currentTemperature = temperature
        
        # Update cargo condition based on temperature
        if temperature > truck.cargo.criticalThreshold:
            truck.cargo.condition = "AT_RISK"
        elif temperature > truck.cargo.criticalThreshold + 5:
            truck.cargo.condition = "SPOILED"
        else:
            truck.cargo.condition = "GOOD"
        
        if coolant_status:
            truck.telemetry.coolantStatus = coolant_status
            truck.telemetry.temperature = temperature
        
        truck.timestamp = datetime.utcnow()
        return truck
    
    def _generate_alternative_route(self, origin, destination, variation: int):
        """Generate alternative route waypoints"""
        from ..utils.data_generator import I95_CORRIDOR
        from ..models.route import RouteWaypoint
        
        # Find indices
        origin_idx = None
        dest_idx = None
        
        for i, (city, lat, lon) in enumerate(I95_CORRIDOR):
            if abs(lat - origin.latitude) < 0.1 and abs(lon - origin.longitude) < 0.1:
                origin_idx = i
            if abs(lat - destination.latitude) < 0.1 and abs(lon - destination.longitude) < 0.1:
                dest_idx = i
        
        if origin_idx is not None and dest_idx is not None:
            waypoints = []
            
            # Different strategies for each variation
            if variation == 1:
                step = 2
                highway = "US-1"
            elif variation == 2:
                step = 3
                highway = "US-301"
            else:
                step = 4
                highway = "US-17"
            
            for i in range(origin_idx, dest_idx + 1, step):
                idx = min(i, len(I95_CORRIDOR) - 1)
                city, lat, lon = I95_CORRIDOR[idx]
                
                # Add slight offset
                lat_offset = random.uniform(-0.02, 0.02)
                lon_offset = random.uniform(-0.02, 0.02)
                
                waypoints.append(RouteWaypoint(
                    latitude=lat + lat_offset,
                    longitude=lon + lon_offset,
                    city=city,
                    highway=highway
                ))
            
            # Ensure destination
            if len(waypoints) == 0 or waypoints[-1].latitude != destination.latitude:
                waypoints.append(RouteWaypoint(
                    latitude=destination.latitude,
                    longitude=destination.longitude,
                    city=destination.name,
                    highway=highway
                ))
            
            return waypoints
        else:
            # Fallback
            return generate_route_waypoints(origin, destination)


# Global instance
truck_service = TruckService()

# Made with Bob
