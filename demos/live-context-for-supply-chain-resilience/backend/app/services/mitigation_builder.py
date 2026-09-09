# backend/app/services/mitigation_builder.py
# Builds and scores mitigation options (spec/09_SCORING_AND_DECISION_SPEC.yaml)

from __future__ import annotations
from datetime import datetime, timedelta, timezone
import uuid

from app.domain.models import MitigationOption, RiskEvent
from app.domain.scoring import (
    DEFAULT_WEIGHTS,
    ScoringInput,
    apply_hard_constraints,
    calculate_score,
    rank_options,
)
from app.store.in_memory_store import store


def build_and_score_options(risk: RiskEvent) -> list[MitigationOption]:
    """
    Generate all mitigation option classes for a risk, apply hard constraints,
    score, and return ranked list.
    """
    req = store.get_requirement(risk.requirement_id)
    shipment = store.get_shipment(risk.shipment_id)
    if not req or not shipment:
        return []

    all_inventory = store.get_all_inventory_for_material(risk.material_id)
    approved_suppliers = store.get_approved_suppliers_for_material(risk.material_id)

    options: list[MitigationOption] = []

    # ---- 1. WAIT / accept delay ----
    wait_inp = ScoringInput(
        type="WAIT",
        feasible=True,
        schedule_risk_score=85.0,   # high schedule risk
        technical_risk_score=10.0,
        supply_risk_score=70.0,
        incremental_cost=0.0,
    )
    wait_score = calculate_score(wait_inp)
    options.append(MitigationOption(
        option_id=f"OPT-{uuid.uuid4().hex[:8].upper()}",
        risk_id=risk.risk_id,
        type="WAIT",
        feasible=True,
        estimated_ready_date=shipment.current_eta,
        incremental_cost=0.0,
        schedule_risk_score=wait_inp.schedule_risk_score,
        technical_risk_score=wait_inp.technical_risk_score,
        supply_risk_score=wait_inp.supply_risk_score,
        total_score=wait_score,
        requires_engineering_approval=False,
        requires_procurement_approval=False,
        constraints=["Creates schedule exposure – turnaround start delayed"],
    ))

    # ---- 2. TRANSFER from alternate location ----
    for inv in all_inventory:
        if inv.location_id == shipment.destination_location_id:
            continue
        if inv.available <= 0:
            continue

        transfer_inp = ScoringInput(
            type="TRANSFER",
            feasible=True,
            schedule_risk_score=20.0,
            technical_risk_score=10.0,
            supply_risk_score=25.0,
            incremental_cost=3500.0,
            source_available_qty=inv.available,
            required_qty=req.quantity_required,
            source_next_requirement_jeopardised=(
                inv.next_known_requirement_date is not None
                and inv.next_known_requirement_date
                < req.required_by.date()
            ),
        )
        feasibility = apply_hard_constraints(transfer_inp)
        transfer_score = calculate_score(transfer_inp)
        options.append(MitigationOption(
            option_id=f"OPT-{uuid.uuid4().hex[:8].upper()}",
            risk_id=risk.risk_id,
            type="TRANSFER",
            feasible=feasibility.feasible,
            estimated_ready_date=datetime.now(timezone.utc) + timedelta(days=3),
            incremental_cost=3500.0,
            schedule_risk_score=transfer_inp.schedule_risk_score,
            technical_risk_score=transfer_inp.technical_risk_score,
            supply_risk_score=transfer_inp.supply_risk_score,
            total_score=transfer_score,
            requires_engineering_approval=False,
            requires_procurement_approval=False,
            constraints=[feasibility.reason] if feasibility.reason else [],
            evidence_ids=[],
        ))

    # ---- 3. ALTERNATE_SUPPLIER ----
    for supplier in approved_suppliers:
        delivery_date = datetime.now(timezone.utc) + timedelta(
            days=supplier.standard_lead_time_days
        )
        feasible_by_date = delivery_date <= req.required_by

        sup_inp = ScoringInput(
            type="ALTERNATE_SUPPLIER",
            feasible=feasible_by_date,
            schedule_risk_score=30.0 if feasible_by_date else 75.0,
            technical_risk_score=15.0,
            supply_risk_score=20.0,
            incremental_cost=18000.0,
            supplier_approved=supplier.approved,
        )
        feasibility = apply_hard_constraints(sup_inp)
        sup_score = calculate_score(sup_inp)
        options.append(MitigationOption(
            option_id=f"OPT-{uuid.uuid4().hex[:8].upper()}",
            risk_id=risk.risk_id,
            type="ALTERNATE_SUPPLIER",
            feasible=feasibility.feasible and feasible_by_date,
            estimated_ready_date=delivery_date,
            incremental_cost=18000.0,
            schedule_risk_score=sup_inp.schedule_risk_score,
            technical_risk_score=sup_inp.technical_risk_score,
            supply_risk_score=sup_inp.supply_risk_score,
            total_score=sup_score,
            requires_engineering_approval=False,
            requires_procurement_approval=True,
            constraints=[feasibility.reason] if feasibility.reason else [],
        ))

    # ---- 4. SUBSTITUTE (requires engineering evidence) ----
    sub_inp = ScoringInput(
        type="SUBSTITUTE",
        feasible=False,
        schedule_risk_score=40.0,
        technical_risk_score=60.0,
        supply_risk_score=30.0,
        incremental_cost=5000.0,
        engineering_evidence_present=False,  # will be set True by RAG agent if evidence exists
    )
    feasibility = apply_hard_constraints(sub_inp)
    sub_score = calculate_score(sub_inp)
    options.append(MitigationOption(
        option_id=f"OPT-{uuid.uuid4().hex[:8].upper()}",
        risk_id=risk.risk_id,
        type="SUBSTITUTE",
        feasible=False,
        estimated_ready_date=None,
        incremental_cost=5000.0,
        schedule_risk_score=sub_inp.schedule_risk_score,
        technical_risk_score=sub_inp.technical_risk_score,
        supply_risk_score=sub_inp.supply_risk_score,
        total_score=sub_score,
        requires_engineering_approval=True,
        requires_procurement_approval=True,
        constraints=[feasibility.reason or "Requires approved engineering evidence"],
    ))

    ranked = rank_options(options)
    return options if not ranked else options  # return all; caller can filter feasible
