"""
ingest_standard_templates.py
------------------------------
One-time script. Reads template PDFs from ./templates/, parses them into
clause-level chunks, and inserts each chunk into AstraDB with
doc_type=standard_template.

Works with any numbered contract format — no template-specific strings
are hardcoded anywhere in this file.

Run once:
    cp .env.example .env
    pip install -r requirements.txt
    python ingest_standard_templates.py

Re-run whenever a new template version or type is added to ./templates/.

---- Template metadata -------------------------------------------------------
Place a sidecar YAML file next to each PDF with the same stem:

    templates/
        GTA.Standard-Template.pdf
        GTA.Standard-Template.meta.yaml

Sidecar format:
    template_id:   GTA-MSA-v1.2
    template_type: MSA

If no sidecar exists the script falls back to deriving both from the
filename — no code changes needed for new templates.

---- Clause type classification ----------------------------------------------
Edit clause_types.yaml to define types and their keywords.
If that file is absent every chunk is tagged "other".
No clause vocabulary is hardcoded in this script.
------------------------------------------------------------------------------
"""

import os
import re
import sys
from pathlib import Path
from datetime import date

import pymupdf as fitz
from dotenv import load_dotenv
from astrapy import DataAPIClient

try:
    import yaml as _yaml  # noqa: F401 — tested for availability only
    _YAML = True
except ImportError:
    _YAML = False

# ── Embedding model token limit ───────────────────────────────────────────────
# AstraDB calls nvidia/nv-embedqa-e5-v5 internally via $vectorize.
# That model enforces a 512-token (~350 word) hard limit per document.
# We keep each chunk's $vectorize text (heading + body) well under that.
MAX_CHUNK_CHARS = 1200  # ~300 words — safe under 512 tokens

# ── Credentials ───────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

ASTRA_DB_API_ENDPOINT      = os.environ["ASTRA_DB_API_ENDPOINT"]
ASTRA_DB_APPLICATION_TOKEN = os.environ["ASTRA_DB_APPLICATION_TOKEN"]
ASTRA_DB_COLLECTION        = os.environ.get("ASTRA_DB_COLLECTION", "contract_collection")

# ── AstraDB client ────────────────────────────────────────────────────────────
_client     = DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
_db         = _client.get_database_by_api_endpoint(ASTRA_DB_API_ENDPOINT)
collection  = _db.get_collection(ASTRA_DB_COLLECTION)

# ── Clause type classifier — loaded from clause_types.yaml ───────────────────

def _load_clause_type_rules(path: Path) -> list[tuple]:
    """
    Load (compiled_regex, type_string) pairs from clause_types.yaml.

    File format:
        clause_types:
          - type: fee_payment
            keywords: [fee, payment, invoice]
          - type: termination
            keywords: [terminat, breach, default]

    First match wins. Returns [] if file is absent or yaml is unavailable.
    """
    if not _YAML:
        print("  NOTE: pyyaml not installed — all chunks tagged 'other'.")
        print("        Run: pip install pyyaml")
        return []
    if not path.exists():
        print(f"  NOTE: {path.name} not found — all chunks tagged 'other'.")
        print(f"        Create {path.name} to enable clause type classification.")
        return []

    import yaml as _yaml_mod  # guaranteed available — _YAML is True
    with open(path, encoding="utf-8") as f:
        data = _yaml_mod.safe_load(f) or {}

    rules = []
    for entry in data.get("clause_types", []):
        keywords = [str(k) for k in entry.get("keywords", []) if str(k).strip()]
        if not keywords:
            continue
        pattern = re.compile("|".join(re.escape(k) for k in keywords), re.I)
        rules.append((pattern, entry["type"]))
    return rules


_CLAUSE_RULES = _load_clause_type_rules(
    Path(__file__).parent / "clause_types.yaml"
)


def classify_clause(heading: str, text: str) -> str:
    combined = heading + " " + text
    for pattern, clause_type in _CLAUSE_RULES:
        if pattern.search(combined):
            return clause_type
    return "other"


# ── Template metadata resolution ──────────────────────────────────────────────

def resolve_template_meta(pdf_path: Path) -> tuple[str, str]:
    """
    Return (template_id, template_type) for a PDF.

    Priority:
      1. Sidecar <stem>.meta.yaml next to the PDF.
      2. Filename heuristic — no type names hardcoded.

    Filename heuristic rules:
      - version : first token matching /v\\d+(\\.\\d+)*/  → default "v1.0"
      - type    : first token that is 2–10 uppercase letters, after
                  stripping tokens in SKIP_TOKENS (generic filler words).
                  → default "CONTRACT"
      - id      : "<org_prefix>-<type>-<version>"
                  org_prefix = first token of the stem before any separator

    Examples (no hardcoded type names needed):
      GTA.Standard-Template.pdf     → type=STANDARD, id=GTA-STANDARD-v1.0
      ACME-NDA-v2.1.pdf             → type=NDA,      id=ACME-NDA-v2.1
      Corp.SLA-Template-v3.pdf      → type=SLA,      id=Corp-SLA-v3
      Ministry-PO-Template.pdf      → type=PO,       id=Ministry-PO-v1.0
    """
    # 1 — sidecar
    sidecar = pdf_path.with_suffix("").with_suffix(".meta.yaml")
    if sidecar.exists() and _YAML:
        import yaml as _yaml_mod  # guaranteed available — _YAML is True
        with open(sidecar, encoding="utf-8") as f:
            meta = _yaml_mod.safe_load(f) or {}
        tid  = str(meta.get("template_id",   "")).strip()
        ttyp = str(meta.get("template_type", "")).strip().upper()
        if tid and ttyp:
            return tid, ttyp

    # 2 — filename heuristic
    stem   = pdf_path.stem
    tokens = re.split(r"[\.\-_\s]+", stem)

    # Generic filler words to skip when looking for the type token
    SKIP_TOKENS = {"TEMPLATE", "CONTRACT", "AGREEMENT", "DRAFT",
                   "FINAL", "SIGNED", "COPY", "V", "REV", "PDF"}

    org_prefix = tokens[0] if tokens else "ORG"

    version = "v1.0"
    for tok in tokens:
        if re.fullmatch(r"v\d+(\.\d+)*", tok, re.I):
            version = tok.lower()
            break

    template_type = "CONTRACT"
    for tok in tokens[1:]:          # skip first token (org prefix)
        if tok.upper() in SKIP_TOKENS:
            continue
        if re.fullmatch(r"[A-Z]{2,10}", tok.upper()):
            template_type = tok.upper()
            break

    template_id = f"{org_prefix}-{template_type}-{version}"
    return template_id, template_type


# ── Section heading detection ─────────────────────────────────────────────────
# Detects numbered sections only — works for any contract that uses
# standard legal numbering (1, 1.1, 1.1.1, etc.).
#
# No heading text, keyword, or section title is hardcoded.
#
# Pattern A — number on its own line, heading on next non-empty line:
#   "1.1"
#   "Framework."
#
# Pattern B — number and heading on same line:
#   "3.2 Calculation and Payment of Fee."
#   "ARTICLE 5 Confidentiality"

_NUM_ONLY_RE  = re.compile(r"^\s*(\d+(?:\.\d+)*)\s*$")
_NUM_INLINE_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s{1,6}([A-Z][^\n]{2,})")

# Universal page reference noise — appears in every PDF regardless of content.
_PAGE_NOISE_RE = re.compile(r"\bPage\s+\d+(\s+of\s+\d+)?\b", re.I)


def _split_long_body(section_id: str, heading: str, body: str) -> list[dict]:
    """
    Split a body that exceeds MAX_CHUNK_CHARS into sub-chunks.
    Each sub-chunk gets a letter suffix: §3.2 → §3.2a, §3.2b, …
    All sub-chunks share the same heading.
    """
    if len(body) <= MAX_CHUNK_CHARS:
        return [{"section_id": section_id, "heading": heading, "text": body}]

    chunks: list[dict] = []
    words          = body.split()
    current: list[str] = []
    suffix_idx     = 0

    for word in words:
        current.append(word)
        if len(" ".join(current)) >= MAX_CHUNK_CHARS:
            suffix = chr(ord("a") + suffix_idx)
            chunks.append({
                "section_id": f"{section_id}{suffix}",
                "heading":    heading,
                "text":       " ".join(current),
            })
            current    = []
            suffix_idx += 1

    if current:
        suffix = chr(ord("a") + suffix_idx)
        chunks.append({
            "section_id": f"{section_id}{suffix}",
            "heading":    heading,
            "text":       " ".join(current),
        })

    return chunks


def extract_clauses(raw_text: str) -> list[dict]:
    """
    Split raw PDF text into clause dicts: { section_id, heading, text }.

    Pure structural parsing — no contract-specific strings anywhere.
    Falls back to paragraph splitting if no numbered sections are found.
    """
    text  = re.sub(r"\r\n?", "\n", raw_text)
    lines = text.splitlines()

    # ── Pass 1: locate numbered heading anchors ──────────────────────────────
    anchors: list[tuple[int, str, str]] = []   # (line_idx, section_num, heading)

    i = 0
    while i < len(lines):
        stripped = lines[i].strip()

        # Pattern A: bare section number on its own line
        m = _NUM_ONLY_RE.match(stripped)
        if m and stripped:
            section_num = m.group(1)
            # look ahead for the heading text on the next non-empty line
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                candidate = lines[j].strip().rstrip(".")
                # accept only if it starts with a capital and is not itself a number
                if candidate and re.match(r"[A-Z]", candidate) \
                        and not _NUM_ONLY_RE.match(candidate):
                    anchors.append((i, section_num, candidate))
                    i = j + 1
                    continue

        # Pattern B: number + heading on same line
        m = _NUM_INLINE_RE.match(lines[i])
        if m:
            anchors.append((i, m.group(1), m.group(2).strip().rstrip(".")))
            i += 1
            continue

        i += 1

    # ── Fallback: paragraph split ────────────────────────────────────────────
    if not anchors:
        print("  NOTE: no numbered sections detected — using paragraph fallback.")
        paras  = [p.strip() for p in re.split(r"\n{2,}", text) if len(p.strip()) > 60]
        result: list[dict] = []
        for idx, para in enumerate(paras):
            result.extend(_split_long_body(f"§P{idx+1}", para[:60].rstrip(), para))
        return result

    # ── Pass 2: extract body between anchors ────────────────────────────────
    clauses: list[dict] = []
    for pos, (start, sec_num, heading) in enumerate(anchors):
        end        = anchors[pos + 1][0] if pos + 1 < len(anchors) else len(lines)
        body_lines = lines[start + 1 : end]

        body = " ".join(l.strip() for l in body_lines if l.strip())
        body = _PAGE_NOISE_RE.sub("", body)
        body = re.sub(r"\s{2,}", " ", body).strip()

        # Drop heading text if PyMuPDF duplicated it at the start of the body
        if body.lower().startswith(heading.lower()):
            body = body[len(heading):].strip()

        if len(body) < 40:
            continue

        clauses.extend(_split_long_body(f"§{sec_num}", heading, body))

    return clauses


# ── PDF → AstraDB ─────────────────────────────────────────────────────────────

def ingest_pdf(pdf_path: Path, template_id: str, template_type: str) -> int:
    """Parse one PDF into clause chunks and bulk-insert into AstraDB."""
    print(f"\n→ {pdf_path.name}")
    print(f"  template_id  : {template_id}")
    print(f"  template_type: {template_type}")

    with fitz.open(str(pdf_path)) as doc:
        raw_text = "".join(page.get_text() for page in doc)

    clauses = extract_clauses(raw_text)
    print(f"  Parsed {len(clauses)} clause chunks")

    if not clauses:
        print("  WARNING: no clauses extracted — skipping")
        return 0

    today = date.today().isoformat()
    docs: list[dict] = []
    for clause in clauses:
        vectorize_text = clause["heading"] + " " + clause["text"]
        docs.append({
            "doc_type":      "standard_template",
            "template_id":   template_id,
            "template_type": template_type,
            "vendor_id":     None,
            "session_id":    None,
            "review_date":   today,
            "clause_type":   classify_clause(clause["heading"], clause["text"]),
            "section_id":    clause["section_id"],
            "heading":       clause["heading"],
            "text":          clause["text"],
            # AstraDB calls nvidia/nv-embedqa-e5-v5 internally — we never call
            # an embedding API. Just pass the text and AstraDB handles the rest.
            "$vectorize":    vectorize_text,
        })

    result   = collection.insert_many(docs)
    inserted = len(result.inserted_ids)
    print(f"  ✓ Inserted {inserted} chunks into AstraDB")
    return inserted


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    templates_dir = Path(__file__).parent / "templates"
    if not templates_dir.exists():
        print(f"ERROR: {templates_dir} does not exist.")
        print("Create it and place your template PDFs inside.")
        sys.exit(1)

    pdfs = sorted(templates_dir.glob("*.pdf"))
    if not pdfs:
        print(f"ERROR: no PDF files found in {templates_dir}")
        sys.exit(1)

    total = 0
    for pdf in pdfs:
        template_id, template_type = resolve_template_meta(pdf)
        total += ingest_pdf(pdf, template_id, template_type)

    print(f"\n✓ Done. Total chunks inserted: {total}")


if __name__ == "__main__":
    main()
