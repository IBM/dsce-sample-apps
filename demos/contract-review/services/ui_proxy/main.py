"""
ui_proxy — FastAPI service
---------------------------
Serves the Contract Reviewer UI (static HTML) AND proxies all API calls
to watsonx Orchestrate. Single container, single OpenShift Route.

NEW ARCHITECTURE — proxy handles full PDF ingestion:
  POST /upload  → parse PDF with PyMuPDF → insert chunks into AstraDB
                  → upload original to IBM COS
                  → return {session_id, cos_pdf_url, clause_index}
  POST /chat    → if first message after upload, embeds session_id +
                  cos_pdf_url in message text so agent has context
                → forwards to WXO /chat/completions

The WXO upload-to-s3 endpoint is NOT used — it is not available on
this SaaS instance. Ingestion happens entirely in this proxy.

Endpoints
─────────
GET  /                                          → serves index.html
GET  /login                                     → sign-in page (public)
POST /auth/login                                → form login, sets session cookie (public)
POST /auth/logout                               → revoke session
GET  /health                                    → liveness probe
POST /upload                                    → ingest PDF → AstraDB + COS
POST /chat                                      → WXO agent chat/completions

Governance endpoints (proxy to WXO Evaluation API)
────────────────────────────────────────────────────
GET  /governance/evaluations                    → list all evaluation runs  (WXO v2 path)
GET  /governance/evaluations/{evaluation_id}    → single run detail
GET  /governance/evaluations/{id}/test_cases    → per-test-case breakdown
GET  /governance/test_cases                     → all registered test cases  (WXO v2 path)
GET  /governance/test_case_batches              → in-memory upload history (file-grouped)
POST /governance/evaluate                       → trigger a new evaluation run  (WXO v2 path)
POST /governance/test_cases/upload              → upload test cases JSON/ZIP (WXO v2 path)
POST /governance/test_cases/from_thread         → create test case from thread (WXO v2 path)
GET  /governance/runs                           → list WXO agent runs (token usage / timing)
GET  /governance/runs/{run_id}                  → single run detail (tokens, model, timing)
GET  /governance/threads/{thread_id}/messages   → thread messages (extract trace_id)
GET  /governance/agent/stats                    → full agent analytics (tokens, timing, model) — scans all runs

Environment variables (see .env.example):
    WXO_BASE_URL             e.g. https://api.us-south.watson-orchestrate.cloud.ibm.com/instances/<id>
    WXO_API_KEY              IAM API key
    WXO_AGENT_ID             UUID of the contract_reviewer agent
    UI_USERNAME              Login user for the UI and every API route (default reviewer)
    UI_PASSWORD              Login password (REQUIRED, min 12 chars; service refuses to start without it)
    ALLOWED_ORIGIN           CORS origin (optional; unset = same-origin only, "*" is ignored)
    ASTRA_DB_API_ENDPOINT    AstraDB endpoint URL
    ASTRA_DB_APPLICATION_TOKEN  AstraDB application token
    ASTRA_DB_COLLECTION      Collection name (default contract_collection)
    COS_API_KEY              IBM COS IAM API key
    COS_SERVICE_INSTANCE_ID  IBM COS service instance ID
    COS_ENDPOINT             IBM COS endpoint (default us-east)
    COS_BUCKET               IBM COS bucket name (default regeneratepdf)
    DEFAULT_TEMPLATE_ID      Default template ID (default GTA-STANDARD-v1.0)
"""

import asyncio
import collections
import io
import json
import logging
import os
import re
import secrets
import time
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated, Optional
from urllib.parse import quote
from uuid import uuid4

import httpx
import ibm_boto3
import pymupdf as fitz
from astrapy import DataAPIClient
from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, Query, Request, UploadFile, File
from fastapi import Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from ibm_botocore.client import Config
from pydantic import BaseModel, Field

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("ui_proxy")

# ── Credentials ───────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

WXO_BASE_URL    = os.environ["WXO_BASE_URL"].rstrip("/")
WXO_API_KEY     = os.environ["WXO_API_KEY"]
WXO_AGENT_ID    = os.environ["WXO_AGENT_ID"]
ALLOWED_ORIGIN  = os.environ.get("ALLOWED_ORIGIN", "").strip()

# Access control — fail closed: no password, no service (CWE-306).
UI_USERNAME = os.environ.get("UI_USERNAME", "reviewer")
UI_PASSWORD = os.environ["UI_PASSWORD"]
if len(UI_PASSWORD) < 12:
    raise RuntimeError("UI_PASSWORD must be at least 12 characters.")

ASTRA_DB_API_ENDPOINT      = os.environ["ASTRA_DB_API_ENDPOINT"]
ASTRA_DB_APPLICATION_TOKEN = os.environ["ASTRA_DB_APPLICATION_TOKEN"]
ASTRA_DB_COLLECTION        = os.environ.get("ASTRA_DB_COLLECTION", "contract_collection")

COS_API_KEY             = os.environ["COS_API_KEY"]
COS_SERVICE_INSTANCE_ID = os.environ["COS_SERVICE_INSTANCE_ID"]
COS_ENDPOINT            = os.environ.get("COS_ENDPOINT", "https://s3.us-east.cloud-object-storage.appdomain.cloud")
COS_BUCKET              = os.environ.get("COS_BUCKET", "regeneratepdf")

DEFAULT_TEMPLATE_ID = os.environ.get("DEFAULT_TEMPLATE_ID", "GTA-STANDARD-v1.0")

_HTML_PATH = Path(__file__).parent / "index.html"

# ── Input validation ──────────────────────────────────────────────────────────
# Identifiers are interpolated into upstream WXO URLs, COS keys and agent
# prompts, so restrict them to a safe character set (CWE-20 / CWE-22 / CWE-918).
_ID_PATTERN       = r"^[A-Za-z0-9_-]{1,128}$"
_TEMPLATE_PATTERN = r"^[A-Za-z0-9._-]{1,64}$"
_VENDOR_PATTERN   = r"^[A-Za-z0-9_-]{1,64}$"

ResourceId = Annotated[str, PathParam(pattern=_ID_PATTERN)]
SafeId     = Annotated[str, Field(pattern=_ID_PATTERN)]
TemplateId = Annotated[str, Field(pattern=_TEMPLATE_PATTERN)]
VendorId   = Annotated[str, Field(pattern=_VENDOR_PATTERN)]

MAX_PDF_BYTES        = 25 * 1024 * 1024   # vendor contract upload cap
MAX_PDF_PAGES        = 500
MAX_TESTCASE_BYTES   = 10 * 1024 * 1024   # governance test-case upload cap


# ── IAM token cache ───────────────────────────────────────────────────────────
_iam_token: Optional[str] = None
_iam_token_expiry: float  = 0.0
_IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"  # nosec B105 - public endpoint URL
_iam_lock: Optional[asyncio.Lock] = None


def _is_iam_key(key: str) -> bool:
    return not key.startswith("ZenApiKey")


def _get_bearer_token() -> str:
    global _iam_token, _iam_token_expiry
    if not _is_iam_key(WXO_API_KEY):
        return WXO_API_KEY
    if _iam_token and time.time() < _iam_token_expiry - 300:
        return _iam_token
    resp = httpx.post(
        _IAM_TOKEN_URL,
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey":     WXO_API_KEY,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30.0,
    )
    if resp.status_code != 200:
        log.error("IAM authentication request failed: status=%s", resp.status_code)
        raise RuntimeError(f"IAM token exchange failed ({resp.status_code})")
    data              = resp.json()
    _iam_token        = data["access_token"]
    _iam_token_expiry = time.time() + int(data.get("expires_in", 3600))
    return _iam_token


async def _get_bearer_token_async() -> str:
    global _iam_token, _iam_token_expiry, _iam_lock
    if not _is_iam_key(WXO_API_KEY):
        return WXO_API_KEY
    if _iam_token and time.time() < _iam_token_expiry - 300:
        return _iam_token
    if _iam_lock is None:
        _iam_lock = asyncio.Lock()
    async with _iam_lock:
        if _iam_token and time.time() < _iam_token_expiry - 300:
            return _iam_token
        async with httpx.AsyncClient(timeout=30.0) as ac:
            resp = await ac.post(
                _IAM_TOKEN_URL,
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey":     WXO_API_KEY,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if resp.status_code != 200:
            log.error("IAM authentication request failed: status=%s", resp.status_code)
            raise RuntimeError(f"IAM token exchange failed ({resp.status_code})")
        data              = resp.json()
        _iam_token        = data["access_token"]
        _iam_token_expiry = time.time() + int(data.get("expires_in", 3600))
        return _iam_token


# ── AstraDB + COS clients (initialised at startup) ───────────────────────────
_collection = None
_cos        = None

# ── Test-case batch registry (in-memory, per-process) ─────────────────────────
# Each entry: { filename, uploaded_at (ISO str), count, ids: [str] }
# Populated by /governance/test_cases/upload and seeded from WXO on startup.
_tc_batches: list[dict] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _collection, _cos

    # Eagerly fetch WXO token to catch bad keys immediately
    _get_bearer_token()

    # AstraDB collection handle
    _collection = (
        DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
        .get_database_by_api_endpoint(ASTRA_DB_API_ENDPOINT)
        .get_collection(ASTRA_DB_COLLECTION)
    )

    # IBM COS client (IAM auth)
    _cos = ibm_boto3.client(
        "s3",
        ibm_api_key_id=COS_API_KEY,
        ibm_service_instance_id=COS_SERVICE_INSTANCE_ID,
        config=Config(signature_version="oauth"),
        endpoint_url=COS_ENDPOINT,
    )

    # WXO HTTP client (keep-alive, JSON default)
    global _wxo_client
    token = _get_bearer_token()
    _wxo_client = httpx.AsyncClient(
        base_url=WXO_BASE_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
        },
        timeout=120.0,
    )

    # Seed batch registry: fetch all existing WXO test cases.
    # Uses correct v2 field: tc["id"]  (not "test_case_id")
    try:
        seed_resp = await _wxo_client.get(
            f"/v1/orchestrate/agent/{WXO_AGENT_ID}/test_case/v2",
            params={"limit": 100, "page": 1, "sortkey": "created_on", "sort": "desc"},
            headers=_auth_headers(),
        )
        if seed_resp.status_code == 200:
            seed_data = seed_resp.json()
            seed_tcs  = seed_data.get("test_cases") or []
            if seed_tcs:
                # v2 list response uses "id" field
                ids = [tc["id"] for tc in seed_tcs if tc.get("id")]
                newest = max(
                    (tc.get("created_on", "") for tc in seed_tcs),
                    default="",
                )
                _tc_batches.append({
                    "filename":    "All registered test cases",
                    "uploaded_at": newest or datetime.now(timezone.utc).isoformat(),
                    "count":       len(ids),
                    "ids":         ids,
                })
    except Exception:
        pass   # non-fatal

    yield
    await _wxo_client.aclose()


_wxo_client: Optional[httpx.AsyncClient] = None

app = FastAPI(
    title="Contract Reviewer",
    description="UI + WXO proxy — single container.",
    version="2.0.0",
    lifespan=lifespan,
)

# The UI is served by this same app, so CORS is only needed for an explicitly
# configured external origin. A wildcard origin is never enabled (CWE-942).
if ALLOWED_ORIGIN and ALLOWED_ORIGIN != "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[ALLOWED_ORIGIN],
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )


# ── Rate limiting (CWE-770) ───────────────────────────────────────────────────
# In-memory sliding window per client; adequate for a single-replica deployment.
_RATE_WINDOW_SEC   = 60
_RATE_LIMIT_GENERAL   = 120
_RATE_LIMIT_EXPENSIVE = 20
_EXPENSIVE_PATHS = ("/chat", "/upload", "/governance/evaluate",
                    "/governance/test_cases/upload", "/governance/agent/stats")
_rate_hits: dict[str, collections.deque] = {}


def _client_key(request: Request) -> str:
    real = request.client.host if request.client else "unknown"
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        router_hop = fwd.split(",")[-1].strip()[:64]
        return f"{router_hop}|{real}"
    return real


def _sweep(table: dict, now: float) -> None:
    """Drop idle clients so unauthenticated traffic cannot grow memory (CWE-770)."""
    if len(table) < _MAX_TRACKED_CLIENTS:
        return
    for k in [k for k, h in table.items() if not h or now - h[-1] > _RATE_WINDOW_SEC]:
        del table[k]
    if len(table) >= _MAX_TRACKED_CLIENTS:      # still full: shed everything
        table.clear()


def _rate_limited(request: Request) -> bool:
    expensive = request.url.path in _EXPENSIVE_PATHS
    limit = _RATE_LIMIT_EXPENSIVE if expensive else _RATE_LIMIT_GENERAL
    key   = f"{_client_key(request)}|{'x' if expensive else 'g'}"
    now   = time.monotonic()
    _sweep(_rate_hits, now)
    hits  = _rate_hits.setdefault(key, collections.deque())
    while hits and now - hits[0] > _RATE_WINDOW_SEC:
        hits.popleft()
    if len(hits) >= limit:
        return True
    hits.append(now)
    return False


# ── Login sessions ────────────────────────────────────────────────────────────
# /login serves a plain HTML form (no JavaScript). A successful POST to
# /auth/login issues a random session id in an HttpOnly, SameSite=Strict cookie.
# Sessions live server-side so logout revokes them immediately (CWE-613).
# State is per-process: a restart signs everyone out (single-replica deploy).
SESSION_COOKIE  = "cr_session"
SESSION_TTL_SEC = 8 * 3600
MAX_SESSIONS    = 1000
_sessions: dict[str, float] = {}          # session id -> absolute expiry (epoch)

_PUBLIC_PATHS = ("/health", "/login", "/auth/login", "/auth/logout")

# Failed-login throttle (CWE-307): per client, independent of the general rate
# limit, because failed logins never reach an authenticated route.
_FAIL_LIMIT = 5
_fail_hits: dict[str, collections.deque] = {}


_MAX_TRACKED_CLIENTS = 10_000


def _fail_count(request: Request) -> int:
    key  = _client_key(request)
    now  = time.monotonic()
    _sweep(_fail_hits, now)
    hits = _fail_hits.get(key)
    if hits is None:
        return 0
    while hits and now - hits[0] > _RATE_WINDOW_SEC:
        hits.popleft()
    if not hits:
        del _fail_hits[key]               # don't let idle clients accumulate
        return 0
    return len(hits)


def _note_failure(request: Request) -> None:
    _fail_count(request)
    _fail_hits.setdefault(_client_key(request), collections.deque()).append(time.monotonic())


def _new_session() -> str:
    now = time.time()
    for sid in [s for s, exp in _sessions.items() if exp < now]:
        del _sessions[sid]
    while len(_sessions) >= MAX_SESSIONS:  # bound memory; evict the oldest
        del _sessions[min(_sessions, key=_sessions.get)]
    sid = secrets.token_urlsafe(32)       # 256-bit, unguessable
    _sessions[sid] = now + SESSION_TTL_SEC
    return sid


def _authorised(request: Request) -> bool:
    sid = request.cookies.get(SESSION_COOKIE, "")
    exp = _sessions.get(sid)
    if exp is None:
        return False
    if exp < time.time():
        _sessions.pop(sid, None)
        return False
    return True


def _credentials_ok(user: str, pwd: str) -> bool:
    # Constant-time comparison (CWE-208); evaluate both to avoid short-circuit.
    ok_user = secrets.compare_digest(user.encode(), UI_USERNAME.encode())
    ok_pwd  = secrets.compare_digest(pwd.encode(),  UI_PASSWORD.encode())
    return ok_user and ok_pwd


def _is_https(request: Request) -> bool:
    return (request.url.scheme == "https"
            or request.headers.get("x-forwarded-proto", "").lower() == "https")


def _same_origin(request: Request) -> bool:
    """CSRF guard (defence in depth alongside SameSite=Strict): state-changing
    requests must come from our own origin (CWE-352)."""
    origin = request.headers.get("origin")
    if not origin:
        return True   # non-browser client (curl, probes)
    allowed = {f"{request.url.scheme}://{request.headers.get('host', '')}"}
    fwd_proto = request.headers.get("x-forwarded-proto")
    if fwd_proto:
        allowed.add(f"{fwd_proto}://{request.headers.get('host', '')}")
    if ALLOWED_ORIGIN and ALLOWED_ORIGIN != "*":
        allowed.add(ALLOWED_ORIGIN)
    return origin in allowed


@app.middleware("http")
async def _guard(request: Request, call_next):
    if request.url.path not in _PUBLIC_PATHS and request.method != "OPTIONS":
        if not _authorised(request):
            # Page loads go to the login form; API calls get a plain 401 with no
            # WWW-Authenticate header, so the browser never shows its own popup.
            if request.method == "GET" and "text/html" in request.headers.get("accept", ""):
                return RedirectResponse("/login", status_code=303)
            return JSONResponse({"detail": "Authentication required."}, status_code=401)
        if request.method not in ("GET", "HEAD") and not _same_origin(request):
            return JSONResponse({"detail": "Cross-origin request rejected."}, status_code=403)
        if _rate_limited(request):
            return JSONResponse({"detail": "Too many requests."}, status_code=429,
                                headers={"Retry-After": str(_RATE_WINDOW_SEC)})
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    # "same-origin" (not "no-referrer"): no-referrer makes browsers send
    # "Origin: null" on same-site POSTs, which the CSRF check must reject.
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Cache-Control", "no-store")
    response.headers.setdefault(
        "Content-Security-Policy",
        "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
    )
    return response


# ── Request / response models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:     str = Field(max_length=8000)
    thread_id:   Optional[SafeId] = None
    # Upload context — set by browser after a successful /upload
    session_id:  Optional[SafeId] = None
    cos_pdf_url: Optional[str] = Field(default=None, max_length=1024)
    vendor_id:   Optional[VendorId] = None
    template_id: Optional[TemplateId] = None
    clause_count: Optional[int] = Field(default=None, ge=0, le=100_000)
    clause_index: Optional[list[Annotated[str, Field(max_length=300)]]] = Field(
        default=None, max_length=1000
    )


class ChatResponse(BaseModel):
    reply:     str
    thread_id: str


class UploadResponse(BaseModel):
    session_id:   str
    cos_pdf_url:  str
    vendor_id:    str
    template_id:  str
    clause_count: int
    clause_index: list[str]
    filename:     str


class RunEvalRequest(BaseModel):
    test_case_ids: list[SafeId] = Field(max_length=200)


class BulkDeleteRequest(BaseModel):
    ids: list[SafeId] = Field(max_length=200)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {_get_bearer_token()}"}


async def _auth_headers_async() -> dict:
    return {"Authorization": f"Bearer {await _get_bearer_token_async()}"}


_REDACT_RE = re.compile(
    r'(Bearer\s+|"?apikey"?\s*[=:]\s*)[A-Za-z0-9._\-/+=]{8,}',
    re.I,
)


def _safe(resp) -> str:
    """Log the upstream error body server-side; return only the status to the
    client so upstream internals are not leaked (CWE-209)."""
    body = _REDACT_RE.sub(r'\1[REDACTED]', resp.text[:500])
    log.warning("upstream %s returned %s: %s",
                getattr(resp, "url", "?"), resp.status_code, body)
    return f"upstream returned {resp.status_code}"


async def _create_thread() -> str:
    url = f"{WXO_BASE_URL}/v1/orchestrate/threads"
    resp = await _wxo_client.post(
        "/v1/orchestrate/threads",
        json={"title": "Contract Review Session"},
        headers=await _auth_headers_async(),
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502,
                            detail=f"WXO thread creation failed: {_safe(resp)}")
    data = resp.json()
    tid  = data.get("thread_id") or data.get("id")
    if not tid:
        raise HTTPException(status_code=502,
                            detail="WXO thread creation: no id in response")
    return tid


def _extract_reply(wxo_response: dict) -> str:
    choices = wxo_response.get("choices", [])
    if not choices:
        return "(no response)"
    content = choices[0].get("message", {}).get("content", "")
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if isinstance(block, dict):
            text = block.get("text", "") or block.get("content", "")
            if text:
                parts.append(text)
    return "\n".join(parts) or "(no response)"


# ── PDF ingestion helpers (same logic as ingest_vendor_contract/tool.py) ──────

MAX_CHUNK_CHARS = 1200
_NUM_ONLY_RE    = re.compile(r"^\s*(\d+(?:\.\d+)*)\s*$")
_NUM_INLINE_RE  = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s{1,6}([A-Z][^\n]{2,})")
_PAGE_NOISE_RE  = re.compile(
    r"(\bPage\s+\d+(\s+of\s+\d+)?\b"           # "Page N" / "Page N of N"
    r"|MSA\s+and\s+GTA\b[^\n]*"                 # running header "MSA and GTA ..."
    r"|Master\s+Agreement\s+for\s+GETS[^\n]*"   # running header continuation
    r"|Contract\s+Number[^\n]*)",               # contract number header lines
    re.I
)


def _split_long_body(section_id: str, heading: str, body: str) -> list[dict]:
    if len(body) <= MAX_CHUNK_CHARS:
        return [{"section_id": section_id, "heading": heading, "text": body}]
    chunks: list[dict] = []
    words, current, idx = body.split(), [], 0
    for word in words:
        current.append(word)
        if len(" ".join(current)) >= MAX_CHUNK_CHARS:
            chunks.append({
                "section_id": f"{section_id}{chr(ord('a') + idx)}",
                "heading": heading,
                "text": " ".join(current),
            })
            current, idx = [], idx + 1
    if current:
        chunks.append({
            "section_id": f"{section_id}{chr(ord('a') + idx)}",
            "heading": heading,
            "text": " ".join(current),
        })
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
            result.extend(_split_long_body(f"§P{idx + 1}", para[:60].rstrip(), para))
        return result

    clauses: list[dict] = []
    # deferred_headings: anchors whose immediate body was < 40 chars (heading-only
    # line in the PDF, body text printed on a later page after a page break).
    # Value: (sec_num, heading, anchor_line_index) — we will scan forward in the
    # raw line stream for their text.
    deferred_headings: list[tuple[str, str, int]] = []

    for pos, (start, sec_num, heading) in enumerate(anchors):
        end        = anchors[pos + 1][0] if pos + 1 < len(anchors) else len(lines)
        body_lines = lines[start + 1: end]
        body = " ".join(l.strip() for l in body_lines if l.strip())
        body = _PAGE_NOISE_RE.sub("", body)
        body = re.sub(r"\s{2,}", " ", body).strip()
        if body.lower().startswith(heading.lower()):
            body = body[len(heading):].strip()

        if len(body) < 40:
            # Body is empty — heading printed alone (body text is on a later page).
            deferred_headings.append((sec_num, heading, end))
            continue

        clauses.extend(_split_long_body(f"§{sec_num}", heading, body))

    # ── Second pass: resolve deferred headings ──────────────────────────────
    # Some PDFs print a section heading on one page and its body several pages
    # later (after a page-break mid-table-of-contents layout).  We find the
    # orphan body by searching the full text for keywords from the heading.
    for d_sec, d_heading, search_start in deferred_headings:
        # Build keyword set from the heading (words ≥ 4 chars, lower)
        kw = [w.lower() for w in re.split(r"\W+", d_heading) if len(w) >= 4]
        if not kw:
            continue
        # Search every line from search_start onward for the first line that
        # contains at least one heading keyword AND is part of a paragraph ≥ 40 chars
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

        # Collect the paragraph that contains found_start.
        # Walk back up to 3 lines to catch any non-noise line that starts the
        # same paragraph (handles line-wrapped sentences before the keyword).
        para_start = found_start
        for back in range(1, 4):
            li_back = found_start - back
            if li_back < search_start:
                break
            cleaned_back = _PAGE_NOISE_RE.sub("", lines[li_back]).strip()
            if not cleaned_back:
                break   # blank line = paragraph boundary
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

    # Sort by section_id to restore document order
    clauses.sort(key=lambda c: c["section_id"])
    return clauses


def _vendor_id_from_filename(filename: str) -> str:
    """Derive a vendor slug from the PDF filename, e.g. GTA.Everton-Contract.pdf → everton"""
    stem   = re.sub(r"[^a-z0-9._\-\s]", "", Path(filename).stem.lower())
    tokens = re.split(r"[\.\-_\s]+", stem)
    # Skip generic words
    skip   = {"gta", "contract", "agreement", "vendor", "pdf", "final", "signed"}
    for tok in tokens:
        if tok and tok not in skip and len(tok) > 2:
            return tok[:64]
    return (tokens[0][:64] if tokens and tokens[0] else "vendor")


# ── Static UI ─────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def serve_ui():
    html = _HTML_PATH.read_text()
    html = html.replace("%%PROXY_URL%%", "")
    return HTMLResponse(
        content=html,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )


# ── Login / logout ────────────────────────────────────────────────────────────
# The page is static HTML with fixed messages only: nothing from the request is
# reflected into it (no XSS), and there is no "next" parameter (no open redirect).

_LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Sign in · Contract Reviewer</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  font-family:-apple-system,"Segoe UI",system-ui,sans-serif;font-size:13px;line-height:1.5;
  background:#0d1117;color:#1c2128}
.card{width:100%;max-width:360px;margin:16px;background:#fff;border:1px solid #d0d7de;
  border-radius:10px;padding:28px 28px 24px}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:20px}
.mark{width:32px;height:32px;background:#1f6feb;border-radius:7px;display:flex;
  align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff}
.name{font-size:16px;font-weight:700}.name span{color:#1f6feb}
h1{font-size:15px;font-weight:700;margin-bottom:2px}
.sub{font-size:12px;color:#57606a;margin-bottom:16px}
label{display:block;font-size:11px;font-weight:700;letter-spacing:.05em;
  text-transform:uppercase;color:#57606a;margin:12px 0 5px}
input{width:100%;border:1px solid #d0d7de;border-radius:6px;padding:9px 10px;
  font-size:14px;font-family:inherit;outline:none}
input:focus{border-color:#1f6feb;box-shadow:0 0 0 3px rgba(31,111,235,.15)}
button{width:100%;margin-top:18px;background:#1f6feb;color:#fff;border:none;
  border-radius:6px;padding:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
button:hover{background:#1a5fd0}
.err{background:#fff0ee;border:1px solid #ffd8d3;color:#cf222e;border-radius:6px;
  padding:8px 10px;font-size:12px;margin-bottom:4px}
.note{margin-top:16px;font-size:11px;color:#8b949e;text-align:center}
</style>
</head>
<body>
<main class="card">
  <div class="brand"><div class="mark">CR</div><div class="name">Contract<span>Reviewer</span></div></div>
  <h1>Sign in</h1>
  <p class="sub">Enter your credentials to continue.</p>
  %%MESSAGE%%
  <form method="post" action="/auth/login" autocomplete="on">
    <label for="username">Username</label>
    <input id="username" name="username" type="text" maxlength="256"
           autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus/>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" maxlength="256"
           autocomplete="current-password" required/>
    <button type="submit">Sign in</button>
  </form>
  <p class="note">Sessions expire after 8 hours.</p>
</main>
</body>
</html>"""

_LOGIN_MESSAGES = {
    "1": "Incorrect username or password.",
    "2": "Too many failed attempts. Wait a minute and try again.",
}


def _login_page(code: str = "") -> HTMLResponse:
    # Message is looked up from a fixed table; the query value is never echoed.
    msg = _LOGIN_MESSAGES.get(code, "")
    block = f'<div class="err" role="alert">{msg}</div>' if msg else ""
    return HTMLResponse(
        _LOGIN_HTML.replace("%%MESSAGE%%", block),
        # The page has no script, so forbid all of it; only inline CSS is allowed.
        headers={"Content-Security-Policy":
                 "default-src 'none'; style-src 'unsafe-inline'; "
                 "form-action 'self'; base-uri 'none'; frame-ancestors 'none'"},
    )


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request, e: str = Query(default="", max_length=1)):
    if _authorised(request):
        return RedirectResponse("/", status_code=303)
    return _login_page(e)


@app.post("/auth/login")
async def do_login(
    request:  Request,
    username: str = Form(default="", max_length=256),
    password: str = Form(default="", max_length=256),
):
    if not _same_origin(request):                      # login CSRF (CWE-352)
        return JSONResponse({"detail": "Cross-origin request rejected."}, status_code=403)
    if _fail_count(request) >= _FAIL_LIMIT:            # brute force (CWE-307)
        return RedirectResponse("/login?e=2", status_code=303)
    if _rate_limited(request):                         # also bounds session churn
        return RedirectResponse("/login?e=2", status_code=303)
    if not _credentials_ok(username, password):
        _note_failure(request)
        log.warning("failed login from %s", _client_key(request))
        return RedirectResponse("/login?e=1", status_code=303)

    resp = RedirectResponse("/", status_code=303)      # fixed target: no open redirect
    resp.set_cookie(
        SESSION_COOKIE, _new_session(),                # fresh id every login (no fixation)
        max_age=SESSION_TTL_SEC, path="/",
        httponly=True, samesite="strict", secure=_is_https(request),
    )
    return resp


@app.post("/auth/logout")
async def do_logout(request: Request):
    if not _same_origin(request):                      # logout CSRF (CWE-352)
        return JSONResponse({"detail": "Cross-origin request rejected."}, status_code=403)
    _sessions.pop(request.cookies.get(SESSION_COOKIE, ""), None)   # server-side revoke
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(SESSION_COOKIE, path="/", httponly=True,
                       samesite="strict", secure=_is_https(request))
    return resp


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Governance endpoints ───────────────────────────────────────────────────────
# Path reference — IBM developer catalogue (confirmed):
#   List evaluations  : GET  /v1/orchestrate/agent/{id}/evaluations/v2                        ← /v2
#   Evaluation detail : GET  /v1/orchestrate/agent/{id}/evaluations/{eval_id}                 ← no /v2
#                            ?expand=test_cases returns test_cases array inline
#   Eval status       : GET  /v1/orchestrate/agent/{id}/evaluations/status                    ← no /v2
#   List test cases   : GET  /v1/orchestrate/agent/{id}/test_case/v2                          ← /v2
#   Run evaluation    : POST /v1/orchestrate/agent/{id}/evaluate/v2                           ← /v2
#   Upload test cases : POST /v1/orchestrate/agent/{id}/test_case/v2                          ← /v2
#   Create from thread: POST /v1/orchestrate/agent/{id}/test_case/v2/from_thread              ← /v2

_EVAL_SORTKEYS = {"executed_date", "created_date", "status"}
_SORT_DIRS     = {"asc", "desc"}


@app.get("/governance/evaluations")
async def list_evaluations(
    limit:   int = Query(default=10, ge=1, le=50),
    offset:  int = Query(default=0,  ge=0),
    sortkey: str = Query(default="executed_date"),
    sort:    str = Query(default="desc"),
):
    sortkey = sortkey if sortkey in _EVAL_SORTKEYS else "executed_date"
    sort    = sort    if sort    in _SORT_DIRS     else "desc"
    resp = await _wxo_client.get(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/evaluations/v2",
        params={"limit": limit, "offset": offset,
                "sortkey": sortkey, "sort": sort},
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO evaluations list failed: {_safe(resp)}")
    return resp.json()


@app.get("/governance/evaluations/status")
async def get_eval_status():
    """Check if an evaluation is currently running for this agent."""
    resp = await _wxo_client.get(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/evaluations/status",
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO evaluation status failed: {_safe(resp)}")
    return resp.json()


@app.get("/governance/evaluations/{evaluation_id}")
async def get_evaluation(
    evaluation_id: ResourceId,
    expand: Optional[str] = Query(default=None),
):
    params: dict = {}
    if expand:
        params["expand"] = expand
    resp = await _wxo_client.get(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/evaluations/{quote(evaluation_id, safe='')}",
        params=params,
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO evaluation detail failed: {_safe(resp)}")
    return resp.json()


@app.get("/governance/evaluations/{evaluation_id}/test_cases")
async def get_eval_test_cases(
    evaluation_id: ResourceId,
    limit:   int           = Query(default=20, ge=1, le=100),
    offset:  int           = Query(default=0,  ge=0),
    tc_status: Optional[str] = Query(default=None, alias="status"),
):
    # WXO surfaces test cases via expand=test_cases on the evaluation detail
    # endpoint rather than a dedicated sub-path.  Fetch the detail with
    # expand=test_cases and return the test_cases array from the response.
    params: dict = {"expand": "test_cases", "limit": limit, "offset": offset}
    if tc_status:
        params["status"] = tc_status
    resp = await _wxo_client.get(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/evaluations/{quote(evaluation_id, safe='')}",
        params=params,
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO eval test cases failed: {_safe(resp)}")
    data = resp.json()
    # Normalise WXO v2 test case shape → shape the UI expects:
    #   test_case_id   → id
    #   test_case_name → prompt  (falls back to story if name is empty)
    #   result         → status  ("Failed"→"FAILED", "Passed"→"PASSED")
    #   metrics[]      → kept as-is for the UI to render
    #   reasoning      → kept as-is
    raw_tcs = data.get("test_cases") or []
    normalised: list[dict] = []
    for tc in raw_tcs:
        result = tc.get("result", "")
        if result.lower() in ("passed", "success"):
            tc_status_str = "PASSED"
        elif result.lower() in ("failed", "failure"):
            tc_status_str = "FAILED"
        else:
            tc_status_str = "IN_PROGRESS"
        normalised.append({
            "id":             tc.get("test_case_id"),
            "prompt":         tc.get("test_case_name") or tc.get("story", ""),
            "status":         tc_status_str,
            "result":         result,
            "reasoning":      tc.get("reasoning", ""),
            "metrics":        tc.get("metrics", []),
            "created_date":   tc.get("created_date"),
            "executed_date":  tc.get("executed_date"),
            "chat_session_id": tc.get("chat_session_id") or tc.get("thread_id") or "",
        })
    return {
        "total":      data.get("total", len(normalised)),
        "page":       data.get("page", 1),
        "page_size":  data.get("page_size", len(normalised)),
        "test_cases": normalised,
    }


@app.get("/governance/test_cases")
async def list_test_cases(
    limit:   int = Query(default=50, ge=1, le=100),
    page:    int = Query(default=1,  ge=1),
    sortkey: str = Query(default="created_date"),
    sort:    str = Query(default="desc"),
):
    sortkey = sortkey if sortkey in _EVAL_SORTKEYS else "created_date"
    sort    = sort    if sort    in _SORT_DIRS     else "desc"
    resp = await _wxo_client.get(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/test_case/v2",
        params={"limit": limit, "page": page,
                "sortkey": sortkey, "sort": sort},
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO test cases list failed: {_safe(resp)}")
    data = resp.json()
    # WXO v2 list response: test_cases[].id, .name, .created_on
    # Normalise in case a future version changes the id field name
    for tc in data.get("test_cases", []):
        if not tc.get("id"):
            tc["id"] = tc.get("test_case_id") or tc.get("test_case_uuid") or ""
    return data


@app.get("/governance/test_cases/{tc_id}")
async def get_test_case(tc_id: ResourceId):
    """Fetch full detail for a single test case by ID."""
    resp = await _wxo_client.get(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/test_case/v2/{quote(tc_id, safe='')}",
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO test case fetch failed: {_safe(resp)}")
    tc = resp.json()
    # Normalise id field
    if not tc.get("id"):
        tc["id"] = tc.get("test_case_id") or tc.get("test_case_uuid") or tc_id
    return tc


@app.post("/governance/evaluate")
async def run_evaluation(req: RunEvalRequest):
    resp = await _wxo_client.post(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/evaluate/v2",
        json={"test_case_ids": req.test_case_ids},
        headers=await _auth_headers_async(),
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO evaluate trigger failed: {_safe(resp)}")
    return resp.json()


@app.get("/governance/test_case_batches")
async def list_test_case_batches():
    """
    Return the in-memory batch registry — one entry per uploaded file.
    Entries are newest-first (last appended = most recently uploaded).
    Each entry: { filename, uploaded_at, count, ids }.
    """
    return {"batches": list(reversed(_tc_batches))}


@app.post("/governance/test_cases/upload")
async def upload_test_cases(file: UploadFile = File(...)):
    """
    Upload test cases to WXO via POST /v1/orchestrate/agent/{id}/test_case/v2.
    Accepts a JSON file or ZIP archive as multipart/form-data.

    IMPORTANT: _wxo_client has 'Content-Type: application/json' baked in at
    startup, which would overwrite the multipart boundary header and break the
    upload.  We therefore use a one-shot httpx.AsyncClient for this request
    so that httpx can set the correct multipart/form-data; boundary=... header
    by itself.

    After a successful upload, registers the batch in _tc_batches so the
    evaluation picker can show "run test cases from <filename>" instead of
    raw UUIDs.
    """
    content  = await file.read(MAX_TESTCASE_BYTES + 1)
    if len(content) > MAX_TESTCASE_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file is too large.")
    filename = Path(file.filename or "test_cases.json").name[:200]
    if not filename.lower().endswith((".json", ".zip")):
        raise HTTPException(status_code=415, detail="Only .json or .zip files are accepted.")
    mime     = (
        "application/zip" if filename.lower().endswith(".zip") else "application/json"
    )
    url = f"{WXO_BASE_URL}/v1/orchestrate/agent/{WXO_AGENT_ID}/test_case/v2"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            url,
            files={"file": (filename, content, mime)},
            headers={"Authorization": f"Bearer {_get_bearer_token()}"},
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO upload test cases failed: {_safe(resp)}")

    wxo_data = resp.json()

    # Extract the IDs WXO assigned to the newly created test cases.
    # WXO v2 upload response shape (observed): { test_case_ids: [...], total_test_cases: N }
    # Fall back: parse the original JSON file for count if WXO doesn't return IDs directly.
    new_ids: list[str] = wxo_data.get("test_case_ids") or []
    if not new_ids:
        # WXO may return the full list of all test cases — extract the most
        # recent N that match the count we uploaded.
        try:
            if not filename.endswith(".zip"):
                uploaded = json.loads(content)
                if not isinstance(uploaded, list):
                    uploaded = [uploaded]
                if len(uploaded) > 10_000:
                    raise HTTPException(status_code=422, detail="Too many test cases in file.")
                n_uploaded = len(uploaded)
            else:
                n_uploaded = 0
        except Exception:
            n_uploaded = 0

        # Re-fetch all test cases sorted desc by created_date to get the newest ones
        try:
            tc_resp = await _wxo_client.get(
                f"/v1/orchestrate/agent/{WXO_AGENT_ID}/test_case/v2",
                params={"limit": max(n_uploaded, 50), "page": 1,
                        "sortkey": "created_date", "sort": "desc"},
                headers=await _auth_headers_async(),
            )
            if tc_resp.status_code == 200:
                all_tcs  = tc_resp.json().get("test_cases") or []
                new_ids  = [
                    tc["test_case_id"] for tc in all_tcs[:n_uploaded or len(all_tcs)]
                    if tc.get("test_case_id")
                ]
        except Exception:
            pass

    # Register this upload as a named batch
    _tc_batches.append({
        "filename":    filename,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "count":       len(new_ids),
        "ids":         new_ids,
    })

    return wxo_data


class FromThreadRequest(BaseModel):
    thread_id: SafeId
    agent_id:  Optional[SafeId] = None   # defaults to WXO_AGENT_ID


@app.post("/governance/test_cases/from_thread")
async def create_test_case_from_thread(req: FromThreadRequest):
    """Create a test case from a recorded chat thread (v2 endpoint)."""
    resp = await _wxo_client.post(
        f"/v1/orchestrate/agent/{WXO_AGENT_ID}/test_case/v2/from_thread",
        json={"thread_id": req.thread_id},
        headers=await _auth_headers_async(),
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO create test case from thread failed: {_safe(resp)}")
    return resp.json()


@app.post("/governance/test_cases/bulk_delete")
async def bulk_delete_test_cases(req: BulkDeleteRequest):
    """
    Bulk-delete test cases using individual DELETE per ID.

    The v2 bulk_delete POST endpoint returns deleted_ids:[] when test cases
    have been previously used in evaluations (they are only soft-deleted by
    that path). The individual DELETE endpoint handles both soft and hard
    deletion correctly and returns { "id": "...", "deleted": true }.

    We call DELETE /v1/orchestrate/agent/{id}/test_case/v2/{tc_id} for each
    ID concurrently, then return a summary.
    """
    async def _delete_one(tc_id: str) -> dict:
        r = await _wxo_client.delete(
            f"/v1/orchestrate/agent/{WXO_AGENT_ID}/test_case/v2/{quote(tc_id, safe='')}",
            headers=await _auth_headers_async(),
        )
        return {"id": tc_id, "status": r.status_code}

    results = await asyncio.gather(*[_delete_one(tc_id) for tc_id in req.ids])

    deleted_ids = [r["id"] for r in results if r["status"] in (200, 204)]
    failed      = [r for r in results if r["status"] not in (200, 204)]

    log.warning("bulk_delete: %d deleted, %d failed.",
                len(deleted_ids), len(failed))

    # Prune in-memory batch registry
    deleted_set = set(deleted_ids)
    for batch in _tc_batches:
        batch["ids"]   = [i for i in batch["ids"] if i not in deleted_set]
        batch["count"] = len(batch["ids"])

    return {"deleted_ids": deleted_ids, "failed": failed}


# ── Runs (token usage / timing via /v1/orchestrate/runs) ─────────────────────

@app.get("/governance/runs")
async def list_runs(
    limit:  int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0,  ge=0),
):
    """Proxy to GET /v1/orchestrate/runs — returns all agent runs with pagination."""
    resp = await _wxo_client.get(
        "/v1/orchestrate/runs",
        params={"limit": limit, "offset": offset},
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO runs list failed: {_safe(resp)}")
    return resp.json()


@app.get("/governance/runs/{run_id}")
async def get_run(run_id: ResourceId):
    """
    Proxy to GET /v1/orchestrate/runs/{run_id}.
    Returns token usage, timing (started_at / completed_at), model name, status.
    The run_id equals the trace_id on WXO assistant messages.
    """
    resp = await _wxo_client.get(
        f"/v1/orchestrate/runs/{quote(run_id, safe='')}",
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO run fetch failed: {_safe(resp)}")
    return resp.json()


@app.get("/governance/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: ResourceId):
    """
    Proxy to GET /v1/orchestrate/threads/{thread_id}/messages.
    Used to extract trace_id from assistant messages so we can look up
    token usage via GET /v1/orchestrate/runs/{trace_id}.
    """
    resp = await _wxo_client.get(
        f"/v1/orchestrate/threads/{quote(thread_id, safe='')}/messages",
        headers=await _auth_headers_async(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"WXO thread messages fetch failed: {_safe(resp)}")
    return resp.json()


@app.get("/governance/agent/stats")
async def get_agent_stats():
    """
    Scan ALL /v1/orchestrate/runs pages, filter by WXO_AGENT_ID, and return
    pre-aggregated analytics for the contract_reviewer agent only:
      - agent_name (from /v1/orchestrate/agents)
      - total_runs, runs_with_usage
      - total_tokens, prompt_tokens, completion_tokens, cached_tokens
      - avg_tokens_per_run, avg_duration_sec
      - model_name
      - token_series: [{started_at, total_tokens, duration_sec}] (last 30 runs)
      - recent_runs: last 10 runs with full stats
    """
    # Resolve agent name from /v1/orchestrate/agents in parallel with first runs page
    agents_task = _wxo_client.get("/v1/orchestrate/agents", headers=await _auth_headers_async())
    first_task  = _wxo_client.get(
        "/v1/orchestrate/runs",
        params={"limit": 20, "offset": 0},
        headers=await _auth_headers_async(),
    )
    agents_resp, first = await asyncio.gather(agents_task, first_task)

    # Extract agent name — /v1/orchestrate/agents returns a plain list
    agent_name = WXO_AGENT_ID  # fallback to ID if name not found
    if agents_resp.status_code == 200:
        try:
            agents_list = agents_resp.json()
            if isinstance(agents_list, list):
                for a in agents_list:
                    if (a.get("id") or a.get("agent_id")) == WXO_AGENT_ID:
                        agent_name = a.get("name") or a.get("agent_name") or WXO_AGENT_ID
                        break
        except Exception:
            pass

    all_runs: list[dict] = []
    page_size = 20  # WXO hard-caps at 20 regardless of limit param

    # `first` was already fetched above via asyncio.gather alongside agents_task
    if first.status_code != 200:
        raise HTTPException(status_code=first.status_code,
                            detail=f"WXO runs fetch failed: {_safe(first)}")
    first_data = first.json()
    total_runs_global = first_data.get("total", 0)
    all_runs.extend(first_data.get("data", []))

    # Fetch remaining pages
    offsets = list(range(page_size, total_runs_global, page_size))
    # Process in batches of 8 concurrent requests
    batch_size = 8
    for i in range(0, len(offsets), batch_size):
        batch = offsets[i : i + batch_size]
        tasks = [
            _wxo_client.get(
                "/v1/orchestrate/runs",
                params={"limit": page_size, "offset": off},
                headers=await _auth_headers_async(),
            )
            for off in batch
        ]
        responses = await asyncio.gather(*tasks)
        for resp in responses:
            if resp.status_code == 200:
                all_runs.extend(resp.json().get("data", []))

    # Filter to this agent only
    agent_runs = [r for r in all_runs if r.get("agent_id") == WXO_AGENT_ID]
    agent_runs.sort(key=lambda r: r.get("started_at", ""))

    # Aggregate
    total_tokens    = 0
    prompt_tokens   = 0
    compl_tokens    = 0
    cached_tokens   = 0
    total_dur_sec   = 0.0
    runs_with_usage = 0
    runs_with_dur   = 0
    model_name      = "—"
    token_series: list[dict] = []

    for r in agent_runs:
        u  = r.get("usage") or {}
        tu = u.get("token_usage") or {}
        if tu.get("total_tokens") is not None:
            runs_with_usage += 1
            total_tokens  += tu.get("total_tokens", 0)
            prompt_tokens += tu.get("prompt_tokens", 0)
            compl_tokens  += tu.get("completion_tokens", 0)
            cached_tokens += (tu.get("prompt_tokens_details") or {}).get("cached_tokens", 0)
            if model_name == "—":
                mu = u.get("model_usage") or []
                model_name = (mu[0].get("model_name") if mu else None) or u.get("model_name") or "—"

        dur_sec = None
        if r.get("started_at") and r.get("completed_at"):
            try:
                s = datetime.fromisoformat(r["started_at"].replace("Z", "+00:00"))
                c = datetime.fromisoformat(r["completed_at"].replace("Z", "+00:00"))
                dur_sec = (c - s).total_seconds()
                total_dur_sec += dur_sec
                runs_with_dur += 1
            except Exception:
                pass

        if tu.get("total_tokens") is not None:
            token_series.append({
                "started_at":   r.get("started_at", "")[:19],
                "total_tokens": tu.get("total_tokens", 0),
                "prompt_tokens": tu.get("prompt_tokens", 0),
                "completion_tokens": tu.get("completion_tokens", 0),
                "duration_sec": round(dur_sec, 1) if dur_sec is not None else None,
            })

    return {
        "agent_id":           WXO_AGENT_ID,
        "agent_name":         agent_name,
        "model_name":         model_name,
        "total_runs":         len(agent_runs),
        "runs_with_usage":    runs_with_usage,
        "total_tokens":       total_tokens,
        "prompt_tokens":      prompt_tokens,
        "completion_tokens":  compl_tokens,
        "cached_tokens":      cached_tokens,
        "avg_tokens_per_run": round(total_tokens / runs_with_usage) if runs_with_usage else 0,
        "avg_duration_sec":   round(total_dur_sec / runs_with_dur, 2) if runs_with_dur else 0,
        "token_series":       token_series[-30:],  # last 30 runs for sparkline
        "recent_runs":        [
            {
                "id":           r.get("id"),
                "started_at":   r.get("started_at", "")[:19],
                "duration_sec": round(
                    (datetime.fromisoformat(r["completed_at"].replace("Z", "+00:00")) -
                     datetime.fromisoformat(r["started_at"].replace("Z", "+00:00"))).total_seconds(), 1
                ) if r.get("started_at") and r.get("completed_at") else None,
                "total_tokens":       ((r.get("usage") or {}).get("token_usage") or {}).get("total_tokens"),
                "prompt_tokens":      ((r.get("usage") or {}).get("token_usage") or {}).get("prompt_tokens"),
                "completion_tokens":  ((r.get("usage") or {}).get("token_usage") or {}).get("completion_tokens"),
                "status":     r.get("status"),
            }
            for r in agent_runs[-10:][::-1]
        ],
    }


# ── Upload — ingest PDF directly into AstraDB + COS ──────────────────────────

@app.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    vendor_id:   Annotated[str, Query(pattern=r"^([A-Za-z0-9_-]{1,64})?$")] = "",
    template_id: Annotated[str, Query(pattern=r"^([A-Za-z0-9._-]{1,64})?$")] = "",
):
    """
    Receives a vendor contract PDF from the browser.
    1. Parses it into clause chunks with PyMuPDF
    2. Inserts all chunks into AstraDB (doc_type=vendor_contract)
    3. Uploads the original PDF to IBM COS
    4. Returns session_id + clause_index to the browser

    No WXO file staging is involved — this bypasses /upload-to-s3/ entirely.
    """
    content = await file.read(MAX_PDF_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file is too large.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="Only PDF files are accepted.")

    # Derive vendor_id from filename if not supplied
    if not vendor_id:
        vendor_id = _vendor_id_from_filename(file.filename or "vendor")
    if not template_id:
        template_id = DEFAULT_TEMPLATE_ID

    # 1 — Parse PDF
    try:
        with fitz.open("pdf", content) as doc:
            if doc.page_count > MAX_PDF_PAGES:
                raise HTTPException(status_code=413, detail="PDF has too many pages.")
            raw_text = "".join(page.get_text() for page in doc)
    except HTTPException:
        raise
    except Exception:
        log.warning("PDF parse failed", exc_info=True)
        raise HTTPException(status_code=422, detail="Could not parse the uploaded PDF.")

    clauses = _extract_clauses(raw_text)
    if not clauses:
        raise HTTPException(status_code=422,
                            detail="No clause sections could be extracted from the PDF.")
    # 2 — Generate unique session_id for this upload
    session_id = str(uuid4())
    today      = date.today().isoformat()

    # 3 — Bulk insert into AstraDB
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
            "clause_type":   "other",
            "section_id":    clause["section_id"],
            "heading":       clause["heading"],
            "text":          clause["text"],
            "$vectorize":    vectorize_text,
        })
    _collection.insert_many(docs)

    # 4 — Upload original PDF to IBM COS
    cos_key = f"original_{vendor_id}_{session_id}.pdf"
    _cos.upload_fileobj(io.BytesIO(content), COS_BUCKET, cos_key)
    cos_pdf_url = f"{COS_ENDPOINT}/{COS_BUCKET}/{cos_key}"

    # 5 — Build clause index
    clause_index = sorted({
        f"{c['section_id']} {c['heading']}"[:300] for c in clauses
    })

    return UploadResponse(
        session_id=session_id,
        cos_pdf_url=cos_pdf_url,
        vendor_id=vendor_id,
        template_id=template_id,
        clause_count=len(docs),
        clause_index=clause_index,
        filename=file.filename or "",
    )


# ── Template clauses — list all standard clauses for a template ───────────────

@app.get("/template_clauses")
def get_template_clauses(
    template_id: Annotated[str, Query(pattern=_TEMPLATE_PATTERN)] = "",
):
    """
    Return all standard_template clause chunks stored in AstraDB for the given
    template_id.  Used by the UI to pre-load and display the standard template
    so users can ask questions about it before uploading a vendor contract.

    Returns { template_id, clauses: [{section_id, heading, text, clause_type}] }
    Capped at 200 documents — more than enough for any real template.
    """
    if not template_id:
        raise HTTPException(status_code=400, detail="template_id is required")
    if _collection is None:
        raise HTTPException(status_code=503, detail="AstraDB not initialised")

    cursor = _collection.find(
        filter={"doc_type": "standard_template", "template_id": template_id},
        projection={"section_id": 1, "heading": 1, "text": 1, "clause_type": 1},
        limit=200,
    )
    docs = list(cursor)
    # Sort by section_id so clauses are returned in document order
    docs.sort(key=lambda d: d.get("section_id", ""))
    clauses = [
        {
            "section_id":  d.get("section_id",  ""),
            "heading":     d.get("heading",     ""),
            "text":        d.get("text",        ""),
            "clause_type": d.get("clause_type", "other"),
        }
        for d in docs
    ]
    return {"template_id": template_id, "clauses": clauses}


# ── Chat — forward to WXO agent ───────────────────────────────────────────────

# How many standard-template clause chars to inject in Phase 0.
# Keeps the context grounded without overloading the model's context window.
def _build_template_context(template_id: str) -> str:
    """
    Fetch all standard template clauses from AstraDB and return two blocks:

    Block 1 — CLAUSE INDEX (always included, ~30–60 chars per clause):
      Lists every section_id + heading so the agent can enumerate all clauses
      without hitting a context limit.

    Block 2 — CLAUSE BODIES (included up to MAX_BODY_CHARS total):
      Full text of each clause for answering content questions.
      Truncated with a clear marker when the template is very large.

    Returns an empty string if nothing is found or AstraDB is unavailable.
    """
    MAX_BODY_CHARS = 12_000   # ~3 000 words — well within 120B model context
    if _collection is None:
        return ""
    try:
        cursor = _collection.find(
            filter={"doc_type": "standard_template", "template_id": template_id},
            projection={"section_id": 1, "heading": 1, "text": 1},
            limit=200,
        )
        docs = sorted(list(cursor), key=lambda d: d.get("section_id", ""))
        if not docs:
            return ""

        # Block 1 — full clause index (section_id + heading only, no body text)
        index_lines = [f"=== Standard Template: {template_id} ===",
                       f"Total clauses: {len(docs)}",
                       "",
                       "CLAUSE INDEX (all clauses):"]
        for d in docs:
            index_lines.append(f"  {d.get('section_id','')}  {d.get('heading','')}")

        # Block 2 — clause bodies up to MAX_BODY_CHARS
        body_lines = ["", "CLAUSE CONTENT (for answering detailed questions):"]
        body_total = 0
        truncated = False
        for d in docs:
            entry = (f"\n{d.get('section_id','')} — {d.get('heading','')}:\n"
                     f"{d.get('text','')}")
            if body_total + len(entry) > MAX_BODY_CHARS:
                body_lines.append(
                    "\n… (remaining clause bodies omitted — use searchClause for specific content)"
                )
                truncated = True
                break
            body_lines.append(entry)
            body_total += len(entry)

        return "\n".join(index_lines + body_lines)
    except Exception:
        return ""


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # cos_pdf_url is later fetched by regenerate_pdf; only accept URLs that
    # point at this deployment's own upload prefix (CWE-918 / CWE-639).
    if req.cos_pdf_url and not req.cos_pdf_url.startswith(
            f"{COS_ENDPOINT}/{COS_BUCKET}/original_"):
        raise HTTPException(status_code=422, detail="Invalid cos_pdf_url.")

    thread_id = req.thread_id or await _create_thread()

    # Phase 1 — first message after PDF upload: embed full ingestion context
    # so the agent stores session_id, cos_pdf_url, template_id etc. in memory.
    if req.session_id and req.cos_pdf_url:
        clause_list = "\n".join(f"  {c}" for c in (req.clause_index or []))
        message_text = (
            f"The vendor contract has been uploaded and parsed.\n"
            f"session_id: {req.session_id}\n"
            f"cos_pdf_url: {req.cos_pdf_url}\n"
            f"vendor_id: {req.vendor_id or 'unknown'}\n"
            f"template_id: {req.template_id or DEFAULT_TEMPLATE_ID}\n"
            f"clause_count: {req.clause_count or 0}\n"
            f"clause_index:\n{clause_list}\n\n"
            f"{req.message or ''}"
        ).strip()
    # Phase 0 — no upload yet: inject full standard template clauses as context
    # so the agent can answer questions about the selected template directly.
    elif req.template_id:
        tid = req.template_id
        template_context = await asyncio.get_event_loop().run_in_executor(
            None, _build_template_context, tid
        )
        if template_context:
            message_text = (
                f"[template_id: {tid}]\n"
                f"The following are the clauses of the selected standard template "
                f"for reference. Answer the user's question using this context.\n\n"
                f"{template_context}\n\n"
                f"User question: {req.message or ''}"
            ).strip()
        else:
            message_text = (
                f"[template_id: {tid}]\n"
                f"{req.message or ''}"
            ).strip()
    else:
        message_text = req.message or "(empty message)"

    body: dict = {
        "messages": [{"role": "user", "content": message_text}],
        "stream": False,
    }

    resp = await _wxo_client.post(
        f"/v1/orchestrate/{WXO_AGENT_ID}/chat/completions",
        json=body,
        headers={**await _auth_headers_async(), "X-IBM-THREAD-ID": thread_id},
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502,
                            detail=f"WXO chat failed: {_safe(resp)}")
    data  = resp.json()
    reply = _extract_reply(data)
    return ChatResponse(
        reply=reply,
        thread_id=data.get("thread_id", thread_id),
    )
