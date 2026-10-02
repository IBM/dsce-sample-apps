"""Job queue + in-process worker pool.

The DB is the source of truth (queue = rows in state 'queued'); the in-memory
queue is only a wake-up signal. On startup, any 'queued' jobs are re-enqueued
and any 'running' jobs orphaned by a crash are marked failed — so a restart
never strands work silently.

Sessions: a job may belong to a (tenant, session name). The session row holds
the Bob task_id; each completed run updates it, so consecutive messages in a
session resume the same native Bob conversation.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
import queue
import threading
import time
from uuid import uuid4

from typing import Any

from bob_runtime import BobRuntime, RunConfig

from .auth import Principal
from .db import Database, now, row_to_job

# Tool groups stripped from runs whose key lacks write permission.
# LIVE-VALIDATED against bobshell 2.0.1 (2026-08-28): this exact list blocks
# file creation in headless agent mode; narrower lists (edit+command alone, or
# write alone) do NOT. Bob silently ignores unknown group names, so any change
# here MUST be re-verified live — run scripts/verify_readonly.sh.
# "read" and "search" stay enabled so read-only runs can still inspect files.
READONLY_DISABLED_GROUPS = (
    "edit", "write", "command", "execute", "shell",
    "filesystem", "terminal", "browser", "mcp", "subagent",
)

# Artifact tracking limits: files Bob created/changed during a run, surfaced to
# partner UIs (e.g. uploaded into the Slack thread).
ARTIFACT_MAX_COUNT = 5
ARTIFACT_MAX_BYTES = 512 * 1024


def _workspace_snapshot(root: Path) -> dict[str, tuple[int, int]]:
    """Map of relative path -> (mtime_ns, size) for regular files, skipping
    dotdirs like .bob (seeded config, Bob-internal state)."""
    snapshot: dict[str, tuple[int, int]] = {}
    if not root.is_dir():
        return snapshot
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if any(part.startswith(".") for part in rel.parts):
            continue
        if path.is_file() and not path.is_symlink():
            stat = path.stat()
            snapshot[str(rel)] = (stat.st_mtime_ns, stat.st_size)
    return snapshot


def _changed_artifacts(before: dict, after: dict) -> list[str]:
    changed = [rel for rel, sig in after.items() if before.get(rel) != sig]
    return sorted(changed)[:ARTIFACT_MAX_COUNT]


# One structured line per turn, for log-based audit: who ran what, which
# tool permissions were granted or refused, what it cost, how it ended.
AUDIT = logging.getLogger("headless_bob.audit")


class QuotaExceeded(Exception):
    pass


def _iso_hours_ago(hours: int) -> str:
    from datetime import UTC, datetime, timedelta
    return (datetime.now(UTC) - timedelta(hours=hours)).isoformat()


class JobService:
    def __init__(self, db: Database, runtime: BobRuntime, workers: int = 3,
                 readonly_disable_groups: tuple[str, ...] = READONLY_DISABLED_GROUPS,
                 disable_subagents: bool = True, disable_mcp: bool = False):
        self.db = db
        self.runtime = runtime
        self.readonly_disable_groups = readonly_disable_groups
        # Bob features a deployment does not need are off: fewer tools Bob can
        # be talked into, one harness per session instead of several.
        self.disable_subagents = disable_subagents
        self.disable_mcp = disable_mcp
        self._progress: dict[str, Any] = {}  # job_id -> callable(event dict)
        self._cancels: dict[str, threading.Event] = {}  # running job_id -> cancel signal
        self._cancel_requested: set[str] = set()         # cancels that arrived before the signal existed
        self._wakeup: queue.Queue[str] = queue.Queue()
        self._threads: list[threading.Thread] = []
        self._stop = threading.Event()
        self._workers = workers

    # -- lifecycle -----------------------------------------------------------

    def start(self) -> None:
        self._recover()
        for i in range(self._workers):
            t = threading.Thread(target=self._worker_loop, name=f"bob-worker-{i}", daemon=True)
            t.start()
            self._threads.append(t)

    def stop(self) -> None:
        self._stop.set()
        for _ in self._threads:
            self._wakeup.put("")

    def _recover(self) -> None:
        self.db.execute(
            "UPDATE jobs SET state='failed', error='orphaned by restart', updated_at=? "
            "WHERE state='running'",
            (now(),),
        )
        for row in self.db.all("SELECT id FROM jobs WHERE state='queued' ORDER BY created_at"):
            self._wakeup.put(row["id"])

    # -- API used by the HTTP layer -------------------------------------------

    def submit(
        self,
        principal: Principal,
        prompt: str,
        *,
        session_name: str | None = None,
        mode: str | None = None,
        max_cost: float | None = None,
        max_turns: int | None = None,
        timeout_seconds: int = 300,
        progress=None,
        request_key: str | None = None,
    ) -> dict:
        if request_key:
            # Idempotent submit: a retried request returns the job it already created.
            prior = self.db.one("SELECT id FROM jobs WHERE tenant=? AND request_key=?",
                                (principal.tenant, request_key))
            if prior is not None:
                return self.get(principal.tenant, prior["id"])
        spent = self.db.one(
            "SELECT COALESCE(SUM(cost), 0) AS c FROM jobs WHERE tenant=? "
            "AND created_at >= ?", (principal.tenant, _iso_hours_ago(24)))["c"]
        if principal.max_cost_per_day and spent >= principal.max_cost_per_day:
            raise QuotaExceeded(
                f"Tenant {principal.tenant} spent {spent:.2f} in the last 24 h "
                f"(daily budget {principal.max_cost_per_day:.2f})."
            )
        running = self.db.one(
            "SELECT COUNT(*) AS n FROM jobs WHERE tenant=? AND state IN ('queued','running')",
            (principal.tenant,),
        )["n"]
        if running >= principal.max_concurrent_jobs:
            raise QuotaExceeded(
                f"Tenant {principal.tenant} already has {running} active jobs "
                f"(limit {principal.max_concurrent_jobs})."
            )

        session_id = None
        if session_name:
            session_id = self._ensure_session(principal.tenant, session_name)

        cost_cap = min(
            max_cost if max_cost is not None else principal.max_cost_per_run,
            principal.max_cost_per_run,
        )
        config = {
            "mode": mode,
            "max_cost": cost_cap,
            "max_turns": max_turns if max_turns is not None else 15,
            "timeout_seconds": min(timeout_seconds, 900),
            "allow_writes": principal.allow_writes,
        }
        job_id = f"job-{uuid4().hex[:16]}"
        self.db.execute(
            "INSERT INTO jobs (id, tenant, session_id, state, prompt, config,"
            " request_key, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (job_id, principal.tenant, session_id, "queued", prompt,
             json.dumps(config), request_key or "", now(), now()),
        )
        if progress is not None:
            self._progress[job_id] = progress  # registered BEFORE enqueue: no race
        self._wakeup.put(job_id)
        return self.get(principal.tenant, job_id)

    def watch(self, job_id: str, callback) -> None:
        """Register a best-effort progress callback (stream events) for a job."""
        self._progress[job_id] = callback

    def get(self, tenant: str, job_id: str) -> dict:
        row = self.db.one("SELECT * FROM jobs WHERE id=? AND tenant=?", (job_id, tenant))
        if row is None:
            raise KeyError(job_id)
        return row_to_job(row)

    def list(self, tenant: str, limit: int = 50) -> list[dict]:
        rows = self.db.all(
            "SELECT * FROM jobs WHERE tenant=? ORDER BY created_at DESC LIMIT ?",
            (tenant, limit),
        )
        return [row_to_job(r) for r in rows]

    def cancel(self, tenant: str, job_id: str) -> dict:
        job = self.get(tenant, job_id)
        if job["state"] == "queued":
            self.db.execute(
                "UPDATE jobs SET state='cancelled', updated_at=? WHERE id=? AND state='queued'",
                (now(), job_id),
            )
        elif job["state"] == "running":
            # ACP runtime: the worker passed a cancel Event into the turn; setting
            # it sends session/cancel and the turn ends with stopReason cancelled.
            self._cancel_requested.add(job_id)
            event = self._cancels.get(job_id)
            if event is not None:
                event.set()
        return self.get(tenant, job_id)

    def _session_context(self, session_id: str, *, exclude_job_id: str,
                         turns: int = 4, chars: int = 1200) -> str:
        """Recent exchanges of a session, replayed as prompt context for
        fresh-task (read-only) turns."""
        rows = self.db.all(
            "SELECT prompt, output FROM jobs WHERE session_id=? AND id!=? "
            "AND state='completed' ORDER BY created_at DESC LIMIT ?",
            (session_id, exclude_job_id, turns),
        )
        if not rows:
            return ""
        lines = []
        for row in reversed(rows):
            lines.append(f"User: {row['prompt'][:chars]}")
            lines.append(f"You replied: {row['output'][:chars]}")
        return (
            "[Conversation so far, for context only:]\n"
            + "\n".join(lines)
            + "\n[End of context. Now answer the new message below.]\n\n"
        )

    def read_artifact(self, tenant: str, job_id: str, rel_path: str) -> bytes:
        """Bytes of one artifact recorded on a completed job (size-capped)."""
        job = self.get(tenant, job_id)
        if rel_path not in job["artifacts"]:
            raise KeyError(rel_path)
        session = None
        if job["session_id"]:
            row = self.db.one("SELECT name FROM sessions WHERE id=?", (job["session_id"],))
            session = row["name"] if row else None
        workspace = self.runtime.workspace(tenant).session_dir(session or f"job-{job_id}")
        target = (workspace / rel_path).resolve()
        if workspace.resolve() not in target.parents:
            raise ValueError("Artifact path escapes the workspace.")
        data = target.read_bytes()
        if len(data) > ARTIFACT_MAX_BYTES:
            raise ValueError(f"Artifact larger than {ARTIFACT_MAX_BYTES} bytes.")
        return data

    def get_session(self, tenant: str, name: str) -> dict | None:
        row = self.db.one("SELECT * FROM sessions WHERE tenant=? AND name=?", (tenant, name))
        return dict(row) if row else None

    # -- internals -----------------------------------------------------------

    def _ensure_session(self, tenant: str, name: str) -> str:
        existing = self.db.one(
            "SELECT id FROM sessions WHERE tenant=? AND name=?", (tenant, name)
        )
        if existing:
            return existing["id"]
        session_id = f"sess-{uuid4().hex[:16]}"
        self.db.execute(
            "INSERT INTO sessions (id, tenant, name, created_at, updated_at) VALUES (?,?,?,?,?)",
            (session_id, tenant, name, now(), now()),
        )
        return session_id

    def _claim(self, job_id: str) -> dict | None:
        with self.db.connect() as conn:
            cursor = conn.execute(
                "UPDATE jobs SET state='running', updated_at=? WHERE id=? AND state='queued'",
                (now(), job_id),
            )
            if cursor.rowcount != 1:
                return None
            row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return row_to_job(row)

    def _worker_loop(self) -> None:
        while not self._stop.is_set():
            try:
                job_id = self._wakeup.get(timeout=1.0)
            except queue.Empty:
                continue
            if not job_id or self._stop.is_set():
                continue
            job = self._claim(job_id)
            if job is None:
                continue
            try:
                self._execute(job)
            except Exception as exc:  # defensive: a worker must never die
                self.db.execute(
                    "UPDATE jobs SET state='failed', error=?, updated_at=? WHERE id=?",
                    (f"worker error: {exc}", now(), job["id"]),
                )

    def _execute(self, job: dict) -> None:
        cfg = job["config"]
        allow_writes = cfg.get("allow_writes", True)
        session_name = None
        resume = None
        if job["session_id"]:
            session = self.db.one("SELECT * FROM sessions WHERE id=?", (job["session_id"],))
            if session is not None:
                session_name = session["name"]
                resume = session["bob_task_id"] or None

        prompt = job["prompt"]
        native = getattr(self.runtime, "persistent_sessions", False)
        if not native:
            # run-based engine: restrictions ignored on resume → fresh task +
            # history replay for read-only turns (see run-variant comments).
            if not allow_writes:
                resume = None
            if resume is None and job["session_id"]:
                context = self._session_context(job["session_id"], exclude_job_id=job["id"])
                if context:
                    prompt = context + prompt

        disable_groups = () if (allow_writes or native) else self.readonly_disable_groups
        run_config = RunConfig(
            timeout_seconds=cfg.get("timeout_seconds", 300),
            max_cost=cfg.get("max_cost"),
            max_turns=cfg.get("max_turns"),
            mode=cfg.get("mode"),
            disable_tool_groups=disable_groups,
            allow_writes=allow_writes,
            disable_subagents=self.disable_subagents,
            disable_mcp=self.disable_mcp,
        )
        effective_session = session_name or f"job-{job['id']}"
        workspace_dir = self.runtime.prepare_workspace(job["tenant"], effective_session)
        before = _workspace_snapshot(workspace_dir)

        on_event = self._progress.pop(job["id"], None)
        cancel_event = threading.Event()
        extra: dict[str, Any] = {}
        if getattr(self.runtime, "supports_cancel", False):
            self._cancels[job["id"]] = cancel_event
            if job["id"] in self._cancel_requested:   # cancel landed before we registered
                cancel_event.set()
            extra["cancel"] = cancel_event
        if native and resume:
            # The runtime strips Bob's post-load history replay by matching it
            # against what this session already answered.
            rows = self.db.all("SELECT output FROM jobs WHERE session_id=? AND id!=? AND output != '' "
                               "ORDER BY created_at, rowid", (job["session_id"], job["id"]))
            extra["replay_of"] = [r["output"] for r in rows]
        started = time.monotonic()
        try:
            result = self.runtime.run(
                prompt,
                tenant=job["tenant"],
                session=effective_session,
                resume=resume,
                config=run_config,
                on_event=on_event,
                **extra,
            )
        finally:
            self._cancels.pop(job["id"], None)
            self._cancel_requested.discard(job["id"])

        artifacts = _changed_artifacts(before, _workspace_snapshot(workspace_dir))
        state = "completed" if result.ok else "failed"
        if cancel_event.is_set() and not result.ok:
            state = "cancelled"
        error = "" if result.ok else (
            "cancelled" if state == "cancelled"
            else f"timed out after {run_config.timeout_seconds}s" if result.timed_out
            else f"bob exited {result.exit_code}: {result.stderr[-500:]}"
        )
        raw = (result.stats.raw if result.stats else {}) or {}
        audit = {
            "tenant": job["tenant"], "job": job["id"], "session": job["session_id"],
            "allow_writes": allow_writes, "mode": cfg.get("mode"),
            "prompt_chars": len(prompt), "output_chars": raw.get("output_chars", len(result.text)),
            "duration_ms": int((time.monotonic() - started) * 1000),
            "stop_reason": raw.get("stop_reason", result.status),
            "state": state, "cost": result.stats.session_costs if result.stats else None,
            "tool_calls": result.stats.tool_calls if result.stats else None,
            "permissions": raw.get("permissions", []),
            "budget_exceeded": raw.get("budget_exceeded", ""),
            "artifacts": artifacts,
        }
        AUDIT.info(json.dumps(audit, sort_keys=True))
        self.db.execute(
            "UPDATE jobs SET state=?, output=?, error=?, bob_task_id=?, cost=?,"
            " exit_code=?, artifacts=?, audit=?, updated_at=? WHERE id=?",
            (state, result.text, error, result.task_id,
             result.stats.session_costs if result.stats else None,
             result.exit_code, json.dumps(artifacts), json.dumps(audit), now(), job["id"]),
        )
        # Only write-approved runs advance the session's native task pointer;
        # read-only fresh tasks are throwaways (memory comes from job history).
        if job["session_id"] and result.ok and result.task_id and (allow_writes or getattr(self.runtime, "persistent_sessions", False)):
            self.db.execute(
                "UPDATE sessions SET bob_task_id=?, updated_at=? WHERE id=?",
                (result.task_id, now(), job["session_id"]),
            )
