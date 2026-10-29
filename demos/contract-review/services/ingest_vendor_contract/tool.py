"""
ingest_vendor_contract — WXO Python Tool
-----------------------------------------
Called by the watsonx Orchestrate agent on Turn 1 of every review session,
when the reviewer uploads a vendor PDF through the WXO chat UI.

What it does:
  1. Receives the PDF via WXOFile
  2. Extracts and chunks the text with PyMuPDF (same logic as ingest script)
  3. Generates a unique session_id for this upload
  4. Bulk-inserts all clause chunks into AstraDB (doc_type=vendor_contract)
  5. Uploads the original PDF binary to IBM COS for later regeneration
  6. Returns session_id, cos_pdf_url, clause_index to the agent

The session_id (36 chars) is stored in WXO conversation context and passed
to search_contract_clause on every subsequent comparison turn.  The full
PDF text never appears in the agent's context again after this call.
"""

import os
import io
import re
from uuid import uuid4
from datetime import date
from pathlib import Path
from typing import Optional

import pymupdf as fitz
import ibm_boto3
from ibm_botocore.client import Config
from dotenv import load_dotenv
from astrapy import DataAPIClient
from ibm_watsonx_orchestrate.agent_builder.tools import tool, WXOFile

# ── Credentials ───────────────────────────────────────────────────────────────
# When running locally, fall back to .env for convenience.
# In WXO, credentials are injected by the 'ingest_vendor_creds' key_value
# connection as  WXO_CONNECTION_ingest_vendor_creds_<KEY>  env vars.
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

_PFX = "WXO_CONNECTION_ingest_vendor_creds_"

def _cred(key: str, default: str = "") -> str:
    """Read from WXO connection env var; fall back to bare key for local dev."""
    return os.environ.get(f"{_PFX}{key}") or os.environ.get(key, default)

ASTRA_DB_API_ENDPOINT      = _cred("ASTRA_DB_API_ENDPOINT")
ASTRA_DB_APPLICATION_TOKEN = _cred("ASTRA_DB_APPLICATION_TOKEN")
ASTRA_DB_COLLECTION        = _cred("ASTRA_DB_COLLECTION") or "contract_collection"

COS_API_KEY             = _cred("COS_API_KEY")
COS_SERVICE_INSTANCE_ID = _cred("COS_SERVICE_INSTANCE_ID")
COS_ENDPOINT            = _cred("COS_ENDPOINT") or "https://s3.us-east.cloud-object-storage.appdomain.cloud"
COS_BUCKET              = _cred("COS_BUCKET") or "regeneratepdf"

# ── Clients (lazy — built on first tool invocation so WXO-injected creds are live) ──
_collection = None
_cos        = None


def _get_clients():
    global _collection, _cos
    if _collection is not None and _cos is not None:
        return _collection, _cos
    if not ASTRA_DB_APPLICATION_TOKEN or not ASTRA_DB_API_ENDPOINT:
        raise RuntimeError("ASTRA_DB credentials not configured.")
    if not COS_API_KEY or not COS_SERVICE_INSTANCE_ID:
        raise RuntimeError("COS credentials not configured.")
    _collection = (
        DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
        .get_database_by_api_endpoint(ASTRA_DB_API_ENDPOINT)
        .get_collection(ASTRA_DB_COLLECTION)
    )
    _cos = ibm_boto3.client(
        "s3",
        ibm_api_key_id=COS_API_KEY,
        ibm_service_instance_id=COS_SERVICE_INSTANCE_ID,
        config=Config(signature_version="oauth"),
        endpoint_url=COS_ENDPOINT,
    )
    return _collection, _cos

# ── Chunking (same logic as ingest_standard_templates.py) ────────────────────
MAX_CHUNK_CHARS   = 1200
MAX_PDF_BYTES     = 25 * 1024 * 1024
_NUM_ONLY_RE      = re.compile(r"^\s*(\d+(?:\.\d+)*)\s*$")
_NUM_INLINE_RE    = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s{1,6}([A-Z][^\n]{2,})")
_PAGE_NOISE_RE    = re.compile(r"\bPage\s+\d+(\s+of\s+\d+)?\b", re.I)


def _split_long_body(section_id: str, heading: str, body: str) -> list[dict]:
    if len(body) <= MAX_CHUNK_CHARS:
        return [{"section_id": section_id, "heading": heading, "text": body}]
    chunks: list[dict] = []
    words, current, idx = body.split(), [], 0
    for word in words:
        current.append(word)
        if len(" ".join(current)) >= MAX_CHUNK_CHARS:
            chunks.append({"section_id": f"{section_id}{chr(ord('a')+idx)}",
                           "heading": heading, "text": " ".join(current)})
            current, idx = [], idx + 1
    if current:
        chunks.append({"section_id": f"{section_id}{chr(ord('a')+idx)}",
                       "heading": heading, "text": " ".join(current)})
    return chunks


def _extract_clauses(raw_text: str) -> list[dict]:
    text  = re.sub(r"\r\n?", "\n", raw_text)
    lines = text.splitlines()
    anchors: list[tuple[int, str, str]] = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        m = _NUM_ONLY_RE.match(stripped)
        if m and stripped:
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                candidate = lines[j].strip().rstrip(".")
                if candidate and re.match(r"[A-Z]", candidate) \
                        and not _NUM_ONLY_RE.match(candidate):
                    anchors.append((i, m.group(1), candidate))
                    i = j + 1
                    continue
        m = _NUM_INLINE_RE.match(lines[i])
        if m:
            anchors.append((i, m.group(1), m.group(2).strip().rstrip(".")))
            i += 1
            continue
        i += 1

    if not anchors:
        paras = [p.strip() for p in re.split(r"\n{2,}", text) if len(p.strip()) > 60]
        result: list[dict] = []
        for idx, para in enumerate(paras):
            result.extend(_split_long_body(f"§P{idx+1}", para[:60].rstrip(), para))
        return result

    clauses: list[dict] = []
    deferred_headings: list[tuple[str, str, int]] = []  # (sec_num, heading, search_start)

    for pos, (start, sec_num, heading) in enumerate(anchors):
        end        = anchors[pos + 1][0] if pos + 1 < len(anchors) else len(lines)
        body_lines = lines[start + 1 : end]
        body = " ".join(l.strip() for l in body_lines if l.strip())
        body = _PAGE_NOISE_RE.sub("", body)
        body = re.sub(r"\s{2,}", " ", body).strip()
        if body.lower().startswith(heading.lower()):
            body = body[len(heading):].strip()

        if len(body) < 40:
            deferred_headings.append((sec_num, heading, end))
            continue

        clauses.extend(_split_long_body(f"§{sec_num}", heading, body))

    # Second pass: recover headings whose body text appeared later in the PDF
    for d_sec, d_heading, search_start in deferred_headings:
        kw = [w.lower() for w in re.split(r"\W+", d_heading) if len(w) >= 4]
        if not kw:
            continue
        found_start = -1
        for li in range(search_start, len(lines)):
            cleaned = _PAGE_NOISE_RE.sub("", lines[li]).strip()
            if not cleaned:
                continue
            if any(k in cleaned.lower() for k in kw):
                found_start = li
                break
        if found_start == -1:
            continue
        # Walk back up to 3 lines to include sentence start before the keyword
        para_start = found_start
        for back in range(1, 4):
            li_back = found_start - back
            if li_back < search_start:
                break
            cleaned_back = _PAGE_NOISE_RE.sub("", lines[li_back]).strip()
            if not cleaned_back:
                break
            para_start = li_back
        collected: list[str] = []
        for li in range(para_start, min(para_start + 15, len(lines))):
            cleaned = _PAGE_NOISE_RE.sub("", lines[li]).strip()
            if not cleaned:
                if collected:
                    break
                continue
            collected.append(cleaned)
        d_body = re.sub(r"\s{2,}", " ", " ".join(collected)).strip()
        if len(d_body) >= 40:
            clauses.extend(_split_long_body(f"§{d_sec}", d_heading, d_body))

    clauses.sort(key=lambda c: c["section_id"])
    return clauses


# ── WXO Tool ──────────────────────────────────────────────────────────────────

@tool
def ingest_vendor_contract(
    wxo_file: WXOFile,
    vendor_id: str,
    template_id: str,
) -> dict:
    """
    Ingest a vendor contract PDF uploaded by the reviewer.

    Parses the PDF into clause chunks, stores them in AstraDB tagged with a
    unique session_id, and uploads the original PDF to IBM COS for later
    regeneration.

    Args:
        wxo_file:    The vendor contract PDF uploaded in the WXO chat UI.
        vendor_id:   Vendor name slug, e.g. "everton" or "acme-corp".
        template_id: GTA standard template version this contract is based on,
                     e.g. "GTA-STANDARD-v1.0".

    Returns:
        session_id:   Unique ID for this upload — pass to search_contract_clause.
        cos_pdf_url:  COS URL of the original PDF — pass to regenerate_pdf.
        vendor_id:    Echo of the vendor_id provided.
        template_id:  Echo of the template_id provided.
        clause_count: Number of clause chunks stored in AstraDB.
        clause_index: List of "section_id heading" strings for all clauses found.
    """
    collection, cos = _get_clients()

    # 0 — validate identifiers: vendor_id is embedded in the COS object key
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", vendor_id or ""):
        raise ValueError("vendor_id must be 1-64 chars of letters, digits, '_' or '-'.")
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", template_id or ""):
        raise ValueError("template_id must be 1-64 chars of letters, digits, '.', '_' or '-'.")

    # 1 — read PDF bytes from WXO file handle
    pdf_bytes = wxo_file.read()
    if not pdf_bytes:
        raise ValueError("Uploaded file is empty.")
    if len(pdf_bytes) > MAX_PDF_BYTES or not pdf_bytes.startswith(b"%PDF-"):
        raise ValueError("Uploaded file must be a PDF of at most 25 MB.")

    # 2 — extract text with PyMuPDF
    with fitz.open("pdf", pdf_bytes) as doc:
        raw_text = "".join(page.get_text() for page in doc)

    # 3 — parse into clause chunks
    clauses = _extract_clauses(raw_text)
    if not clauses:
        raise ValueError("No clause sections could be extracted from the PDF.")

    # 4 — generate unique session_id for this upload
    session_id  = str(uuid4())
    today       = date.today().isoformat()

    # 5 — bulk insert all chunks into AstraDB
    docs = []
    for clause in clauses:
        vectorize_text = clause["heading"] + " " + clause["text"]
        docs.append({
            "doc_type":      "vendor_contract",
            "template_id":   template_id,
            "template_type": None,
            "vendor_id":     vendor_id,
            "session_id":    session_id,
            "review_date":   today,
            "clause_type":   "other",   # not classified at ingest — search uses vectors
            "section_id":    clause["section_id"],
            "heading":       clause["heading"],
            "text":          clause["text"],
            "$vectorize":    vectorize_text,
        })
    collection.insert_many(docs)

    # 6 — upload original PDF to COS for regenerate_pdf service
    cos_key = f"original_{vendor_id}_{session_id}.pdf"
    cos.upload_fileobj(io.BytesIO(pdf_bytes), COS_BUCKET, cos_key)
    cos_pdf_url = f"{COS_ENDPOINT}/{COS_BUCKET}/{cos_key}"

    # 7 — build clause index for agent context
    clause_index = list({
        f"{c['section_id']} {c['heading']}"
        for c in clauses
    })
    clause_index.sort()

    return {
        "session_id":   session_id,
        "cos_pdf_url":  cos_pdf_url,
        "vendor_id":    vendor_id,
        "template_id":  template_id,
        "clause_count": len(docs),
        "clause_index": clause_index,
    }
