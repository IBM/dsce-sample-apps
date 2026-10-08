"""HTTP surface of the Headless Bob core service.

Async-first: POST /v1/jobs returns a job id immediately; poll GET /v1/jobs/{id}.
Sessions give conversation memory: pass the same session name and the service
resumes Bob's native task (bob_runtime handles the mechanics).

Auth: `Authorization: Bearer hb_…` or `X-API-Key: hb_…` — per-partner keys
created via the bootstrap CLI (see __main__.py); no default credentials exist.
"""

from contextlib import asynccontextmanager
import json
import logging
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field

from bob_runtime import BobRuntime

from .auth import Principal, authenticate
from .db import Database
from .jobs import JobService, QuotaExceeded


class Settings:
    def __init__(self) -> None:
        self.root = Path(os.getenv("HB_ROOT", "/workspace"))
        self.db_path = os.getenv("HB_DB", str(self.root / "headless-bob.db"))
        self.bob_bin = os.getenv("HB_BOB_BIN", "bob")
        self.workers = int(os.getenv("HB_WORKERS", "3"))
        self.slack_bot_token = os.getenv("HB_SLACK_BOT_TOKEN", "")
        self.slack_signing_secret = os.getenv("HB_SLACK_SIGNING_SECRET", "")
        self.slack_tenant = os.getenv("HB_SLACK_TENANT", "slack")
        self.slack_session_scope = os.getenv("HB_SLACK_SESSION_SCOPE", "thread")
        self.slack_mode = os.getenv("HB_SLACK_MODE", "") or None
        # Bob cost caps: per conversation (one Bob session, cumulative over its turns) and per day.
        self.slack_max_cost = float(os.getenv("HB_SLACK_MAX_COST", "0.50"))
        self.slack_max_cost_per_day = float(os.getenv("HB_SLACK_MAX_COST_PER_DAY", "5.00"))
        self.slack_timeout = int(os.getenv("HB_SLACK_TIMEOUT", "300"))
        self.seed_dir = os.getenv("HB_SEED_DIR", "") or None
        # Case flow (enabled when HB_SF_* credentials are present).
        self.case_requester_email = os.getenv("HB_CASE_REQUESTER_EMAIL", "")
        self.archive_delay = int(os.getenv("HB_ARCHIVE_DELAY_SECONDS", "0"))
        self.flow_variant = os.getenv("HB_FLOW_VARIANT", "successplan")
        self.attract_loop = os.getenv("HB_ATTRACT_LOOP", "") in ("1", "true", "yes")
        self.loop_delay = int(os.getenv("HB_LOOP_DELAY_SECONDS", "15"))
        self.demo_opp_name = os.getenv("HB_DEMO_OPP_NAME", "Meridian Renewal")
        self.slack_team_id = os.getenv("HB_SLACK_TEAM_ID", "")
        self.slack_auto_join = os.getenv("HB_SLACK_AUTO_JOIN", "") in ("1", "true", "yes")
        self.case_owner_username = os.getenv("HB_CASE_OWNER_USERNAME", "")
        # Package variant: Bob builds the change as metadata, the service deploys it.
        # HB_MCP_URL is where Bob reaches this service's read-only org tools. Bob runs
        # in the same container, so loopback is the default; set it only if Bob runs elsewhere.
        self.mcp_url = os.getenv("HB_MCP_URL", "").strip() or f"http://127.0.0.1:{os.getenv('PORT', '8080')}/mcp"
        self.mcp_token = os.getenv("HB_MCP_TOKEN", "")
        self.package_types = tuple(t.strip() for t in os.getenv(
            "HB_PACKAGE_TYPES", "Flow,ApexClass,ApexTrigger,CustomField,ValidationRule,CustomLabel").split(",") if t.strip())
        self.package_fix_attempts = int(os.getenv("HB_PACKAGE_FIX_ATTEMPTS", "3"))
        # A package case spends more: proposal, summary, build and fix turns share one session.
        self.package_max_cost = float(os.getenv("HB_PACKAGE_MAX_COST", "3.00"))
        self.po_user_ids = tuple(
            u.strip() for u in os.getenv("HB_PO_SLACK_USER_IDS", "").split(",") if u.strip())
        self.caseflow_idle_minutes = int(os.getenv("HB_CASEFLOW_IDLE_MINUTES", "20"))
        hours = os.getenv("HB_SWEEP_HOURS", "")       # e.g. "7-19" (America/Los_Angeles); empty = always
        self.sweep_hours = tuple(int(h) for h in hours.split("-")) if hours else None
        # Bob features off by default for a service deployment (see jobs.py).
        # MCP stays on so a workspace seed can configure servers.
        self.disable_subagents = os.getenv("HB_BOB_DISABLE_SUBAGENTS", "1") in ("1", "true", "yes")
        self.disable_mcp = os.getenv("HB_BOB_DISABLE_MCP", "0") in ("1", "true", "yes")
        groups = os.getenv("HB_READONLY_DISABLE_GROUPS", "")
        self.readonly_disable_groups = tuple(
            g.strip() for g in groups.split(",") if g.strip()
        ) or None


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    db = Database(settings.db_path)
    runtime = BobRuntime(root=settings.root, bob_bin=settings.bob_bin,
                         seed_dir=settings.seed_dir)
    from .jobs import READONLY_DISABLED_GROUPS
    jobs = JobService(
        db, runtime, workers=settings.workers,
        readonly_disable_groups=settings.readonly_disable_groups or READONLY_DISABLED_GROUPS,
        disable_subagents=settings.disable_subagents, disable_mcp=settings.disable_mcp,
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        jobs.start()
        yield
        jobs.stop()
        if hasattr(runtime, "shutdown"):
            runtime.shutdown()

    app = FastAPI(
        title="Headless Bob",
        version="0.3.0",
        description="Embeddable engine for IBM Bob Shell: durable async jobs, "
        "native-resume conversations, per-partner keys.",
        lifespan=lifespan,
    )
    app.state.db = db
    app.state.jobs = jobs

    def principal(request: Request) -> Principal:
        header = request.headers.get("authorization", "")
        key = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else None
        key = key or request.headers.get("x-api-key")
        found = authenticate(db, key)
        if found is None:
            raise HTTPException(status_code=401, detail="Missing or invalid API key.")
        return found

    class JobRequest(BaseModel):
        prompt: str = Field(min_length=1, max_length=100_000)
        session: str | None = Field(default=None, max_length=64)
        mode: str | None = Field(default=None, max_length=64)
        max_cost: float | None = Field(default=None, gt=0, le=10.0)
        max_turns: int | None = Field(default=None, ge=1, le=100)
        timeout_seconds: int = Field(default=300, ge=10, le=900)

    def _public(job: dict) -> dict:
        return {
            "id": job["id"],
            "state": job["state"],
            "session": job["session_id"],
            "output": job["output"],
            "error": job["error"],
            "cost": job["cost"],
            "artifacts": job.get("artifacts", []),
            "audit": job.get("audit", {}),
            "createdAt": job["created_at"],
            "updatedAt": job["updated_at"],
        }

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    @app.post("/v1/jobs", status_code=202)
    def create_job(body: JobRequest, request: Request, who: Principal = Depends(principal)) -> dict:
        request_key = request.headers.get("idempotency-key", "").strip()
        if len(request_key) > 128:
            raise HTTPException(status_code=400, detail="Idempotency-Key is too long (max 128).")
        try:
            job = jobs.submit(
                who,
                body.prompt,
                session_name=body.session,
                mode=body.mode,
                max_cost=body.max_cost,
                max_turns=body.max_turns,
                timeout_seconds=body.timeout_seconds,
                request_key=request_key or None,
            )
        except QuotaExceeded as exc:
            raise HTTPException(status_code=429, detail=str(exc)) from exc
        return _public(job)

    @app.get("/v1/jobs")
    def list_jobs(who: Principal = Depends(principal)) -> list[dict]:
        return [_public(j) for j in jobs.list(who.tenant)]

    @app.get("/v1/jobs/{job_id}")
    def get_job(job_id: str, who: Principal = Depends(principal)) -> dict:
        try:
            return _public(jobs.get(who.tenant, job_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=f"Unknown job {job_id}") from exc

    @app.post("/v1/jobs/{job_id}/cancel")
    def cancel_job(job_id: str, who: Principal = Depends(principal)) -> dict:
        try:
            return _public(jobs.cancel(who.tenant, job_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=f"Unknown job {job_id}") from exc

    if settings.slack_signing_secret:
        from urllib.parse import parse_qs

        from .slack import SlackAdapter, verify_slack_signature

        slack = SlackAdapter(
            jobs,
            bot_token=settings.slack_bot_token,
            signing_secret=settings.slack_signing_secret,
            tenant=settings.slack_tenant,
            session_scope=settings.slack_session_scope,
            default_mode=settings.slack_mode,
            max_cost_per_run=settings.package_max_cost if settings.flow_variant == "package" else settings.slack_max_cost,
            max_cost_per_day=settings.slack_max_cost_per_day,
            timeout_seconds=settings.slack_timeout,
            auto_join=settings.slack_auto_join,
        )
        from .salesforce import SalesforceClient
        salesforce = SalesforceClient.from_env(dict(os.environ))
        app.state.slack = slack

        if salesforce is not None:
            from .caseflow import CaseFlow
            from .mailer import Mailer

            flow = CaseFlow(
                db, jobs, slack, salesforce, Mailer(dict(os.environ)),
                requester_email=settings.case_requester_email,
                po_user_ids=settings.po_user_ids,
                archive_delay=settings.archive_delay,
                idle_minutes=settings.caseflow_idle_minutes,
                sweep_hours=settings.sweep_hours,
                variant=settings.flow_variant,
                attract_loop=settings.attract_loop,
                loop_delay=settings.loop_delay,
                demo_opp_name=settings.demo_opp_name,
                slack_team_id=settings.slack_team_id,
                case_owner_username=settings.case_owner_username,
            )
            slack.caseflow = flow
            app.state.caseflow = flow

            # Read-only org context for Bob (package variant): a Streamable HTTP
            # MCP endpoint answered with the service's own Salesforce session.
            import secrets

            from .metadata_api import MetadataApi
            from .org_mcp import OrgTools, make_router

            mcp_token = settings.mcp_token or secrets.token_urlsafe(32)
            app.include_router(make_router(OrgTools(MetadataApi(salesforce)), token=mcp_token))
            flow.mcp_url = settings.mcp_url
            flow.mcp_token = mcp_token
            flow.package_types = settings.package_types
            flow.package_fix_attempts = settings.package_fix_attempts

            from fastapi.responses import HTMLResponse

            from .kiosk import KIOSK_HTML

            class CaseSubmission(BaseModel):
                issue: str = Field(default="", max_length=5000)

            @app.get("/demo", include_in_schema=False)
            def demo_page() -> HTMLResponse:
                # A browser trigger for the sample; real integrations create
                # cases through Salesforce itself and call flow.start().
                return HTMLResponse(KIOSK_HTML)

            @app.get("/demo/current", include_in_schema=False)
            def demo_current() -> dict:
                return flow.current_channel(1) or {"channel": "", "url": ""}

            @app.post("/demo/case", include_in_schema=False)
            def demo_case(body: CaseSubmission) -> dict:
                try:
                    return flow.start(body.issue)
                except HTTPException:
                    raise
                except Exception as exc:
                    logger.exception("Failed to start demo flow: %s", exc)
                    raise HTTPException(status_code=502, detail="Failed to start demo flow") from exc

        async def _verified_body(request: Request) -> bytes:
            body = await request.body()
            ok = verify_slack_signature(
                settings.slack_signing_secret,
                request.headers.get("x-slack-request-timestamp", ""),
                body,
                request.headers.get("x-slack-signature", ""),
            )
            if not ok:
                raise HTTPException(status_code=401, detail="Bad Slack signature.")
            return body

        @app.post("/slack/events", include_in_schema=False)
        async def slack_events(request: Request) -> dict:
            raw = await request.body()
            # Slack's URL-verification handshake is answered before the
            # signature check so a deployment can be created (with a
            # placeholder signing secret) BEFORE its Slack app exists — the
            # manifest's request URLs then verify on first try. Echoing the
            # challenge back is harmless.
            try:
                probe = json.loads(raw)
            except ValueError:
                probe = {}
            if isinstance(probe, dict) and probe.get("type") == "url_verification":
                return {"challenge": probe.get("challenge", "")}
            body = await _verified_body(request)
            response = slack.handle_event(json.loads(body))
            return response or {"ok": True}

        @app.post("/slack/interactivity", include_in_schema=False)
        async def slack_interactivity(request: Request) -> dict:
            body = await _verified_body(request)
            form = parse_qs(body.decode())
            payload = json.loads(form.get("payload", ["{}"])[0])
            slack.handle_interaction(payload)
            return {"ok": True}

    @app.get("/v1/sessions/{name}")
    def get_session(name: str, who: Principal = Depends(principal)) -> dict:
        session = jobs.get_session(who.tenant, name)
        if session is None:
            raise HTTPException(status_code=404, detail=f"Unknown session {name}")
        return {
            "name": session["name"],
            "hasMemory": bool(session["bob_task_id"]),
            "createdAt": session["created_at"],
            "updatedAt": session["updated_at"],
        }

    return app
