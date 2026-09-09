"""MCP Server entry point.

Usage::

    python -m mcp_server              # starts HTTP server on port 6868
    python -m mcp_server --port 8080  # custom port
    python -m mcp_server --debug      # verbose logging
"""

from __future__ import annotations

import argparse
import uvicorn

from mcp_server.src.server.http_server import create_app
from mcp_server.src.config import server as srv_cfg
from shared.logging import get_logger

logger = get_logger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="mcp_server",
        description="Maximo Knowledge Hub MCP Server",
    )
    parser.add_argument("--port", type=int, default=srv_cfg.port, help="HTTP port (default: 6868)")
    parser.add_argument("--debug", action="store_true", default=srv_cfg.debug, help="Verbose logging")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    log_level = "debug" if args.debug else "info"

    logger.info("MCP Server starting", extra={"port": args.port, "debug": args.debug})

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level=log_level)


if __name__ == "__main__":
    main()
