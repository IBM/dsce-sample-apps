"""Simulation engine for continuous fleet simulation"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Set
from ..models.truck import TruckState
from ..models.incident import Incident, IncidentType, IncidentSeverity, DiversionState
from ..models.alert import Alert, AlertType, AlertSeverity
from ..utils.geo_utils import calculate_distance, interpolate_waypoints
from .truck_service import truck_service
from .station_service import station_service
from .weather_service import weather_service


class SimulationEngine:
    """Core simulation engine for fleet operations"""
    
    def __init__(self):
        self.running = False
        self.simulation_speed = 10.0  # 10x accelerated (increased from 2x for faster visible movement)
        self.update_interval = 5  # Update every 5 seconds (reduced from 30s for more frequent updates)
        self.incidents: Dict[str, Incident] = {}
        self.alerts: Dict[str, Alert] = {}
        self.trucks_with_incidents: Set[str] = set()
        self.incident_probability = 0.20  # 20% of trucks will have incidents
        self.selected_incident_trucks: Set[str] = set()
        self.incident_creation_times: Dict[str, datetime] = {}  # Track when incidents were created
    
    async def initialize(self):
        """Initialize simulation with fleet data"""
        print("Initializing fleet simulation...")
        
        # Initialize trucks
        trucks = await truck_service.initialize_fleet()
        print(f"Initialized {len(trucks)} trucks")
        
        # Assign specific incident types to specific trucks
        # TRUCK-001 and TRUCK-002: CARGO alerts only
        # TRUCK-003 and TRUCK-004: WEATHER alerts only
        # TRUCK-005 through TRUCK-010: No automatic alerts (manual trigger only)
        self.selected_incident_trucks = {"TRUCK-001", "TRUCK-002", "TRUCK-003", "TRUCK-004"}
        
        self.truck_incident_types = {
            "TRUCK-001": IncidentType.CARGO_THRESHOLD_BREACH,
            "TRUCK-002": IncidentType.CARGO_THRESHOLD_BREACH,
            "TRUCK-003": IncidentType.WEATHER_FAILURE,
            "TRUCK-004": IncidentType.WEATHER_FAILURE
        }
        
        print(f"Selected trucks for incidents: {self.selected_incident_trucks}")
        print(f"Incident type assignments: {self.truck_incident_types}")
        
        # Generate stations for each truck
        for truck in trucks:
            stations = station_service.generate_stations_for_truck(truck)
            print(f"Generated {len(stations)} stations for {truck.truckId}")
        
        # Generate weather for each truck
        for truck in trucks:
            weather = weather_service.generate_weather_for_truck(truck)
            print(f"Generated weather for {truck.truckId}: risk={weather.overallWeatherRisk}")
        
        print("Simulation initialized successfully")
    
    async def start(self):
        """Start the simulation loop"""
        if self.running:
            return
        
        self.running = True
        print("Starting simulation engine...")
        
        while self.running:
            try:
                await self.simulation_step()
                await asyncio.sleep(self.update_interval)
            except Exception as e:
                print(f"Error in simulation step: {e}")
                import traceback
                traceback.print_exc()
    
    async def stop(self):
        """Stop the simulation"""
        self.running = False
        print("Simulation engine stopped")
    
    async def simulation_step(self):
        """Execute one simulation step"""
        trucks = truck_service.get_all_trucks()
        
        for truck in trucks:
            if truck.status == "COMPLETED":
                continue
            
            # Handle RECOVERING status transition to ACTIVE
            # This allows the driver view to display the correct destination before status changes
            if truck.status == "RECOVERING" and hasattr(truck, '_recovery_status_set_time'):
                # Transition to ACTIVE after one simulation step (5 seconds)
                recovery_duration = (datetime.utcnow() - truck._recovery_status_set_time).total_seconds()
                if recovery_duration >= 5:
                    truck.status = "ACTIVE"
                    delattr(truck, '_recovery_status_set_time')
                    print(f"Truck {truck.truckId} status changed from RECOVERING to ACTIVE")
            
            # Update truck position
            self._update_truck_position(truck)
            
            # Simulate cargo temperature drift
            self._simulate_cargo_drift(truck)
            
            # Check for auto-resolution of incidents (after 10 minutes)
            if truck.truckId in self.trucks_with_incidents:
                self._check_auto_resolution(truck)
            
            # Check for incident triggers (only for selected trucks)
            if truck.truckId in self.selected_incident_trucks and truck.truckId not in self.trucks_with_incidents:
                self._check_incident_triggers(truck)
            
            # Update ETA
            self._update_eta(truck)
        
        # Mutate weather conditions (low frequency)
        if random.random() < 0.1:  # 10% chance per step
            weather_service.mutate_weather()
    
    def _update_truck_position(self, truck: TruckState):
        """Update truck position along route"""
        route = truck.currentTrip.plannedRoute
        current_idx = truck.currentTrip.currentWaypointIndex
        
        # Check if reached destination
        if current_idx >= len(route) - 1 or truck.currentTrip.distanceRemaining <= 0:
            # Special handling for DIVERTED trucks at service facility
            if truck.status == "DIVERTED" and truck.originalRoute:
                # Truck reached service facility - pause for service (2 minutes = 120 seconds)
                if not hasattr(truck, '_service_start_time'):
                    truck._service_start_time = datetime.utcnow()
                    print(f"Truck {truck.truckId} arrived at service facility. Starting 2-minute service...")
                    return
                
                # Check if service duration (120 seconds) has elapsed
                service_duration = (datetime.utcnow() - truck._service_start_time).total_seconds()
                if service_duration < 120:
                    # Still being serviced - don't move
                    return
                
                # Service complete - restore original route
                print(f"Truck {truck.truckId} service complete. Resuming original route...")
                
                # Reset cargo temperature to safe level BEFORE changing status
                # This prevents the UI from showing spoiled cargo during the transition
                if truck.cargo.currentTemperature is not None:
                    if truck.cargo.type == "temperature_sensitive_vaccines":
                        truck.cargo.currentTemperature = -15.0
                    elif truck.cargo.type == "pharmaceutical_products":
                        truck.cargo.currentTemperature = 5.0
                    elif truck.cargo.type == "frozen_food_products":
                        truck.cargo.currentTemperature = -20.0
                    elif truck.cargo.type == "fresh_produce":
                        truck.cargo.currentTemperature = 5.0
                    elif truck.cargo.type == "biological_samples":
                        truck.cargo.currentTemperature = -25.0
                    
                    truck.telemetry.temperature = truck.cargo.currentTemperature
                    truck.cargo.condition = "GOOD"
                    truck.cargo.timeToSpoilage = random.randint(90, 180)
                
                # Clear any incidents
                if truck.truckId in self.trucks_with_incidents:
                    self.trucks_with_incidents.remove(truck.truckId)
                truck.incidentId = None
                truck.incidentType = None
                truck.telemetry.coolantStatus = "OK"
                
                # Set status to RECOVERING before restoring route
                # This allows the driver view to show the correct destination
                truck.status = "RECOVERING"
                
                # Restore the original route
                truck.currentTrip = truck.originalRoute
                truck.originalRoute = None
                
                # Clear service tracking
                delattr(truck, '_service_start_time')
                
                # Status will be set to ACTIVE in the next simulation step
                # after the driver view has had a chance to display the correct destination
                if not hasattr(truck, '_recovery_status_set_time'):
                    truck._recovery_status_set_time = datetime.utcnow()
                
                return
            
            # Normal trip completion - restart the same route
            print(f"Truck {truck.truckId} completed trip. Restarting same route...")
            
            # Reverse the route (go back)
            truck.currentTrip.plannedRoute = list(reversed(route))
            
            # Reset to start of route
            truck.currentTrip.currentWaypointIndex = 0
            
            # Recalculate total distance
            total_distance = 0
            for i in range(len(truck.currentTrip.plannedRoute) - 1):
                total_distance += calculate_distance(
                    truck.currentTrip.plannedRoute[i].latitude,
                    truck.currentTrip.plannedRoute[i].longitude,
                    truck.currentTrip.plannedRoute[i + 1].latitude,
                    truck.currentTrip.plannedRoute[i + 1].longitude
                )
            
            truck.currentTrip.distanceTraveled = 0
            truck.currentTrip.distanceRemaining = total_distance
            
            # Swap origin and destination
            old_origin = truck.currentTrip.origin
            truck.currentTrip.origin = truck.currentTrip.destination
            truck.currentTrip.destination = old_origin
            
            # Reset position to new start
            truck.telemetry.currentLocation.latitude = truck.currentTrip.plannedRoute[0].latitude
            truck.telemetry.currentLocation.longitude = truck.currentTrip.plannedRoute[0].longitude
            
            # Reset cargo temperature to safe level
            if truck.cargo.currentTemperature is not None:
                # Reset to safe temperature for cargo type
                if truck.cargo.type == "temperature_sensitive_vaccines":
                    truck.cargo.currentTemperature = -15.0
                elif truck.cargo.type == "pharmaceutical_products":
                    truck.cargo.currentTemperature = 5.0
                elif truck.cargo.type == "frozen_food_products":
                    truck.cargo.currentTemperature = -20.0
                elif truck.cargo.type == "fresh_produce":
                    truck.cargo.currentTemperature = 5.0
                elif truck.cargo.type == "biological_samples":
                    truck.cargo.currentTemperature = -25.0
                
                truck.telemetry.temperature = truck.cargo.currentTemperature
                truck.cargo.condition = "GOOD"
                truck.cargo.timeToSpoilage = random.randint(90, 180)
            
            # Clear any incidents for fresh start
            if truck.truckId in self.trucks_with_incidents:
                self.trucks_with_incidents.remove(truck.truckId)
            truck.incidentId = None
            truck.incidentType = None
            truck.telemetry.coolantStatus = "OK"
            
            # Update ETA
            from ..utils.geo_utils import calculate_eta_minutes
            eta_minutes = calculate_eta_minutes(total_distance)
            truck.currentTrip.estimatedArrival = datetime.utcnow() + timedelta(minutes=eta_minutes)
            
            truck.status = "ACTIVE"
            truck.telemetry.speed = 95.0
            
            return
        
        # Calculate movement (accelerated by simulation speed)
        # Average highway speed: 95 km/h
        # At 10x speed with 5s updates: 95 * 10 * (5/3600) = ~1.32 km per step
        # This gives visible movement every 5 seconds when polling the API
        distance_per_step = 95 * self.simulation_speed * (self.update_interval / 3600)
        
        # Get current and next waypoint
        current_wp = route[current_idx]
        next_wp = route[current_idx + 1]
        
        # Calculate distance to next waypoint
        dist_to_next = calculate_distance(
            truck.telemetry.currentLocation.latitude,
            truck.telemetry.currentLocation.longitude,
            next_wp.latitude,
            next_wp.longitude
        )
        
        if dist_to_next <= distance_per_step:
            # Move to next waypoint
            truck.telemetry.currentLocation.latitude = next_wp.latitude
            truck.telemetry.currentLocation.longitude = next_wp.longitude
            truck.currentTrip.currentWaypointIndex += 1
            truck.currentTrip.distanceTraveled += dist_to_next
            truck.currentTrip.distanceRemaining -= dist_to_next
        else:
            # Interpolate position
            fraction = distance_per_step / dist_to_next
            new_lat = current_wp.latitude + (next_wp.latitude - current_wp.latitude) * fraction
            new_lon = current_wp.longitude + (next_wp.longitude - current_wp.longitude) * fraction
            
            truck.telemetry.currentLocation.latitude = new_lat
            truck.telemetry.currentLocation.longitude = new_lon
            truck.currentTrip.distanceTraveled += distance_per_step
            truck.currentTrip.distanceRemaining -= distance_per_step
        
        truck.timestamp = datetime.utcnow()
    
    def _simulate_cargo_drift(self, truck: TruckState):
        """Simulate cargo temperature drift with realistic bounds"""
        # Ensure current temperature is set
        if truck.cargo.currentTemperature is None:
            truck.cargo.currentTemperature = truck.cargo.criticalThreshold - 5.0
        
        current_temp = truck.cargo.currentTemperature
        
        # CRITICAL FIX: Enforce absolute temperature bounds (-30°C to +30°C)
        # This prevents temperature accumulation bugs
        if current_temp < -30.0:
            current_temp = -30.0
            truck.cargo.currentTemperature = -30.0
            truck.telemetry.temperature = -30.0
        elif current_temp > 30.0:
            current_temp = 30.0
            truck.cargo.currentTemperature = 30.0
            truck.telemetry.temperature = 30.0
        
        if truck.telemetry.coolantStatus == "FAILURE":
            # Temperature rises when coolant fails
            drift = random.uniform(0.5, 1.5)  # Rises 0.5-1.5°C per step
            new_temp = current_temp + drift
            
            # CRITICAL: Cap maximum temperature at ambient temperature (30°C)
            # Cargo cannot exceed ambient temperature in a failed cooling system
            new_temp = min(new_temp, 30.0)
            
            truck.cargo.currentTemperature = round(new_temp, 1)
            truck.telemetry.temperature = round(new_temp, 1)
            
            # Update cargo condition
            if new_temp > truck.cargo.criticalThreshold:
                truck.cargo.condition = "AT_RISK"
                truck.cargo.timeToSpoilage = max(0, truck.cargo.timeToSpoilage - 2)
            if new_temp > truck.cargo.criticalThreshold + 5:
                truck.cargo.condition = "SPOILED"
                truck.cargo.timeToSpoilage = 0
        else:
            # Normal operation - small random fluctuation
            drift = random.uniform(-0.2, 0.2)
            new_temp = current_temp + drift
            
            # Keep temperature within safe operating range for the cargo type
            # Clamp to ±2°C of initial safe temperature
            if truck.cargo.type == "temperature_sensitive_vaccines":
                new_temp = max(-17.0, min(-13.0, new_temp))
            elif truck.cargo.type == "pharmaceutical_products":
                new_temp = max(0.0, min(10.0, new_temp))
            elif truck.cargo.type == "frozen_food_products":
                new_temp = max(-27.0, min(-16.0, new_temp))
            elif truck.cargo.type == "fresh_produce":
                new_temp = max(0.0, min(12.0, new_temp))
            elif truck.cargo.type == "biological_samples":
                new_temp = max(-32.0, min(-18.0, new_temp))
            
            truck.cargo.currentTemperature = round(new_temp, 1)
            truck.telemetry.temperature = round(new_temp, 1)
    
    def _check_incident_triggers(self, truck: TruckState):
        """Check if incidents should be triggered"""
        # Random chance to trigger incident during runtime
        if random.random() < 0.02:  # 2% chance per step
            # Use pre-assigned incident type for this truck
            incident_type = self.truck_incident_types.get(truck.truckId, IncidentType.CARGO_THRESHOLD_BREACH)
            
            self._trigger_incident(truck, incident_type)
    
    def _trigger_incident(self, truck: TruckState, incident_type: IncidentType):
        """Trigger an incident for a truck"""
        incident_id = f"incident-{uuid.uuid4().hex[:8]}"
        
        incident = Incident(
            incidentId=incident_id,
            incidentType=incident_type,
            severity=IncidentSeverity.HIGH if incident_type == IncidentType.CARGO_THRESHOLD_BREACH else IncidentSeverity.MEDIUM,
            createdAt=datetime.utcnow(),
            resolved=False,
            truckId=truck.truckId,
            description=f"{incident_type.value} detected for {truck.truckId}"
        )
        
        self.incidents[incident_id] = incident
        self.trucks_with_incidents.add(truck.truckId)
        self.incident_creation_times[truck.truckId] = datetime.utcnow()  # Track creation time
        
        # Update truck state
        truck.incidentId = incident_id
        truck.incidentType = incident_type.value
        
        if incident_type == IncidentType.CARGO_THRESHOLD_BREACH:
            # Coolant failure
            truck.telemetry.coolantStatus = "FAILURE"
            
            # Create alert - only report the problem, no decisions
            alert = self._create_alert(
                truck.truckId,
                AlertType.CARGO_THRESHOLD_BREACH,
                AlertSeverity.CRITICAL,
                f"Coolant system failure detected. Cargo temperature: {truck.cargo.currentTemperature}°C, Critical threshold: {truck.cargo.criticalThreshold}°C, Time to spoilage: {truck.cargo.timeToSpoilage} minutes"
            )
        
        elif incident_type == IncidentType.WEATHER_FAILURE:
            # Severe weather - only report the problem, no decisions
            alert = self._create_alert(
                truck.truckId,
                AlertType.WEATHER_ALERT,
                AlertSeverity.WARNING,
                "Severe weather conditions detected on current route"
            )
        
        print(f"Incident triggered: {incident_type.value} for {truck.truckId}")
    
    def _create_alert(self, truck_id: str, alert_type: AlertType, 
                     severity: AlertSeverity, message: str) -> Alert:
        """Create an alert"""
        alert_id = f"alert-{uuid.uuid4().hex[:8]}"
        
        alert = Alert(
            alertId=alert_id,
            truckId=truck_id,
            type=alert_type,
            severity=severity,
            message=message,
            timestamp=datetime.utcnow(),
            acknowledged=False
        )
        
        self.alerts[alert_id] = alert
        return alert
    
    def _check_auto_resolution(self, truck: TruckState):
        """Auto-resolve incidents after 10 minutes and restart simulation"""
        if truck.truckId not in self.incident_creation_times:
            return
        
        creation_time = self.incident_creation_times[truck.truckId]
        elapsed_time = (datetime.utcnow() - creation_time).total_seconds() / 60  # minutes
        
        # Auto-resolve after 10 minutes
        if elapsed_time >= 10:
            print(f"Auto-resolving incident for {truck.truckId} after {elapsed_time:.1f} minutes")
            
            # Resolve incident
            if truck.incidentId and truck.incidentId in self.incidents:
                incident = self.incidents[truck.incidentId]
                incident.resolved = True
                incident.resolvedAt = datetime.utcnow()
            
            # Reset truck to normal operation
            truck.telemetry.coolantStatus = "OK"
            truck.incidentId = None
            truck.incidentType = None
            
            # Reset cargo temperature to safe level (prevent SPOILED condition)
            if truck.cargo.type == "temperature_sensitive_vaccines":
                truck.cargo.currentTemperature = -15.0
            elif truck.cargo.type == "pharmaceutical_products":
                truck.cargo.currentTemperature = 5.0
            elif truck.cargo.type == "frozen_food_products":
                truck.cargo.currentTemperature = -20.0
            elif truck.cargo.type == "fresh_produce":
                truck.cargo.currentTemperature = 5.0
            elif truck.cargo.type == "biological_samples":
                truck.cargo.currentTemperature = -25.0
            
            truck.telemetry.temperature = truck.cargo.currentTemperature
            truck.cargo.condition = "GOOD"
            truck.cargo.timeToSpoilage = random.randint(90, 180)
            
            # Remove from tracking
            self.trucks_with_incidents.discard(truck.truckId)
            del self.incident_creation_times[truck.truckId]
            
            # Resolve associated alerts
            for alert_id, alert in list(self.alerts.items()):
                if alert.truckId == truck.truckId and not alert.acknowledged:
                    alert.acknowledged = True
            
            print(f"Truck {truck.truckId} incident auto-resolved and reset to normal operation")
    
    def _update_eta(self, truck: TruckState):
        """Update estimated arrival time"""
        if truck.currentTrip.distanceRemaining <= 0:
            return
        
        # Calculate ETA based on remaining distance and speed
        avg_speed = 95 * self.simulation_speed  # km/h
        hours_remaining = truck.currentTrip.distanceRemaining / avg_speed
        minutes_remaining = int(hours_remaining * 60)
        
        truck.currentTrip.estimatedArrival = datetime.utcnow() + timedelta(minutes=minutes_remaining)
    
    def get_all_incidents(self) -> List[Incident]:
        """Get all incidents"""
        return list(self.incidents.values())
    
    def get_truck_incidents(self, truck_id: str) -> List[Incident]:
        """Get incidents for specific truck"""
        return [i for i in self.incidents.values() if i.truckId == truck_id]
    
    def get_all_alerts(self) -> List[Alert]:
        """Get all alerts"""
        return list(self.alerts.values())
    
    def get_truck_alerts(self, truck_id: str) -> List[Alert]:
        """Get alerts for specific truck"""
        return [a for a in self.alerts.values() if a.truckId == truck_id]


# Global instance
simulation_engine = SimulationEngine()

# Made with Bob
