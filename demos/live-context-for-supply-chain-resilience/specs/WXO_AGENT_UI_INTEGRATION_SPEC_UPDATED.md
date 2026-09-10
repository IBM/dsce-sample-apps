# watsonx Orchestrate Agent → Custom UI Integration Specification

**Use case:** Turnaround Supply Chain Intelligence (TSCI)  
**Target:** Custom web UI calling a watsonx Orchestrate native agent  
**Cloud:** IBM Cloud  
**Verified against IBM docs:** 2026-08-27

## 1. Goal

The UI must support:

- new chat
- send/continue conversation
- list chat history
- open a previous chat and load messages
- rename/delete chat
- optional streaming later
- secure use of the IBM Cloud API key and watsonx Orchestrate service-instance URL

For the current demo, the agent reads only:

```text
supply.approved_vendor.changed
```

The UI must not call Confluent directly. It calls watsonx Orchestrate; the agent calls Confluent RTCE through its configured MCP tools.

## 2. Architecture

Use a Backend-for-Frontend (BFF):

```text
Browser UI
   |
   | application auth
   v
Application BFF
   |- stores IBM API key
   |- exchanges/caches IAM token
   |- enforces user -> thread ownership
   |- calls wxO REST APIs
   v
watsonx Orchestrate
   |- Threads API
   |- Agent Chat API
   v
TSCI agent
   v
Confluent RTCE MCP
   v
supply.approved_vendor.changed
```

Never put the IBM API key, IAM token, Confluent key, or MCP credential in browser code, localStorage, or frontend environment variables.

## 3. Backend configuration

```bash
# Copy exactly from:
# Profile -> Settings -> API details -> Service instance URL
WXO_SERVICE_INSTANCE_URL="https://<hostname>/instances/<tenant_id>"

# IBM Cloud IAM API key - server side only
WXO_API_KEY="<ibm-cloud-iam-api-key>"

WXO_ENVIRONMENT_NAME="live"

# Prefer an immutable UUID in production
WXO_AGENT_ID="<agent-uuid>"

# Optional only for startup/deployment discovery
WXO_AGENT_NAME="crag_rag_agent_v1"

# Label shown in your UI
WXO_AGENT_DISPLAY_NAME="Approved Vendor Intelligence Agent"
```

Use `crag_rag_agent_v1` only as the internal watsonx Orchestrate agent name.

Do not expose `crag_rag_agent_v1` as the user-facing name in the UI. Use a business-friendly display name such as:

```text
Approved Vendor Intelligence Agent
```

Recommended mapping:

```text
Internal wxO agent name : crag_rag_agent_v1
UI display name         : Approved Vendor Intelligence Agent
Short UI label          : AVL Agent
```

The UI must use the immutable `WXO_AGENT_ID` for API calls. `WXO_AGENT_NAME` is only for discovery/validation.

Normalize the service URL:

```ts
const WXO_BASE =
  process.env.WXO_SERVICE_INSTANCE_URL!.replace(/\/$/, "");
```

Current IBM ADK API pages verified on 2026-08-27 show the relevant routes directly under the service instance URL as `/v1/...` and `/v2/...`.

Examples:

```text
${WXO_BASE}/v1/threads
${WXO_BASE}/v1/orchestrate/{agent_id}/chat/completions
```

Do not add an extra `/api` unless your tenant's live API reference explicitly shows it.

## 3.1 Agent naming convention

Use three separate identifiers and do not mix them:

| Purpose | Value |
|---|---|
| Internal watsonx Orchestrate agent name | `crag_rag_agent_v1` |
| Immutable runtime identifier | `WXO_AGENT_ID=<agent-uuid>` |
| User-facing UI name | `Approved Vendor Intelligence Agent` |
| Short label where space is limited | `AVL Agent` |

Recommended UI presentation:

```text
Approved Vendor Intelligence Agent
Live approved-vendor context from Confluent RTCE
```

Alternative business-friendly UI names that are acceptable if product/design prefers them:

```text
AVL Intelligence Agent
Approved Vendor Agent
Turnaround Vendor Intelligence
Supplier Approval Intelligence Agent
```

Preferred default:

```text
Approved Vendor Intelligence Agent
```

Do not show `crag_rag_agent_v1` in page titles, chat headers, starter cards, or customer-facing error messages.

## 4. Get the cloud endpoint

In watsonx Orchestrate:

```text
Profile
 -> Settings
 -> API details
 -> Service instance URL
```

IBM documents the IBM Cloud format as:

```text
https://<hostname>/instances/<tenant_id>
```

Use the copied URL exactly.

## 5. Authentication

For IBM Cloud, standardize on IAM access tokens.

### Token request

```http
POST https://iam.cloud.ibm.com/identity/token
Content-Type: application/x-www-form-urlencoded
```

Body:

```text
grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=<WXO_API_KEY>
```

Example:

```bash
curl -X POST   "https://iam.cloud.ibm.com/identity/token"   -H "Content-Type: application/x-www-form-urlencoded"   --data-urlencode "grant_type=urn:ibm:params:oauth:grant-type:apikey"   --data-urlencode "apikey=${WXO_API_KEY}"
```

Read `access_token`, `expires_in`, and/or `expiration` from the response.

Use this header on wxO requests:

```http
Authorization: Bearer <IAM_ACCESS_TOKEN>
```

Backend requirements:

- cache the IAM token;
- refresh about 5 minutes before expiry;
- on wxO `401`, refresh and retry once;
- never send the token/API key to the browser;
- never log secrets.

## 6. Discover the deployed agent

Preferred production setup: discover once, then configure `WXO_AGENT_ID`.

### Deployed agents by environment

```http
GET ${WXO_BASE}/v1/orchestrate/agents/environment/{environment_name}/releases
Authorization: Bearer <token>
```

Typical production call:

```text
GET /v1/orchestrate/agents/environment/live/releases
```

Useful response fields include:

```json
{
  "id": "<agent-uuid>",
  "name": "<agent-name>",
  "display_name": "<display-name>",
  "version_label": 1,
  "deployment_status": "<status>"
}
```

IBM also exposes:

```http
GET ${WXO_BASE}/v2/orchestrate/agents/unified
```

with filters such as `names`, `ids`, `query`, `limit`, and `offset`.

## 7. Endpoint matrix

| Capability | Method | wxO endpoint |
|---|---|---|
| Discover deployed agent | GET | `/v1/orchestrate/agents/environment/{environment_name}/releases` |
| Search agents | GET | `/v2/orchestrate/agents/unified` |
| Create new chat | POST | `/v1/threads` |
| List chats | GET | `/v1/threads?agent_id={agent_id}&limit={n}&offset={n}` |
| Get chat metadata | GET | `/v1/threads/{thread_id}` |
| Rename/update chat | PATCH | `/v1/threads/{thread_id}` |
| Delete chat | DELETE | `/v1/threads/{thread_id}` |
| Load messages | GET | `/v1/threads/{thread_id}/messages` |
| Chat with agent | POST | `/v1/orchestrate/{agent_id}/chat/completions` |
| Continue chat | POST | same endpoint + `X-IBM-THREAD-ID` |
| Native run | POST | `/v1/orchestrate/runs` |
| Native streaming run | POST | `/v1/orchestrate/runs/stream` |

For this UI, use **Threads API + Agent Chat Completions API** first.

## 8. Create a new chat

Browser calls your BFF:

```http
POST /api/agent/chats
Content-Type: application/json
```

```json
{
  "title": "Approved Vendor Investigation"
}
```

BFF calls wxO:

```http
POST ${WXO_BASE}/v1/threads
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "assistant_id": null,
  "agent_id": "<WXO_AGENT_ID>",
  "title": "Approved Vendor Investigation",
  "context": {}
}
```

Store an application-level ownership mapping:

```text
application_user_id
wxo_thread_id
wxo_agent_id
title
created_at
```

This mapping is mandatory if the backend uses one shared IBM identity.

## 9. Send a message

BFF calls:

```http
POST ${WXO_BASE}/v1/orchestrate/{agent_id}/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
X-IBM-THREAD-ID: <thread_id>
```

IBM documents `X-IBM-THREAD-ID` as the optional header used to identify the conversation thread. The response also contains `thread_id`.

For normal text chat, use the OpenAI-style message form:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Show me the latest approved-vendor changes."
    }
  ],
  "context": {},
  "additional_parameters": {},
  "stream": false
}
```

The IBM-generated agent API schema supports richer structured content as well, so the response parser must not assume every future content item is only plain text.

Browser-facing BFF route:

```http
POST /api/agent/chats/{threadId}/messages
```

```json
{
  "message": "Show all changes for supplier SUP-205 and material CVA-8842."
}
```

BFF logic:

```text
1. Authenticate application user.
2. Verify thread belongs to that user.
3. Get/cached-refresh IBM IAM token.
4. POST to wxO chat/completions.
5. Set X-IBM-THREAD-ID.
6. Normalize response.
7. Return assistant message.
```

## 10. Continue the same conversation

Do not create a thread for each message.

Every follow-up in the same UI chat uses:

```http
X-IBM-THREAD-ID: <existing-thread-id>
```

A new UI chat creates a new wxO thread ID.

## 11. List chat history

wxO:

```http
GET ${WXO_BASE}/v1/threads?agent_id=${WXO_AGENT_ID}&limit=30&offset=0
Authorization: Bearer <token>
```

The response includes thread data such as:

```text
id
title
agent_id
status
created_on
updated_at
```

### Critical security rule

If one IBM API key is shared by the backend, never expose the raw global wxO thread list to all application users.

Maintain:

```text
app_user_id -> wxo_thread_id
```

The BFF must return only threads owned by the authenticated application user.

## 12. Open a previous chat

Thread:

```http
GET ${WXO_BASE}/v1/threads/{thread_id}
Authorization: Bearer <token>
```

Messages:

```http
GET ${WXO_BASE}/v1/threads/{thread_id}/messages
Authorization: Bearer <token>
```

Message objects can contain:

```text
id
thread_id
role
content
created_on
updated_at
additional_properties
context
step_history
message_state
```

Normalize these into your own stable frontend DTO.

Example:

```json
{
  "thread": {
    "id": "...",
    "title": "Approved Vendor Investigation",
    "updatedAt": "..."
  },
  "messages": [
    {
      "id": "...",
      "role": "user",
      "text": "Show me the latest approved-vendor changes.",
      "createdAt": "..."
    },
    {
      "id": "...",
      "role": "assistant",
      "text": "...",
      "createdAt": "..."
    }
  ]
}
```

## 13. Rename and delete

Rename:

```http
PATCH ${WXO_BASE}/v1/threads/{thread_id}
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "title": "SUP-205 Approved Vendor Timeline"
}
```

Delete:

```http
DELETE ${WXO_BASE}/v1/threads/{thread_id}
Authorization: Bearer <token>
```

Always validate ownership first.

## 14. Recommended BFF API exposed to the UI

| Browser endpoint | Purpose |
|---|---|
| `GET /api/agent/info` | Business-friendly UI agent title + starter prompts |
| `POST /api/agent/chats` | Create chat |
| `GET /api/agent/chats` | Current user's history |
| `GET /api/agent/chats/:threadId` | Thread + messages |
| `PATCH /api/agent/chats/:threadId` | Rename |
| `DELETE /api/agent/chats/:threadId` | Delete |
| `POST /api/agent/chats/:threadId/messages` | Send/continue chat |
| `POST /api/agent/chats/:threadId/messages/stream` | Optional later |

Example `/api/agent/info`:

```json
{
  "id": "<agent-id>",
  "name": "Approved Vendor Intelligence Agent",
  "description": "Live approved-vendor intelligence grounded through Confluent RTCE.",
  "starterPrompts": [
    "Show me the latest approved-vendor changes.",
    "Show all approved-vendor changes for supplier SUP-205.",
    "Show all approved-vendor changes for material CVA-8842.",
    "Show all events for correlation ID DEMO-TW2047-001.",
    "Refresh the live approved-vendor context now and tell me what changed."
  ]
}
```

## 15. Optional streaming

Implement after non-streaming chat/history is stable.

IBM exposes:

```http
POST ${WXO_BASE}/v1/orchestrate/runs/stream
```

The streaming Runs API can emit events including:

```text
run.started
run.completed
run.failed
run.step.started
run.step.completed
run.step.delta
run.step.thinking
message.created
message.started
message.delta
message.completed
message.interrupt
error
done
planning
```

Use it if the UI needs detailed tool/run progress.

For basic chat token streaming, the Chat Completions API also supports `stream: true`.

## 16. Native Runs API

Alternative:

```http
POST ${WXO_BASE}/v1/orchestrate/runs
```

It supports `thread_id`, `agent_id`, `environment_id`, `version`, `context`, `context_variables`, and returns identifiers including:

```json
{
  "thread_id": "<uuid>",
  "run_id": "<uuid>",
  "task_id": "<uuid>",
  "message_id": "<uuid>"
}
```

Use Runs for long-duration workflows or explicit run lifecycle tracking. Use Chat Completions for the first TSCI Q&A UI.

## 17. TSCI starter queries

For the current single-topic phase, use only questions supported by:

```text
supply.approved_vendor.changed
```

Examples:

```text
Show me the latest approved-vendor changes.

Show all approved-vendor changes for supplier SUP-205.

Show all approved-vendor changes for material CVA-8842.

Show the approved-vendor history for SUP-205 and CVA-8842.

Show all approved-vendor events for correlation ID DEMO-TW2047-001.

What is the latest approved-vendor change for SUP-205 and CVA-8842?

Who authorised the latest change?

Why was the latest approved-vendor change made?

Refresh the live approved-vendor context now and tell me what changed.
```

Do not expose starter prompts for the other supply-chain topics until those RTCE tables have been validated.

## 18. Chat retention

watsonx Orchestrate has tenant-level chat data retention settings.

The UI must:

- not assume history is permanent;
- gracefully handle expired/deleted threads;
- remove stale local ownership mappings;
- not create a permanent copy of message content unless your application has an approved retention policy.

## 19. Security requirements

Mandatory:

1. IBM API key is backend-only.
2. IAM token is backend-only.
3. Confluent/MCP credentials remain inside wxO connections.
4. Every BFF endpoint uses your application's user authentication.
5. Every thread read/write checks ownership.
6. Production is restricted to configured `WXO_AGENT_ID`.
7. Apply rate limits and message-size limits.
8. Render agent output as untrusted text/markdown, not trusted raw HTML.
9. Do not log credentials.
10. If supported by your IBM Cloud networking setup, consider the watsonx Orchestrate private service endpoint for backend-to-wxO traffic.

## 20. Error mapping

| Condition | BFF behavior |
|---|---|
| IAM token failure | `502 WXO_AUTH_FAILED` |
| wxO 401 | refresh token once; then `502 WXO_AUTH_FAILED` |
| wxO 403 | `403 AGENT_ACCESS_DENIED` |
| thread missing | `404 CHAT_NOT_FOUND` |
| wrong user owns thread | `404 CHAT_NOT_FOUND` |
| wxO 422 | `400 INVALID_AGENT_REQUEST` |
| wxO 429 | `429 AGENT_RATE_LIMITED` |
| wxO 5xx | `502 AGENT_UNAVAILABLE` |
| timeout | `504 AGENT_TIMEOUT` |

Do not blindly retry a message POST after an uncertain network failure because the request may already have reached the agent.

## 21. Observability

Safe fields to log:

```text
request_id
application_user_id
thread_id
agent_id
HTTP method
wxO path
status_code
latency_ms
```

Never log:

```text
WXO_API_KEY
IAM access token
Confluent key/secret
MCP Authorization header
```

## 22. Implementation order for Bob

```text
Phase 1
  1. Environment variables
  2. IAM token exchange/cache
  3. Agent discovery diagnostic

Phase 2
  4. Create thread
  5. User/thread ownership store
  6. List owned threads
  7. Get thread/messages
  8. Rename/delete

Phase 3
  9. Chat completions client
 10. X-IBM-THREAD-ID continuation
 11. Normalize responses
 12. Error mapping

Phase 4
 13. Chat sidebar
 14. New chat
 15. Conversation view
 16. Composer
 17. Starter prompts
 18. Loading/error states

Phase 5
 19. Optional SSE streaming
 20. Optional Native Runs progress
```

## 23. Acceptance criteria

- [ ] Backend obtains IAM token from API key.
- [ ] No IBM credential reaches browser.
- [ ] Target `crag_rag_agent_v1` agent UUID is configured/resolved.
- [ ] New chat creates a wxO thread.
- [ ] Follow-up sends the same `X-IBM-THREAD-ID`.
- [ ] History lists only current application user's chats.
- [ ] Previous chat loads messages.
- [ ] Rename works.
- [ ] Delete works.
- [ ] Cross-user thread access is blocked.
- [ ] `Show me the latest approved-vendor changes.` works.
- [ ] `SUP-205`, `CVA-8842`, and `DEMO-TW2047-001` queries work.
- [ ] A newly materialized RTCE event can appear in a subsequent fresh agent request.

## 24. Smoke-test commands

```bash
export WXO_BASE="<service-instance-url>"
export IAM_TOKEN="<iam-access-token>"
export WXO_AGENT_ID="<agent-uuid>"
```

Create chat:

```bash
curl -sS -X POST   "${WXO_BASE}/v1/threads"   -H "Authorization: Bearer ${IAM_TOKEN}"   -H "Content-Type: application/json"   -d "{
    \"assistant_id\": null,
    \"agent_id\": \"${WXO_AGENT_ID}\",
    \"title\": \"TSCI API Test\",
    \"context\": {}
  }"
```

Then:

```bash
export THREAD_ID="<returned-thread-id>"
```

Send message:

```bash
curl -sS -X POST   "${WXO_BASE}/v1/orchestrate/${WXO_AGENT_ID}/chat/completions"   -H "Authorization: Bearer ${IAM_TOKEN}"   -H "Content-Type: application/json"   -H "X-IBM-THREAD-ID: ${THREAD_ID}"   -d '{
    "messages": [
      {
        "role": "user",
        "content": "Show me the latest approved-vendor changes."
      }
    ],
    "context": {},
    "additional_parameters": {},
    "stream": false
  }'
```

Load messages:

```bash
curl -sS   "${WXO_BASE}/v1/threads/${THREAD_ID}/messages"   -H "Authorization: Bearer ${IAM_TOKEN}"
```

List chats:

```bash
curl -sS   "${WXO_BASE}/v1/threads?agent_id=${WXO_AGENT_ID}&limit=20&offset=0"   -H "Authorization: Bearer ${IAM_TOKEN}"
```

## 25. Do not implement

Do not:

- call Confluent RTCE MCP directly from the browser;
- expose the Confluent MCP endpoint as the chat API;
- expose wxO or Confluent API keys;
- create a new thread per message;
- continue a chat without its thread ID;
- rely on the global wxO thread list for app authorization;
- hard-code `crag.*` into the UI;
- make the frontend query Kafka/RTCE itself;
- duplicate agent business logic in the UI.

## 26. Official references

- IBM — Getting the API endpoint  
  https://www.ibm.com/docs/en/watsonx/watson-orchestrate/base?topic=api-getting-endpoint

- IBM — Getting started with the API  
  https://www.ibm.com/docs/en/watsonx/watson-orchestrate/base?topic=api-getting-started

- IBM — Generating IBM Cloud access token  
  https://www.ibm.com/docs/en/watsonx/watson-orchestrate/base?topic=api-generating-access-token-cloud

- IBM ADK — Chat With Agents  
  https://developer.watson-orchestrate.ibm.com/apis/orchestrate-agent/chat-with-agents

- IBM ADK — Create Message Thread  
  https://developer.watson-orchestrate.ibm.com/apis/message-threads/create-message-thread

- IBM ADK — List Message Threads  
  https://developer.watson-orchestrate.ibm.com/apis/message-threads/list-message-threads

- IBM ADK — Get Message Thread By Id  
  https://developer.watson-orchestrate.ibm.com/apis/message-threads/get-message-thread-by-id

- IBM ADK — List Messages  
  https://developer.watson-orchestrate.ibm.com/apis/message-threads/list-messages

- IBM ADK — Update Message Thread  
  https://developer.watson-orchestrate.ibm.com/apis/message-threads/update-message-thread

- IBM ADK — Delete Message Thread  
  https://developer.watson-orchestrate.ibm.com/apis/message-threads/delete-message-thread

- IBM ADK — List Versioned Agents By Environment  
  https://developer.watson-orchestrate.ibm.com/apis/agent-releases/list-versioned-agents-by-environment-name

- IBM ADK — List Unified Agents  
  https://developer.watson-orchestrate.ibm.com/apis/agents-v2/list-unified-agents

- IBM ADK — Native Runs API  
  https://developer.watson-orchestrate.ibm.com/apis/orchestrate-agent/chat-with-orchestrate-assistant

- IBM ADK — Streaming Runs API  
  https://developer.watson-orchestrate.ibm.com/apis/orchestrate-agent/chat-with-orchestrate-assistant-as-stream

- IBM — Integrating agents with web applications  
  https://www.ibm.com/docs/en/watsonx/watson-orchestrate/base?topic=integrating-agents-web-applications

- IBM — Chat retention / instance settings  
  https://www.ibm.com/docs/en/watsonx/watson-orchestrate/base?topic=instance-managing-settings

- IBM-published Agent Chat OpenAPI contract  
  https://github.com/watson-developer-cloud/watsonx-orchestrate-developer-toolkit/blob/main/external_agent/spec.yaml
