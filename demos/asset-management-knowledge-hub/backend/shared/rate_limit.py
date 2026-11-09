"""Small in-memory sliding-window rate limiter.

Per-process and per-key: good enough to blunt a flood from one client against a
single instance. It does not coordinate across replicas or survive restarts; put a
gateway/WAF rate limit in front for anything beyond a demonstration.

Environment:
    INGEST_RATE_LIMIT_MAX      submissions allowed per window (default 10)
    INGEST_RATE_LIMIT_WINDOW   window length in seconds (default 60)
"""

from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, max_events: int, window_seconds: float) -> None:
        self.max_events = max_events
        self.window = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> float:
        """Record an event. Returns 0 if allowed, else seconds until retry."""
        now = time.monotonic()
        with self._lock:
            events = self._events[key]
            while events and now - events[0] >= self.window:
                events.popleft()
            if len(events) >= self.max_events:
                return max(1.0, self.window - (now - events[0]))
            events.append(now)
            if len(self._events) > 10_000:      # bound memory under key churn
                for stale in [k for k, v in self._events.items() if not v or now - v[-1] >= self.window]:
                    del self._events[stale]
            return 0.0


def limiter_from_env() -> RateLimiter:
    return RateLimiter(
        max_events=max(1, int(os.environ.get("INGEST_RATE_LIMIT_MAX", "10"))),
        window_seconds=max(1.0, float(os.environ.get("INGEST_RATE_LIMIT_WINDOW", "60"))),
    )
