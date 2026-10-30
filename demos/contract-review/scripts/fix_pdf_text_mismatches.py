"""
fix_pdf_text_mismatches.py
---------------------------
Fixes word-number mismatches in the standard template and vendor contract PDFs.

Uses PyMuPDF's find-redact-reinsert approach on the COMPLETE phrase so that
each replacement is a single coherent text span, not multiple floating fragments.

Run:
    cd contract_review_v2/scripts
    .venv/bin/python fix_pdf_text_mismatches.py
"""

import sys
from pathlib import Path
import pymupdf as fitz

# ── Each fix: (pdf_path, find_phrase, replace_phrase, description) ─────────
# We match the FULL surrounding sentence fragment so the replacement lands in
# exactly the right place and reads as one continuous piece of text.

SCRIPT_DIR = Path(__file__).parent

FIXES = [
    # ──────────── Standard Template ────────────────────────────────────────

    # §2.2 — the whole renewal sentence is scattered across page because previous
    # script removed the words and left orphan numbers; restore the full sentence.
    (
        SCRIPT_DIR / "templates/GTA.Standard-Template.pdf",
        # The broken version has the numbers floating with no words around them
        # Search for what's actually there now:
        "No later than",
        "No later than Sixty (60)",
        "§2.2: restore 'No later than Sixty (60)' — notice period",
    ),
    (
        SCRIPT_DIR / "templates/GTA.Standard-Template.pdf",
        "GTA shall have",
        "GTA shall have two (2)",
        "§2.2: restore 'GTA shall have two (2)' — renewal options",
    ),
    (
        SCRIPT_DIR / "templates/GTA.Standard-Template.pdf",
        "each for up to twelve",
        "each for up to six",
        "§2.2: restore 'each for up to six' — renewal duration (remove 'twelve')",
    ),
    # §2.4 — broken: "Sixty (60) two (2) six (6) GTA has the right..."
    # The three orphaned spans sit before the sentence.  We'll redact all three
    # plus the sentence start and write the full correct sentence once.
    (
        SCRIPT_DIR / "templates/GTA.Standard-Template.pdf",
        "Sixty (60) two (2) six (6)",
        "",   # wipe the orphaned spans — they were incorrectly placed here
        "§2.4: remove orphaned replacement spans from wrong position",
    ),
    (
        SCRIPT_DIR / "templates/GTA.Standard-Template.pdf",
        "upon forty-five (45)",
        "upon forty-five (45)",
        "§2.4: verify 'forty-five (45)' is in the correct sentence (no-op if OK)",
    ),
    # §3.2 — "fifteen (15)" orphan sitting in wrong place
    (
        SCRIPT_DIR / "templates/GTA.Standard-Template.pdf",
        "fifteen (15) days following",
        "fifteen (15) days following",
        "§3.2: verify 'fifteen (15) days following' is correct (no-op if OK)",
    ),

    # ──────────── Everton Vendor Contract ──────────────────────────────────
    # Same pattern — orphaned spans need wiping, sentences need restoring
    (
        SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf",
        "No later than",
        "No later than Ninety (90)",
        "§2.2: restore 'No later than Ninety (90)' — notice period",
    ),
    (
        SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf",
        "GTA shall have",
        "GTA shall have two (2)",
        "§2.2: restore 'GTA shall have two (2)' — renewal options",
    ),
    (
        SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf",
        "each for up to twelve",
        "each for up to six",
        "§2.2: restore 'each for up to six' — renewal duration",
    ),
    # Remove the orphaned replacement spans that ended up in wrong place
    (
        SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf",
        "Ninety (90) two (2) six (6)",
        "",
        "§2.2: remove orphaned replacement spans from wrong position",
    ),
]


def _span_info_at_rect(page, rect):
    """Return (fontsize, color) of the first span overlapping rect."""
    fontsize = 10.0
    color    = (0.0, 0.0, 0.0)
    try:
        blocks = page.get_text("rawdict", clip=rect)["blocks"]
        for b in blocks:
            for line in b.get("lines", []):
                for span in line.get("spans", []):
                    r = fitz.Rect(span["bbox"])
                    if r.intersects(rect):
                        fontsize = span.get("size", fontsize)
                        c = span.get("color", 0)
                        if isinstance(c, int):
                            color = (((c>>16)&0xFF)/255, ((c>>8)&0xFF)/255, (c&0xFF)/255)
                        elif isinstance(c, (list, tuple)) and len(c) == 3:
                            color = tuple(c)
                        return fontsize, color
    except Exception:
        pass
    return fontsize, color


def apply_fixes(pdf_path: Path, fixes: list) -> int:
    if not pdf_path.exists():
        print(f"  SKIP — not found: {pdf_path}")
        return 0

    doc  = fitz.open(str(pdf_path))
    done = 0

    for find_text, replace_text, description in fixes:
        if not find_text:
            continue
        found_any = False
        for page in doc:
            hits = page.search_for(find_text)
            for rect in hits:
                found_any = True
                if replace_text:
                    fs, col = _span_info_at_rect(page, rect)
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                    page.apply_redactions()
                    page.insert_text(
                        fitz.Point(rect.x0, rect.y0 + fs * 0.85),
                        replace_text,
                        fontsize=fs,
                        color=col,
                    )
                else:
                    # Wipe only — blank out the orphaned span
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                    page.apply_redactions()
                done += 1

        mark = "✓" if found_any else "–"
        label = "NOT FOUND" if not found_any else ("wiped" if not replace_text else f"→ '{replace_text}'")
        print(f"  {mark} {description}: {label}")

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    return done


# ── But first: the PDFs are already corrupted by the previous script run.
# The safest recovery is to rebuild them from scratch using reportlab/fpdf2,
# but since we only have PyMuPDF, we must work with what's there.
#
# Strategy:
#   1. Scan each page for ALL redaction annotation leftovers and orphaned spans
#   2. Print a full diagnostic of the 2.2 / 2.4 / 3.2 sections so we can see
#      what text is actually present and in what order
#   3. Apply targeted fixes

def diagnose(pdf_path: Path, sections=("2.2", "2.4", "3.2", "fiIeen", "fifteen",
                                        "Sixty", "Ninety", "forty", "No later than",
                                        "GTA shall have", "each for up to")):
    if not pdf_path.exists():
        return
    doc = fitz.open(str(pdf_path))
    print(f"\n{'='*64}")
    print(f"DIAGNOSE: {pdf_path.name}")
    for i, page in enumerate(doc):
        # Get words in reading order
        words = page.get_text("words", sort=True)   # list of (x0,y0,x1,y1,word,…)
        text  = page.get_text()
        for s in sections:
            idx = text.find(s)
            if idx >= 0:
                snippet = text[max(0,idx-30):idx+150].replace('\n',' ')
                print(f"  p{i+1} [{s!r}]: …{snippet}…")
    doc.close()


if __name__ == "__main__":
    # Step 1 — diagnose current state
    diagnose(SCRIPT_DIR / "templates/GTA.Standard-Template.pdf")
    diagnose(SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf")

    print("\n\nApplying fixes…")
    for pdf_path, fixes_for_pdf in [
        (
            SCRIPT_DIR / "templates/GTA.Standard-Template.pdf",
            [f[1:4] for f in FIXES if f[0] == SCRIPT_DIR / "templates/GTA.Standard-Template.pdf"],
        ),
        (
            SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf",
            [f[1:4] for f in FIXES if f[0] == SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf"],
        ),
    ]:
        print(f"\n→ {pdf_path.name}")
        apply_fixes(pdf_path, fixes_for_pdf)

    # Step 2 — diagnose again to confirm
    print("\n\nPost-fix state:")
    diagnose(SCRIPT_DIR / "templates/GTA.Standard-Template.pdf")
    diagnose(SCRIPT_DIR.parent.parent / "GTA.Everton-Contract.pdf")
