# backend/app/api/routers/risks.py
# Read tools for risk investigation (spec/04_API_AND_TOOL_CONTRACTS.yaml)

from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.errors import AppError
from app.domain.models import MitigationOption, RiskEvent
from app.domain.scoring import rank_options, are_near_equivalent
from app.services.mitigation_builder import build_and_score_options
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/risks", tags=["risks"])


class RiskResponse(BaseModel):
    risk: RiskEvent
    source_timestamp: datetime = datetime.utcnow()


class RisksListResponse(BaseModel):
    risks: list[RiskEvent]
    total: int
    source_timestamp: datetime = datetime.utcnow()


class MitigationResponse(BaseModel):
    risk_id: str
    ranked_options: list[MitigationOption]
    near_equivalent_top_two: bool
    score_version: str = "v1"
    source_timestamp: datetime = datetime.utcnow()


@router.get("", response_model=RisksListResponse)
async def list_risks(request: Request) -> RisksListResponse:
    risks = store.get_all_risks()
    return RisksListResponse(risks=risks, total=len(risks))


@router.get("/{risk_id}", response_model=RiskResponse)
async def get_risk(risk_id: str, request: Request) -> RiskResponse:
    risk = store.get_risk(risk_id)
    if not risk:
        raise AppError("NOT_FOUND", f"Risk {risk_id} not found")
    return RiskResponse(risk=risk)


@router.get("/{risk_id}/options", response_model=MitigationResponse)
async def get_mitigation_options(risk_id: str, request: Request) -> MitigationResponse:
    risk = store.get_risk(risk_id)
    if not risk:
        raise AppError("NOT_FOUND", f"Risk {risk_id} not found")

    existing = store.get_options_for_risk(risk_id)
    if not existing:
        options = build_and_score_options(risk)
        for opt in options:
            store.upsert_option(opt)
        existing = options

    ranked = rank_options(existing)
    near_equiv = len(ranked) >= 2 and are_near_equivalent(ranked[0], ranked[1])

    return MitigationResponse(
        risk_id=risk_id,
        ranked_options=ranked,
        near_equivalent_top_two=near_equiv,
    )
