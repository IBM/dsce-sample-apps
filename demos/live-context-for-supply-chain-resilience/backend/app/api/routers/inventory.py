# backend/app/api/routers/inventory.py
# Read tool: get_inventory_options (spec/04_API_AND_TOOL_CONTRACTS.yaml)

from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.domain.models import InventoryPosition
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


class InventoryCandidate(BaseModel):
    position: InventoryPosition
    transfer_feasible: bool
    notes: list[str] = []


class InventoryOptionsResponse(BaseModel):
    material_id: str
    destination_location_id: str
    candidates: list[InventoryCandidate]
    evaluated_at: datetime = datetime.utcnow()


@router.get("/options", response_model=InventoryOptionsResponse)
async def get_inventory_options(
    material_id: str,
    destination_location_id: str,
    quantity: float,
    required_by: datetime,
    request: Request,
) -> InventoryOptionsResponse:
    all_positions = store.get_all_inventory_for_material(material_id)
    candidates: list[InventoryCandidate] = []

    for pos in all_positions:
        if pos.location_id == destination_location_id:
            continue  # skip destination – that's the shortage location
        notes: list[str] = []
        feasible = pos.available >= quantity
        if not feasible:
            notes.append(f"Available ({pos.available}) < required ({quantity})")
        if pos.next_known_requirement_date:
            if pos.next_known_requirement_date < required_by.date():
                feasible = False
                notes.append("Transfer would jeopardise source next requirement")
        candidates.append(InventoryCandidate(position=pos, transfer_feasible=feasible, notes=notes))

    return InventoryOptionsResponse(
        material_id=material_id,
        destination_location_id=destination_location_id,
        candidates=candidates,
    )
