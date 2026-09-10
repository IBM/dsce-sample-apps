# backend/app/core/idempotency.py
# In-memory idempotency store for event deduplication (spec/03, NFR-003)
# Production: replace with Redis SET NX / DB unique constraint.

from __future__ import annotations

_seen: set[str] = set()


def is_duplicate(event_id: str) -> bool:
    return event_id in _seen


def mark_seen(event_id: str) -> None:
    _seen.add(event_id)


def clear_all() -> None:
    _seen.clear()
