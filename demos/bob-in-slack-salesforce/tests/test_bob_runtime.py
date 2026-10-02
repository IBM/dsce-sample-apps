"""Unit tests for bob_runtime against the fake Bob CLI (no credentials needed)."""

import json
from pathlib import Path
import sys
import time

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from bob_runtime.runner import BobRuntime  # run-based engine, kept for reference  # noqa: E402
from bob_runtime import RunConfig, StreamState  # noqa: E402

import shlex  # noqa: E402

FAKE_BOB = f"{shlex.quote(sys.executable)} {shlex.quote(str(Path(__file__).parent / 'fake_bob.py'))}"


@pytest.fixture()
def runtime(tmp_path):
    return BobRuntime(root=tmp_path / "workspace", bob_bin=FAKE_BOB, lock_backoff_seconds=0.01)


# --- events.py -------------------------------------------------------------

def test_stream_state_assembles_chunks_and_stats():
    state = StreamState()
    state.consume('{"type":"message","role":"user","content":"hi"}')
    state.consume('{"type":"message","role":"assistant","content":"AZURE"}')
    state.consume('{"type":"message","role":"assistant","content":"-FALCON-42"}')
    state.consume(
        '{"type":"result","status":"success","stats":{"task_id":"abc12345",'
        '"duration_ms":1500,"session_costs":0.015,"max_cost":0,"tool_calls":1}}'
    )
    assert state.assistant_text == "AZURE-FALCON-42"
    assert state.status == "success"
    assert state.task_id == "abc12345"
    assert state.stats.session_costs == 0.015
    assert state.stats.tool_calls == 1


def test_stream_state_keeps_noise_and_unknown_events():
    state = StreamState()
    state.consume("Some banner line")
    state.consume('{"type":"totally_new_event","data":1}')
    state.consume("{broken json")
    assert state.diagnostics == ["Some banner line", "{broken json"]
    assert state.events == [{"type": "totally_new_event", "data": 1}]


# --- workspace.py ----------------------------------------------------------

def test_workspace_layout_and_env(runtime, tmp_path):
    ws = runtime.workspace("acme")
    project = ws.ensure("thread-1")
    assert project == tmp_path / "workspace" / "tenants" / "acme" / "sessions" / "thread-1"
    assert ws.home.is_dir() and project.is_dir()
    assert ws.env({"PATH": "/bin"})["HOME"] == str(ws.home)


def test_bob_env_is_an_allowlist(runtime):
    """Service secrets never reach the Bob process; only Bob's needs cross over."""
    ws = runtime.workspace("acme")
    source = {
        "PATH": "/bin", "BOBSHELL_API_KEY": "bob-key", "HTTPS_PROXY": "http://p:3128",
        "HB_SLACK_BOT_TOKEN": "xoxb-secret", "HB_SF_PRIVATE_KEY_B64": "cert",
        "HB_EXPORT_KEY": "export", "AWS_SECRET_ACCESS_KEY": "aws", "HOME": "/root",
        "HB_BOB_ENV_EXTRA": "MY_TOOL_TOKEN, VENDOR_*", "MY_TOOL_TOKEN": "t",
        "VENDOR_A": "1", "VENDOR_B": "2", "VENDORX": "no",
    }
    env = ws.env(source)
    assert env["HOME"] == str(ws.home)                       # pinned, never the caller's
    assert env["PATH"] == "/bin" and env["BOBSHELL_API_KEY"] == "bob-key"
    assert env["HTTPS_PROXY"] == "http://p:3128"
    assert env["MY_TOOL_TOKEN"] == "t" and env["VENDOR_A"] == "1" and env["VENDOR_B"] == "2"
    for secret in ("HB_SLACK_BOT_TOKEN", "HB_SF_PRIVATE_KEY_B64", "HB_EXPORT_KEY",
                   "AWS_SECRET_ACCESS_KEY", "VENDORX", "HB_BOB_ENV_EXTRA"):
        assert secret not in env


@pytest.mark.parametrize("bad", ["../etc", "a/b", "", ".hidden~", "x" * 65])
def test_workspace_rejects_unsafe_names(runtime, bad):
    with pytest.raises(ValueError):
        runtime.workspace("acme").session_dir(bad)
    with pytest.raises(ValueError):
        runtime.workspace(bad)


# --- runner.py -------------------------------------------------------------

def test_run_happy_path(runtime):
    result = runtime.run("hello", tenant="acme", session="s1")
    assert result.ok
    assert result.text == "FAKE-OK"
    assert result.task_id == "task-fake-0001"
    assert result.stats.session_costs == 0.001
    assert result.attempts == 1


def test_run_resume_passes_task_id(runtime):
    result = runtime.run("again", tenant="acme", session="s1", resume="task-77")
    assert result.ok
    assert result.text == "RESUMED:task-77"
    assert result.task_id == "task-77"


def test_command_includes_safety_flags(runtime, tmp_path):
    argv_file = tmp_path / "argv.json"
    config = RunConfig(
        max_cost=0.25,
        max_turns=5,
        mode="ibm-cloud",
        disable_tool_groups=("subagent", "mcp"),
        disable_mcp=True,
        disable_subagents=True,
    )
    result = runtime.run(
        "hi", tenant="acme", session="s2", config=config,
        env_overrides={"FAKE_BOB_ARGV_FILE": str(argv_file)},
    )
    assert result.ok
    argv = json.loads(argv_file.read_text())
    for expected in (
        ["run", "--accept-license", "-f", "stream-json"],
        ["--mode", "ibm-cloud"],
        ["--max-cost", "0.25"],
        ["--max-turns", "5"],
        ["--disable-tool-groups", "subagent,mcp"],
        ["--disable-mcp"],
        ["--disable-subagents"],
    ):
        joined = " ".join(argv)
        assert " ".join(expected) in joined, f"missing {expected} in {argv}"
    assert argv[-1] == "hi"


def test_run_timeout_kills_process(runtime):
    start = time.monotonic()
    result = runtime.run(
        "slow", tenant="acme", session="s3",
        config=RunConfig(timeout_seconds=1),
        env_overrides={"FAKE_BOB_SLEEP": "10"},
    )
    assert result.timed_out
    assert result.exit_code == 124
    assert time.monotonic() - start < 8


def test_run_retries_on_database_locked(runtime, tmp_path):
    marker = tmp_path / "lock-marker"
    result = runtime.run(
        "hello", tenant="acme", session="s4",
        env_overrides={"FAKE_BOB_LOCK_MARKER": str(marker)},
    )
    assert result.ok
    assert result.attempts == 2  # first attempt hit the lock, retry succeeded


def test_no_retry_on_ordinary_failure(runtime):
    boom = BobRuntime(
        root=runtime.root,
        bob_bin=f"{shlex.quote(sys.executable)} -c 'import sys; sys.exit(3)'",
    )
    result = boom.run("x", tenant="acme", session="s5")
    assert not result.ok
    assert result.exit_code == 3
    assert result.attempts == 1
