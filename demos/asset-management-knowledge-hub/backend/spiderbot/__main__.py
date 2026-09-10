"""Spiderbot CLI entry point.

Usage::

    python -m spiderbot crawl
    python -m spiderbot crawl --dry-run
    python -m spiderbot crawl --filter "MAS CLI" --concurrency 1
    python -m spiderbot crawl --force
    python -m spiderbot stats
"""

from __future__ import annotations

import argparse
import sys

from spiderbot.src.pipeline.crawl_pipeline import PipelineOptions, run_pipeline
from spiderbot.src.indexer.opensearch_indexer import opensearch_indexer
from shared.logging import get_logger

logger = get_logger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="spiderbot", description="Maximo web-knowledge crawler")
    sub = parser.add_subparsers(dest="command", required=True)

    # crawl sub-command
    crawl_p = sub.add_parser("crawl", help="Run the full crawl + embed + index pipeline")
    crawl_p.add_argument("--dry-run", action="store_true", help="Log pages without indexing")
    crawl_p.add_argument("--force", action="store_true", help="Re-index already-indexed pages")
    crawl_p.add_argument("--filter", dest="filter_label", metavar="LABEL", help="Only crawl sites whose label contains LABEL")
    crawl_p.add_argument("--concurrency", type=int, help="Parallel site crawlers")

    # stats sub-command
    sub.add_parser("stats", help="Print current OpenSearch index statistics")

    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    if args.command == "stats":
        stats = opensearch_indexer.stats()
        print("\n── OpenSearch Index Stats ──────────────────────")
        print(f"  Documents  : {stats['doc_count']:,}")
        print(f"  Index size : {stats['index_size_bytes'] / 1024 / 1024:.2f} MB")
        print("────────────────────────────────────────────────\n")
        return

    if args.command == "crawl":
        options = PipelineOptions(
            dry_run=args.dry_run,
            filter_label=args.filter_label,
            force_reindex=args.force,
            concurrency=args.concurrency,
        )
        result = run_pipeline(options)
        print("\n── Crawl Pipeline Summary ──────────────────────")
        print(f"  Sites crawled  : {result.sites_crawled}")
        print(f"  Pages crawled  : {result.pages_crawled}")
        print(f"  Pages skipped  : {result.pages_skipped}")
        print(f"  Chunks indexed : {result.chunks_indexed}")
        print(f"  Errors         : {result.errors}")
        print(f"  Duration       : {result.duration_ms / 1000:.1f}s")
        print("────────────────────────────────────────────────\n")
        if result.errors:
            sys.exit(1)


if __name__ == "__main__":
    main()
