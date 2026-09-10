# backend/app/api/routers/agent.py
# Server-side proxy for all watsonx Orchestrate (WXO) agent calls.
#
# WHY THIS EXISTS
# ───────────────
# Calling WXO from the browser requires the browser to hold a Bearer token.
# Even though the API key never leaves the server, a Bearer token extracted
# from the browser's Network tab can call any WXO endpoint for up to 1 hour.
#
# By proxying through the backend we gain:
#   • Zero credentials in the browser — the UI sends plain JSON, gets plain text
#   • Per-session audit trail — every call logged with correlation ID
#   • Rate limiting / abuse prevention at the backend layer
#   • Input validation before anything reaches WXO
#   • Ability to sanitise or augment WXO responses before returning them
#
# ENDPOINTS
# ─────────
#   GET  /api/agent/status        — is WXO configured and reachable?
#   POST /api/agent/chat          — primary TSCI orchestrator agent
#   POST /api/agent/crag/chat     — CRAG / Approved Vendor Intelligence agent

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])

# ── Constants ──────────────────────────────────────────────────────────────────

IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"
WXO_TIMEOUT   = 120.0   # seconds — WXO completions can be slow
IAM_TIMEOUT   = 15.0    # seconds — IAM token exchange
TOKEN_MARGIN  = 120     # seconds — refresh token this many seconds before expiry
AGENT_ENV     = "live"  # WXO environment name for agent lookup

# ── IAM token cache ────────────────────────────────────────────────────────────
# Shared across all requests on this worker. Thread-safe because asyncio is
# single-threaded; _token_lock prevents concurrent refresh races under load.

_iam_token:  Optional[str] = None
_iam_expiry: float         = 0.0   # Unix seconds
_token_lock: asyncio.Lock  = asyncio.Lock()

# ── Agent-ID cache ─────────────────────────────────────────────────────────────

_agent_ids: dict[str, str] = {}   # agent_name → agent_id


# ── IAM helpers ────────────────────────────────────────────────────────────────

def _wxo_base() -> str:
    url = settings.wxo_base_url.rstrip("/")
    if not url:
        raise HTTPException(status_code=503, detail="WXO_BASE_URL is not configured.")
    return url


async def _get_iam_token() -> str:
    """Return a valid IAM Bearer token, refreshing from IBM Cloud IAM if needed."""
    global _iam_token, _iam_expiry

    async with _token_lock:
        if _iam_token and time.time() < _iam_expiry - TOKEN_MARGIN:
            return _iam_token

        if not settings.wxo_api_key:
            raise HTTPException(status_code=503, detail="WXO_API_KEY is not configured.")

        async with httpx.AsyncClient(timeout=IAM_TIMEOUT) as client:
            resp = await client.post(
                IAM_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey": settings.wxo_api_key,
                },
            )

        if resp.status_code != 200:
            log.error("IAM token exchange failed: %s %s", resp.status_code, resp.text[:200])
            raise HTTPException(
                status_code=502,
                detail=f"IAM token exchange failed ({resp.status_code}).",
            )

        data        = resp.json()
        _iam_token  = data["access_token"]
        _iam_expiry = float(data["expiration"])   # Unix seconds
        log.info("IAM token refreshed, expires at %s", _iam_expiry)
        return _iam_token   # type: ignore[return-value]


def _invalidate_token() -> None:
    """Force the next call to _get_iam_token() to refresh from IAM."""
    global _iam_token
    _iam_token = None


# ── Agent-ID resolver ──────────────────────────────────────────────────────────

async def _resolve_agent_id(agent_name: str) -> str:
    """Resolve an agent name to its WXO agent_id, with in-process caching."""
    if agent_name in _agent_ids:
        return _agent_ids[agent_name]

    token   = await _get_iam_token()
    base    = _wxo_base()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=IAM_TIMEOUT) as client:
        # Primary: environment/releases endpoint
        try:
            r = await client.get(
                f"{base}/v1/orchestrate/agents/environment/{AGENT_ENV}/releases",
                headers=headers,
            )
            if r.status_code == 200:
                agent = _pick_agent(r.json(), agent_name)
                if agent:
                    _agent_ids[agent_name] = agent
                    return agent
        except httpx.HTTPError:
            pass

        # Fallback: unified v2 search
        try:
            r = await client.get(
                f"{base}/v2/orchestrate/agents/unified",
                params={"names": agent_name, "limit": 5},
                headers=headers,
            )
            if r.status_code == 200:
                agent = _pick_agent(r.json(), agent_name)
                if agent:
                    _agent_ids[agent_name] = agent
                    return agent
        except httpx.HTTPError:
            pass

        # Last resort: legacy v1 list
        r = await client.get(
            f"{base}/v1/orchestrate/agents",
            params={"names": agent_name},
            headers=headers,
        )

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Agent lookup failed ({r.status_code}).")

    agent = _pick_agent(r.json(), agent_name)
    if not agent:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_name}' not found in WXO environment '{AGENT_ENV}'.",
        )

    _agent_ids[agent_name] = agent
    return agent


def _pick_agent(raw: object, name: str) -> Optional[str]:
    """Extract agent_id from any WXO list response shape."""
    items: list = []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = (
            raw.get("data")   # type: ignore[assignment]
            or raw.get("items")
            or raw.get("agents")
            or []
        )

    exact = next((a["id"] for a in items if a.get("name") == name), None)
    if exact:
        return exact
    ci = next((a["id"] for a in items if a.get("name", "").lower() == name.lower()), None)
    if ci:
        return ci
    if len(items) == 1:
        return items[0].get("id")
    return None


def _extract_text(data: dict) -> str:
    """Pull plain text out of a WXO chat/completions response."""
    choices = data.get("choices") or []
    if not choices:
        return "(No response)"
    content = choices[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        parts = [c["text"] for c in content if c.get("response_type") == "text" and c.get("text")]
        return "\n".join(parts).strip()
    return str(content).strip() or "(No response)"


# ── Request / response models ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str            = Field(..., min_length=1, max_length=8_000)
    thread_id:  Optional[str]  = Field(None, description="Continue an existing conversation")
    agent_name: Optional[str]  = Field(None, description="Override the default agent name")


class ChatResponse(BaseModel):
    text:      str
    thread_id: str
    agent_id:  str


class AgentStatusResponse(BaseModel):
    configured: bool
    message:    str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=AgentStatusResponse)
async def agent_status() -> AgentStatusResponse:
    """Lightweight liveness check — is WXO configured and reachable?

    Always returns HTTP 200 so the UI can unconditionally poll this.
    The `configured` field determines whether to use live or stub mode.
    """
    if not settings.wxo_api_key or not settings.wxo_base_url:
        return AgentStatusResponse(configured=False, message="WXO credentials not configured.")
    try:
        await _get_iam_token()
        return AgentStatusResponse(configured=True, message="WXO is reachable.")
    except Exception:
        return AgentStatusResponse(
            configured=False,
            message="WXO credentials present but IAM exchange failed.",
        )


@router.post("/chat", response_model=ChatResponse)
async def agent_chat(body: ChatRequest, request: Request) -> ChatResponse:
    """Send a message to the primary TSCI orchestrator agent.

    Bearer token, WXO base URL, and agent ID are fully server-side.
    The UI sends a plain message string and receives a plain text reply.
    """
    corr_id    = request.headers.get(settings.api_correlation_header, "-")
    agent_name = body.agent_name or "tsci_primary_agent"

    token    = await _get_iam_token()
    base     = _wxo_base()
    agent_id = await _resolve_agent_id(agent_name)

    req_headers: dict[str, str] = {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }
    if body.thread_id:
        req_headers["X-IBM-THREAD-ID"] = body.thread_id

    payload = {
        "messages":              [{"role": "user", "content": body.message}],
        "context":               {},
        "additional_parameters": {},
        "stream":                False,
    }

    log.info("agent_chat corr=%s agent=%s thread=%s", corr_id, agent_id, body.thread_id)

    async with httpx.AsyncClient(timeout=WXO_TIMEOUT) as client:
        resp = await client.post(
            f"{base}/v1/orchestrate/{agent_id}/chat/completions",
            headers=req_headers,
            json=payload,
        )

    if resp.status_code == 401:
        _invalidate_token()
        raise HTTPException(status_code=401, detail="WXO auth token expired; please retry.")

    if resp.status_code != 200:
        log.error("WXO chat error corr=%s status=%s body=%s", corr_id, resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail=f"WXO agent error ({resp.status_code}).")

    data       = resp.json()
    reply_text = _extract_text(data)
    new_thread = data.get("thread_id", body.thread_id or "")

    return ChatResponse(text=reply_text, thread_id=new_thread, agent_id=agent_id)


@router.post("/crag/chat", response_model=ChatResponse)
async def crag_chat(body: ChatRequest, request: Request) -> ChatResponse:
    """Send a message to the CRAG / Approved Vendor Intelligence agent.

    Identical flow to /api/agent/chat but targets the CRAG agent by default.
    """
    corr_id    = request.headers.get(settings.api_correlation_header, "-")
    agent_name = body.agent_name or "crag_rag_agent_v1"

    token    = await _get_iam_token()
    base     = _wxo_base()
    agent_id = await _resolve_agent_id(agent_name)

    req_headers: dict[str, str] = {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }
    if body.thread_id:
        req_headers["X-IBM-THREAD-ID"] = body.thread_id

    payload = {
        "messages":              [{"role": "user", "content": body.message}],
        "context":               {},
        "additional_parameters": {},
        "stream":                False,
    }

    log.info("crag_chat corr=%s agent=%s thread=%s", corr_id, agent_id, body.thread_id)

    async with httpx.AsyncClient(timeout=WXO_TIMEOUT) as client:
        resp = await client.post(
            f"{base}/v1/orchestrate/{agent_id}/chat/completions",
            headers=req_headers,
            json=payload,
        )

    if resp.status_code == 401:
        _invalidate_token()
        raise HTTPException(status_code=401, detail="WXO auth token expired; please retry.")

    if resp.status_code != 200:
        log.error("WXO crag error corr=%s status=%s body=%s", corr_id, resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail=f"WXO CRAG agent error ({resp.status_code}).")

    data       = resp.json()
    reply_text = _extract_text(data)
    new_thread = data.get("thread_id", body.thread_id or "")

    return ChatResponse(text=reply_text, thread_id=new_thread, agent_id=agent_id)
