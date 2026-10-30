# Agentic SOC — Research & Decisions

**Feature**: Automated QRadar Offense Response Pipeline

---

## 1. IBM watsonx Orchestrate Agent Framework

### 1.1 Agent Style: `react_core`
All agents use `style: react_core` in their YAML. WxO may report `react_intrinsic` for supervisor
agents (with collaborators) in `orchestrate agents list -v`. This is normal platform behavior,
not an import failure.

### 1.2 Tool Import Pattern
```bash
orchestrate tools import -k python -f tools/<file>.py -r tools/requirements.txt [-a <app_id>]
```
`-a <app_id>` binds the WxO connection. Must match the `app_id` in `expected_credentials`:
- COS tools: `-a soc-cos-data`
- Mailjet tools: `-a soc-mailjet`

### 1.3 Agent Collaborator Binding
Collaborators are declared in the supervisor YAML. The bootstrap script must import sub-agents
before the supervisor, as WxO validates collaborator names at import time.

---

## 2. Key Technical Decisions

### 2.1 Why Express 4 (not 5)?
Express 5 removes `app.get('*', ...)` wildcard route syntax. The catch-all route in `server.js`
requires Express 4. Upgrading to Express 5 would break the SPA fallback.

### 2.2 Why Next.js Route Handlers for some routes?
The `next.config.js` rewrite engine uses `http-proxy` with a 30-second socket timeout.
Long-running WxO calls (2–5 min for RCA) would time out. Routes `/api/poc-stages/*` and
`/api/chat-conv/:runId` are Route Handlers with `maxDuration: 120s` to bypass this limit.

### 2.3 Why not `jsonwebtoken` for WxO embed JWT?
The WxO embed JWT is hand-crafted using Node's built-in `crypto.createSign('RSA-SHA256')`.
This avoids adding an npm dependency for a single use case. The token shape is simple:
`{ sub: 'embed-user', iat, exp: iat + 3600 }`.

### 2.4 Why `pydantic==2.13.3` (pinned)?
The WxO tool execution sandbox has a specific Pydantic version installed. Pinning ensures
compatibility and prevents silent validation failures due to Pydantic v2 API changes.

### 2.5 Why COS direct HTTP in tools (not `ibm-cos-sdk`)?
Python tools run inside WxO's isolated sandbox. Installing heavy SDKs via `requirements.txt`
increases cold-start time and risks version conflicts. Direct `requests.get()` with an IAM
bearer token is simpler, faster, and equally secure.

The Next.js `config-files/route.ts` uses `ibm-cos-sdk` (S3 SDK) because it runs in Node.js
where the SDK is pre-installed as part of `package.json`.

### 2.6 Why Dual-Mode Design (Mock Demo Default + Live WxO Toggle)?
Customer demonstrations and sales/enablement presentations require an immediately operational, highly realistic walkthrough of the full multi-agent SOC investigation without requiring active watsonx Orchestrate instance credentials or network dependencies.

- **Mock Mode (Default on Load)**:
  - The UI loads into Mock Mode by default.
  - All pipeline stages execute end-to-end as-is (Triage → Classification → RCA → Notification → Action).
  - Progressive execution timing (~5.0s per stage), status updates, tool calls with arguments and outputs, and human-in-the-loop Action approval run locally.
  - The application looks purely as live for demonstration purposes, with zero WxO instance dependency.
- **Live Mode (WxO Connected)**:
  - Users toggle into Live Mode via the Navbar.
  - The UI connects directly to the live watsonx Orchestrate instance through the Express backend proxy.
  - Agents and tools execute exclusively on the remote WxO instance.

### 2.7 Why the Action Agent is excluded from the PoC supervisor?
The conversational supervisor is designed for interactive, step-by-step analyst guidance.
Including the Action Agent would require the supervisor to manage an additional approval gate
mid-conversation, complicating the UX. The Action Agent is available as a standalone WxO
agent for direct invocation.

---

## 3. IBM Cloud Object Storage

### 3.1 URL pattern
```
{COS_ENDPOINT}/{COS_BUCKET}/{object_key}
```
All objects at bucket root (no subdirectories). Path-style access (not virtual-hosted).

### 3.2 UTF-8 BOM Issue
QRadar and Windows CSV exports often include a BOM (`\ufeff`) at the start of the first header.
This causes the first column to be named `\ufeffid` instead of `id`, breaking field lookups.
Solution: `resp.text.lstrip('\ufeff')` before passing to `csv.DictReader`.

---

## 4. Security Considerations

| Area | Decision | Rationale |
|---|---|---|
| CORS | Open (`cors()`, no origin restriction) | PoC; analyst-facing internal tool only |
| IAM tokens | Memory only, 50-min TTL, never logged | Prevent credential leakage in logs |
| `.env` | Never committed; in `.gitignore` | Standard secret management |
| Action approval | Always required for remediation | Human-in-the-loop; no autonomous execution |
| Rate limiting | Not implemented | PoC; single-user demo environment |
| `helmet` | Not installed | PoC; would require additional configuration for no benefit |

---

## 5. Known Limitations

1. **No live QRadar API**: Reads pre-exported CSVs. Live integration is Phase 2.
2. **Single-user session**: stage outputs live in React state only and are lost on refresh. No server-side session management.
3. **No audit log persistence**: Tool call logs exist in WxO traces only. No separate audit database.
4. **Mailjet required for email**: If Mailjet is unconfigured, the Notify Agent will fail and the stage shows the failure.
5. **Thread state**: WxO thread_id links conversation history but is not persisted across browser sessions.
