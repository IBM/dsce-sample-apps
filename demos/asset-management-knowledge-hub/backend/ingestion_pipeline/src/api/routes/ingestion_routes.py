"""Extra ingestion source routes — web, S3-compatible, Box."""

from __future__ import annotations
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from shared.config import cos as cos_cfg
from shared.logging import get_logger
from ingestion_pipeline.src.services.progress_service import progress_service, ProgressEvent

logger = get_logger(__name__)
router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

# Shared executor for all fire-and-forget ingestion work
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ingest")


# ── Progress SSE ──────────────────────────────────────────────────────────────

@router.get("/progress/{job_id}")
async def stream_progress(job_id: str):
    """Server-Sent Events stream for a running ingestion job.

    The client opens this endpoint after POST /web (or /cos etc.) returns
    a job_id. Events are streamed until the job finishes.
    """
    async def _generate():
        seen = 0
        idle = 0
        while True:
            job = progress_service.get(job_id)
            if job is None:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Job not found'})}\n\n"
                return

            events = job.drain(since=seen)
            for ev in events:
                yield f"data: {json.dumps({'type': ev.type, 'message': ev.message, 'detail': ev.detail, 'count': ev.count, 'total': ev.total, 'chunks': ev.chunks})}\n\n"
                seen += 1
                idle = 0

            if job.status in ("done", "error"):
                return

            idle += 1
            if idle > 120:   # 60 s of silence → give up
                yield f"data: {json.dumps({'type': 'done', 'message': 'Timed out'})}\n\n"
                return

            await asyncio.sleep(0.5)

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Running jobs (in-memory) ──────────────────────────────────────────────────

@router.get("/jobs/running")
async def list_running_jobs():
    """Return all currently in-flight ingestion jobs from in-memory store."""
    return {"jobs": progress_service.list_all()}


# ── Web / URL crawl ───────────────────────────────────────────────────────────

class WebCrawlRequest(BaseModel):
    urls: list[str]           # seed URLs to crawl
    max_depth: int = 1        # 0 = single page, 1 = follow one level of links
    max_pages: int = 20
    selector: Optional[str] = None   # CSS selector to extract (None = full body text)
    asset_num: Optional[str] = None
    category: str = "web-content"
    tags: list[str] = []

def _run_web_job(job_id: str, body: WebCrawlRequest) -> None:
    """Blocking web crawl — runs in thread executor."""
    from ingestion_pipeline.src.services.web_ingestion_service import web_ingestion_service
    from ingestion_pipeline.src.services.job_store_service import job_store_service

    results = []
    for i, url in enumerate(body.urls, 1):
        progress_service.push(job_id, ProgressEvent(
            type="page",
            message=f"Crawling {url}",
            detail=url,
            count=i,
            total=len(body.urls),
        ))
        try:
            result = web_ingestion_service.ingest_url(
                url,
                max_depth=body.max_depth,
                max_pages=body.max_pages,
                selector=body.selector,
                asset_num=body.asset_num,
                category=body.category,
                tags=body.tags,
                job_id=job_id,
            )
            job_store_service.append(
                document_id=f"web/{url[:200]}",
                file_name=url,
                status="indexed",
                source="web",
                chunk_count=result.total_chunks,
                job_id=job_id,
            )
            progress_service.push(job_id, ProgressEvent(
                type="chunk",
                message=f"✓ {url} — {result.total_chunks} chunks, {result.pages_crawled} page(s)",
                detail=url,
                count=i,
                total=len(body.urls),
                chunks=result.total_chunks,
            ))
            results.append({"url": url, "status": "ok", "chunks": result.total_chunks, "pages": result.pages_crawled})
        except Exception as exc:
            logger.error("Web ingestion failed", extra={"url": url, "error": str(exc)})
            job_store_service.append(
                document_id=f"web/{url[:200]}",
                file_name=url,
                status="failed",
                source="web",
                error=str(exc),
                job_id=job_id,
            )
            progress_service.push(job_id, ProgressEvent(
                type="error",
                message=f"✗ {url} — {exc}",
                detail=str(exc),
                count=i,
                total=len(body.urls),
            ))
            results.append({"url": url, "status": "failed", "error": str(exc)})

    progress_service.push(job_id, ProgressEvent(
        type="done",
        message=f"Done — {len(results)} URL(s) processed.",
        count=len(results),
        total=len(body.urls),
    ))

@router.post("/web")
async def ingest_web(body: WebCrawlRequest):
    """Accept web crawl request, kick off background job, return job_id immediately."""
    label = body.urls[0] if body.urls else "web"
    if len(body.urls) > 1:
        label += f" (+{len(body.urls) - 1} more)"
    job_id = progress_service.create_job("web", label=label)
    progress_service.push(job_id, ProgressEvent(
        type="start",
        message=f"Starting web crawl for {len(body.urls)} URL(s)…",
        total=len(body.urls),
    ))
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_web_job, job_id, body)
    return {"job_id": job_id, "status": "running", "urls": len(body.urls)}


# ── S3-compatible (AWS S3, MinIO, IBM COS with S3 API) ───────────────────────

class S3IngestRequest(BaseModel):
    endpoint_url: Optional[str] = None   # None = AWS S3
    bucket: Optional[str] = None         # falls back to COS_BUCKET_NAME env var
    prefix: str = ""
    access_key: Optional[str] = None     # falls back to COS_HMAC_ACCESS_KEY_ID env var
    secret_key: Optional[str] = None     # falls back to COS_HMAC_SECRET_ACCESS_KEY env var
    region: Optional[str] = None         # falls back to COS_REGION env var
    force: bool = False
    asset_num: Optional[str] = None
    category: str = "s3-document"
    tags: list[str] = []

def _run_s3_job(job_id: str, body: S3IngestRequest) -> None:
    """Blocking S3 ingest — runs in thread executor."""
    from ingestion_pipeline.src.services.s3_ingestion_service import S3IngestionService
    from ingestion_pipeline.src.services.job_store_service import job_store_service

    svc = S3IngestionService(
        endpoint_url=body.endpoint_url or cos_cfg.endpoint or None,
        bucket=body.bucket or cos_cfg.bucket_name,
        access_key=body.access_key or cos_cfg.hmac_access_key,
        secret_key=body.secret_key or cos_cfg.hmac_secret_key,
        region=body.region or cos_cfg.region,
    )
    try:
        results = svc.ingest_all(
            prefix=body.prefix,
            force=body.force,
            asset_num=body.asset_num,
            category=body.category,
            tags=body.tags,
        )
        ok      = sum(1 for r in results if r.status == "success")
        failed  = sum(1 for r in results if r.status == "failed")
        skipped = sum(1 for r in results if r.status == "skipped")
        for r in results:
            job_store_service.append(
                document_id=r.key,
                file_name=r.key.split("/")[-1],
                status=r.status,
                source="s3",
                chunk_count=getattr(r, "chunks", 0),
                error=getattr(r, "error", None),
                job_id=job_id,
            )
        progress_service.push(job_id, ProgressEvent(
            type="done",
            message=f"Done — {ok} indexed, {skipped} skipped, {failed} failed.",
            count=len(results),
            total=len(results),
        ))
    except Exception as exc:
        progress_service.push(job_id, ProgressEvent(
            type="error",
            message=f"S3 ingestion failed: {exc}",
            detail=str(exc),
        ))

@router.post("/s3")
async def ingest_s3(body: S3IngestRequest):
    """Accept S3 ingest request, kick off background job, return job_id immediately."""
    # Resolve effective values (request overrides env, env is the fallback)
    effective_bucket     = body.bucket     or cos_cfg.bucket_name
    effective_access_key = body.access_key or cos_cfg.hmac_access_key
    effective_secret_key = body.secret_key or cos_cfg.hmac_secret_key

    if not effective_bucket:
        raise HTTPException(status_code=422, detail="bucket is required (set in request or COS_BUCKET_NAME env var)")
    if not effective_access_key or not effective_secret_key:
        raise HTTPException(status_code=422, detail="S3 HMAC credentials are required (set in request or COS_HMAC_ACCESS_KEY_ID / COS_HMAC_SECRET_ACCESS_KEY env vars)")

    label = f"s3://{effective_bucket}/{body.prefix or ''}"
    job_id = progress_service.create_job("s3", label=label)
    progress_service.push(job_id, ProgressEvent(
        type="start",
        message=f"Starting S3 ingestion from {label}…",
    ))
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_s3_job, job_id, body)
    return {"job_id": job_id, "status": "running"}


# ── Box ───────────────────────────────────────────────────────────────────────

class BoxIngestRequest(BaseModel):
    client_id: str
    client_secret: str
    access_token: str           # short-lived developer token or OAuth token
    folder_id: str = "0"        # root folder
    force: bool = False
    asset_num: Optional[str] = None
    category: str = "box-document"
    tags: list[str] = []

def _run_box_job(job_id: str, body: BoxIngestRequest) -> None:
    """Blocking Box ingest — runs in thread executor."""
    from ingestion_pipeline.src.services.box_ingestion_service import BoxIngestionService
    from ingestion_pipeline.src.services.job_store_service import job_store_service

    svc = BoxIngestionService(
        client_id=body.client_id,
        client_secret=body.client_secret,
        access_token=body.access_token,
    )
    try:
        results = svc.ingest_folder(
            folder_id=body.folder_id,
            force=body.force,
            asset_num=body.asset_num,
            category=body.category,
            tags=body.tags,
        )
        ok = sum(1 for r in results if getattr(r, "status", "") == "success")
        for r in results:
            job_store_service.append(
                document_id=getattr(r, "file_id", str(r)),
                file_name=getattr(r, "file_name", "unknown"),
                status=getattr(r, "status", "unknown"),
                source="box",
                chunk_count=getattr(r, "chunks", 0),
                error=getattr(r, "error", None),
                job_id=job_id,
            )
        progress_service.push(job_id, ProgressEvent(
            type="done",
            message=f"Done — {ok}/{len(results)} file(s) indexed.",
            count=len(results),
            total=len(results),
        ))
    except Exception as exc:
        progress_service.push(job_id, ProgressEvent(
            type="error",
            message=f"Box ingestion failed: {exc}",
            detail=str(exc),
        ))

@router.post("/box")
async def ingest_box(body: BoxIngestRequest):
    """Accept Box ingest request, kick off background job, return job_id immediately."""
    label = f"Box folder {body.folder_id}"
    job_id = progress_service.create_job("box", label=label)
    progress_service.push(job_id, ProgressEvent(
        type="start",
        message=f"Starting Box ingestion from folder {body.folder_id}…",
    ))
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_box_job, job_id, body)
    return {"job_id": job_id, "status": "running"}


# ── Status: list all ingestion jobs tracked in file store ────────────────────

@router.get("/jobs")
async def list_ingestion_jobs():
    """Return recently ingested document records from the file-based job store."""
    from ingestion_pipeline.src.services.job_store_service import job_store_service
    jobs = job_store_service.list_jobs(limit=200)
    logger.debug("GET /api/ingestion/jobs", extra={"count": len(jobs)})
    return {"jobs": jobs}
