from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .models import Alert, Recommendation, RiskResult


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def risk_band(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def calculate_days_of_supply(inventory: dict[str, Any] | None) -> float:
    if not inventory:
        return 0.0
    on_hand = float(inventory.get("on_hand_qty", 0))
    reserved = float(inventory.get("reserved_qty", 0))
    daily_usage = float(inventory.get("daily_usage_qty", 0))
    available = max(on_hand - reserved, 0)
    if daily_usage <= 0:
        return 999.0 if available > 0 else 0.0
    return round(available / daily_usage, 2)


def choose_priority_order(customer_orders: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not customer_orders:
        return None
    priority_rank = {"STRATEGIC": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    return max(
        customer_orders,
        key=lambda order: (
            priority_rank.get(order.get("priority", "LOW"), 1),
            float(order.get("revenue_at_risk", 0)),
        ),
    )


def find_alternate_supplier(
    component_id: str,
    primary_supplier_id: str | None,
    suppliers: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    candidates = []
    for supplier in suppliers.values():
        if supplier.get("supplier_id") == primary_supplier_id:
            continue
        if component_id in supplier.get("alternate_for_components", []):
            candidates.append(supplier)
    if not candidates:
        return None
    return max(candidates, key=lambda s: float(s.get("reliability_score", 0)))


def score_component_risk(
    component_id: str,
    suppliers: dict[str, dict[str, Any]],
    component_master: dict[str, dict[str, Any]],
    inventory_levels: dict[str, dict[str, Any]],
    purchase_orders: dict[str, dict[str, Any]],
    shipments: dict[str, dict[str, Any]],
    customer_orders_by_component: dict[str, list[dict[str, Any]]],
    external_risk_events: list[dict[str, Any]],
) -> tuple[RiskResult, Recommendation, Alert]:
    inventory = inventory_levels.get(component_id)
    component = component_master.get(component_id, {})
    relevant_shipments = [s for s in shipments.values() if s.get("component_id") == component_id and s.get("status") != "DELIVERED"]
    relevant_pos = [po for po in purchase_orders.values() if po.get("component_id") == component_id]
    customer_order = choose_priority_order(customer_orders_by_component.get(component_id, []))

    days_supply = calculate_days_of_supply(inventory)
    max_delay_hours = max([int(s.get("delay_hours", 0)) for s in relevant_shipments] or [0])
    max_delay_days = round(max_delay_hours / 24, 2)

    primary_supplier_id = None
    if relevant_shipments:
        primary_supplier_id = max(relevant_shipments, key=lambda s: int(s.get("delay_hours", 0))).get("supplier_id")
    elif relevant_pos:
        primary_supplier_id = relevant_pos[-1].get("supplier_id")

    supplier = suppliers.get(primary_supplier_id or "", {})
    supplier_reliability = float(supplier.get("reliability_score", 100))

    route_ids = {s.get("route_id") for s in relevant_shipments if s.get("route_id")}
    relevant_external = [e for e in external_risk_events if e.get("route_id") in route_ids]
    max_external_severity = max([int(e.get("severity", 0)) for e in relevant_external] or [0])
    external_delay_hours = max([int(e.get("expected_delay_hours", 0)) for e in relevant_external] or [0])

    inventory_risk = 0
    if days_supply <= 0:
        inventory_risk = 35
    elif days_supply < max(max_delay_days, 1):
        inventory_risk = 35
    elif days_supply < 3:
        inventory_risk = 25
    elif days_supply < 7:
        inventory_risk = 15

    shipment_delay_risk = min(30, int(max_delay_hours / 3))

    supplier_risk = 0
    if supplier_reliability < 70:
        supplier_risk = 20
    elif supplier_reliability < 80:
        supplier_risk = 15
    elif supplier_reliability < 90:
        supplier_risk = 8

    customer_priority = customer_order.get("priority") if customer_order else "LOW"
    revenue_at_risk = float(customer_order.get("revenue_at_risk", 0)) if customer_order else 0
    customer_impact_risk = 0
    if customer_priority == "STRATEGIC":
        customer_impact_risk = 20
    elif customer_priority == "HIGH":
        customer_impact_risk = 15
    elif revenue_at_risk >= 250000:
        customer_impact_risk = 10

    external_event_risk = min(20, max_external_severity * 4 + int(external_delay_hours / 12))

    alternate_supplier = find_alternate_supplier(component_id, primary_supplier_id, suppliers)
    mitigation_credit = 0
    if alternate_supplier:
        mitigation_credit += 10
    if component.get("criticality") in {"LOW", "MEDIUM"}:
        mitigation_credit += 5

    raw_score = inventory_risk + shipment_delay_risk + supplier_risk + customer_impact_risk + external_event_risk - mitigation_credit
    score = max(0, min(100, raw_score))
    band = risk_band(score)

    root_cause = determine_root_cause(inventory_risk, shipment_delay_risk, supplier_risk, external_event_risk, days_supply, max_delay_hours)
    risk_id = f"RISK-{uuid4().hex[:10].upper()}"
    event_time = utc_now()
    result = RiskResult(
        risk_id=risk_id,
        component_id=component_id,
        supplier_id=primary_supplier_id,
        customer_order_id=customer_order.get("customer_order_id") if customer_order else None,
        risk_score=score,
        risk_band=band,
        root_cause=root_cause,
        days_of_supply=days_supply,
        max_delay_hours=max_delay_hours,
        scoring_factors={
            "inventory_risk": inventory_risk,
            "shipment_delay_risk": shipment_delay_risk,
            "supplier_risk": supplier_risk,
            "customer_impact_risk": customer_impact_risk,
            "external_event_risk": external_event_risk,
            "mitigation_credit": mitigation_credit,
            "supplier_reliability": supplier_reliability,
            "external_delay_hours": external_delay_hours,
            "alternate_supplier_id": alternate_supplier.get("supplier_id") if alternate_supplier else None,
        },
        event_time=event_time,
    )

    recommendation = build_recommendation(result, customer_order, alternate_supplier)
    alert = build_alert(result, recommendation)
    return result, recommendation, alert


def determine_root_cause(
    inventory_risk: int,
    shipment_delay_risk: int,
    supplier_risk: int,
    external_event_risk: int,
    days_supply: float,
    max_delay_hours: int,
) -> str:
    if inventory_risk >= 25 and shipment_delay_risk >= 20:
        return "Shipment delay exceeds available inventory coverage"
    if inventory_risk >= 25:
        return f"Inventory coverage is low at {days_supply} days of supply"
    if shipment_delay_risk >= 20:
        return f"Shipment ETA has slipped by {max_delay_hours} hours"
    if external_event_risk >= 12:
        return "External route or regional disruption is increasing supply risk"
    if supplier_risk >= 15:
        return "Supplier reliability risk is elevated"
    return "Risk is currently within monitored thresholds"


def build_recommendation(
    result: RiskResult,
    customer_order: dict[str, Any] | None,
    alternate_supplier: dict[str, Any] | None,
) -> Recommendation:
    customer_text = "No high-priority customer order is currently linked."
    if customer_order:
        customer_text = (
            f"Customer order {customer_order.get('customer_order_id')} for {customer_order.get('customer_name')} "
            f"is {customer_order.get('priority')} priority with ${customer_order.get('revenue_at_risk'):,.0f} revenue at risk."
        )

    if result.risk_band in {"CRITICAL", "HIGH"}:
        if alternate_supplier:
            action = (
                f"Allocate current stock to the highest-priority demand, source partial quantity from alternate supplier "
                f"{alternate_supplier.get('supplier_id')}, expedite the delayed shipment, and notify procurement and planning."
            )
        else:
            action = (
                "Allocate current stock to the highest-priority demand, expedite the delayed shipment, "
                "request a confirmed supplier recovery ETA, and prepare production schedule adjustment."
            )
    elif result.risk_band == "MEDIUM":
        action = "Notify planner, monitor ETA changes, and confirm supplier recovery plan."
    else:
        action = "Continue monitoring. No immediate action required."

    confidence = 0.86 if result.risk_band in {"CRITICAL", "HIGH"} else 0.72
    return Recommendation(
        recommendation_id=f"REC-{uuid4().hex[:10].upper()}",
        risk_id=result.risk_id,
        component_id=result.component_id,
        customer_order_id=result.customer_order_id,
        risk_band=result.risk_band,
        business_impact=customer_text,
        recommended_action=action,
        confidence=confidence,
        event_time=result.event_time,
    )


def build_alert(result: RiskResult, recommendation: Recommendation) -> Alert:
    severity = {
        "CRITICAL": "CRITICAL",
        "HIGH": "HIGH",
        "MEDIUM": "WARNING",
        "LOW": "INFO",
    }[result.risk_band]
    title = f"{result.risk_band} supply chain risk for component {result.component_id}"
    message = (
        f"{result.root_cause}. Risk score is {result.risk_score}. "
        f"Days of supply: {result.days_of_supply}. Max delay: {result.max_delay_hours} hours."
    )
    return Alert(
        alert_id=f"ALERT-{uuid4().hex[:10].upper()}",
        risk_id=result.risk_id,
        severity=severity,
        title=title,
        message=message,
        recommended_action=recommendation.recommended_action,
        event_time=result.event_time,
    )
