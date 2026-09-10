# backend/tests/test_risk_detector.py
# Unit tests for risk detection rule (spec/03 risk_rule_v1, spec/10)
# Covers: late_delivery_rule, inventory_available_calculation, idempotency

from __future__ import annotations
import pytest
from datetime import datetime, timedelta, timezone
from app.domain.models import InventoryPosition, MaterialRequirement, Shipment
from app.services.risk_detector import detect_late_delivery_risk


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _shipment(current_eta_offset_days: int, status: str = "DELAYED") -> Shipment:
    return Shipment(
        shipment_id="SHP-TEST-001",
        po_id="PO-TEST",
        po_line_id="10",
        material_id="CVA-8842",
        quantity=1,
        status=status,  # type: ignore[arg-type]
        original_eta=_now() - timedelta(days=10),
        current_eta=_now() + timedelta(days=current_eta_offset_days),
        logistics_provider="TEST",
        destination_location_id="PEARL-DEMO",
    )


def _requirement(required_by_offset_days: int, mandatory: bool = True) -> MaterialRequirement:
    return MaterialRequirement(
        requirement_id="MR-TEST",
        work_package_id="TW-TEST",
        material_id="CVA-8842",
        quantity_required=1,
        required_by=_now() + timedelta(days=required_by_offset_days),
        mandatory=mandatory,
    )


def _inventory(available: float) -> InventoryPosition:
    return InventoryPosition(
        location_id="PEARL-DEMO",
        material_id="CVA-8842",
        on_hand=available,
        reserved=0,
        available=available,
    )


class TestRiskDetector:
    def test_on_time_no_risk(self):
        """Scenario on_time: ETA before required_by → no risk (spec/10 integration)."""
        shipment = _shipment(current_eta_offset_days=2)
        req = _requirement(required_by_offset_days=5)
        result = detect_late_delivery_risk(shipment, req, _inventory(0), "CID-001")
        assert result is None

    def test_late_no_inventory_detects_risk(self):
        """Scenario delayed_no_inventory: late + available=0 → CRITICAL risk."""
        shipment = _shipment(current_eta_offset_days=10)
        req = _requirement(required_by_offset_days=2)  # required in 2 days (< 72h → CRITICAL)
        result = detect_late_delivery_risk(shipment, req, _inventory(0), "CID-002")
        assert result is not None
        assert result.risk_type == "LATE_DELIVERY"
        assert result.severity == "CRITICAL"
        assert result.correlation_id == "CID-002"

    def test_late_sufficient_inventory_no_risk(self):
        """Late shipment but sufficient local inventory → no supply risk."""
        shipment = _shipment(current_eta_offset_days=10)
        req = _requirement(required_by_offset_days=2)
        result = detect_late_delivery_risk(shipment, req, _inventory(5), "CID-003")
        # available (5) >= required (1) → no risk
        assert result is None

    def test_non_mandatory_no_risk(self):
        """Non-mandatory material → no risk even if late."""
        shipment = _shipment(current_eta_offset_days=10)
        req = _requirement(required_by_offset_days=2, mandatory=False)
        result = detect_late_delivery_risk(shipment, req, _inventory(0), "CID-004")
        assert result is None

    def test_risk_contains_facts(self):
        """Risk event must carry structured facts (spec/02)."""
        shipment = _shipment(current_eta_offset_days=5)
        req = _requirement(required_by_offset_days=1)
        result = detect_late_delivery_risk(shipment, req, _inventory(0), "CID-005")
        assert result is not None
        assert "shortage_quantity" in result.facts
        assert "current_eta" in result.facts
        assert result.facts["shortage_quantity"] == 1

    def test_severity_high_within_168h(self):
        """Hours until required > 72 and <= 168 → HIGH (spec/09)."""
        shipment = _shipment(current_eta_offset_days=10)
        req = _requirement(required_by_offset_days=5)  # 5 days = 120h → HIGH
        result = detect_late_delivery_risk(shipment, req, _inventory(0), "CID-006")
        assert result is not None
        assert result.severity == "HIGH"
