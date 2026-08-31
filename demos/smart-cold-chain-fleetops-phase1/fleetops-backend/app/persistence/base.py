"""Abstract base class for persistence adapters."""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class PersistenceAdapter(ABC):
    """Abstract base class for persistence adapters."""
    
    @abstractmethod
    async def save_trucks(self, trucks: List[Dict[str, Any]]) -> bool:
        """Save truck states.
        
        Args:
            trucks: List of truck state dictionaries
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def load_trucks(self) -> List[Dict[str, Any]]:
        """Load truck states.
        
        Returns:
            List of truck state dictionaries
        """
        pass
    
    @abstractmethod
    async def save_stations(self, stations: List[Dict[str, Any]]) -> bool:
        """Save station data.
        
        Args:
            stations: List of station dictionaries
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def load_stations(self) -> List[Dict[str, Any]]:
        """Load station data.
        
        Returns:
            List of station dictionaries
        """
        pass
    
    @abstractmethod
    async def save_weather(self, weather: List[Dict[str, Any]]) -> bool:
        """Save weather data.
        
        Args:
            weather: List of weather dictionaries
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def load_weather(self) -> List[Dict[str, Any]]:
        """Load weather data.
        
        Returns:
            List of weather dictionaries
        """
        pass
    
    @abstractmethod
    async def save_alerts(self, alerts: List[Dict[str, Any]]) -> bool:
        """Save alerts.
        
        Args:
            alerts: List of alert dictionaries
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def load_alerts(self) -> List[Dict[str, Any]]:
        """Load alerts.
        
        Returns:
            List of alert dictionaries
        """
        pass
    
    @abstractmethod
    async def save_incidents(self, incidents: List[Dict[str, Any]]) -> bool:
        """Save incidents.
        
        Args:
            incidents: List of incident dictionaries
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def load_incidents(self) -> List[Dict[str, Any]]:
        """Load incidents.
        
        Returns:
            List of incident dictionaries
        """
        pass
    
    @abstractmethod
    async def reset_all(self) -> bool:
        """Reset all persisted data.
        
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def get_status(self) -> Dict[str, Any]:
        """Get persistence status information.
        
        Returns:
            Dictionary with status information
        """
        pass

# Made with Bob
