# Agent Ops: Build Agents You Can Trust — Seller Demo Script

> **Before you start:** Open the demo in a wide browser window. Every run is live; jobs run one at a time and results stay for ten minutes. Warm up by running Evaluate once for v1 and v2 so results are waiting. The tabs are: Overview, Run a scenario, Evaluate, Rubric, Red team.

## 1. Overview
**Key message:** Building an agent is one thing — knowing it behaves as expected and stays reliable through changes is another.

- Stay on the Overview page.
- Point at **Agents in this demo**: the loan orchestrator above intake, credit risk and compliance.
- Point at the two version cards: v1 (as first shipped, with a hidden compliance defect) and v2 (after evaluating and optimising).

## 2. Run v1 with Marcus
**Key message:** No errors, no warnings — a confident but incorrect decision. Evaluating the final answer is not enough.

- Click **Run a scenario**. Keep v1 selected and click **Marcus Reyes** under Submit an application.
- Narrate the stream: handoffs, tool calls, results, then the decision letter.
- Point at the red pills: AML screening skipped, and the decision versus the expected conditional approval.

## 3. Load the trace
**Key message:** Observability explains an incident after the fact. The rest of the demo catches the problem before production.

- Click **Load platform trace** (enables ~15 seconds after the run).
- Scroll the spans: every model call, handoff, token count and latency is visible.

## 4. Run v2 with Marcus
**Key message:** One agent's instructions changed. But how do we prove the fix holds across all scenarios?

- Select **v2** and click **Marcus Reyes** again.
- Point at the green pills: AML screening ran, conditional approval issued.

## 5. Evaluate
**Key message:** These tests are reusable — regressions are caught after every prompt, tool, or model change.

- Click **Evaluate**. Press **Run now** for v1 (or use the warm-up result).
- While it runs, explain: the framework replays five test cases with a simulated applicant, scoring routing, tool calls, arguments and decisions.
- Point at **Journey success 3 of 5** beside Routing F1 100%.
- Expand the Marcus Reyes row: show the wrong decision and the missing AML screening call.
- Run v2 and point at **5 of 5** with 100% precision and recall.

## 6. Rubric
**Key message:** An LLM judge validates business requirements written in plain language — no code required.

- Click **Rubric**. Run v1, then v2.
- Read the four compliance rules written in plain language.
- Point at v1 failing AML screening for Marcus Reyes and Priya Natarajan (both self-employed). Click a red cross to show the judge's reasoning.
- Point at v2: all twenty checks pass.

## 7. Red team
**Key message:** Version one fell on the first turn. Version two held its compliance requirements through a six-turn escalation.

- Click **Red team**. Run v1, then v2.
- Explain: an attacker model plays an applicant trying to skip the AML check using three strategies — Crescendo, Instruction override, and Emotional appeal.
- Point at v1: three of three attacks succeed on the first turn.
- Open the Crescendo conversation on v2 and scroll its six turns to show the agent holding firm.

## 8. Close
**Key message:** Observability, trajectory evaluation, business-rule validation and red teaming in one framework that ships with the watsonx Orchestrate ADK. Building an agent that works is the beginning — the goal is an agent you can trust.

- Return to **Overview**.

> **If something is off:** A disabled button with "Another run is in progress" means wait for the current job. If v2 scores 4 of 5, run it again — the framework just measured a rare slip.
