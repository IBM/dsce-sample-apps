"""Persistence service for managing data persistence."""
from typing import Optional, Dict, Any, List
from ..persistence.base import PersistenceAdapter
from ..persistence.json_adapter import JSONPersistenceAdapter
from ..config.settings import get_settings


class PersistenceService:
    """Orchestrates data persistence across different backends."""
    
    def __init__(self):
        """Initialize persistence service."""
        self.adapter: Optional[PersistenceAdapter] = None
        self.enabled = False
        self.config = get_settings().persistence
        
        if self.config.enabled:
            self._initialize_adapter()
    
    def _initialize_adapter(self):
        """Initialize the appropriate persistence adapter based on configuration."""
        adapter_type = self.config.type
        
        try:
            if adapter_type == "json":
                self.adapter = JSONPersistenceAdapter(
                    data_dir=self.config.json_config.data_directory
                )
                self.enabled = True
                print(f"✓ JSON persistence initialized: {self.config.json_config.data_directory}")
            
            elif adapter_type == "astra":
                if not self.config.astra.enabled:
                    print("✗ Astra DB persistence configured but not enabled")
                    return
                
                try:
                    from ..persistence.astra_adapter import AstraPersistenceAdapter
                    self.adapter = AstraPersistenceAdapter(self.config.astra)
                    self.enabled = True
                    print("✓ Astra DB persistence initialized")
                except ImportError:
                    print("✗ Astra DB adapter not available (cassandra-driver not installed)")
                except Exception as e:
                    print(f"✗ Failed to initialize Astra DB: {e}")
            
            elif adapter_type == "db2":
                if not self.config.db2.enabled:
                    print("✗ IBM Db2 persistence configured but not enabled")
                    return
                
                try:
                    from ..persistence.db2_adapter import Db2PersistenceAdapter
                    self.adapter = Db2PersistenceAdapter(self.config.db2)
                    self.enabled = True
                    print("✓ IBM Db2 persistence initialized")
                except ImportError:
                    print("✗ IBM Db2 adapter not available (ibm_db not installed)")
                except Exception as e:
                    print(f"✗ Failed to initialize IBM Db2: {e}")
            
            else:
                print(f"✗ Unknown persistence type: {adapter_type}")
        
        except Exception as e:
            print(f"✗ Error initializing persistence: {e}")
            self.enabled = False
    
    async def save_state(self, trucks, stations, weather, alerts, incidents):
        """Save complete simulation state.
        
        Args:
            trucks: List of TruckState objects
            stations: List of Station objects
            weather: List of weather data
            alerts: List of Alert objects
            incidents: List of Incident objects
        """
        if not self.enabled or not self.adapter:
            return
        
        try:
            # Convert Pydantic models to dicts
            trucks_data = [t.dict() if hasattr(t, 'dict') else t for t in trucks]
            stations_data = [s.dict() if hasattr(s, 'dict') else s for s in stations]
            alerts_data = [a.dict() if hasattr(a, 'dict') else a for a in alerts]
            incidents_data = [i.dict() if hasattr(i, 'dict') else i for i in incidents]
            
            # Save all entities
            await self.adapter.save_trucks(trucks_data)
            await self.adapter.save_stations(stations_data)
            await self.adapter.save_weather(weather)
            await self.adapter.save_alerts(alerts_data)
            await self.adapter.save_incidents(incidents_data)
            
            print(f"✓ State persisted: {len(trucks_data)} trucks, {len(stations_data)} stations, "
                  f"{len(alerts_data)} alerts, {len(incidents_data)} incidents")
        
        except Exception as e:
            print(f"✗ Error saving state: {e}")
    
    async def load_state(self) -> Optional[Dict[str, Any]]:
        """Load complete simulation state.
        
        Returns:
            Dictionary with all persisted data or None if persistence disabled
        """
        if not self.enabled or not self.adapter:
            return None
        
        try:
            trucks = await self.adapter.load_trucks()
            stations = await self.adapter.load_stations()
            weather = await self.adapter.load_weather()
            alerts = await self.adapter.load_alerts()
            incidents = await self.adapter.load_incidents()
            
            print(f"✓ State loaded: {len(trucks)} trucks, {len(stations)} stations, "
                  f"{len(alerts)} alerts, {len(incidents)} incidents")
            
            return {
                "trucks": trucks,
                "stations": stations,
                "weather": weather,
                "alerts": alerts,
                "incidents": incidents
            }
        
        except Exception as e:
            print(f"✗ Error loading state: {e}")
            return None
    
    async def save_on_event(self, event_type: str, data: Any):
        """Save data when specific events occur.
        
        Args:
            event_type: Type of event (route_change, alert_created, incident_occurred)
            data: Event data to persist
        """
        if not self.enabled or not self.config.levels.on_events:
            return
        
        print(f"→ Event persistence: {event_type}")
        # Event-specific persistence logic can be added here
    
    def should_persist_on_interval(self) -> bool:
        """Check if periodic persistence is enabled.
        
        Returns:
            True if interval persistence is enabled
        """
        return (self.enabled and 
                self.config.levels.interval_seconds > 0)
    
    def get_interval_seconds(self) -> int:
        """Get the persistence interval in seconds.
        
        Returns:
            Interval in seconds
        """
        return self.config.levels.interval_seconds if self.enabled else 0


# Global persistence service instance
_persistence_service: Optional[PersistenceService] = None


def get_persistence_service() -> PersistenceService:
    """Get or create the global persistence service instance.
    
    Returns:
        PersistenceService instance
    """
    global _persistence_service
    if _persistence_service is None:
        _persistence_service = PersistenceService()
    return _persistence_service

# Made with Bob
