# backend/app/services/audit.py
# Append-only audit trail (spec/08_SECURITY_OBSERVABILITY_NFR.md)
# Production: persist to immutable store (S3, DB audit table, etc.)

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any

_trail: list[dict[str, Any]] = []


def record(
    event_type: str,
    correlation_id: str,
    actor: str = "SYSTEM",
    **payload: Any,
) -> None:
    entry: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "correlation_id": correlation_id,
        "actor": actor,
        **payload,
    }
    _trail.append(entry)


def get_trail(correlation_id: str | None = None) -> list[dict[str, Any]]:
    if correlation_id:
        return [e for e in _trail if e.get("correlation_id") == correlation_id]
    return list(_trail)


def clear() -> None:
    _trail.clear()
