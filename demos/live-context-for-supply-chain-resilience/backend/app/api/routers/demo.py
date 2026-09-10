# backend/app/api/routers/demo.py
# Demo-only helpers: seed reset, event simulation, audit trail

from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.idempotency import clear_all as clear_idempotency
from app.domain.models import RiskEvent
from app.services import audit
from app.services.risk_detector import detect_late_delivery_risk
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/demo", tags=["demo"])


class DemoResetResponse(BaseModel):
    message: str
    demo_warning: str = "SYNTHETIC_DATA_ONLY – NOT real Shell operational data"


class SimulateDelayBody(BaseModel):
    shipment_id: str = "SHP-90017"
    requirement_id: str = "MR-7781"
    correlation_id: str | None = None


@router.post("/reset", response_model=DemoResetResponse)
async def demo_reset(request: Request) -> DemoResetResponse:
    store.reset_to_seed()
    clear_idempotency()
    audit.clear()
    return DemoResetResponse(message="Demo state reset to seed data")


@router.post("/simulate-delay")
async def simulate_delay(body: SimulateDelayBody, request: Request) -> dict:
    """Trigger the primary demo scenario: late shipment → risk detected."""
    import uuid as _uuid
    cid = body.correlation_id or str(_uuid.uuid4())
    cid = getattr(request.state, "correlation_id", cid)

    shipment = store.get_shipment(body.shipment_id)
    requirement = store.get_requirement(body.requirement_id)
    if not shipment or not requirement:
        return {"error": "Shipment or requirement not found"}

    dest_inventory = store.get_inventory(shipment.destination_location_id, shipment.material_id)
    risk = detect_late_delivery_risk(shipment, requirement, dest_inventory, cid)

    if risk:
        store.upsert_risk(risk)
        audit.record("RISK_DETECTED", cid, risk_id=risk.risk_id,
                     severity=risk.severity, risk_type=risk.risk_type)
        return {"risk_detected": True, "risk_id": risk.risk_id,
                "severity": risk.severity, "correlation_id": cid}
    return {"risk_detected": False, "correlation_id": cid}


# ---------------------------------------------------------------------------
# Populate: inject a realistic multi-risk scenario for demo/UI walkthroughs
# ---------------------------------------------------------------------------

_DEMO_RISKS: list[dict] = [
    {
        "risk_id": "RSK-DM001",
        "correlation_id": "CORR-DEMO-2026-001",
        "event_time": "2026-09-22T08:14:00+00:00",
        "material_id": "CVA-8842",
        "shipment_id": "SHP-90017",
        "requirement_id": "MR-7781",
        "work_package_id": "TW-2047",
        "risk_type": "LATE_DELIVERY",
        "severity": "CRITICAL",
        "status": "INVESTIGATING",
        "facts": {
            "current_eta": "2026-10-14T10:00:00+00:00",
            "required_by": "2026-10-10T00:00:00+00:00",
            "delay_days": 4,
            "available_at_destination": 0,
            "shortage_quantity": 1,
            "delay_reason_code": "TRANSPORT_DISRUPTION",
        },
        "resilience_flags": {
            "primary_supplier_constrained": True,
            "secondary_supplier_constrained": True,
            "alternate_inventory_available": True,
            "approved_substitute_document_exists": False,
            "constrained_supplier_count": 2,
            "active_sourcing_tiers": 3,
        },
    },
    {
        "risk_id": "RSK-DM002",
        "correlation_id": "CORR-DEMO-2026-002",
        "event_time": "2026-09-23T11:45:00+00:00",
        "material_id": "CVA-8842",
        "shipment_id": "SHP-90017",
        "requirement_id": "MR-7781",
        "work_package_id": "TW-2047",
        "risk_type": "SUPPLIER_FAILURE",
        "severity": "HIGH",
        "status": "MITIGATION_PROPOSED",
        "facts": {
            "current_eta": "2026-10-14T10:00:00+00:00",
            "required_by": "2026-10-10T00:00:00+00:00",
            "delay_days": 4,
            "shortage_quantity": 1,
            "delay_reason_code": "QUALITY_HOLD",
        },
        "resilience_flags": {
            "primary_supplier_constrained": True,
            "secondary_supplier_constrained": False,
            "alternate_inventory_available": False,
            "approved_substitute_document_exists": True,
            "constrained_supplier_count": 1,
            "active_sourcing_tiers": 2,
        },
    },
    {
        "risk_id": "RSK-DM003",
        "correlation_id": "CORR-DEMO-2026-003",
        "event_time": "2026-09-24T07:30:00+00:00",
        "material_id": "BP-4410",
        "shipment_id": "SHP-90031",
        "requirement_id": "MR-7781",
        "work_package_id": "TW-2055",
        "risk_type": "LATE_DELIVERY",
        "severity": "HIGH",
        "status": "OPEN",
        "facts": {
            "current_eta": "2026-10-22T10:00:00+00:00",
            "required_by": "2026-10-18T00:00:00+00:00",
            "delay_days": 4,
            "shortage_quantity": 2,
            "delay_reason_code": "CUSTOMS_INSPECTION",
        },
        "resilience_flags": {
            "primary_supplier_constrained": False,
            "secondary_supplier_constrained": False,
            "alternate_inventory_available": True,
            "approved_substitute_document_exists": False,
            "constrained_supplier_count": 0,
            "active_sourcing_tiers": 2,
        },
    },
    {
        "risk_id": "RSK-DM004",
        "correlation_id": "CORR-DEMO-2026-004",
        "event_time": "2026-09-25T14:15:00+00:00",
        "material_id": "CVA-8843",
        "shipment_id": "SHP-90062",
        "requirement_id": "MR-7781",
        "work_package_id": "TW-2060",
        "risk_type": "QUALITY_HOLD",
        "severity": "CRITICAL",
        "status": "OPEN",
        "facts": {
            "current_eta": "2026-10-19T10:00:00+00:00",
            "required_by": "2026-10-09T00:00:00+00:00",
            "delay_days": 10,
            "shortage_quantity": 1,
            "delay_reason_code": "SUPPLIER_QUALITY_HOLD",
        },
        "resilience_flags": {
            "primary_supplier_constrained": True,
            "secondary_supplier_constrained": False,
            "alternate_inventory_available": False,
            "approved_substitute_document_exists": True,
            "constrained_supplier_count": 1,
            "active_sourcing_tiers": 1,
        },
    },
    {
        "risk_id": "RSK-DM005",
        "correlation_id": "CORR-DEMO-2026-005",
        "event_time": "2026-09-26T09:00:00+00:00",
        "material_id": "SV-3320",
        "shipment_id": "SHP-90044",
        "requirement_id": "MR-7781",
        "work_package_id": "TW-2060",
        "risk_type": "LATE_DELIVERY",
        "severity": "MEDIUM",
        "status": "MITIGATED",
        "facts": {
            "current_eta": "2026-10-15T10:00:00+00:00",
            "required_by": "2026-10-14T00:00:00+00:00",
            "delay_days": 1,
            "shortage_quantity": 0,
            "delay_reason_code": None,
        },
        "resilience_flags": {
            "primary_supplier_constrained": False,
            "secondary_supplier_constrained": False,
            "alternate_inventory_available": True,
            "approved_substitute_document_exists": True,
            "constrained_supplier_count": 0,
            "active_sourcing_tiers": 3,
        },
    },
    {
        "risk_id": "RSK-DM006",
        "correlation_id": "CORR-DEMO-2026-006",
        "event_time": "2026-09-27T16:20:00+00:00",
        "material_id": "GS-7701",
        "shipment_id": "SHP-90023",
        "requirement_id": "MR-7781",
        "work_package_id": "TW-2051",
        "risk_type": "LATE_DELIVERY",
        "severity": "LOW",
        "status": "CLOSED",
        "facts": {
            "current_eta": "2026-10-20T10:00:00+00:00",
            "required_by": "2026-10-19T00:00:00+00:00",
            "delay_days": 1,
            "shortage_quantity": 0,
            "delay_reason_code": None,
        },
        "resilience_flags": {
            "primary_supplier_constrained": False,
            "secondary_supplier_constrained": False,
            "alternate_inventory_available": True,
            "approved_substitute_document_exists": True,
            "constrained_supplier_count": 0,
            "active_sourcing_tiers": 3,
        },
    },
]


@router.post("/populate")
async def demo_populate(request: Request) -> dict:
    """Inject a rich set of pre-built risks for UI demo walkthroughs.
    Does NOT reset existing state — call /demo/reset first if desired."""
    injected = []
    for raw in _DEMO_RISKS:
        data = dict(raw)  # shallow copy — never mutate the module-level constant
        resilience_flags = data.pop("resilience_flags", None)
        risk = RiskEvent(**data, resilience_flags=resilience_flags)
        store.upsert_risk(risk)
        audit.record("RISK_INJECTED", data["correlation_id"], risk_id=data["risk_id"])
        injected.append(data["risk_id"])
    return {"populated": True, "risk_ids": injected, "count": len(injected)}


@router.get("/audit")
async def get_audit(correlation_id: str | None = None) -> dict:
    return {"trail": audit.get_trail(correlation_id)}
