"""ACP-based Bob runtime: drives `bob acp` (official, bobshell >= 2.0.1).

Same public interface as the process-per-run runner (BobRuntime.run(...) ->
RunResult), different engine underneath:

- One long-lived `bob acp` process per (tenant, session) — the ACP session IS
  the conversation, so memory is native and continuous. No resume juggling,
  no transcript replay.
- Governance is PER ACTION, mid-run: Bob asks permission for each sensitive
  tool call via session/request_permission; our policy answers based on the
  turn's allow_writes and the toolCall.kind ("edit"/"execute" gated, reads and
  fetches allowed). This replaces --disable-tool-groups entirely and is immune
  to the restrictions-ignored-on-resume bug of `bob run`.
- Cost: ACP does not report spend (product gap). We read it from Bob's own
  session store (bob.db in the tenant HOME; ACP sessionId == task id there)
  and enforce config.max_cost by refusing further turns once exceeded.

Empirical protocol notes (validated against bobshell 2.0.1, 2026-09-03):
initialize(protocolVersion=1) -> agentCapabilities incl. loadSession, session
resume/list/delete/close; session/new{cwd,mcpServers} needs --trust for
non-interactive use; session/prompt returns {stopReason}; updates arrive as
session/update notifications (agent_message_chunk, tool_call,
tool_call_update, session_info_update...); permission options are
allow_once/allow_always/reject_once/reject_always.
"""

from __future__ import annotations

from collections import deque
import json
import logging
from pathlib import Path
import re
import shlex
import shutil
import sqlite3
import subprocess
import threading
import time
from typing import Any, Callable, Sequence

from .events import RunStats
from .runner import EXIT_TIMEOUT, RunConfig, RunResult, _terminate_group
from .workspace import TenantWorkspace

LOGGER = logging.getLogger("bob_runtime.acp")

# toolCall.kind values gated when a turn is not write-approved. `fetch` is
# gated too: an outbound request is how a prompt-injected turn exfiltrates.
GATED_KINDS = {"edit", "execute", "delete", "move", "fetch"}

# Even in a write-approved turn, some commands are never worth the risk: they
# read the process environment, Bob's own credential store, or move data off
# the box. Matched against the permission request's title and raw input.
DENIED_COMMAND_PATTERNS = (
    r"\bprintenv\b", r"(?<![\w./-])env\b(?!\s*=)", r"/proc/\S*/environ", r"\$\{?BOBSHELL_API_KEY",
    r"\.bob/(db|settings|credentials)", r"~/\.bob\b", r"\bcurl\b", r"\bwget\b", r"\bnc\b",
    r"\bncat\b", r"\bscp\b", r"\bsftp\b", r"\bssh\b", r"\brsync\b", r"/dev/tcp/",
    r"\bbase64\b.*(key|secret|token)", r"\bsudo\b", r"\bchmod\s+[0-7]*7[0-7]*\s+/",
)
_DENIED = [re.compile(p, re.I) for p in DENIED_COMMAND_PATTERNS]


def denied_command(tool_call: dict) -> str | None:
    """The first deny-list pattern that matches this tool call, or None."""
    kind = str(tool_call.get("kind") or "").lower()
    if kind not in ("execute", "other", ""):
        return None
    raw = tool_call.get("rawInput")
    haystack = str(tool_call.get("title") or "") + " " + (
        json.dumps(raw) if isinstance(raw, (dict, list)) else str(raw or ""))
    for pattern in _DENIED:
        if pattern.search(haystack):
            return pattern.pattern
    return None


def choose_option(options: list[dict], decision: str) -> str:
    """Map an allow/reject decision to the optionId Bob offered, by option
    KIND (allow_once / reject_once), never by guessing ids. Falls back to any
    option of the same family, then to the literal decision."""
    want = "allow_once" if decision == "allow" else "reject_once"
    for option in options or []:
        if option.get("kind") == want:
            return str(option.get("optionId", decision))
    for option in options or []:
        if str(option.get("kind", "")).startswith(decision):
            return str(option.get("optionId", decision))
    return decision


class _ReplayFilter:
    """Strips Bob's history replay out of the first prompt after session/load.

    Bob 2.0.4 replays the prior turns as user_message_chunk / agent_message_chunk
    pairs while answering the next prompt, with no marker before the new answer
    (verified 2026-09-24). The prior replies are known, the jobs layer stored
    them, so replayed agent text is matched against them and dropped; whatever
    follows the last match is the new answer. On any mismatch the filter stops
    and keeps the text: a leaked sentence beats a lost answer."""

    def __init__(self, prior_replies: Sequence[str]):
        self.prior = [p for p in prior_replies if p]
        self.index = 0
        self.buffer = ""
        self.active = False

    def user_chunk(self) -> None:
        if self.index < len(self.prior):
            self.active, self.buffer = True, ""

    def agent_chunk(self, text: str) -> str:
        """Return the part of `text` that is new output ("" while replaying)."""
        if not self.active:
            return text
        self.buffer += text
        target = self.prior[self.index]
        if target.startswith(self.buffer):
            if self.buffer == target:
                self._turn_done()
            return ""
        if self.buffer.startswith(target):      # the chunk crossed into the new answer
            rest = self.buffer[len(target):]
            self._turn_done()
            return rest
        kept, self.buffer = self.buffer, ""     # not what we stored: stop filtering
        self.active, self.index = False, len(self.prior)
        return kept

    def _turn_done(self) -> None:
        self.index += 1
        self.buffer, self.active = "", False


class _AcpProcess:
    """One `bob acp` process + its ACP session, with a JSON-RPC pump."""

    def __init__(self, command: list[str], cwd: Path, env: dict[str, str]):
        self.process = subprocess.Popen(
            command, cwd=cwd, env=env,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, bufsize=1,
            start_new_session=True,
        )
        self.session_id: str = ""
        self.stderr_tail: deque[str] = deque(maxlen=50)   # Bob's own diagnostics, last 50 lines
        threading.Thread(target=self._stderr_reader, daemon=True).start()
        self.cancelling = False              # set by cancel(); pending permissions answer "cancelled"
        self.turn_lock = threading.Lock()   # one prompt at a time per session
        self._io_lock = threading.Lock()
        self._responses: dict[int, dict] = {}
        self._next_id = 1
        # Per-turn hooks, set under turn_lock before each prompt:
        self.on_update: Callable[[dict], None] | None = None
        self.permission_policy: Callable[[dict], str] | None = None
        self.permission_log: list[dict] = []
        threading.Thread(target=self._reader, daemon=True).start()

    def alive(self) -> bool:
        return self.process.poll() is None

    def _send(self, obj: dict) -> None:
        with self._io_lock:
            assert self.process.stdin is not None
            self.process.stdin.write(json.dumps(obj) + "\n")
            self.process.stdin.flush()

    def request(self, method: str, params: dict) -> int:
        with self._io_lock:
            msg_id = self._next_id
            self._next_id += 1
        self._send({"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params})
        return msg_id

    def wait(self, msg_id: int, method: str, timeout: float) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if msg_id in self._responses:
                response = self._responses.pop(msg_id)
                if "error" in response:
                    raise RuntimeError(f"{method}: {response['error']}")
                return response.get("result", {})
            if not self.alive():
                raise RuntimeError(f"{method}: bob acp process died")
            time.sleep(0.02)
        raise TimeoutError(method)

    def rpc(self, method: str, params: dict, timeout: float = 120) -> dict:
        return self.wait(self.request(method, params), method, timeout)

    def cancel(self) -> None:
        """ACP `session/cancel`: a notification. Bob stops model and tool work
        and answers the in-flight prompt with stopReason `cancelled`; from now
        on any pending permission request is answered `cancelled` (spec)."""
        self.cancelling = True
        try:
            self._send({"jsonrpc": "2.0", "method": "session/cancel",
                        "params": {"sessionId": self.session_id}})
        except Exception:
            pass

    def _stderr_reader(self) -> None:
        assert self.process.stderr is not None
        for line in self.process.stderr:
            line = line.rstrip()
            if line:
                self.stderr_tail.append(line)
                LOGGER.warning("bob acp stderr: %s", line)

    def _reader(self) -> None:
        assert self.process.stdout is not None
        for line in self.process.stdout:
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "id" in msg and ("result" in msg or "error" in msg):
                self._responses[msg["id"]] = msg
            elif "id" in msg and "method" in msg:
                self._handle_agent_request(msg)
            elif msg.get("method") == "session/update":
                handler = self.on_update
                if handler is not None:
                    try:
                        handler((msg.get("params") or {}).get("update") or {})
                    except Exception:
                        pass

    def _handle_agent_request(self, msg: dict) -> None:
        method = msg.get("method", "")
        params = msg.get("params") or {}
        if method == "session/request_permission":
            tool = params.get("toolCall") or {}
            if self.cancelling:
                self.permission_log.append({"tool": tool.get("title", ""), "kind": tool.get("kind", ""),
                                            "decision": "cancelled", "optionId": ""})
                self._send({"jsonrpc": "2.0", "id": msg["id"],
                            "result": {"outcome": {"outcome": "cancelled"}}})
                return
            policy = self.permission_policy
            decision = policy(params) if policy else "reject"
            option_id = choose_option(params.get("options") or [], decision)
            self.permission_log.append(
                {"tool": tool.get("title", ""), "kind": tool.get("kind", ""),
                 "decision": decision, "optionId": option_id})
            self._send({"jsonrpc": "2.0", "id": msg["id"],
                        "result": {"outcome": {"outcome": "selected", "optionId": option_id}}})
        else:
            self._send({"jsonrpc": "2.0", "id": msg["id"],
                        "error": {"code": -32601, "message": "unsupported by this client"}})

    def terminate(self) -> None:
        _terminate_group(self.process)


class AcpBobRuntime:
    """Drop-in replacement for the run-based BobRuntime, powered by ACP."""

    persistent_sessions = True  # jobs layer: skip context replay, sessions are native
    supports_cancel = True      # jobs layer: run(cancel=Event) stops a turn mid-flight

    def __init__(
        self,
        root: Path | str,
        bob_bin: str = "bob",
        *,
        seed_dir: Path | str | None = None,
        max_sessions: int = 24,
        **_ignored,  # lock_retries etc. from the run-based signature
    ):
        self.root = Path(root)
        self.bob_bin = bob_bin
        self.seed_dir = Path(seed_dir) if seed_dir else None
        self.max_sessions = max_sessions
        self.idle_timeout = 900.0  # seconds
        self.cancel_grace_seconds = 10.0  # wait for stopReason=cancelled before killing
        self._sessions: dict[tuple[str, str], _AcpProcess] = {}
        self._sessions_lock = threading.Lock()
        self._agent_can_load = False
        self._reaper = threading.Thread(target=self._reap_loop, daemon=True)
        self._reaper.start()

    # -- workspace plumbing (same layout as the run-based runtime) -----------

    def workspace(self, tenant: str) -> TenantWorkspace:
        return TenantWorkspace(self.root, tenant)

    # Bob's user settings for a tenant HOME. Auto-update is ON by default in
    # Bob Shell 2.0.x and the check runs at startup: in a container with a
    # pinned version that means drift, and under an egress policy, startup
    # noise. Written once per tenant home; never overwrites an existing file.
    TENANT_SETTINGS = {"bobShell": {"autoUpdate": False}}

    def prepare_workspace(self, tenant: str, session: str) -> Path:
        workspace = self.workspace(tenant)
        project = workspace.ensure(session)
        settings = workspace.home / ".bob" / "settings" / "settings.json"
        if not settings.exists():
            settings.parent.mkdir(parents=True, exist_ok=True)
            settings.write_text(json.dumps(self.TENANT_SETTINGS, indent=2) + "\n")
        if self.seed_dir is not None and self.seed_dir.is_dir():
            if not (project / ".bob").exists():
                shutil.copytree(self.seed_dir, project, dirs_exist_ok=True)
        return project

    # -- session management ---------------------------------------------------

    def _get_session(self, tenant: str, session: str, config: RunConfig,
                     resume: str | None = None) -> _AcpProcess:
        key = (tenant, session)
        with self._sessions_lock:
            existing = self._sessions.get(key)
            if existing is not None and existing.alive():
                return existing
            if len(self._sessions) >= self.max_sessions:
                # Evict the oldest dead-or-idle entry; simplest viable policy.
                for old_key, old in list(self._sessions.items()):
                    if not old.alive():
                        del self._sessions[old_key]
                if len(self._sessions) >= self.max_sessions:
                    victim_key, victim = next(iter(self._sessions.items()))
                    victim.terminate()
                    del self._sessions[victim_key]

            project = self.prepare_workspace(tenant, session)
            env = self.workspace(tenant).env()
            # --accept-license: acceptance is per-account and blocks session/new
            # for accounts that never accepted interactively (no-op otherwise).
            command = shlex.split(self.bob_bin) + ["acp", "--trust", "--accept-license",
                                                   "--log-level", "warn"]
            if config.disable_subagents:
                command.append("--disable-subagents")
            if config.disable_mcp:
                command.append("--disable-mcp")
            acp = _AcpProcess(command, project, env)
            init = acp.rpc("initialize", {
                "protocolVersion": 1,
                "clientCapabilities": {"fs": {"readTextFile": False, "writeTextFile": False}},
            }, timeout=60)
            self._agent_can_load = bool((init.get("agentCapabilities") or {}).get("loadSession"))
            # A previous ACP session for this conversation (its id is Bob's task
            # id, kept by the jobs layer) is re-attached with session/load: Bob
            # replays the history as session/update notifications, so memory
            # survives idle reaping and pod replacement (given a persistent
            # tenant home). Falls back to a fresh session if Bob cannot load it.
            result: dict = {}
            acp.loaded = False
            if resume and self._agent_can_load:
                try:
                    result = acp.rpc("session/load", {"sessionId": resume, "cwd": str(project),
                                                      "mcpServers": []}, timeout=90)
                    result.setdefault("sessionId", resume)
                    # Bob 2.0.4 replays the history during the NEXT session/prompt,
                    # not before answering session/load (verified 2026-09-24); the
                    # first turn on this process strips it, see _ReplayFilter.
                    acp.loaded = True
                except (RuntimeError, TimeoutError) as exc:
                    LOGGER.warning("session/load of %s failed (%s); starting fresh", resume, exc)
                    result = {}
            if not result.get("sessionId"):
                result = acp.rpc("session/new", {"cwd": str(project), "mcpServers": []}, timeout=90)
            acp.session_id = result.get("sessionId", "")
            modes = (result.get("modes") or {})
            acp.available_modes = [m.get("id") for m in modes.get("availableModes", [])]
            if config.mode and config.mode in acp.available_modes \
                    and modes.get("currentModeId") != config.mode:
                try:
                    acp.rpc("session/set_mode",
                            {"sessionId": acp.session_id, "modeId": config.mode}, timeout=30)
                except Exception:
                    pass  # mode is an enhancement, not a hard dependency
            acp.last_used = time.monotonic()
            self._sessions[key] = acp
            return acp

    # -- cost metering via Bob's own store ------------------------------------

    def _session_cost(self, tenant: str, session_id: str) -> float | None:
        db_path = self.workspace(tenant).home / ".bob" / "db" / "bob.db"
        if not db_path.is_file() or not session_id:
            return None
        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            row = conn.execute("SELECT costs FROM tasks WHERE id=?", (session_id,)).fetchone()
            conn.close()
            if row and row[0]:
                costs = json.loads(row[0])
                for key in ("total", "totalCost", "total_cost", "cost"):
                    if isinstance(costs, dict) and isinstance(costs.get(key), (int, float)):
                        return float(costs[key])
                if isinstance(costs, (int, float)):
                    return float(costs)
        except Exception:
            return None
        return None

    # -- the run interface ----------------------------------------------------

    def run(
        self,
        prompt: str,
        *,
        tenant: str,
        session: str,
        resume: str | None = None,   # previous ACP session id → session/load after a reap/restart
        config: RunConfig = RunConfig(),
        on_event: Callable[[dict[str, Any]], None] | None = None,
        env_overrides: dict[str, str] | None = None,
        cancel: threading.Event | None = None,
        replay_of: Sequence[str] | None = None,   # prior replies in this session, for the post-load replay
    ) -> RunResult:
        allow_writes = getattr(config, "allow_writes", True) and not config.disable_tool_groups
        gated = set(config.gated_kinds) if config.gated_kinds is not None else GATED_KINDS
        acp = self._get_session(tenant, session, config, resume)
        acp.last_used = time.monotonic()
        acp.cancelling = False
        replay = _ReplayFilter(replay_of or ()) if getattr(acp, "loaded", False) else None
        acp.loaded = False                       # the replay comes once, on this first prompt

        with acp.turn_lock:
            # Budget gate BEFORE spending more.
            spent = self._session_cost(tenant, acp.session_id)
            if config.max_cost is not None and spent is not None and spent >= config.max_cost:
                return RunResult(
                    task_id=acp.session_id, status="failed", text="",
                    exit_code=1, timed_out=False, stats=None,
                    stderr=f"session budget exhausted (${spent:.2f} >= ${config.max_cost:.2f})",
                    events=[])

            chunks: list[str] = []
            events: list[dict] = []
            budget = {"tool_calls": 0, "output_chars": 0, "exceeded": ""}
            done = threading.Event()

            def cancel_turn(reason: str) -> None:
                if not acp.cancelling:
                    budget["exceeded"] = budget["exceeded"] or reason
                    acp.cancel()

            def handle_update(update: dict) -> None:
                events.append(update)
                kind = update.get("sessionUpdate")
                if kind == "user_message_chunk" and replay is not None:
                    replay.user_chunk()
                    return
                if kind == "agent_message_chunk":
                    text = (update.get("content") or {}).get("text", "")
                    if replay is not None:
                        text = replay.agent_chunk(text)
                        if not text:
                            return
                    chunks.append(text)
                    budget["output_chars"] += len(text)
                    if config.max_output_chars and budget["output_chars"] > config.max_output_chars:
                        cancel_turn("output budget exhausted")
                    if on_event is not None:
                        on_event({"type": "message", "role": "assistant", "content": text})
                elif kind == "tool_call" and on_event is not None:
                    on_event({"type": "tool_event",
                              "title": update.get("title", ""),
                              "kind": update.get("kind", "")})

            def policy(params: dict) -> str:
                budget["tool_calls"] += 1
                if config.max_tool_calls and budget["tool_calls"] > config.max_tool_calls:
                    budget["exceeded"] = budget["exceeded"] or "tool-call budget exhausted"
                    return "reject"
                tool_call = params.get("toolCall") or {}
                tool_kind = (tool_call.get("kind") or "").lower()
                if tool_kind in gated and not allow_writes:
                    return "reject"
                if config.command_denylist and denied_command(tool_call):
                    budget["denied"] = budget.get("denied", 0) + 1
                    return "reject"
                return "allow"

            def watch_cancel() -> None:
                while not done.is_set():
                    if cancel is not None and cancel.wait(0.05):
                        cancel_turn("cancelled by caller")
                        return
                    if cancel is None:
                        done.wait(0.5)

            acp.on_update = handle_update
            acp.permission_policy = policy
            acp.permission_log = []
            timed_out = False
            status: str | None = "success"
            stderr = ""
            if cancel is not None and cancel.is_set():
                # Cancelled before the prompt went out: nothing to cancel in Bob.
                acp.on_update = None
                acp.permission_policy = None
                return RunResult(task_id=acp.session_id, status="cancelled", text="",
                                 exit_code=1, timed_out=False, stats=None,
                                 stderr="cancelled by caller", events=[])
            try:
                msg_id = acp.request(
                    "session/prompt",
                    {"sessionId": acp.session_id,
                     "prompt": [{"type": "text", "text": prompt}]})
                # The watcher starts only now: a session/cancel sent before the
                # prompt would be ignored by Bob (nothing in flight) and lost.
                threading.Thread(target=watch_cancel, daemon=True).start()
                try:
                    result = acp.wait(msg_id, "session/prompt", config.timeout_seconds)
                except TimeoutError:
                    # Ask nicely first (spec: cancel → stopReason cancelled), then kill.
                    cancel_turn(f"timed out after {config.timeout_seconds}s")
                    result = acp.wait(msg_id, "session/prompt", self.cancel_grace_seconds)
                stop = result.get("stopReason", "")
                if stop not in ("end_turn", "max_turn_requests", ""):
                    status = stop
                if budget["exceeded"]:
                    stderr = budget["exceeded"]
                    if stop == "cancelled" and budget["exceeded"].startswith("timed out"):
                        timed_out = True
                        status = "failed"
            except TimeoutError:
                timed_out = True
                status = "failed"
                stderr = f"timed out after {config.timeout_seconds}s"
                acp.terminate()
                with self._sessions_lock:
                    self._sessions.pop((tenant, session), None)
            except RuntimeError as exc:
                status = "failed"
                stderr = str(exc)
            finally:
                done.set()
                if status != "success" and acp.stderr_tail:
                    stderr = (stderr + "\n" if stderr else "") + "bob: " + " | ".join(acp.stderr_tail)
                acp.on_update = None
                acp.permission_policy = None

            cost = self._session_cost(tenant, acp.session_id)
            stats = RunStats(task_id=acp.session_id, session_costs=cost,
                             tool_calls=len(acp.permission_log) or None,
                             raw={"permissions": acp.permission_log,
                                  "stop_reason": status if status != "success" else "end_turn",
                                  "output_chars": budget["output_chars"],
                                  "budget_exceeded": budget["exceeded"],
                                  "denied_commands": budget.get("denied", 0)})
            return RunResult(
                task_id=acp.session_id,
                status=status,
                text="".join(chunks),
                exit_code=0 if status == "success" else (EXIT_TIMEOUT if timed_out else 1),
                timed_out=timed_out,
                stats=stats,
                stderr=stderr,
                events=events,
            )

    def _reap_loop(self) -> None:
        while True:
            time.sleep(60)
            now = time.monotonic()
            with self._sessions_lock:
                for key, acp in list(self._sessions.items()):
                    idle = now - getattr(acp, "last_used", now)
                    if not acp.alive() or idle > self.idle_timeout:
                        acp.terminate()
                        del self._sessions[key]

    def shutdown(self) -> None:
        with self._sessions_lock:
            for acp in self._sessions.values():
                acp.terminate()
            self._sessions.clear()
