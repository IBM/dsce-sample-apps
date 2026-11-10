# Python API examples

Python 3.10+; no third-party packages required. These examples create real Bob runs and consume Bob credit when pointed at a live service. Threads and files remain available after the samples finish.

Run from the service directory:

```sh
export HEADLESSBOB_URL='http://127.0.0.1:8000'  # or your deployed HTTPS origin
export HEADLESSBOB_TOKEN='your-service-access-token'
```

Use the **service access token**, not the Bob API key. Do not include `/api/v1` in `HEADLESSBOB_URL`; each example supplies the correct route prefix.

## ACP: discovery, runs and continuation

```sh
python3 examples/python/acp.py 'Say hello in one sentence.'
python3 examples/python/acp.py 'Explain what you can do.' --mode stream
python3 examples/python/acp.py 'Reply briefly.' --mode sync
python3 examples/python/acp.py 'Continue the previous task.' --session SESSION_ID
```

The default mode submits an asynchronous run and polls it. The sample prints the run and session IDs, response, reported usage and stored event count. Reuse the printed session ID to continue a successful task. A streamed response is printed live and again as the final result. ACP routes use `/agents` and `/runs`, and ACP runs do not create UI threads.

## REST: threads, live output and downloads

```sh
python3 examples/python/rest.py 'Create hello.txt containing Hello from Python.' \
  --download hello.txt --output hello.txt
python3 examples/python/rest.py 'Explain the file you created.' --thread THREAD_ID
```

The sample creates a thread (or reuses the supplied ID), sends a message with an idempotency key, streams events, prints usage/history and lists workspace files. Use `--download` to download a workspace file to `--output`; an existing local file is never overwritten. Thread and run IDs are printed for reuse. If adding request retries, reuse the same idempotency key for that send; restarting the script generates a new key and sends a new message.

## Cancel an active run

In a second terminal, using a printed run ID:

```sh
python3 examples/python/cancel.py RUN_ID --api rest
python3 examples/python/cancel.py RUN_ID --api acp
```

The cancellation sample waits for the terminal status. Closing a streaming sample or pressing Ctrl+C does not cancel the server-side run; use this sample explicitly. HTTP errors include the service's error response. Polling has a deadline, but a client timeout does not stop the run.

See the service's `/acp` guide, `/acp/openapi.json` contract and `/api/openapi.json` REST contract for the complete interfaces.

## MCP: drive Bob over Model Context Protocol

Each call is a stateless HTTP POST to `/mcp` with a JSON-RPC 2.0 body — no session handshake or persistent connection required.

```sh
# Run a prompt and print Bob's response
python3 examples/python/mcp.py 'Create hello.txt containing Hello from MCP.'

# Follow up in the same thread (use the Thread ID printed above)
python3 examples/python/mcp.py 'What did you just create?' --thread THREAD_ID

# Retry the same send safely (idempotent — reuse the same request ID)
python3 examples/python/mcp.py 'Create hello.txt containing Hello from MCP.' \
  --thread THREAD_ID --request-id my-unique-key-1

# Cancel an active run (use the Run ID printed by a previous invocation)
python3 examples/python/mcp.py --cancel RUN_ID
```

The sample creates a thread (or reuses `--thread`), sends a message, polls `bob_get_run`
every 2 seconds until the run reaches a terminal state, and prints the response, session ID
and token usage. Reuse `--thread` with any follow-up prompt to continue the same conversation.
Thread and run IDs are printed for reuse. Use `--cancel` to stop an active run; disconnecting
does not cancel the server-side run.

The four MCP tools used are `bob_create_thread`, `bob_send_message`, `bob_get_run` and
`bob_cancel_run`. See the "MCP access to Bob" section in the top-level README for the full
tool reference and transport details.

## MCP SDK: drive Bob using the official Python MCP SDK

Requires the `mcp` package (`pip install mcp`). Uses the same `/mcp` endpoint as `mcp.py`
but via the official MCP Python SDK with `streamablehttp_client` — the recommended approach
when integrating headlessbob into an agent framework.

```sh
pip install mcp

# Run a prompt and print Bob's response
python3 examples/python/mcp_sdk.py 'Create hello.txt containing Hello from MCP SDK.'

# Follow up in the same thread
python3 examples/python/mcp_sdk.py 'Show me the contents of hello.txt' --thread THREAD_ID

# Cancel an active run
python3 examples/python/mcp_sdk.py --cancel RUN_ID
```

The SDK handles the JSON-RPC framing and the required `Accept` header automatically.
Use `mcp_sdk.py` as a starting point for integrations with LangChain, LlamaIndex,
watsonx Orchestrate ADK, or any other MCP-compatible agent framework.

| Example | Transport | Dependencies |
|---|---|---|
| `mcp.py` | Raw HTTP POST (JSON-RPC 2.0) | Standard library only |
| `mcp_sdk.py` | MCP Python SDK (`streamablehttp_client`) | `pip install mcp` |
