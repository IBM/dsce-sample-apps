# backend/app/main.py
# FastAPI application entry point
# Turnaround Supply Chain Intelligence – Python/FastAPI backend

from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.middleware import CorrelationIdMiddleware
from app.services.resilience_engine import compute_resilience_profile
from app.store.in_memory_store import store
from app.api.routers import (
    actions, agent, auth, confluent, demo, inventory, rag, resilience, risks, shipments, suppliers, work_packages,
)
from app.core.config import settings
from app.core.errors import AppError, app_error_handler


@asynccontextmanager
async def lifespan(application: FastAPI):  # noqa: RUF029
    # Seed the resilience profile for the primary demo scenario at startup
    # so the profile is immediately available (spec/13 §8 demo playback T+4 state)
    compute_resilience_profile(store, "TW-2047", "CVA-8842", contributing_event_id="SEED")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Turnaround Supply Chain Intelligence API",
    description=(
        "Oil & Gas Turnaround Supply Chain Intelligence – synthetic demo backend. "
        "SYNTHETIC DATA ONLY – not real Shell or Pearl GTL operational data."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Middleware
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-correlation-id"],
)

# Exception handlers
app.add_exception_handler(AppError, app_error_handler)

# Routers
app.include_router(auth.router)
app.include_router(agent.router)
app.include_router(risks.router)
app.include_router(shipments.router)
app.include_router(work_packages.router)
app.include_router(inventory.router)
app.include_router(suppliers.router)
app.include_router(resilience.router)
app.include_router(rag.router)
app.include_router(actions.router)
app.include_router(confluent.router)
app.include_router(demo.router)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "demo_warning": settings.demo_warning,
        "facility": settings.demo_facility_label,
    }
