"""Drive HeadlessBob over MCP using the official Python MCP SDK.

This example uses the MCP Python SDK (https://pypi.org/project/mcp/) with the
Streamable HTTP transport — the same protocol as mcp.py, but via the official
SDK rather than raw HTTP calls. Use this as a starting point when integrating
headlessbob into an agent framework (LangChain, LlamaIndex, watsonx Orchestrate, etc.)
that already uses the MCP SDK.

Install the SDK first:
    pip install mcp

Usage
-----
export HEADLESSBOB_URL='http://127.0.0.1:8000'
export HEADLESSBOB_TOKEN='your-service-access-token'

# Run a prompt and print Bob's response
python3 examples/python/mcp_sdk.py 'Create hello.txt containing Hello from MCP SDK.'

# Follow up in the same thread (use Thread ID printed above)
python3 examples/python/mcp_sdk.py 'Show me the contents of hello.txt' --thread THREAD_ID

# Cancel an active run (use Run ID printed by a previous invocation)
python3 examples/python/mcp_sdk.py --cancel RUN_ID

Use the service access token (AUTH_TOKENS), not the Bob API key.
"""
import argparse
import asyncio
import json
import os
import time
import uuid

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

BASE = os.getenv("HEADLESSBOB_URL", "http://127.0.0.1:8000").rstrip("/")
TOKEN = os.getenv("HEADLESSBOB_TOKEN", "")
MCP_URL = BASE + "/mcp"
TERMINAL = {"completed", "failed", "cancelled"}


# ---------------------------------------------------------------------------
# Typed wrappers around the four Bob MCP tools
# ---------------------------------------------------------------------------

async def create_thread(session: ClientSession, title: str | None = None) -> dict:
    """Create a new Bob conversation thread."""
    args = {}
    if title:
        args["title"] = title
    result = await session.call_tool("bob_create_thread", args)
    return _parse(result, "bob_create_thread")


async def send_message(session: ClientSession, thread_id: str, content: str, request_id: str) -> dict:
    """Start a Bob run in a thread. Returns immediately with run metadata."""
    result = await session.call_tool("bob_send_message", {
        "thread_id": thread_id,
        "content": content,
        "request_id": request_id,
    })
    return _parse(result, "bob_send_message")


async def get_run(session: ClientSession, run_id: str) -> dict:
    """Fetch current run status, output and usage."""
    result = await session.call_tool("bob_get_run", {"run_id": run_id})
    return _parse(result, "bob_get_run")


async def cancel_run(session: ClientSession, run_id: str) -> dict:
    """Request cancellation of a queued or active run."""
    result = await session.call_tool("bob_cancel_run", {"run_id": run_id})
    return _parse(result, "bob_cancel_run")


def _parse(result, tool_name: str) -> dict:
    """Extract structured content from an MCP tool result, raising on errors."""
    if result.isError:
        content = result.content[0].text if result.content else str(result)
        raise RuntimeError(f"Tool error from {tool_name}: {content}")
    # SDK returns structuredContent as a dict when the server provides it
    if hasattr(result, "structuredContent") and result.structuredContent:
        return result.structuredContent
    # Fall back to parsing the text content
    if result.content:
        return json.loads(result.content[0].text)
    return {}


# ---------------------------------------------------------------------------
# Higher-level helpers
# ---------------------------------------------------------------------------

async def wait_for_run(session: ClientSession, run_id: str, timeout_seconds: int = 360) -> dict:
    """Poll bob_get_run every 2 seconds until the run reaches a terminal state."""
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        run = await get_run(session, run_id)
        status = run.get("status", "")
        print(f"  status: {status}", flush=True)
        if status in TERMINAL:
            return run
        await asyncio.sleep(2)
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
# Main async entrypoint
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    if not TOKEN:
        raise SystemExit("Set HEADLESSBOB_TOKEN to your service access token (not the Bob API key).")

    # The streamablehttp_client accepts custom headers for Bearer token auth.
    # It automatically sets the correct Accept header required by the MCP transport.
    async with streamablehttp_client(
        MCP_URL,
        headers={"Authorization": f"Bearer {TOKEN}"},
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # --- Cancel mode ---
            if args.cancel:
                print(f"Requesting cancellation of run {args.cancel} …")
                result = await cancel_run(session, args.cancel)
                print("Cancellation acknowledged, status:", result.get("status"))
                final = await wait_for_run(session, args.cancel)
                print("Final status:", final.get("status"))
                return

            # --- Send mode ---
            # 1. Create or reuse a thread
            if args.thread:
                thread_id = args.thread
                print(f"Reusing thread: {thread_id}")
            else:
                thread = await create_thread(session, title="Python MCP SDK example")
                thread_id = thread["id"]
                print(f"Thread ID:  {thread_id}")

            # 2. Send the message
            request_id = args.request_id or str(uuid.uuid4())
            print(f"Request ID: {request_id}")

            send_result = await send_message(session, thread_id, args.prompt, request_id)
            run_id = send_result["run"]["run_id"]
            print(f"Run ID:     {run_id}")

            # 3. Poll until done
            print("\nPolling for completion …")
            completed_run = await wait_for_run(session, run_id)

            # 4. Display results
            show_result(completed_run)


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

    if not args.cancel and not args.prompt:
        parser.error("Provide a prompt, or use --cancel <run-id>.")

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
