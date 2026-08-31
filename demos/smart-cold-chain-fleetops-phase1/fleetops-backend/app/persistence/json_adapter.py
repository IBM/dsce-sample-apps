"""JSON file-based persistence adapter."""
import json
import os
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timezone
from .base import PersistenceAdapter


class JSONPersistenceAdapter(PersistenceAdapter):
    """JSON file-based persistence implementation."""
    
    def __init__(self, data_dir: str = "data"):
        """Initialize JSON persistence adapter.
        
        Args:
            data_dir: Directory for storing JSON files (relative to project root or absolute)
        """
        # Convert to Path object
        data_path = Path(data_dir)
        
        # If path is not absolute, make it relative to project root
        if not data_path.is_absolute():
            # Get project root (4 levels up from this file: persistence -> app -> fleetops-backend -> project root)
            project_root = Path(__file__).parent.parent.parent
            data_path = project_root / data_dir
        
        self.data_dir = data_path.resolve()  # Resolve to absolute path
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"→ Data directory resolved to: {self.data_dir}")
        
        # Create subdirectories
        self.trucks_dir = self.data_dir / "trucks"
        self.stations_dir = self.data_dir / "stations"
        self.weather_dir = self.data_dir / "weather"
        self.alerts_dir = self.data_dir / "alerts"
        self.incidents_dir = self.data_dir / "incidents"
        
        for directory in [self.trucks_dir, self.stations_dir, self.weather_dir, 
                         self.alerts_dir, self.incidents_dir]:
            directory.mkdir(exist_ok=True)
        
        self.last_save_time = None
    
    async def save_trucks(self, trucks: List[Dict[str, Any]]) -> bool:
        """Save truck states to JSON file (single file only)."""
        try:
            # Save only as latest file (no timestamped files)
            latest_file = self.trucks_dir / "trucks_latest.json"
            with open(latest_file, 'w') as f:
                json.dump(trucks, f, indent=2, default=str)
            
            self.last_save_time = datetime.now(timezone.utc)
            return True
        except Exception as e:
            print(f"Error saving trucks: {e}")
            return False
    
    async def load_trucks(self) -> List[Dict[str, Any]]:
        """Load truck states from latest JSON file."""
        try:
            # Try latest file first
            latest_file = self.trucks_dir / "trucks_latest.json"
            if latest_file.exists():
                with open(latest_file, 'r') as f:
                    return json.load(f)
            
            # Fallback to finding most recent timestamped file
            truck_files = sorted(self.trucks_dir.glob("trucks_*.json"), reverse=True)
            if truck_files:
                with open(truck_files[0], 'r') as f:
                    return json.load(f)
            
            return []
        except Exception as e:
            print(f"Error loading trucks: {e}")
            return []
    
    async def save_stations(self, stations: List[Dict[str, Any]]) -> bool:
        """Save station data to JSON file (single file only)."""
        try:
            # Save only as latest file (no timestamped files)
            latest_file = self.stations_dir / "stations_latest.json"
            with open(latest_file, 'w') as f:
                json.dump(stations, f, indent=2, default=str)
            
            self.last_save_time = datetime.now(timezone.utc)
            return True
        except Exception as e:
            print(f"Error saving stations: {e}")
            return False
    
    async def load_stations(self) -> List[Dict[str, Any]]:
        """Load station data from latest JSON file."""
        try:
            latest_file = self.stations_dir / "stations_latest.json"
            if latest_file.exists():
                with open(latest_file, 'r') as f:
                    return json.load(f)
            
            station_files = sorted(self.stations_dir.glob("stations_*.json"), reverse=True)
            if station_files:
                with open(station_files[0], 'r') as f:
                    return json.load(f)
            
            return []
        except Exception as e:
            print(f"Error loading stations: {e}")
            return []
    
    async def save_weather(self, weather: List[Dict[str, Any]]) -> bool:
        """Save weather data to JSON file (single file only)."""
        try:
            # Save only as latest file (no timestamped files)
            latest_file = self.weather_dir / "weather_latest.json"
            with open(latest_file, 'w') as f:
                json.dump(weather, f, indent=2, default=str)
            
            self.last_save_time = datetime.now(timezone.utc)
            return True
        except Exception as e:
            print(f"Error saving weather: {e}")
            return False
    
    async def load_weather(self) -> List[Dict[str, Any]]:
        """Load weather data from latest JSON file."""
        try:
            latest_file = self.weather_dir / "weather_latest.json"
            if latest_file.exists():
                with open(latest_file, 'r') as f:
                    return json.load(f)
            
            weather_files = sorted(self.weather_dir.glob("weather_*.json"), reverse=True)
            if weather_files:
                with open(weather_files[0], 'r') as f:
                    return json.load(f)
            
            return []
        except Exception as e:
            print(f"Error loading weather: {e}")
            return []
    
    async def save_alerts(self, alerts: List[Dict[str, Any]]) -> bool:
        """Save alerts to a single timestamped JSON file (append mode)."""
        try:
            # Use a single file for all alerts with timestamps
            alerts_file = self.alerts_dir / "alerts_history.json"
            
            # Load existing alerts
            existing_alerts = []
            if alerts_file.exists():
                try:
                    with open(alerts_file, 'r') as f:
                        existing_alerts = json.load(f)
                except:
                    existing_alerts = []
            
            # Add timestamp to each new alert if not present
            for alert in alerts:
                if 'saved_at' not in alert:
                    alert['saved_at'] = datetime.now(timezone.utc).isoformat()
            
            # Merge with existing (avoid duplicates by alertId)
            existing_ids = {a.get('alertId') for a in existing_alerts}
            new_alerts = [a for a in alerts if a.get('alertId') not in existing_ids]
            
            if new_alerts:
                all_alerts = existing_alerts + new_alerts
                with open(alerts_file, 'w') as f:
                    json.dump(all_alerts, f, indent=2, default=str)
            
            # Also save current active alerts as latest
            latest_file = self.alerts_dir / "alerts_latest.json"
            with open(latest_file, 'w') as f:
                json.dump(alerts, f, indent=2, default=str)
            
            self.last_save_time = datetime.now(timezone.utc)
            return True
        except Exception as e:
            print(f"Error saving alerts: {e}")
            return False
    
    async def load_alerts(self) -> List[Dict[str, Any]]:
        """Load alerts from latest JSON file."""
        try:
            latest_file = self.alerts_dir / "alerts_latest.json"
            if latest_file.exists():
                with open(latest_file, 'r') as f:
                    return json.load(f)
            
            alert_files = sorted(self.alerts_dir.glob("alerts_*.json"), reverse=True)
            if alert_files:
                with open(alert_files[0], 'r') as f:
                    return json.load(f)
            
            return []
        except Exception as e:
            print(f"Error loading alerts: {e}")
            return []
    
    async def save_incidents(self, incidents: List[Dict[str, Any]]) -> bool:
        """Save incidents to JSON file (single file only)."""
        try:
            # Save only as latest file (no timestamped files)
            latest_file = self.incidents_dir / "incidents_latest.json"
            with open(latest_file, 'w') as f:
                json.dump(incidents, f, indent=2, default=str)
            
            self.last_save_time = datetime.now(timezone.utc)
            return True
        except Exception as e:
            print(f"Error saving incidents: {e}")
            return False
    
    async def load_incidents(self) -> List[Dict[str, Any]]:
        """Load incidents from latest JSON file."""
        try:
            latest_file = self.incidents_dir / "incidents_latest.json"
            if latest_file.exists():
                with open(latest_file, 'r') as f:
                    return json.load(f)
            
            incident_files = sorted(self.incidents_dir.glob("incidents_*.json"), reverse=True)
            if incident_files:
                with open(incident_files[0], 'r') as f:
                    return json.load(f)
            
            return []
        except Exception as e:
            print(f"Error loading incidents: {e}")
            return []
    
    async def reset_all(self) -> bool:
        """Reset all persisted data by deleting JSON files."""
        try:
            for directory in [self.trucks_dir, self.stations_dir, self.weather_dir,
                            self.alerts_dir, self.incidents_dir]:
                for file in directory.glob("*.json"):
                    file.unlink()
            self.last_save_time = None
            print("✓ All persistence data reset")
            return True
        except Exception as e:
            print(f"Error resetting data: {e}")
            return False
    
    async def get_status(self) -> Dict[str, Any]:
        """Get persistence status information."""
        try:
            def count_items(file_path: Path) -> int:
                if not file_path.exists():
                    return 0
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    return len(data) if isinstance(data, list) else 0
            
            def count_files(directory: Path, pattern: str) -> int:
                return len(list(directory.glob(pattern)))
            
            return {
                "type": "json",
                "enabled": True,
                "data_directory": str(self.data_dir),
                "last_save": self.last_save_time.isoformat() if self.last_save_time else None,
                "data_size": {
                    "trucks": count_items(self.trucks_dir / "trucks_latest.json"),
                    "stations": count_items(self.stations_dir / "stations_latest.json"),
                    "weather": count_items(self.weather_dir / "weather_latest.json"),
                    "alerts": count_items(self.alerts_dir / "alerts_latest.json"),
                    "incidents": count_items(self.incidents_dir / "incidents_latest.json")
                },
                "historical_snapshots": {
                    "trucks": count_files(self.trucks_dir, "trucks_*.json"),
                    "stations": count_files(self.stations_dir, "stations_*.json"),
                    "weather": count_files(self.weather_dir, "weather_*.json"),
                    "alerts": count_files(self.alerts_dir, "alerts_*.json"),
                    "incidents": count_files(self.incidents_dir, "incidents_*.json")
                }
            }
        except Exception as e:
            return {
                "type": "json",
                "enabled": True,
                "error": str(e)
            }

# Made with Bob
