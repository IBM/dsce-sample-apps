"""Spawn and supervise `bob run` processes.

This module is the ONLY place that builds Bob CLI invocations. Everything
above it (job service, sessions, MCP endpoint) depends on this interface, so a
Bob release change is absorbed here.

Validated against bobshell 2.0.1 (docs/bob-shell-behavior.md):
- `bob run --accept-license -f stream-json -w <dir> [--trust] [--resume id] …`
- result event carries stats.task_id → returned for later resume
- headless runs auto-approve tool actions: safety is imposed HERE via
  RunConfig (tool-group disabling, cost/turn caps) and workspace isolation
- simultaneous task creation in one tenant HOME can fail with
  "database is locked" → bounded retry with jitter
"""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import random
import shlex
import shutil
import signal
import subprocess
import threading
import time
from typing import Any, Callable

from .events import RunStats, StreamState
from .workspace import TenantWorkspace

_DB_LOCKED_MARKER = "database is locked"
EXIT_TIMEOUT = 124


@dataclass(frozen=True)
class RunConfig:
    """Server-imposed limits for one run. Defaults are deliberately cautious."""

    timeout_seconds: int = 300
    max_cost: float | None = 0.50          # dollars, enforced by Bob
    max_turns: int | None = 15
    mode: str | None = None                # built-in or custom mode slug (skills)
    trust: bool = True                     # headless auto-approves anyway; --trust
                                           # silences the trust prompt path
    disable_tool_groups: tuple[str, ...] = ()  # unused by ACP runtime
    allow_writes: bool = True
    disable_mcp: bool = False
    disable_subagents: bool = False
    extra_args: tuple[str, ...] = ()       # escape hatch for new CLI flags
    # ACP-only per-turn budgets (ACP has no --max-turns / cost cap of its own):
    max_tool_calls: int | None = 40        # permission requests answered per turn
    max_output_chars: int | None = 200_000 # streamed text per turn before cancel
    gated_kinds: tuple[str, ...] | None = None  # override GATED_KINDS per turn
    command_denylist: bool = True          # refuse exfiltration-shaped commands even when approved


@dataclass
class RunResult:
    task_id: str
    status: str | None
    text: str
    exit_code: int
    timed_out: bool
    stats: RunStats | None
    stderr: str
    events: list[dict[str, Any]]
    attempts: int = 1

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and self.status == "success"


class BobRuntime:
    def __init__(
        self,
        root: Path | str,
        bob_bin: str = "bob",
        *,
        seed_dir: Path | str | None = None,
        lock_retries: int = 3,
        lock_backoff_seconds: float = 0.5,
    ):
        self.root = Path(root)
        self.bob_bin = bob_bin
        # Optional template copied into each NEW session workspace (e.g. a
        # .bob directory carrying custom modes, skills, and MCP config).
        self.seed_dir = Path(seed_dir) if seed_dir else None
        self.lock_retries = lock_retries
        self.lock_backoff_seconds = lock_backoff_seconds

    def workspace(self, tenant: str) -> TenantWorkspace:
        return TenantWorkspace(self.root, tenant)

    def prepare_workspace(self, tenant: str, session: str) -> Path:
        """Ensure the session workspace exists and is seeded. Idempotent —
        callers may invoke it before run() (e.g. to snapshot pre-run state
        without counting seed files as run artifacts)."""
        project = self.workspace(tenant).ensure(session)
        if self.seed_dir is not None and self.seed_dir.is_dir():
            if not (project / ".bob").exists():
                shutil.copytree(self.seed_dir, project, dirs_exist_ok=True)
        return project

    def build_command(
        self, prompt: str, *, workspace_dir: Path, resume: str | None, config: RunConfig
    ) -> list[str]:
        cmd = shlex.split(self.bob_bin) + [
            "run",
            "--accept-license",
            "-f",
            "stream-json",
            "-w",
            str(workspace_dir),
        ]
        if config.trust:
            cmd.append("--trust")
        if config.mode:
            cmd += ["--mode", config.mode]
        if config.max_cost is not None:
            cmd += ["--max-cost", str(config.max_cost)]
        if config.max_turns is not None:
            cmd += ["--max-turns", str(config.max_turns)]
        if config.disable_tool_groups:
            cmd += ["--disable-tool-groups", ",".join(config.disable_tool_groups)]
        if config.disable_mcp:
            cmd.append("--disable-mcp")
        if config.disable_subagents:
            cmd.append("--disable-subagents")
        if resume:
            cmd += ["--resume", resume]
        cmd += list(config.extra_args)
        cmd.append(prompt)
        return cmd

    def run(
        self,
        prompt: str,
        *,
        tenant: str,
        session: str,
        resume: str | None = None,
        config: RunConfig = RunConfig(),
        on_event: Callable[[dict[str, Any]], None] | None = None,
        env_overrides: dict[str, str] | None = None,
    ) -> RunResult:
        """Execute one Bob turn; blocking. Returns the assembled result.

        `resume` is the task_id from a previous RunResult in the SAME
        (tenant, session); pass None to start a new conversation.
        """
        project = self.prepare_workspace(tenant, session)
        env = self.workspace(tenant).env()
        if env_overrides:
            env.update(env_overrides)

        attempts = 0
        while True:
            attempts += 1
            result = self._run_once(prompt, project, env, resume, config, on_event)
            result.attempts = attempts
            lock_hit = (
                not result.ok
                and result.stats is None
                and _DB_LOCKED_MARKER in result.stderr.lower()
            )
            if lock_hit and attempts <= self.lock_retries:
                time.sleep(self.lock_backoff_seconds * attempts * (0.5 + random.random()))
                continue
            return result

    def _run_once(
        self,
        prompt: str,
        project: Path,
        env: dict[str, str],
        resume: str | None,
        config: RunConfig,
        on_event: Callable[[dict[str, Any]], None] | None,
    ) -> RunResult:
        cmd = self.build_command(prompt, workspace_dir=project, resume=resume, config=config)
        state = StreamState()
        stderr_parts: list[str] = []
        timed_out = False

        process = subprocess.Popen(
            cmd,
            cwd=project,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            start_new_session=True,  # own process group → clean kill of children
        )

        def _kill() -> None:
            nonlocal timed_out
            timed_out = True
            _terminate_group(process)

        watchdog = threading.Timer(config.timeout_seconds, _kill)
        watchdog.daemon = True
        watchdog.start()

        stderr_thread = threading.Thread(
            target=lambda: stderr_parts.append(process.stderr.read() if process.stderr else ""),
            daemon=True,
        )
        stderr_thread.start()

        try:
            assert process.stdout is not None
            for line in process.stdout:
                event = state.consume(line)
                if event is not None and on_event is not None:
                    on_event(event)
        finally:
            watchdog.cancel()
            process.wait()
            stderr_thread.join(timeout=5)

        exit_code = EXIT_TIMEOUT if timed_out else process.returncode
        return RunResult(
            task_id=state.task_id,
            status=state.status,
            text=state.assistant_text,
            exit_code=exit_code,
            timed_out=timed_out,
            stats=state.stats,
            stderr="".join(stderr_parts),
            events=state.events,
        )


def _terminate_group(process: subprocess.Popen, grace_seconds: float = 3.0) -> None:
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        return
    deadline = time.monotonic() + grace_seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return
        time.sleep(0.1)
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass
