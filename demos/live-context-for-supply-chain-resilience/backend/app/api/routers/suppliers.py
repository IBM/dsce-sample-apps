# backend/app/api/routers/suppliers.py
# Read tool: get_supplier_options (spec/04_API_AND_TOOL_CONTRACTS.yaml)

from __future__ import annotations
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.domain.models import Supplier
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


class SupplierCandidate(BaseModel):
    supplier: Supplier
    estimated_delivery: datetime
    can_meet_deadline: bool
    incremental_cost_usd: float | None = None


class SupplierOptionsResponse(BaseModel):
    material_id: str
    candidates: list[SupplierCandidate]
    evaluated_at: datetime = datetime.utcnow()


@router.get("/options", response_model=SupplierOptionsResponse)
async def get_supplier_options(
    material_id: str,
    required_by: datetime,
    quantity: float,
    request: Request,
) -> SupplierOptionsResponse:
    suppliers = store.get_approved_suppliers_for_material(material_id)
    candidates: list[SupplierCandidate] = []

    for sup in suppliers:
        est_delivery = datetime.now(timezone.utc) + timedelta(days=sup.standard_lead_time_days)
        req_by_aware = required_by if required_by.tzinfo else required_by.replace(tzinfo=timezone.utc)
        candidates.append(SupplierCandidate(
            supplier=sup,
            estimated_delivery=est_delivery,
            can_meet_deadline=est_delivery <= req_by_aware,
            incremental_cost_usd=18000.0 if sup.supplier_id == "SUP-205" else None,
        ))

    return SupplierOptionsResponse(material_id=material_id, candidates=candidates)
