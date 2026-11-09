"""Text chunking shared by every ingestion path (web, COS, S3, Box)."""

from __future__ import annotations

from collections.abc import Iterator

# ibm/slate-30m-english-rtrvr-v2 has a 512 token hard limit.
# 400 characters (~320 tokens) keeps every chunk safely below it.
CHUNK_SIZE = 400
CHUNK_OVERLAP = 50


def split_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> Iterator[str]:
    """Yield stripped, non-empty chunks of *text* with *overlap* characters shared.

    Prefers to break on a sentence/line boundary when one falls in the last 30%
    of the window. Always terminates: the loop exits once the end of the text has
    been emitted, and the window start strictly advances on every iteration.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if not 0 <= overlap < chunk_size:
        raise ValueError("overlap must be >= 0 and < chunk_size")

    length = len(text)
    start = 0
    while start < length:
        end = min(start + chunk_size, length)
        if end < length:
            window = text[start:end]
            break_at = max(window.rfind("."), window.rfind("\n"))
            if break_at > chunk_size * 0.7:
                end = start + break_at + 1

        chunk = text[start:end].strip()
        if chunk:
            yield chunk

        if end >= length:
            return
        start = max(end - overlap, start + 1)
