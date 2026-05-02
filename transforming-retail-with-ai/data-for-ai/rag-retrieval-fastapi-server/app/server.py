"""
FastAPI RAG Retrieval Server
Provides REST API endpoints for semantic search and keyword search
Supports OpenSearch and Milvus vector databases
"""

from __future__ import annotations

import os
import platform
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Vector DBs
from opensearchpy import OpenSearch
from pymilvus import connections, Collection, utility

# Embeddings (Watsonx)
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import Embeddings

# Load .env early
load_dotenv()

# =============================================================================
# Configuration
# =============================================================================

SERVER_NAME = os.getenv("SERVER_NAME", "rag-retrieval-api")
SERVER_VERSION = os.getenv("SERVER_VERSION", "1.0.0")
SERVER_DESCRIPTION = os.getenv(
    "SERVER_DESCRIPTION",
    "FastAPI RAG Retrieval Server for semantic and keyword search",
)
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

APP_BEARER_TOKEN: Optional[str] = os.getenv("APP_BEARER_TOKEN", "").strip() or None
ALLOWED_ORIGINS_ENV: str = os.getenv("ALLOWED_ORIGINS", "*").strip()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def build_server_info() -> Dict[str, Any]:
    return {
        "hostname": socket.gethostname(),
        "server_time": utc_now_iso(),
        "timezone": "UTC",
        "server_name": SERVER_NAME,
        "server_version": SERVER_VERSION,
        "description": SERVER_DESCRIPTION,
        "environment": ENVIRONMENT,
        "platform": platform.system(),
        "platform_release": platform.release(),
        "python_version": platform.python_version(),
    }


# =============================================================================
# Data Models
# =============================================================================

class RetrievalRequest(BaseModel):
    query: str = Field(..., description="Search query text")
    k: int = Field(5, ge=1, le=100, description="Number of results to return")
    destination_index: Optional[str] = Field(None, description="Override default index/collection")


class KeywordSearchRequest(BaseModel):
    query: str = Field(..., description="Keyword search query")
    k: int = Field(5, ge=1, le=100, description="Number of results to return")
    destination_index: Optional[str] = Field(None, description="Override default index")


class SearchResult(BaseModel):
    id: Optional[str] = None
    score: Optional[float] = None
    title: str = ""
    source: str = ""
    page_number: str = ""
    chunk_seq: str = ""
    document_url: str = ""
    text: str = ""


class RetrievalResponse(BaseModel):
    backend: str
    index: str
    k: int
    results: List[SearchResult]


# =============================================================================
# Configuration Classes
# =============================================================================

@dataclass
class EmbeddingConfig:
    watsonx_url: str = ""
    watsonx_api_key: str = ""
    project_id: str = ""
    embedding_model_id: str = ""

    def is_configured(self) -> bool:
        return bool(self.watsonx_url and self.watsonx_api_key and self.project_id and self.embedding_model_id)


@dataclass
class VectorDbConfig:
    db_type: str = ""  # opensearch | milvus

    # OpenSearch
    opensearch_host: str = ""
    opensearch_port: int = 9200
    opensearch_username: str = ""
    opensearch_password: str = ""
    opensearch_index: str = "rag-index"
    opensearch_use_ssl: bool = True

    # Milvus
    milvus_host: str = ""
    milvus_port: int = 19530
    milvus_user: str = ""
    milvus_password: str = ""
    milvus_secure: bool = False
    milvus_collection: str = "rag_collection"
    milvus_dense_field: str = "vector"
    milvus_text_field: str = "text"

    def is_configured(self) -> bool:
        if self.db_type == "opensearch":
            return bool(self.opensearch_host and self.opensearch_index)
        if self.db_type == "milvus":
            return bool(self.milvus_host and self.milvus_collection)
        return False


def _env_bool(key: str, default: bool = False) -> bool:
    val = os.getenv(key, "").strip().lower()
    if not val:
        return default
    return val in ("1", "true", "yes", "y", "on")


def load_embedding_config() -> EmbeddingConfig:
    return EmbeddingConfig(
        watsonx_url=os.getenv("WATSONX_URL", "").strip(),
        watsonx_api_key=os.getenv("WATSONX_API_KEY", "").strip(),
        project_id=os.getenv("WATSONX_PROJECT_ID", "").strip(),
        embedding_model_id=os.getenv("EMBEDDING_MODEL_ID", "").strip(),
    )


def load_vector_db_config() -> VectorDbConfig:
    return VectorDbConfig(
        db_type=os.getenv("VECTOR_DB_TYPE", "").strip().lower(),

        opensearch_host=os.getenv("OPENSEARCH_HOST", "").strip(),
        opensearch_port=int(os.getenv("OPENSEARCH_PORT", "9200")),
        opensearch_username=os.getenv("OPENSEARCH_USERNAME", "").strip(),
        opensearch_password=os.getenv("OPENSEARCH_PASSWORD", "").strip(),
        opensearch_index=os.getenv("OPENSEARCH_INDEX", "rag-index").strip(),
        opensearch_use_ssl=_env_bool("OPENSEARCH_USE_SSL", True),

        milvus_host=os.getenv("MILVUS_HOST", "").strip(),
        milvus_port=int(os.getenv("MILVUS_PORT", "19530")),
        milvus_user=os.getenv("MILVUS_USER", "").strip(),
        milvus_password=os.getenv("MILVUS_PASSWORD", "").strip(),
        milvus_secure=_env_bool("MILVUS_SECURE", False),
        milvus_collection=os.getenv("MILVUS_COLLECTION", "rag_collection").strip(),
        milvus_dense_field=os.getenv("MILVUS_DENSE_FIELD", "vector").strip(),
        milvus_text_field=os.getenv("MILVUS_TEXT_FIELD", "text").strip(),
    )


# =============================================================================
# Masking helpers
# =============================================================================

def _mask_secret(val: str, show_start: int = 0, show_end: int = 0) -> str:
    if not val:
        return ""
    if show_start + show_end >= len(val):
        return "*" * len(val)
    return f"{val[:show_start]}{'*' * (len(val) - show_start - show_end)}{val[-show_end:]}"


def _mask_username(val: str) -> str:
    if not val:
        return ""
    if len(val) <= 4:
        return _mask_secret(val, show_start=1, show_end=1)
    return _mask_secret(val, show_start=2, show_end=2)


# =============================================================================
# Client Functions
# =============================================================================

def get_embedding(embed_cfg: EmbeddingConfig) -> Embeddings:
    credentials = Credentials(api_key=embed_cfg.watsonx_api_key, url=embed_cfg.watsonx_url)
    return Embeddings(
        model_id=embed_cfg.embedding_model_id,
        credentials=credentials,
        project_id=embed_cfg.project_id,
        verify=True,
    )


def _normalize_opensearch_host_port(vdb: VectorDbConfig) -> Tuple[str, int, bool]:
    host = vdb.opensearch_host.strip()
    port = vdb.opensearch_port
    use_ssl = vdb.opensearch_use_ssl

    if host.startswith("http://") or host.startswith("https://"):
        parsed = urlparse(host)
        if parsed.hostname:
            host = parsed.hostname
        if parsed.port:
            port = parsed.port
        if parsed.scheme == "http":
            use_ssl = False
        elif parsed.scheme == "https":
            use_ssl = True

    return host, port, use_ssl


def _opensearch_client(vdb: VectorDbConfig) -> OpenSearch:
    host, port, use_ssl = _normalize_opensearch_host_port(vdb)

    http_auth = None
    if vdb.opensearch_username or vdb.opensearch_password:
        http_auth = (vdb.opensearch_username, vdb.opensearch_password)

    return OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_auth=http_auth,
        use_ssl=use_ssl,
        verify_certs=use_ssl,
    )


def _milvus_connect(vdb: VectorDbConfig) -> None:
    kwargs: Dict[str, Any] = {
        "host": vdb.milvus_host,
        "port": str(vdb.milvus_port),
        "secure": vdb.milvus_secure,
    }
    if vdb.milvus_user:
        kwargs["user"] = vdb.milvus_user
    if vdb.milvus_password:
        kwargs["password"] = vdb.milvus_password
    connections.connect(alias="default", **kwargs)


# =============================================================================
# Bootstrap connectivity checks
# =============================================================================

def _print_bootstrap_status(name: str, ok: bool, detail: str = "") -> None:
    status = "OK" if ok else "FAIL"
    msg = f"[BOOTSTRAP] {name}: {status}"
    if detail:
        msg += f" - {detail}"
    print(msg, flush=True)


def bootstrap_check_connections() -> None:
    try:
        emb_cfg = load_embedding_config()
        if not emb_cfg.is_configured():
            _print_bootstrap_status("WATSONX_EMBEDDINGS", False, "Not configured")
        else:
            emb = get_embedding(emb_cfg)
            _ = emb.embed_query("ping")
            _print_bootstrap_status("WATSONX_EMBEDDINGS", True, f"model={emb_cfg.embedding_model_id}")
    except Exception as e:
        _print_bootstrap_status("WATSONX_EMBEDDINGS", False, f"{type(e).__name__}: {e}")

    try:
        vdb = load_vector_db_config()
        if not vdb.is_configured():
            _print_bootstrap_status("VECTOR_DB", False, "Not configured")
            return

        if vdb.db_type == "opensearch":
            try:
                os_client = _opensearch_client(vdb)
                ok = bool(os_client.ping())
                host, port, use_ssl = _normalize_opensearch_host_port(vdb)
                _print_bootstrap_status("OPENSEARCH", ok, f"{host}:{port} ssl={use_ssl}")
            except Exception as e:
                _print_bootstrap_status("OPENSEARCH", False, f"{type(e).__name__}: {e}")

        elif vdb.db_type == "milvus":
            try:
                _milvus_connect(vdb)
                ver = utility.get_server_version()
                _print_bootstrap_status("MILVUS", True, f"server_version={ver}")
            except Exception as e:
                _print_bootstrap_status("MILVUS", False, f"{type(e).__name__}: {e}")

        else:
            _print_bootstrap_status("VECTOR_DB", False, f"Unknown VECTOR_DB_TYPE={vdb.db_type}")

    except Exception as e:
        _print_bootstrap_status("VECTOR_DB", False, f"{type(e).__name__}: {e}")


# =============================================================================
# Query Functions
# =============================================================================

def _opensearch_semantic_query(vector: List[float], k: int) -> Dict[str, Any]:
    return {
        "size": k,
        "query": {
            "knn": {
                "content_vector": {
                    "vector": vector,
                    "k": k,
                }
            }
        },
        "_source": {
            "includes": ["id", "title", "source", "page_number", "chunk_seq", "text", "document_url", "content"]
        },
    }


def _opensearch_keyword_query(query: str, k: int) -> Dict[str, Any]:
    return {
        "size": k,
        "query": {"match": {"content": {"query": query}}},
        "_source": {
            "includes": ["id", "title", "source", "page_number", "chunk_seq", "text", "document_url", "content"]
        },
    }


def _format_hits(hits: List[Dict[str, Any]]) -> List[SearchResult]:
    out: List[SearchResult] = []
    for h in hits:
        src = h.get("_source", {}) or {}
        out.append(
            SearchResult(
                id=h.get("_id") or src.get("id"),
                score=h.get("_score"),
                title=src.get("title", ""),
                source=src.get("source", ""),
                page_number=src.get("page_number", ""),
                chunk_seq=src.get("chunk_seq", ""),
                document_url=src.get("document_url", ""),
                text=src.get("text") or src.get("content") or "",
            )
        )
    return out


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title=SERVER_NAME,
    version=SERVER_VERSION,
    description=SERVER_DESCRIPTION,
)

# CORS
origins = ALLOWED_ORIGINS_ENV.split(",") if ALLOWED_ORIGINS_ENV != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication dependency
async def verify_token(authorization: Optional[str] = Header(None)):
    if APP_BEARER_TOKEN:
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing Authorization header")
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid Authorization header format")
        token = authorization.replace("Bearer ", "")
        if token != APP_BEARER_TOKEN:
            raise HTTPException(status_code=401, detail="Invalid token")


# Bootstrap on startup
@app.on_event("startup")
async def startup_event():
    print(f"Starting {SERVER_NAME} v{SERVER_VERSION}")
    bootstrap_check_connections()


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/")
async def root():
    return {
        "server": SERVER_NAME,
        "version": SERVER_VERSION,
        "description": SERVER_DESCRIPTION,
        "environment": ENVIRONMENT,
        "endpoints": {
            "health": "/health",
            "info": "/info",
            "config": "/config",
            "retrieve": "/retrieve",
            "keyword_search": "/keyword-search",
        },
        "auth": {"enabled": bool(APP_BEARER_TOKEN)},
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "server": SERVER_NAME,
        "version": SERVER_VERSION,
        "timestamp": utc_now_iso(),
    }


@app.get("/info")
async def info():
    return build_server_info()


@app.get("/config", dependencies=[Depends(verify_token)])
async def get_config():
    emb = load_embedding_config()
    vdb = load_vector_db_config()
    host, port, use_ssl = _normalize_opensearch_host_port(vdb)

    return {
        "embedding": {
            "configured": emb.is_configured(),
            "watsonx_url": emb.watsonx_url,
            "project_id": emb.project_id,
            "embedding_model_id": emb.embedding_model_id,
            "watsonx_api_key": _mask_secret(emb.watsonx_api_key, show_start=2, show_end=2) if emb.watsonx_api_key else "",
        },
        "vector_db": {
            "configured": vdb.is_configured(),
            "db_type": vdb.db_type,
            "opensearch": {
                "host": host,
                "port": port,
                "use_ssl": use_ssl,
                "index": vdb.opensearch_index,
                "username": _mask_username(vdb.opensearch_username),
                "password_set": bool(vdb.opensearch_password),
            },
            "milvus": {
                "host": vdb.milvus_host,
                "port": vdb.milvus_port,
                "secure": vdb.milvus_secure,
                "collection": vdb.milvus_collection,
                "dense_field": vdb.milvus_dense_field,
                "text_field": vdb.milvus_text_field,
                "username": _mask_username(vdb.milvus_user),
                "password_set": bool(vdb.milvus_password),
            },
        },
    }


@app.post("/retrieve", response_model=RetrievalResponse, dependencies=[Depends(verify_token)])
async def retrieve(request: RetrievalRequest):
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="query must be a non-empty string")

    emb_cfg = load_embedding_config()
    vdb = load_vector_db_config()

    if not emb_cfg.is_configured():
        raise HTTPException(
            status_code=500,
            detail="Embedding config missing. Set WATSONX_URL, WATSONX_API_KEY, WATSONX_PROJECT_ID, EMBEDDING_MODEL_ID."
        )
    if not vdb.is_configured():
        raise HTTPException(
            status_code=500,
            detail="Vector DB config missing. Set VECTOR_DB_TYPE and backend vars."
        )

    dest = (request.destination_index or "").strip()
    if vdb.db_type == "opensearch":
        index_name = dest or vdb.opensearch_index
    else:
        index_name = dest or vdb.milvus_collection

    try:
        embedding = get_embedding(emb_cfg)
        vector = embedding.embed_query(request.query)

        if vdb.db_type == "opensearch":
            os_client = _opensearch_client(vdb)
            body = _opensearch_semantic_query(vector=vector, k=request.k)
            resp = os_client.search(index=index_name, body=body)
            hits = (resp.get("hits", {}) or {}).get("hits", []) or []
            return RetrievalResponse(
                backend="opensearch",
                index=index_name,
                k=request.k,
                results=_format_hits(hits),
            )

        if vdb.db_type == "milvus":
            _milvus_connect(vdb)
            coll = Collection(name=index_name)
            coll.load()

            search_params = {"metric_type": "L2", "params": {"nprobe": 10}}
            res = coll.search(
                data=[vector],
                anns_field=vdb.milvus_dense_field,
                param=search_params,
                limit=request.k,
                output_fields=["id", "title", "source", "page_number", "chunk_seq", "document_url", vdb.milvus_text_field],
            )

            out: List[SearchResult] = []
            for hits in res:
                for h in hits:
                    ent = h.entity
                    out.append(
                        SearchResult(
                            id=ent.get("id"),
                            score=float(h.distance),
                            title=ent.get("title", ""),
                            source=ent.get("source", ""),
                            page_number=str(ent.get("page_number", "")),
                            chunk_seq=str(ent.get("chunk_seq", "")),
                            document_url=ent.get("document_url", ""),
                            text=ent.get(vdb.milvus_text_field, "") or "",
                        )
                    )

            return RetrievalResponse(
                backend="milvus",
                index=index_name,
                k=request.k,
                results=out,
            )

        raise HTTPException(status_code=500, detail=f"Unsupported VECTOR_DB_TYPE={vdb.db_type}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval error: {type(e).__name__}: {e}")


@app.post("/keyword-search", response_model=RetrievalResponse, dependencies=[Depends(verify_token)])
async def keyword_search(request: KeywordSearchRequest):
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="query must be a non-empty string")

    vdb = load_vector_db_config()
    if vdb.db_type != "opensearch":
        raise HTTPException(
            status_code=400,
            detail="keyword_search is only supported when VECTOR_DB_TYPE=opensearch"
        )

    index_name = (request.destination_index or "").strip() or vdb.opensearch_index

    try:
        os_client = _opensearch_client(vdb)
        body = _opensearch_keyword_query(query=request.query, k=request.k)
        resp = os_client.search(index=index_name, body=body)
        hits = (resp.get("hits", {}) or {}).get("hits", []) or []
        return RetrievalResponse(
            backend="opensearch",
            index=index_name,
            k=request.k,
            results=_format_hits(hits),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Keyword search error: {type(e).__name__}: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)


