"""One-at-a-time evaluation jobs run in a child process, with live log streaming and cached results."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncIterator

from . import config, results

log = logging.getLogger("agentops_d1.jobs")

KINDS = {f"{k}_{v}": (k, v) for k in ("evaluate", "rubric", "redteam") for v in ("v1", "v2")}
_ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
_NOISE = ("hashlib", "blake2", "Traceback (most recent", 'File "', "globals()", "return __get",
          "raise ValueError('unsupported hash", "ValueError: unsupported hash", "^^^^", "Default provider set to",
          "USE_GATEWAY_MODEL_PROVIDER", ":ibm_watsonx_orchestrate", ":agentops", "UserWarning", "warnings.warn",
          "site-packages")


def scrub(line: str) -> str:
    """Remove local paths and the instance address from text shown to visitors."""
    line = line.replace(str(config.RUN_ROOT), "runs").replace(str(config.ROOT), ".")
    if config.WXO_INSTANCE_URL:
        line = line.replace(config.WXO_INSTANCE_URL, "<instance>")
    return line


@dataclass
class Job:
    id: str
    kind: str
    started: float = field(default_factory=time.time)
    finished: float | None = None
    status: str = "running"            # running | done | failed
    lines: list[str] = field(default_factory=list)
    result: dict | None = None
    error: str | None = None
    _waiters: list[asyncio.Queue] = field(default_factory=list)

    def publish(self, event: dict) -> None:
        for q in list(self._waiters):
            q.put_nowait(event)

    def public(self) -> dict:
        return {"job_id": self.id, "kind": self.kind, "status": self.status, "started": self.started,
                "finished": self.finished, "error": self.error}


class JobManager:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.current: Job | None = None
        self.latest: dict[str, dict] = {}       # kind -> result (+ completed_at)
        self.last_start = 0.0
        self.analyze_cache: dict[str, str] = {}
        config.RUN_ROOT.mkdir(parents=True, exist_ok=True)
        self._load_latest()

    # -- persistence ---------------------------------------------------------
    def _latest_file(self) -> Path:
        return config.RUN_ROOT / "latest.json"

    def _load_latest(self) -> None:
        try:
            self.latest = json.loads(self._latest_file().read_text())
        except (OSError, json.JSONDecodeError):
            self.latest = {}

    def _save_latest(self) -> None:
        self._latest_file().write_text(json.dumps(self.latest))

    def _prune(self, keep: int = 24) -> None:
        runs = sorted((p for p in config.RUN_ROOT.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime)
        for p in runs[:-keep]:
            shutil.rmtree(p, ignore_errors=True)

    # -- API -----------------------------------------------------------------
    def fresh_result(self, kind: str) -> dict | None:
        res = self.latest.get(kind)
        if res and time.time() - res.get("completed_at", 0) < config.RESULT_FRESH_S:
            return res
        return None

    def start(self, kind: str, force: bool = False) -> tuple[Job | None, dict | None, str | None]:
        """Returns (job, cached_result, refusal_reason)."""
        if kind not in KINDS:
            return None, None, "unknown job kind"
        if self.current and self.current.status == "running":
            if self.current.kind == kind:
                return self.current, None, None           # attach to the run in progress
            return None, None, "another evaluation is running; try again in a minute"
        if not force and (cached := self.fresh_result(kind)):
            return None, cached, None
        if time.time() - self.last_start < config.JOB_START_COOLDOWN_S:
            return None, None, "please wait a few seconds between runs"
        hour_ago = time.time() - 3600
        recent = [j for j in self.jobs.values() if j.started > hour_ago]
        if len(recent) >= config.JOBS_PER_HOUR:
            return None, None, "the hourly budget for live evaluations is used up; cached results stay available"
        job = Job(id=uuid.uuid4().hex[:12], kind=kind)
        self.jobs[job.id] = job
        self.current = job
        self.last_start = time.time()
        asyncio.get_running_loop().create_task(self._run(job))
        return job, None, None

    async def stream(self, job: Job) -> AsyncIterator[dict]:
        q: asyncio.Queue = asyncio.Queue()
        job._waiters.append(q)
        try:
            for line in job.lines:                     # replay what was already printed
                yield {"line": line}
            if job.status != "running":
                yield {"done": True, "status": job.status, "error": job.error}
                return
            while True:
                event = await q.get()
                yield event
                if event.get("done"):
                    return
        finally:
            if q in job._waiters:
                job._waiters.remove(q)

    # -- execution -------------------------------------------------------------
    async def _run(self, job: Job) -> None:
        base, version = KINDS[job.kind]
        parser = {"evaluate": results.parse_evaluate, "rubric": results.parse_rubric,
                  "redteam": results.parse_redteam}[base]
        try:
            res = None
            for attempt in (1, 2):                     # one automatic retry: a single failed conversation aborts a run
                out = config.RUN_ROOT / f"{job.kind}-{time.strftime('%Y%m%d-%H%M%S')}-{job.id}-{attempt}"
                out.mkdir(parents=True)
                job_file = out / "job.json"
                job_file.write_text(json.dumps({"kind": base, "version": version, "output_dir": str(out)}))
                code = await self._spawn(job, ["-m", "app.runner", str(job_file)])
                (out / "job.log").write_text("\n".join(job.lines))
                if code == 0:
                    try:
                        res = parser(out, version)
                        break
                    except Exception:  # noqa: BLE001
                        log.exception("could not parse results of %s", out)
                if code == -1:
                    break                              # timed out: do not retry
                msg = "[retry] the run did not complete; starting it again" if attempt == 1 else "[error] the run did not complete"
                job.lines.append(msg)
                job.publish({"line": msg})
            if res is None:
                raise RuntimeError("runner failed")
            res["completed_at"] = time.time()
            res["duration_s"] = round(res["completed_at"] - job.started, 1)
            res["job_id"] = job.id
            job.result = res
            job.status = "done"
            self.latest[job.kind] = res
            self._save_latest()
            self._prune()
        except Exception as exc:  # noqa: BLE001 - surfaced to the browser as a generic message
            log.exception("job %s failed", job.id)
            job.status = "failed"
            job.error = "The evaluation did not complete. Please try again."
            job.lines.append(f"[error] {type(exc).__name__}")
        finally:
            job.finished = time.time()
            job.publish({"done": True, "status": job.status, "error": job.error})

    async def _spawn(self, job: Job, args: list[str]) -> int:
        # Private HOME: the framework writes ~/.config/orchestrate and ~/.cache/orchestrate on start-up.
        home = config.RUN_ROOT / "home"
        home.mkdir(parents=True, exist_ok=True)
        env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(home), "COLUMNS": "150",
               "PYTHONUNBUFFERED": "1", "WXO_INSTANCE_URL": config.WXO_INSTANCE_URL,
               "WXO_API_KEY": config.WXO_API_KEY, "WXO_ENV_NAME": config.WXO_ENV_NAME,
               "RUN_ROOT": str(config.RUN_ROOT)}
        proc = await asyncio.create_subprocess_exec(
            sys.executable, *args, cwd=str(config.ROOT), env=env,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        assert proc.stdout is not None
        try:
            async with asyncio.timeout(config.JOB_TIMEOUT_S):
                async for raw in proc.stdout:
                    line = _ANSI.sub("", raw.decode(errors="replace")).rstrip()
                    if not line or any(n in line for n in _NOISE):
                        continue
                    line = scrub(line)
                    if len(job.lines) < 4000:
                        job.lines.append(line)
                    job.publish({"line": line})
                return await proc.wait()
        except TimeoutError:
            proc.kill()
            job.lines.append("[error] timed out")
            return -1

    async def analyze(self, kind: str) -> str:
        """Run the framework's `analyze` on the latest result of an evaluate kind; returns captured text."""
        res = self.latest.get(kind)
        if not res or not kind.startswith("evaluate"):
            raise LookupError("no evaluation result to analyze")
        key = res["run_dir"]
        if key in self.analyze_cache:
            return self.analyze_cache[key]
        job = Job(id=uuid.uuid4().hex[:12], kind=f"analyze_{kind}")
        job_file = Path(res["run_dir"]).parent / "analyze.json"
        job_file.write_text(json.dumps({"kind": "analyze", "data_path": res["run_dir"], "output_dir": str(job_file.parent)}))
        code = await self._spawn(job, ["-m", "app.runner", str(job_file)])
        text = scrub("\n".join(job.lines))
        if code == 0:
            self.analyze_cache[key] = text
        return text
