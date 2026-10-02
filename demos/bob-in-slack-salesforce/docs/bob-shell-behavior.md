# Bob Shell behavior this service depends on

Facts verified against a real Bob Shell binary, with the date and version.
Re-verify each item when the pinned Bob version changes; the silent-ignore
behaviors below make regressions invisible otherwise.

## Versions

| Item | Value | Verified |
|---|---|---|
| Pinned in the container image | 2.0.4 (commit 01dddf684); SHA-256 of the tarball pinned in the Dockerfile | 2026-09-21 |
| Previously validated | 2.0.1 (commit e6a3e508); `bob acp` already present there although the changelog announces ACP under 2.0.2 | 2026-09-18 |
| Live validation on 2.0.4 (`scripts/verify_bob_version.sh`) | option set unchanged; permission ids `allow` / `reject` unchanged; read-only turn refused a write, approved turn wrote; execute permission `title` is the command text | 2026-09-21 |
| Auto-update | on by default (`bobShell.autoUpdate` in the user settings); the update check runs at startup. Disable it in seeded settings for containers. | 2026-09-18 |

## `bob acp` (Agent Client Protocol) — the engine this service uses

Command-line options, exactly as the binary reports them: `--log-level`,
`--trust`, `--auto-approve`, `--disable-mcp`, `--disable-subagents`,
`--accept-license`. Authentication is taken from `BOBSHELL_API_KEY` in the
process environment; without it Bob tries the SSO browser flow, which cannot
work headless. `BOB_API_KEY` is accepted as an alias by the bundle, but the
documented name is `BOBSHELL_API_KEY`.

Protocol behavior observed (2026-09-03 on 2.0.1, re-confirmed 2026-09-21 on 2.0.4):

- `initialize` with `protocolVersion: 1` succeeds. Bob advertises
  `loadSession` and session resume/list/delete/close capabilities.
- `session/new` requires an absolute `cwd`; in a workspace that was never
  trusted interactively it fails unless Bob was started with `--trust`.
  Bob's own `.bob/mcp.json` in the workspace is honored even when the
  client passes an empty `mcpServers` list.
- `session/prompt` returns `{stopReason}`; `end_turn` and
  `max_turn_requests` are the normal completions.
- Streaming arrives as `session/update` notifications with
  `sessionUpdate` values including `agent_message_chunk`, `tool_call`,
  `tool_call_update`, `session_info_update`.
- With `--trust` and without `--auto-approve`, Bob sends
  `session/request_permission` before sensitive tool calls. The options it
  offers carry these ids and kinds:
  `allow` (allow_once), `allow_always` (allow_always), `reject`
  (reject_once), `reject_always` (reject_always). The `toolCall.kind` field
  distinguishes `read`, `search`, `fetch`, `think`, `edit`, `delete`,
  `move`, `execute`.
- An `execute` permission request carries the command text as the
  `toolCall.title` (seen on 2.0.4: title `echo probe`, kind `execute`). The
  command deny-list matches on title and, when present, `rawInput`;
  `scripts/verify_bob_version.sh` prints the payload seen per version.
- ACP reports no spend. Cost is read from Bob's own session store
  (`$HOME/.bob/db/bob.db`, table `tasks`, column `costs`), where the ACP
  `sessionId` equals the task id.
- ACP sessions are process-bound: killing the `bob acp` process ends the
  live session. Conversation state persists in the session store and is
  recoverable through `session/load`.
- The documented warning applies: `--trust` together with `--auto-approve`
  removes both the workspace gate and per-tool approval. This service never
  passes `--auto-approve`.
- Each ACP session starts its own MCP harness, so a stdio MCP server
  configured in the workspace runs once per live session.

## `bob run` (non-interactive) — the older engine, kept for reference

Verified 2026-08-18 and 2026-08-28 on 2.0.1:

- `bob run --format stream-json` emits one JSON object per line:
  `{"type":"message","role":"assistant","content":…}` in many small chunks,
  then `{"type":"result","status":"success","stats":{task_id, duration_ms,
  session_costs, max_cost, tool_calls}}`. Assistant text must be assembled
  from chunks. `session_costs` is cumulative for the task.
- `--resume <task-id>` in a new process recalls the earlier conversation.
  Two concurrent resumes of the same task both succeed; Bob's task locking
  serializes them.
- Every tool call is pre-approved in this mode, even without `--trust`.
  Safety must be imposed externally: `--disable-tool-groups`, workspace
  isolation, `--max-cost`, `--max-turns`.
- `--disable-tool-groups` silently ignores unknown group names. The list
  that actually blocks file creation on 2.0.1 is
  `edit,write,command,execute,shell,filesystem,terminal,browser,mcp,subagent`;
  shorter lists do not. `scripts/verify_readonly.sh` re-checks this live.
- Tool restrictions bind only the run that creates a task. A task created
  restricted and resumed without flags writes; a task resumed with the full
  disable list writes anyway. Reported to the Bob team. This is why the
  older engine never resumed read-only turns, and one reason the service
  moved to ACP, where permission is decided per call.
- Simultaneous task creation under one `$HOME` can fail with
  `database is locked` (SQLite contention in Bob's store). Per-tenant homes
  avoid cross-tenant contention; within a tenant, retry with jitter.
- Memory: about 370 to 390 MB resident per `bob` process on trivial prompts.
- `bob --list-tasks` on 2.0.1 fails standalone with "Invalid --prompt"; the
  task id is taken from the result event instead.

## MCP and skills

- Headless Bob discovers MCP servers from the workspace `.bob/mcp.json`
  (`{"mcpServers": {name: {command, args, env}}}`), lists their tools and
  calls them. Verified 2026-08-28 with a stdio server.
- HTTP servers use `{"url": ..., "transportType": "http", "headers": {...},
  "timeout": 30000}` (the shape `bob mcp add` writes; `type` is ignored).
  Verified 2026-09-24 on 2.0.4: a headless session read the service's
  `.bob/mcp.json`, initialized the Streamable HTTP endpoint with a bearer
  header, and called a tool (`describe_object`) during a prompt. The client
  posts notifications (expect 202), tries GET once (405 is fine), and sends
  no `Origin` header.
- `bob mcp add` only writes when `.bob/mcp.json` already exists; write the
  file yourself.
- `session/load` on 2.0.4 replays the history during the NEXT
  `session/prompt`, not before answering the load: after the prompt goes
  out, Bob sends `available_commands_update`, then each prior turn as a
  `user_message_chunk` followed by its `agent_message_chunk`, then the new
  answer's chunks, with no marker in between. The current prompt is not
  echoed. Verified 2026-09-24 by a two-turn probe across a process restart.
  The runner strips the replay by matching it against the replies the jobs
  layer stored for the session (`_ReplayFilter`); a resumed turn's text is
  only its own answer.
- Custom modes and skills under the workspace `.bob/` directory are honored
  headless, which is how a deployment seeds Bob with domain skills.
