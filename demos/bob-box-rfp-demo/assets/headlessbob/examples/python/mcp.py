"""Drive HeadlessBob over MCP (Streamable HTTP); Python 3.10+, standard library only.

Each MCP call is a stateless HTTP POST to /mcp with a JSON-RPC 2.0 body.
No session handshake or persistent connection is required.

Usage
-----
export HEADLESSBOB_URL='http://127.0.0.1:8000'
export HEADLESSBOB_TOKEN='your-service-access-token'

# Run a prompt and print Bob's response
python3 examples/python/mcp.py 'Create hello.txt containing Hello from MCP.'

# Follow up in the same thread
python3 examples/python/mcp.py 'What did you just create?' --thread <thread-id>

# Cancel an active run (use the run ID printed by a previous invocation)
python3 examples/python/mcp.py --cancel <run-id>

Use the service access token (AUTH_TOKENS), not the Bob API key.
"""
import argparse
import json
import os
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = os.getenv("HEADLESSBOB_URL", "http://127.0.0.1:8000").rstrip("/")
TOKEN = os.getenv("HEADLESSBOB_TOKEN", "")
MCP_URL = BASE + "/mcp"
TERMINAL = {"completed", "failed", "cancelled"}
_rpc_id = 0


# ---------------------------------------------------------------------------
# Low-level JSON-RPC over Streamable HTTP
# ---------------------------------------------------------------------------

def _next_id() -> int:
    global _rpc_id
    _rpc_id += 1
    return _rpc_id


def mcp_call(tool: str, arguments: dict) -> dict:
    """Send a single tools/call JSON-RPC request to /mcp and return the result."""
    if not TOKEN:
        raise SystemExit("Set HEADLESSBOB_TOKEN to your service access token (not the Bob API key).")

    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": _next_id(),
        "method": "tools/call",
        "params": {
            "name": tool,
            "arguments": arguments,
        },
    }).encode()

    req = Request(
        MCP_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
    )
    try:
        with urlopen(req, timeout=360) as response:
            body = json.load(response)
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from None

    if "error" in body:
        raise RuntimeError(f"JSON-RPC error: {body['error']}")

    result = body.get("result", {})

    # The MCP server returns isError:true in the result for tool-level errors
    if result.get("isError"):
        content = result.get("content", [{}])
        msg = content[0].get("text", str(result)) if content else str(result)
        raise RuntimeError(f"Tool error from {tool}: {msg}")

    # structuredContent is the parsed object; fall back to parsing content[0].text
    if "structuredContent" in result:
        return result["structuredContent"]
    content = result.get("content", [])
    if content:
        return json.loads(content[0]["text"])
    return result


# ---------------------------------------------------------------------------
# Typed wrappers around the four Bob MCP tools
# ---------------------------------------------------------------------------

def create_thread(title: str | None = None) -> dict:
    """Create a new Bob conversation thread. Returns the thread object (includes 'id')."""
    args = {}
    if title:
        args["title"] = title
    return mcp_call("bob_create_thread", args)


def send_message(thread_id: str, content: str, request_id: str) -> dict:
    """Start a Bob run inside a thread. Returns immediately with run metadata."""
    return mcp_call("bob_send_message", {
        "thread_id": thread_id,
        "content": content,
        "request_id": request_id,
    })


def get_run(run_id: str) -> dict:
    """Fetch current run status, output and usage. Poll until terminal."""
    return mcp_call("bob_get_run", {"run_id": run_id})


def cancel_run(run_id: str) -> dict:
    """Request cancellation of a queued or active run."""
    return mcp_call("bob_cancel_run", {"run_id": run_id})


# ---------------------------------------------------------------------------
# Higher-level helpers
# ---------------------------------------------------------------------------

def wait_for_run(run_id: str, timeout_seconds: int = 360) -> dict:
    """Poll bob_get_run every 2 seconds until the run reaches a terminal state."""
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        run = get_run(run_id)
        status = run.get("status", "")
        print(f"  status: {status}", flush=True)
        if status in TERMINAL:
            return run
        time.sleep(2)
    raise TimeoutError(
        f"Run {run_id} did not finish within {timeout_seconds}s. "
        "It may still be active — use --cancel to stop it."
    )


def show_result(run: dict) -> None:
    """Print the run's output, session info and usage."""
    print(f"\nRun:     {run.get('run_id')}")
    print(f"Session: {run.get('session_id')}")
    print(f"Status:  {run.get('status')}")
    for message in run.get("output", []):
        for part in message.get("parts", []):
            text = part.get("content", "")
            if text:
                print("\n--- Bob response ---")
                print(text)
    if "usage" in run:
        print("\nUsage:", json.dumps(run["usage"]))
    if run.get("status") != "completed":
        raise SystemExit(json.dumps(run.get("error", {"status": run.get("status")})))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("prompt", nargs="?",
                        help="The prompt to send to Bob")
    parser.add_argument("--thread",
                        help="Existing thread ID to continue a previous conversation")
    parser.add_argument("--request-id",
                        help="Idempotency key for the send (auto-generated if omitted)")
    parser.add_argument("--cancel", metavar="RUN_ID",
                        help="Cancel an active run and wait for terminal status")
    args = parser.parse_args()

    # --- Cancel mode ---
    if args.cancel:
        print(f"Requesting cancellation of run {args.cancel} …")
        result = cancel_run(args.cancel)
        print("Cancellation acknowledged, status:", result.get("status"))
        final = wait_for_run(args.cancel)
        print("Final status:", final.get("status"))
        return

    # --- Send mode ---
    if not args.prompt:
        parser.error("Provide a prompt, or use --cancel <run-id>.")

    # 1. Create or reuse a thread
    if args.thread:
        thread_id = args.thread
        print(f"Reusing thread: {thread_id}")
    else:
        thread = create_thread(title="Python MCP example")
        thread_id = thread["id"]
        print(f"Thread ID:  {thread_id}")

    # 2. Send the message
    import uuid
    request_id = args.request_id or str(uuid.uuid4())
    print(f"Request ID: {request_id}")

    send_result = send_message(thread_id, args.prompt, request_id)
    run_id = send_result["run"]["run_id"]
    print(f"Run ID:     {run_id}")

    # 3. Poll until done
    print("\nPolling for completion …")
    run = wait_for_run(run_id)

    # 4. Display results
    show_result(run)


if __name__ == "__main__":
    main()
