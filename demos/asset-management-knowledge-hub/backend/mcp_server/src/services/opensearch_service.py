"""OpenSearch service for the MCP server.

Handles queries against two separate OpenSearch indices:
- ``maximo-documents``    — maintenance PDF chunks (written by ingestion pipeline)
- ``maximo_web_knowledge``— web-crawled IBM/community docs (written by spiderbot)
"""

from __future__ import annotations

from typing import Optional

from shared.opensearch import build_client
from shared.logging import get_logger
from mcp_server.src.config import opensearch as cfg, server as srv_cfg

logger = get_logger(__name__)

_WEB_INDEX = srv_cfg.web_knowledge_index


class OpenSearchService:
    """All OpenSearch read operations required by the MCP server."""

    def __init__(self) -> None:
        self._client = build_client()
        self._index = cfg.index
        logger.info("OpenSearchService ready", extra={"index": self._index})

    # ── Connection test ───────────────────────────────────────────────────────

    def test_connection(self) -> dict:
        """Ping the cluster and return health status."""
        try:
            health = self._client.cluster.health()
            return {"success": True, "status": health["status"]}
        except Exception as exc:
            logger.error("Connection failed", extra={"error": str(exc)})
            return {"success": False, "error": str(exc)}

    # ── Document RAG index ────────────────────────────────────────────────────

    def hybrid_search(
        self,
        query: str,
        embedding: Optional[list[float]] = None,
        filters: Optional[dict] = None,
        limit: int = 10,
    ) -> list[dict]:
        """Keyword + optional vector search over the documents index.

        Args:
            query:     User's natural-language query.
            embedding: Pre-computed query embedding (optional).
            filters:   Dict with optional keys ``assetnum``, ``category``, ``version``.
            limit:     Maximum number of hits to return.

        Returns:
            List of result dicts with ``documentId``, ``fileName``, ``content``,
            ``score``, ``metadata``, and ``highlights``.
        """
        filters = filters or {}
        must: list[dict] = []
        should: list[dict] = []

        if query:
            should.append({
                "multi_match": {
                    "query": query,
                    "fields": ["content^2", "fileName", "metadata.section"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            })

        # Vector search is disabled here until the index is recreated with a
        # knn_vector mapping (see SEMANTIC_SEARCH_IMPLEMENTATION.md in old_code).
        # When ready, uncomment the block below:
        # if embedding:
        #     should.append({"knn": {"embedding": {"vector": embedding, "k": limit}}})

        for field, value in [
            ("assetnum", filters.get("assetnum")),
            ("category", filters.get("category")),
            ("version", filters.get("version")),
        ]:
            if value:
                must.append({"term": {f"metadata.{field}": value}})

        body: dict = {
            "query": {
                "bool": {
                    **({"must": must} if must else {}),
                    **({"should": should, "minimum_should_match": 1} if should else {}),
                }
            },
            "size": limit,
            "highlight": {
                "fields": {"content": {"fragment_size": 150, "number_of_fragments": 3}}
            },
        }

        response = self._client.search(index=self._index, body=body)
        hits = response["hits"]["hits"]
        logger.debug("Hybrid search done", extra={"hits": len(hits)})
        return [
            {
                "documentId": h["_source"].get("documentId"),
                "fileName": h["_source"].get("fileName"),
                "content": h["_source"].get("content"),
                "score": h["_score"],
                "metadata": h["_source"].get("metadata", {}),
                "highlights": h.get("highlight", {}).get("content", []),
            }
            for h in hits
        ]

    def get_document_chunks(self, document_id: str) -> list[dict]:
        """Retrieve all chunks for a document, ordered by chunk index."""
        body = {
            "query": {"term": {"documentId": document_id}},
            "sort": [{"chunkIndex": "asc"}],
            "size": 1000,
        }
        response = self._client.search(index=self._index, body=body)
        return [h["_source"] for h in response["hits"]["hits"]]

    def search_by_asset(self, assetnum: str, limit: int = 10) -> list[dict]:
        """Return all document chunks for a given asset number."""
        body = {
            "query": {"term": {"metadata.assetnum": assetnum}},
            "size": limit,
        }
        response = self._client.search(index=self._index, body=body)
        return [
            {
                "documentId": h["_source"].get("documentId"),
                "fileName": h["_source"].get("fileName"),
                "content": h["_source"].get("content"),
                "metadata": h["_source"].get("metadata", {}),
            }
            for h in response["hits"]["hits"]
        ]

    def get_unique_assets(self) -> list[dict]:
        """Return all unique asset numbers with their document counts."""
        body = {
            "size": 0,
            "aggs": {"unique_assets": {"terms": {"field": "metadata.assetnum", "size": 1000}}},
        }
        response = self._client.search(index=self._index, body=body)
        buckets = response["aggregations"]["unique_assets"]["buckets"]
        return [{"assetnum": b["key"], "documentCount": b["doc_count"]} for b in buckets]

    def get_index_stats(self) -> dict:
        """Return basic statistics for the documents index."""
        stats = self._client.indices.stats(index=self._index)
        count_resp = self._client.count(index=self._index)
        size_bytes = (
            stats["indices"].get(self._index, {}).get("total", {}).get("store", {}).get("size_in_bytes", 0)
        )
        return {
            "indexName": self._index,
            "documentCount": count_resp["count"],
            "sizeInBytes": size_bytes,
            "health": stats.get("_shards", {}),
        }

    # ── Web knowledge index ───────────────────────────────────────────────────

    def web_knowledge_search(self, query: str, limit: int = 5) -> list[dict]:
        """Keyword search over the web-knowledge index (populated by spiderbot).

        Returns an empty list if the index does not yet exist — callers should
        treat an empty result as "source not available" rather than an error.
        """
        body = {
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["content^3", "title^2", "siteLabel", "topic"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            },
            "size": limit,
            "highlight": {
                "fields": {"content": {"fragment_size": 200, "number_of_fragments": 2}}
            },
            "_source": ["url", "title", "siteLabel", "topic", "content"],
            "collapse": {"field": "url.keyword"},  # one result per unique URL
        }
        try:
            response = self._client.search(index=_WEB_INDEX, body=body)
        except Exception as exc:
            if "index_not_found" in str(exc).lower():
                logger.warning("Web knowledge index not found — skipping")
                return []
            logger.error("Web knowledge search error", extra={"error": str(exc)})
            return []

        hits = response["hits"]["hits"]
        return [
            {
                "url": h["_source"].get("url"),
                "title": h["_source"].get("title") or h["_source"].get("url"),
                "siteLabel": h["_source"].get("siteLabel"),
                "topic": h["_source"].get("topic"),
                "content": h["_source"].get("content"),
                "score": h["_score"],
                "highlights": h.get("highlight", {}).get("content", []),
            }
            for h in hits
        ]


# Module-level singleton
opensearch_service = OpenSearchService()
