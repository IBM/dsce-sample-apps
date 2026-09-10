"""Ingestion pipeline entry point.

Usage::

    python -m ingestion_pipeline           # start the API server
    python -m ingestion_pipeline --port 9000
"""

from __future__ import annotations

import argparse

import uvicorn

from ingestion_pipeline.src.api.server import create_app
from ingestion_pipeline.src.config import app as app_cfg
from ingestion_pipeline.src.services.opensearch_service import opensearch_service
from ingestion_pipeline.src.services.document_registry_service import document_registry_service
from shared.logging import get_logger

logger = get_logger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="ingestion_pipeline")
    parser.add_argument("--port", type=int, default=app_cfg.backend_port)
    parser.add_argument("--debug", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    logger.info("=" * 60)
    logger.info("Ingestion Pipeline starting", extra={"port": args.port, "debug": args.debug})

    # Ensure indexes exist before serving requests
    logger.info("Initialising OpenSearch indexes…")
    try:
        opensearch_service.initialize_index()
        document_registry_service.initialize_index()
        logger.info("OpenSearch indexes ready")
    except Exception as exc:
        logger.warning("Index initialisation skipped — OpenSearch may be unavailable", extra={"reason": str(exc)})

    logger.info("Ingestion Pipeline ready", extra={"url": f"http://0.0.0.0:{args.port}"})
    logger.info("=" * 60)

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="debug" if args.debug else "info")


if __name__ == "__main__":
    main()
