# backend/tests/test_approval.py
# Unit tests for approval enforcement (spec/08, spec/10: approval_validation)

from __future__ import annotations
import pytest
from datetime import datetime, timedelta, timezone
from app.domain.models import ApprovalRequest, MitigationOption
from app.services.approval_service import (
    _option_hash,
    validate_for_execution,
)
from app.store.in_memory_store import store
import uuid


def _make_option() -> MitigationOption:
    opt = MitigationOption(
        option_id=str(uuid.uuid4()),
        risk_id="RSK-TEST",
        type="TRANSFER",
        feasible=True,
        schedule_risk_score=20,
        technical_risk_score=10,
        supply_risk_score=25,
        total_score=20,
        requires_engineering_approval=False,
        requires_procurement_approval=False,
    )
    store.upsert_option(opt)
    return opt


def _make_approval(option: MitigationOption, status: str = "APPROVED",
                   expiry_offset_hours: int = 24) -> ApprovalRequest:
    approval = ApprovalRequest(
        approval_request_id=str(uuid.uuid4()),
        risk_id="RSK-TEST",
        option_id=option.option_id,
        option_hash=_option_hash(option),
        recommendation_summary="Test",
        expiry=datetime.now(timezone.utc) + timedelta(hours=expiry_offset_hours),
        status=status,  # type: ignore[arg-type]
        created_at=datetime.now(timezone.utc),
    )
    store.upsert_approval(approval)
    return approval


class TestApprovalValidation:
    def setup_method(self):
        store.reset_to_seed()

    def test_action_without_approval_raises(self):
        """spec/10: action_without_approval → APPROVAL_REQUIRED"""
        from app.core.errors import AppError
        with pytest.raises(AppError) as exc:
            validate_for_execution("nonexistent-id", "any-option")
        assert exc.value.code == "APPROVAL_REQUIRED"

    def test_approved_valid_passes(self):
        option = _make_option()
        approval = _make_approval(option, status="APPROVED")
        result = validate_for_execution(approval.approval_request_id, option.option_id)
        assert result.status == "APPROVED"

    def test_pending_approval_raises(self):
        from app.core.errors import AppError
        option = _make_option()
        approval = _make_approval(option, status="PENDING")
        with pytest.raises(AppError) as exc:
            validate_for_execution(approval.approval_request_id, option.option_id)
        assert exc.value.code == "APPROVAL_REQUIRED"

    def test_expired_approval_raises(self):
        from app.core.errors import AppError
        option = _make_option()
        approval = _make_approval(option, status="APPROVED", expiry_offset_hours=-1)
        with pytest.raises(AppError) as exc:
            validate_for_execution(approval.approval_request_id, option.option_id)
        assert exc.value.code == "APPROVAL_REQUIRED"
        assert "expired" in str(exc.value).lower()

    def test_option_changed_after_approval_raises(self):
        """spec/10: stale_inventory_after_recommendation → APPROVAL_MISMATCH"""
        from app.core.errors import AppError
        option = _make_option()
        approval = _make_approval(option, status="APPROVED")
        # Mutate the option after approval
        mutated = option.model_copy(update={"incremental_cost": 99999.0})
        store.upsert_option(mutated)
        with pytest.raises(AppError) as exc:
            validate_for_execution(approval.approval_request_id, option.option_id)
        assert exc.value.code == "APPROVAL_MISMATCH"
