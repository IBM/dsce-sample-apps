#!/usr/bin/env python3
"""
Supply Chain Risk Control Tower — Kafka ↔ Browser SSE Bridge
=============================================================
Runs a single HTTP server on one process:
  GET  :8765/          — health check and uptime stats
  GET  :8765/status    — JSON process and consumer status
  GET  :8765/events    — Server-Sent Events stream (all 10 Kafka topics)
  POST :8765/start     — launch producer + risk engine subprocesses
  POST :8765/stop      — stop producer + risk engine
  POST :8765/restart-engine — restart just the risk engine

Usage (from project root, with .venv active):
  python code/ui/kafka_bridge.py

Options (environment variables):
  BRIDGE_HOST  default 0.0.0.0
  BRIDGE_PORT  default 8765

The Carbon UI (code/ui/index.html) connects to :8765/events as an EventSource.
"""

from __future__ import annotations

import json
import os
import queue
import signal
import socketserver
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

# ── Resolve project root regardless of cwd ──────────────────────────────────
# File lives at  <project_root>/code/ui/kafka_bridge.py
# so project root is two levels up.
SCRIPT_DIR  = Path(__file__).resolve().parent          # .../code/ui
PROJECT_ROOT = SCRIPT_DIR.parent.parent                 # .../supply-chain-risk-control-tower
VENV_PYTHON  = PROJECT_ROOT / ".venv" / ("Scripts" if sys.platform == "win32" else "bin") / "python"
PYTHON_EXE   = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

HOST = os.getenv("BRIDGE_HOST", "0.0.0.0")
PORT = int(os.getenv("BRIDGE_PORT", "8765"))

# ── Shared broadcast queue ───────────────────────────────────────────────────
# Each SSE client gets its own Queue; the Kafka consumer thread puts into all.
_clients: list[queue.Queue] = []
_clients_lock = threading.Lock()

# ── Subprocess handles ───────────────────────────────────────────────────────
_processes: dict[str, subprocess.Popen | None] = {"producer": None, "risk_engine": None}
_process_lock = threading.Lock()

# ── Stats ────────────────────────────────────────────────────────────────────
_stats: dict[str, Any] = {
    "events_forwarded": 0,
    "consumer_running": False,
    "producer_running": False,
    "risk_engine_running": False,
    "start_time": time.time(),
}


def broadcast(msg: dict[str, Any]) -> None:
    """Push one JSON message to every connected SSE client."""
    data = json.dumps(msg, separators=(",", ":"), default=str)
    _stats["events_forwarded"] += 1
    dead: list[queue.Queue] = []
    with _clients_lock:
        for q in _clients:
            try:
                q.put_nowait(data)
            except queue.Full:
                dead.append(q)
        for q in dead:
            _clients.remove(q)


# ── Kafka consumer thread ─────────────────────────────────────────────────────

def kafka_consumer_thread() -> None:
    """
    Consumes ALL 10 Kafka topics and broadcasts each message to SSE clients.
    Runs forever; restarts on transient errors.
    """
    sys.path.insert(0, str(PROJECT_ROOT / "code"))

    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")

    from scrc.settings import TOPICS, load_settings
    from scrc.kafka_utils import consumer_config

    settings = load_settings()
    if not settings.kafka.is_configured:
        print("[bridge] ERROR: Kafka not configured. Check .env", flush=True)
        _stats["consumer_running"] = False
        return

    # Use a dedicated consumer group so bridge never interferes with risk engine
    cfg = consumer_config(settings.kafka, group_id="scrc-ui-bridge")
    cfg["auto.offset.reset"] = "latest"   # only new events; change to "earliest" to replay history

    all_topics = list(TOPICS.values())
    # Reverse topic → key map for labelling
    key_by_topic = {v: k for k, v in TOPICS.items()}

    try:
        from confluent_kafka import Consumer, KafkaException
        consumer = Consumer(cfg)
        consumer.subscribe(all_topics)
        print(f"[bridge] Kafka consumer subscribed to {len(all_topics)} topics", flush=True)
        _stats["consumer_running"] = True

        while True:
            msg = consumer.poll(timeout=0.5)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())
            try:
                key   = msg.key().decode("utf-8") if msg.key() else None
                value = json.loads(msg.value().decode("utf-8"))
                topic = msg.topic()
                broadcast({
                    "type":      "kafka_event",
                    "topic":     topic,
                    "topic_key": key_by_topic.get(topic, topic),
                    "key":       key,
                    "value":     value,
                    "offset":    msg.offset(),
                    "partition": msg.partition(),
                    "ts":        time.strftime("%H:%M:%S"),
                })
            except Exception as e:
                print(f"[bridge] parse error: {e}", flush=True)

    except Exception as e:
        print(f"[bridge] Kafka consumer error: {e}", flush=True)
        _stats["consumer_running"] = False
        broadcast({"type": "bridge_error", "message": str(e)})


# ── Process management ────────────────────────────────────────────────────────

def _is_alive(name: str) -> bool:
    proc = _processes.get(name)
    return proc is not None and proc.poll() is None


def _update_process_stats() -> None:
    _stats["producer_running"]    = _is_alive("producer")
    _stats["risk_engine_running"] = _is_alive("risk_engine")


def _subprocess_env() -> dict[str, str]:
    """
    Build an env dict for subprocesses that:
      1. Inherits the current process environment (PATH, SystemRoot, etc.)
      2. Ensures PYTHONPATH includes the project's src/ directory so
         `python -m scrc.*` can be resolved without an editable install.
      3. Loads values from .env so the subprocess gets Kafka/SR credentials
         even when the bridge was started without dotenv pre-loaded in shell.
    """
    env = os.environ.copy()

    # Ensure code/ is on PYTHONPATH
    src_dir = str(PROJECT_ROOT / "code")
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = f"{src_dir}{os.pathsep}{existing}" if existing else src_dir

    # Merge values from .env file without overwriting values already in the
    # environment (matches python-dotenv's default override=False behaviour).
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        with env_file.open() as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in env:
                    env[key] = val

    return env


def start_risk_engine() -> dict[str, Any]:
    with _process_lock:
        if _is_alive("risk_engine"):
            return {"ok": False, "reason": "risk_engine already running"}
        cmd = [PYTHON_EXE, "-m", "scrc.risk_engine"]
        proc = subprocess.Popen(
            cmd,
            cwd=str(PROJECT_ROOT),
            env=_subprocess_env(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        _processes["risk_engine"] = proc
        # Stream stdout → broadcast
        threading.Thread(target=_stream_proc_output, args=("risk_engine", proc), daemon=True).start()
        _update_process_stats()
        return {"ok": True, "pid": proc.pid, "cmd": " ".join(cmd)}


def start_producer(scenario: str, count: int, interval: float) -> dict[str, Any]:
    with _process_lock:
        if _is_alive("producer"):
            # Kill the previous run first so a new scenario can start immediately
            _processes["producer"].terminate()
            try:
                _processes["producer"].wait(timeout=5)
            except subprocess.TimeoutExpired:
                _processes["producer"].kill()

        cmd = [
            PYTHON_EXE, "-m", "scrc.producer",
            "--scenario", scenario,
            "--count",    str(count),
            "--interval", str(interval),
        ]
        proc = subprocess.Popen(
            cmd,
            cwd=str(PROJECT_ROOT),
            env=_subprocess_env(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        _processes["producer"] = proc
        threading.Thread(target=_stream_proc_output, args=("producer", proc), daemon=True).start()
        _update_process_stats()
        return {"ok": True, "pid": proc.pid, "cmd": " ".join(cmd)}


def stop_process(name: str) -> dict[str, Any]:
    with _process_lock:
        proc = _processes.get(name)
        if not proc or proc.poll() is not None:
            return {"ok": False, "reason": f"{name} not running"}
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
        _processes[name] = None
        _update_process_stats()
        return {"ok": True, "stopped": name}


def _stream_proc_output(name: str, proc: subprocess.Popen) -> None:
    """Forward subprocess stdout lines as bridge_log SSE events."""
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.rstrip("\n")
        if line:
            broadcast({"type": "process_log", "process": name, "line": line})
    proc.wait()
    _update_process_stats()
    broadcast({"type": "process_exit", "process": name, "returncode": proc.returncode})
    print(f"[bridge] {name} exited (rc={proc.returncode})", flush=True)


# ── HTTP / SSE handler ────────────────────────────────────────────────────────

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # silence default Apache-style log
        pass

    def _cors(self, code: int = 200, content_type: str = "application/json") -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def _json(self, payload: Any, code: int = 200) -> None:
        body = json.dumps(payload, default=str).encode()
        self._cors(code, "application/json")
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._cors(204)

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/":
            self._json({"service": "scrc-kafka-bridge", "status": "ok",
                        "uptime_s": round(time.time() - _stats["start_time"]),
                        "stats": _stats})

        elif path == "/status":
            _update_process_stats()
            self._json({
                "consumer_running":    _stats["consumer_running"],
                "producer_running":    _stats["producer_running"],
                "risk_engine_running": _stats["risk_engine_running"],
                "events_forwarded":    _stats["events_forwarded"],
                "uptime_s":            round(time.time() - _stats["start_time"]),
            })

        elif path == "/events":
            # Server-Sent Events endpoint
            self.send_response(200)
            self.send_header("Content-Type",  "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Accel-Buffering", "no")
            for k, v in CORS_HEADERS.items():
                self.send_header(k, v)
            self.end_headers()

            q: queue.Queue = queue.Queue(maxsize=512)
            with _clients_lock:
                _clients.append(q)

            # Send a heartbeat immediately so the browser knows it connected
            try:
                self.wfile.write(b": connected\n\n")
                self.wfile.flush()
            except Exception:
                with _clients_lock:
                    if q in _clients:
                        _clients.remove(q)
                return

            try:
                while True:
                    try:
                        data = q.get(timeout=15)
                        self.wfile.write(f"data: {data}\n\n".encode())
                        self.wfile.flush()
                    except queue.Empty:
                        # Heartbeat to keep connection alive through proxies
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except Exception:
                pass
            finally:
                with _clients_lock:
                    if q in _clients:
                        _clients.remove(q)

        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        path  = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length)) if length else {}

        if path == "/start":
            scenario = body.get("scenario", "supplier_delay")
            count    = int(body.get("count", 20))
            interval = float(body.get("interval", 1.0))

            results = {}
            # Start risk engine first (it needs to be consuming before events arrive)
            if not _is_alive("risk_engine"):
                results["risk_engine"] = start_risk_engine()
                time.sleep(1.5)   # give consumer time to subscribe
            else:
                results["risk_engine"] = {"ok": True, "already_running": True}

            results["producer"] = start_producer(scenario, count, interval)
            broadcast({"type": "simulation_started", "scenario": scenario,
                       "count": count, "interval": interval})
            self._json({"ok": True, "results": results})

        elif path == "/stop":
            target = body.get("target", "all")
            results = {}
            if target in ("producer", "all"):
                results["producer"] = stop_process("producer")
            if target in ("risk_engine", "all"):
                results["risk_engine"] = stop_process("risk_engine")
            broadcast({"type": "simulation_stopped", "target": target})
            self._json({"ok": True, "results": results})

        elif path == "/restart-engine":
            stop_process("risk_engine")
            time.sleep(0.5)
            result = start_risk_engine()
            self._json({"ok": True, "result": result})

        else:
            self._json({"error": "not found"}, 404)


# ── Threading mixin — fixes WinError 10053 on Windows ────────────────────────
# Plain HTTPServer handles one request at a time on a single thread.
# When the /events SSE handler blocks indefinitely reading from the queue,
# every subsequent request (e.g. /status poll) must wait for that thread,
# causing Windows to abort the waiting connection with WinError 10053.
# ThreadingHTTPServer spawns a new daemon thread per request so SSE and
# short-lived API calls never compete for the same thread.

class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True   # threads die when the main process exits


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    print(f"[bridge] Project root : {PROJECT_ROOT}", flush=True)
    print(f"[bridge] Python       : {PYTHON_EXE}", flush=True)
    print(f"[bridge] Starting HTTP server on http://{HOST}:{PORT}", flush=True)
    print(f"[bridge] SSE events   : http://localhost:{PORT}/events", flush=True)
    print(f"[bridge] Control API  : POST http://localhost:{PORT}/start  /stop  /status", flush=True)

    # Start Kafka consumer in background thread
    t = threading.Thread(target=kafka_consumer_thread, daemon=True)
    t.start()

    server = ThreadingHTTPServer((HOST, PORT), BridgeHandler)
    # SO_REUSEADDR so the port is released immediately on restart (avoids
    # "Address already in use" when the previous process is still in TIME_WAIT)
    server.socket.setsockopt(__import__('socket').SOL_SOCKET,
                             __import__('socket').SO_REUSEADDR, 1)

    # ── Shutdown helper — runs in a daemon thread so it never deadlocks ───────
    # On Windows, calling server.shutdown() from inside a signal handler that
    # was raised on the main thread (which is blocked inside serve_forever)
    # causes a deadlock.  We schedule the shutdown on a separate thread instead.
    def _do_shutdown():
        print("\n[bridge] Shutting down …", flush=True)
        for name in list(_processes.keys()):
            try:
                stop_process(name)
            except Exception:
                pass
        server.shutdown()      # unblocks serve_forever() on the main thread
        print("[bridge] Done.", flush=True)

    def _signal_handler(sig, frame):
        threading.Thread(target=_do_shutdown, daemon=True).start()

    signal.signal(signal.SIGINT,  _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    try:
        server.serve_forever()   # blocks until server.shutdown() is called
    except KeyboardInterrupt:
        # Ctrl+C on Windows may bypass the signal handler; handle it here too
        _do_shutdown()


if __name__ == "__main__":
    main()
