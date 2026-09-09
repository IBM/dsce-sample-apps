# backend/app/api/routers/work_packages.py
# Read tool: get_work_package (spec/04_API_AND_TOOL_CONTRACTS.yaml)

from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.errors import AppError
from app.domain.models import MaterialRequirement, WorkPackage
from app.store.in_memory_store import store

router = APIRouter(prefix="/api/work-packages", tags=["work-packages"])


class WorkPackageResponse(BaseModel):
    work_package: WorkPackage
    requirements: list[MaterialRequirement]
    source_timestamp: datetime = datetime.utcnow()


@router.get("/{work_package_id}", response_model=WorkPackageResponse)
async def get_work_package(work_package_id: str, request: Request) -> WorkPackageResponse:
    wp = store.get_work_package(work_package_id)
    if not wp:
        raise AppError("NOT_FOUND", f"Work package {work_package_id} not found")
    reqs = store.get_requirements_by_work_package(work_package_id)
    return WorkPackageResponse(work_package=wp, requirements=reqs)
