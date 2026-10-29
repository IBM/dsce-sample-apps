# UI Layout Reference
Describes the single-page UI in [Spec 5](../5-frontend-ui.md) and [Spec 7](../7-governance-evaluation.md). There are no image mock-ups for this asset; this document is the design source of truth.

## Look and feel
* Light content area, dark top bar (`#0d1117`), IBM-blue accent `#1f6feb`.
* Status colours: red `#cf222e` (critical / high), amber `#bf8700`/`#9a6700` (minor / medium), green `#1a7f37` (compliant / low), blue `#0969da` (info), muted text `#57606a`.
* System font stack: `-apple-system, "Segoe UI", system-ui, sans-serif`; 12–13 px body.
* Footer: "Contract Reviewer Assistant · Powered by IBM watsonx Orchestrate · Made with IBM Bob".

## Sign-in page (`GET /login`, served by `ui_proxy`)
Dark background, centred white card (max 360 px): brand mark "CR" + "ContractReviewer", heading "Sign in", Username and Password fields, blue "Sign in" button, note "Sessions expire after 8 hours." Error banner above the form: "Incorrect username or password." or "Too many failed attempts. Wait a minute and try again." No JavaScript on this page.

## Top bar
Left → right: brand mark "CR" + **Contract**Reviewer · nav tabs **Contract Review** and (Kate Ross only) **Governance & Evaluation** with a "Live" badge · right side: environment tag "watsonx Orchestrate · contract-reviewer", **Sign out** button, persona selector (avatar initials + "David Kim · Contract Reviewer" / "Kate Ross · Data Scientist").

## Screen 1 — Contract Review (three columns)

### Left column
1. **Standard Template** card — `<select>`: `GTA-STANDARD-v1.0`, `GTA-MSA-v1.2`, `GTA-SLA-v1.0`, `GTA-NDA-v1.0`.
2. **Session** card — vendor name (default "No contract loaded"), meta ("Upload a vendor PDF to begin" → "Contract uploaded · <date>"), tags (`Awaiting upload` → `Session active` + template id), **Vendor Clauses** list (rows of `§id heading` with a small status dot).
3. **Recent Reviews** — up to 8 in-memory rows: PDF icon, filename (≤ 22 chars), date, optional "✓ PDF" when regenerated, optional risk dot.

### Centre column — chat
* Header: document title (`Contract Reviewer` → `<vendor> — Contract Review`), sub-title "IBM watsonx Orchestrate · groq/openai/gpt-oss-120b · AstraDB vector search", deviation badge (hidden until a count is parsed).
* Suggested chips: *Compare Fee Clause*, *Term & Renewal*, *All Deviations*, *Summarise*.
* Message list: AI avatar "AI" bubble on the left, user bubble on the right; file bubbles show a "PDF" icon + filename; Markdown tables render as tables; typing indicator while waiting.
* Initial AI message: "Welcome to Contract Reviewer, powered by IBM watsonx Orchestrate. Upload a vendor contract PDF using the paperclip button below — or ask me anything about the standard contract template first."
* Error banner area, attachment row, input bar: paperclip button, auto-growing textarea (placeholder "Ask about a clause, request a comparison, or attach a vendor contract PDF…"), **Send**.

### Right column
1. **Session** — "No active session" → `Thread: <thread_id>`.
2. **Standard Template** — chip with template id, "N clauses" meta, scrollable list of `§id heading` rows (Loading… / empty / error states).
3. **Deviation cards** container (`#devCards`, populated from agent replies when applicable).
4. **Regenerated Output** — "No regenerated PDF yet — ask the agent to regenerate once deviations are confirmed." → blue link "Download Rectified Contract PDF" + "Link valid 1 hour · IBM COS".

## Screen 2 — Governance & Evaluation (Kate Ross only)
See [Spec 7](../7-governance-evaluation.md) for contents: header with status badge and **Run Evaluation**, Test Cases panel (upload / create from thread / view-manage with bulk delete), four KPI tiles (Journey Success, Tool Call Recall, Tool Call Precision, Agent Routing F1), Evaluation Run History table with per-run detail (metric bars + test-case cards), Agent Runtime Analytics panel, polling banner, and two modals (test-case picker, create-from-thread, test-case detail).

## Responsive behaviour
Designed for ≥ 1280 px desktop. Columns may stack below 1000 px; the chat remains usable. No horizontal page scroll at 1280 px.
