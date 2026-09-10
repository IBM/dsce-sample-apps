"""Crawl pipeline — orchestrates crawl → chunk → embed → index for all sites.

This module is the only entry point that combines all spiderbot components.
The :func:`run_pipeline` function is called by ``__main__.py`` and can be
imported by tests or scheduled jobs.
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Optional

from spiderbot.src.config import spiderbot as cfg
from spiderbot.src.crawler.page_crawler import PageCrawler, CrawledPage
from spiderbot.src.crawler.site_registry import SITES, SiteEntry
from spiderbot.src.indexer.text_chunker import chunk_text
from spiderbot.src.indexer.opensearch_indexer import WebChunk, opensearch_indexer
from shared.watsonx import client as wx
from shared.logging import get_logger

logger = get_logger(__name__)


@dataclass
class PipelineOptions:
    """Runtime options for :func:`run_pipeline`."""

    dry_run: bool = False
    """When True, log pages but do not index."""
    filter_label: Optional[str] = None
    """Only crawl sites whose label contains this string (case-insensitive)."""
    force_reindex: bool = False
    """Re-index pages that are already in OpenSearch."""
    concurrency: Optional[int] = None
    """Number of parallel site crawlers."""


@dataclass
class PipelineStats:
    """Counters collected during a pipeline run."""

    sites_crawled: int = 0
    pages_crawled: int = 0
    chunks_indexed: int = 0
    pages_skipped: int = 0
    errors: int = 0
    duration_ms: int = 0


def _process_page(
    page: CrawledPage,
    *,
    force_reindex: bool,
    dry_run: bool,
) -> tuple[int, bool]:
    """Chunk, embed, and index a single crawled page.

    Returns:
        ``(chunks_indexed, was_skipped)``
    """
    if not page.text or len(page.text.strip()) < 50:
        return 0, True

    if not force_reindex and not dry_run:
        if opensearch_indexer.is_url_indexed(page.url):
            logger.debug("Already indexed — skipping", extra={"url": page.url})
            return 0, True

    if dry_run:
        logger.info("[DRY RUN] Would index", extra={"url": page.url, "chars": len(page.text)})
        return 0, False

    raw_chunks = chunk_text(page.text)
    if not raw_chunks:
        return 0, True

    texts = [c.content for c in raw_chunks]
    embeddings = wx.embed_batched(texts, batch_size=cfg.embedding_batch_size)

    web_chunks = [
        WebChunk(
            id=str(uuid.uuid4()),
            url=page.url,
            title=page.title,
            site_label=page.site_label,
            topic=page.topic,
            chunk_index=chunk.index,
            content=chunk.content,
            crawled_at=page.crawled_at,
            depth=page.depth,
            embedding=embeddings[i],
        )
        for i, chunk in enumerate(raw_chunks)
    ]

    opensearch_indexer.bulk_index(web_chunks)
    logger.info("Page indexed", extra={"url": page.url, "chunks": len(web_chunks)})
    return len(web_chunks), False


def _crawl_one_site(
    site: SiteEntry,
    stats: PipelineStats,
    *,
    force_reindex: bool,
    dry_run: bool,
) -> None:
    """Crawl a single site and update *stats* in-place (thread-safe via GIL)."""
    crawler = PageCrawler()
    try:
        crawler.init()

        def on_page(page: CrawledPage) -> None:
            stats.pages_crawled += 1
            try:
                n, skipped = _process_page(page, force_reindex=force_reindex, dry_run=dry_run)
                if skipped:
                    stats.pages_skipped += 1
                else:
                    stats.chunks_indexed += n
            except Exception as exc:
                stats.errors += 1
                logger.error("Page processing failed", extra={"url": page.url, "error": str(exc)})

        crawler.crawl_site(site, on_page=on_page, dry_run=dry_run)
        stats.sites_crawled += 1

    except Exception as exc:
        stats.errors += 1
        logger.error("Site crawl failed", extra={"label": site.label, "error": str(exc)})
    finally:
        crawler.close()


def run_pipeline(options: Optional[PipelineOptions] = None) -> PipelineStats:
    """Execute the full crawl → embed → index pipeline.

    Args:
        options: Fine-tuned behaviour; defaults to :class:`PipelineOptions`.

    Returns:
        Aggregated :class:`PipelineStats` for the completed run.
    """
    import time

    opts = options or PipelineOptions()
    concurrency = opts.concurrency or cfg.concurrency
    stats = PipelineStats()
    start = time.monotonic()

    logger.info(
        "Pipeline starting",
        extra={
            "dry_run": opts.dry_run,
            "filter_label": opts.filter_label,
            "force_reindex": opts.force_reindex,
            "concurrency": concurrency,
        },
    )

    if not opts.dry_run:
        opensearch_indexer.ensure_index()

    sites = list(SITES)
    if opts.filter_label:
        lower = opts.filter_label.lower()
        sites = [s for s in sites if lower in s.label.lower()]
        if not sites:
            logger.warning("No sites matched filter", extra={"filter": opts.filter_label})
            return stats

    logger.info(f"Processing {len(sites)} site(s)")

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {
            pool.submit(
                _crawl_one_site,
                site,
                stats,
                force_reindex=opts.force_reindex,
                dry_run=opts.dry_run,
            ): site
            for site in sites
        }
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as exc:
                site = futures[future]
                logger.error("Site future raised", extra={"label": site.label, "error": str(exc)})

    stats.duration_ms = int((time.monotonic() - start) * 1000)
    logger.info("Pipeline complete", extra={"stats": stats.__dict__})
    return stats
