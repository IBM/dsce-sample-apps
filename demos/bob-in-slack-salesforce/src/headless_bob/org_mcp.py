"""A read-only MCP server that gives Bob eyes on the org without credentials.

Bob calls tools (describe an object, list objects and Flows, run a SELECT);
the service answers them with its own Salesforce session. Bob never sees a
token, and nothing here writes to the org. Speaks MCP's Streamable HTTP
transport at one endpoint: POST carries JSON-RPC, replies are plain JSON,
GET is refused (no server-initiated stream), notifications get 202.

Wire it into a Bob workspace with `mcp_config(url, token)` written to
`.bob/mcp.json`; the runner's own env allowlist keeps the token out of
Bob's environment — it only ever travels in this one HTTP header.
"""

from __future__ import annotations

import hmac
import json
import logging
import re
import secrets
import time
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.concurrency import run_in_threadpool

from .metadata_api import MetadataApi

log = logging.getLogger("headless_bob.org_mcp")

PROTOCOL_VERSION = "2025-03-26"
SERVER_NAME = "salesforce-org"

TOOLS = [
    {"name": "describe_object",
     "description": "Fields of one Salesforce object: API name, label, type, required, writable (false for auto-number, formula and system fields), references, picklist values. "
                    "Use before designing anything that touches the object.",
     "inputSchema": {"type": "object", "properties": {"name": {"type": "string", "description": "API name, e.g. Success_Plan__c"}},
                     "required": ["name"]}},
    {"name": "list_objects",
     "description": "Custom objects in the org (API name and label). Pass custom_only=false for standard objects too.",
     "inputSchema": {"type": "object", "properties": {"custom_only": {"type": "boolean", "default": True}}}},
    {"name": "list_flows",
     "description": "Flow definitions in the org and whether each is active.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "query",
     "description": "Run a read-only SOQL SELECT (max 50 rows) to inspect real records, e.g. picklist usage or sample data.",
     "inputSchema": {"type": "object", "properties": {"soql": {"type": "string"}}, "required": ["soql"]}},
]

_SELECT = re.compile(r"^\s*SELECT\s", re.I)
_FORBIDDEN = re.compile(r";|\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|UNDELETE)\b|/\*", re.I)


def mcp_config(url: str, token: str) -> dict:
    """The `.bob/mcp.json` entry that points a Bob workspace at this server."""
    # Exactly what `bob mcp add -t http -H "Authorization: Bearer …"` writes on 2.0.4.
    return {"mcpServers": {SERVER_NAME: {"url": url, "transportType": "http",
                                         "headers": {"Authorization": f"Bearer {token}"},
                                         "timeout": 30000}}}


class OrgTools:
    def __init__(self, md: MetadataApi):
        self.md = md

    def call(self, name: str, args: dict) -> Any:
        """One tool call, logged with its duration: the record of what Bob read."""
        started = time.monotonic()
        try:
            result = self._call(name, args)
        except Exception as exc:
            log.info("mcp tool=%s args=%s ms=%d error=%s", name, json.dumps(args, default=str)[:200],
                     (time.monotonic() - started) * 1000, str(exc)[:200])
            raise
        log.info("mcp tool=%s args=%s ms=%d ok", name, json.dumps(args, default=str)[:200],
                 (time.monotonic() - started) * 1000)
        return result

    def _call(self, name: str, args: dict) -> Any:
        if name == "describe_object":
            return self.md.describe_object(str(args.get("name", "")))
        if name == "list_objects":
            return self.md.list_objects(custom_only=bool(args.get("custom_only", True)))
        if name == "list_flows":
            return self.md.list_flows()
        if name == "query":
            soql = str(args.get("soql", "")).strip()
            if not _SELECT.match(soql) or _FORBIDDEN.search(soql):
                raise ValueError("only a single read-only SELECT statement is allowed")
            return self.md.query(soql)
        raise ValueError(f"unknown tool {name}")


def make_router(tools: OrgTools, token: str, path: str = "/mcp") -> APIRouter:
    router = APIRouter()
    sessions: set[str] = set()

    def authorized(request: Request) -> bool:
        header = request.headers.get("authorization", "")
        presented = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
        origin = request.headers.get("origin", "")
        # Bob is not a browser; an Origin header means a web page is probing us.
        return bool(token) and hmac.compare_digest(presented, token) and not origin

    def handle(msg: dict) -> dict | None:
        method, msg_id, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
        if msg_id is None and method:            # notification
            return None
        if method == "initialize":
            requested = str(params.get("protocolVersion") or PROTOCOL_VERSION)
            return {"jsonrpc": "2.0", "id": msg_id, "result": {
                "protocolVersion": requested, "capabilities": {"tools": {}},
                "serverInfo": {"name": SERVER_NAME, "version": "1.0"},
                "instructions": "Read-only view of the connected Salesforce org. Nothing here changes the org."}}
        if method == "ping":
            return {"jsonrpc": "2.0", "id": msg_id, "result": {}}
        if method == "tools/list":
            return {"jsonrpc": "2.0", "id": msg_id, "result": {"tools": TOOLS}}
        if method == "tools/call":
            name = str(params.get("name", ""))
            try:
                data = tools.call(name, params.get("arguments") or {})
                text = json.dumps(data, indent=1, default=str)
                if len(text) > 60_000:
                    text = text[:60_000] + "\n… (truncated)"
                return {"jsonrpc": "2.0", "id": msg_id, "result": {"content": [{"type": "text", "text": text}], "isError": False}}
            except Exception as exc:
                return {"jsonrpc": "2.0", "id": msg_id, "result": {"content": [{"type": "text", "text": f"{name}: {exc}"}], "isError": True}}
        return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"method not found: {method}"}}

    @router.post(path, include_in_schema=False)
    async def mcp_post(request: Request) -> Response:
        if not authorized(request):
            return Response(status_code=401)
        try:
            body = json.loads(await request.body())
        except ValueError:
            return Response(status_code=400, content=json.dumps({"jsonrpc": "2.0", "error": {"code": -32700, "message": "parse error"}}),
                            media_type="application/json")
        batch = isinstance(body, list)
        messages = body if batch else [body]
        # Tool calls block on Salesforce; keep them off the event loop so Slack
        # webhooks and health checks keep being served while Bob reads the org.
        replies = await run_in_threadpool(
            lambda: [r for r in (handle(m) for m in messages if isinstance(m, dict)) if r is not None])
        headers = {}
        if any(m.get("method") == "initialize" for m in messages if isinstance(m, dict)):
            sid = secrets.token_hex(16); sessions.add(sid); headers["Mcp-Session-Id"] = sid
        if not replies:
            return Response(status_code=202, headers=headers)
        payload = replies if batch else replies[0]
        return Response(content=json.dumps(payload), media_type="application/json", headers=headers)

    @router.get(path, include_in_schema=False)
    async def mcp_get(request: Request) -> Response:
        return Response(status_code=405 if authorized(request) else 401)

    @router.delete(path, include_in_schema=False)
    async def mcp_delete(request: Request) -> Response:
        if not authorized(request):
            return Response(status_code=401)
        sessions.discard(request.headers.get("mcp-session-id", ""))
        return Response(status_code=200)

    return router
