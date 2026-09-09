"""Maximo REST API service for the MCP server.

Handles all live data queries against the Maximo Manage REST API including
routing decisions (Maximo API vs document RAG) and intelligent query execution.
"""

from __future__ import annotations

import re
from typing import Optional

import requests
import urllib3
from requests.auth import HTTPBasicAuth

# Suppress InsecureRequestWarning when verify_ssl=False (self-signed certs on
# internal Maximo deployments such as IBM TechZone demo environments).
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from mcp_server.src.config import maximo as cfg
from mcp_server.src.services.object_structure_mapper import object_structure_mapper
from shared.logging import get_logger

logger = get_logger(__name__)

# ── Status keyword → Maximo status code mapping ───────────────────────────────
_STATUS_MAP: dict[str, str] = {
    "approved": "APPR",
    "pending": "PEND",
    "in progress": "INPRG",
    "wappr": "WAPPR",
    "inprg": "INPRG",
    "appr": "APPR",
    "completed": "COMP",
    "closed": "CLOSE",
    "active": "ACTIVE",
    "inactive": "INACTIVE",
    "open": "OPEN",
    "cancel": "CAN",
    "cancelled": "CAN",
}

# Keywords that imply "order by most recent"
_RECENCY_KEYWORDS = ("recent", "latest", "newest", "last", "new")

# Fields to order by (descending) per object structure
_ORDER_BY_MAP: dict[str, str] = {
    "MXAPIWO":       "reportdate",
    "MXAPIWODETAIL": "reportdate",
    "MXAPIASSET":    "assetnum",
    "MXAPISR":       "reportdate",
    "MXAPIINCIDENT": "reportdate",
    "MXAPIPROBLEM":  "reportdate",
    "MXAPILOCATION": "location",
    "MXAPILABOR":    "laborcode",
}

# ── Column profiles per object structure ─────────────────────────────────────
_COLUMN_MAP: dict[str, list[str]] = {
    "MXAPIASSET":    ["assetnum", "description", "status", "priority", "location", "siteid", "assettype", "manufacturer", "model"],
    "MXAPIWO":       ["wonum", "description", "status", "worktype", "assetnum", "location", "schedstart", "schedfinish", "priority"],
    "MXAPIWODETAIL": ["wonum", "description", "status", "worktype", "assetnum", "location", "schedstart", "schedfinish", "priority"],
    "MXAPILOCATION": ["location", "description", "siteid", "status", "type"],
    "MXAPILOCATIONS":["location", "description", "siteid", "status", "type"],
    "MXAPISR":       ["ticketid", "description", "status", "assetnum", "location", "reportdate", "reportedby"],
    "MXAPIINCIDENT": ["ticketid", "description", "status", "assetnum", "location", "reportdate", "reportedby"],
    "MXAPIPROBLEM":  ["ticketid", "description", "status", "assetnum", "location", "reportdate", "reportedby"],
}

# Keywords that favour live Maximo API queries
_MAXIMO_KEYWORDS = [
    "how many", "count", "list all", "show all", "show me all", "get all",
    "work order", "workorder", "wo ", "wonum",
    "asset", "assets", "assetnum", "asset status", "asset number",
    "equipment", "machine", "device",
    "service request", "sr ", "ticket",
    "incident", "problem", "location", "locations", "site",
    "current status", "latest", "recent",
    "in status", "with status", "status is",
    "open", "closed", "in progress", "approved", "pending",
    "scheduled", "completed", "active",
    "what is the status", "what is the current", "show me the",
    "priority of", "priority for", "condition of", "details of",
]

# Keywords that favour document RAG queries
_RAG_KEYWORDS = [
    "how to", "how should", "how do", "how can", "procedure", "steps",
    "manual", "documentation", "guide", "instructions",
    "troubleshoot", "fix", "repair", "solve", "issue", "problem with",
    "maintenance procedure", "preventive maintenance", "pm procedure",
    "sop", "standard operating",
    "what should i do", "explain", "describe", "why", "what causes",
    "what could cause", "best practice", "recommendation",
    "safety", "precaution", "warning", "caution",
]

_ASSET_IDENTIFIER_RE = re.compile(r"\b([A-Z]+-\d+|[A-Z]+\d+)\b", re.IGNORECASE)

# Standalone numeric ID (e.g. "1002" in "work order 1002")
_NUMERIC_ID_RE = re.compile(r"\b(\d{3,8})\b")

# WO/ticket number patterns: "WO 1002", "WO#1002", "work order 1002", "ticket 1002", "SR 1002"
_WO_NUM_RE     = re.compile(r"\b(?:wo#?|work\s+order\s*#?|wonum\s*[:=]?\s*)(\d{1,10})\b", re.IGNORECASE)
_TICKET_NUM_RE = re.compile(r"\b(?:ticket\s*#?|sr\s*#?|service\s+request\s*#?|incident\s*#?|ticketid\s*[:=]?\s*)(\d{1,10})\b", re.IGNORECASE)


class MaximoService:
    """Maximo REST API client with intelligent query routing."""

    def __init__(self) -> None:
        base = cfg.base_url.rstrip("/")
        # Normalise: ensure the URL ends with /api or /oslc
        if not (base.endswith("/api") or base.endswith("/oslc")):
            base = base + "/maximo/api"
        self._base_url = base
        self._timeout = cfg.timeout
        self._verify_ssl = cfg.verify_ssl
        logger.info("MaximoService initialised", extra={"base_url": self._base_url, "verify_ssl": self._verify_ssl})

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _auth_headers(self) -> dict[str, str]:
        """Build authentication headers from config (API key preferred)."""
        if cfg.api_key:
            return {"apikey": cfg.api_key}
        if cfg.username and cfg.password:
            import base64
            token = base64.b64encode(f"{cfg.username}:{cfg.password}".encode()).decode()
            return {"Authorization": f"Basic {token}"}
        return {}

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        """Perform a GET request against the Maximo REST API."""
        url = f"{self._base_url}{path}"
        auth = self._auth_headers()
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            **auth,
        }
        auth_method = "apikey" if "apikey" in auth else ("basic" if "Authorization" in auth else "none")
        logger.info("Maximo GET", extra={"url": url, "params": params, "auth_method": auth_method})
        try:
            response = requests.get(url, headers=headers, params=params, timeout=self._timeout, verify=self._verify_ssl)
            logger.info("Maximo GET response", extra={"url": url, "http_status": response.status_code})
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError as exc:
            logger.error("Maximo GET - connection error", extra={"url": url, "error": str(exc)})
            raise
        except requests.exceptions.HTTPError as exc:
            logger.error("Maximo GET - HTTP error", extra={"url": url, "http_status": response.status_code, "body": response.text[:300]})
            raise
        except Exception as exc:
            logger.error("Maximo GET - unexpected error", extra={"url": url, "error": str(exc)})
            raise

    def _patch(self, path: str, body: dict, params: Optional[dict] = None) -> dict:
        """PATCH using a path relative to the base URL."""
        return self._patch_url(f"{self._base_url}{path}", body, params)

    def _patch_url(self, url: str, body: dict, params: Optional[dict] = None) -> dict:
        """Perform a PATCH request to a full URL.

        Maximo uses POST with ``x-method-override: PATCH`` + ``patchtype: MERGE``
        for field-level updates. A successful patch returns HTTP 204 No Content.
        The href returned by a GET may use a different subdomain than the base URL,
        so this method accepts the full URL directly.
        """
        auth = self._auth_headers()
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-method-override": "PATCH",
            "patchtype": "MERGE",
            **auth,
        }
        _params = {"lean": 1, **(params or {})}
        logger.info("Maximo PATCH", extra={"url": url, "body": body})
        try:
            response = requests.post(
                url,
                json=body,
                headers=headers,
                params=_params,
                timeout=self._timeout,
                verify=self._verify_ssl,
            )
            logger.info("Maximo PATCH response", extra={"url": url, "http_status": response.status_code})
            response.raise_for_status()
            # 204 No Content is the normal success response
            if response.status_code == 204 or not response.content:
                return {"success": True, "httpStatus": response.status_code}
            return response.json()
        except requests.exceptions.ConnectionError as exc:
            logger.error("Maximo PATCH - connection error", extra={"url": url, "error": str(exc)})
            raise
        except requests.exceptions.HTTPError as exc:
            logger.error("Maximo PATCH - HTTP error", extra={"url": url, "http_status": response.status_code, "body": response.text[:300]})
            raise
        except Exception as exc:
            logger.error("Maximo PATCH - unexpected error", extra={"url": url, "error": str(exc)})
            raise

    def _get_important_columns(self, object_structure: str, query: str) -> list[str]:
        """Return the relevant column list for *object_structure*, optionally
        adding extra columns implied by *query*."""
        columns = list(_COLUMN_MAP.get(object_structure, []))
        lower = query.lower()
        for field in ("priority", "status"):
            if field in lower and field not in columns:
                columns.append(field)
        return columns

    def _build_where(self, query: str, object_structure: str) -> Optional[str]:
        """Derive an OSLC WHERE clause from natural-language query keywords.

        Extracts:
        - WO / ticket number  (e.g. "work order 1002" → wonum="1002")
        - status filter       (e.g. "open" → status="OPEN")
        - asset identifier    (e.g. "PUMP-001" → assetnum="PUMP-001")
        - site filter         (e.g. "site BEDFORD" → siteid="BEDFORD")

        Returns None when no filters are found.
        """
        lower = query.lower()
        clauses: list[str] = []
        _wo_objects      = {"MXAPIWO", "MXAPIWODETAIL"}
        _ticket_objects  = {"MXAPISR", "MXAPIINCIDENT", "MXAPIPROBLEM"}

        # ── WO number filter ──────────────────────────────────────────────────
        # Explicit: "WO 1002", "work order 1002", "wonum 1002"
        wo_match = _WO_NUM_RE.search(query)
        if wo_match and object_structure in _wo_objects:
            clauses.append(f'wonum="{wo_match.group(1)}"')

        # ── Ticket / SR number filter ─────────────────────────────────────────
        ticket_match = _TICKET_NUM_RE.search(query)
        if ticket_match and object_structure in _ticket_objects:
            id_field = "ticketid"
            clauses.append(f'{id_field}="{ticket_match.group(1)}"')

        # ── Named asset identifier (PUMP-001, COMP2002, …) ───────────────────
        # Evaluated before the implicit numeric block so we can suppress the
        # bare-number fallback when the full identifier (e.g. PUMP-2547) already
        # covers the same field — prevents a double assetnum= clause.
        asset_match = _ASSET_IDENTIFIER_RE.search(query)
        named_asset_on_mxapiasset = False
        if asset_match:
            assetnum = asset_match.group(1).upper()
            if object_structure in _wo_objects | _ticket_objects:
                clauses.append(f'assetnum="{assetnum}"')
            elif object_structure == "MXAPIASSET":
                clauses.append(f'assetnum="{assetnum}"')
                named_asset_on_mxapiasset = True

        # ── Implicit numeric ID — bare number adjacent to object keyword ──────
        # Catches "details of work order 1002" where the number is not prefixed
        # with "WO" but the context makes clear it is a WO/ticket number.
        # Skip the MXAPIASSET branch when a named identifier already matched
        # (e.g. PUMP-2547 already produced assetnum="PUMP-2547"; the bare "2547"
        # would create a conflicting second clause).
        if not wo_match and not ticket_match and not named_asset_on_mxapiasset:
            num_match = _NUMERIC_ID_RE.search(query)
            if num_match:
                num = num_match.group(1)
                if object_structure in _wo_objects:
                    clauses.append(f'wonum="{num}"')
                elif object_structure in _ticket_objects:
                    clauses.append(f'ticketid="{num}"')
                elif object_structure == "MXAPIASSET":
                    clauses.append(f'assetnum="{num}"')

        # ── Status filter ─────────────────────────────────────────────────────
        # Match longest keyword first so "in progress" beats "in"
        for kw in sorted(_STATUS_MAP, key=len, reverse=True):
            if kw in lower:
                clauses.append(f'status="{_STATUS_MAP[kw]}"')
                break   # only one status clause

        # ── Site filter ───────────────────────────────────────────────────────
        site_match = re.search(r'\bsite\s+([A-Z0-9_-]+)\b', query, re.IGNORECASE)
        if site_match:
            siteid = site_match.group(1).upper()
            clauses.append(f'siteid="{siteid}"')

        return " and ".join(clauses) if clauses else None

    def _build_order_by(self, query: str, object_structure: str) -> Optional[str]:
        """Return an OSLC orderBy value when the query implies recency sorting."""
        lower = query.lower()
        if any(kw in lower for kw in _RECENCY_KEYWORDS):
            field = _ORDER_BY_MAP.get(object_structure)
            if field:
                return f"-{field}"   # leading '-' = descending in OSLC
        return None

    # ── Public API ────────────────────────────────────────────────────────────

    def test_connection(self) -> dict:
        """Verify the Maximo connection is reachable by probing /os/mxapilicense.

        Uses its own low-level request (not _get) so that an expected
        connectivity failure during a UI-initiated test does not generate
        an ERROR log entry.  Failures are logged at DEBUG level only.
        """
        url = f"{self._base_url}/os/mxapilicense"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            **self._auth_headers(),
        }
        try:
            resp = requests.get(
                url, headers=headers,
                params={"lean": 1},
                timeout=self._timeout,
                verify=self._verify_ssl,
            )
            resp.raise_for_status()
        except requests.exceptions.ConnectionError as exc:
            msg = f"Cannot reach {self._base_url} — connection refused or DNS failure"
            logger.debug("Maximo connection test failed", extra={"url": url, "error": str(exc)})
            return {"connected": False, "error": msg, "message": "Failed to connect"}
        except requests.exceptions.Timeout:
            msg = f"Connection to {self._base_url} timed out after {self._timeout}s"
            logger.debug("Maximo connection test timed out", extra={"url": url})
            return {"connected": False, "error": msg, "message": "Failed to connect"}
        except requests.exceptions.HTTPError:
            status = resp.status_code
            _HTTP_LABELS = {
                401: "Unauthorized — check API key / credentials",
                403: "Forbidden — the account lacks API access",
                404: "Not found — verify the Maximo URL is correct",
                503: "Service Unavailable — the Maximo instance is down or starting up",
            }
            detail = _HTTP_LABELS.get(status, f"HTTP {status}")
            msg = f"{detail} ({resp.url.split('/os/')[0]})"
            logger.debug(
                "Maximo connection test HTTP error",
                extra={"url": url, "http_status": status},
            )
            return {"connected": False, "error": msg, "message": "Failed to connect"}
        except Exception as exc:
            msg = f"Unexpected error: {exc}"
            logger.debug("Maximo connection test unexpected error", extra={"url": url, "error": str(exc)})
            return {"connected": False, "error": msg, "message": "Failed to connect"}

        # Probe succeeded — try to fetch the logged-in user's display name
        try:
            whoami = self._get("/whoami")
            user = whoami.get("displayName", whoami.get("userName", "connected"))
        except Exception:
            user = "connected"

        logger.info("Maximo connection test succeeded", extra={"url": url})
        return {"connected": True, "user": user, "message": "Successfully connected to Maximo Manage"}

    def query_object_structure(
        self,
        object_structure: str,
        *,
        select: Optional[list[str]] = None,
        page_size: int = 100,
        query: str = "",
    ) -> dict:
        """Query any Maximo object structure.

        Args:
            object_structure: Object structure name, e.g. ``MXAPIASSET``.
            select:           List of fields to include in the response.
            page_size:        Number of records per page.
            query:            Original NL query — used to derive WHERE / ORDER BY.

        Returns:
            Dict with ``success``, ``objectStructure``, ``totalCount``, ``data``.
        """
        params: dict[str, object] = {"lean": 1, "oslc.pageSize": page_size}
        if select:
            params["oslc.select"] = ",".join(select)

        where_clause = self._build_where(query or "", object_structure)
        if where_clause:
            params["oslc.where"] = where_clause

        order_by = self._build_order_by(query or "", object_structure)
        if order_by:
            params["oslc.orderBy"] = order_by

        logger.debug(
            "Maximo query params",
            extra={"object_structure": object_structure, "where": where_clause, "orderBy": order_by},
        )
        data = self._get(f"/os/{object_structure}", params=params)
        records = data.get("member", [])
        logger.debug(
            "Object structure query done",
            extra={"object_structure": object_structure, "records": len(records)},
        )
        return {
            "success": True,
            "objectStructure": object_structure,
            "totalCount": len(records),
            "data": records,
            "responseInfo": data.get("responseInfo", {}),
        }

    def get_asset(self, assetnum: str, siteid: Optional[str] = None) -> dict:
        """Fetch a specific asset by number."""
        query = assetnum
        if siteid:
            query = f"{assetnum} site {siteid}"
        return self.query_object_structure(
            "MXAPIASSET",
            select=["assetnum", "description", "status", "location", "assettype", "manufacturer", "model", "serialnum"],
            page_size=10,
            query=query,
        )

    def get_work_orders(
        self,
        *,
        assetnum: Optional[str] = None,
        status: Optional[str] = None,
        worktype: Optional[str] = None,
        limit: int = 50,
    ) -> dict:
        """Fetch work orders with optional filters."""
        return self.query_object_structure(
            "MXAPIWODETAIL",
            select=["wonum", "description", "status", "worktype", "assetnum", "location", "schedstart", "schedfinish"],
            page_size=limit,
        )

    def get_service_requests(
        self,
        *,
        status: Optional[str] = None,
        assetnum: Optional[str] = None,
        limit: int = 50,
    ) -> dict:
        """Fetch service requests with optional filters."""
        return self.query_object_structure(
            "MXAPISR",
            select=["ticketid", "description", "status", "assetnum", "location", "reportdate"],
            page_size=limit,
        )

    # ── Write operations ──────────────────────────────────────────────────────

    def update_object(
        self,
        object_structure: str,
        record_id: str,
        id_field: str,
        fields: dict,
    ) -> dict:
        """Update any Maximo record by patching specific fields.

        Maximo's OSLC API does not allow PATCH by business-key directly
        (e.g. /MXAPIWODETAIL/1002 returns 404). The correct approach is:
          1. GET the record using oslc.where to find its internal href
          2. PATCH that exact href

        Args:
            object_structure: e.g. ``MXAPIWODETAIL``
            record_id:        The value of the ID field (e.g. ``"1002"``)
            id_field:         The OSLC field name for filtering (e.g. ``"wonum"``)
            fields:           Dict of fields to update e.g. ``{"wopriority": 1}``

        Returns:
            Dict with ``success``, ``objectStructure``, ``recordId``, ``updated``.
        """
        import urllib.parse

        logger.info(
            "▶ Maximo update_object — fetching record href",
            extra={"object_structure": object_structure, "record_id": record_id, "id_field": id_field, "fields": fields},
        )

        # Step 1: GET the record to obtain its internal href.
        #
        # oslc.where uses OSLC query syntax: pmnum="PM-PUMP-001"
        # Passing this via requests params= double-encodes the embedded = and "
        # (pmnum%3D%22PM-PUMP-001%22) which Maximo cannot parse → 400.
        # Fix: append oslc.where as a pre-encoded query segment directly on the
        # path so requests never re-encodes the value.
        where_clause = f'{id_field}="{record_id}"'
        lookup_path = (
            f"/os/{object_structure}"
            f"?oslc.where={urllib.parse.quote(where_clause, safe='')}"
            f"&oslc.select={id_field},_rowstamp"
            f"&lean=1"
            f"&oslc.pageSize=1"
        )
        try:
            lookup = self._get(lookup_path)
        except requests.exceptions.HTTPError as exc:
            # Surface Maximo's own error message (e.g. BMXAA0024E permission errors)
            # instead of the raw HTTP exception string.
            body_text = ""
            if exc.response is not None:
                try:
                    body_text = exc.response.json().get("Error", {}).get("message", "")
                except Exception:
                    body_text = exc.response.text[:200]
            raise ValueError(body_text or str(exc)) from exc

        members = lookup.get("member", [])
        if not members:
            raise ValueError(
                f"Record not found: {object_structure} where {id_field}=\"{record_id}\""
            )
        record_href = members[0].get("href")
        if not record_href:
            raise ValueError(f"No href in record response for {object_structure} {record_id}")

        logger.info(
            "Record href resolved",
            extra={"object_structure": object_structure, "record_id": record_id, "href": record_href},
        )

        # Step 2: PATCH the resolved href directly (same object structure used for GET).
        result = self._patch_url(record_href, fields)

        logger.info(
            "✔ Maximo update_object complete",
            extra={"object_structure": object_structure, "record_id": record_id, "http_status": result.get("httpStatus")},
        )
        return {
            "success": True,
            "objectStructure": object_structure,
            "recordId": record_id,
            "idField": id_field,
            "href": record_href,
            "updated": fields,
            "httpStatus": result.get("httpStatus", 200),
        }

    def update_pm_frequency(self, pmnum: str, frequency: int, frequnit: str) -> dict:
        """Update a PM's time-based frequency and roll nextdate back by one cycle.

        Fetches the current ``nextdate`` from Maximo, subtracts ``frequency``
        ``frequnit`` months/weeks/days/years, then PATCHes ``frequency``,
        ``frequnit``, and the adjusted ``nextdate`` in a single request so the
        PM schedule context is immediately consistent.

        Args:
            pmnum:     PM number, e.g. ``"PM-2547"``.
            frequency: New frequency integer, e.g. ``3``.
            frequnit:  New frequency unit — one of ``DAYS``, ``WEEKS``,
                       ``MONTHS``, ``YEARS``.

        Returns:
            Result dict from :meth:`update_object` plus ``nextdate``.
        """
        from datetime import datetime
        from dateutil.relativedelta import relativedelta

        # Map frequnit → relativedelta keyword
        _UNIT_MAP = {
            "DAYS":   {"days":   frequency},
            "WEEKS":  {"weeks":  frequency},
            "MONTHS": {"months": frequency},
            "YEARS":  {"years":  frequency},
        }
        delta_kwargs = _UNIT_MAP.get(frequnit.upper(), {"months": frequency})

        # Fetch current nextdate
        import urllib.parse
        where_clause = f'pmnum="{pmnum}"'
        lookup_path = (
            f"/os/MXAPIPM"
            f"?oslc.where={urllib.parse.quote(where_clause, safe='')}"
            f"&oslc.select=pmnum,nextdate,frequency,frequnit"
            f"&lean=1&oslc.pageSize=1"
        )
        lookup = self._get(lookup_path)
        members = lookup.get("member", [])
        if not members:
            raise ValueError(f"PM record not found: pmnum=\"{pmnum}\"")

        current_nextdate_str = members[0].get("nextdate", "")
        if current_nextdate_str:
            dt_current = datetime.fromisoformat(current_nextdate_str)
            dt_new     = dt_current - relativedelta(**delta_kwargs)
            new_nextdate = dt_new.strftime("%Y-%m-%dT%H:%M:%S+00:00")
        else:
            new_nextdate = None

        logger.info(
            "PM frequency update — adjusting nextdate",
            extra={
                "pmnum": pmnum, "frequency": frequency, "frequnit": frequnit,
                "old_nextdate": current_nextdate_str, "new_nextdate": new_nextdate,
            },
        )

        fields: dict = {"frequency": frequency, "frequnit": frequnit}
        if new_nextdate:
            fields["nextdate"] = new_nextdate

        result = self.update_object(
            object_structure="MXAPIPM",
            record_id=pmnum,
            id_field="pmnum",
            fields=fields,
        )
        result["nextdate"] = new_nextdate
        return result

    def update_work_order(self, wonum: str, fields: dict) -> dict:
        """Update a work order's fields.

        Args:
            wonum:  Work order number (e.g. ``"1002"``).
            fields: Fields to update. Common fields:
                    ``wopriority`` (int 1-5), ``description`` (str),
                    ``status`` (str), ``schedstart`` (str ISO date),
                    ``schedfinish`` (str ISO date), ``assetnum`` (str).

        Returns:
            Result dict from :meth:`update_object`.
        """
        return self.update_object("MXAPIWODETAIL", wonum, "wonum", fields)

    def update_asset(self, assetnum: str, fields: dict) -> dict:
        """Update an asset's fields."""
        return self.update_object("MXAPIASSET", assetnum, "assetnum", fields)

    # ── Routing ───────────────────────────────────────────────────────────────

    def determine_routing(self, query: str) -> dict:
        """Decide whether a query should be answered by live Maximo API or RAG.

        Returns:
            Dict with keys ``route`` (``'maximo'`` or ``'rag'``),
            ``confidence``, ``reason``, and optional ``objectStructure``.
        """
        lower = query.lower()
        has_asset_id = bool(_ASSET_IDENTIFIER_RE.search(query))

        maximo_score = sum(1 for kw in _MAXIMO_KEYWORDS if kw in lower)
        rag_score = sum(1 for kw in _RAG_KEYWORDS if kw in lower)

        # Asset-specific property query → prefer Maximo API
        if has_asset_id and any(kw in lower for kw in ("priority", "status", "condition", "what is")):
            match = object_structure_mapper.find_object_structure(query)
            return {
                "route": "maximo",
                "confidence": 0.8,
                "reason": "Asset-specific property query",
                **match,
            }

        if maximo_score > rag_score:
            match = object_structure_mapper.find_object_structure(query)
            return {
                "route": "maximo",
                "confidence": maximo_score / len(_MAXIMO_KEYWORDS),
                "reason": "Query requests real-time Maximo data",
                **match,
            }

        if rag_score > maximo_score:
            return {
                "route": "rag",
                "confidence": rag_score / len(_RAG_KEYWORDS),
                "reason": "Query requests documentation or procedural information",
            }

        # Ambiguous: prefer Maximo if an asset identifier is present
        if has_asset_id:
            match = object_structure_mapper.find_object_structure(query)
            return {
                "route": "maximo",
                "confidence": 0.6,
                "reason": "Ambiguous query with asset identifier",
                **match,
            }

        return {
            "route": "rag",
            "confidence": 0.5,
            "reason": "Ambiguous query — defaulting to documentation search",
        }

    def intelligent_query(self, query: str, *, assetnum: Optional[str] = None, limit: int = 100) -> Optional[dict]:
        """Auto-detect the object structure and execute a Maximo query.

        Returns:
            Result dict from :meth:`query_object_structure`, or ``None`` if
            routing determined this query belongs to the RAG system.
        """
        routing = self.determine_routing(query)
        if routing["route"] != "maximo":
            return None

        obj_struct = routing.get("objectStructure")
        if not obj_struct:
            logger.warning("No object structure found for Maximo query", extra={"query": query})
            return None

        select_cols = self._get_important_columns(obj_struct, query)
        result = self.query_object_structure(obj_struct, select=select_cols, page_size=limit, query=query)
        return {**result, "route": "maximo", "routing": routing, "query": query}

    # ── Object structure helpers (delegates to mapper) ───────────────────────

    def get_available_object_structures(self) -> list[dict]:
        return object_structure_mapper.get_all()

    def search_object_structures(self, term: str) -> list[dict]:
        return object_structure_mapper.search(term)

    def is_valid_object_structure(self, name: str) -> bool:
        return object_structure_mapper.is_valid(name)


maximo_service = MaximoService()
