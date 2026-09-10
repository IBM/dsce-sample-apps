"""In-memory progress tracking for ingestion jobs.

Each run gets a job_id. The pipeline pushes ProgressEvent objects into
a deque. The SSE endpoint drains events to the client.

Design:
  - No database or file I/O — purely in-memory, ephemeral per run.
  - Thread-safe: uses threading.Lock so pipeline threads (run_in_executor)
    can push events safely.
  - Auto-cleanup: completed/failed jobs are removed after TTL seconds.
"""

from __future__ import annotations

import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProgressEvent:
    type: str       # "start" | "page" | "chunk" | "skip" | "error" | "done"
    message: str
    detail: str = ""
    count: int = 0   # pages crawled so far / files processed so far
    total: int = 0   # known total (0 = unknown)
    chunks: int = 0  # chunks indexed so far


@dataclass
class JobProgress:
    job_id: str
    source: str
    label: str = ""           # human-readable label (e.g. URL or bucket name)
    status: str = "running"   # running | done | error
    events: deque = field(default_factory=lambda: deque(maxlen=500))
    created_at: float = field(default_factory=time.monotonic)
    created_at_iso: str = field(default_factory=lambda: __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat())
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def push(self, event: ProgressEvent) -> None:
        with self._lock:
            self.events.append(event)
        if event.type in ("done", "error"):
            self.status = event.type

    def drain(self, since: int = 0) -> list[ProgressEvent]:
        """Return all events from index *since* onwards."""
        with self._lock:
            all_events = list(self.events)
        return all_events[since:]

    def to_summary(self) -> dict:
        """Return a lightweight summary dict for job list APIs."""
        with self._lock:
            ev_list = list(self.events)
        last_msg = ev_list[-1].message if ev_list else ""
        chunks = sum(e.chunks for e in ev_list if e.type == "chunk")
        return {
            "job_id":    self.job_id,
            "source":    self.source,
            "label":     self.label,
            "status":    self.status,
            "startedAt": self.created_at_iso,
            "chunks":    chunks,
            "lastMsg":   last_msg,
        }


_TTL = 600   # seconds — keep completed jobs for 10 minutes


class ProgressService:
    def __init__(self) -> None:
        self._jobs: dict[str, JobProgress] = {}
        self._lock = threading.Lock()

    def create_job(self, source: str, label: str = "") -> str:
        job_id = str(uuid.uuid4())[:8]
        job = JobProgress(job_id=job_id, source=source, label=label)
        with self._lock:
            self._jobs[job_id] = job
            self._cleanup()
        return job_id

    def get(self, job_id: str) -> Optional[JobProgress]:
        with self._lock:
            return self._jobs.get(job_id)

    def push(self, job_id: str, event: ProgressEvent) -> None:
        job = self.get(job_id)
        if job:
            job.push(event)

    def list_running(self) -> list[dict]:
        """Return summaries of all currently running jobs."""
        with self._lock:
            jobs = list(self._jobs.values())
        return [j.to_summary() for j in jobs if j.status == "running"]

    def list_all(self) -> list[dict]:
        """Return summaries of all in-memory jobs (running + recently completed)."""
        with self._lock:
            jobs = list(self._jobs.values())
        # Newest first
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return [j.to_summary() for j in jobs]

    def _cleanup(self) -> None:
        now = time.monotonic()
        expired = [
            jid for jid, j in self._jobs.items()
            if j.status != "running" and (now - j.created_at) > _TTL
        ]
        for jid in expired:
            del self._jobs[jid]


progress_service = ProgressService()
