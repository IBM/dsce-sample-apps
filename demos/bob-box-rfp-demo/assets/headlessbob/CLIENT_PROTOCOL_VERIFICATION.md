# Shared Agent Client Protocol runtime — 2026-09-22

## Result

Verified in the container with Bob Shell 2.0.4 (commit 01dddf684): both REST and Agent Communication Protocol 0.2.0 HTTP APIs use Bob's Agent Client Protocol.

```text
Partner → Agent Communication Protocol HTTP/SSE → RunManager
        → BobClientRuntime → Agent Client Protocol → bob acp
```

Both `/api/v1` REST requests (including the web UI) and partner Agent Communication Protocol requests now use `BobClientRuntime` by default in `createApp`. The old `BobRuntime` is retained for historical-contract tests and migration verification. These changes are local; the deployed service has not been updated.

## Reproduce

With Bob 2.0.4 installed and `BOB_API_KEY` configured in `.env`:

```sh
npm run smoke:client-bridge
```

This is a live model test, not a mock. It uses a temporary service database and temporary workspaces, launches Bob with workspace trust and MCP/subagents disabled, and approves tool permission requests with `allow_once`. It creates a test file and cancels a sleeping shell command. The database and workspaces are removed afterwards; Bob may retain its own task history in its existing home directory. Bob ACP cost/turn limits are not enforced by this adapter.

## Verified flows

| Test | Result |
| --- | --- |
| HTTP `GET /agents` | Existing discovery works with injected runtime |
| `initialize` | Bob negotiates Agent Client Protocol version 1 |
| REST thread message | Real Bob reply verified in the run and persisted thread messages |
| HTTP synchronous `POST /runs` | Translates to `session/new` and `session/prompt`; returns a completed run |
| Tool permission callback | `session/request_permission` receives an `allow_once` selection |
| Actual tool execution | Bob creates `bridge.txt`; contents verified on disk |
| Continuation across Bob processes | `session/resume` restores the original session; recalls a codeword from the prior prompt without reading a file |
| HTTP streaming | `agent_message_chunk` translates into Agent Communication Protocol SSE `message.part` events and `run.completed` |
| History separation | Continued response contains the remembered codeword and excludes the previous reply |
| HTTP asynchronous execution and cancellation | Real shell starts; HTTP cancellation sends `session/cancel`, then cleans up the Bob process group; run becomes cancelled and the shell PID is gone |

Observed update types: `available_commands_update`, `user_message_chunk`, `tool_call`, `tool_call_update`, `agent_message_chunk`, `session_info_update`. Only new assistant text is forwarded to partner text messages.

Additional validation: `npm run check` passed the build and all 52 tests. REST and partner integration tests use an Agent Client Protocol fixture through the default runtime. New transport tests cover malformed JSON, unexpected exits, RPC errors, output and event limits, fragmented UTF-8, hidden reasoning, foreign-session updates, single-invocation permissions, unsupported client methods, pre-abort, cancellation notifications, timeout and process-group cleanup. A legacy-runtime test retains coverage of persisted historical usage totals.

## Findings and production work

1. **Use `session/resume` for continuation.** An initial live `session/load` attempt caused the old `FIRST_DONE` reply to appear in the new response as `FIRST_DONEORCHID_739`, even though the adapter discarded text received before the load response. Switching to Bob's advertised `session/resume` eliminated the duplicate. The protocol documents resume as restoring a session without history replay: https://agentclientprotocol.com/protocol/v1/session-setup.
2. **Execution limit differences.** `bob acp --help` offers trust, auto-approval, MCP/subagent and logging switches, but does not expose the `bob run` cost/turn limit switches. The runtime enforces wall-clock, output-byte and event limits. No equivalent cost/turn configuration was verified; capabilities report `max_cost` and `max_turns` as `null`. `BOB_MAX_COST` and `BOB_MAX_TURNS` are legacy CLI settings only.
3. **Trusted service permission policy.** The runtime approves each tool request once, matching the existing trusted headless execution model. Persistent approvals are never selected. Partner-facing interactive permission handling is not implemented; Agent Communication Protocol Await/resume remains unsupported.
4. **Verify usage reporting.** Successful prompt responses contained only `stopReason: end_turn`; no usage update was observed in this run. The runtime omits usage rather than inventing totals.
5. **Cancellation behavior.** Automated tests cover transport failures and shared-service concurrency/recovery paths. Cancellation was verified with a process-group fallback; graceful protocol-only cancellation was not independently established.
6. **Existing-session compatibility.** A separate live migration probe created a task using the legacy `bob run` runtime, then resumed the same task ID and workspace using Agent Client Protocol. Bob recalled `MAPLE_862` from the original conversation without replaying the previous response. This verifies the local 2.0.1 migration path; deployed service restart recovery has not been live-tested with this adapter.

The partner API can remain unchanged for the currently supported text subset. Rich tool events, images and interactive permissions would need an explicit external API mapping.

## Container upgrade — Bob Shell 2.0.4

The official installer version endpoint returned 2.0.4 on September 22, 2026. The package records release commit `01dddf68472ba478a915ead0c13a348d30257fbb` and release date September 16. Its downloaded archive matches the published SHA-256 `10de047ffdc23a50f3e1ef69fad3b6313ff6dda0010589a22efe26b24685254b`. The container pins this archive and uses Node.js 24; `sh scripts/download-bob.sh` fetches and verifies it without committing the licensed binary.

Built and tested local Linux ARM64 image `headlessbob:2.0.4-acp` (Bob 2.0.4, Node 24.21.0). Live in-container tests passed for partner discovery, sync execution/file creation, SSE, session continuation across Bob processes, REST thread execution/history, and cancellation with tool-process cleanup. An initial continuation attempt lost prior context; after adding advertised `session/close` before terminating a completed per-run process, continuation passed. A fixture assertion verifies explicit session closure. `npm run check` passed all 52 tests after the update.

No cluster rollout or registry image push has been performed. Existing 2.0.1 readiness remains supported; compatibility with pre-existing deployed 2.0.1 task storage has not been tested against 2.0.4.
