"""Spiderbot configuration — extends shared config with crawler-specific settings."""

from __future__ import annotations

import os
from shared.config import opensearch, watsonx  # re-export


class SpiderbotConfig:
    """Crawl-behaviour tuning knobs — all controllable via .env."""

    max_pages_per_site: int = int(os.environ.get("SPIDERBOT_MAX_PAGES_PER_SITE", "100"))
    max_depth: int = int(os.environ.get("SPIDERBOT_MAX_DEPTH", "3"))
    scroll_delay_ms: int = int(os.environ.get("SPIDERBOT_SCROLL_DELAY_MS", "300"))
    page_load_timeout_ms: int = int(os.environ.get("SPIDERBOT_PAGE_LOAD_TIMEOUT_MS", "15000"))
    chunk_size: int = int(os.environ.get("SPIDERBOT_CHUNK_SIZE", "400"))
    chunk_overlap: int = int(os.environ.get("SPIDERBOT_CHUNK_OVERLAP", "100"))
    embedding_batch_size: int = int(os.environ.get("SPIDERBOT_EMBEDDING_BATCH_SIZE", "16"))
    concurrency: int = int(os.environ.get("SPIDERBOT_CONCURRENCY", "2"))
    index: str = os.environ.get("SPIDERBOT_INDEX", "maximo_web_knowledge")


spiderbot = SpiderbotConfig()

__all__ = ["opensearch", "watsonx", "spiderbot"]
