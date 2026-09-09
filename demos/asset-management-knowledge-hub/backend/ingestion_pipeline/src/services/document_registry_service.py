"""Document registry — idempotent tracking of indexed documents.

The registry prevents re-indexing an unchanged file. Each document is keyed
by its path in COS; the ETag (content hash) is compared on each run to detect
changes.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from shared.opensearch import build_client
from shared.logging import get_logger
from ingestion_pipeline.src.config import opensearch as cfg

logger = get_logger(__name__)

_REGISTRY_INDEX = "document_registry"
_PIPELINE_VERSION = "1.0.0"

_INDEX_SETTINGS = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 1},
    "mappings": {
        "properties": {
            "documentId":      {"type": "keyword"},
            "fileName":        {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "etag":            {"type": "keyword"},
            "lastModified":    {"type": "date"},
            "indexedAt":       {"type": "date"},
            "pipelineVersion": {"type": "keyword"},
            "chunkCount":      {"type": "integer"},
            "status":          {"type": "keyword"},
            "errorMessage":    {"type": "text"},
        }
    },
}


class DocumentRegistryService:
    """Persists and queries the document-processing state in OpenSearch."""

    def __init__(self) -> None:
        self._client = build_client()
        logger.info("DocumentRegistryService initialised")

    def initialize_index(self) -> None:
        """Create the registry index if it does not exist."""
        if self._client.indices.exists(index=_REGISTRY_INDEX):
            return
        self._client.indices.create(index=_REGISTRY_INDEX, body=_INDEX_SETTINGS)
        logger.info("Registry index created")

    # ── Registry reads ────────────────────────────────────────────────────────

    def is_document_indexed(self, document_id: str, etag: Optional[str] = None) -> bool:
        """Return True if *document_id* is already indexed with matching *etag*.

        When *etag* is None, any existing record for this ID is treated as
        "already indexed".
        """
        try:
            resp = self._client.get(index=_REGISTRY_INDEX, id=document_id)
            if not resp.get("found"):
                return False
            if etag and resp["_source"].get("etag") != etag:
                return False  # content changed — needs re-index
            return resp["_source"].get("status") == "indexed"
        except Exception:
            return False

    # ── Registry writes ───────────────────────────────────────────────────────

    def register_document(
        self,
        document_id: str,
        file_name: str,
        chunk_count: int,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None,
    ) -> None:
        """Record a successful indexing operation."""
        now = datetime.now(timezone.utc).isoformat()
        self._client.index(
            index=_REGISTRY_INDEX,
            id=document_id,
            body={
                "documentId": document_id,
                "fileName": file_name,
                "etag": etag or "",
                "lastModified": last_modified or now,
                "indexedAt": now,
                "pipelineVersion": _PIPELINE_VERSION,
                "chunkCount": chunk_count,
                "status": "indexed",
            },
            params={"refresh": "true"},
        )
        logger.info("Document registered", extra={"id": document_id, "chunks": chunk_count})

    def mark_failed(self, document_id: str, file_name: str, error: str) -> None:
        """Record a failed indexing attempt."""
        now = datetime.now(timezone.utc).isoformat()
        self._client.index(
            index=_REGISTRY_INDEX,
            id=document_id,
            body={
                "documentId": document_id,
                "fileName": file_name,
                "etag": "",
                "indexedAt": now,
                "pipelineVersion": _PIPELINE_VERSION,
                "chunkCount": 0,
                "status": "failed",
                "errorMessage": error,
            },
            params={"refresh": "true"},
        )

    # ── Utility ───────────────────────────────────────────────────────────────

    @staticmethod
    def generate_chunk_id(document_id: str, chunk_index: int) -> str:
        """Return a deterministic chunk ID based on document path and index.

        Using a hash ensures the same chunk always receives the same ID
        across pipeline re-runs, enabling idempotent upserts.
        """
        raw = f"{document_id}::{chunk_index}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]


document_registry_service = DocumentRegistryService()
