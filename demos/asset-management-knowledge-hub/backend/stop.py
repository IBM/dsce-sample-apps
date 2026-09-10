#!/usr/bin/env python3
"""Stop all Maximo Knowledge Hub services by port.

Sends SIGTERM (or taskkill on Windows) to any process occupying ports
6868 (MCP Server), 8080 (Ingestion Pipeline), and 3002 (UI).

Usage::

    python stop.py
"""

from __future__ import annotations

import os
import platform
import subprocess
import sys

PORTS = [6868, 8080, 3002]

_RESET = "\033[0m"
_BOLD  = "\033[1m"
_RED   = "\033[91m"
_GREEN = "\033[92m"


def _log(msg: str, colour: str = _GREEN) -> None:
    print(f"{colour}{_BOLD}[stop]{_RESET} {msg}", flush=True)


def _kill_port(port: int) -> None:
    if platform.system() == "Windows":
        # Find the PID listening on the port then kill it
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                pid = parts[-1]
                subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True)
                _log(f"Killed PID {pid} on port {port}")
                return
    else:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True,
        )
        pids = result.stdout.strip().split()
        for pid in pids:
            subprocess.run(["kill", "-TERM", pid], capture_output=True)
            _log(f"Killed PID {pid} on port {port}")
        if not pids:
            _log(f"Nothing running on port {port}", _RED)


if __name__ == "__main__":
    _log("Stopping all Maximo Knowledge Hub services…")
    for port in PORTS:
        _kill_port(port)
    _log("Done.")
