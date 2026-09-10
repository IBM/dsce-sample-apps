# backend/app/api/routers/resilience.py
# Supply chain resilience API endpoints – spec/04_API_AND_TOOL_CONTRACTS.yaml
#   GET  /api/resilience/profile              → get_resilience_profile
#   GET  /api/resilience/avl                  → get_avl_status
#   GET  /api/resilience/port-status          → get_port_status
#   GET  /api/resilience/supplier-status      → get_supplier_resilience_status
#   POST /api/resilience/supplier-constraint  → upsert_supplier_constraint  (demo/consumer ingest)
#   POST /api/resilience/port-disruption      → upsert_port_disruption      (demo/consumer ingest)
#
# SYNTHETIC DEMO DATA ONLY – not real Shell or Pearl GTL operational data.

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

import uuid

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from app.core.errors import AppError
from app.domain.models import (
    AvlStatus,
    ConstraintSeverity,
    ConstraintType,
    PortDisruptionType,
    PortStatus,
    ReadinessStatus,
    SupplierConstraint,
    SupplyChainResilienceProfile,
)
from app.services.resilience_engine import compute_resilience_profile
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/resilience", tags=["resilience"])

_PROFILE_STALE_THRESHOLD_SECS = 300  # configurable via env in future (spec/13 §6.2)


# ── Response models ────────────────────────────────────────────────────────────

class ResilienceProfileResponse(BaseModel):
    profile: SupplyChainResilienceProfile
    evaluated_at: datetime
    profile_age_secs: int  # staleness indicator for the UI (spec/04 get_resilience_profile)
    stale: bool


class AvlEntryResponse(BaseModel):
    supplier_id: str
    supplier_name: str
    tier: str
    avl_status: AvlStatus
    constrained: bool
    constraint_type: ConstraintType | None = None
    constraint_severity: ConstraintSeverity | None = None
    constraint_source_event_id: str | None = None


class AvlStatusResponse(BaseModel):
    material_id: str
    entries: list[AvlEntryResponse]
    unconstrained_approved_count: int
    evaluated_at: datetime


class PortStatusResponse(BaseModel):
    port_code: str
    port_name: str
    disruption_type: PortDisruptionType | None = None
    severity: ConstraintSeverity | None = None
    estimated_clear_date: datetime | None = None
    impacted_shipment_count: int
    evaluated_at: datetime


class SupplierResilienceStatusResponse(BaseModel):
    supplier_id: str
    supplier_name: str
    material_id: str | None = None
    status: Literal["ACTIVE", "CLEARED"]
    constraint_type: ConstraintType | None = None
    constraint_severity: ConstraintSeverity | None = None
    affected_from_date: datetime | None = None
    estimated_resolution_date: datetime | None = None
    source_event_id: str | None = None
    evaluated_at: datetime


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_blocking_constraint(ctype: ConstraintType, cseverity: ConstraintSeverity) -> bool:
    """Mirrors resilience_engine._is_supplier_constrained logic for inline AVL checks."""
    if ctype == "CLEARED":
        return False
    blocking_types = {"QUALITY_HOLD", "FORCE_MAJEURE", "CAPACITY_CONSTRAINT", "PORT_CONGESTION"}
    return ctype in blocking_types and cseverity in {"HIGH", "CRITICAL"}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=ResilienceProfileResponse)
async def get_resilience_profile(
    work_package_id: str,
    material_id: str,
    request: Request,
) -> ResilienceProfileResponse:
    """
    Returns the full SupplyChainResilienceProfile for a material/work-package.
    Recomputes on demand if no cached profile exists.
    spec/04 get_resilience_profile
    """
    # Try cached profile first; recompute if missing
    cached = store.get_resilience_profile(work_package_id, material_id)
    if cached is None:
        profile = compute_resilience_profile(
            store, work_package_id, material_id, contributing_event_id="ON_DEMAND"
        )
    else:
        profile = cached

    now = datetime.now(timezone.utc)
    age_secs = int((now - profile.assessed_at).total_seconds())
    stale = age_secs > _PROFILE_STALE_THRESHOLD_SECS

    return ResilienceProfileResponse(
        profile=profile,
        evaluated_at=now,
        profile_age_secs=age_secs,
        stale=stale,
    )


@router.get("/avl", response_model=AvlStatusResponse)
async def get_avl_status(
    material_id: str,
    request: Request,
) -> AvlStatusResponse:
    """
    Returns all AVL entries for a material with live constraint context.
    spec/04 get_avl_status
    """
    avl_entries = store.get_avl_entries_for_material(material_id)
    if not avl_entries:
        raise AppError("NOT_FOUND", f"No AVL entries found for material {material_id}")

    # Build enriched entry list
    entries: list[AvlEntryResponse] = []
    unconstrained_count = 0

    for avl in avl_entries:
        supplier = store.get_supplier(avl.supplier_id)
        sup_name = supplier.name if supplier else avl.supplier_id
        sup_tier = supplier.tier if supplier else "SPOT"

        constraint = store.get_supplier_constraint(avl.supplier_id, material_id)
        constrained = False
        c_type = None
        c_severity = None
        c_event_id = None

        if constraint and constraint.constraint_type != "CLEARED":
            constrained = _is_blocking_constraint(
                constraint.constraint_type, constraint.constraint_severity
            )
            if constrained:
                c_type = constraint.constraint_type
                c_severity = constraint.constraint_severity
                c_event_id = constraint.source_event_id

        if avl.avl_status == "APPROVED" and not constrained:
            unconstrained_count += 1

        entries.append(AvlEntryResponse(
            supplier_id=avl.supplier_id,
            supplier_name=sup_name,
            tier=sup_tier,
            avl_status=avl.avl_status,
            constrained=constrained,
            constraint_type=c_type,
            constraint_severity=c_severity,
            constraint_source_event_id=c_event_id,
        ))

    # Sort: unconstrained APPROVED first, then by tier order
    tier_order = {"PRIMARY": 0, "SECONDARY": 1, "TERTIARY": 2, "SPOT": 3}
    entries.sort(key=lambda e: (e.constrained, tier_order.get(e.tier, 99)))

    return AvlStatusResponse(
        material_id=material_id,
        entries=entries,
        unconstrained_approved_count=unconstrained_count,
        evaluated_at=datetime.now(timezone.utc),
    )


@router.get("/port-status", response_model=PortStatusResponse)
async def get_port_status(
    port_code: str,
    material_id: str | None = Query(default=None),
    request: Request = None,
) -> PortStatusResponse:
    """
    Returns current port disruption status and optionally lists shipments
    for a material routing through that port.
    spec/04 get_port_status
    """
    ps = store.get_port_status(port_code)
    if ps is None:
        raise AppError("NOT_FOUND", f"No port status found for port code {port_code}")

    # Count impacted shipments for the given material (if specified)
    impacted = 0
    if material_id:
        impacted = sum(
            1 for s in store._shipments.values()
            if s.material_id == material_id
            and s.status not in ("DELIVERED", "CANCELLED")
        )

    return PortStatusResponse(
        port_code=ps.port_code,
        port_name=ps.port_name,
        disruption_type=ps.disruption_type if ps.disruption_type != "CLEARED" else None,
        severity=ps.severity if ps.disruption_type != "CLEARED" else None,
        estimated_clear_date=ps.estimated_clear_date,
        impacted_shipment_count=impacted,
        evaluated_at=datetime.now(timezone.utc),
    )


# ── Ingest endpoints (called by demo loop / Kafka consumers) ──────────────────

class SupplierConstraintBody(BaseModel):
    supplier_id: str
    material_id: str | None = None
    constraint_type: ConstraintType
    constraint_severity: ConstraintSeverity
    affected_from_date: str | None = None
    estimated_resolution_date: str | None = None
    source_reference: str | None = None
    notes: str | None = None
    event_id: str | None = None
    correlation_id: str | None = None


class PortDisruptionBody(BaseModel):
    port_code: str
    port_name: str | None = None
    disruption_type: PortDisruptionType
    severity: ConstraintSeverity
    affected_from_date: str | None = None
    estimated_clear_date: str | None = None
    impacted_shipment_ids: list[str] = []
    affected_logistics_providers: list[str] = []
    event_id: str | None = None
    correlation_id: str | None = None


@router.post("/supplier-constraint")
async def upsert_supplier_constraint(body: SupplierConstraintBody, request: Request) -> dict:
    """
    Upsert a supplier constraint from a Kafka consumer or the simple demo loop.
    Triggers resilience profile recomputation for all affected (wp, material) pairs.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    constraint = SupplierConstraint(
        supplier_id=body.supplier_id,
        material_id=body.material_id,
        constraint_type=body.constraint_type,
        constraint_severity=body.constraint_severity,
        affected_from_date=now,
        source_event_id=body.event_id or f"DEMO-{uuid.uuid4().hex[:8].upper()}",
    )
    store.upsert_supplier_constraint(constraint)

    # Recompute resilience profiles for all work packages that reference this material
    if body.material_id:
        reqs = [r for r in store._requirements.values() if r.material_id == body.material_id]
        for req in reqs:
            profile = compute_resilience_profile(
                store, req.work_package_id, body.material_id,
                contributing_event_id=constraint.source_event_id,
            )
            store.upsert_resilience_profile(profile)

    return {
        "updated": True,
        "supplier_id": body.supplier_id,
        "constraint_type": body.constraint_type,
        "constraint_severity": body.constraint_severity,
    }


@router.post("/port-disruption")
async def upsert_port_disruption(body: PortDisruptionBody, request: Request) -> dict:
    """
    Upsert a port disruption from a Kafka consumer or the simple demo loop.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    ps = PortStatus(
        port_code=body.port_code,
        port_name=body.port_name or body.port_code,
        disruption_type=body.disruption_type,
        severity=body.severity,
        affected_from_date=now,
        source_event_id=body.event_id or f"DEMO-{uuid.uuid4().hex[:8].upper()}",
    )
    store.upsert_port_status(ps)

    return {
        "updated": True,
        "port_code": body.port_code,
        "disruption_type": body.disruption_type,
        "severity": body.severity,
    }


@router.get("/supplier-status", response_model=SupplierResilienceStatusResponse)
async def get_supplier_resilience_status(
    supplier_id: str,
    material_id: str | None = Query(default=None),
    request: Request = None,
) -> SupplierResilienceStatusResponse:
    """
    Returns live constraint state for a specific supplier.
    spec/04 get_supplier_resilience_status
    """
    supplier = store.get_supplier(supplier_id)
    if supplier is None:
        raise AppError("NOT_FOUND", f"Supplier {supplier_id} not found")

    constraint = store.get_supplier_constraint(supplier_id, material_id)
    now = datetime.now(timezone.utc)

    if constraint is None or constraint.constraint_type == "CLEARED":
        return SupplierResilienceStatusResponse(
            supplier_id=supplier_id,
            supplier_name=supplier.name,
            material_id=material_id,
            status="CLEARED",
            evaluated_at=now,
        )

    return SupplierResilienceStatusResponse(
        supplier_id=supplier_id,
        supplier_name=supplier.name,
        material_id=material_id,
        status="ACTIVE",
        constraint_type=constraint.constraint_type,
        constraint_severity=constraint.constraint_severity,
        affected_from_date=constraint.affected_from_date,
        estimated_resolution_date=constraint.estimated_resolution_date,
        source_event_id=constraint.source_event_id,
        evaluated_at=now,
    )
