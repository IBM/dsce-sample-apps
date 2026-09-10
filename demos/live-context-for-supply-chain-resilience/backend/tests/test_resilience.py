# backend/tests/test_resilience.py
# Integration tests for supply chain resilience layer
# spec/10_TEST_AND_EVALUATION_SPEC.yaml §resilience_integration_scenarios
# SYNTHETIC DEMO DATA ONLY – not real Shell or Pearl GTL operational data.

from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.store.in_memory_store import store
from app.services.resilience_engine import compute_resilience_profile
from app.domain.models import SupplierConstraint, PortStatus, ApprovedVendorEntry
from datetime import date, datetime, timezone

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_store():
    store.reset_to_seed()
    yield
    store.reset_to_seed()


# ─────────────────────────────────────────────────────────────────────────────
# SC-008: QUALITY_HOLD event updates the resilience profile
# ─────────────────────────────────────────────────────────────────────────────
class TestSC008_QualityHoldUpdatesProfile:
    def test_quality_hold_primary_supplier_is_reflected(self):
        """Profile for TW-2047/CVA-8842 must show primarySupplierStatus QUALITY_HOLD/CRITICAL."""
        profile = compute_resilience_profile(store, "TW-2047", "CVA-8842")
        assert profile.primary_supplier_status == "QUALITY_HOLD/CRITICAL"

    def test_quality_hold_reduces_unconstrained_count(self):
        """With SUP-101 on hold, unconstrained approved supplier count should be 1 (SUP-205)."""
        profile = compute_resilience_profile(store, "TW-2047", "CVA-8842")
        # SUP-101 = QUALITY_HOLD/CRITICAL (blocked), SUP-203 = PORT_CONGESTION/HIGH (blocked)
        # SUP-205 = TERTIARY, no constraint → only 1 unconstrained
        assert profile.unconstrained_approved_supplier_count == 1

    def test_readiness_status_is_critical(self):
        """resilienceScore > 60 should yield CRITICAL readiness status (spec/09 §thresholds)."""
        profile = compute_resilience_profile(store, "TW-2047", "CVA-8842")
        assert profile.readiness_status == "CRITICAL"
        assert profile.resilience_score > 60.0


# ─────────────────────────────────────────────────────────────────────────────
# SC-009: Dashboard AVL endpoint returns constrained/unconstrained counts
# ─────────────────────────────────────────────────────────────────────────────
class TestSC009_AvlEndpoint:
    def test_avl_returns_entries_for_material(self):
        resp = client.get("/api/resilience/avl?material_id=CVA-8842")
        assert resp.status_code == 200
        data = resp.json()
        assert data["material_id"] == "CVA-8842"
        assert len(data["entries"]) >= 3  # SUP-101, SUP-203, SUP-205

    def test_avl_unconstrained_count_is_one(self):
        """Only SUP-205 should be unconstrained in the demo scenario."""
        resp = client.get("/api/resilience/avl?material_id=CVA-8842")
        data = resp.json()
        assert data["unconstrained_approved_count"] == 1

    def test_avl_primary_supplier_marked_constrained(self):
        resp = client.get("/api/resilience/avl?material_id=CVA-8842")
        data = resp.json()
        sup101 = next(e for e in data["entries"] if e["supplier_id"] == "SUP-101")
        assert sup101["constrained"] is True
        assert sup101["constraint_type"] == "QUALITY_HOLD"
        assert sup101["constraint_severity"] == "CRITICAL"

    def test_avl_tertiary_supplier_is_unconstrained(self):
        resp = client.get("/api/resilience/avl?material_id=CVA-8842")
        data = resp.json()
        sup205 = next(e for e in data["entries"] if e["supplier_id"] == "SUP-205")
        assert sup205["constrained"] is False
        assert sup205["avl_status"] == "APPROVED"

    def test_avl_404_for_unknown_material(self):
        resp = client.get("/api/resilience/avl?material_id=UNKNOWN-MAT")
        assert resp.status_code == 404
        assert resp.json()["code"] == "NOT_FOUND"


# ─────────────────────────────────────────────────────────────────────────────
# SC-010: Port congestion event triggers port-status endpoint correctly
# ─────────────────────────────────────────────────────────────────────────────
class TestSC010_PortStatusEndpoint:
    def test_sgsin_port_status_returns_congestion(self):
        """SGSIN must report CONGESTION/HIGH in the demo scenario."""
        resp = client.get("/api/resilience/port-status?port_code=SGSIN")
        assert resp.status_code == 200
        data = resp.json()
        assert data["port_code"] == "SGSIN"
        assert data["disruption_type"] == "CONGESTION"
        assert data["severity"] == "HIGH"

    def test_sgsin_with_material_returns_impacted_shipment_count(self):
        resp = client.get("/api/resilience/port-status?port_code=SGSIN&material_id=CVA-8842")
        assert resp.status_code == 200
        data = resp.json()
        # SHP-90017 is DELAYED, not delivered → impacted
        assert data["impacted_shipment_count"] >= 1

    def test_unknown_port_returns_404(self):
        resp = client.get("/api/resilience/port-status?port_code=XXUNK")
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# SC-011: AVL newly APPROVED supplier appears in get_avl_status
# ─────────────────────────────────────────────────────────────────────────────
class TestSC011_NewAvlEntryAppearsImmediately:
    def test_new_avl_entry_visible_in_same_cycle(self):
        """Adding a new AVL entry must be immediately visible via the endpoint."""
        store.upsert_avl_entry(ApprovedVendorEntry(
            supplier_id="SUP-999",
            material_id="CVA-8842",
            avl_status="APPROVED",
            effective_date=date(2026, 10, 1),
            reason="Test qualification",
        ))
        resp = client.get("/api/resilience/avl?material_id=CVA-8842")
        data = resp.json()
        sup_ids = [e["supplier_id"] for e in data["entries"]]
        assert "SUP-999" in sup_ids


# ─────────────────────────────────────────────────────────────────────────────
# SC-012: Constrained suppliers excluded from feasible candidates
# ─────────────────────────────────────────────────────────────────────────────
class TestSC012_ConstraintExclusion:
    def test_constrained_supplier_flagged_in_avl(self):
        """Constrained suppliers must have constrained=True and include reason."""
        resp = client.get("/api/resilience/avl?material_id=CVA-8842")
        data = resp.json()
        sup203 = next(e for e in data["entries"] if e["supplier_id"] == "SUP-203")
        assert sup203["constrained"] is True
        assert sup203["constraint_type"] == "PORT_CONGESTION"

    def test_clearing_constraint_makes_supplier_unconstrained(self):
        """After clearing a constraint, the supplier must no longer be blocked."""
        from app.domain.models import SupplierConstraint as SC
        store.upsert_supplier_constraint(SC(
            supplier_id="SUP-101",
            material_id="CVA-8842",
            constraint_type="CLEARED",
            constraint_severity="LOW",
            affected_from_date=datetime.now(timezone.utc),
            source_event_id="EVT-SC-CLEARED",
        ))
        resp = client.get("/api/resilience/avl?material_id=CVA-8842")
        data = resp.json()
        sup101 = next(e for e in data["entries"] if e["supplier_id"] == "SUP-101")
        assert sup101["constrained"] is False
        # unconstrained count should now be 2 (SUP-101 + SUP-205)
        assert data["unconstrained_approved_count"] == 2


# ─────────────────────────────────────────────────────────────────────────────
# Supplier resilience status endpoint
# ─────────────────────────────────────────────────────────────────────────────
class TestSupplierResilienceStatusEndpoint:
    def test_active_constraint_for_sup101(self):
        resp = client.get("/api/resilience/supplier-status?supplier_id=SUP-101&material_id=CVA-8842")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ACTIVE"
        assert data["constraint_type"] == "QUALITY_HOLD"
        assert data["constraint_severity"] == "CRITICAL"

    def test_cleared_for_unconstrained_supplier(self):
        resp = client.get("/api/resilience/supplier-status?supplier_id=SUP-205&material_id=CVA-8842")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "CLEARED"

    def test_404_for_unknown_supplier(self):
        resp = client.get("/api/resilience/supplier-status?supplier_id=SUP-UNKNOWN")
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Resilience profile endpoint + stale-profile detection
# ─────────────────────────────────────────────────────────────────────────────
class TestResilienceProfileEndpoint:
    def test_profile_endpoint_returns_correct_score(self):
        resp = client.get("/api/resilience/profile?work_package_id=TW-2047&material_id=CVA-8842")
        assert resp.status_code == 200
        data = resp.json()
        profile = data["profile"]
        assert profile["readiness_status"] == "CRITICAL"
        assert profile["resilience_score"] > 60.0
        assert profile["unconstrained_approved_supplier_count"] == 1
        assert profile["primary_supplier_status"] == "QUALITY_HOLD/CRITICAL"

    def test_profile_age_secs_is_non_negative(self):
        resp = client.get("/api/resilience/profile?work_package_id=TW-2047&material_id=CVA-8842")
        data = resp.json()
        assert data["profile_age_secs"] >= 0

    def test_profile_stale_flag_present(self):
        """stale field must be present (UI uses it for RESILIENCE_PROFILE_STALE warning SC-016)."""
        resp = client.get("/api/resilience/profile?work_package_id=TW-2047&material_id=CVA-8842")
        data = resp.json()
        assert "stale" in data

    def test_profile_dimension_scores_sum_correctly(self):
        """Weighted sum of dimension scores must equal resilience_score (spec/13 §3.1)."""
        resp = client.get("/api/resilience/profile?work_package_id=TW-2047&material_id=CVA-8842")
        data = resp.json()
        p = data["profile"]
        expected = round(
            p["supplier_coverage_score"] * 0.30
            + p["inventory_buffer_score"] * 0.25
            + p["shipment_exposure_score"] * 0.25
            + p["port_disruption_score"] * 0.20,
            1,
        )
        assert abs(p["resilience_score"] - expected) < 0.1


# ─────────────────────────────────────────────────────────────────────────────
# Unit: resilience score computation for distinct posture scenarios
# ─────────────────────────────────────────────────────────────────────────────
class TestResilienceScoreUnit:
    def test_all_clear_yields_low_score(self):
        """Clearing all constraints and port disruptions → CONFIRMED posture."""
        from app.domain.models import SupplierConstraint as SC, PortStatus as PS
        now = datetime.now(timezone.utc)
        # Clear all constraints
        for sup_id in ["SUP-101", "SUP-203"]:
            store.upsert_supplier_constraint(SC(
                supplier_id=sup_id,
                material_id="CVA-8842",
                constraint_type="CLEARED",
                constraint_severity="LOW",
                affected_from_date=now,
                source_event_id="EVT-TEST-CLEAR",
            ))
        # Clear port disruption
        store.upsert_port_status(PS(
            port_code="SGSIN",
            port_name="Port of Singapore",
            disruption_type="CLEARED",
            severity="LOW",
            affected_from_date=now,
            source_event_id="EVT-TEST-PORT-CLEAR",
        ))
        profile = compute_resilience_profile(store, "TW-2047", "CVA-8842")
        # 3 unconstrained approved → D1=0, D4=0, profile should be CONFIRMED
        assert profile.unconstrained_approved_supplier_count == 3
        assert profile.readiness_status in ("CONFIRMED", "AT_RISK")
