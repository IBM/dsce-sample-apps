"""Chat history store — persists sessions per user as a JSON file on the server.

File location: <project-root>/chat_history.json

Storage structure:
    {
        "<username>": [
            {
                "id":           <int>   — first user message id (stable dedup key),
                "title":        <str>   — first user message text, max 60 chars,
                "created_at":   <str>   — ISO-8601, set once when session first saved,
                "updated_at":   <str>   — ISO-8601, updated on every upsert,
                "message_count":<int>   — number of user messages in this session,
                "messages":     [ ... ] — slimmed message objects
            },
            ...
        ],
        ...
    }
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from shared.logging import get_logger

logger = get_logger(__name__)

# Write to /tmp which is always writable in CE containers (uid 1001).
# Resolving relative to __file__ (/app/backend/…) would land in /app/ which
# is owned by root and not writable by the non-root runtime user.
_HISTORY_FILE = Path("/tmp/chat_history.json")
_MAX_SESSIONS = 50
_lock         = threading.Lock()


# ── Internal I/O ──────────────────────────────────────────────────────────────

def _read() -> dict[str, list]:
    """Read the full history file; return empty dict on any error."""
    try:
        if _HISTORY_FILE.exists():
            data = json.loads(_HISTORY_FILE.read_text(encoding="utf-8"))
            # Support old flat-list format (pre-user-specific): migrate to dict
            if isinstance(data, list):
                logger.info("history_store: migrating flat list → user-keyed dict")
                return {"default": data}
            return data
    except Exception as exc:
        logger.warning("history_store: could not read file", extra={"error": str(exc)})
    return {}


def _write(data: dict[str, list]) -> None:
    """Write the full history dict to disk."""
    try:
        _HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        _HISTORY_FILE.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        logger.error("history_store: could not write file", extra={"error": str(exc)})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Public API (user-scoped) ──────────────────────────────────────────────────

def get_all(username: str) -> list[dict]:
    """Return all sessions for a user, newest first."""
    with _lock:
        return _read().get(username, [])


def upsert(username: str, session: dict[str, Any]) -> None:
    """Insert or update a session for a user (matched by session['id'])."""
    with _lock:
        data       = _read()
        sessions   = data.get(username, [])
        session_id = session["id"]

        existing = next((s for s in sessions if s["id"] == session_id), None)

        # Preserve created_at from the first save; always refresh updated_at
        now = _now()
        session["created_at"]    = existing["created_at"] if existing else now
        session["updated_at"]    = now
        session["message_count"] = len([m for m in session.get("messages", []) if m.get("type") == "user"])

        sessions = [s for s in sessions if s["id"] != session_id]
        sessions = [session] + sessions
        sessions = sessions[:_MAX_SESSIONS]

        data[username] = sessions
        _write(data)


def delete(username: str, session_id: int) -> bool:
    """Remove a session for a user. Returns True if it existed."""
    with _lock:
        data     = _read()
        sessions = data.get(username, [])
        filtered = [s for s in sessions if s["id"] != session_id]
        if len(filtered) == len(sessions):
            return False
        data[username] = filtered
        _write(data)
        return True


def delete_all(username: str) -> None:
    """Delete all sessions for a user."""
    with _lock:
        data = _read()
        data[username] = []
        _write(data)


def get_all_users() -> list[dict]:
    """Return a summary of all users and their session counts (admin view)."""
    with _lock:
        data = _read()
        return [
            {
                "username":      user,
                "session_count": len(sessions),
                "last_active":   sessions[0]["updated_at"] if sessions else None,
            }
            for user, sessions in data.items()
        ]
