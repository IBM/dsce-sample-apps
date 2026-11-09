"""Web URL crawl + ingest service.

Crawls one or more seed URLs (optionally following links to max_depth),
extracts visible text, chunks it, embeds via WatsonX, and indexes into
OpenSearch under the 'maximo_web_knowledge' index (SPIDERBOT_INDEX).
"""

from __future__ import annotations
import os
import re
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ingestion_pipeline.src.services.cos_service import DocumentMetadata
from ingestion_pipeline.src.services.opensearch_service import OpenSearchService, DocumentChunk
from shared.chunking import CHUNK_OVERLAP, CHUNK_SIZE, split_text
from shared.net_guard import UnsafeURLError, crawl_allowed_hosts, safe_get
from shared.watsonx import client as wx
from datetime import datetime
from shared.logging import get_logger

logger = get_logger(__name__)

_DEFAULT_HEADERS = {
    "User-Agent": "MaximoKnowledgeHub/1.0 (+https://github.com/ibm/maximo-knowledge-hub)"
}

# Hard ceilings, independent of what the caller asks for.
MAX_DEPTH_LIMIT = 2
MAX_PAGES_LIMIT = 50
MAX_CHUNKS_PER_PAGE = 500


@dataclass
class WebCrawlResult:
    url: str
    total_chunks: int
    pages_crawled: int
    status: str
    error: Optional[str] = None


# ── Dedicated OpenSearch service for the web-knowledge index ─────────────────
# Uses SPIDERBOT_INDEX (default: maximo_web_knowledge) instead of
# OPENSEARCH_INDEX (maximo-documents) so web crawl results land in the
# correct index and are queryable by the MCP server's web_knowledge_search.
class _WebOpenSearchService(OpenSearchService):
    def __init__(self) -> None:
        from shared.opensearch import build_client
        self._client = build_client()
        self._index = os.environ.get("SPIDERBOT_INDEX", "maximo_web_knowledge")

    @staticmethod
    def _to_doc(chunk: DocumentChunk) -> dict:
        """Write the fields the web index is mapped with and the MCP reader queries
        (url, title, siteLabel, crawledAt), alongside the generic chunk fields."""
        doc = OpenSearchService._to_doc(chunk)
        doc["url"] = chunk.file_name
        doc["title"] = chunk.metadata.get("title") or chunk.file_name
        doc["siteLabel"] = urlparse(chunk.file_name).hostname or ""
        doc["crawledAt"] = chunk.timestamp
        return doc


class WebIngestionService:

    def __init__(self) -> None:
        self._os = _WebOpenSearchService()

    def ingest_url(
        self,
        seed_url: str,
        *,
        max_depth: int = 1,
        max_pages: int = 20,
        selector: Optional[str] = None,
        asset_num: Optional[str] = None,
        category: str = "web-content",
        tags: list[str] | None = None,
        job_id: Optional[str] = None,
    ) -> WebCrawlResult:
        from ingestion_pipeline.src.services.progress_service import progress_service, ProgressEvent

        max_depth = max(0, min(max_depth, MAX_DEPTH_LIMIT))
        max_pages = max(1, min(max_pages, MAX_PAGES_LIMIT))
        allowed_hosts = crawl_allowed_hosts()

        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(seed_url, 0)]
        total_chunks = 0
        pages_crawled = 0
        attempts = 0

        # Cap fetch attempts (not just indexed pages) so unreachable or empty
        # links cannot keep the worker busy indefinitely.
        while queue and pages_crawled < max_pages and attempts < max_pages * 3:
            url, depth = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)
            attempts += 1

            try:
                resp = safe_get(url, headers=_DEFAULT_HEADERS, allowed_hosts=allowed_hosts)
            except Exception as exc:
                # Details stay in the server log. The caller sees one generic
                # outcome, so the response is no network-probing oracle.
                logger.warning("Skipping URL", extra={
                    "url": url,
                    "error": str(exc),
                    "blocked": isinstance(exc, UnsafeURLError),
                })
                if job_id:
                    progress_service.push(job_id, ProgressEvent(
                        type="skip",
                        message=f"  ↷ Skipped {url}",
                        detail="URL could not be fetched",
                    ))
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            title = (soup.title.get_text(strip=True) if soup.title else "")[:300]
            text = self._extract_text(soup, selector)
            if text.strip():
                if job_id:
                    progress_service.push(job_id, ProgressEvent(
                        type="page",
                        message=f"  → Indexing {url}",
                        detail=url,
                        count=pages_crawled + 1,
                    ))
                meta = DocumentMetadata(
                    document_id=f"web/{re.sub(r'[^a-z0-9]+', '-', url.lower())[:80]}",
                    file_name=url,
                    file_type="text/html",
                    file_size=len(text.encode()),
                    upload_date=datetime.utcnow(),
                    version=1,
                    asset_num=asset_num,
                    category=category,
                    tags=tags or [],
                )
                result = self._process_web_content(text, url, meta, title)
                total_chunks += result.total_chunks
                pages_crawled += 1
                if job_id:
                    progress_service.push(job_id, ProgressEvent(
                        type="chunk",
                        message=f"  ✓ {url} — {result.total_chunks} chunks",
                        count=pages_crawled,
                        chunks=total_chunks,
                    ))

            # Follow links at this depth level (same host as the seed only)
            if depth < max_depth:
                base = urlparse(seed_url)
                for a in soup.find_all("a", href=True):
                    href = urljoin(url, a["href"])
                    parsed = urlparse(href)
                    if parsed.scheme in ("http", "https") and parsed.netloc == base.netloc:
                        if href not in visited:
                            queue.append((href, depth + 1))

            time.sleep(0.3)  # polite crawl delay

        return WebCrawlResult(
            url=seed_url,
            total_chunks=total_chunks,
            pages_crawled=pages_crawled,
            status="success",
        )

    def _process_web_content(
        self, text: str, url: str, meta: DocumentMetadata, title: str = ""
    ) -> "ProcessingResult":
        """Chunk + embed + index web text directly into the web-knowledge index."""
        from dataclasses import dataclass as _dc
        from datetime import datetime, timezone

        _BATCH_SIZE = 10

        @_dc
        class ProcessingResult:
            total_chunks: int
            status: str

        doc_id = meta.document_id
        batch: list[DocumentChunk] = []
        total_indexed = 0

        for chunk_index, content in enumerate(split_text(text, CHUNK_SIZE, CHUNK_OVERLAP)):
            if chunk_index >= MAX_CHUNKS_PER_PAGE:
                logger.warning("Chunk cap reached; truncating page", extra={"url": url})
                break
            batch.append(DocumentChunk(
                id=f"{doc_id}::chunk-{chunk_index}",
                document_id=doc_id,
                file_name=url,
                chunk_index=chunk_index,
                content=content,
                metadata={
                    "assetnum": meta.asset_num,
                    "category": meta.category,
                    "version":  meta.version,
                    "tags":     meta.tags or [],
                    "title":    title,
                },
                timestamp=datetime.now(timezone.utc).isoformat(),
            ))
            if len(batch) >= _BATCH_SIZE:
                total_indexed += self._flush(batch)
                batch = []

        if batch:
            total_indexed += self._flush(batch)

        return ProcessingResult(total_chunks=total_indexed, status="success")

    def _flush(self, batch: list[DocumentChunk]) -> int:
        texts = [c.content for c in batch]
        embeddings = wx.embed_batched(texts)
        for chunk, emb in zip(batch, embeddings):
            chunk.embedding = emb
        self._os.bulk_index_chunks(batch)
        return len(batch)

    @staticmethod
    def _extract_text(soup: BeautifulSoup, selector: Optional[str]) -> str:
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        if selector:
            nodes = soup.select(selector)
            return "\n".join(n.get_text(separator="\n", strip=True) for n in nodes)
        return soup.get_text(separator="\n", strip=True)


web_ingestion_service = WebIngestionService()
