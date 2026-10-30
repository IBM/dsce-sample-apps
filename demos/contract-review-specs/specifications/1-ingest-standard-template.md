# Specification 1: Ingest the Standard Contract Template
The following specification outlines the steps required to parse the GTA Standard Template PDF into clause chunks and load them into AstraDB, so every later spec can compare vendor contracts against it.

## Prerequisites
Load any skills that seem relevant — new ones may be added over time.

## Inputs (already in the repo — do not regenerate)
* `scripts/templates/GTA.Standard-Template.pdf` — the standard template.
* [`data/clause_types.yaml`](data/clause_types.yaml) — clause type taxonomy (copy to `scripts/clause_types.yaml`).
* Clause document shape: [`data/clause_schema.md`](data/clause_schema.md).

## Requirements to follow
* Create all files under [./scripts](./scripts).
* One-time, re-runnable local Python script: `scripts/ingest_standard_templates.py`.
* Use PyMuPDF (`pymupdf`) for text extraction, `astrapy` for AstraDB, `pyyaml` for the taxonomy, `python-dotenv` for config.
* All configuration is read from `scripts/.env` (`ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`, `ASTRA_DB_COLLECTION`). Provide `scripts/.env.example` with empty placeholders.
* No contract-specific text (heading names, keywords, vendor names) may be hard-coded in Python. Everything contract-specific lives in `clause_types.yaml` or is derived structurally.

## Step 1: Resolve template metadata
For each `*.pdf` in `scripts/templates/` derive `(template_id, template_type)`:
1. If a sidecar `<stem>.meta.yaml` exists with `template_id` and `template_type`, use it.
2. Otherwise use a filename heuristic:
   * `version` = first token matching `v\d+(\.\d+)*`, default `v1.0`
   * `type` = first 2–10 letter token after the org prefix that is not a filler word (`TEMPLATE, CONTRACT, AGREEMENT, DRAFT, FINAL, SIGNED, COPY, V, REV, PDF`), default `CONTRACT`
   * `template_id` = `<org_prefix>-<TYPE>-<version>`

Example: `GTA.Standard-Template.pdf` → `template_type=STANDARD`, `template_id=GTA-STANDARD-v1.0`.

## Step 2: Parse the PDF into clause chunks
Detect numbered section headings structurally (no hard-coded titles):
* **Pattern A** — bare number on its own line (`1.1`) followed by the heading on the next non-empty line.
* **Pattern B** — number and heading on one line (`3.2 Calculation and Payment of Fee.`).
* Body = text between this heading and the next, joined with single spaces. Strip `Page N of M` noise; drop the heading if PyMuPDF repeated it at the start of the body.
* Skip sections whose body is shorter than 40 characters.
* Bodies longer than **1200 characters** are split on word boundaries into sub-chunks with letter suffixes: `§3.2a`, `§3.2b`, … All sub-chunks keep the same heading.
* Fallback: if no numbered sections exist, split on blank lines (paragraphs > 60 chars) and label them `§P1`, `§P2`, …

## Step 3: Classify and insert
* `clause_type` = first entry in `clause_types.yaml` whose keywords (case-insensitive, stem match) appear in `heading + text`; else `"other"`. Order in the YAML matters — first match wins.
* Build each document exactly as in [`data/clause_schema.md`](data/clause_schema.md) with `doc_type="standard_template"`, `vendor_id=null`, `session_id=null`, `review_date=today`.
* `$vectorize` = `heading + " " + text` (AstraDB embeds server-side — never call an embedding API).
* Bulk `insert_many`. Print per-file progress and the inserted count.

## Step 4: Verify
* `scripts/query_template.py` — small CLI that lists/queries `standard_template` clauses for a `template_id` (used for manual verification).
* Expected result for `GTA-STANDARD-v1.0`: **15 chunks** are stored. Report if the count differs.
* Optional helper `scripts/fix_pdf_text_mismatches.py` — diagnostic that compares extracted text against `page.search_for()` hits, to find characters (ligatures, non-breaking hyphens) that would make later find/replace fail.

## Cleanup
* Write documentation but keep it super simple and non-verbose. Max 3–4 pages per .md file. Place into `scripts/docs/`.
* Add `scripts/.env`, `scripts/.venv/` to `.gitignore`. Pin dependencies in `scripts/requirements.txt`.
