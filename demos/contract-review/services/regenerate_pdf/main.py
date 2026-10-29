"""
regenerate_pdf — FastAPI service
----------------------------------
POST /rectify_pdf
    Downloads the original vendor PDF from IBM COS, applies exact
    find/replace substitutions with PyMuPDF, uploads the rectified PDF
    back to COS, and returns a 1-hour presigned download URL.

    Caller must pass instructions=[{find, replace}, ...] pairs derived
    from the agent's clause comparison context.  No LLM call is made.

GET /health
    Liveness probe required by Code Engine and OpenShift.

Local run:
    cp .env.example .env
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8080

Container run:
    docker build -t regenerate-pdf:local .
    docker run --env-file .env -p 8080:8080 regenerate-pdf:local
"""

import collections
import io
import logging
import os
import re
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import pymupdf as fitz
import ibm_boto3
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from ibm_botocore.client import Config
from pydantic import BaseModel, Field
from dotenv import load_dotenv

log = logging.getLogger("regenerate_pdf")

# ── Credentials ───────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

COS_API_KEY             = os.environ["COS_API_KEY"]
COS_SERVICE_INSTANCE_ID = os.environ["COS_SERVICE_INSTANCE_ID"]
COS_ENDPOINT            = os.environ.get("COS_ENDPOINT", "https://s3.us-east.cloud-object-storage.appdomain.cloud")
COS_BUCKET              = os.environ.get("COS_BUCKET", "regeneratepdf")

# Only objects written by this platform may be read back (CWE-639 / CWE-918).
_KEY_RE = re.compile(r"^(original|rectified)_[A-Za-z0-9_-]{1,200}\.pdf$")
MAX_PDF_BYTES = 25 * 1024 * 1024

# ── Clients ───────────────────────────────────────────────────────────────────
_cos_upload  = None   # IAM auth — for upload/download
_cos_presign = None   # HMAC auth — for presigned URLs


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _cos_upload, _cos_presign

    _cos_upload = ibm_boto3.client(
        "s3",
        ibm_api_key_id=COS_API_KEY,
        ibm_service_instance_id=COS_SERVICE_INSTANCE_ID,
        config=Config(signature_version="oauth"),
        endpoint_url=COS_ENDPOINT,
    )

    # HMAC credentials for presigned URL generation — optional
    hmac_key    = os.environ.get("COS_HMAC_ACCESS_KEY_ID", "")
    hmac_secret = os.environ.get("COS_HMAC_SECRET_ACCESS_KEY", "")
    if hmac_key and hmac_secret:
        _cos_presign = ibm_boto3.client(
            "s3",
            aws_access_key_id=hmac_key,
            aws_secret_access_key=hmac_secret,
            endpoint_url=COS_ENDPOINT,
        )

    yield


app = FastAPI(
    title="PDF Regeneration Service",
    description="Applies clause corrections to vendor contract PDFs.",
    version="2.0.0",
    lifespan=lifespan,
)


# ── Access control + rate limiting ────────────────────────────────────────────
# Every route except /health requires the shared X-API-Key header (CWE-306).
# Fail closed: the service refuses to start without a key.
API_KEY = os.environ["SERVICE_API_KEY"]
if len(API_KEY) < 24:
    raise RuntimeError("SERVICE_API_KEY must be at least 24 characters.")

_RATE_WINDOW_SEC = 60
_RATE_LIMIT      = 30          # requests per client per window (CWE-770)
_rate_hits: dict[str, collections.deque] = {}


def _client_key(request: Request) -> str:
    real = request.client.host if request.client else "unknown"
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        router_hop = fwd.split(",")[-1].strip()[:64]
        return f"{router_hop}|{real}"
    return real


@app.middleware("http")
async def _guard(request: Request, call_next):
    if request.url.path != "/health":
        supplied = request.headers.get("x-api-key", "")
        if not secrets.compare_digest(supplied.encode(), API_KEY.encode()):
            return JSONResponse({"detail": "Invalid or missing API key."}, status_code=401)
        now  = time.monotonic()
        hits = _rate_hits.setdefault(_client_key(request), collections.deque())
        while hits and now - hits[0] > _RATE_WINDOW_SEC:
            hits.popleft()
        if len(hits) >= _RATE_LIMIT:
            return JSONResponse({"detail": "Too many requests."}, status_code=429,
                                headers={"Retry-After": str(_RATE_WINDOW_SEC)})
        hits.append(now)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Cache-Control", "no-store")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response

# ── Request / response models ─────────────────────────────────────────────────

class Instruction(BaseModel):
    find:    str = Field(max_length=2000)
    replace: str = Field(max_length=2000)


class RectifyRequest(BaseModel):
    cos_pdf_url:  str = Field(max_length=1024)
    instructions: list[Instruction] = Field(max_length=100)   # exact find/replace pairs from agent context


class RectifyResponse(BaseModel):
    download_url:    str
    changes_applied: list[str]
    skipped:         list[str]   # find strings that had no match in the PDF
    expires_in:      int = 3600


# ── PDF editing ───────────────────────────────────────────────────────────────

# ── Font name → xref lookup built per-page ───────────────────────────────────

def _build_font_xref_map(page: fitz.Page) -> dict[str, int]:
    """
    Return a dict mapping every font name variant on this page to its xref.
    Covers both the raw basefont name and the name after stripping the 6-char
    subset prefix (e.g. 'BCDEEE+Times' → 'Times').
    get_fonts() tuple: (xref, ext, type, basefont, refname, encoding, referencer)
    """
    mapping: dict[str, int] = {}
    for entry in page.get_fonts(full=True):
        xref, _ext, _ftype, basefont, _refname, _enc, *_ = entry
        mapping[basefont] = xref
        # strip subset prefix  e.g. "BCDEEE+Times" → "Times"
        if "+" in basefont:
            clean = basefont.split("+", 1)[1]
            mapping[clean] = xref
    return mapping


def _get_span_info(page: fitz.Page, rect: fitz.Rect) -> dict:
    """
    Return font metadata for the dominant body text in rect.

    Strategy:
      1. Collect all spans that overlap rect.
      2. Find the most-common font name (by character count) — dominant body font.
      3. Map that font name to a page xref via get_fonts(), then extract the
         embedded font bytes so insert_textbox uses the EXACT same metrics.
      4. Fall back to helv/10pt if no font can be loaded.

    Returns dict with keys:
      font       — fitz.Font object (embedded) or None (built-in fallback)
      fontname   — built-in alias string (used only when font is None)
      fontsize   — dominant body font size
      color      — RGB tuple (0–1 range)
      origin     — fitz.Point for insert_text single-line fallback
    """
    doc = page.parent

    def _collect_stats(clip_rect: fitz.Rect) -> tuple[dict, fitz.Point | None]:
        """Collect font name → [char_count, size, rgb, origin] from clip_rect."""
        stats: dict[str, list] = {}
        origin = None
        for block in page.get_text("dict", clip=clip_rect)["blocks"]:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if not fitz.Rect(span["bbox"]).intersects(clip_rect):
                        continue
                    fname = span.get("font", "helv")
                    n     = len(span.get("text", ""))
                    sz    = span.get("size", 10.0)
                    c     = span.get("color", 0)
                    rgb   = ((c >> 16) / 255, ((c >> 8) & 0xFF) / 255, (c & 0xFF) / 255)
                    if fname not in stats:
                        stats[fname] = [0, sz, rgb, span.get("origin", clip_rect.tl)]
                    stats[fname][0] += n
                    if origin is None:
                        origin = fitz.Point(span.get("origin", clip_rect.tl))
        return stats, origin

    # Try the exact rect first; if empty, expand by 10pt each side; then whole page.
    name_stats, first_origin = _collect_stats(rect)
    if not name_stats:
        expanded = fitz.Rect(rect.x0 - 5, rect.y0 - 10, rect.x1 + 5, rect.y1 + 10)
        name_stats, first_origin = _collect_stats(expanded)
    if not name_stats:
        # Last resort: scan the full page to get the dominant body font
        name_stats, first_origin = _collect_stats(page.rect)

    if not name_stats:
        return {
            "font_bytes": None,
            "fontname":   "helv",
            "fontsize":   10.0,
            "color":      (0, 0, 0),
            "origin":     rect.tl + fitz.Point(0, rect.height * 0.75),
        }

    # Dominant font = most characters
    best_name = max(name_stats, key=lambda k: name_stats[k][0])
    _, best_size, best_color, best_origin = name_stats[best_name]

    # Try to extract the embedded font bytes from the PDF
    font_bytes = None
    try:
        xref_map = _build_font_xref_map(page)
        xref = xref_map.get(best_name, 0)
        if xref > 0:
            font_info = doc.extract_font(xref)
            # extract_font → (basefont, ext, type, bytes)
            fb = font_info[3] if font_info and len(font_info) > 3 else None
            if fb:
                font_bytes = fb
    except Exception:
        pass

    return {
        "font_bytes": font_bytes,   # raw bytes to register on the target page
        "fontname":   "helv",       # fallback only when font_bytes is None
        "fontsize":   best_size,
        "color":      best_color,
        "origin":     fitz.Point(best_origin) if first_origin is None else first_origin,
    }


def _register_font_on_page(page: fitz.Page, font_bytes: bytes,
                            alias: str = "F_body") -> str:
    """
    Register embedded font bytes on page and return the name to pass to
    insert_textbox / insert_text.  Uses a stable alias so repeated calls
    for the same block are idempotent.
    """
    try:
        page.insert_font(fontname=alias, fontbuffer=font_bytes)
        return alias
    except Exception:
        return "helv"


def _normalise_for_search(text: str) -> str:
    """
    Normalise typographic characters that PDFs sometimes contain but agents
    may not reproduce exactly:
      - en-dash (–), em-dash (—), non-breaking hyphen (‑) → ASCII hyphen (-)
      - non-breaking space, thin space, hair space → regular space
      - collapse runs of whitespace to a single space
    """
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u2011", "-")
    text = text.replace("\u00a0", " ").replace("\u2009", " ").replace("\u200a", " ")
    text = " ".join(text.split())
    return text


def _check_rule4(find_norm: str, replace_norm: str) -> str | None:
    """
    Detect a Rule 4 violation: the agent's replace string is missing the
    surrounding context words that the find string contains.

    A violation produces broken output like:
      "The amount of the Fee shall three percent (3.0%) amount invoiced..."
    instead of:
      "The amount of the Fee shall equal three percent (3.0%) of the total dollar amount..."

    Detection uses two signals, BOTH of which must be true to flag a violation:
      1. replace is substantially shorter than find (< 50% of find word count).
         This catches bare-value violations (no context on either side).
      2. The FIRST word of find does NOT appear in replace at all,
         AND the LAST word of find does NOT appear in replace at all.
         When the agent preserves context, the boundary words of find must
         also appear in replace (same surrounding sentence).

    Returns None if no violation detected (replace looks correct).
    Returns a human-readable error string if a violation is detected.
    """
    fw = find_norm.split()
    rw = replace_norm.split()

    if not fw or not rw:
        return None

    # Signal 1: word-count ratio
    ratio = len(rw) / len(fw)
    if ratio >= 0.50:
        return None   # replace is at least half as long as find → likely correct

    # Signal 2: boundary words of find must appear in replace
    # Strip punctuation for comparison
    def stripped(w: str) -> str:
        return w.lower().strip(".,;:'\"()-")

    first_find_word = stripped(fw[0])
    last_find_word  = stripped(fw[-1])
    replace_words_stripped = [stripped(w) for w in rw]

    first_in_replace = first_find_word in replace_words_stripped
    last_in_replace  = last_find_word  in replace_words_stripped

    if first_in_replace or last_in_replace:
        return None   # at least one boundary word preserved → likely correct

    # Both signals fire → violation
    return (
        f"Rule 4 violation: replace text is missing context words from find. "
        f"find has {len(fw)} words but replace has only {len(rw)} words ({ratio:.0%}). "
        f"The first word of find ({repr(fw[0])}) and last word ({repr(fw[-1])}) "
        f"are both absent from replace. "
        f"replace must contain the same surrounding context as find with only the "
        f"deviating value changed. "
        f"find={repr(find_norm[:80])} replace={repr(replace_norm[:60])}"
    )


def _search_for_robust(page: fitz.Page, text: str) -> list:
    """
    Three-pass search so minor typographic differences don't cause silent misses.

    Pass 1 — exact with ligature awareness (standard PyMuPDF behaviour)
    Pass 2 — exact without ligature flag (treats ﬁ/ﬂ as plain fi/fl)
    Pass 3 — normalised: en/em-dash → hyphen, whitespace collapsed

    Returns the first non-empty hit list, or [] if all passes miss.
    """
    hits = page.search_for(text, flags=fitz.TEXT_PRESERVE_LIGATURES)
    if hits:
        return hits
    hits = page.search_for(text)
    if hits:
        return hits
    normalised = _normalise_for_search(text)
    if normalised != text:
        hits = page.search_for(normalised)
        if hits:
            return hits
    return []


def _rects_overlap(a: fitz.Rect, b: fitz.Rect, tolerance: float = 4.0) -> bool:
    """Return True if two rects share any vertical band (same paragraph block)."""
    a_exp = fitz.Rect(a.x0 - tolerance, a.y0 - tolerance,
                      a.x1 + tolerance, a.y1 + tolerance)
    return not a_exp.intersect(b).is_empty


def _get_containing_block(page: fitz.Page, match_rect: fitz.Rect) -> fitz.Rect:
    """
    Return the tightest PDF block that fully contains match_rect.

    Two-pass strategy — avoids the runaway expansion that swallows an entire
    page when iterative growth is used naïvely.

    Pass 1 — containment search (preferred):
      Find every block whose bounding box encloses match_rect (within a 5 pt
      vertical / 3 pt horizontal tolerance).  Return the smallest one.
      This correctly handles the common case where search_for returns only the
      matched-text line-rect while the enclosing paragraph block is larger.

    Pass 2 — direct intersection fallback:
      Used when no block contains match_rect (e.g. a find string spans two
      adjacent PDF blocks).  Take the union of every block that directly
      intersects match_rect.  No iterative growth — one pass only.

    IMPORTANT: fitz.Rect.intersect() mutates the receiver in place.
    Always construct a fresh Rect before calling intersect().
    """
    all_blocks = [
        fitz.Rect(bx0, by0, bx1, by1)
        for bx0, by0, bx1, by1, btext, *_ in page.get_text("blocks", sort=True)
        if btext.strip()
    ]

    # Pass 1: find the tightest block that encloses match_rect
    containing = []
    for br in all_blocks:
        padded = fitz.Rect(br.x0 - 3, br.y0 - 5, br.x1 + 3, br.y1 + 5)
        if (padded.x0 <= match_rect.x0 and padded.y0 <= match_rect.y0 and
                padded.x1 >= match_rect.x1 and padded.y1 >= match_rect.y1):
            containing.append(br)
    if containing:
        return min(containing, key=lambda r: r.get_area())

    # Pass 2: no single block contains the match — union directly-intersecting blocks
    result = fitz.Rect(match_rect)
    for br in all_blocks:
        isect = fitz.Rect(br).intersect(result)   # fresh copy — intersect mutates
        if not isect.is_empty:
            result |= br
    return result


def _apply_replacements(
    pdf_bytes: bytes, pairs: list[Instruction]
) -> tuple[bytes, list[str], list[str]]:
    """
    Apply find/replace pairs to the PDF.

    The single most important invariant: we always redact and re-insert
    COMPLETE paragraph blocks — never partial fragments. This prevents
    orphaned sentence text when a find string matches only part of a block.

    Algorithm per page:
      1. Find every pair that matches. Immediately expand each match rect
         to its full containing block via _get_containing_block().
      2. Group block rects that overlap each other (same paragraph).
      3. For each group: extract the full block text, apply all substitutions
         as plain string replacements, redact the full block, re-insert result.
      4. All redactions are applied in a single pass before any insertions.
    """
    doc = fitz.open("pdf", pdf_bytes)
    matched_finds: set[str] = set()

    for page in doc:
        page_h = page.rect.height

        # ── Step 1: find matches, expand each to its full containing block(s) ─
        # search_for returns only the rect of the matched line(s).  For long
        # find strings that span several PDF blocks we seed the expansion from
        # ALL matched rects unioned together, then iteratively grow until stable.
        page_hits: list[tuple[fitz.Rect, Instruction]] = []
        for pair in pairs:
            hits = _search_for_robust(page, pair.find)
            if not hits:
                continue
            match_rect = hits[0]
            for r in hits[1:]:
                match_rect |= r
            # KEY: expand to the full containing block(s), iterating to fixpoint
            block_rect = _get_containing_block(page, match_rect)
            matched_finds.add(pair.find)
            page_hits.append((block_rect, pair))

        if not page_hits:
            continue

        # ── Step 2: group overlapping block rects ────────────────────────────
        page_hits.sort(key=lambda x: x[0].y0)

        groups: list[list[tuple[fitz.Rect, Instruction]]] = []
        for item in page_hits:
            placed = False
            for grp in groups:
                union = grp[0][0]
                for r, _ in grp:
                    union |= r
                if _rects_overlap(union, item[0]):
                    grp.append(item)
                    placed = True
                    break
            if not placed:
                groups.append([item])

        # ── Step 3: build one edit per group ─────────────────────────────────
        edits = []

        for grp in groups:
            block_rect = grp[0][0]
            for r, _ in grp[1:]:
                block_rect |= r

            # Build the replacement text for this block.
            #
            # We extract the full block text and apply all substitutions on it.
            # However, when the block is a small sub-block whose height cannot
            # accommodate the full paragraph text, we fall back to using only
            # the pair's own replacement string — this avoids trying to squeeze
            # 257 chars into a 22pt-tall rect just because the find string
            # happened to sit inside the second half of a larger paragraph.
            #
            # The full-block-text approach is still used when the extracted text
            # is the correct scope (i.e. the block rect spans the whole paragraph).
            block_text = page.get_textbox(block_rect)
            block_norm = _normalise_for_search(block_text)

            # Determine the replacement text scope.
            #
            # FULL-BLOCK mode: use get_textbox(block_rect) and substitute all
            # find strings inside the complete extracted block text.
            # This is correct when ALL find strings are present in block_norm
            # (i.e. the block_rect genuinely covers the whole paragraph).
            #
            # SUB-BLOCK mode: use only the replacement strings directly.
            # This is necessary when the matched block_rect is a narrow sub-block
            # (e.g. just the second half of a 2-sentence paragraph): get_textbox
            # returns the full paragraph text (257 chars) but the insert rect is
            # only 22pt tall — it can never fit the full text at a readable size.
            #
            # Detection order (priority):
            #   1. If ALL find strings are literally present in block_norm
            #      → FULL-BLOCK (the block_rect covers the right scope).
            #      This correctly handles the case where 2+ instructions target
            #      the SAME large paragraph — the size check alone would wrongly
            #      classify them as sub-block because total_replace_len << block len.
            #   2. Otherwise, if block is substantially longer than what is
            #      being replaced (> 2× total replace length) → SUB-BLOCK.
            total_replace_len = sum(len(pair.replace) for _, pair in grp)
            all_finds_present = all(
                _normalise_for_search(pair.find) in block_norm
                for _, pair in grp
            )
            is_sub_block = (not all_finds_present) and (
                len(block_norm) > max(total_replace_len * 2, 100)
            )

            if not is_sub_block:
                result_text = block_norm
                for _, pair in grp:
                    find_norm    = _normalise_for_search(pair.find)
                    replace_norm = _normalise_for_search(pair.replace)
                    result_text  = result_text.replace(find_norm, replace_norm, 1)
            else:
                # Sub-block case: insert only the replacement text for this group.
                result_text = " ".join(
                    _normalise_for_search(pair.replace) for _, pair in grp
                )
            replace_text = result_text

            info         = _get_span_info(page, block_rect)
            is_multiline = (block_rect.height > info["fontsize"] * 1.8)

            # The insert rect is ALWAYS the exact original block rect.
            # We never expand downward — doing so would visually overwrite content
            # (tables, headings) that sits immediately below the redacted block.
            # If the replacement text is longer, we shrink the font to fit.
            insert_rect = block_rect

            edits.append((block_rect, insert_rect, info, replace_text, is_multiline))
            page.add_redact_annot(block_rect, fill=(1, 1, 1))

        # ── Step 4: apply all redactions at once, then insert ────────────────
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

        for block_rect, insert_rect, info, replace_text, is_multiline in edits:
            font_bytes = info.get("font_bytes")   # embedded font bytes or None
            font_name  = info["fontname"]          # built-in alias fallback
            font_size  = info["fontsize"]
            color      = info["color"]

            # Register the embedded font on the (now-redacted) page so
            # insert_textbox uses the EXACT original font — same metrics,
            # same appearance, correct size.
            if font_bytes:
                reg_name = _register_font_on_page(page, font_bytes, alias="F_body")
            else:
                reg_name = font_name   # helv fallback

            def _fkw(fs: float) -> dict:
                return {"fontname": reg_name, "fontsize": fs, "color": color}

            if not is_multiline:
                page.insert_text(
                    info["origin"], replace_text,
                    **_fkw(font_size),
                )
            else:
                # Try font sizes from original down to 7pt using the ACTUAL
                # registered embedded font — accurate metrics, no size drift.
                placed = False
                actual_bottom = block_rect.y0
                for fs in [font_size] + [
                    round(font_size - i * 0.5, 1) for i in range(1, 7)
                ]:
                    if fs < 7:
                        break
                    rc = page.insert_textbox(
                        insert_rect, replace_text,
                        align=fitz.TEXT_ALIGN_LEFT,
                        **_fkw(fs),
                    )
                    if rc >= 0:
                        placed = True
                        actual_bottom = insert_rect.y1 - rc
                        break

                if not placed:
                    # Last resort: 7pt, still confined to original block rect
                    page.insert_textbox(
                        insert_rect, replace_text,
                        align=fitz.TEXT_ALIGN_LEFT,
                        **_fkw(7.0),
                    )
                    actual_bottom = insert_rect.y1

                # White-fill any gap between text bottom and block bottom
                if actual_bottom < block_rect.y1:
                    gap_rect = fitz.Rect(block_rect.x0, actual_bottom,
                                         block_rect.x1, block_rect.y1)
                    page.draw_rect(gap_rect, color=None, fill=(1, 1, 1))

    result = doc.tobytes(garbage=4, deflate=True)
    doc.close()

    applied: list[str] = []
    skipped: list[str] = []
    for pair in pairs:
        label = f"{pair.find[:60]}..." if len(pair.find) > 60 else pair.find
        rep   = f"{pair.replace[:40]}..." if len(pair.replace) > 40 else pair.replace
        if pair.find in matched_finds:
            applied.append(f"{label} → {rep}")
        else:
            skipped.append(label)

    return result, applied, skipped


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/rectify_pdf", response_model=RectifyResponse)
def rectify_pdf(req: RectifyRequest):
    """
    Rectify a vendor contract PDF using exact find/replace pairs.
    Downloads from COS, applies PyMuPDF substitutions, uploads result,
    returns a presigned download URL.
    """
    if not req.instructions:
        raise HTTPException(
            status_code=422,
            detail="'instructions' (find/replace pairs) must not be empty."
        )

    # Rule 4 guard: validate every find/replace pair BEFORE downloading the PDF.
    # If the agent dropped context words from replace (replace is a bare value with
    # no surrounding context), reject the whole request with a 422 that tells the
    # agent exactly what to fix. This prevents silent broken-sentence output.
    rule4_errors = []
    for instr in req.instructions:
        err = _check_rule4(
            _normalise_for_search(instr.find),
            _normalise_for_search(instr.replace),
        )
        if err:
            rule4_errors.append(err)
    if rule4_errors:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Rule 4 violation — replace text is missing context words from find.",
                "instructions": (
                    "Each replace must contain the same surrounding context words as find, "
                    "with only the deviating value changed. "
                    "Example: if find='equal two- and one-half percent (2.5%) of the total dollar' "
                    "then replace must be 'equal three percent (3.0%) of the total dollar', "
                    "NOT just 'three percent (3.0%)'."
                ),
                "violations": rule4_errors,
            },
        )

    # Download original PDF from COS using IAM-authenticated client.
    # cos_pdf_url may be a plain COS URL or a presigned URL with query params.
    # Strip query string before extracting bucket/key so retries on presigned
    # URLs (returned as download_url from a previous rectifyPdf call) work.
    expected_prefix = f"{COS_ENDPOINT}/{COS_BUCKET}/"
    if not req.cos_pdf_url.startswith(expected_prefix):
        raise HTTPException(status_code=422, detail="Invalid cos_pdf_url.")
    key = req.cos_pdf_url[len(expected_prefix):].split("?", 1)[0]
    if not _KEY_RE.fullmatch(key):
        raise HTTPException(status_code=422, detail="Invalid cos_pdf_url.")
    bucket = COS_BUCKET

    try:
        buf = io.BytesIO()
        _cos_upload.download_fileobj(bucket, key, buf)
        pdf_bytes = buf.getvalue()
        if not pdf_bytes:
            raise ValueError("Downloaded file is empty")
        if len(pdf_bytes) > MAX_PDF_BYTES:
            raise ValueError("Downloaded file exceeds size limit")
    except Exception:
        log.warning("COS download failed for %s/%s", bucket, key, exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to download PDF from COS.")

    pairs = req.instructions

    # Apply changes to PDF
    rectified_bytes, changes_applied, skipped = _apply_replacements(pdf_bytes, pairs)

    # Upload rectified PDF to COS
    new_key = f"rectified_{uuid.uuid4()}.pdf"
    _cos_upload.upload_fileobj(io.BytesIO(rectified_bytes), COS_BUCKET, new_key)

    # Generate presigned download URL
    if _cos_presign:
        download_url = _cos_presign.generate_presigned_url(
            "get_object",
            Params={"Bucket": COS_BUCKET, "Key": new_key},
            ExpiresIn=3600,
        )
    else:
        # Fallback: direct COS URL (works if bucket is public or IAM-accessible)
        download_url = f"{COS_ENDPOINT}/{COS_BUCKET}/{new_key}"

    return RectifyResponse(
        download_url=download_url,
        changes_applied=changes_applied,
        skipped=skipped,
        expires_in=3600,
    )
