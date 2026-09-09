"""Centralised logging factory for all Maximo Knowledge Hub services.

Usage::

    from shared.logging import get_logger
    logger = get_logger(__name__)
    logger.info("Service started", extra={"port": 8000})

Extra fields passed via ``extra={}`` are automatically appended to the log
line as  key=value  pairs, e.g.::

    [2026-07-29 22:37:59] INFO     my.module — Service started  port=8000
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Optional


class _ExtraFormatter(logging.Formatter):
    """Formatter that appends extra key=value fields to every log line."""

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        # Standard LogRecord attributes to skip
        _SKIP = {
            "name", "msg", "args", "levelname", "levelno", "pathname",
            "filename", "module", "exc_info", "exc_text", "stack_info",
            "lineno", "funcName", "created", "msecs", "relativeCreated",
            "thread", "threadName", "processName", "process", "message",
            "asctime",
        }
        extras = {k: v for k, v in record.__dict__.items() if k not in _SKIP}
        if extras:
            pairs = "  " + "  ".join(f"{k}={v}" for k, v in extras.items())
            return base + pairs
        return base


def get_logger(name: str, log_dir: Optional[Path] = None) -> logging.Logger:
    """Return a configured logger.

    Args:
        name:    Logger name, typically ``__name__``.
        log_dir: Optional directory for rotating file handler. When *None*
                 only the console handler is attached.

    Returns:
        A :class:`logging.Logger` instance.
    """
    level_name: str = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    logger = logging.getLogger(name)
    if logger.handlers:
        # Already configured — re-use to avoid duplicate handlers
        return logger

    logger.setLevel(level)

    fmt = _ExtraFormatter(
        fmt="[%(asctime)s] %(levelname)-8s %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler (stdout — stderr reserved for critical errors)
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    # Optional rotating file handler
    if log_dir is not None:
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        from logging.handlers import RotatingFileHandler

        file_handler = RotatingFileHandler(
            log_dir / "app.log",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(fmt)
        logger.addHandler(file_handler)

    return logger


# Type alias exported for callers that want to annotate their logger variable
Logger = logging.Logger
