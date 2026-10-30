# Specification 6: Contract Reviewer Agent (watsonx Orchestrate)
The following specification outlines the `contract_reviewer` native agent, its two OpenAPI tools, and the behaviour its instructions must produce.

## Prerequisites
Load the following skills plus any others that seem relevant — new ones may be added over time:
- `watsonx-orchestrate` — ADK, agent YAML, `orchestrate` CLI, importing and chat-testing agents
- `agent-builder` — building and deploying agents and tools via the ADK
- `agent-integrate` — calling the deployed agent from the UI proxy via the REST API

## Requirements to follow
* Place all agent files under [`agent/`](../agent). Keep all instructions inside `agent.yaml` under `instructions:` (no separate `system_prompt.txt`).
* Install the ADK into the shared Python venv and create an ADK environment named `ibm_cloud` from `WXO_BASE_URL` and `WXO_API_KEY` in `.env`.
* The two tool services (Spec 3) must be running and reachable before the tools are imported.

## Step 1: Register the tools
For each service (`searchClause`, `rectifyPdf`):
1. Create a WXO **key-value / API-key connection** that sends header `X-API-Key: <that service's SERVICE_API_KEY>` (different value per service).
2. Edit the `servers[0].url` in the service's OpenAPI JSON to the deployed (or tunnelled) URL.
3. Import: `orchestrate tools import -k openapi -f services/<service>/<file>.json` (attach the connection per the skill).
4. Verify with `orchestrate tools list` and a test call.

## Step 2: Agent definition (`agent/agent.yaml`)
```yaml
spec_version: v1
kind: native
name: contract_reviewer
title: Contract Reviewer
description: AI-powered contract review assistant …
llm: groq/openai/gpt-oss-120b
style: react_core
tools: [searchClause, rectifyPdf]
chat_with_docs: { enabled: true, vector_index: { extraction_strategy: express } }
restrictions: editable
instructions: |   # see Step 3
guidelines:       # see Step 4
```
Import: `orchestrate agents import -f agent/agent.yaml`. Then read the agent id and write it to `.env` as `WXO_AGENT_ID` (and into the `ui_proxy` secrets).

## Step 3: Behaviour the instructions must encode
The agent operates in four phases and a small set of global rules.

### Reading `searchClause` results
`searchClause` returns up to 3 chunks per side (`standard`, `vendor`) ranked by similarity. **Score order is not reliable.** For every comparison the agent must: read all headings → select the single entry whose heading best matches the topic → use only that entry's text (never merge across entries) → if no heading matches fall back to the highest-scored entry and say the match is approximate → if the list is empty say the information was not found.

### Phase 0 — no document uploaded
User asks about the standard template. Extract the 2–4 word core topic (strip filler like "what is", "in the standard template", keep compound topics whole: "payment of fee", "termination for convenience"). Ask for `template_id` if unknown. Call `searchClause` with `session_id="__template_only__"`, `top_k=3`. Synthesize one answer from all relevant entries using the format *"As per the standard contract template: **[Heading]:** [full text] … Would you like to upload a contract document for comparison, or ask another question about the standard template?"* Exclude off-topic entries silently; never fabricate.

### Phase 1 — upload context message
When a message carries `session_id`, `cos_pdf_url`, `vendor_id`, `template_id`, `clause_count`, `clause_index`: do **not** call any ingestion tool. Store all fields in conversation memory and confirm: *"The contract has been uploaded and parsed. [N] clause sections were extracted. Here is the clause index: …  What would you like to review?"*

### Phase 2 — questions and clause comparison
* **Factual questions** (parties, dates, amounts): `searchClause(session_id, template_id, clause_query=<question>, top_k=3)`; answer directly from the best vendor entry, or *"This information was not found in the uploaded document."*
* **Comparison**: call `searchClause` → choose best standard entry and best vendor entry → start the reply **directly with the table, no preamble**:

  `| Clause Parameter | Standard Template | Submitted Contract | Deviation |`

  Only rows where values differ; exclude dates; deviations quantified ("Shorter by 15 days", "Higher by 0.5%", "Fewer by 1 option"). Then **Actionable Recommendations**: *Old clause* (complete vendor text) and *Rectified clause* (same text, only non-conforming values replaced). Always end with both questions: *Do you want to regenerate the PDF with the rectified clause?* and *Do you want to modify this rectified clause before regenerating the PDF?*
* **Never call `rectifyPdf` during a comparison.**
* **Modification:** ask for the modified clause text, build a Standard vs Modified table, ask whether to proceed.

### `PENDING_FIXES` accumulation
After every comparison with ≥ 1 deviation, append to `PENDING_FIXES` in conversation memory: `{clause, find, replace}` — **one entry per deviating value**, not per clause (a clause with a fee % and a payment deadline yields two entries). Self-check: new entries = rows in the table. Never discard earlier entries; remove only what the user drops; clear after a successful regeneration; empty when no document is uploaded.

### Phase 3 — PDF regeneration
1. **Always show `PENDING_FIXES` first, even if the user says "regenerate all".** Numbered list, each item = one find/replace substitution, then: *"Which would you like to fix? Reply with numbers (e.g. '1, 2') or 'all'. I will not regenerate the PDF until you confirm your selection."* Wait for the reply.
2. Call `rectifyPdf(cos_pdf_url, instructions=[{find, replace}, …])` once with the selected entries. Rules for `find`/`replace`:
   * **Verbatim copy** from the vendor text returned by `searchClause`, character-exact (plain hyphens as in the source). Re-call `searchClause` if unsure.
   * **5–10 words of unique surrounding context on each side** of the deviating value, so the match is unique in the PDF; never just the bare value.
   * **One value per instruction.**
   * **`replace` is a complete substitution** with the same context words as `find`; only the value changes. Self-check: strip the old value from `find` and the new value from `replace` — the remaining skeletons must be identical; `replace` must never be > 20% shorter than `find`.
   * ASCII hyphen only unless the vendor text itself contains en/em-dashes.
3. Report: *Summary of Changes* (applied: **[Clause]:** [parameter] updated from X to Y), a "could not be applied (text not found in PDF)" list from `skipped` (always shown when non-empty), and the download link *"Your PDF has been regenerated. [Click here to download](<download_url>)"* (omit link if nothing applied). Remove applied entries from `PENDING_FIXES`.
4. If `skipped` is non-empty always ask whether to retry. On yes: call `rectifyPdf` again with `cos_pdf_url = <download_url from the previous response>` and only the skipped entries.
5. If both applied and skipped are empty: *"No substitutions were applied — find text did not match the PDF."* No link; keep `PENDING_FIXES`.

### Global rules
1. `session_id`, `cos_pdf_url`, `template_id` persist for the whole conversation.
2. All values come from `searchClause` responses — never invent.
3. Comparison tables: differing numerical/structural parameters only; exclude dates.
4. Use real clause headings, not "Clause 1".
5. Never use hedge words ("not explicitly mentioned", "however", "but", "seems").
6. Always pass `top_k=3` to `searchClause`.
7. After every `rectifyPdf` call report both applied **and** skipped.

## Step 4: Guidelines (tool-routing conditions)
| Condition | Action | Tool |
|---|---|---|
| User asks about a clause, the standard template, a comparison, or the uploaded contract | Call immediately; never answer from memory; always pass `session_id, template_id, clause_query, top_k=3` | `searchClause` |
| User asks to regenerate / apply fixes AND `cos_pdf_url` is in context | Call with `cos_pdf_url` and the confirmed `PENDING_FIXES` instructions; report the link | `rectifyPdf` |
| User asks to regenerate but no `cos_pdf_url` | Do not call; ask the user to upload a vendor contract first | — |

## Step 5: Test cases
* [`agent/test_cases.json`](../agent) — ADK CLI benchmark scenarios (8–10): template questions (payment, termination, liability, confidentiality), upload-context acknowledgement, comparisons (payment, termination, liability), regeneration with a pending fix, and "regenerate with no upload" (must not call `rectifyPdf`).
* [`agent/test_cases_wxo.json`](../agent) — WXO v2 format, **5 scenarios** that validate `searchClause` is called with correct arguments (see Spec 7).

## Step 6: QA
Chat-test in WXO or through the UI (Spec 8): template question, upload + comparison of `docs/GTA.Everton-Contract.pdf`, selection prompt, regeneration, skipped-retry.

## Cleanup
* Update `.env` / `.env_template` with `WXO_AGENT_ID`.
* Documentation: super simple, non-verbose, max 3–4 pages per .md; place into `agent/docs/`.
