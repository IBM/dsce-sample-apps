"""Station service for managing cold storage stations"""
from typing import List, Dict, Optional
import random
from ..models.station import Station, StationUpdateRequest
from ..models.truck import TruckState
from ..models.route import Location, RouteWaypoint
from ..utils.data_generator import generate_stations_along_route, generate_route_waypoints
from ..utils.geo_utils import calculate_distance, calculate_eta_minutes, is_point_on_route


class StationService:
    """Service for managing stations"""
    
    def __init__(self):
        self.stations: Dict[str, Station] = {}
        self.stations_by_truck: Dict[str, List[Station]] = {}
        self.stations_by_route: Dict[str, List[Station]] = {}  # Cache stations by route
    
    def generate_stations_for_truck(self, truck_state: TruckState) -> List[Station]:
        """Generate stations along truck's planned route"""
        waypoints = truck_state.currentTrip.plannedRoute
        origin = truck_state.currentTrip.origin
        destination = truck_state.currentTrip.destination
        truck_id = truck_state.truckId
        
        stations = generate_stations_along_route(
            truck_id=truck_id,
            origin=origin,
            destination=destination,
            waypoints=waypoints
        )
        
        # Calculate distance and travel time from truck's current location
        current_lat = truck_state.telemetry.currentLocation.latitude
        current_lon = truck_state.telemetry.currentLocation.longitude
        
        for station in stations:
            distance = calculate_distance(
                current_lat, current_lon,
                station.location.latitude, station.location.longitude
            )
            station.distance = round(distance, 2)
            station.travelTime = calculate_eta_minutes(distance)
            
            # Store station
            self.stations[station.stationId] = station
        
        # Store stations for this truck
        self.stations_by_truck[truck_state.truckId] = stations
        
        return stations
    
    def get_all_stations(self) -> List[Station]:
        """Get all stations"""
        return list(self.stations.values())
    
    def get_station(self, station_id: str) -> Optional[Station]:
        """Get specific station"""
        return self.stations.get(station_id)
    
    def get_nearest_stations(self, truck_state: TruckState, 
                           search_strategy: str = "along_planned_route",
                           max_results: int = 5) -> List[Station]:
        """
        Get nearest stations to truck
        
        Args:
            truck_state: Current truck state
            search_strategy: "along_planned_route" or "alternative_locations"
            max_results: Maximum number of stations to return
        """
        current_lat = truck_state.telemetry.currentLocation.latitude
        current_lon = truck_state.telemetry.currentLocation.longitude
        
        # Get stations for this truck
        truck_stations = self.stations_by_truck.get(truck_state.truckId, [])
        
        if search_strategy == "along_planned_route":
            # Filter stations on planned route
            route_waypoints = [
                (wp.latitude, wp.longitude) 
                for wp in truck_state.currentTrip.plannedRoute
            ]
            
            filtered_stations = [
                s for s in truck_stations
                if s.onPlannedRoute and is_point_on_route(
                    s.location.latitude,
                    s.location.longitude,
                    route_waypoints,
                    threshold_km=50.0
                )
            ]
        else:
            # Alternative locations - all available stations
            filtered_stations = list(self.stations.values())
        
        # Calculate distances and sort
        for station in filtered_stations:
            distance = calculate_distance(
                current_lat, current_lon,
                station.location.latitude, station.location.longitude
            )
            station.distance = round(distance, 2)
            station.travelTime = calculate_eta_minutes(distance)
        
        # Sort by distance and return top results
        filtered_stations.sort(key=lambda s: s.distance or float('inf'))
        
        # Filter out unavailable stations
        available_stations = [
            s for s in filtered_stations
            if s.status == "AVAILABLE" and s.baysAvailable > 0
        ]
        
        return available_stations[:max_results]
    
    def update_station(self, station_id: str, update: StationUpdateRequest) -> Optional[Station]:
        """Update station"""
        station = self.stations.get(station_id)
        if not station:
            return None
        
        if update.baysAvailable is not None:
            station.baysAvailable = update.baysAvailable
        
        if update.status is not None:
            station.status = update.status
        
        return station
    
    def reserve_bay(self, station_id: str) -> bool:
        """Reserve a bay at station"""
        station = self.stations.get(station_id)
        if not station or station.baysAvailable <= 0:
            return False
        
        station.baysAvailable -= 1
        if station.baysAvailable == 0:
            station.status = "FULL"
        
        return True
    
    def release_bay(self, station_id: str) -> bool:
        """Release a bay at station"""
        station = self.stations.get(station_id)
        if not station:
            return False
        
        if station.baysAvailable < station.totalBays:
            station.baysAvailable += 1
            station.status = "AVAILABLE"
        
        return True


    def get_stations_for_route(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        route_type: str = "planned",
        route_id: str | None = None
    ) -> List[Station]:
        """
        Get stations along a specific route (planned or alternative).
        Generates stations every 50-100km along the route.
        """
        # Create route key for caching
        route_key = f"{route_type}_{route_id or 'default'}_{origin_lat}_{origin_lon}_{dest_lat}_{dest_lon}"
        
        # Check cache
        if route_key in self.stations_by_route:
            return self.stations_by_route[route_key]
        
        # Create origin and destination
        origin = Location(
            name=f"Origin ({origin_lat:.4f}, {origin_lon:.4f})",
            latitude=origin_lat,
            longitude=origin_lon
        )
        destination = Location(
            name=f"Destination ({dest_lat:.4f}, {dest_lon:.4f})",
            latitude=dest_lat,
            longitude=dest_lon
        )
        
        # Generate waypoints for this route
        if route_type == "alternative" and route_id:
            # Generate alternative route waypoints with variation
            variation = int(route_id.split('-')[-1]) if '-' in route_id else 1
            waypoints = self._generate_alternative_waypoints(origin, destination, variation)
        else:
            # Generate planned route waypoints
            waypoints = generate_route_waypoints(origin, destination)
        
        # Generate stations along these waypoints
        stations = generate_stations_along_route(waypoints)
        
        # Mark route type
        for station in stations:
            station.onPlannedRoute = (route_type == "planned")
        
        # Store in main stations dict and cache
        for station in stations:
            self.stations[station.stationId] = station
        
        self.stations_by_route[route_key] = stations
        
        return stations
    
    def _generate_alternative_waypoints(
        self,
        origin: Location,
        destination: Location,
        variation: int
    ) -> List[RouteWaypoint]:
        """Generate alternative route waypoints with variation"""
        from ..utils.data_generator import I95_CORRIDOR
        
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
            
            # Different step sizes for variations
            step = 2 if variation == 1 else (3 if variation == 2 else 4)
            highway = f"Alt-{variation}"
            
            for i in range(origin_idx, dest_idx + 1, step):
                idx = min(i, len(I95_CORRIDOR) - 1)
                city, lat, lon = I95_CORRIDOR[idx]
                
                # Add VERY slight offset for variation to keep on land
                # Reduced from ±0.02 (±2.2km) to ±0.005 (±0.55km) to prevent water placement
                lat_offset = random.uniform(-0.005, 0.005)
                lon_offset = random.uniform(-0.005, 0.005)
                
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
station_service = StationService()

# Made with Bob
