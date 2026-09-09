# backend/app/api/routers/actions.py
# Write tools with approval enforcement (spec/04_API_AND_TOOL_CONTRACTS.yaml)

from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.errors import AppError
from app.domain.models import ApprovalRequest
from app.services import approval_service, audit
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/actions", tags=["actions"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class ApprovalRequestBody(BaseModel):
    risk_id: str
    option_id: str
    recommendation_summary: str


class ApprovalDecisionBody(BaseModel):
    approver: str


class TransferBody(BaseModel):
    approval_request_id: str
    risk_id: str
    option_id: str
    source_location_id: str
    destination_location_id: str
    material_id: str
    quantity: float


class ExpediteBody(BaseModel):
    approval_request_id: str
    risk_id: str
    shipment_id: str
    requested_eta: datetime


class TransferResponse(BaseModel):
    transfer_request_id: str
    status: str
    source_timestamp: datetime = datetime.utcnow()


class ExpediteResponse(BaseModel):
    expedite_request_id: str
    status: str
    source_timestamp: datetime = datetime.utcnow()


# ---------------------------------------------------------------------------
# Approval lifecycle
# ---------------------------------------------------------------------------
@router.post("/approval-requests", response_model=ApprovalRequest)
async def request_approval(body: ApprovalRequestBody, request: Request) -> ApprovalRequest:
    cid = getattr(request.state, "correlation_id", "unknown")
    approval = approval_service.create_approval_request(
        risk_id=body.risk_id,
        option_id=body.option_id,
        recommendation_summary=body.recommendation_summary,
        correlation_id=cid,
    )
    audit.record("APPROVAL_REQUESTED", cid, risk_id=body.risk_id, option_id=body.option_id,
                 approval_request_id=approval.approval_request_id)
    return approval


@router.post("/approval-requests/{approval_request_id}/approve", response_model=ApprovalRequest)
async def approve(approval_request_id: str, body: ApprovalDecisionBody, request: Request) -> ApprovalRequest:
    cid = getattr(request.state, "correlation_id", "unknown")
    approval = approval_service.approve(approval_request_id, body.approver)
    audit.record("APPROVAL_APPROVED", cid, approval_request_id=approval_request_id,
                 approver=body.approver, actor=body.approver)
    return approval


@router.post("/approval-requests/{approval_request_id}/reject", response_model=ApprovalRequest)
async def reject(approval_request_id: str, body: ApprovalDecisionBody, request: Request) -> ApprovalRequest:
    cid = getattr(request.state, "correlation_id", "unknown")
    approval = approval_service.reject(approval_request_id, body.approver)
    audit.record("APPROVAL_REJECTED", cid, approval_request_id=approval_request_id,
                 approver=body.approver, actor=body.approver)
    return approval


# ---------------------------------------------------------------------------
# Write: Inventory Transfer
# ---------------------------------------------------------------------------
@router.post("/inventory-transfer", response_model=TransferResponse)
async def execute_inventory_transfer(body: TransferBody, request: Request) -> TransferResponse:
    cid = getattr(request.state, "correlation_id", "unknown")

    # Preconditions (spec/04)
    approval_service.validate_for_execution(body.approval_request_id, body.option_id)

    src = store.get_inventory(body.source_location_id, body.material_id)
    if not src or src.available < body.quantity:
        raise AppError("INSUFFICIENT_INVENTORY",
                       f"Source {body.source_location_id} has insufficient available stock")

    # Simulate the transfer (demo only)
    new_src = src.model_copy(update={
        "reserved": src.reserved + body.quantity,
        "available": max(src.available - body.quantity, 0),
    })
    store.upsert_inventory(new_src)

    dest = store.get_inventory(body.destination_location_id, body.material_id)
    if dest:
        store.upsert_inventory(dest.model_copy(update={
            "on_hand": dest.on_hand + body.quantity,
            "available": dest.available + body.quantity,
        }))

    # Update risk status
    risk = store.get_risk(body.risk_id)
    if risk:
        store.upsert_risk(risk.model_copy(update={"status": "MITIGATED"}))

    transfer_id = f"TFR-{store.generate_id()[:8].upper()}"
    audit.record("TRANSFER_EXECUTED", cid, transfer_request_id=transfer_id,
                 risk_id=body.risk_id, material_id=body.material_id, quantity=body.quantity)

    return TransferResponse(transfer_request_id=transfer_id, status="CREATED")


# ---------------------------------------------------------------------------
# Write: Mark risk mitigated (for option types without a dedicated execute endpoint)
# ---------------------------------------------------------------------------
class MarkMitigatedBody(BaseModel):
    approval_request_id: str
    risk_id: str
    option_id: str


class MarkMitigatedResponse(BaseModel):
    risk_id: str
    status: str


@router.post("/mark-mitigated", response_model=MarkMitigatedResponse)
async def mark_mitigated(body: MarkMitigatedBody, request: Request) -> MarkMitigatedResponse:
    cid = getattr(request.state, "correlation_id", "unknown")
    approval_service.validate_for_execution(body.approval_request_id, body.option_id)
    risk = store.get_risk(body.risk_id)
    if not risk:
        raise AppError("NOT_FOUND", f"Risk {body.risk_id} not found")
    store.upsert_risk(risk.model_copy(update={"status": "MITIGATED"}))
    audit.record("RISK_MITIGATED", cid, risk_id=body.risk_id, option_id=body.option_id)
    return MarkMitigatedResponse(risk_id=body.risk_id, status="MITIGATED")


# ---------------------------------------------------------------------------
# Write: Supplier Expedite
# ---------------------------------------------------------------------------
@router.post("/supplier-expedite", response_model=ExpediteResponse)
async def execute_supplier_expedite(body: ExpediteBody, request: Request) -> ExpediteResponse:
    cid = getattr(request.state, "correlation_id", "unknown")

    approval_service.validate_for_execution(body.approval_request_id, body.option_id if hasattr(body, "option_id") else "")  # type: ignore[attr-defined]
    shipment = store.get_shipment(body.shipment_id)
    if not shipment:
        raise AppError("NOT_FOUND", f"Shipment {body.shipment_id} not found")

    updated = shipment.model_copy(update={
        "current_eta": body.requested_eta,
        "status": "IN_TRANSIT",
    })
    store.upsert_shipment(updated)

    risk = store.get_risk(body.risk_id)
    if risk:
        store.upsert_risk(risk.model_copy(update={"status": "MITIGATED"}))

    expedite_id = f"EXP-{store.generate_id()[:8].upper()}"
    audit.record("EXPEDITE_EXECUTED", cid, expedite_request_id=expedite_id,
                 risk_id=body.risk_id, shipment_id=body.shipment_id)

    return ExpediteResponse(expedite_request_id=expedite_id, status="CREATED")
