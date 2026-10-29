# Specification 7: Governance & Evaluation
The following specification outlines the Governance & Evaluation tab, which lets a data scientist manage agent test cases, run evaluations against the WXO Evaluation API (v2), and inspect agent runtime analytics.

## Prerequisites
Load any skills that seem relevant — new ones may be added over time. The agent (Spec 6) and the `ui_proxy` (Spec 4) must be running.

## Requirements to follow
* Backend: `/governance/*` routes in `ui_proxy` ([`backend/api_endpoints.md`](backend/api_endpoints.md)). Frontend: the Governance screen in `index.html` ([`frontend/ui-layout.md`](frontend/ui-layout.md)).
* Visible only to the **Kate Ross (Data Scientist)** persona. Presentation only — see "Known limitation" below.
* WXO paths (confirmed against the IBM developer catalogue); `{id}` = `WXO_AGENT_ID`:

| Purpose | Method + path |
|---|---|
| List evaluations | `GET /v1/orchestrate/agent/{id}/evaluations/v2` |
| Evaluation detail | `GET /v1/orchestrate/agent/{id}/evaluations/{eval_id}` (`?expand=test_cases`) |
| Evaluation status | `GET /v1/orchestrate/agent/{id}/evaluations/status` |
| List test cases | `GET /v1/orchestrate/agent/{id}/test_case/v2` |
| Test case detail | `GET /v1/orchestrate/agent/{id}/test_case/v2/{tc_id}` |
| Run evaluation | `POST /v1/orchestrate/agent/{id}/evaluate/v2` body `{test_case_ids}` |
| Upload test cases | `POST /v1/orchestrate/agent/{id}/test_case/v2` (multipart) |
| Create from thread | `POST /v1/orchestrate/agent/{id}/test_case/v2/from_thread` |
| Delete test case | `DELETE /v1/orchestrate/agent/{id}/test_case/v2/{tc_id}` |
| Agent runs | `GET /v1/orchestrate/runs`, `GET /v1/orchestrate/runs/{run_id}` |
| Thread messages | `GET /v1/orchestrate/threads/{thread_id}/messages` |
| Agent list | `GET /v1/orchestrate/agents` |

## Step 1: Backend implementation notes
* **Upload** (`POST /governance/test_cases/upload`): `.json` / `.zip` only, ≤ 10 MB. Use a **one-shot `httpx.AsyncClient`** — the shared WXO client has `Content-Type: application/json` baked in, which would overwrite the multipart boundary. After upload record a batch `{filename, uploaded_at, count, ids}` in an in-memory registry (take `test_case_ids` from the response; otherwise re-list newest-first and take the newest N).
* **Eval test cases** (`/governance/evaluations/{id}/test_cases`): WXO exposes these via `expand=test_cases` on the detail route. Normalise each to `{id ← test_case_id, prompt ← test_case_name or story, status ← PASSED|FAILED|IN_PROGRESS from result, result, reasoning, metrics[], created_date, executed_date, chat_session_id ← chat_session_id or thread_id}`.
* **Bulk delete**: do **not** use the WXO bulk-delete endpoint (it only soft-deletes test cases used in prior evaluations and returns `deleted_ids: []`). Issue individual `DELETE`s concurrently (`asyncio.gather`), return `{deleted_ids, failed}`, and prune the in-memory batch registry.
* **List test cases**: normalise `id` (fall back to `test_case_id` / `test_case_uuid`).
* **Agent stats** (`/governance/agent/stats`): fetch `/v1/orchestrate/agents` and the first runs page in parallel (name lookup + page 1). WXO caps pages at 20; fetch the remaining offsets in concurrent batches of 8; filter runs to `WXO_AGENT_ID`. Return `agent_name, total_runs, runs_with_usage, total/prompt/completion/cached tokens, avg_tokens_per_run, avg_duration_sec, model_name, token_series` (last 30 runs: `started_at, total_tokens, duration_sec`) and `recent_runs` (last 10, newest first, with status). Rate-limited as an expensive route.
* Sort keys are whitelisted (`executed_date, created_date, status`; `asc|desc`); ids are regex-constrained and URL-quoted.

## Step 2: Governance screen
1. **Header** — title, subtitle ("IBM watsonx Orchestrate Evaluation API · …"), status badge (idle / running / last result), **Run Evaluation** button.
2. **Test Cases panel** — count label; buttons *Upload Test Cases (.json / .zip)*, *Create from Chat Thread*, *View / Manage*. *View / Manage* expands a list with checkboxes, *Select all* and *Delete selected* (disabled until something is selected). Show success / error message strips. Clicking a test case opens a **detail modal**.
3. **KPI tiles** (latest run, `aggregate_metrices`): **Journey Success**, **Tool Call Recall**, **Tool Call Precision**, **Agent Routing F1** — value %, coloured bar (green ≥ 80, amber ≥ 50, red below, grey when unknown).
4. **Evaluation Run History** table: Eval ID, Date, By, Test Cases, Journey Success, Tool Call Recall, Routing F1, Pass / Total, Status; plus a trend sparkline. Clicking a row loads its metric bars and per-test-case cards (expandable: status, prompt, reasoning, metrics, tool-call detail with *incorrect parameters* highlighted, run info/tokens).
5. **Run Evaluation** → opens the **Test-Case Picker modal** (all test cases checked by default, *Select all*, selected count, *Cancel* / *Run Evaluation* disabled when none). On confirm `POST /governance/evaluate`, then **poll every 5 s** (`/governance/evaluations/{id}`) showing a blue polling banner until the run completes; refresh history and KPIs.
6. **Create from Chat Thread modal** — dropdown of archived thread ids (current + previous sessions) or free-text id → `POST /governance/test_cases/from_thread`.
7. **Agent Runtime Analytics** card — KPI tiles (runs, total tokens, avg tokens/run, avg duration, model), token trend sparkline, "Recent Runs (last 10)" table (Run ID, Started, Duration, Total / Prompt / Completion tokens, Status), *Refresh* button.

## Step 3: The five WXO regression test cases (`agent/test_cases_wxo.json`)
Each starts from an "already uploaded" context (`session_id`, `template_id=GTA-STANDARD-v1.0`) and asks to compare one clause. Each asserts a `tool_call` goal on `search_clause` with `session_id` and `template_id` matched **strict** and `clause_query` matched **fuzzy**, plus a `text` goal "Agent finds the relevant … clause in the vendor contract and the standard template, then compares the two clearly."

| # | Clause asked | Expected `clause_query` (fuzzy) |
|---|---|---|
| 1 | payment of fee | `payment of fee clause` |
| 2 | Termination for Convenience | `termination for convenience` |
| 3 | term renewal | `term renewal clause` |
| 4 | Termination by GTA for Cause | `Termination by GTA for Cause` |
| 5 | payment terms | `payment terms clause` |

Use a real `session_id` from a prior upload when authoring these. A change to the agent instructions that breaks tool-call behaviour must surface as a failed test case with reasoning such as `tool inputs incorrect` or `missed tool calls`.

## Known limitation (document it)
There is one shared login and no roles. The persona selector only hides/shows the Governance tab in the browser; any signed-in user can still call `/governance/*` (including `bulk_delete`, `evaluate`, upload). Add a separate admin credential or SSO before multi-user use.

## Validation
* Upload `agent/test_cases_wxo.json` → count increases by 5; run evaluation → history row appears and KPI tiles populate.
* Bulk-delete two test cases → both disappear from the list.
* Analytics card shows non-zero runs after a few chats.

## Cleanup
Documentation: super simple, non-verbose, max 3–4 pages per .md; place into `services/ui_proxy/docs/`.
