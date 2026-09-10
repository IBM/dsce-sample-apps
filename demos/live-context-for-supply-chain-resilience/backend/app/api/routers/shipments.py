# backend/app/api/routers/shipments.py
# Read tool: get_shipment (spec/04_API_AND_TOOL_CONTRACTS.yaml)

from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.errors import AppError
from app.domain.models import Shipment
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/shipments", tags=["shipments"])


class ShipmentResponse(BaseModel):
    shipment: Shipment
    source_timestamp: datetime = datetime.utcnow()


@router.get("/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(shipment_id: str, request: Request) -> ShipmentResponse:
    shipment = store.get_shipment(shipment_id)
    if not shipment:
        raise AppError("NOT_FOUND", f"Shipment {shipment_id} not found")
    return ShipmentResponse(shipment=shipment)
