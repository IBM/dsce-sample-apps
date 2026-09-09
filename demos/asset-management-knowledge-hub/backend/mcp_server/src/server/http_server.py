"""FastAPI HTTP server for the MCP server.

Serves:
  GET  /health                     — liveness probe
  GET  /api/instances              — list all configured Maximo instances
  POST /api/instances              — add a new instance
  DELETE /api/instances/{id}       — remove an instance
  POST /api/instances/{id}/select  — set the active instance
  POST /api/instances/{id}/test    — test connectivity to an instance
  POST /api/query                  — 3-source intelligent query (used by the UI)
  POST /api/servicenow/ticket      — create a ServiceNow Incident ticket

NOTE: Pydantic v2 models MUST be defined at module level (not inside
create_app). Defining them inside a function causes ForwardRef resolution
failures with Pydantic >= 2.12 / FastAPI >= 0.115.
"""

# Do NOT use `from __future__ import annotations` — it converts all type hints
# to strings, making Pydantic v2 unable to resolve them at class definition time.

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from mcp_server.src.handlers.tool_handlers import TOOL_HANDLERS
from mcp_server.src.config import server as srv_cfg
from mcp_server.src.config import opensearch as os_cfg
from mcp_server.src.config import kafka as kafka_cfg
from shared.config import cos as cos_cfg
from mcp_server.src.services.instance_registry import instance_registry
from mcp_server.src.services import history_store
from mcp_server.src.services.opensearch_service import opensearch_service
from mcp_server.src.services.kafka_service import kafka_service
from mcp_server.src.services.servicenow_service import servicenow_service, ServiceNowConfigError
from shared.logging import get_logger

logger = get_logger(__name__)


# ── Request models — module-level so Pydantic v2 can resolve them ─────────────

class AddInstanceRequest(BaseModel):
    name: str = Field(..., description="Human-readable instance label")
    url: str = Field(..., description="Maximo REST API base URL")
    api_key: str = Field("", description="API key (preferred auth method)")
    username: str = Field("", description="Basic-auth username (fallback)")
    password: str = Field("", description="Basic-auth password (fallback)")


class QueryRequest(BaseModel):
    query: str = Field(..., description="Natural-language question")
    maxResults: int = Field(20, ge=1, le=200)
    assetId: Optional[str] = Field(None)
    instanceId: Optional[str] = Field(None, description="Override active Maximo instance for this query")
    enableMaximo: bool = Field(True, description="Allow queries against Maximo Live Data source")
    enableDocs: bool = Field(True, description="Allow queries against Document RAG source")
    enableWeb: bool = Field(True, description="Allow queries against Web Knowledge source")
    enableSynth: bool = Field(True, description="Enable multi-source synthesis")


class PMUpdateRequest(BaseModel):
    pmNum:    str  = Field(..., description="Preventive Maintenance number, e.g. PM-PUMP-001")
    fields:   dict = Field(
        ...,
        description=(
            "Key/value pairs to PATCH onto the MXAPIPM record. "
            "Frequency fields: 'frequency' (integer), "
            "'frequnit' (string — one of: DAYS, WEEKS, MONTHS, YEARS)."
        ),
    )
    instanceId: Optional[str] = Field(None, description="Override active Maximo instance")


class HistorySessionRequest(BaseModel):
    id:        int  = Field(..., description="Stable session id (first user message id)")
    title:     str  = Field(..., description="Session title (first user message, max 60 chars)")
    timestamp: str  = Field(..., description="ISO-8601 datetime string (legacy, kept for compat)")
    messages:  list = Field(..., description="Slimmed message objects")
    username:  str  = Field("default", description="Username who owns this session")


class ServiceNowTicketRequest(BaseModel):
    shortDescription: str = Field(..., description="One-line ticket summary")
    description: str = Field("", description="Full ticket description")
    priority: Optional[str] = Field(None, description="Recommendation priority (Critical/High/Medium/Low)")
    category: str = Field("software", description="ServiceNow incident category")


# ── App factory ───────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="Maximo Knowledge Hub — MCP Server",
        version=srv_cfg.version,
        description="3-source RAG API for Maximo assets, documents, and web knowledge.",
    )

    # CORS — allow all origins (covers Vite dev on any port)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,   # must be False when allow_origins=["*"]
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=600,
    )

    # ── Health ─────────────────────────────────────────────────────────────────

    @app.get("/health", tags=["ops"])
    async def health():
        active = instance_registry.active
        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "activeInstance": active.name if active else None,
        }

    # ── OpenSearch status ──────────────────────────────────────────────────────

    @app.get("/api/opensearch/status", tags=["ops"])
    async def opensearch_status():
        """Check OpenSearch cluster health and return the configured host URL.

        Called by the UI Configuration page to show live/dead status and
        which OpenSearch instance the MCP server is connected to.

        Returns a masked hostname so the UI can display it without leaking
        the full URL in the browser (e.g. 'opensearch-ro…appdomain.cloud').
        """
        import urllib.parse

        def _mask_host(url: str) -> str:
            """Return '<hostname truncated to 14 chars>…<last domain segment>'.

            Examples:
              https://opensearch-route-mx-kh-os.example.cloud  →  opensearch-ro…cloud
              https://localhost:9200                            →  localhost:9200
            """
            try:
                hostname = urllib.parse.urlparse(url).hostname or url
                # Keep port if present
                port = urllib.parse.urlparse(url).port
                port_str = f":{port}" if port else ""
                if len(hostname) <= 20:
                    return f"{hostname}{port_str}"
                # Show first 12 chars + ellipsis + last segment (after final '.')
                prefix = hostname[:12]
                suffix = hostname.rsplit(".", 1)[-1]
                return f"{prefix}…{suffix}{port_str}"
            except Exception:
                return url

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, opensearch_service.test_connection)
        return {
            "host": os_cfg.host,
            "maskedHost": _mask_host(os_cfg.host),
            "index": os_cfg.index,
            "connected": result.get("success", False),
            "clusterStatus": result.get("status"),
            "error": result.get("error"),
        }

    # ── COS / S3 status ────────────────────────────────────────────────────────

    @app.get("/api/cos/status", tags=["ops"])
    async def cos_status():
        """Return whether IBM COS env vars are configured on the server.

        The UI uses this on mount to auto-mark the IBM COS block as configured
        when COS_API_KEY and COS_BUCKET_NAME are present in the server environment.
        No credentials are returned — only whether they are set and the non-secret
        config values (bucket name, endpoint, region).
        """
        configured = bool(cos_cfg.api_key and cos_cfg.bucket_name)
        return {
            "configured":  configured,
            "bucketName":  cos_cfg.bucket_name  if configured else "",
            "endpoint":    cos_cfg.endpoint     if configured else "",
            "region":      cos_cfg.region       if configured else "",
        }

    # ── Kafka status ───────────────────────────────────────────────────────────

    @app.get("/api/kafka/status", tags=["ops"])
    async def kafka_status():
        """Check Kafka cluster connectivity and return available topics.

        Called by the UI Configuration page to show connected/disconnected
        status and the list of topics on the cluster.
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, kafka_service.test_connection)
        return {
            "configured":         result.get("configured", False),
            "connected":          result.get("connected", False),
            "bootstrapServers":   kafka_cfg.bootstrap_servers,
            "topics":             result.get("topics", []),
            "schemaRegistryUrl":  kafka_cfg.schema_registry_url,
            "error":              result.get("error"),
        }

    # ── Instance management ────────────────────────────────────────────────────

    @app.get("/api/instances", tags=["instances"])
    async def list_instances():
        """Return all configured Maximo instances."""
        return {
            "instances": instance_registry.all(),
            "activeId": instance_registry.active_id,
        }

    @app.post("/api/instances", tags=["instances"], status_code=201)
    async def add_instance(body: AddInstanceRequest):
        """Register a new Maximo instance."""
        inst = instance_registry.add(
            name=body.name,
            url=body.url,
            api_key=body.api_key,
            username=body.username,
            password=body.password,
        )
        return {"message": "Instance added", "id": inst.id}

    @app.delete("/api/instances/{instance_id}", tags=["instances"])
    async def remove_instance(instance_id: str):
        if not instance_registry.remove(instance_id):
            raise HTTPException(status_code=404, detail="Instance not found")
        return {"message": "Instance removed"}

    @app.post("/api/instances/{instance_id}/select", tags=["instances"])
    async def select_instance(instance_id: str):
        """Set the active Maximo instance for all subsequent queries."""
        if not instance_registry.set_active(instance_id):
            raise HTTPException(status_code=404, detail="Instance not found")
        active = instance_registry.active
        return {"message": f"Active instance set to '{active.name}'", "activeId": instance_id}

    @app.post("/api/instances/{instance_id}/test", tags=["instances"])
    async def test_instance(instance_id: str):
        """Test connectivity to a specific Maximo instance.

        Uses the same MaximoService path as the chat/query flow so the
        test result matches actual runtime behaviour.
        """
        inst = instance_registry.get(instance_id)
        if not inst:
            raise HTTPException(status_code=404, detail="Instance not found")

        loop = asyncio.get_event_loop()

        def _test():
            from mcp_server.src.handlers.tool_handlers import _build_maximo_svc_inner
            svc = _build_maximo_svc_inner(
                mx_url=inst.url,
                mx_api_key=inst.api_key,
                mx_username=inst.username,
                mx_password=inst.password,
            )
            result = svc.test_connection()
            if result.get("connected"):
                instance_registry.update_status(instance_id, "active")
                return {
                    "connected": True,
                    "status": "active",
                    "user": result.get("user", "connected"),
                }
            else:
                instance_registry.update_status(instance_id, "inactive")
                return {
                    "connected": False,
                    "status": "inactive",
                    "error": result.get("error", "Connection failed"),
                }

        return await loop.run_in_executor(None, _test)

    # ── Query endpoint ─────────────────────────────────────────────────────────

    @app.post("/api/query", tags=["rag"])
    async def query_endpoint(body: QueryRequest):
        """3-source intelligent query. Uses instanceId override when supplied,
        otherwise falls back to the globally active instance."""
        logger.info(
            "API query received",
            extra={"query": body.query, "instanceId": body.instanceId},
        )

        # Resolve Maximo instance
        inst = None
        if body.instanceId:
            inst = instance_registry.get(body.instanceId)
        if inst is None:
            inst = instance_registry.active

        result = await TOOL_HANDLERS["intelligent-query"]({
            "query": body.query,
            "maxResults": body.maxResults,
            "assetnum": body.assetId,
            "maximo_url":      inst.url      if inst else None,
            "maximo_api_key":  inst.api_key  if inst else None,
            "maximo_username": inst.username if inst else None,
            "maximo_password": inst.password if inst else None,
            "enableMaximo": body.enableMaximo,
            "enableDocs":   body.enableDocs,
            "enableWeb":    body.enableWeb,
            "enableSynth":  body.enableSynth,
        })

        if result.get("isError"):
            raise HTTPException(
                status_code=500, detail=result["content"][0]["text"]
            )

        return json.loads(result["content"][0]["text"])

    # ── Maximo PM schedule update endpoint ────────────────────────────────────

    @app.post("/api/maximo/pm/update", tags=["maximo"])
    async def update_pm(body: PMUpdateRequest):
        """Patch frequency fields on a Maximo Preventive Maintenance record.

        Uses MXPMIPM (the Integration-Framework-published PM object structure)
        rather than MXAPIPM, which requires additional IF configuration to expose
        the PM business object for external access.

        Resolves the active (or override) Maximo instance, calls
        MaximoService.update_object(MXPMIPM, pmNum, 'pmnum', fields),
        and returns a success/error payload.
        """
        inst = None
        if body.instanceId:
            inst = instance_registry.get(body.instanceId)
        if inst is None:
            inst = instance_registry.active

        if inst is None:
            raise HTTPException(
                status_code=503,
                detail="No Maximo instance configured. Add one in Configuration.",
            )

        loop = asyncio.get_event_loop()

        def _do_update():
            from mcp_server.src.handlers.tool_handlers import _build_maximo_svc_inner
            svc = _build_maximo_svc_inner(
                mx_url=inst.url,
                mx_api_key=inst.api_key,
                mx_username=inst.username,
                mx_password=inst.password,
            )
            # If the payload contains a frequency field, use update_pm_frequency
            # so that nextdate is automatically rolled back by one cycle.
            frequency = body.fields.get("frequency")
            frequnit  = body.fields.get("frequnit", "MONTHS")
            if frequency is not None:
                return svc.update_pm_frequency(
                    pmnum=body.pmNum,
                    frequency=int(frequency),
                    frequnit=str(frequnit).upper(),
                )
            # Non-frequency fields — generic update
            return svc.update_object(
                object_structure="MXAPIPM",
                record_id=body.pmNum,
                id_field="pmnum",
                fields=body.fields,
            )

        try:
            result = await loop.run_in_executor(None, _do_update)
            return {
                "success": True,
                "pmNum":    body.pmNum,
                "updated":  result.get("updated", body.fields),
                "nextdate": result.get("nextdate"),
                "httpStatus": result.get("httpStatus", 200),
            }
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        except Exception as exc:
            logger.error("PM update failed", extra={"pmNum": body.pmNum, "error": str(exc)})
            raise HTTPException(status_code=502, detail=f"Maximo update failed: {exc}")

    # ── ServiceNow ticket creation endpoint ───────────────────────────────────

    @app.post("/api/servicenow/ticket", tags=["servicenow"], status_code=201)
    async def create_servicenow_ticket(body: ServiceNowTicketRequest):
        """Create a ServiceNow Incident ticket from an AI-generated recommendation."""
        loop = asyncio.get_event_loop()

        def _create():
            return servicenow_service.create_incident(
                short_description=body.shortDescription,
                description=body.description,
                priority=body.priority,
                category=body.category,
            )

        try:
            result = await loop.run_in_executor(None, _create)
            return {"success": True, **result}
        except ServiceNowConfigError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:
            logger.error("ServiceNow ticket creation failed", extra={"error": str(exc)})
            raise HTTPException(status_code=502, detail=f"ServiceNow ticket creation failed: {exc}")

    # ── Chat history endpoints ─────────────────────────────────────────────────

    @app.get("/api/history", tags=["history"])
    async def get_history(username: str = "default"):
        """Return all chat sessions for a user, newest first.

        Query param: ?username=<name>
        Each session includes: id, title, created_at, updated_at, message_count.
        Messages array is included for full restore.
        """
        sessions = history_store.get_all(username)
        return {
            "username": username,
            "count":    len(sessions),
            "sessions": sessions,
        }

    @app.post("/api/history", tags=["history"])
    async def upsert_history(body: HistorySessionRequest):
        """Insert or update a chat session for a user (upsert by id).

        Body must include: id, title, timestamp, messages, username.
        Server adds/updates: created_at, updated_at, message_count automatically.
        """
        history_store.upsert(body.username, body.model_dump())
        return {"ok": True, "username": body.username, "session_id": body.id}

    @app.delete("/api/history", tags=["history"])
    async def clear_history(username: str = "default"):
        """Delete all chat sessions for a user.

        Query param: ?username=<name>
        """
        history_store.delete_all(username)
        return {"ok": True, "username": username}

    @app.get("/api/history/users", tags=["history"])
    async def list_history_users():
        """Admin view — list all users with saved history and their session counts."""
        return {"users": history_store.get_all_users()}

    @app.delete("/api/history/{session_id}", tags=["history"])
    async def delete_session(session_id: int, username: str = "default"):
        """Delete a single chat session for a user.

        Path param: session_id
        Query param: ?username=<name>
        """
        found = history_store.delete(username, session_id)
        if not found:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"ok": True, "username": username, "session_id": session_id}

    return app
