"""Agent evaluation demo — FastAPI backend.

Visitors can: run preset loan applications against two versions of a multi-agent system and watch the
trace; launch the ADK evaluation framework (ground truth, rubric, red team) on five fixed test cases; read
the results. Nothing a visitor does changes the agents.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config
from .jobs import KINDS, JobManager
from .wxo import WxoClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("agentops_d1")

wxo = WxoClient()
jobs: JobManager


@asynccontextmanager
async def lifespan(_: FastAPI):
    global jobs
    config.require_settings()
    jobs = JobManager()
    for version in config.VERSIONS.values():          # fail fast if the agents are missing
        await wxo.agent_id(version["agent"])
    log.info("ready: %s", ", ".join(v["agent"] for v in config.VERSIONS.values()))
    yield
    await wxo.close()


app = FastAPI(title="Agent evaluation demo", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


# -- small in-memory limiters --------------------------------------------------
_chat_hits: dict[str, deque] = defaultdict(deque)
_chat_global: deque = deque()
_chat_slots = asyncio.Semaphore(config.CHAT_MAX_CONCURRENT)
_trace_hits: deque = deque()
_trace_cache: dict[str, dict] = {}
_own_traces: deque = deque(maxlen=2000)   # trace ids produced by this app's own runs; nothing else is served


def _public(res: dict) -> dict:
    """Result as shown to visitors: no server paths."""
    return {k: v for k, v in res.items() if k != "run_dir"}


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?"))


def _allow_chat(ip: str) -> bool:
    now = time.time()
    while _chat_global and now - _chat_global[0] > 3600:
        _chat_global.popleft()
    if len(_chat_global) >= config.CHATS_PER_HOUR:
        return False
    _chat_global.append(now)
    hits = _chat_hits[ip]
    while hits and now - hits[0] > 600:
        hits.popleft()
    if len(hits) >= config.CHAT_PER_IP_PER_10MIN:
        return False
    hits.append(now)
    return True


def _sse(events: AsyncIterator[dict]) -> StreamingResponse:
    async def gen():
        async for ev in events:
            yield f"data: {json.dumps(ev)}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    log.exception("unhandled error on %s", request.url.path)
    return JSONResponse({"error": "Something went wrong. Please try again."}, status_code=500)


# -- catalog -------------------------------------------------------------------
@app.get("/api/catalog")
async def catalog():
    return {
        "versions": config.VERSIONS,
        "scenarios": config.CATALOG["scenarios"],
        "attacks": config.CATALOG["attacks"],
        "rubric_criteria": config.CATALOG["rubric_criteria"],
        "limits": {"chat_per_10min": config.CHAT_PER_IP_PER_10MIN, "result_fresh_s": config.RESULT_FRESH_S},
    }


# -- chat ----------------------------------------------------------------------
class ChatRequest(BaseModel):
    scenario: str
    version: str


@app.post("/api/chat")
async def chat(req: ChatRequest, request: Request):
    scenario = config.SCENARIOS.get(req.scenario)
    version = config.VERSIONS.get(req.version)
    if not scenario or not version:
        raise HTTPException(400, "Unknown scenario or version.")
    if not _allow_chat(_client_ip(request)):
        raise HTTPException(429, "You have reached the limit for live runs. Please try again in a few minutes.")
    if _chat_slots.locked():
        raise HTTPException(503, "The demo is busy. Please try again in a moment.")

    async def events():
        async with _chat_slots:
            yield {"type": "start", "agent": version["agent"], "scenario": scenario["id"], "message": scenario["message"]}
            try:
                async for ev in wxo.stream_run(version["agent"], scenario["message"]):
                    if ev.get("type") == "done" and ev.get("trace_id"):
                        _own_traces.append(ev["trace_id"])
                    yield ev
            except Exception:  # noqa: BLE001
                log.exception("chat stream failed")
                yield {"type": "error", "message": "The run did not complete. Please try again."}
    return _sse(events())


@app.get("/api/trace/{trace_id}")
async def trace(trace_id: str):
    if not trace_id.isalnum() or len(trace_id) > 64:
        raise HTTPException(400, "Invalid trace id.")
    if trace_id not in _own_traces:
        raise HTTPException(404, "Unknown trace.")
    if trace_id in _trace_cache:
        return _trace_cache[trace_id]
    now = time.time()
    while _trace_hits and now - _trace_hits[0] > 60:
        _trace_hits.popleft()
    if len(_trace_hits) >= config.TRACE_FETCH_PER_MIN:
        raise HTTPException(429, "Trace lookups are rate limited by the platform. Please try again in a minute.")
    _trace_hits.append(now)
    try:
        data = await wxo.trace(trace_id)
    except RuntimeError:
        raise HTTPException(429, "Trace lookups are rate limited by the platform. Please try again in a minute.")
    if data["observations"] == 0:
        raise HTTPException(404, "The platform trace is not available yet. Try again in a few seconds.")
    if data.get("complete"):                      # partial traces are re-fetched on the next request
        _trace_cache[trace_id] = data
    if len(_trace_cache) > 200:
        _trace_cache.pop(next(iter(_trace_cache)))
    return data


# -- evaluation jobs -----------------------------------------------------------
class JobRequest(BaseModel):
    force: bool = False


@app.post("/api/jobs/{kind}")
async def start_job(kind: str, req: JobRequest | None = None):
    if kind not in KINDS:
        raise HTTPException(404, "Unknown job.")
    job, cached, refusal = jobs.start(kind, force=bool(req and req.force))
    if refusal:
        raise HTTPException(409, refusal)
    if cached:
        return {"cached": True, "result": _public(cached)}
    return {"cached": False, "job": job.public()}


@app.get("/api/jobs/{job_id}/stream")
async def job_stream(job_id: str):
    job = jobs.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job.")

    async def events():
        async for ev in jobs.stream(job):
            if ev.get("done") and job.result:
                ev = {**ev, "result": _public(job.result)}
            yield ev
    return _sse(events())


@app.get("/api/jobs")
async def job_status():
    cur = jobs.current.public() if jobs.current else None
    return {"current": cur}


@app.get("/api/results")
async def all_results():
    return {k: {kk: vv for kk, vv in v.items() if kk not in ("cases", "attacks", "run_dir")} for k, v in jobs.latest.items()}


@app.get("/api/results/{kind}")
async def result(kind: str):
    if kind not in KINDS:
        raise HTTPException(404, "Unknown job.")
    res = jobs.latest.get(kind)
    if not res:
        raise HTTPException(404, "No result yet.")
    return _public(res)


@app.get("/api/results/{kind}/analyze")
async def analyze(kind: str):
    if kind not in KINDS or not kind.startswith("evaluate"):
        raise HTTPException(404, "Analyze is available for evaluation runs only.")
    try:
        text = await jobs.analyze(kind)
    except LookupError:
        raise HTTPException(404, "Run the evaluation first.")
    return {"kind": kind, "text": text}


@app.get("/health")
async def health():
    return {"status": "ok"}


# -- static frontend (built React app) -----------------------------------------
if config.STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=config.STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    async def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found.")
        candidate = (config.STATIC_DIR / path).resolve()
        if path and candidate.is_file() and config.STATIC_DIR.resolve() in candidate.parents:
            return FileResponse(candidate)
        if "." in path.rsplit("/", 1)[-1]:            # looks like a file that does not exist
            raise HTTPException(404, "Not found.")
        return FileResponse(config.STATIC_DIR / "index.html")
