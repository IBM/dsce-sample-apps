# backend/app/api/routers/rag.py
# RAG retrieval tool: retrieve_enterprise_knowledge (spec/04, spec/05)

from __future__ import annotations
import uuid
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.domain.models import Evidence, RAGResponse
from app.rag.retriever import retrieve

router = APIRouter(prefix="/api/knowledge", tags=["rag"])


class KnowledgeQuery(BaseModel):
    query: str
    filters: dict = {}
    top_k: int = 5


@router.post("/retrieve", response_model=RAGResponse)
async def retrieve_knowledge(body: KnowledgeQuery, request: Request) -> RAGResponse:
    return await retrieve(
        query=body.query,
        filters=body.filters,
        top_k=body.top_k,
        correlation_id=getattr(request.state, "correlation_id", str(uuid.uuid4())),
    )
