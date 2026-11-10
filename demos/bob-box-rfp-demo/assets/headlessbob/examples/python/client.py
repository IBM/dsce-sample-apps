"""Shared helpers; Python 3.10+, standard library only."""
import json
import os
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = os.getenv("HEADLESSBOB_URL", "http://127.0.0.1:8000").rstrip("/")
TOKEN = os.getenv("HEADLESSBOB_TOKEN", "")
TERMINAL = {"completed", "failed", "cancelled"}


def request(path, body=None, method=None, headers=None):
    if not TOKEN:
        raise SystemExit("Set HEADLESSBOB_TOKEN to your service access token (not the Bob API key).")
    if not path.startswith("/") or path.startswith("//"):
        raise ValueError("Expected a relative API path")
    data = None if body is None else json.dumps(body).encode()
    req = Request(BASE + path, data=data, method=method or ("POST" if body is not None else "GET"),
                  headers={"Authorization": f"Bearer {TOKEN}",
                           **({"Content-Type": "application/json"} if data is not None else {}),
                           **(headers or {})})
    try:
        return urlopen(req, timeout=360)
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from None


def api(path, body=None, method=None, headers=None):
    with request(path, body, method, headers) as response:
        return json.load(response) if response.status != 204 else None


def events(response):
    """Read JSON payloads from SSE data records; ignore comments and event IDs."""
    data = []
    for raw in response:
        line = raw.decode("utf-8").rstrip("\r\n")
        if not line:
            if data:
                yield json.loads("\n".join(data))
                data = []
        elif line.startswith("data:"):
            data.append(line[5:].removeprefix(" "))


def wait_run(path, seconds=360):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        run = api(path)
        if run["status"] in TERMINAL:
            return run
        time.sleep(1)
    raise TimeoutError(f"Polling timed out; the run may still be active. Check {path} or use cancel.py.")


def show_result(run):
    print("Run:", run["run_id"], "Session:", run["session_id"], "Status:", run["status"])
    for message in run.get("output", []):
        for part in message["parts"]:
            print(part.get("content", ""))
    if "usage" in run:
        print("Usage:", json.dumps(run["usage"]))
    if run["status"] != "completed":
        raise SystemExit(json.dumps(run.get("error", {"status": run["status"]})))
