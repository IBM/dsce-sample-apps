"""OpenSearch service for the ingestion pipeline.

Manages the ``maximo-documents`` index: creates it with kNN mappings on
first run and provides chunk-level write and read operations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from shared.opensearch import build_client
from shared.logging import get_logger
from ingestion_pipeline.src.config import opensearch as cfg

logger = get_logger(__name__)

_INDEX_SETTINGS = {
    "settings": {
        "number_of_shards": 2,
        "number_of_replicas": 1,
        "index.knn": True,
    },
    "mappings": {
        "properties": {
            "id":          {"type": "keyword"},
            "documentId":  {"type": "keyword"},
            "fileName":    {"type": "text"},
            "chunkIndex":  {"type": "integer"},
            "content": {
                "type": "text",
                "analyzer": "standard",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "embedding": {
                "type": "knn_vector",
                "dimension": 384,
                "method": {
                    "name": "hnsw",
                    "space_type": "cosinesimil",
                    "engine": "lucene",
                },
            },
            "metadata": {
                "properties": {
                    "assetnum": {"type": "keyword"},
                    "category": {"type": "keyword"},
                    "version":  {"type": "integer"},
                    "section":  {"type": "text"},
                    "tags":     {"type": "keyword"},
                }
            },
            "timestamp": {"type": "date"},
        }
    },
}


@dataclass
class DocumentChunk:
    """A single text chunk from a processed document."""

    id: str
    document_id: str
    file_name: str
    chunk_index: int
    content: str
    metadata: dict
    timestamp: str
    embedding: Optional[list[float]] = field(default=None, repr=False)


class OpenSearchService:
    """Write + read operations for the documents index."""

    def __init__(self) -> None:
        self._client = build_client()
        self._index = cfg.index
        logger.info("Ingestion OpenSearchService ready", extra={"index": self._index})

    # ── Index lifecycle ───────────────────────────────────────────────────────

    def initialize_index(self) -> None:
        """Create the index with kNN mappings if it does not already exist."""
        if self._client.indices.exists(index=self._index):
            logger.info("Index already exists", extra={"index": self._index})
            return
        self._client.indices.create(index=self._index, body=_INDEX_SETTINGS)
        logger.info("Index created", extra={"index": self._index})

    # ── Write ─────────────────────────────────────────────────────────────────

    def index_chunk(self, chunk: DocumentChunk) -> None:
        """Index a single chunk (with refresh for immediate visibility)."""
        self._client.index(
            index=self._index,
            id=chunk.id,
            body=self._to_doc(chunk),
            params={"refresh": "true"},
        )

    def bulk_index_chunks(self, chunks: list[DocumentChunk]) -> None:
        """Bulk-index multiple chunks in a single API call."""
        if not chunks:
            return
        body = []
        for c in chunks:
            body.append({"index": {"_index": self._index, "_id": c.id}})
            body.append(self._to_doc(c))
        resp = self._client.bulk(body=body, params={"refresh": "true"})
        if resp.get("errors"):
            logger.error("Bulk index errors", extra={"count": len(chunks)})
        logger.debug("Chunks indexed", extra={"count": len(chunks)})

    def delete_document_chunks(self, document_id: str) -> None:
        """Remove all chunks that belong to *document_id*."""
        self._client.delete_by_query(
            index=self._index,
            body={"query": {"term": {"documentId": document_id}}},
            params={"refresh": "true"},
        )
        logger.info("Document chunks deleted", extra={"document_id": document_id})

    # ── Read ──────────────────────────────────────────────────────────────────

    def get_document_chunks(self, document_id: str) -> list[dict]:
        resp = self._client.search(
            index=self._index,
            body={
                "query": {"term": {"documentId": document_id}},
                "sort": [{"chunkIndex": "asc"}],
                "size": 1000,
            },
        )
        return [h["_source"] for h in resp["hits"]["hits"]]

    def hybrid_search(
        self,
        query: str,
        embedding: Optional[list[float]] = None,
        filters: Optional[dict] = None,
        limit: int = 10,
    ) -> list[dict]:
        """Keyword + optional kNN search."""
        should = [{
            "multi_match": {
                "query": query,
                "fields": ["content^2", "fileName", "metadata.section"],
                "type": "best_fields",
                "fuzziness": "AUTO",
            }
        }]
        if embedding:
            should.append({"knn": {"embedding": {"vector": embedding, "k": limit}}})

        must = []
        if filters:
            for f, v in filters.items():
                if v:
                    must.append({"term": {f"metadata.{f}": v}})

        body: dict = {
            "query": {
                "bool": {
                    **({"must": must} if must else {}),
                    "should": should,
                    "minimum_should_match": 1,
                }
            },
            "size": limit,
        }
        resp = self._client.search(index=self._index, body=body)
        return [h["_source"] for h in resp["hits"]["hits"]]

    # ── Private ───────────────────────────────────────────────────────────────

    @staticmethod
    def _to_doc(chunk: DocumentChunk) -> dict:
        doc = {
            "id": chunk.id,
            "documentId": chunk.document_id,
            "fileName": chunk.file_name,
            "chunkIndex": chunk.chunk_index,
            "content": chunk.content,
            "metadata": chunk.metadata,
            "timestamp": chunk.timestamp,
        }
        if chunk.embedding is not None:
            doc["embedding"] = chunk.embedding
        return doc


opensearch_service = OpenSearchService()
