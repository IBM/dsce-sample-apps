#!/usr/bin/env python3
"""Fake Bob v2 CLI for tests — emits the validated stream-json schema.

Behaviors (controlled by env vars so tests can steer without changing argv):
  FAKE_BOB_SLEEP=<seconds>     sleep before replying (timeout tests)
  FAKE_BOB_LOCK_MARKER=<path>  fail with "database is locked" on stderr the
                               first time (marker file records the first call)
  FAKE_BOB_ARGV_FILE=<path>    dump received argv as JSON (flag-passing tests)

Replies:
  - normal:            assistant chunks "FAKE-" + "OK"
  - with --resume ID:  assistant chunks "RESUMED:" + <ID>
"""

import json
import os
from pathlib import Path
import sys
import time


def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main() -> int:
    argv = sys.argv[1:]

    argv_file = os.environ.get("FAKE_BOB_ARGV_FILE")
    if argv_file:
        Path(argv_file).write_text(json.dumps(argv), encoding="utf-8")

    lock_marker = os.environ.get("FAKE_BOB_LOCK_MARKER")
    if lock_marker and not Path(lock_marker).exists():
        Path(lock_marker).write_text("locked-once", encoding="utf-8")
        sys.stderr.write("Unexpected error: database is locked\n")
        return 1

    sleep = float(os.environ.get("FAKE_BOB_SLEEP", "0"))
    if sleep:
        time.sleep(sleep)

    # FAKE_BOB_WRITE_FILE="name.txt:content" — simulate Bob creating a file in
    # the workspace (cwd), for artifact-tracking tests.
    write_spec = os.environ.get("FAKE_BOB_WRITE_FILE")
    if write_spec and ":" in write_spec:
        name, content = write_spec.split(":", 1)
        Path(name).write_text(content, encoding="utf-8")

    resume_id = ""
    if "--resume" in argv:
        resume_id = argv[argv.index("--resume") + 1]
    prompt = argv[-1] if argv else ""

    emit({"type": "message", "role": "user", "content": prompt})

    # FAKE_BOB_REPLY_FILE=<path> — stream that file's content as line chunks
    # (exercises progress streaming, long-output attach, HTML detection).
    reply_file = os.environ.get("FAKE_BOB_REPLY_FILE")
    if reply_file and Path(reply_file).exists():
        for line in Path(reply_file).read_text(encoding="utf-8").splitlines(keepends=True):
            emit({"type": "message", "role": "assistant", "content": line})
        emit({"type": "result", "status": "success", "stats": {
            "task_id": resume_id or "task-fake-0001", "duration_ms": 5,
            "session_costs": 0.001, "max_cost": 0, "tool_calls": 0}})
        return 0
    if resume_id:
        emit({"type": "message", "role": "assistant", "content": "RESUMED:"})
        emit({"type": "message", "role": "assistant", "content": resume_id})
    else:
        emit({"type": "message", "role": "assistant", "content": "FAKE-"})
        emit({"type": "message", "role": "assistant", "content": "OK"})
    emit(
        {
            "type": "result",
            "status": "success",
            "stats": {
                "task_id": resume_id or "task-fake-0001",
                "duration_ms": 5,
                "session_costs": 0.001,
                "max_cost": 0,
                "tool_calls": 0,
            },
        }
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
