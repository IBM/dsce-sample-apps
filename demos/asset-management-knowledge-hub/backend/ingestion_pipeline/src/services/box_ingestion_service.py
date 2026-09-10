"""Box.com ingestion service.

Downloads files from a Box folder and runs them through the existing
DocumentProcessorService pipeline. Uses the Box Python SDK (boxsdk).
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ingestion_pipeline.src.services.document_processor_service import document_processor_service
from ingestion_pipeline.src.services.document_registry_service import document_registry_service
from ingestion_pipeline.src.services.cos_service import DocumentMetadata
from shared.logging import get_logger

logger = get_logger(__name__)

_SUPPORTED_EXTS = {".pdf", ".docx", ".txt"}


@dataclass
class BoxIngestResult:
    file_id: str
    file_name: str
    status: str   # "ok" | "skipped" | "failed"
    chunks: int = 0
    error: Optional[str] = None


class BoxIngestionService:

    def __init__(self, *, client_id: str, client_secret: str, access_token: str) -> None:
        import boxsdk  # type: ignore
        auth = boxsdk.OAuth2(
            client_id=client_id,
            client_secret=client_secret,
            access_token=access_token,
        )
        self._box = boxsdk.Client(auth)

    def ingest_folder(
        self,
        *,
        folder_id: str = "0",
        force: bool = False,
        asset_num: Optional[str] = None,
        category: str = "box-document",
        tags: list[str] | None = None,
    ) -> list[BoxIngestResult]:
        folder = self._box.folder(folder_id).get()
        results: list[BoxIngestResult] = []
        for item in folder.get_items():
            if item.type != "file":
                continue
            ext = "." + item.name.rsplit(".", 1)[-1].lower() if "." in item.name else ""
            if ext not in _SUPPORTED_EXTS:
                continue
            doc_id = f"box/{item.id}/{item.name}"
            if not force and document_registry_service.is_document_indexed(doc_id):
                results.append(BoxIngestResult(file_id=item.id, file_name=item.name, status="skipped"))
                continue
            try:
                stream = self._box.file(item.id).content()
                file_bytes = stream.read() if hasattr(stream, "read") else stream
                meta = DocumentMetadata(
                    document_id=doc_id,
                    file_name=item.name,
                    file_type="application/octet-stream",
                    file_size=len(file_bytes),
                    upload_date=datetime.utcnow(),
                    version=1,
                    asset_num=asset_num,
                    category=category,
                    tags=tags or [],
                )
                res = document_processor_service.process_document(file_bytes, item.name, meta)
                if res.status == "success":
                    document_registry_service.register_document(doc_id, item.name, res.total_chunks)
                results.append(BoxIngestResult(file_id=item.id, file_name=item.name, status=res.status, chunks=res.total_chunks))
            except Exception as exc:
                logger.error("Box file ingest failed", extra={"file_id": item.id, "error": str(exc)})
                results.append(BoxIngestResult(file_id=item.id, file_name=item.name, status="failed", error=str(exc)))
        return results
