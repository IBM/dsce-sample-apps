# backend/tests/test_scoring.py
# Unit tests for deterministic scoring (spec/10_TEST_AND_EVALUATION_SPEC.yaml)
# Covers: risk_severity, mitigation_feasibility, deterministic_scoring

from __future__ import annotations
import pytest
from app.domain.scoring import (
    ScoringInput,
    calculate_score,
    apply_hard_constraints,
    compute_risk_severity,
    rank_options,
    are_near_equivalent,
    DEFAULT_WEIGHTS,
)
from app.domain.models import MitigationOption
import uuid


def _opt(type_: str, feasible: bool, score: float) -> MitigationOption:
    return MitigationOption(
        option_id=str(uuid.uuid4()),
        risk_id="RSK-TEST",
        type=type_,  # type: ignore[arg-type]
        feasible=feasible,
        schedule_risk_score=score,
        technical_risk_score=0.0,
        supply_risk_score=0.0,
        total_score=score,
        requires_engineering_approval=False,
        requires_procurement_approval=False,
    )


class TestRiskSeverity:
    def test_critical_within_72h(self):
        assert compute_risk_severity(True, 1, 48) == "CRITICAL"

    def test_high_within_168h(self):
        assert compute_risk_severity(True, 1, 100) == "HIGH"

    def test_medium_shortage_not_mandatory(self):
        assert compute_risk_severity(False, 1, 48) == "MEDIUM"

    def test_low_no_shortage(self):
        assert compute_risk_severity(True, 0, 48) == "LOW"


class TestScoringWeights:
    def test_weights_sum_to_one(self):
        total = (
            DEFAULT_WEIGHTS.schedule_risk
            + DEFAULT_WEIGHTS.technical_risk
            + DEFAULT_WEIGHTS.supply_risk
            + DEFAULT_WEIGHTS.incremental_cost
        )
        assert abs(total - 1.0) < 1e-9

    def test_lower_risk_scores_lower(self):
        low = ScoringInput(type="TRANSFER", feasible=True,
                           schedule_risk_score=10, technical_risk_score=10,
                           supply_risk_score=10, incremental_cost=0)
        high = ScoringInput(type="WAIT", feasible=True,
                            schedule_risk_score=90, technical_risk_score=90,
                            supply_risk_score=90, incremental_cost=0)
        assert calculate_score(low) < calculate_score(high)

    def test_cost_normalisation_caps_at_100(self):
        huge_cost = ScoringInput(type="WAIT", feasible=True,
                                 schedule_risk_score=0, technical_risk_score=0,
                                 supply_risk_score=0, incremental_cost=999_999)
        # cost component = 100 * 0.10 = 10.0 (capped)
        assert calculate_score(huge_cost) == pytest.approx(10.0)


class TestHardConstraints:
    def test_transfer_infeasible_insufficient_inventory(self):
        inp = ScoringInput(type="TRANSFER", feasible=True,
                           schedule_risk_score=0, technical_risk_score=0, supply_risk_score=0,
                           source_available_qty=0.5, required_qty=1.0)
        result = apply_hard_constraints(inp)
        assert not result.feasible
        assert "insufficient source inventory" in (result.reason or "")

    def test_transfer_infeasible_jeopardised(self):
        inp = ScoringInput(type="TRANSFER", feasible=True,
                           schedule_risk_score=0, technical_risk_score=0, supply_risk_score=0,
                           source_available_qty=5, required_qty=1,
                           source_next_requirement_jeopardised=True)
        result = apply_hard_constraints(inp)
        assert not result.feasible

    def test_alternate_supplier_infeasible_unapproved(self):
        inp = ScoringInput(type="ALTERNATE_SUPPLIER", feasible=True,
                           schedule_risk_score=0, technical_risk_score=0, supply_risk_score=0,
                           supplier_approved=False)
        result = apply_hard_constraints(inp)
        assert not result.feasible
        assert "not approved" in (result.reason or "")

    def test_substitute_infeasible_no_evidence(self):
        inp = ScoringInput(type="SUBSTITUTE", feasible=True,
                           schedule_risk_score=0, technical_risk_score=0, supply_risk_score=0,
                           engineering_evidence_present=False)
        result = apply_hard_constraints(inp)
        assert not result.feasible
        assert "NO_ENGINEERING_EVIDENCE" in (result.reason or "")

    def test_transfer_feasible_adequate_inventory(self):
        inp = ScoringInput(type="TRANSFER", feasible=True,
                           schedule_risk_score=0, technical_risk_score=0, supply_risk_score=0,
                           source_available_qty=2.0, required_qty=1.0)
        result = apply_hard_constraints(inp)
        assert result.feasible


class TestRankOptions:
    def test_ranks_by_total_score_ascending(self):
        options = [_opt("WAIT", True, 80), _opt("TRANSFER", True, 20), _opt("EXPEDITE", True, 50)]
        ranked = rank_options(options)
        scores = [o.total_score for o in ranked]
        assert scores == sorted(scores)

    def test_excludes_infeasible(self):
        options = [_opt("WAIT", True, 80), _opt("SUBSTITUTE", False, 10)]
        ranked = rank_options(options)
        assert all(o.feasible for o in ranked)
        assert len(ranked) == 1

    def test_near_equivalent_within_5_points(self):
        a = _opt("TRANSFER", True, 20.0)
        b = _opt("EXPEDITE", True, 24.0)
        assert are_near_equivalent(a, b)

    def test_not_near_equivalent_beyond_5_points(self):
        a = _opt("TRANSFER", True, 20.0)
        b = _opt("EXPEDITE", True, 26.0)
        assert not are_near_equivalent(a, b)
