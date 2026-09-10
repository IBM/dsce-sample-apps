"""COS (IBM Cloud Object Storage) service.

Provides document upload, download, list, and delete operations against
an IBM COS bucket. Uses the ``ibm-cos-sdk`` (AWS S3-compatible) library.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import ibm_boto3  # type: ignore
from ibm_botocore.client import Config  # type: ignore

from ingestion_pipeline.src.config import cos as cfg
from shared.logging import get_logger

logger = get_logger(__name__)


@dataclass
class DocumentMetadata:
    """Metadata record for a document stored in COS."""

    document_id: str
    file_name: str
    file_type: str
    file_size: int
    upload_date: datetime
    version: int
    asset_num: Optional[str] = None
    category: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    approval_status: str = "pending"
    approved_by: Optional[str] = None
    approved_date: Optional[datetime] = None
    etag: Optional[str] = None
    last_modified: Optional[datetime] = None


class COSService:
    """IBM Cloud Object Storage operations for the ingestion pipeline."""

    def __init__(self) -> None:
        self._bucket = cfg.bucket_name
        self._client = ibm_boto3.client(
            "s3",
            ibm_api_key_id=cfg.api_key,
            ibm_service_instance_id=cfg.bucket_instance_crn,
            config=Config(signature_version="oauth"),
            endpoint_url=cfg.endpoint,
        )
        logger.info("COSService initialised", extra={"bucket": self._bucket})

    # ── Upload ────────────────────────────────────────────────────────────────

    def upload_document(
        self,
        file_bytes: bytes,
        file_name: str,
        *,
        asset_num: Optional[str] = None,
        category: str = "maintenance-manual",
        version: int = 1,
        tags: Optional[list[str]] = None,
    ) -> DocumentMetadata:
        """Upload *file_bytes* to COS and return its metadata.

        Args:
            file_bytes:  Raw file content.
            file_name:   Original file name (used as the COS key suffix).
            asset_num:   Asset this document belongs to.
            category:    Document category (Manual, SOP, …).
            version:     Document version number.
            tags:        Arbitrary string tags.

        Returns:
            :class:`DocumentMetadata` with the assigned ``document_id``.
        """
        doc_id = f"{int(datetime.utcnow().timestamp())}-{file_name}"
        key = f"documents/{doc_id}"
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=file_bytes,
            Metadata={
                "fileName": file_name,
                "assetnum": asset_num or "",
                "category": category,
                "tags": ",".join(tags or []),
                "version": str(version),
                "approvalStatus": "pending",
                "uploadDate": datetime.utcnow().isoformat(),
            },
        )
        logger.info("Document uploaded to COS", extra={"doc_id": doc_id, "file": file_name})
        return DocumentMetadata(
            document_id=doc_id,
            file_name=file_name,
            file_type="application/octet-stream",
            file_size=len(file_bytes),
            upload_date=datetime.utcnow(),
            version=version,
            asset_num=asset_num,
            category=category,
            tags=tags or [],
        )

    # ── Download ──────────────────────────────────────────────────────────────

    def download_document(self, key: str) -> bytes:
        """Download an object by its full COS key and return the raw bytes."""
        obj = self._client.get_object(Bucket=self._bucket, Key=key)
        data = obj["Body"].read()
        logger.info("Document downloaded", extra={"key": key, "bytes": len(data)})
        return data

    # ── List ──────────────────────────────────────────────────────────────────

    def list_documents(self, prefix: str = "") -> list[dict]:
        """Return a list of all document objects under *prefix* (empty = entire bucket)."""
        paginator = self._client.get_paginator("list_objects_v2")
        items: list[dict] = []
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                items.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                    "etag": obj.get("ETag", "").strip('"'),
                })
        return items

    # ── Delete ────────────────────────────────────────────────────────────────

    def delete_document(self, document_id: str) -> None:
        """Permanently remove a document from COS."""
        key = f"documents/{document_id}"
        self._client.delete_object(Bucket=self._bucket, Key=key)
        logger.info("Document deleted from COS", extra={"doc_id": document_id})


cos_service = COSService()
