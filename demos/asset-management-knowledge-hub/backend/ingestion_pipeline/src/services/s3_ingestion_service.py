"""S3-compatible ingestion service (AWS S3, MinIO, IBM COS with S3 API).

Downloads objects from a bucket and runs them through the existing
DocumentProcessorService pipeline.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import boto3
from botocore.config import Config

from ingestion_pipeline.src.services.document_processor_service import document_processor_service
from ingestion_pipeline.src.services.document_registry_service import document_registry_service
from ingestion_pipeline.src.services.cos_service import DocumentMetadata
from ingestion_pipeline.src.services.job_store_service import job_store_service
from shared.logging import get_logger

logger = get_logger(__name__)

_SUPPORTED_EXTS = {".pdf", ".docx", ".txt"}


@dataclass
class S3IngestResult:
    key: str
    status: str   # "ok" | "skipped" | "failed"
    chunks: int = 0
    error: Optional[str] = None


class S3IngestionService:

    def __init__(
        self,
        *,
        bucket: str,
        access_key: str,
        secret_key: str,
        endpoint_url: Optional[str] = None,
        region: str = "us-east-1",
    ) -> None:
        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=endpoint_url,
            region_name=region,
            config=Config(
                signature_version="s3v4",
                connect_timeout=10,
                read_timeout=30,
                retries={"max_attempts": 2},
            ),
        )

    def ingest_all(
        self,
        *,
        prefix: str = "",
        force: bool = False,
        asset_num: Optional[str] = None,
        category: str = "s3-document",
        tags: list[str] | None = None,
    ) -> list[S3IngestResult]:
        logger.info("▶ S3 ingestion started", extra={"bucket": self._bucket, "prefix": prefix or "(all)", "force": force})
        paginator = self._client.get_paginator("list_objects_v2")
        results: list[S3IngestResult] = []
        total_found = 0
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                ext = "." + key.rsplit(".", 1)[-1].lower() if "." in key else ""
                if ext not in _SUPPORTED_EXTS:
                    logger.debug("Skipping unsupported file type", extra={"key": key, "ext": ext})
                    continue
                total_found += 1
                etag = obj.get("ETag", "").strip('"')
                if not force and document_registry_service.is_document_indexed(key, etag):
                    logger.info("⏭ Already indexed — skipping", extra={"key": key})
                    result = S3IngestResult(key=key, status="skipped")
                    results.append(result)
                    job_store_service.append(
                        document_id=key,
                        file_name=key.split("/")[-1],
                        status="skipped",
                        source="s3",
                    )
                    continue
                try:
                    logger.info("⬇ Downloading", extra={"key": key, "size_bytes": obj.get("Size", "?")})
                    obj_data = self._client.get_object(Bucket=self._bucket, Key=key)
                    file_bytes = obj_data["Body"].read()
                    file_name = key.split("/")[-1]
                    meta = DocumentMetadata(
                        document_id=key,
                        file_name=file_name,
                        file_type="application/octet-stream",
                        file_size=len(file_bytes),
                        upload_date=datetime.utcnow(),
                        version=1,
                        asset_num=asset_num,
                        category=category,
                        tags=tags or [],
                        etag=etag,
                    )
                    res = document_processor_service.process_document(file_bytes, file_name, meta)
                    if res.status == "success":
                        document_registry_service.register_document(key, file_name, res.total_chunks, etag)
                    result = S3IngestResult(key=key, status=res.status, chunks=res.total_chunks, error=res.error)
                    results.append(result)
                    job_store_service.append(
                        document_id=key,
                        file_name=file_name,
                        status=res.status,
                        source="s3",
                        chunk_count=res.total_chunks,
                        error=res.error,
                    )
                except Exception as exc:
                    logger.error("✘ S3 object ingest failed", extra={"key": key, "error": str(exc)}, exc_info=True)
                    results.append(S3IngestResult(key=key, status="failed", error=str(exc)))
                    job_store_service.append(
                        document_id=key,
                        file_name=key.split("/")[-1],
                        status="failed",
                        source="s3",
                        error=str(exc),
                    )

        ok      = sum(1 for r in results if r.status == "success")
        skipped = sum(1 for r in results if r.status == "skipped")
        failed  = sum(1 for r in results if r.status == "failed")
        logger.info(
            "✔ S3 ingestion complete",
            extra={"bucket": self._bucket, "found": total_found,
                   "ok": ok, "skipped": skipped, "failed": failed},
        )
        return results
