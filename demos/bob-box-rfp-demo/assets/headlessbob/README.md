# headlessbob

Run IBM Bob Shell tasks headlessly over HTTP — from any language, agent framework,
or MCP-compatible client. headlessbob wraps Bob Shell 2.0.4 as a standalone
Node.js service and exposes three interfaces on the same port:

- **REST threads API** (`/api/v1`) — persistent conversation threads with live
  streaming, workspace file management, and a built-in browser UI
- **ACP 0.2.0** (`/agents`, `/runs`) — Agent Communication Protocol for
  server-side agent clients and pipelines
- **MCP** (`/mcp`) — Streamable HTTP Model Context Protocol for any
  MCP-compatible client or agent framework

All three interfaces drive Bob Shell through the same **Agent Client Protocol**
connector, giving consistent behaviour across REST, ACP, and MCP.

The runtime enforces timeout, output-byte, and event limits. Authentication uses
service tokens configured in `AUTH_TOKENS`; the Bob API key stays server-side and
is never exposed to API clients.

For official IBM Bob protocol capabilities, see the [IBM Bob ACP Documentation](https://bob.ibm.com/docs/shell/features/acp).

---

## Architecture & Interfaces

```mermaid
flowchart LR
    subgraph Clients
        UI[Browser UI]
        RESTClient[REST API Client]
        ACPClient[ACP Agent / Pipeline]
        MCPClient[MCP Client]
    end

    subgraph Service[headlessbob Node.js Service]
        REST[REST API /api/v1]
        ACP[ACP API /agents /runs /session]
        MCP[MCP /mcp Streamable HTTP]
        Manager[Run Manager & Scheduler]
        Files[Workspace File Manager]
    end

    subgraph Storage & Engine
        Store[(SQLite runs.sqlite)]
        Workspaces[(File Workspaces)]
        Bob[IBM Bob Shell 2.0.4 Subprocess]
    end

    UI --> REST
    RESTClient --> REST
    ACPClient --> ACP
    MCPClient --> MCP
    REST --> Manager
    ACP --> Manager
    MCP --> Manager
    REST --> Files
    Manager --> ClientProtocol[Agent Client Protocol]
    ClientProtocol --> Bob
    Manager --> Store
    Manager --> Workspaces
    Files --> Workspaces
```

---

## Integrated Browser UI & Thread REST API

Open your deployment URL, or `http://127.0.0.1:8000` when running locally. The root page serves an interactive conversation UI. Connect with the **service token** (the `owner` key inside `AUTH_TOKENS` in `.env`), not the Bob API key. The token is held only in browser session memory; reloading or clicking Disconnect clears it.

### UI Features
- **Conversation Management**: Create, rename, search, archive/restore, and delete threads.
- **Live Output Streaming**: Real-time message streaming with sanitized Markdown rendering (headings, tables, syntax-highlighted code blocks).
- **Execution Controls**: Real-time **Cancel run** button to terminate active or queued runs immediately.
- **Workspace File Explorer**: Right-hand panel (responsive below chat on small screens) to browse generated project files and download them with one click.
- **Run Diagnostics & Cost**: Inspect full run JSON, tool calls, execution duration, and token/cost statistics reported by Bob.
- **Integrated API Documentation**: One-click modal linking to interactive OpenAPI specifications and downloadable Python samples.

### REST Endpoints (`/api/v1`)

| REST endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/v1/capabilities` | `GET` | Caller identity, readiness, features, and operational limits |
| `/api/v1/threads` | `POST` | Create a thread with `{}` or `{"title":"Project Name"}` |
| `/api/v1/threads` | `GET` | List/search threads (`q`, `archived`, `limit`, `cursor`) |
| `/api/v1/threads/{id}` | `GET` | Retrieve thread metadata and status |
| `/api/v1/threads/{id}` | `PATCH` | Update `title` and/or `archived` state |
| `/api/v1/threads/{id}` | `DELETE` | Delete thread conversation records (returns 204) |
| `/api/v1/threads/{id}/messages` | `POST` | Send `{"content":"Your prompt"}`; returns 202 with run ID and events URL |
| `/api/v1/threads/{id}/messages` | `GET` | Read conversation turns (`limit`, `before`) |
| `/api/v1/runs/{id}` | `GET` | Check run status, output, errors, and usage metrics |
| `/api/v1/runs/{id}/events` | `GET` | Live SSE stream with replay cursor support (`?after=` or `Last-Event-ID`) |
| `/api/v1/runs/{id}/cancel` | `POST` | Request cancellation of an active run |
| `/api/v1/threads/{id}/files` | `GET` | List files generated in the thread's workspace (`?path=folder`) |
| `/api/v1/threads/{id}/files/{path}` | `GET` | Download a workspace file as a binary attachment |

All REST calls use `Authorization: Bearer <TOKEN>`. Send an `Idempotency-Key` header when posting messages to safely retry without duplicate executions.

---

## Agent Communication Protocol (ACP 0.2.0)

headlessbob natively implements the text subset of **ACP 0.2.0**. ACP endpoints live at root routes (`/agents`, `/runs`, `/session`) and do not carry the `/api/v1` prefix.

### ACP Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `GET /ping`, `GET /healthz` | `GET` | Unauthenticated public liveness probes |
| `GET /readyz` | `GET` | Authenticated Bob executable/version/key readiness check |
| `GET /agents` | `GET` | Agent discovery listing available agents |
| `GET /agents/headlessbob` | `GET` | Detailed agent capability manifest |
| `POST /runs` | `POST` | Create a run in `sync`, `async`, or `stream` mode |
| `GET /runs/{run_id}` | `GET` | Poll run status, output text, and usage metrics |
| `GET /runs/{run_id}/events` | `GET` | Fetch stored ACP JSON events in execution sequence |
| `POST /runs/{run_id}/cancel` | `POST` | Cancel an in-flight ACP run (returns HTTP 202) |
| `GET /session/{session_id}` | `GET` | Retrieve session workspace ID and run history URNs |

---

## Testing ACP Endpoints (Step-by-Step)

Configure your target URL and authentication token:
```sh
BASE=http://127.0.0.1:8000
TOKEN=owner-token-from-auth-tokens
```

### 1. Agent Discovery & Manifest
```sh
# List available agents
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/agents" | jq .

# Inspect the headlessbob agent manifest and capabilities
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/agents/headlessbob" | jq .
```

### 2. Synchronous Run (`mode: "sync"`)
Waits for the entire task to complete before returning HTTP 200:
```sh
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE/runs" -d '{
    "agent_name": "headlessbob",
    "input": [{"role": "user", "parts": [{"content_type": "text/plain", "content": "Create a file named hello.txt with content Hello World"}]}],
    "mode": "sync"
  }' | jq .
```

### 3. Real-Time Streaming (`mode: "stream"`)
Streams live text chunks and lifecycle events via Server-Sent Events (SSE). Use `curl -N`:
```sh
curl -N -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE/runs" -d '{
    "agent_name": "headlessbob",
    "input": [{"role": "user", "parts": [{"content_type": "text/plain", "content": "Write a Python script that computes Fibonacci numbers."}]}],
    "mode": "stream"
  }'
```

### 4. Asynchronous Run & Polling (`mode: "async"`)
Returns HTTP 202 immediately with `run_id` and `session_id`:
```sh
# Start asynchronous run
RUN_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE/runs" -d '{
    "agent_name": "headlessbob",
    "input": [{"role": "user", "parts": [{"content_type": "text/plain", "content": "Analyze project files"}]}],
    "mode": "async"
  }')
RUN_ID=$(echo $RUN_RESP | jq -r .run_id)
SESSION_ID=$(echo $RUN_RESP | jq -r .session_id)
echo "Run ID: $RUN_ID, Session ID: $SESSION_ID"

# Poll execution status
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/runs/$RUN_ID" | jq .

# Fetch all recorded JSON events
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/runs/$RUN_ID/events" | jq .
```

### 5. Multi-Turn Session Continuation
Pass the `session_id` returned from a prior run to continue executing in the same workspace:
```sh
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE/runs" -d "{
    \"agent_name\": \"headlessbob\",
    \"session_id\": \"$SESSION_ID\",
    \"input\": [{\"role\": \"user\", \"parts\": [{\"content_type\": \"text/plain\", \"content\": \"Now add unit tests for the code generated earlier.\"}]}],
    \"mode\": \"sync\"
  }" | jq .
```

### 6. Cancelling an Active Run
```sh
curl -X POST -s -H "Authorization: Bearer $TOKEN" "$BASE/runs/$RUN_ID/cancel" | jq .
```

---

## Testing with Python Samples

Pre-built Python clients using only Python's standard library are located in [`examples/python/`](examples/python/):

```sh
export HEADLESSBOB_URL="http://127.0.0.1:8000"
export HEADLESSBOB_TOKEN="owner-token-from-auth-tokens"

# 1. Run ACP Task with Live Streaming
python3 examples/python/acp.py --mode stream "Generate a quick HTTP server in Go"

# 2. Continue a previous session
python3 examples/python/acp.py --session "<SESSION_ID>" "Add a health check endpoint to that server"

# 3. Test Asynchronous Task Cancellation
python3 examples/python/cancel.py

# 4. Test REST Thread conversation and file downloads
python3 examples/python/rest.py

# 5. Drive Bob over MCP
python3 examples/python/mcp.py 'Create hello.txt containing Hello from MCP.'
python3 examples/python/mcp.py 'Show me the contents of hello.txt' --thread <THREAD_ID>
python3 examples/python/mcp.py --cancel <RUN_ID>
```

You can also use the interactive CLI test tool:
```sh
npm run client -- /agents
npm run client -- /runs examples/run.json
```

---

## Running Locally

Requires macOS/Linux, Node.js 22.22+, Bob Shell 2.0.4, and an active Bob API key.

```sh
npm ci
cp .env.example .env
# Set BOB_API_KEY and configure AUTH_TOKENS in .env
npm run build
npm start
```

### Running the Test Suite
```sh
npm run check  # TypeScript compilation, HTTP mock fixtures, contract & recovery tests
npm run smoke  # End-to-end smoke test invoking real Bob binary (consumes small credit)
```

---

## Limits, Persistence, and Trust Model

- **Storage**: SQLite stores run metadata, session ownership, task mappings, and ordered events in `DATA_DIR/runs.sqlite`. Bob workspaces are UUID directories under `DATA_DIR/workspaces`. Bob's internal history database lives under `$HOME/.bob`.
- **Concurrency & Limits**: Defaults: 2 concurrent runs, 100 queued tasks, 5-minute timeout, 2 MiB combined stdout/stderr output, and 10,000 protocol events max per run. Agent Client Protocol does not expose cost/turn limits; capabilities report them as `null`.
- **Trust Boundary**: Intended for trusted operators. Bob Shell can execute arbitrary terminal commands; workspace token checks prevent caller crossover but do not provide an OS sandbox between untrusted actors.
- **Process Cleanup**: Subprocesses are spawned in their own process groups and cleaned up with `SIGTERM` followed by `SIGKILL` escalation via `KILL_GRACE_MS`.

---

## OpenShift & Container Deployment

OpenShift manifests are provided under [`openshift/`](openshift/):

```sh
# Deploy BuildConfig and ImageStream
oc apply -n binb -f openshift/build.yaml

# Build image from local archive (including vendor Bob binary)
tar -czf /tmp/headlessbob-build.tgz Dockerfile package.json package-lock.json \
  tsconfig.json src browser spec public examples scripts/container-entrypoint.sh vendor/bobshell-2.0.4.tgz
oc start-build headlessbob -n binb --from-archive=/tmp/headlessbob-build.tgz --follow

# Generate OpenShift Secrets/ConfigMap from local .env
node --env-file=.env scripts/configure-cluster.mjs
oc apply -n binb -f openshift/app.yaml
oc rollout status deployment/headlessbob -n binb
```

---

## Related Building Blocks

- [Headless Bob Building Block Overview](../../README.md)
- [Agentic SDLC](../../../agentic-sdlc/README.md)
- [Code Modernization](../../../code-modernization/README.md)
- [Integrate as Code](../../../integrate-as-code/README.md)

## Container Bob Shell version

The container pins Bob Shell **2.0.4** (released September 16, 2026) on Node.js 24. Download the licensed package with `sh scripts/download-bob.sh` before building. Both the download script and Docker build verify its pinned SHA-256 checksum. The package remains excluded from Git. Runtime readiness accepts the previously tested 2.0.1 and 2.0.4 releases.

---

## MCP access to Bob

Connect a remote MCP client to `https://<your-host>/mcp` using Streamable HTTP
and the header `Authorization: Bearer <service-token>`. Use the service token
from `AUTH_TOKENS`, not `BOB_API_KEY`. The client must support configured bearer
headers; OAuth discovery/sign-in is not implemented. Tokens resolve to the same
caller identities and ownership checks used by REST. Every request is authenticated.
As with REST, token-free access is available only in the existing local development
configuration; configure `AUTH_TOKENS` for authenticated access. Browser Origin
requests are rejected on this endpoint.

Available tools:

| Tool | Arguments | Result |
| --- | --- | --- |
| `bob_create_thread` | Optional `title` | Thread including `id` |
| `bob_send_message` | `thread_id`, `content`, `request_id` | Thread, run, message ID |
| `bob_get_run` | `run_id` | Status, completed output, reported usage |
| `bob_cancel_run` | `run_id` | Current cancellation/run status |

Create a thread, send a message, then poll `bob_get_run` every few seconds until
`completed`, `failed`, or `cancelled`. Save the thread ID for follow-ups. These
threads appear in the web UI for the same caller. Bob operates in the server
workspace; this interface does not transfer files from the client's machine.

`request_id` is required when sending: use a unique value per intended message
(1–128 letters, digits, dots, underscores, colons or hyphens). On retry, reuse it
with the same thread and content to retrieve the original run. Reusing it with
different content returns a tool error. Thread creation itself is not idempotent.

The transport is stateless with JSON responses: no MCP session ID, GET event
stream or DELETE session endpoint is required. Bob state persists separately in
SQLite. Disconnecting does not cancel a run; use `bob_cancel_run`. Existing run
limits, queueing, thread recovery rules and trusted-operator requirements apply.
Tool failures return `isError: true`; missing/invalid credentials return HTTP 401.

Example with the MCP TypeScript SDK (read credentials from your environment):

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'bob-client', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(
  new URL('/mcp', process.env.HEADLESSBOB_URL),
  { requestInit: { headers: { Authorization: `Bearer ${process.env.HEADLESSBOB_TOKEN}` } } }
));
const thread = await client.callTool({ name: 'bob_create_thread', arguments: { title: 'Demo' } });
const started = await client.callTool({
  name: 'bob_send_message',
  arguments: { thread_id: thread.structuredContent.id, content: 'Create hello.txt containing hello.', request_id: 'demo-1' }
});
console.log(started.structuredContent.run.run_id);
await client.close(); // The Bob run continues; reconnect and use bob_get_run.
```

Run `npx tsx --test tests/mcp.test.ts` for SDK client integration coverage using
the Bob fixture. It verifies authentication, ownership, retries, continuation,
cancellation, and shared REST history without spending Bob credit.
