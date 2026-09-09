# backend/app/services/resilience_engine.py
# Supply chain resilience correlation engine – spec/13 §3
# Computes SupplyChainResilienceProfile using deterministic scoring rules
# from spec/09_SCORING_AND_DECISION_SPEC.yaml §resilience_scoring.
#
# SYNTHETIC DEMO DATA ONLY – not real Shell or Pearl GTL operational data.

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.domain.models import (
    ConstraintType,
    ReadinessStatus,
    SupplyChainResilienceProfile,
)

if TYPE_CHECKING:
    from app.store.in_memory_store import InMemoryStore

# ── Constraint types that block use of a supplier as an alternate source ────────
_BLOCKING_CONSTRAINT_TYPES: set[ConstraintType] = {
    "QUALITY_HOLD",
    "FORCE_MAJEURE",
    "CAPACITY_CONSTRAINT",
}
_BLOCKING_SEVERITIES = {"HIGH", "CRITICAL"}


def _is_supplier_constrained(store: "InMemoryStore", supplier_id: str, material_id: str) -> bool:
    """Return True if the supplier has an active blocking constraint (spec/09 hard_constraints)."""
    constraint = store.get_supplier_constraint(supplier_id, material_id)
    if constraint is None:
        return False
    if constraint.constraint_type == "CLEARED":
        return False
    # PORT_CONGESTION constraint blocks this supplier too (spec/13 §8 T+4)
    is_blocking_type = (
        constraint.constraint_type in _BLOCKING_CONSTRAINT_TYPES
        or constraint.constraint_type == "PORT_CONGESTION"
    )
    is_blocking_severity = constraint.constraint_severity in _BLOCKING_SEVERITIES
    return is_blocking_type and is_blocking_severity


def _supplier_coverage_score(unconstrained_count: int) -> float:
    """D1: Supplier tier coverage (spec/09 §resilience_scoring.supplier_coverage, weight 0.30)."""
    if unconstrained_count >= 3:
        return 0.0
    if unconstrained_count == 2:
        return 25.0
    if unconstrained_count == 1:
        return 60.0
    return 100.0


def _inventory_buffer_score(
    available_at_dest: float,
    quantity_required: float,
    transfer_covers: bool,
) -> float:
    """D2: Inventory buffer score (spec/09 §resilience_scoring.inventory_buffer, weight 0.25)."""
    if available_at_dest >= quantity_required:
        return 0.0
    if transfer_covers:
        return 30.0
    if available_at_dest > 0:
        return 70.0
    return 100.0


def _shipment_exposure_score(days_late: int) -> float:
    """D3: Primary shipment exposure (spec/09 §resilience_scoring.shipment_exposure, weight 0.25)."""
    if days_late <= 0:
        return 0.0
    if days_late <= 3:
        return 30.0
    if days_late <= 7:
        return 60.0
    return 100.0


def _port_disruption_score(store: "InMemoryStore", material_id: str) -> float:
    """D4: Port/logistics disruption (spec/09 §resilience_scoring.port_disruption, weight 0.20).
    Checks all active port statuses – demo scenario uses SGSIN at HIGH severity."""
    port_statuses = store.get_all_port_statuses()
    if not port_statuses:
        return 0.0
    worst = max(
        (0 if p.disruption_type == "CLEARED" else
         {"LOW": 20.0, "MEDIUM": 50.0, "HIGH": 100.0, "CRITICAL": 100.0}.get(p.severity, 0.0))
        for p in port_statuses
    )
    return worst


def _readiness_from_score(score: float) -> ReadinessStatus:
    """Map resilience score to readiness status bucket (spec/09 §thresholds)."""
    if score <= 25.0:
        return "CONFIRMED"
    if score <= 60.0:
        return "AT_RISK"
    return "CRITICAL"


def compute_resilience_profile(
    store: "InMemoryStore",
    work_package_id: str,
    material_id: str,
    contributing_event_id: str = "SEED",
) -> SupplyChainResilienceProfile:
    """
    Compute (or recompute) the SupplyChainResilienceProfile for a
    (workPackageId, materialId) pair and persist it.

    Called on every contributing event as per spec/13 §3.2.
    """
    now = datetime.now(timezone.utc)

    # ── Requirement ──────────────────────────────────────────────────────────
    requirements = store.get_requirements_by_work_package(work_package_id)
    req = next((r for r in requirements if r.material_id == material_id), None)
    quantity_required = req.quantity_required if req else 1.0
    requirement_id = req.requirement_id if req else "UNKNOWN"
    days_to_required = (
        int((req.required_by - now).total_seconds() / 86400) if req else 0
    )

    # ── Inventory ─────────────────────────────────────────────────────────────
    wp = store.get_work_package(work_package_id)
    dest_location = wp.location_id if wp else "UNKNOWN"
    dest_inv = store.get_inventory(dest_location, material_id)
    available_at_dest = dest_inv.available if dest_inv else 0.0
    shortfall = max(quantity_required - available_at_dest, 0.0)

    # Check whether any near-by transfer location covers the shortfall
    all_inv = store.get_all_inventory_for_material(material_id)
    transfer_covers = any(
        i.location_id != dest_location and i.available >= shortfall
        for i in all_inv
    )
    feasible_transfer_count = sum(
        1 for i in all_inv
        if i.location_id != dest_location and i.available >= shortfall
    )

    # ── Supplier coverage ─────────────────────────────────────────────────────
    avl_entries = store.get_avl_entries_for_material(material_id)
    approved_suppliers = [
        e for e in avl_entries if e.avl_status == "APPROVED"
    ]
    unconstrained = [
        e for e in approved_suppliers
        if not _is_supplier_constrained(store, e.supplier_id, material_id)
    ]
    unconstrained_count = len(unconstrained)
    feasible_alternate_count = unconstrained_count  # non-primary unconstrained

    # Determine primary and secondary supplier status for the profile
    all_suppliers = {s.supplier_id: s for s in store.get_approved_suppliers_for_material(material_id)}
    primary_sups = [s for s in all_suppliers.values() if s.tier == "PRIMARY"]
    secondary_sups = [s for s in all_suppliers.values() if s.tier == "SECONDARY"]

    def _status_label(sup_list: list) -> str:
        for s in sup_list:
            c = store.get_supplier_constraint(s.supplier_id, material_id)
            if c and c.constraint_type != "CLEARED":
                return f"{c.constraint_type}/{c.constraint_severity}"
        return "UNCONSTRAINED" if sup_list else "NOT_ON_AVL"

    primary_status = _status_label(primary_sups)
    secondary_status = _status_label(secondary_sups) if secondary_sups else None

    # ── Shipment exposure ─────────────────────────────────────────────────────
    all_shipments = [s for s in store._shipments.values() if s.material_id == material_id]
    days_late = 0
    if all_shipments and req:
        worst_shipment = max(all_shipments, key=lambda s: s.current_eta)
        late_secs = (worst_shipment.current_eta - req.required_by).total_seconds()
        days_late = max(int(late_secs / 86400), 0)

    # ── Dimension scores ──────────────────────────────────────────────────────
    d1 = _supplier_coverage_score(unconstrained_count)
    d2 = _inventory_buffer_score(available_at_dest, quantity_required, transfer_covers)
    d3 = _shipment_exposure_score(days_late)
    d4 = _port_disruption_score(store, material_id)

    resilience_score = round(
        d1 * 0.30 + d2 * 0.25 + d3 * 0.25 + d4 * 0.20, 1
    )
    readiness_status = _readiness_from_score(resilience_score)

    profile = SupplyChainResilienceProfile(
        work_package_id=work_package_id,
        material_id=material_id,
        requirement_id=requirement_id,
        assessed_at=now,
        readiness_status=readiness_status,
        days_to_required=days_to_required,
        available_at_destination=available_at_dest,
        shortfall=shortfall,
        unconstrained_approved_supplier_count=unconstrained_count,
        feasible_transfer_location_count=feasible_transfer_count,
        feasible_alternate_supplier_count=feasible_alternate_count,
        resilience_score=resilience_score,
        primary_supplier_status=primary_status,
        secondary_supplier_status=secondary_status,
        last_contributing_event_id=contributing_event_id,
        supplier_coverage_score=d1,
        inventory_buffer_score=d2,
        shipment_exposure_score=d3,
        port_disruption_score=d4,
    )

    store.upsert_resilience_profile(profile)
    return profile
