# backend/app/services/approval_service.py
# Human approval enforcement – spec/08_SECURITY_OBSERVABILITY_NFR.md

from __future__ import annotations
import hashlib
import json
from datetime import datetime, timedelta, timezone

from app.core.errors import AppError
from app.domain.models import ApprovalRequest, ApprovalStatus, MitigationOption
from app.store.in_memory_store import store


def _option_hash(option: MitigationOption) -> str:
    """SHA-256 hash of the option snapshot to detect post-approval changes."""
    snapshot = option.model_dump(mode="json", exclude={"option_id", "risk_id"})
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()


def create_approval_request(
    risk_id: str,
    option_id: str,
    recommendation_summary: str,
    correlation_id: str,
) -> ApprovalRequest:
    """Create a new PENDING approval request (spec: write tools require approval context)."""
    option = store.get_option(option_id)
    if not option:
        raise AppError("NOT_FOUND", f"Option {option_id} not found", correlation_id)

    approval = ApprovalRequest(
        approval_request_id=store.generate_id(),
        risk_id=risk_id,
        option_id=option_id,
        option_hash=_option_hash(option),
        recommendation_summary=recommendation_summary,
        expiry=(datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        status="PENDING",
        created_at=datetime.now(timezone.utc),
    )
    store.upsert_approval(approval)
    return approval


def approve(approval_request_id: str, approver: str) -> ApprovalRequest:
    approval = store.get_approval(approval_request_id)
    if not approval:
        raise AppError("NOT_FOUND", f"Approval {approval_request_id} not found")
    if approval.status != "PENDING":
        raise AppError("CONFLICT", f"Approval already in state {approval.status}")
    updated = approval.model_copy(update={
        "status": "APPROVED",
        "approver": approver,
        "approved_at": datetime.now(timezone.utc),
    })
    store.upsert_approval(updated)
    return updated


def reject(approval_request_id: str, approver: str) -> ApprovalRequest:
    approval = store.get_approval(approval_request_id)
    if not approval:
        raise AppError("NOT_FOUND", f"Approval {approval_request_id} not found")
    updated = approval.model_copy(update={"status": "REJECTED", "approver": approver})
    store.upsert_approval(updated)
    return updated


def validate_for_execution(approval_request_id: str, option_id: str) -> ApprovalRequest:
    """
    Revalidate before executing a write action:
    - approval must exist and be APPROVED
    - approval must not be expired
    - option snapshot hash must match (detects post-approval mutations)
    """
    approval = store.get_approval(approval_request_id)
    if not approval:
        raise AppError("APPROVAL_REQUIRED", "No approval found")
    if approval.status != "APPROVED":
        raise AppError("APPROVAL_REQUIRED", f"Approval status is {approval.status}")

    expiry = datetime.fromisoformat(str(approval.expiry))
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expiry:
        raise AppError("APPROVAL_REQUIRED", "Approval has expired")

    option = store.get_option(option_id)
    if not option:
        raise AppError("NOT_FOUND", f"Option {option_id} not found")
    if _option_hash(option) != approval.option_hash:
        raise AppError(
            "APPROVAL_MISMATCH",
            "Option changed after approval – re-approval required",
        )

    return approval
