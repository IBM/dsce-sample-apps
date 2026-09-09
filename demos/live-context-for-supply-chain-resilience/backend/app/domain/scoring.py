# backend/app/domain/scoring.py
# Deterministic mitigation scoring – spec/09_SCORING_AND_DECISION_SPEC.yaml
# LLMs may explain; scoring uses ONLY explicit deterministic inputs.

from __future__ import annotations
from dataclasses import dataclass
from typing import Literal

from app.domain.models import MitigationOption, MitigationType, RiskSeverity


@dataclass(frozen=True)
class ScoringWeights:
    schedule_risk: float = 0.45
    technical_risk: float = 0.25
    supply_risk: float = 0.20
    incremental_cost: float = 0.10


DEFAULT_WEIGHTS = ScoringWeights()

# Maximum incremental cost used for normalisation in the demo scenario
_COST_NORM_MAX = 50_000.0


@dataclass
class ScoringInput:
    type: MitigationType
    feasible: bool
    schedule_risk_score: float          # 0–100
    technical_risk_score: float         # 0–100
    supply_risk_score: float            # 0–100
    incremental_cost: float | None = None
    requires_engineering_approval: bool = False
    evidence_ids: list[str] | None = None
    constraints: list[str] | None = None

    # Constraint-check inputs
    source_available_qty: float = 0.0
    required_qty: float = 1.0
    source_next_requirement_jeopardised: bool = False
    supplier_approved: bool = True
    engineering_evidence_present: bool = False
    estimated_ready_date_iso: str | None = None
    required_by_iso: str | None = None


def calculate_score(inp: ScoringInput, weights: ScoringWeights = DEFAULT_WEIGHTS) -> float:
    """Weighted composite score – lower is better (spec direction)."""
    cost_normalised = 0.0
    if inp.incremental_cost is not None:
        cost_normalised = min((inp.incremental_cost / _COST_NORM_MAX) * 100, 100)

    return (
        inp.schedule_risk_score * weights.schedule_risk
        + inp.technical_risk_score * weights.technical_risk
        + inp.supply_risk_score * weights.supply_risk
        + cost_normalised * weights.incremental_cost
    )


@dataclass(frozen=True)
class FeasibilityResult:
    feasible: bool
    reason: str | None = None


def apply_hard_constraints(inp: ScoringInput) -> FeasibilityResult:
    """Enforce spec/09 hard constraints before scoring."""
    if inp.type == "TRANSFER":
        if inp.source_available_qty < inp.required_qty:
            return FeasibilityResult(
                False, "TRANSFER infeasible: insufficient source inventory"
            )
        if inp.source_next_requirement_jeopardised:
            return FeasibilityResult(
                False, "TRANSFER infeasible: would jeopardise source next requirement"
            )

    if inp.type == "ALTERNATE_SUPPLIER":
        if not inp.supplier_approved:
            return FeasibilityResult(
                False, "ALTERNATE_SUPPLIER infeasible: supplier not approved"
            )

    if inp.type == "SUBSTITUTE":
        if not inp.engineering_evidence_present:
            return FeasibilityResult(
                False,
                "SUBSTITUTE infeasible: no approved engineering evidence (NO_ENGINEERING_EVIDENCE)",
            )

    return FeasibilityResult(True)


def rank_options(options: list[MitigationOption]) -> list[MitigationOption]:
    """Remove infeasible; sort ascending (lower score = better)."""
    feasible = [o for o in options if o.feasible]
    return sorted(feasible, key=lambda o: o.total_score)


def are_near_equivalent(a: MitigationOption, b: MitigationOption) -> bool:
    """Spec: if top two scores differ by < 5 points, present both as near-equivalent."""
    return abs(a.total_score - b.total_score) < 5.0


def compute_risk_severity(
    mandatory: bool,
    shortage_qty: float,
    hours_until_required: float,
) -> RiskSeverity:
    """Severity rules from spec/09_SCORING_AND_DECISION_SPEC.yaml."""
    if mandatory and shortage_qty > 0 and hours_until_required <= 72:
        return "CRITICAL"
    if mandatory and shortage_qty > 0 and hours_until_required <= 168:
        return "HIGH"
    if shortage_qty > 0:
        return "MEDIUM"
    return "LOW"
