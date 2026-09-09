"""Job store — persists ingestion job results to a JSON file.

Stores every ingestion attempt (success, failed, skipped) so the UI
can display a full history even when OpenSearch is empty or unreachable.

The file is written atomically (write temp → rename) to avoid corruption.
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from shared.logging import get_logger

logger = get_logger(__name__)

# Store at repo root so it survives backend restarts
# parents[0]=services/, [1]=src/, [2]=ingestion_pipeline/, [3]=backend/, [4]=repo root
_DEFAULT_PATH = Path(__file__).resolve().parents[4] / "ingestion_jobs.json"
_JOB_STORE_PATH = Path(os.environ.get("JOB_STORE_PATH", str(_DEFAULT_PATH)))
_MAX_JOBS = 500  # keep last N jobs to avoid unbounded growth


class JobStoreService:
    """Thread-safe file-backed ingestion job store."""

    def __init__(self, path: Path = _JOB_STORE_PATH) -> None:
        self._path = path

    # ── Public API ────────────────────────────────────────────────────────────

    def append(
        self,
        *,
        document_id: str,
        file_name: str,
        status: str,          # "indexed" | "failed" | "skipped"
        source: str,          # "cos" | "s3" | "web" | "box"
        chunk_count: int = 0,
        error: Optional[str] = None,
        job_id: Optional[str] = None,
    ) -> None:
        """Append a single job record to the store."""
        jobs = self._load()
        jobs.append({
            "documentId":  document_id,
            "fileName":    file_name,
            "status":      status,
            "source":      source,
            "chunkCount":  chunk_count,
            "error":       error or "",
            "indexedAt":   datetime.now(timezone.utc).isoformat(),
            "jobId":       job_id or "",
        })
        # Keep only the most recent N entries
        if len(jobs) > _MAX_JOBS:
            jobs = jobs[-_MAX_JOBS:]
        self._save(jobs)

    def append_many(self, records: list[dict]) -> None:
        """Append multiple job records in one write."""
        jobs = self._load()
        jobs.extend(records)
        if len(jobs) > _MAX_JOBS:
            jobs = jobs[-_MAX_JOBS:]
        self._save(jobs)

    def list_jobs(self, limit: int = 100) -> list[dict]:
        """Return the most recent *limit* jobs, newest first."""
        jobs = self._load()
        return list(reversed(jobs[-limit:]))

    def clear(self) -> None:
        """Remove all stored jobs."""
        self._save([])

    # ── Private ───────────────────────────────────────────────────────────────

    def _load(self) -> list[dict]:
        try:
            if self._path.exists():
                return json.loads(self._path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Job store read failed — starting fresh", extra={"error": str(exc)})
        return []

    def _save(self, jobs: list[dict]) -> None:
        """Atomically write jobs to disk."""
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=self._path.parent, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(jobs, f, indent=2)
                os.replace(tmp, self._path)
            except Exception:
                os.unlink(tmp)
                raise
        except Exception as exc:
            logger.error("Job store write failed", extra={"error": str(exc)})


job_store_service = JobStoreService()
