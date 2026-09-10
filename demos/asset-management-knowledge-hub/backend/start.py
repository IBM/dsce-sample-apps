#!/usr/bin/env python3
"""Unified launcher for all Maximo Knowledge Hub services.

Starts these processes in parallel and streams their logs to the console:

    ┌─────────────────────────────────────────────────────────────┐
    │  Service              Port   Command                        │
    ├─────────────────────────────────────────────────────────────┤
    │  MCP Server           6868   python -m mcp_server           │
    │  Ingestion Pipeline   8080   python -m ingestion_pipeline   │
    │  End User UI          3002   npm run dev  (frontend/)       │
    └─────────────────────────────────────────────────────────────┘

NOTE: The spiderbot is a one-shot crawler, NOT a long-running server.
      Run it separately once to populate the web-knowledge index:
          python -m spiderbot crawl

Usage::

    python start.py              # start all services
    python start.py --no-ui      # skip the React UI (backend only)
    python start.py --debug      # verbose output from Python services

Ctrl+C gracefully stops every child process.
"""

from __future__ import annotations

import argparse
import os
import platform
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

# ── Colour helpers (no external deps) ────────────────────────────────────────

_RESET  = "\033[0m"
_BOLD   = "\033[1m"
_COLORS = {
    "mcp_server":          "\033[94m",   # blue
    "ingestion_pipeline":  "\033[92m",   # green
    "ui":                  "\033[95m",   # magenta
    "launcher":            "\033[93m",   # yellow
}


def _tag(name: str, msg: str) -> str:
    colour = _COLORS.get(name, "\033[97m")
    return f"{colour}{_BOLD}[{name}]{_RESET} {msg}"


def _log(name: str, msg: str) -> None:
    print(_tag(name, msg), flush=True)


# ── Process wrapper ───────────────────────────────────────────────────────────

class ManagedProcess:
    """Wraps a subprocess and streams its stdout/stderr to the console."""

    def __init__(self, name: str, cmd: list[str], cwd: Path) -> None:
        self.name = name
        self.cmd = cmd
        self.cwd = cwd
        self.proc: subprocess.Popen | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        _log(self.name, f"Starting: {' '.join(self.cmd)}")
        self.proc = subprocess.Popen(
            self.cmd,
            cwd=self.cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )
        self._thread = threading.Thread(target=self._stream, daemon=True)
        self._thread.start()

    def _stream(self) -> None:
        assert self.proc and self.proc.stdout
        for line in self.proc.stdout:
            print(_tag(self.name, line.rstrip()), flush=True)

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            _log(self.name, "Stopping…")
            if platform.system() == "Windows":
                self.proc.terminate()
            else:
                self.proc.send_signal(signal.SIGTERM)
            try:
                self.proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self.proc.kill()
            _log(self.name, "Stopped.")

    @property
    def running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None


# ── Service definitions ───────────────────────────────────────────────────────

CODE_DIR    = Path(__file__).parent.resolve()
REPO_DIR    = CODE_DIR.parent           # maximo_knowledge_hub/
FRONTEND    = REPO_DIR / "frontend"     # the Vite/Carbon React frontend
UI_DIR      = FRONTEND if FRONTEND.exists() else CODE_DIR / "ui"

PYTHON = sys.executable   # same interpreter that launched this script


def _build_services(*, debug: bool, no_ui: bool) -> list[ManagedProcess]:
    debug_flag = ["--debug"] if debug else []

    services: list[ManagedProcess] = [
        ManagedProcess(
            name="mcp_server",
            cmd=[PYTHON, "-m", "mcp_server"] + debug_flag,
            cwd=CODE_DIR,
        ),
        ManagedProcess(
            name="ingestion_pipeline",
            cmd=[PYTHON, "-m", "ingestion_pipeline"] + debug_flag,
            cwd=CODE_DIR,
        ),
    ]

    if not no_ui:
        # Prefer npm.cmd on Windows, npm everywhere else
        npm = "npm.cmd" if platform.system() == "Windows" else "npm"
        services.append(
            ManagedProcess(
                name="ui",
                cmd=[npm, "run", "dev"],
                cwd=UI_DIR,
            )
        )

    return services


# ── Health check ──────────────────────────────────────────────────────────────

def _wait_for_health(url: str, name: str, timeout: int = 30) -> bool:
    """Poll GET *url* until 200 or *timeout* seconds elapses."""
    import urllib.request, urllib.error

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    _log("launcher", f"✔  {name} is ready ({url})")
                    return True
        except Exception:
            pass
        time.sleep(2)
    _log("launcher", f"✘  {name} did not become healthy within {timeout}s")
    return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Start all Maximo Knowledge Hub services")
    parser.add_argument("--no-ui",  action="store_true", help="Skip the React UI")
    parser.add_argument("--debug",  action="store_true", help="Enable verbose logging")
    parser.add_argument("--no-health-check", action="store_true", help="Skip startup health checks")
    args = parser.parse_args()

    services = _build_services(debug=args.debug, no_ui=args.no_ui)

    _log("launcher", "═" * 58)
    _log("launcher", "  Maximo Knowledge Hub — starting all services")
    _log("launcher", "═" * 58)
    _log("launcher", f"  MCP Server          → http://localhost:6868")
    _log("launcher", f"  Ingestion Pipeline  → http://localhost:8080")
    if not args.no_ui:
        _log("launcher", f"  Carbon UI           → http://localhost:3002  (Vite dev)")
    _log("launcher", "  Press Ctrl+C to stop all services")
    _log("launcher", "═" * 58)

    # ── Start all processes ───────────────────────────────────────────────────
    for svc in services:
        svc.start()
        time.sleep(0.5)   # stagger startup slightly for cleaner log output

    # ── Optional health checks ────────────────────────────────────────────────
    if not args.no_health_check:
        time.sleep(3)   # give processes a moment to bind their ports
        _wait_for_health("http://localhost:6868/health", "MCP Server")
        _wait_for_health("http://localhost:8080/health", "Ingestion Pipeline")

    # ── Keep alive — wait for Ctrl+C ──────────────────────────────────────────
    def _shutdown(signum=None, frame=None) -> None:
        _log("launcher", "\nShutting down all services…")
        for svc in reversed(services):
            svc.stop()
        _log("launcher", "All services stopped. Goodbye.")
        sys.exit(0)

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        while True:
            # Restart any service that died unexpectedly
            for svc in services:
                if not svc.running:
                    _log("launcher", f"⚠  {svc.name} exited — restarting in 5s…")
                    time.sleep(5)
                    svc.start()
            time.sleep(2)
    except KeyboardInterrupt:
        _shutdown()


if __name__ == "__main__":
    main()
