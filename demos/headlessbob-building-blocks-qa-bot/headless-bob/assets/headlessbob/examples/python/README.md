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
