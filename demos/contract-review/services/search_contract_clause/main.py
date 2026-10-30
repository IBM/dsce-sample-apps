"""
search_contract_clause — FastAPI service
-----------------------------------------
POST /search_clause
    Runs two parallel AstraDB vector queries in one call:
      A) standard_template filtered by template_id
      B) vendor_contract   filtered by session_id
    Returns both results so the agent can build a comparison table
    from a single tool call.

GET /health
    Liveness probe required by Code Engine and OpenShift.

Local run:
    cp .env.example .env
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8080

Container run:
    docker build -t search-contract-clause:local .
    docker run --env-file .env -p 8080:8080 search-contract-clause:local
"""

import collections
import os
import secrets
import time
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from astrapy import DataAPIClient
from astrapy.data.collection import Collection

# ── Credentials ───────────────────────────────────────────────────────────────
# Loaded from .env locally; injected as env vars on Code Engine / OpenShift.
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

ASTRA_DB_API_ENDPOINT      = os.environ["ASTRA_DB_API_ENDPOINT"]
ASTRA_DB_APPLICATION_TOKEN = os.environ["ASTRA_DB_APPLICATION_TOKEN"]
ASTRA_DB_COLLECTION        = os.environ.get("ASTRA_DB_COLLECTION", "contract_collection")

# ── AstraDB client (module-level, reused across requests) ─────────────────────
_collection: Optional[Collection] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _collection
    _collection = (
        DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
        .get_database_by_api_endpoint(ASTRA_DB_API_ENDPOINT)
        .get_collection(ASTRA_DB_COLLECTION)
    )
    yield
    # nothing to tear down


app = FastAPI(
    title="Contract Clause Search",
    description="Vector search for standard template and vendor contract clauses.",
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
_RATE_LIMIT      = 120          # requests per client per window (CWE-770)
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

class SearchRequest(BaseModel):
    session_id:   str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    template_id:  str = Field(pattern=r"^[A-Za-z0-9._-]{1,64}$")
    clause_query: str = Field(min_length=1, max_length=500)
    top_k:        int = Field(default=1, ge=1, le=5)   # 1 = single best match (agent default); set up to 5 for testing


class ClauseResult(BaseModel):
    section_id:  str
    heading:     str
    text:        str
    clause_type: str
    similarity:  float


class SearchResponse(BaseModel):
    standard: Optional[list[ClauseResult]] = None
    vendor:   Optional[list[ClauseResult]] = None


# ── AstraDB query helper ───────────────────────────────────────────────────────

def _query_many(filter_dict: dict, clause_query: str, top_k: int) -> Optional[list[ClauseResult]]:
    """
    Run a single AstraDB vector search and return the top top_k results.
    AstraDB embeds clause_query internally via $vectorize — no embedding
    API call is made from this service.
    Returns None if no document matches the filter.
    """
    top_k = max(1, min(top_k, 5))   # clamp: 1–5
    cursor = _collection.find(
        filter=filter_dict,
        sort={"$vectorize": clause_query},
        limit=top_k,
        include_similarity=True,
        projection={
            "section_id":  1,
            "heading":     1,
            "text":        1,
            "clause_type": 1,
        },
    )
    docs = list(cursor)
    if not docs:
        return None

    return [
        ClauseResult(
            section_id=  doc.get("section_id",  ""),
            heading=     doc.get("heading",     ""),
            text=        doc.get("text",        ""),
            clause_type= doc.get("clause_type", "other"),
            similarity=  round(doc.get("$similarity", 0.0), 4),
        )
        for doc in docs
    ]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/search_clause", response_model=SearchResponse)
def search_clause(req: SearchRequest):
    """
    Run standard-template and vendor-contract queries in parallel.
    Both queries use the same clause_query text — AstraDB finds the
    most semantically similar chunk(s) from each side independently.

    top_k=1 (default) — agent production mode, returns single best match.
    top_k=2..5        — debug/testing mode, returns ranked list.
    """
    if _collection is None:
        raise HTTPException(status_code=503, detail="AstraDB not initialised")

    standard_filter = {
        "doc_type":    "standard_template",
        "template_id": req.template_id,
    }
    vendor_filter = {
        "doc_type":   "vendor_contract",
        "session_id": req.session_id,
    }

    # Run both AstraDB queries in parallel to halve latency
    standard_result: Optional[list[ClauseResult]] = None
    vendor_result:   Optional[list[ClauseResult]] = None

    with ThreadPoolExecutor(max_workers=2) as pool:
        future_std = pool.submit(_query_many, standard_filter, req.clause_query, req.top_k)
        future_vnd = pool.submit(_query_many, vendor_filter,   req.clause_query, req.top_k)

        for future in as_completed([future_std, future_vnd]):
            if future is future_std:
                standard_result = future.result()
            else:
                vendor_result = future.result()

    return SearchResponse(standard=standard_result, vendor=vendor_result)
