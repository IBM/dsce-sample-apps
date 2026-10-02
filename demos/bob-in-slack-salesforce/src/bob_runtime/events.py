"""Parser for Bob Shell v2 `run -f stream-json` output.

Observed schema (validated live against bobshell 2.0.1, see docs/bob-shell-behavior.md):

    {"type":"message","timestamp":"...","role":"user","content":"..."}
    {"type":"message","timestamp":"...","role":"assistant","content":"<chunk>"}
    {"type":"result","timestamp":"...","status":"success",
     "stats":{"task_id":"...","duration_ms":1883,"session_costs":0.0152,
              "max_cost":0,"tool_calls":0}}

Assistant content arrives as many small chunks; callers should read
`StreamState.assistant_text` for the assembled reply. Unknown event types are
retained verbatim in `events` so a newer Bob doesn't silently lose data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import json
from typing import Any


@dataclass
class RunStats:
    task_id: str = ""
    duration_ms: int | None = None
    session_costs: float | None = None
    max_cost: float | None = None
    tool_calls: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_raw(cls, raw: dict[str, Any]) -> "RunStats":
        def num(key: str) -> Any:
            value = raw.get(key)
            return value if isinstance(value, (int, float)) else None

        task_id = raw.get("task_id")
        return cls(
            task_id=task_id if isinstance(task_id, str) else "",
            duration_ms=num("duration_ms"),
            session_costs=num("session_costs"),
            max_cost=num("max_cost"),
            tool_calls=num("tool_calls"),
            raw=raw,
        )


@dataclass
class StreamState:
    """Accumulates events for a single `bob run` invocation."""

    events: list[dict[str, Any]] = field(default_factory=list)
    status: str | None = None
    stats: RunStats | None = None
    diagnostics: list[str] = field(default_factory=list)
    _assistant_parts: list[str] = field(default_factory=list)

    def consume(self, line: str) -> dict[str, Any] | None:
        """Parse one output line; returns the event dict, or None for noise.

        Non-JSON lines (banners, warnings leaking to stdout) are kept in
        `diagnostics` rather than discarded.
        """
        stripped = line.strip()
        if not stripped:
            return None
        if not stripped.startswith("{"):
            self.diagnostics.append(stripped)
            return None
        try:
            event = json.loads(stripped)
        except json.JSONDecodeError:
            self.diagnostics.append(stripped)
            return None
        if not isinstance(event, dict):
            return None

        self.events.append(event)
        event_type = event.get("type")
        if event_type == "message" and event.get("role") == "assistant":
            content = event.get("content")
            if isinstance(content, str):
                self._assistant_parts.append(content)
        elif event_type == "result":
            status = event.get("status")
            self.status = status if isinstance(status, str) else None
            raw_stats = event.get("stats")
            if isinstance(raw_stats, dict):
                self.stats = RunStats.from_raw(raw_stats)
        return event

    @property
    def assistant_text(self) -> str:
        return "".join(self._assistant_parts)

    @property
    def task_id(self) -> str:
        return self.stats.task_id if self.stats else ""
