from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RiskResult:
    risk_id: str
    component_id: str
    supplier_id: str | None
    customer_order_id: str | None
    risk_score: int
    risk_band: str
    root_cause: str
    days_of_supply: float
    max_delay_hours: int
    scoring_factors: dict[str, Any] = field(default_factory=dict)
    event_time: str = ""


@dataclass
class Recommendation:
    recommendation_id: str
    risk_id: str
    component_id: str
    customer_order_id: str | None
    risk_band: str
    business_impact: str
    recommended_action: str
    confidence: float
    event_time: str


@dataclass
class Alert:
    alert_id: str
    risk_id: str
    severity: str
    title: str
    message: str
    recommended_action: str
    event_time: str
