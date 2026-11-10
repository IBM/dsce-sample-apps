# Verification

## Local runtime update — 2026-09-22

REST and partner ACP now use the shared Agent Client Protocol runtime by default. `npm run check` passes all 52 tests. Live tests passed for REST thread execution/history, partner sync/SSE runs, file creation, continuation, cancellation and tool-process cleanup. A legacy CLI task was also resumed successfully through the new runtime. See [CLIENT_PROTOCOL_VERIFICATION.md](CLIENT_PROTOCOL_VERIFICATION.md) for details and the cost/turn limit and usage-reporting differences. This update has not been deployed; the verification notes below describe prior releases.


- `npm run check`: 38 tests covering ACP/REST contracts, parsing, ownership, persistence/recovery, cancellation/process cleanup, thread lifecycle, Markdown sanitization, workspace downloads and usage statistics.
- Real Bob Shell 2.0.1 smoke checks covered file creation, continued sessions and cancellation.
- OpenShift deployment verified persistent history, authenticated file downloads and real Bob usage in run/message responses.
- UI DOM checks covered Markdown, file links, cancellation states and usage rendering. Browser visual testing was not performed.

Run fixture tests without a Bob API key using `npm ci && npm run check`. `npm run smoke` requires licensed Bob Shell setup and valid credentials, and consumes Bob credit.

ACP discoverability coverage verifies the public guide and contract, capability links, root-level routes, bearer authentication, and omission of unsupported Await/resume.

Python examples were exercised against a temporary service using the Bob fixture: ACP sync/async/stream, session continuation, REST thread continuation, reported usage, event streaming, file download, both cancellation routes and authentication failure passed. Python syntax compilation passed. No third-party Python packages are required.

HTML guide checks verified navigation anchors and copy controls in JSDOM. HTTP tests verify the guide, capability link and exact source downloads for the five allowlisted sample files; arbitrary filesystem paths are not exposed. Docker packaging includes the sample source directory.

## Container upgrade — Bob Shell 2.0.4

The official installer version endpoint returned 2.0.4 on September 22, 2026. The package records release commit `01dddf68472ba478a915ead0c13a348d30257fbb` and release date September 16. Its downloaded archive matches the published SHA-256 `10de047ffdc23a50f3e1ef69fad3b6313ff6dda0010589a22efe26b24685254b`. The container pins this archive and uses Node.js 24; `sh scripts/download-bob.sh` fetches and verifies it without committing the licensed binary.

Built and tested local Linux ARM64 image `headlessbob:2.0.4-acp` (Bob 2.0.4, Node 24.21.0). Live in-container tests passed for partner discovery, sync execution/file creation, SSE, session continuation across Bob processes, REST thread execution/history, and cancellation with tool-process cleanup. An initial continuation attempt lost prior context; after adding advertised `session/close` before terminating a completed per-run process, continuation passed. A fixture assertion verifies explicit session closure. `npm run check` passed all 52 tests after the update.

No cluster rollout or registry image push has been performed. Existing 2.0.1 readiness remains supported; compatibility with pre-existing deployed 2.0.1 task storage has not been tested against 2.0.4.

## OpenShift rollout — September 22, 2026

Build `headlessbob-13` deployed successfully to the existing `binb/headlessbob` deployment, pinned to image digest `sha256:e61520639ef9886def125c1ad90ea58e6cc7292b8b18d7b732728c4d6e867d3d`. The running pod reports Bob Shell 2.0.4 and Node 24.21.0. No runs were active before rollout; service data and Bob history were backed up on the persistent volume.

Post-rollout checks passed for HTTPS health/authentication/readiness, REST execution with file creation and authenticated download, conversation continuation across Bob processes, and partner Agent Communication Protocol SSE. The new runtime is serving both APIs. Earlier statements about deployment status describe the pre-rollout checks.
