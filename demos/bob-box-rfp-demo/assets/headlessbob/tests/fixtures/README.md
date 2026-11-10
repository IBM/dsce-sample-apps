# Bob fixtures

`bob-stream.jsonl` is a synthetic fixture derived from the installed Bob Shell 2.0.1 renderer (`ust` in `dist/bob.js`), not a recording. It deliberately includes reasoning, tool events, and multibyte text. `bob.mjs` is a deterministic subprocess used by HTTP integration and process-cleanup tests.

`bob-live-stream.jsonl` records a successful real Bob Shell 2.0.1 headless probe on 2026-09-11. The task ID and timestamps are replaced with fixture values. No credentials are recorded.

`bob-live-json.json` separately records the JSON-mode result, including its `last_message` field. The runtime uses stream-json; this file documents the observed distinction between formats.

Live smoke verification also creates a file through ACP, resumes the same task to append to it, and cancels a shell command after it starts. Re-run with `npm run smoke` using your own Bob key and accepted license.
