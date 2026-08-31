"""Configuration settings loader."""
import os
import yaml
import os
import re
from pathlib import Path
from typing import Dict, Any, Optional, Literal
from pydantic import BaseModel


class PersistenceLevels(BaseModel):
    """Persistence level configuration."""
    initial_data: bool = True
    on_events: bool = True
    interval_seconds: int = 30


class JSONConfig(BaseModel):
    """JSON persistence configuration."""
    data_directory: str = "./data"


class AstraConfig(BaseModel):
    """Astra DB configuration."""
    enabled: bool = False
    secure_connect_bundle: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    keyspace: str = "fleetops"


class Db2Config(BaseModel):
    """IBM Db2 configuration."""
    enabled: bool = False
    host: str = "localhost"
    port: int = 50000
    database: str = "fleetops"
    username: Optional[str] = None
    password: Optional[str] = None
    db_schema: str = "fleetops"


class PersistenceConfig(BaseModel):
    """Persistence configuration."""
    enabled: bool = True
    type: str = "json"
    levels: PersistenceLevels = PersistenceLevels()
    json_config: JSONConfig = JSONConfig()
    astra: AstraConfig = AstraConfig()
    db2: Db2Config = Db2Config()


class SimulationConfig(BaseModel):
    """Simulation configuration."""
    speed_multiplier: int = 10
    update_interval: int = 5
    num_trucks: int = 10
    incident_trucks: int = 4
    station_spacing_km: int = 120


class WatsonxOrchestrateConfig(BaseModel):
    """watsonx Orchestrate configuration."""
    enabled: bool = False
    url: str = ""
    api_key: str = ""
    agent_weather: str = ""
    agent_station: str = ""
    agent_route: str = ""
    agent_decision: str = ""
    agent_notification: str = ""
    timeout: int = 60


class Settings(BaseModel):
    """Application settings."""
    persistence: PersistenceConfig = PersistenceConfig()
    simulation: SimulationConfig = SimulationConfig()
    watsonx_orchestrate: WatsonxOrchestrateConfig = WatsonxOrchestrateConfig()


class ConfigLoader:
    """Configuration loader singleton."""
    
    _instance: Optional['ConfigLoader'] = None
    _settings: Optional[Settings] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def _interpolate_env_vars(self, data: Any) -> Any:
        """Recursively interpolate environment variables in config data.
        
        Supports ${VAR_NAME} and ${VAR_NAME:default_value} syntax.
        
        Args:
            data: Configuration data (dict, list, str, or other)
            
        Returns:
            Data with environment variables interpolated
        """
        if isinstance(data, dict):
            return {key: self._interpolate_env_vars(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._interpolate_env_vars(item) for item in data]
        elif isinstance(data, str):
            # Pattern matches ${VAR_NAME} or ${VAR_NAME:default}
            pattern = r'\$\{([^}:]+)(?::([^}]*))?\}'
            
            def replace_env_var(match):
                var_name = match.group(1)
                default_value = match.group(2) if match.group(2) is not None else ""
                return os.environ.get(var_name, default_value)
            
            return re.sub(pattern, replace_env_var, data)
        else:
            return data
    
    def load_config(self, config_path: str = "config.yaml") -> Settings:
        """Load configuration from YAML file with environment variable interpolation.
        
        Args:
            config_path: Path to configuration file
            
        Returns:
            Settings object
        """
        if self._settings is not None:
            return self._settings
        
        config_file = Path(config_path)
        
        if not config_file.exists():
            print(f"Config file {config_path} not found, using defaults")
            self._settings = Settings()
            self._apply_env_overrides()
            return self._settings
        
        try:
            with open(config_file, 'r') as f:
                config_data = yaml.safe_load(f)
            
            # Interpolate environment variables
            config_data = self._interpolate_env_vars(config_data)
            
            self._settings = Settings(**config_data)
            print(f"✓ Configuration loaded from {config_path}")
            
            # Validate WatsonX configuration if enabled
            if self._settings.watsonx_orchestrate.enabled:
                self._validate_watsonx_config()
            
            return self._settings
        except Exception as e:
            print(f"Error loading config: {e}, using defaults")
            self._settings = Settings()
            self._apply_env_overrides()
            return self._settings
    
    def _validate_watsonx_config(self):
        """Validate WatsonX Orchestrate configuration.
        
        Raises:
            ValueError: If required configuration is missing
        """
        config = self._settings.watsonx_orchestrate
        missing_vars = []
        
        if not config.url or config.url == "":
            missing_vars.append("WATSONX_ORCHESTRATE_URL")
        if not config.api_key or config.api_key == "":
            missing_vars.append("WATSONX_ORCHESTRATE_API_KEY")
        if not config.agent_weather or config.agent_weather == "":
            missing_vars.append("WATSONX_ORCHESTRATE_AGENT_WEATHER")
        if not config.agent_station or config.agent_station == "":
            missing_vars.append("WATSONX_ORCHESTRATE_AGENT_STATION")
        if not config.agent_route or config.agent_route == "":
            missing_vars.append("WATSONX_ORCHESTRATE_AGENT_ROUTE")
        if not config.agent_decision or config.agent_decision == "":
            missing_vars.append("WATSONX_ORCHESTRATE_AGENT_DECISION")
        if not config.agent_notification or config.agent_notification == "":
            missing_vars.append("WATSONX_ORCHESTRATE_AGENT_NOTIFICATION")
        
        if missing_vars:
            error_msg = (
                f"WatsonX Orchestrate is enabled but required environment variables are missing:\n"
                f"  {', '.join(missing_vars)}\n"
                f"Please ensure these environment variables are set via Kubernetes secrets."
            )
            print(f"❌ {error_msg}")
            raise ValueError(error_msg)
        
        print(f"✓ WatsonX Orchestrate configuration validated")
        print(f"  - URL: {config.url[:50]}...")
        print(f"  - API Key: {'*' * 20}")
        print(f"  - Weather Agent: {config.agent_weather}")
        print(f"  - Station Agent: {config.agent_station}")
        print(f"  - Route Agent: {config.agent_route}")
        print(f"  - Decision Agent: {config.agent_decision}")
        print(f"  - Notification Agent: {config.agent_notification}")
    
    def get_settings(self) -> Settings:
        """Get current settings.
        
        Returns:
            Settings object
        """
        if self._settings is None:
            return self.load_config()
        return self._settings


# Global config loader instance
_config_loader = ConfigLoader()


def get_settings() -> Settings:
    """Get application settings.
    
    Returns:
        Settings object
    """
    return _config_loader.get_settings()


def load_config(config_path: str = "config.yaml") -> Settings:
    """Load configuration from file.
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        Settings object
    """
    return _config_loader.load_config(config_path)

# Made with Bob
