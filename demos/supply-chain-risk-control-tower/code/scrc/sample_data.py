from __future__ import annotations

from datetime import datetime, timedelta, timezone
from itertools import cycle
from typing import Any, Iterable
from uuid import uuid4


def now(offset_hours: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=offset_hours)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def eid(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:8].upper()}"


def base_reference_events() -> list[tuple[str, str, dict[str, Any]]]:
    """Reference data sent once at the start of every scenario."""
    return [
        (
            "supplier_profiles",
            "SUP-1007",
            {
                "supplier_id": "SUP-1007",
                "supplier_name": "Pacific Motion Components",
                "region": "APAC",
                "country": "Taiwan",
                "reliability_score": 74,
                "risk_tier": "HIGH",
                "preferred": True,
                "alternate_for_components": [],
                "last_updated": now(),
            },
        ),
        (
            "supplier_profiles",
            "SUP-221",
            {
                "supplier_id": "SUP-221",
                "supplier_name": "Midwest Precision Supply",
                "region": "US-MIDWEST",
                "country": "United States",
                "reliability_score": 91,
                "risk_tier": "LOW",
                "preferred": False,
                "alternate_for_components": ["BRG-9004", "CTRL-4400"],
                "last_updated": now(),
            },
        ),
        (
            "component_master",
            "BRG-9004",
            {
                "component_id": "BRG-9004",
                "component_name": "High-load bearing assembly",
                "criticality": "CRITICAL",
                "lead_time_days": 21,
                "approved_suppliers": ["SUP-1007", "SUP-221"],
                "safety_stock_qty": 600,
                "last_updated": now(),
            },
        ),
        (
            "component_master",
            "CTRL-4400",
            {
                "component_id": "CTRL-4400",
                "component_name": "Industrial controller board",
                "criticality": "HIGH",
                "lead_time_days": 28,
                "approved_suppliers": ["SUP-221"],
                "safety_stock_qty": 120,
                "last_updated": now(),
            },
        ),
        (
            "customer_orders",
            "CO-10491",
            {
                "event_id": eid("EVT"),
                "customer_order_id": "CO-10491",
                "customer_name": "NorthStar Energy Systems",
                "component_id": "BRG-9004",
                "required_qty": 900,
                "committed_ship_date": now(96),
                "priority": "STRATEGIC",
                "revenue_at_risk": 750000,
                "event_time": now(),
            },
        ),
    ]


def scenario_events(scenario: str = "supplier_delay", count: int = 20) -> Iterable[tuple[str, str, dict[str, Any]]]:
    yield from base_reference_events()

    shipment_statuses = cycle(["IN_TRANSIT", "AT_PORT", "CUSTOMS_HOLD", "DELAYED"])
    delay_sequence = cycle([12, 24, 48, 72, 96])
    inventory_sequence = cycle([760, 640, 520, 410, 310, 260])
    external_severity_sequence = cycle([2, 3, 4, 5])

    for idx in range(count):
        if scenario == "recovery" and idx > count // 2:
            delay_hours = 12
            on_hand_qty = 820
            external_severity = 1
        else:
            delay_hours = next(delay_sequence)
            on_hand_qty = next(inventory_sequence)
            external_severity = next(external_severity_sequence)

        po_id = "PO-77881"
        shipment_id = "SHP-33019"
        route_id = "ROUTE-APAC-LAX-CHI"
        event_time = now()

        yield (
            "purchase_orders",
            po_id,
            {
                "event_id": eid("EVT"),
                "po_id": po_id,
                "component_id": "BRG-9004",
                "supplier_id": "SUP-1007",
                "ordered_qty": 1200,
                "committed_eta": now(72),
                "status": "DELAYED" if delay_hours >= 48 else "IN_TRANSIT",
                "event_time": event_time,
            },
        )
        yield (
            "shipments",
            shipment_id,
            {
                "event_id": eid("EVT"),
                "shipment_id": shipment_id,
                "po_id": po_id,
                "supplier_id": "SUP-1007",
                "component_id": "BRG-9004",
                "carrier": "OceanBridge Logistics",
                "status": next(shipment_statuses),
                "current_location": "Port of Los Angeles",
                "eta": now(72 + delay_hours),
                "delay_hours": delay_hours,
                "route_id": route_id,
                "event_time": event_time,
            },
        )
        yield (
            "inventory_levels",
            "BRG-9004",
            {
                "event_id": eid("EVT"),
                "component_id": "BRG-9004",
                "site_id": "PLANT-CHICAGO-01",
                "on_hand_qty": on_hand_qty,
                "reserved_qty": 180,
                "safety_stock_qty": 600,
                "daily_usage_qty": 150,
                "event_time": event_time,
            },
        )

        if scenario in {"supplier_delay", "port_congestion", "recovery"}:
            yield (
                "external_risk_events",
                f"RISK-PORT-{idx}",
                {
                    "event_id": eid("EVT"),
                    "risk_event_id": f"EXT-PORT-{idx:04d}",
                    "event_type": "PORT",
                    "region": "US-WEST",
                    "country": "United States",
                    "route_id": route_id,
                    "severity": external_severity,
                    "description": "Port congestion increasing container dwell time on APAC to Midwest route",
                    "expected_delay_hours": external_severity * 12,
                    "event_time": event_time,
                },
            )
