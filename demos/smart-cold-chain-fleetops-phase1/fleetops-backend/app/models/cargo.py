from pydantic import BaseModel, Field
from typing import Optional


class Cargo(BaseModel):
    """Cargo model matching Schema_Logistics_final.md"""
    type: str = Field(..., description="Cargo type (e.g., temperature_sensitive_vaccines)")
    value: float = Field(..., description="Cargo value in USD")
    criticalThreshold: float = Field(..., description="Critical temperature threshold in Celsius")
    timeToSpoilage: int = Field(..., description="Time to spoilage in minutes")
    currentTemperature: Optional[float] = Field(None, description="Current cargo temperature")
    condition: Optional[str] = Field(None, description="Cargo condition (GOOD, AT_RISK, SPOILED)")

    class Config:
        json_schema_extra = {
            "example": {
                "type": "temperature_sensitive_vaccines",
                "value": 200000,
                "criticalThreshold": -10,
                "timeToSpoilage": 120,
                "currentTemperature": -8.0,
                "condition": "AT_RISK"
            }
        }

# Made with Bob
