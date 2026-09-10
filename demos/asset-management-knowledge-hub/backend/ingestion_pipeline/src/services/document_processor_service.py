"""Document processor — extract text, chunk, embed, and index documents.

Supported file types: PDF, DOCX, TXT.

The processor is intentionally kept I/O-bound friendly: it processes
chunks in small batches rather than loading the entire document into
memory as a single object.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

import pdfplumber  # type: ignore
import mammoth  # type: ignore

from ingestion_pipeline.src.services.cos_service import DocumentMetadata
from ingestion_pipeline.src.services.opensearch_service import OpenSearchService, DocumentChunk
from ingestion_pipeline.src.services.document_registry_service import document_registry_service
from shared.watsonx import client as wx
from shared.logging import get_logger

logger = get_logger(__name__)

# ibm/slate-30m-english-rtrvr-v2 — 512 token hard limit.
# Stay safely under by capping at 400 characters (~320 tokens).
_CHUNK_SIZE = 400
_CHUNK_OVERLAP = 50
_BATCH_SIZE = 10  # chunks per embedding API call


@dataclass
class ProcessingResult:
    """Summary of a single document processing run."""

    document_id: str
    file_name: str
    total_chunks: int
    status: str  # "success" | "failed"
    error: Optional[str] = None


class DocumentProcessorService:
    """End-to-end document processing: extract → chunk → embed → index."""

    def __init__(self, opensearch: OpenSearchService) -> None:
        self._os = opensearch

    # ── Public API ────────────────────────────────────────────────────────────

    def process_document(
        self,
        file_bytes: bytes,
        file_name: str,
        metadata: DocumentMetadata,
        *,
        embedding_model: Optional[str] = None,
    ) -> ProcessingResult:
        """Process *file_bytes* and index all chunks in OpenSearch.

        Args:
            file_bytes:      Raw file content.
            file_name:       Original file name (used for display and ID).
            metadata:        Document metadata from COS.
            embedding_model: Override the default embedding model ID.

        Returns:
            :class:`ProcessingResult` with status and chunk count.
        """
        logger.info("▶ Processing document", extra={"file": file_name, "size_bytes": len(file_bytes)})
        try:
            doc_id = (
                f"{metadata.asset_num}/{metadata.category or 'document'}/{file_name}"
                if metadata.asset_num
                else f"documents/{file_name}"
            )
            logger.debug("Document ID assigned", extra={"doc_id": doc_id})

            logger.debug("Extracting text…", extra={"file": file_name})
            text = self._extract_text(file_bytes, file_name)
            del file_bytes  # release memory early
            logger.info("Text extracted", extra={"file": file_name, "chars": len(text)})

            if not text.strip():
                logger.warning("⚠ Document yielded no text — skipping", extra={"file": file_name, "doc_id": doc_id})
                return ProcessingResult(
                    document_id=doc_id,
                    file_name=file_name,
                    total_chunks=0,
                    status="failed",
                    error="No text could be extracted from document",
                )

            logger.debug("Chunking + embedding + indexing…", extra={"file": file_name})
            total = self._process_and_index(text, doc_id, file_name, metadata)
            logger.info("✔ Document indexed", extra={"file": file_name, "doc_id": doc_id, "chunks": total})
            return ProcessingResult(
                document_id=doc_id,
                file_name=file_name,
                total_chunks=total,
                status="success",
            )
        except Exception as exc:
            logger.error("✘ Document processing failed", extra={"file": file_name, "error": str(exc)}, exc_info=True)
            return ProcessingResult(
                document_id="",
                file_name=file_name,
                total_chunks=0,
                status="failed",
                error=str(exc),
            )

    # ── Text extraction ───────────────────────────────────────────────────────

    def _extract_text(self, file_bytes: bytes, file_name: str) -> str:
        ext = file_name.rsplit(".", 1)[-1].lower()
        if ext == "pdf":
            return self._extract_pdf(file_bytes)
        if ext == "docx":
            return self._extract_docx(file_bytes)
        if ext == "txt":
            return file_bytes.decode("utf-8", errors="replace")
        raise ValueError(f"Unsupported file type: .{ext}")

    @staticmethod
    def _extract_pdf(data: bytes) -> str:
        import io
        text_parts: list[str] = []
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text)
        return "\n".join(text_parts)

    @staticmethod
    def _extract_docx(data: bytes) -> str:
        import io
        result = mammoth.extract_raw_text(io.BytesIO(data))
        return result.value

    # ── Chunking + indexing ───────────────────────────────────────────────────

    def _process_and_index(
        self,
        text: str,
        doc_id: str,
        file_name: str,
        metadata: DocumentMetadata,
    ) -> int:
        """Stream-process text into chunks, embed them in batches, and index."""
        from datetime import datetime, timezone

        chunk_index = 0
        start = 0
        batch: list[DocumentChunk] = []
        total_indexed = 0

        while start < len(text):
            end = min(start + _CHUNK_SIZE, len(text))
            chunk_text = text[start:end]

            # Prefer sentence boundary
            if end < len(text):
                last_period = chunk_text.rfind(".")
                last_nl = chunk_text.rfind("\n")
                break_at = max(last_period, last_nl)
                if break_at > _CHUNK_SIZE * 0.7:
                    end = start + break_at + 1
                    chunk_text = text[start:end]

            content = chunk_text.strip()
            if content:
                chunk_id = document_registry_service.generate_chunk_id(doc_id, chunk_index)
                batch.append(
                    DocumentChunk(
                        id=chunk_id,
                        document_id=doc_id,
                        file_name=file_name,
                        chunk_index=chunk_index,
                        content=content,
                        metadata={
                            "assetnum": metadata.asset_num,
                            "category": metadata.category,
                            "version": metadata.version,
                            "tags": metadata.tags,
                        },
                        timestamp=datetime.now(timezone.utc).isoformat(),
                    )
                )
                chunk_index += 1

            if len(batch) >= _BATCH_SIZE:
                total_indexed += self._flush_batch(batch)
                batch = []

            start = end - _CHUNK_OVERLAP

        if batch:
            total_indexed += self._flush_batch(batch)

        return total_indexed

    def _flush_batch(self, batch: list[DocumentChunk]) -> int:
        """Generate embeddings for *batch* and bulk-index them."""
        texts = [c.content for c in batch]
        logger.debug("Embedding batch", extra={"chunks": len(texts)})
        embeddings = wx.embed_batched(texts)
        for chunk, emb in zip(batch, embeddings):
            chunk.embedding = emb
        self._os.bulk_index_chunks(batch)
        logger.debug("Batch indexed", extra={"chunks": len(batch)})
        return len(batch)


document_processor_service = DocumentProcessorService(
    opensearch=__import__(
        "ingestion_pipeline.src.services.opensearch_service",
        fromlist=["opensearch_service"],
    ).opensearch_service,
)
