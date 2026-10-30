# Quality Assurance — End to End
The following specification outlines the key functionality that must be QA'd prior to release. It covers the tool services, the proxy, the agent, the UI and the security controls.

## Prerequisites
1. Ensure you have access to the `website-screenshot-capture` tool, then ask the user to install [@just-every/mcp-screenshot-website-fast](https://github.com/just-every/mcp-screenshot-website-fast). Without it you cannot assess the UI visually.
2. Load any skills that seem relevant.
3. Services running locally (Spec 9) or deployed (Specs 10–11); standard template ingested (Spec 1); agent imported (Spec 6).

Test data (already in the repo): `scripts/templates/GTA.Standard-Template.pdf`, `docs/GTA.Everton-Contract.pdf`, `docs/GTA.AGON-Contract.pdf`, `docs/GTA.Ebikes-Contract.pdf`, `docs/GTA.HELY-Contract.pdf`.

## 1. Validate the tool services (curl / python3)
| # | Test | Expected |
|---|---|---|
| 1.1 | `GET /health` on both services without a key | `200 {"status":"ok"}` |
| 1.2 | `POST /search_clause` without `X-API-Key` | `401/403` |
| 1.3 | Start a service with a 10-char `SERVICE_API_KEY` | Process refuses to start |
| 1.4 | `searchClause` `{session_id:"__template_only__", template_id:"GTA-STANDARD-v1.0", clause_query:"payment", top_k:3}` | `vendor` null; 3 standard entries incl. a fee/payment clause |
| 1.5 | `searchClause` with `top_k:9` or invalid `session_id` (`../x`) | `422` |
| 1.6 | `rectifyPdf` with a `cos_pdf_url` on another host or key `../x.pdf` | `422` |
| 1.7 | `rectifyPdf` with `replace` = bare value (context dropped) | `422` Rule-4 violation with `violations[]` |
| 1.8 | `rectifyPdf` valid pair on an uploaded Everton PDF | `changes_applied` non-empty, `download_url` opens and shows the new text; a made-up `find` appears in `skipped` |
| 1.9 | > 120 (search) / > 30 (rectify) calls in 60 s | `429` with `Retry-After` |

## 2. Validate the proxy
Use `curl -c cookies.txt` to sign in via `POST /auth/login -d username=… -d password=…`.
| # | Test | Expected |
|---|---|---|
| 2.1 | Start with `UI_PASSWORD` of 8 chars | Process exits |
| 2.2 | `curl /chat` without a cookie | `401` JSON, no `WWW-Authenticate` |
| 2.3 | Browser `GET /` signed out | `303 → /login` |
| 2.4 | 6 wrong passwords in a minute, then the right one | Redirect to `/login?e=2` until the window passes |
| 2.5 | `POST /auth/login` with a foreign `Origin` header | `403` |
| 2.6 | Sign in, `POST /auth/logout`, reuse the old cookie | `401` (server-side revoke) |
| 2.7 | `POST /upload` with Everton PDF | `vendor_id=everton`, `clause_count>0`, `clause_index` sorted |
| 2.8 | `POST /upload` with a text file renamed `.pdf` / > 25 MB / empty | `415` / `413` / `400` |
| 2.9 | `POST /chat` with `cos_pdf_url` = `https://evil.example/x.pdf` | `422` |
| 2.10 | `GET /template_clauses?template_id=GTA-STANDARD-v1.0` | clauses sorted by `section_id`; `?template_id=` missing → `400` |
| 2.11 | Response headers on any page | `nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, CSP |

## 3. Validate the agent (via `/chat` or the UI)
Follow this journey; record the reply for each step.
1. **Template question** (template `GTA-STANDARD-v1.0`): *"What does the standard template say about payment of fee?"* → quoted clause text in the "As per the standard contract template" format, ending with the upload question.
2. **Upload** `GTA.Everton-Contract.pdf` → clause list shown; chat acknowledges with the clause index and **no tool call**.
3. **Compare**: *"Compare the fee and payment clause with the standard template"* → reply starts with the table (no preamble), only differing rows, quantified deviations, Old/Rectified clause, both closing questions; **`rectifyPdf` not called**.
4. **Compare a second clause**: *"Show term and renewal deviations"* → `PENDING_FIXES` grows (verified in step 5).
5. **Regenerate**: *"Regenerate the PDF"* → agent lists **all** pending fixes numbered and waits (even if you say "all" up front). Reply `all`.
6. **Result** → "Summary of Changes", skipped list (if any), working download link. Open the PDF: replaced values present, layout intact.
7. If anything was skipped → agent asks to retry; reply yes → second call uses the previous `download_url`.
8. **No upload**: new session, *"Please regenerate the PDF"* → agent asks for an upload and does **not** call `rectifyPdf`.
9. Repeat 2–6 with `GTA.AGON-Contract.pdf` and `GTA.HELY-Contract.pdf` to check clause parsing on different layouts (including headings whose body is on a later page).

## 4. Visual and functional UI inspection
Capture a screenshot per state with `website-screenshot-capture` (absolute directory, unique subdirectory per page) and compare with [`frontend/ui-layout.md`](frontend/ui-layout.md): login (incl. error banners), empty Contract Review, template switch, upload-ready chip, active review, comparison table rendering, regenerated-PDF card, Governance tab (Kate Ross), test-case picker modal, create-from-thread modal.
Check: persona switch shows/hides the Governance tab; Sign out returns to `/login`; replacing an active review shows the confirm dialog; no browser console errors; no unescaped HTML from agent text (try a vendor PDF containing `<script>` text).

## 5. Governance QA
Upload `agent/test_cases_wxo.json` (5 cases) → run evaluation → KPI tiles and history row populate; open a failed case and read reasoning; bulk-delete test cases; Agent Runtime Analytics shows non-zero runs.

## 6. Security checks
* No credentials in git (`git grep -nE "AstraCS:|ZenApiKey|apikey"` returns only placeholders).
* `.env` files are ignored; images do not contain `.env` (`docker run --rm <img> ls -a /app`).
* Containers run as UID 10001 with read-only root filesystem.
* `pip-audit -r requirements.txt` for each service reports no known vulnerabilities (or documented exceptions).

## Requirements
If any technical issue affects behaviour, fix it or document it in @issues/ with notes to re-QA once fixed.
