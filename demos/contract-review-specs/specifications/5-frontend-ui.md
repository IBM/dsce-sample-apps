# Specification 5: Frontend UI
The following specification outlines the single-page web UI for the Contract Reviewer. It is one self-contained `index.html` (HTML + CSS + vanilla JavaScript, no build step) served by `ui_proxy` (Spec 4).

## Prerequisites
1. Ensure you have access to the `website-screenshot-capture` tool, then ask the user to install [@just-every/mcp-screenshot-website-fast](https://github.com/just-every/mcp-screenshot-website-fast). Without it you cannot accurately assess visual quality.
2. Load any skills that seem relevant.

## Requirements to follow
* Single file: [`services/ui_proxy/index.html`](../services/ui_proxy/index.html). No frameworks, no CDN or external assets (the page is served under a strict CSP; everything is inline).
* Use `fetch` with relative URLs: `const PROXY_URL = "%%PROXY_URL%%"` is replaced with `""` by the server, so calls are same-origin (`/chat`, `/upload`, …).
* Wrap `window.fetch` so any `401` sends the browser to `/login`.
* **Escape all dynamic text** (`esc()`) before inserting into HTML. Agent replies are rendered through a small Markdown-to-HTML converter (`mdToHtml`) that escapes first, supports tables, bold/italic, lists, code and links.
* No Unicode-emoji icons for functional UI; use text labels or inline SVG (e.g. paperclip).
* Layout, panels and states: [`frontend/ui-layout.md`](frontend/ui-layout.md).

## Step 1: Review backend APIs
Read [`backend/api_endpoints.md`](backend/api_endpoints.md). The UI uses `/upload`, `/chat`, `/template_clauses`, `/governance/*` and `POST /auth/logout`.

## Step 2: Build the Contract Review screen
Three-column layout:
1. **Left** — template selector, active session card (vendor + clause list), recent reviews.
2. **Centre** — chat: suggested-prompt chips, message list, attachment row, input bar (paperclip, textarea, Send).
3. **Right** — session/thread id, standard-template clause list, deviation badge/cards, regenerated-PDF download card.

### Behaviour
* **Template selector** options: `GTA-STANDARD-v1.0`, `GTA-MSA-v1.2`, `GTA-SLA-v1.0`, `GTA-NDA-v1.0`. Changing it calls `GET /template_clauses?template_id=` and re-renders the right-hand clause list (results are cached per template; show "Loading…", "No clauses found for this template." and error states). Only templates ingested in Spec 1 return clauses.
* **Attach and upload:** choosing a `.pdf` immediately calls `POST /upload` (multipart `file`; pass the selected template as the `template_id` query parameter). Show an attachment chip ("Uploading…"), then "Ready — N clauses found — click Send to begin review"; show an error banner on failure. Keep the full response as `_uploadResult`. The chip has a remove (×) control. The upload does **not** auto-send a chat message.
* **Replacing an active review:** if a vendor contract is already active, `window.confirm` that the conversation and the agent's memory for that session will be cleared and a regenerated PDF (if any) should be downloaded first. On confirm: archive the old `thread_id` (max 20), reset `thread_id`, chat, session card and clause list to the "awaiting upload" state.
* **Send:** `POST /chat` with `{message, thread_id, template_id}`.
  * If `_uploadResult` exists add `session_id, cos_pdf_url, vendor_id, clause_count, clause_index`. These are sent **on the first message after the upload only**; afterwards the agent keeps them in conversation memory and the UI sends just `thread_id`.
  * Store the returned `thread_id` and show it in the Session card.
  * A file with no typed text sends `"PDF uploaded: <filename>"`.
* After upload: populate the left clause list with `clause_index`, show tags (`Session active`, template id), set the chat title to `<vendor_id> — Contract Review`, add an entry to **Recent Reviews** (max 8, in memory), and reset the right panel (deviation badge/cards, download card).
* **Suggested chips:** *Compare Fee Clause*, *Term & Renewal*, *All Deviations*, *Summarise* — each calls `quickSend(text)`.
* **Typing indicator** while waiting; disable input during a request; `Enter` sends, `Shift+Enter` newline.
* **Parse every agent reply:**
  * First `https://….pdf` link → Download card: "Download Rectified Contract PDF" (`target=_blank`, `rel="noopener noreferrer"`), "Link valid 1 hour · IBM COS"; mark the current Recent Review as regenerated.
  * `(\d+) deviation` → update the deviation badge (`yellow` if > 0, else `green`).
* **Sign out:** a `<form method="post" action="/auth/logout">` button in the top bar.

## Step 3: Persona switcher (UI-only)
A selector in the top bar:

| Persona | Role | Visible tabs |
|---|---|---|
| David Kim | Contract Reviewer | Contract Review |
| Kate Ross | Data Scientist | Contract Review + Governance & Evaluation |

Default is David Kim. Switching to Kate shows the Governance tab; switching back while on it returns to Contract Review. **This is presentation only — it is not an access control** (see Security in Spec 4/11).

## Step 4: Governance & Evaluation screen
Build per [Spec 7](7-governance-evaluation.md).

## Step 5: QA the UI
Use `website-screenshot-capture` (absolute directory path, unique random subdirectory) to verify: login page, empty Contract Review, after-upload state, a comparison reply with a table, regenerated-PDF state, Governance tab. Check there are no console errors and no horizontal overflow at 1280 px width.

## Cleanup
* Documentation: super simple, non-verbose, max 3–4 pages per .md; place into `services/ui_proxy/docs/`.
* Update `.gitignore` (screenshots folder, logs).
