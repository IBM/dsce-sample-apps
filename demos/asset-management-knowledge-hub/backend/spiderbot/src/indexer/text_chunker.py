"""Text chunker — splits a long string into overlapping fixed-size chunks.

Splitting strategy (in priority order):
    1. Paragraph boundary (double newline) within the target window.
    2. Sentence boundary (`. `, `? `, `! `, `\\n`) within the window.
    3. Hard cut at ``chunk_size`` if no natural boundary is found.

Overlap is applied by rewinding the cursor by ``chunk_overlap`` characters
after each cut, so that context is preserved at chunk boundaries.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from spiderbot.src.config import spiderbot as cfg


@dataclass
class TextChunk:
    """A single text chunk extracted from a page."""

    index: int
    """Zero-based chunk index within the source page."""
    content: str
    """Text content of this chunk."""
    char_start: int
    """Character offset of the chunk start in the original text."""
    char_end: int
    """Character offset of the chunk end in the original text."""


# ibm/slate-30m-english-rtrvr-v2 hard-limits at 512 tokens.
# Dense technical content tokenises at ~2 tok/char → cap at 400 chars.
_SAFE_MAX = 400
_SENTENCE_PATTERNS = [". ", "? ", "! ", "\n"]


def chunk_text(
    text: str,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> list[TextChunk]:
    """Split *text* into overlapping chunks.

    Args:
        text:          Full page text to split.
        chunk_size:    Target chunk size in characters (default: from config,
                       capped at 400).
        chunk_overlap: Number of characters to rewind after each split
                       (default: from config).

    Returns:
        Ordered list of :class:`TextChunk` objects. Empty list if *text*
        is blank.
    """
    if not text or not text.strip():
        return []

    chunk_size = min(chunk_size or cfg.chunk_size, _SAFE_MAX)
    chunk_overlap = chunk_overlap if chunk_overlap is not None else cfg.chunk_overlap

    chunks: list[TextChunk] = []
    start = 0
    idx = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        split_at = end

        if end < len(text):
            # 1. Paragraph boundary
            para = text.rfind("\n\n", start, end)
            if para > start + chunk_overlap:
                split_at = para + 2
            else:
                # 2. Sentence boundary
                best = -1
                for pat in _SENTENCE_PATTERNS:
                    pos = text.rfind(pat, start, end)
                    if pos > start + chunk_overlap and pos > best:
                        best = pos + len(pat)
                if best > start + chunk_overlap:
                    split_at = best
                # else: 3. hard cut at `end`

        content = text[start:split_at].strip()
        if content:
            chunks.append(TextChunk(index=idx, content=content, char_start=start, char_end=split_at))
            idx += 1

        # Advance with overlap
        new_start = split_at - chunk_overlap
        # Guard: prevent infinite loop when overlap >= progress
        if chunks and new_start <= chunks[-1].char_start:
            new_start = split_at
        start = new_start

    return chunks
