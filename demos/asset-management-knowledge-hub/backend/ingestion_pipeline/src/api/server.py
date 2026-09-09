"""FastAPI REST API for the ingestion pipeline.

Endpoints:
    POST /api/pipelines/run       — trigger a full COS → OpenSearch pipeline run (fire-and-forget)
    GET  /api/documents           — list indexed documents
    DELETE /api/documents/{id}    — remove a document from the index
    GET  /api/connections/test    — test COS + OpenSearch connectivity
    GET  /health                  — liveness probe
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Request models — module-level so Pydantic v2 can resolve ForwardRefs ──────
# Do NOT move these inside create_app(). Pydantic v2 cannot resolve default
# values for models defined inside functions — all fields appear required,
# causing 422 "Field required" on every POST.

class PipelineRunRequest(BaseModel):
    prefix: str = ""   # empty = scan entire bucket; "documents/" was wrong default
    force: bool = False


from ingestion_pipeline.src.api.routes.ingestion_routes import router as ingestion_router
from ingestion_pipeline.src.config import app as app_cfg, cos as cos_cfg
from ingestion_pipeline.src.services.cos_service import cos_service
from ingestion_pipeline.src.services.document_processor_service import document_processor_service
from ingestion_pipeline.src.services.opensearch_service import opensearch_service
from ingestion_pipeline.src.services.document_registry_service import document_registry_service
from ingestion_pipeline.src.services.job_store_service import job_store_service
from ingestion_pipeline.src.services.progress_service import progress_service, ProgressEvent
from shared.logging import get_logger

_cos_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cos-ingest")

logger = get_logger(__name__)


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    _app = FastAPI(
        title="Maximo Ingestion Pipeline",
        version="1.0.0",
        description="Document ingestion from IBM COS into OpenSearch.",
    )

    _app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,   # must be False when allow_origins=["*"]
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=600,
    )

    # ── Health ────────────────────────────────────────────────────────────────

    @_app.get("/health", tags=["ops"])
    async def health():
        from datetime import datetime, timezone
        return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

    # ── COS / S3 config status ────────────────────────────────────────────────

    @_app.get("/api/cos/status", tags=["connections"])
    async def cos_status():
        """Return whether COS env vars and HMAC keys are configured.

        Called by the UI on mount to auto-configure the IBM COS and S3 blocks.
        Credentials are never returned — only whether they are set and the
        non-secret values (bucket, endpoint, region).
        """
        iam_configured  = bool(cos_cfg.api_key and cos_cfg.bucket_name)
        hmac_configured = bool(cos_cfg.hmac_access_key and cos_cfg.hmac_secret_key)
        return {
            "iamConfigured":  iam_configured,
            "hmacConfigured": hmac_configured,
            "bucketName":     cos_cfg.bucket_name if iam_configured or hmac_configured else "",
            "endpoint":       cos_cfg.endpoint    if iam_configured or hmac_configured else "",
            "region":         cos_cfg.region      if iam_configured or hmac_configured else "",
        }

    # ── Connections ───────────────────────────────────────────────────────────

    @_app.get("/api/connections/test", tags=["connections"])
    async def test_connections():
        """Verify COS and OpenSearch are reachable."""
        results: dict[str, bool] = {}
        try:
            cos_service.list_documents()
            results["cos"] = True
        except Exception as exc:
            logger.warning("COS connection failed", extra={"error": str(exc)})
            results["cos"] = False

        try:
            opensearch_service._client.cluster.health()
            results["opensearch"] = True
        except Exception as exc:
            logger.warning("OpenSearch connection failed", extra={"error": str(exc)})
            results["opensearch"] = False

        return results

    # ── Documents ─────────────────────────────────────────────────────────────

    @_app.get("/api/documents", tags=["documents"])
    async def list_documents():
        """List all COS objects available for ingestion."""
        return {"documents": cos_service.list_documents()}

    def _run_cos_pipeline(job_id: str, prefix: str, force: bool) -> None:
        """Blocking COS pipeline — runs in thread executor."""
        from ingestion_pipeline.src.services.cos_service import DocumentMetadata
        from datetime import datetime

        try:
            cos_docs = cos_service.list_documents(prefix)
        except Exception as exc:
            progress_service.push(job_id, ProgressEvent(
                type="error", message=f"COS list failed: {exc}", detail=str(exc),
            ))
            return

        progress_service.push(job_id, ProgressEvent(
            type="start",
            message=f"Found {len(cos_docs)} document(s) in COS…",
            total=len(cos_docs),
        ))

        results = []
        for i, doc in enumerate(cos_docs, 1):
            full_key  = doc["key"]                  # e.g. "Compressor.pdf" or "docs/Compressor.pdf"
            doc_id    = full_key                    # use the full key as the stable document ID
            file_name = full_key.split("/")[-1]     # last path segment = actual filename
            progress_service.push(job_id, ProgressEvent(
                type="page", message=f"Processing {file_name}",
                detail=doc_id, count=i, total=len(cos_docs),
            ))
            if not force and document_registry_service.is_document_indexed(doc_id, doc["etag"]):
                results.append({"file": doc_id, "status": "skipped"})
                job_store_service.append(
                    document_id=doc_id, file_name=file_name,
                    status="skipped", source="cos", job_id=job_id,
                )
                continue
            try:
                file_bytes = cos_service.download_document(full_key)
                meta = DocumentMetadata(
                    document_id=doc_id, file_name=file_name,
                    file_type="application/octet-stream",
                    file_size=len(file_bytes),
                    upload_date=datetime.fromisoformat(doc["last_modified"]),
                    version=1,
                )
                result = document_processor_service.process_document(file_bytes, meta.file_name, meta)
                if result.status == "success":
                    document_registry_service.register_document(
                        doc_id, meta.file_name, result.total_chunks, doc["etag"]
                    )
                job_store_service.append(
                    document_id=doc_id, file_name=file_name,
                    status=result.status, source="cos",
                    chunk_count=result.total_chunks, error=result.error,
                    job_id=job_id,
                )
                progress_service.push(job_id, ProgressEvent(
                    type="chunk",
                    message=f"✓ {file_name} — {result.total_chunks} chunks",
                    count=i, total=len(cos_docs), chunks=result.total_chunks,
                ))
                results.append({"file": doc_id, "status": result.status, "chunks": result.total_chunks})
            except Exception as exc:
                job_store_service.append(
                    document_id=doc_id, file_name=file_name,
                    status="failed", source="cos", error=str(exc), job_id=job_id,
                )
                progress_service.push(job_id, ProgressEvent(
                    type="error", message=f"✗ {file_name} — {exc}", detail=str(exc),
                    count=i, total=len(cos_docs),
                ))
                results.append({"file": doc_id, "status": "failed", "error": str(exc)})

        ok      = sum(1 for r in results if r.get("status") in ("success", "indexed"))
        skipped = sum(1 for r in results if r.get("status") == "skipped")
        failed  = sum(1 for r in results if r.get("status") == "failed")
        progress_service.push(job_id, ProgressEvent(
            type="done",
            message=f"Done — {ok} indexed, {skipped} skipped, {failed} failed.",
            count=len(results), total=len(cos_docs),
        ))

    @_app.post("/api/pipelines/run", tags=["pipelines"])
    async def run_pipeline(body: PipelineRunRequest):
        """Kick off COS pipeline in background — returns job_id immediately."""
        label = f"COS {body.prefix or 'documents/'}"
        job_id = progress_service.create_job("cos", label=label)
        loop = asyncio.get_event_loop()
        loop.run_in_executor(_cos_executor, _run_cos_pipeline, job_id, body.prefix, body.force)
        return {"job_id": job_id, "status": "running"}

    @_app.delete("/api/documents/{document_id:path}", tags=["documents"])
    async def delete_document(document_id: str):
        """Remove a document's chunks from OpenSearch."""
        opensearch_service.delete_document_chunks(document_id)
        return {"deleted": document_id}

    _app.include_router(ingestion_router)

    return _app
