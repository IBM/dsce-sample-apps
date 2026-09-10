# backend/app/api/routers/auth.py
# Demo authentication endpoint.
#
# Credentials are held in environment variables (Code Engine secrets):
#   DEMO_USERNAME  — no default; must be set before running
#   DEMO_PASSWORD  — no default; must be set before running
#
# Set real values via Code Engine secrets or a local .env file.
# Never commit real credentials to source control.

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    name: str
    email: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    """Validate demo credentials and return a session user profile.

    Credentials are read from DEMO_USERNAME / DEMO_PASSWORD env vars so they
    are never stored in source code.
    """
    if (
        body.username.strip().lower() != settings.demo_username.lower()
        or body.password != settings.demo_password
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    return LoginResponse(
        username=settings.demo_username,
        name="Operations Admin",
        email=f"{settings.demo_username}@tsci.ops",
        role="Operations Admin",
    )
