# backend/app/core/logger.py
# Structured JSON logger – propagates correlationId and riskId (spec/08)

from __future__ import annotations
import logging
import sys
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger: structlog.stdlib.BoundLogger = structlog.get_logger("tsci")


def bind(**kwargs: object) -> structlog.stdlib.BoundLogger:
    """Return a logger bound with extra context (correlationId, riskId, etc.)."""
    return logger.bind(**kwargs)
