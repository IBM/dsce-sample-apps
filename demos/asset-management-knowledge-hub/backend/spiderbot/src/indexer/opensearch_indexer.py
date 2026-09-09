"""OpenSearch indexer for the spiderbot — writes to ``maximo_web_knowledge``."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from shared.opensearch import build_client
from shared.logging import get_logger
from spiderbot.src.config import spiderbot as cfg, watsonx as wx_cfg

logger = get_logger(__name__)

_INDEX_SETTINGS = {
    "settings": {
        "number_of_shards": 2,
        "number_of_replicas": 1,
        "index.knn": True,
        "analysis": {
            "analyzer": {
                "maximo_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "stop", "snowball"],
                }
            }
        },
    },
    "mappings": {
        "properties": {
            "id":         {"type": "keyword"},
            "url":        {"type": "keyword"},
            "title":      {"type": "text", "analyzer": "maximo_analyzer"},
            "siteLabel":  {"type": "keyword"},
            "topic":      {"type": "keyword"},
            "chunkIndex": {"type": "integer"},
            "content": {
                "type": "text",
                "analyzer": "maximo_analyzer",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
            },
            "embedding": {
                "type": "knn_vector",
                "dimension": wx_cfg.embedding_dimension,
                "method": {"name": "hnsw", "space_type": "cosinesimil", "engine": "lucene"},
            },
            "crawledAt": {"type": "date"},
            "depth":     {"type": "integer"},
        }
    },
}


@dataclass
class WebChunk:
    """A single chunk of text from a crawled web page, ready for indexing."""

    id: str
    url: str
    title: str
    site_label: str
    topic: str
    chunk_index: int
    content: str
    crawled_at: str
    depth: int
    embedding: Optional[list[float]] = field(default=None, repr=False)

    def to_doc(self) -> dict:
        """Serialise to an OpenSearch document dict."""
        doc = {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "siteLabel": self.site_label,
            "topic": self.topic,
            "chunkIndex": self.chunk_index,
            "content": self.content,
            "crawledAt": self.crawled_at,
            "depth": self.depth,
        }
        if self.embedding is not None:
            doc["embedding"] = self.embedding
        return doc


class OpenSearchIndexer:
    """Creates/manages the web-knowledge index and provides bulk-index operations."""

    def __init__(self) -> None:
        self._client = build_client()
        self._index = cfg.index
        logger.info("OpenSearchIndexer initialised", extra={"index": self._index})

    def ensure_index(self) -> None:
        """Create the index with kNN mappings if it does not already exist."""
        try:
            if self._client.indices.exists(index=self._index):
                logger.info("Index already exists", extra={"index": self._index})
                return
            self._client.indices.create(index=self._index, body=_INDEX_SETTINGS)
            logger.info("Index created", extra={"index": self._index})
        except Exception as exc:
            raise RuntimeError(f"ensure_index failed: {exc}") from exc

    def bulk_index(self, chunks: list[WebChunk]) -> None:
        """Upsert a batch of WebChunks into OpenSearch."""
        if not chunks:
            return

        body = []
        for chunk in chunks:
            body.append({"index": {"_index": self._index, "_id": chunk.id}})
            body.append(chunk.to_doc())

        response = self._client.bulk(body=body, refresh=False)
        if response.get("errors"):
            failed = [
                item["index"]["error"]
                for item in response.get("items", [])
                if "error" in item.get("index", {})
            ]
            logger.warning("Bulk index had errors", extra={"failed": len(failed)})
        logger.debug("Bulk indexed", extra={"count": len(chunks)})

    def is_url_indexed(self, url: str) -> bool:
        """Return True if any chunk for *url* already exists in the index."""
        try:
            resp = self._client.count(index=self._index, body={"query": {"term": {"url": url}}})
            return (resp.get("count") or 0) > 0
        except Exception:
            return False

    def stats(self) -> dict:
        """Return basic index statistics."""
        try:
            resp = self._client.indices.stats(index=self._index)
            total = resp["indices"].get(self._index, {}).get("total", {})
            return {
                "doc_count": total.get("docs", {}).get("count", 0),
                "index_size_bytes": total.get("store", {}).get("size_in_bytes", 0),
            }
        except Exception:
            return {"doc_count": 0, "index_size_bytes": 0}


# Module-level singleton
opensearch_indexer = OpenSearchIndexer()
