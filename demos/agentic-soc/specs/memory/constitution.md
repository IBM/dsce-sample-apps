# Agentic SOC — Project Constitution

## 1. Purpose of This Document

Governing principles for all code, decisions, and architectural choices in the Agentic SOC project.
Every agent instruction, tool function, API route, and UI component must conform to these principles.

---

## 2. Coding Standards

### Language & Runtime
- **Frontend**: TypeScript with `strict: true`. No `any` types.
- **Backend (Express)**: JavaScript (CommonJS, `require`). No ES module syntax.
- **Agents/Tools**: Python 3.11+. Pydantic v2 for all models.

### File Size Limits
- Source files: maximum **400 lines** per file. Split by responsibility if exceeded.
- Agent YAML instructions: no limit — clarity takes priority.

### Functional Style
- React components: functional components + hooks only. No class components.
- Python tools: stateless pure functions. Side-effects limited to COS reads + Mailjet sends.

### Naming Conventions
- React components: `PascalCase` (`StageCard.tsx`)
- TypeScript interfaces: `PascalCase` prefixed with domain (`StageConfig`, `RunDetails`)
- Python tools exported to WxO: `soc_` prefix, `snake_case` (`soc_fetch_offense`)
- WxO agent names: `soc_` prefix, `snake_case` (`soc_triage_agent`)
- Environment variables: `UPPER_SNAKE_CASE` (`WXO_API_KEY`)

---

## 3. Architecture Principles

1. **Dual-mode dashboard (Mock Demo default + Live WxO toggle)**: The UI loads in Mock Mode by default for customer demos and presentations where all stages run realistically without requiring a live WxO instance, looking purely as live. Users can toggle to Live Mode to connect to the live watsonx Orchestrate instance where agents run exclusively on WxO. Look-and-feel is governed by `specs/01-agentic-soc/ui-design.md`.
2. **No live QRadar API**: reads pre-exported CSVs from IBM Cloud Object Storage only.
3. **Separation of concerns**: frontend owns UI state; Express owns IAM + WxO proxying; agents own reasoning; tools own data access.
4. **Express 4** — not Express 5. The `app.get('*', ...)` catch-all pattern requires Express 4.
5. **No shared state between agent runs** — every run is stateless; thread IDs link conversation history only.

---

## 4. Testing & Quality

- **Zero false negatives**: the pipeline must never miss a True Positive on the 25-offense test dataset.
- **Deterministic rules**: same input must always produce the same output. No probabilistic decisions.
- **Output transparency**: for every stage the UI must expose the agent output, every tool call (name, arguments, response), raw traces, run/thread IDs and duration (derived from high-fidelity mock data in Mock mode or real WxO run payload in Live mode).
- **Acceptance gate**: all 25 offenses must route correctly (8 TP → PATH 1, 17 Non-Issue → PATH 2).

---

## 5. Security Principles

- **No credentials in code**: all secrets in `SOC-APP/.env` only; never committed to git.
- **IAM tokens in memory only**: 50-min TTL cache; never logged or serialised.
- **Analyst approval gate**: no irreversible remediation action executes without explicit human approval.
- **Audit trail**: every tool call and agent decision must be logged and traceable.

---

## 6. Error Handling

- **Absence of evidence ≠ benign**: when data is missing or ambiguous, route to `NEEDS-RCA`; never default-close.
- **Tool failures**: set the missing field to `"unknown"`, record in reasoning. Never guess a value.
- **Reports show only sourced values**: in Live mode, every field in the Incident Report comes from parsed agent output (`data-model.md` §3.7–§3.8). Values that are absent (`N/A`, `unknown`, `none`, empty) are omitted, never printed as placeholders and never replaced with static, mock or guessed data.
- **API errors**: return `{ success: false, error: "<message>" }` with appropriate HTTP status.
- **Explicit error surfacing in Live mode**: if Express/WxO is unreachable or unconfigured while in Live Mode, Next.js route handlers return `{ success:false, error }` (poll timeouts add `retryable:true`); the UI surfaces the real error in the Navbar status bar.

---

## 7. Performance Targets

| Stage | Target |
|---|---|
| Triage | < 45 seconds |
| Classification | < 3 minutes |
| RCA | < 5 minutes |
| Full pipeline | < 20 minutes |

---

## 8. Decision Rules

- **Evidence-based only**: every verdict must cite actual field values from tool output.
- **No default-benign**: a benign verdict requires positive evidence (allowlist, maintenance window, known vendor).
- **Analyst retains control**: agents recommend; humans approve all irreversible actions.
- **WxO embed JWT**: RS256 hand-crafted with Node `crypto`; no `jsonwebtoken` package.
- **No `helmet`, no `express-rate-limit`** in current implementation.
