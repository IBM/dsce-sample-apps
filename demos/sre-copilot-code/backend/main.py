from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime, timezone
import os
import random
import copy
import secrets

from models import (
    Incident, AnalysisResult, AnalyzeRequest,
    ChatRequest, ChatResponse, Severity, Status,
    AdminConfig, AdminLoginRequest, ResetResponse,
)
from data.incidents import SEED_INCIDENTS
from data.templates import TEMPLATES

load_dotenv()

app = FastAPI(title="SRE Copilot API", version="1.0.0")

# Build allowed origins: start with local dev origins, then add any
# CORS_ALLOWED_ORIGINS from the environment (comma-separated).
_BASE_ORIGINS = [
    "http://localhost:3131",   # Vite dev server
    "http://localhost:3000",   # Podman Compose (Nginx on :3000)
    "http://localhost:80",     # Podman Nginx alternate
    "http://localhost",        # Podman Nginx (no port)
]
_extra = os.getenv("CORS_ALLOWED_ORIGINS", "")
_allowed_origins = _BASE_ORIGINS + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https?://.*\.containers\.appdomain\.cloud(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory incident store ──────────────────────────────────────────────────
_incident_store: list[dict] = [copy.deepcopy(i) for i in SEED_INCIDENTS]
_incident_counter: int = len(SEED_INCIDENTS)

# ── In-memory admin config ─────────────────────────────────────────────────────
_admin_config: dict = {
    "pii_filter": False,
    "guardrails": False,
    "secrets_detection": False,
}

# ── Admin auth ────────────────────────────────────────────────────────────────
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ibmdemo")

def _verify_admin(password: str):
    """Raise 401 if password is wrong."""
    if not secrets.compare_digest(password.encode(), ADMIN_PASSWORD.encode()):
        raise HTTPException(status_code=401, detail="Invalid admin password")


def _next_id() -> str:
    global _incident_counter
    _incident_counter += 1
    return f"INC-{_incident_counter:03d}"


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ── Incidents ─────────────────────────────────────────────────────────────────
@app.get("/api/incidents", response_model=list[Incident])
def get_incidents():
    """Return all incidents sorted by timestamp descending."""
    sorted_incidents = sorted(
        _incident_store,
        key=lambda x: x["timestamp"],
        reverse=True,
    )
    return sorted_incidents


@app.post("/api/incidents/generate", response_model=Incident)
def generate_incident():
    """Randomly pick a template, assign a new ID + timestamp, and add to store."""
    template = copy.deepcopy(random.choice(TEMPLATES))
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    new_incident = {
        "id": _next_id(),
        "title": template["title"],
        "severity": template["severity"],
        "status": "Open",
        "affected_service": template["affected_service"],
        "timestamp": now,
        "description": template.get("description", ""),
        "logs": [
            line.replace("{ts}", now).replace("{ts_offset}", now)
            for line in template["log_template"]
        ],
    }
    _incident_store.append(new_incident)
    return new_incident


@app.post("/api/incidents/analyze", response_model=AnalysisResult)
async def analyze_incident(request: AnalyzeRequest):
    """
    Look up the incident by ID, invoke the watsonx Orchestrate agent,
    and return the structured analysis result.
    Agent client is imported lazily to avoid startup errors if WXO is not configured.
    """
    # Find the incident
    incident = next((i for i in _incident_store if i["id"] == request.incident_id), None)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {request.incident_id} not found")

    # Lazy import agent client (wired in Sub-Task 4)
    try:
        from services.agent_client import invoke_agent
        result = await invoke_agent(incident)
        return result
    except ImportError:
        raise HTTPException(status_code=501, detail="Agent client not yet configured")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent invocation failed: {str(e)}")


@app.post("/api/incidents/reset", response_model=ResetResponse)
def reset_incidents():
    """
    Reset the incident store to the 8 seed incidents.
    Clears all generated incidents and resets the ID counter.
    """
    global _incident_store, _incident_counter
    _incident_store = [copy.deepcopy(i) for i in SEED_INCIDENTS]
    _incident_counter = len(SEED_INCIDENTS)
    return ResetResponse(message="Board reset to seed incidents", count=len(_incident_store))


# ── Admin config ──────────────────────────────────────────────────────────────

@app.post("/api/admin/login")
def admin_login(request: AdminLoginRequest):
    """Verify admin password. Returns 200 on success, 401 on failure."""
    _verify_admin(request.password)
    return {"status": "ok"}


@app.get("/api/admin/config", response_model=AdminConfig)
def get_admin_config():
    """Return current agent control settings (public read — UI needs to show badge)."""
    return AdminConfig(**_admin_config)


@app.put("/api/admin/config", response_model=AdminConfig)
async def update_admin_config(request: AdminConfig, x_admin_password: str = Header(default="")):
    """
    Update agent control toggles.
    Calls WXO controls API to enable/disable each control.
    Requires X-Admin-Password header matching ADMIN_PASSWORD.
    """
    _verify_admin(x_admin_password)

    global _admin_config
    previous = dict(_admin_config)
    new_cfg = request.dict()

    # Resolve agent UUID once
    try:
        from services.agent_client import _resolve_agent_id
        from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
        from services.controls_client import enable_control, disable_control
        import os as _os

        api_key = _os.getenv("WXO_API_KEY", "")
        authenticator = IAMAuthenticator(apikey=api_key)
        agent_id = _resolve_agent_id(authenticator)

        for key in ["pii_filter", "guardrails", "secrets_detection"]:
            was_on = previous.get(key, False)
            is_on  = new_cfg.get(key, False)
            if is_on and not was_on:
                try:
                    enable_control(agent_id, key)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Could not enable {key}: {e}")
            elif not is_on and was_on:
                try:
                    disable_control(agent_id, key)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Could not disable {key}: {e}")

    except Exception as e:
        # Log but don't fail — controls are best-effort; local config still updates
        import logging
        logging.getLogger(__name__).warning(f"WXO controls sync error (non-fatal): {e}")

    _admin_config = new_cfg
    return AdminConfig(**_admin_config)


@app.post("/api/incidents/{incident_id}/chat", response_model=ChatResponse)
async def chat_with_incident(incident_id: str, request: ChatRequest):
    """
    Send a follow-up chat message about a specific incident.
    Includes incident context, prior analysis, and conversation history in the prompt.
    """
    incident = next((i for i in _incident_store if i["id"] == incident_id), None)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    try:
        from services.agent_client import invoke_chat
        history = [msg.dict() for msg in request.history]
        reply = await invoke_chat(
            incident=incident,
            analysis=request.analysis or {},
            history=history,
            message=request.message,
        )
        return ChatResponse(reply=reply)
    except ImportError:
        raise HTTPException(status_code=501, detail="Agent client not yet configured")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chat invocation failed: {str(e)}")
