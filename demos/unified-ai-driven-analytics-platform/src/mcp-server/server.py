#!/usr/bin/env python3
"""
Custom Presto MCP Server for watsonx.data
Supports both Developer Edition (basic auth) and SaaS (IBM Cloud IAM)
"""

import os
import sys
import asyncio
import json
from typing import Any, Optional
import re
from pathlib import Path
import ssl
import urllib3
import requests
from requests.adapters import HTTPAdapter
try:
    import prestodb
    import prestodb.auth
except ImportError:
    prestodb = None

try:
    from mcp.server import Server
    from mcp.server.sse import SseServerTransport
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    from starlette.applications import Starlette
    from starlette.routing import Route
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    Server = None
    Tool = None
    TextContent = None
from datetime import datetime, timedelta

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class SSLAdapter(HTTPAdapter):
    """Custom HTTPAdapter that disables SSL verification"""
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        kwargs['ssl_context'] = context
        return super().init_poolmanager(*args, **kwargs)

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

def _load_dotenv(dotenv_path: Optional[str], *, override: bool = True) -> None:
    """
    Minimal .env loader (no external deps).
    Only sets keys that are not already present in the environment.
    """
    if not dotenv_path:
        return
    path = Path(dotenv_path).expanduser()
    if not path.exists() or not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if not key:
            continue
        if override or key not in os.environ:
            os.environ[key] = value

def _require_identifier(value: str, field_name: str) -> str:
    if not _IDENT.match(value):
        raise ValueError(f"Invalid {field_name}: {value!r}. Only [A-Za-z_][A-Za-z0-9_]* is allowed.")
    return value

# Presto connection configuration from environment
PRESTO_HOST = os.getenv("PRESTO_HOST", "localhost")
PRESTO_PORT = int(os.getenv("PRESTO_PORT", "8443"))
PRESTO_USER = os.getenv("PRESTO_USER", "ibmlhadmin")
PRESTO_PASSWORD = os.getenv("PRESTO_PASSWORD", "")
PRESTO_CATALOG = os.getenv("PRESTO_CATALOG", "system")
PRESTO_SCHEMA = os.getenv("PRESTO_SCHEMA", "runtime")
PRESTO_TLS = os.getenv("PRESTO_TLS", "true").lower() == "true"
PRESTO_TLS_VERIFY = os.getenv("PRESTO_TLS_VERIFY", "false").lower() == "true"

# IBM Cloud IAM configuration (for SaaS)
IBM_CLOUD_API_KEY = os.getenv("IBM_CLOUD_API_KEY", "")
USE_IAM_AUTH = os.getenv("USE_IAM_AUTH", "false").lower() == "true"

# IAM token cache
_iam_token_cache: dict[str, Any] = {"token": None, "expires_at": None}

# Vector store backend: "hcd" (local DataStax HCD via CQL) or "astra" (Astra DB via Data API)
VECTOR_STORE = os.getenv("VECTOR_STORE", "hcd").lower()

# HCD (vector store) for runbook search — used when VECTOR_STORE=hcd
HCD_HOST = os.getenv("HCD_HOST", "127.0.0.1")
HCD_PORT = int(os.getenv("HCD_PORT", "9042"))
HCD_USER = os.getenv("HCD_USER", "cassandra")
HCD_PASSWORD = os.getenv("HCD_PASSWORD", "cassandra")
HCD_KEYSPACE = os.getenv("HCD_RUNBOOKS_KEYSPACE", "runbooks")
HCD_TABLE = os.getenv("HCD_RUNBOOKS_TABLE", "runbooks")

# Astra DB — used when VECTOR_STORE=astra
ASTRA_TOKEN = os.getenv("ASTRA_TOKEN", "")
ASTRA_API_ENDPOINT = os.getenv("ASTRA_API_ENDPOINT", "")
ASTRA_KEYSPACE = os.getenv("ASTRA_RUNBOOKS_KEYSPACE", "runbooks")
ASTRA_TABLE = os.getenv("ASTRA_RUNBOOKS_TABLE", "runbooks_table")

app = Server("wxd-presto-local") if MCP_AVAILABLE else None

def get_iam_token() -> str:
    """
    Get IBM Cloud IAM token using API key.
    Caches token until it expires (tokens are valid for ~1 hour).
    """
    global _iam_token_cache
    
    # Check if we have a valid cached token
    if _iam_token_cache["token"] and _iam_token_cache["expires_at"]:
        if datetime.now() < _iam_token_cache["expires_at"]:
            return _iam_token_cache["token"]
    
    # Get new token from IBM Cloud IAM
    if not IBM_CLOUD_API_KEY:
        raise ValueError("IBM_CLOUD_API_KEY is required when USE_IAM_AUTH=true")
    
    iam_url = "https://iam.cloud.ibm.com/identity/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": IBM_CLOUD_API_KEY
    }
    
    try:
        response = requests.post(iam_url, headers=headers, data=data, timeout=30)
        response.raise_for_status()
        token_data = response.json()
        
        # Cache the token (expires in ~3600 seconds, we'll refresh 5 min early)
        _iam_token_cache["token"] = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        _iam_token_cache["expires_at"] = datetime.now() + timedelta(seconds=expires_in - 300)
        
        return token_data["access_token"]
    except Exception as e:
        raise RuntimeError(f"Failed to get IAM token: {e}")

class PrestoClient:
    """Direct HTTP client for Presto REST API with Bearer token support"""
    
    def __init__(self, host: str, port: int, user: str, catalog: str, schema: str,
                 use_iam: bool = False, password: str = "", verify_ssl: bool = True):
        self.host = host
        self.port = port
        self.user = user
        self.catalog = catalog
        self.schema = schema
        self.use_iam = use_iam
        self.password = password
        self.verify_ssl = verify_ssl
        self.base_url = f"https://{host}:{port}"
        
    def _get_headers(self) -> dict:
        """Get HTTP headers for Presto requests"""
        headers = {
            "X-Presto-User": self.user,
            "X-Presto-Catalog": self.catalog,
            "X-Presto-Schema": self.schema,
        }
        
        if self.use_iam:
            # SaaS: Bearer token
            token = get_iam_token()
            headers["Authorization"] = f"Bearer {token}"
        elif self.password:
            # Dev Edition: Basic auth
            import base64
            credentials = base64.b64encode(f"{self.user}:{self.password}".encode()).decode()
            headers["Authorization"] = f"Basic {credentials}"
            
        return headers
    
    def execute_query(self, sql: str, timeout: int = 300) -> dict:
        """Execute a SQL query and return results"""
        import time
        
        # Submit query
        response = requests.post(
            f"{self.base_url}/v1/statement",
            headers=self._get_headers(),
            data=sql,
            verify=self.verify_ssl,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        
        # Poll for results
        start_time = time.time()
        while "nextUri" in result and result.get("data") is None:
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Query timeout after {timeout}s")
            
            time.sleep(0.1)
            response = requests.get(
                result["nextUri"],
                headers=self._get_headers(),
                verify=self.verify_ssl,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
        
        return result

def get_presto_client(catalog: Optional[str] = None, schema: Optional[str] = None) -> PrestoClient:
    """Create Presto client with Bearer token or Basic auth support"""
    effective_catalog = catalog or PRESTO_CATALOG
    effective_schema = schema or PRESTO_SCHEMA
    
    return PrestoClient(
        host=PRESTO_HOST,
        port=PRESTO_PORT,
        user=PRESTO_USER,
        catalog=effective_catalog,
        schema=effective_schema,
        use_iam=USE_IAM_AUTH,
        password=PRESTO_PASSWORD,
        verify_ssl=PRESTO_TLS_VERIFY
    )

@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available Presto tools"""
    return [
        Tool(
            name="execute_select",
            description=(
                "Execute a read-only SQL query (SELECT only). Returns query results with columns and rows. "
                "For the 'Maximize the Value of Enterprise Data' demo: orders are in icebergdefault.demo_data (order_id varchar, e.g. 'O-10452'), "
                "shipment/inventory/policy in iceberg_data.curated_demo, customer tier/segment in snowflake.ANALYTICS. "
                "For O-10452 use warehouse_id WH-BER (Berlin) in inventory/shipment; warehouses are German-only (no WH-CHI). Do not use sample_data.gosales. "
                "compensation_policy has delay_hours_min, delay_hours_max (no delay_days). "
                "For 'why is O-10452 delayed?' compose one federated query (orders+order_items+shipment_events+inventory_daily) from the schema in .bob/rules, run it once as your only call, then summarize and stop. "
                "Column names: orders have order_ts, warehouse_id (order_items has no warehouse_id); order_items have sku, qty (not product_id/quantity); shipment_events have event_type, event_ts, location (no delay_hours); compensation_policy has credit_pct (not compensation_pct). Full schema is in .bob/rules-wxo-wxd-demo/10-demo-schema-and-behavior.md — do not call describe_table."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SQL SELECT query to execute"
                    },
                    "catalog": {
                        "type": "string",
                        "description": "Optional catalog name (default from env)"
                    },
                    "schema": {
                        "type": "string",
                        "description": "Optional schema name (default from env)"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="list_catalogs",
            description=(
                "List all available catalogs in the Presto instance. "
                "Demo (Maximize the Value of Enterprise Data): orders in icebergdefault.demo_data (order_id varchar e.g. 'O-10452'), "
                "shipment/inventory/policy in iceberg_data.curated_demo, customer tier/segment in snowflake.ANALYTICS. Do not use sample_data.gosales."
            ),
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="list_schemas",
            description=(
                "List all schemas in a specified catalog. "
                "Demo: use icebergdefault.demo_data, iceberg_data.curated_demo, snowflake.ANALYTICS for order O-10452; order_id is varchar. Do not use sample_data.gosales."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "catalog": {
                        "type": "string",
                        "description": "Catalog name to list schemas from"
                    }
                },
                "required": ["catalog"]
            }
        ),
        Tool(
            name="list_tables",
            description=(
                "List all tables in a specified schema. "
                "Demo: orders/order_items in icebergdefault.demo_data; shipment_events, inventory_daily, compensation_policy in iceberg_data.curated_demo; customer_tier_ltv, customer_region_segment in snowflake.ANALYTICS. order_id varchar e.g. 'O-10452'. Do not use sample_data.gosales."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "catalog": {
                        "type": "string",
                        "description": "Catalog name"
                    },
                    "schema": {
                        "type": "string",
                        "description": "Schema name to list tables from"
                    }
                },
                "required": ["catalog", "schema"]
            }
        ),
        Tool(
            name="describe_table",
            description=(
                "Show detailed table schema including column names, types, and properties. "
                "Demo: For 'why is O-10452 delayed?' do NOT use this tool — compose one federated query from the schema in .bob/rules-wxo-wxd-demo/10-demo-schema-and-behavior.md (orders+order_items+shipment_events+inventory_daily), run it once, then stop. Do not call describe_table for demo tables."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "catalog": {
                        "type": "string",
                        "description": "Catalog name"
                    },
                    "schema": {
                        "type": "string",
                        "description": "Schema name"
                    },
                    "table": {
                        "type": "string",
                        "description": "Table name to describe"
                    }
                },
                "required": ["catalog", "schema", "table"]
            }
        ),
        Tool(
            name="get_instance_details",
            description=(
                "Get Presto instance connection details and configuration. "
                "Demo: orders in icebergdefault.demo_data (order_id varchar 'O-10452'), iceberg_data.curated_demo, snowflake.ANALYTICS. Do not use sample_data.gosales."
            ),
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="vector_search",
            description=(
                f"Search the vector store ({'Astra DB' if VECTOR_STORE == 'astra' else 'HCD'}) for runbooks, playbooks, SLA snippets, and incident notes. "
                "Returns the most relevant text chunks for the given query. "
                "**When to use:** Whenever the user asks what to do, what actions to take, how to handle a situation, how to prevent something (e.g. churn), what runbooks or playbooks say, or whether we have had similar cases before — you must call this tool. "
                "Runbook and past-incident content exists only in HCD; it is not in README, rules, or other docs. Do not cite runbook or incident guidance without calling this tool. Each returned chunk has 'id' and 'source' — when you use chunk content in your answer, cite the source (e.g. 'Per runbook (rb-1): …' or 'Source: runbook rb-2'). When combining with compensation policy, cite the actual delay band that matches the policy row you use (e.g. 'delay in 24–72h band'); do not say '72+ hours' for the 24–72h tier. For delay calculations use the demo reference time 2026-02-15 12:00 UTC as 'now' (do not use the real current date). Combine the returned chunks with SQL results (e.g. policy, inventory) in your answer."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language or search phrase (e.g. 'PLATINUM delay handling', 'delay runbook', 'SKU-881 past incidents')"
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Max number of chunks to return (default 3, max 10)",
                        "default": 3
                    }
                },
                "required": ["query"]
            }
        )
    ]

def _load_embedding_model():
    """Load sentence-transformers model, preferring local cache."""
    from sentence_transformers import SentenceTransformer
    try:
        return SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
    except Exception:
        return SentenceTransformer("all-MiniLM-L6-v2")


def _vector_search_hcd(query: str, top_k: int) -> list[dict]:
    """Run vector search in local HCD via CQL (ANN). Returns list of {id, text, source}."""
    from cassandra.cluster import Cluster
    from cassandra.auth import PlainTextAuthProvider

    model = _load_embedding_model()
    query_embedding = model.encode(query, convert_to_numpy=True)
    vec_list = [round(float(x), 6) for x in query_embedding]
    vec_cql = "[" + ",".join(str(x) for x in vec_list) + "]"

    hcd_host = os.getenv("HCD_HOST", "127.0.0.1")
    hcd_port = int(os.getenv("HCD_PORT", "9042"))
    hcd_user = os.getenv("HCD_USER", "cassandra")
    hcd_password = os.getenv("HCD_PASSWORD", "cassandra")
    ks = os.getenv("HCD_RUNBOOKS_KEYSPACE", "runbooks")
    tbl = os.getenv("HCD_RUNBOOKS_TABLE", "runbooks")

    auth = PlainTextAuthProvider(username=hcd_user, password=hcd_password)
    cluster = Cluster(contact_points=[hcd_host], port=hcd_port, auth_provider=auth)
    session = cluster.connect()
    try:
        # CQL vector search: ORDER BY embedding ANN OF <vector> LIMIT k (DataStax HCD 1.2)
        cql = (
            f"SELECT id, text, source FROM {ks}.{tbl} "
            f"ORDER BY embedding ANN OF {vec_cql} LIMIT {min(10, max(1, top_k))}"
        )
        rows = session.execute(cql)
        return [{"id": r.id, "text": r.text or "", "source": r.source or "runbook"} for r in rows]
    finally:
        cluster.shutdown()


def _vector_search_astra(query: str, top_k: int) -> list[dict]:
    """Run vector search in Astra DB via Data API Tables. Returns list of {id, text, source}."""
    from astrapy import DataAPIClient

    token = os.getenv("ASTRA_TOKEN", "")
    api_endpoint = os.getenv("ASTRA_API_ENDPOINT", "")
    ks = os.getenv("ASTRA_RUNBOOKS_KEYSPACE", "runbooks")
    tbl = os.getenv("ASTRA_RUNBOOKS_TABLE", "runbooks_table")

    if not token or not api_endpoint:
        raise ValueError(
            "ASTRA_TOKEN and ASTRA_API_ENDPOINT must be set in .env when VECTOR_STORE=astra"
        )

    model = _load_embedding_model()
    query_embedding = model.encode(query, convert_to_numpy=True)
    vec_list = [round(float(x), 6) for x in query_embedding]

    client = DataAPIClient(token=token)
    db = client.get_database_by_api_endpoint(api_endpoint=api_endpoint, keyspace=ks)
    table = db.get_table(tbl)

    # Data API vector search: sort by embedding similarity
    results = table.find(
        {},
        sort={"embedding": vec_list},
        limit=min(10, max(1, top_k)),
        projection={"id": True, "text": True, "source": True},
    )
    return [
        {"id": r.get("id", ""), "text": r.get("text", ""), "source": r.get("source", "runbook")}
        for r in results
    ]


def _vector_search_run(query: str, top_k: int) -> list[dict]:
    """Route vector search to HCD or Astra DB based on VECTOR_STORE env var."""
    backend = os.getenv("VECTOR_STORE", "hcd").lower()
    if backend == "astra":
        return _vector_search_astra(query, top_k)
    return _vector_search_hcd(query, top_k)


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Execute tool calls"""
    try:
        # Vector search (HCD/CQL) — no Presto connection
        if name == "vector_search":
            query = (arguments.get("query") or "").strip()
            if not query:
                return [TextContent(type="text", text=json.dumps({"error": "query is required", "chunks": []}, indent=2))]
            top_k = int(arguments.get("top_k", 3))
            try:
                chunks = _vector_search_run(query, top_k)
                return [TextContent(type="text", text=json.dumps({"chunks": chunks, "count": len(chunks)}, indent=2))]
            except ModuleNotFoundError as e:
                backend = os.getenv("VECTOR_STORE", "hcd").lower()
                if backend == "astra":
                    hint = "Install astrapy and sentence-transformers: pip install astrapy>=2.0.1 sentence-transformers"
                else:
                    hint = "Install vector_search dependencies: pip install cassandra-driver sentence-transformers (Python 3.11 or 3.12 recommended; 3.14 may fail to build cassandra-driver)."
                return [TextContent(
                    type="text",
                    text=json.dumps({
                        "error": str(e),
                        "hint": hint,
                        "chunks": [],
                    }, indent=2)
                )]

        # Allow per-call overrides for catalog/schema where relevant
        catalog_override = arguments.get("catalog") if isinstance(arguments, dict) else None
        schema_override = arguments.get("schema") if isinstance(arguments, dict) else None

        if catalog_override is not None:
            catalog_override = _require_identifier(str(catalog_override), "catalog")
        if schema_override is not None:
            schema_override = _require_identifier(str(schema_override), "schema")

        client = get_presto_client(catalog=catalog_override, schema=schema_override)
        
        if name == "execute_select":
            query = arguments["query"]
            # Safety check: only allow SELECT, SHOW, DESCRIBE, or WITH (CTE leading to SELECT)
            query_upper = query.strip().upper()
            allowed_starts = ("SELECT", "SHOW", "DESCRIBE", "WITH")
            if not any(query_upper.startswith(s) for s in allowed_starts):
                return [TextContent(
                    type="text",
                    text=json.dumps({
                        "error": "Only SELECT, SHOW, and DESCRIBE queries are allowed",
                        "query": query[:100]
                    }, indent=2)
                )]
            
            query_result = client.execute_query(query)
            columns = [col["name"] for col in query_result.get("columns", [])] if "columns" in query_result else []
            rows = query_result.get("data", [])
            
            result = {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows) if rows else 0,
                "query": query
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "list_catalogs":
            query_result = client.execute_query("SHOW CATALOGS")
            catalogs = [row[0] for row in query_result.get("data", [])]
            demo_hint = (
                "DEMO SCHEMA (Maximize the Value of Enterprise Data): "
                "For order O-10452 use icebergdefault.demo_data.orders (order_id varchar 'O-10452'), "
                "iceberg_data.curated_demo (shipment_events, inventory_daily, compensation_policy), "
                "snowflake.ANALYTICS (customer_tier_ltv, customer_region_segment). "
                "O-10452 warehouse is WH-BER (Berlin); use that warehouse_id for inventory/shipment. Warehouses are German-only (no WH-CHI). One carrier per order. Do NOT use sample_data.gosales."
            )
            return [TextContent(type="text", text=json.dumps({
                "catalogs": catalogs,
                "count": len(catalogs),
                "demo_schema_hint": demo_hint
            }, indent=2))]
        
        elif name == "list_schemas":
            catalog = _require_identifier(str(arguments["catalog"]), "catalog")
            query_result = client.execute_query(f"SHOW SCHEMAS FROM {catalog}")
            schemas = [row[0] for row in query_result.get("data", [])]
            out = {"catalog": catalog, "schemas": schemas, "count": len(schemas)}
            if catalog == "sample_data":
                out["demo_note"] = "For order O-10452 use icebergdefault.demo_data and iceberg_data.curated_demo, not sample_data."
            return [TextContent(type="text", text=json.dumps(out, indent=2))]
        
        elif name == "list_tables":
            catalog = _require_identifier(str(arguments["catalog"]), "catalog")
            schema = _require_identifier(str(arguments["schema"]), "schema")
            query_result = client.execute_query(f"SHOW TABLES FROM {catalog}.{schema}")
            tables = [row[0] for row in query_result.get("data", [])]
            out = {"catalog": catalog, "schema": schema, "tables": tables, "count": len(tables)}
            if catalog == "sample_data" and schema.lower() == "gosales":
                out["demo_note"] = "For order O-10452 use icebergdefault.demo_data.orders (order_id varchar), not sample_data.gosales."
            return [TextContent(type="text", text=json.dumps(out, indent=2))]
        
        elif name == "describe_table":
            catalog = _require_identifier(str(arguments["catalog"]), "catalog")
            schema = _require_identifier(str(arguments["schema"]), "schema")
            table = _require_identifier(str(arguments["table"]), "table")
            query_result = client.execute_query(f"DESCRIBE {catalog}.{schema}.{table}")
            columns = []
            for row in query_result.get("data", []):
                columns.append({
                    "name": row[0],
                    "type": row[1],
                    "extra": row[2] if len(row) > 2 else "",
                    "comment": row[3] if len(row) > 3 else ""
                })
            out = {
                "catalog": catalog,
                "schema": schema,
                "table": table,
                "columns": columns,
                "column_count": len(columns)
            }
            # Demo: nudge to use prescribed query instead of exploring schema
            if (catalog, schema, table) in [
                ("icebergdefault", "demo_data", "orders"), ("icebergdefault", "demo_data", "order_items"),
                ("iceberg_data", "curated_demo", "shipment_events"),
                ("iceberg_data", "curated_demo", "inventory_daily"),
                ("iceberg_data", "curated_demo", "compensation_policy"),
            ]:
                out["demo_instruction"] = (
                    "For 'why is O-10452 delayed?' do NOT call describe_table again. "
                    "Compose one federated query from the schema in .bob/rules-wxo-wxd-demo/10-demo-schema-and-behavior.md (orders+order_items+shipment_events+inventory_daily), run execute_select ONCE, then summarize and stop."
                )
            return [TextContent(type="text", text=json.dumps(out, indent=2))]
        
        elif name == "get_instance_details":
            # Get Presto version and node info.
            query_result = client.execute_query(
                "SELECT node_version, http_uri, coordinator, state "
                "FROM system.runtime.nodes "
                "ORDER BY coordinator DESC "
                "LIMIT 1"
            )
            row = query_result.get("data", [[]])[0] if query_result.get("data") else []
            node_version = row[0] if len(row) > 0 else "unknown"
            http_uri = row[1] if len(row) > 1 else None
            coordinator = bool(row[2]) if len(row) > 2 else None
            state = row[3] if len(row) > 3 else None
            
            result = {
                "connection": {
                    "host": PRESTO_HOST,
                    "port": PRESTO_PORT,
                    "user": PRESTO_USER,
                    "catalog": PRESTO_CATALOG,
                    "schema": PRESTO_SCHEMA,
                    "tls": PRESTO_TLS
                },
                "presto": {
                    "node_version": node_version,
                    "http_uri": http_uri,
                    "coordinator": coordinator,
                    "state": state,
                },
                "status": "connected"
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        else:
            return [TextContent(type="text", text=json.dumps({
                "error": f"Unknown tool: {name}"
            }, indent=2))]
            
    except Exception as e:
        return [TextContent(type="text", text=json.dumps({
            "error": str(e),
            "tool": name,
            "arguments": arguments
        }, indent=2))]

async def handle_sse(request):
    """Handle SSE connections"""
    sse = SseServerTransport("/messages")
    async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
        await app.run(
            streams[0],
            streams[1],
            app.create_initialization_options()
        )

async def handle_messages(request):
    """Handle message endpoint"""
    sse = SseServerTransport("/messages")
    return await sse.handle_post_message(request)

# Create Starlette app for SSE transport
starlette_app = Starlette(
    routes=[
        Route("/sse", endpoint=handle_sse),
        Route("/messages", endpoint=handle_messages, methods=["POST"]),
    ]
)

async def _self_test() -> int:
    try:
        debug = {
            "host": PRESTO_HOST,
            "port": PRESTO_PORT,
            "user": PRESTO_USER,
            "catalog": PRESTO_CATALOG,
            "schema": PRESTO_SCHEMA,
            "tls": PRESTO_TLS,
            "tls_verify": PRESTO_TLS_VERIFY,
            "use_iam_auth": USE_IAM_AUTH,
        }
        client = get_presto_client()
        query_result = client.execute_query("SHOW CATALOGS")
        catalogs = [row[0] for row in query_result.get("data", [])]
        print(json.dumps({"ok": True, "config": debug, "catalogs": catalogs}, indent=2))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "config": debug if "debug" in locals() else None}, indent=2), file=sys.stderr)
        return 1

async def main():
    """Run MCP server (stdio by default, optional SSE)."""
    import argparse

    parser = argparse.ArgumentParser(description="watsonx.data Presto MCP Server (local, via port-forward)")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="stdio")
    parser.add_argument("--dotenv", default=str(Path(__file__).with_name(".env")), help="Path to .env file")
    parser.add_argument("--self-test", action="store_true", help="Test Presto connectivity and exit")
    parser.add_argument("--host", default=os.getenv("MCP_HOST", "127.0.0.1"), help="SSE host (only for --transport sse)")
    parser.add_argument("--port", type=int, default=int(os.getenv("MCP_PORT", "8000")), help="SSE port (only for --transport sse)")
    args = parser.parse_args()

    _load_dotenv(args.dotenv, override=True)

    # Re-read env after dotenv load
    global PRESTO_HOST, PRESTO_PORT, PRESTO_USER, PRESTO_PASSWORD, PRESTO_CATALOG, PRESTO_SCHEMA, PRESTO_TLS, PRESTO_TLS_VERIFY
    global USE_IAM_AUTH, IBM_CLOUD_API_KEY
    global VECTOR_STORE, ASTRA_TOKEN, ASTRA_API_ENDPOINT, ASTRA_KEYSPACE, ASTRA_TABLE
    PRESTO_HOST = os.getenv("PRESTO_HOST", "localhost")
    PRESTO_PORT = int(os.getenv("PRESTO_PORT", "8443"))
    PRESTO_USER = os.getenv("PRESTO_USER", "ibmlhadmin")
    PRESTO_PASSWORD = os.getenv("PRESTO_PASSWORD", "")
    PRESTO_CATALOG = os.getenv("PRESTO_CATALOG", "system")
    PRESTO_SCHEMA = os.getenv("PRESTO_SCHEMA", "runtime")
    PRESTO_TLS = os.getenv("PRESTO_TLS", "true").lower() == "true"
    PRESTO_TLS_VERIFY = os.getenv("PRESTO_TLS_VERIFY", "false").lower() == "true"
    USE_IAM_AUTH = os.getenv("USE_IAM_AUTH", "false").lower() == "true"
    IBM_CLOUD_API_KEY = os.getenv("IBM_CLOUD_API_KEY", "")
    VECTOR_STORE = os.getenv("VECTOR_STORE", "hcd").lower()
    ASTRA_TOKEN = os.getenv("ASTRA_TOKEN", "")
    ASTRA_API_ENDPOINT = os.getenv("ASTRA_API_ENDPOINT", "")
    ASTRA_KEYSPACE = os.getenv("ASTRA_RUNBOOKS_KEYSPACE", "runbooks")
    ASTRA_TABLE = os.getenv("ASTRA_RUNBOOKS_TABLE", "runbooks_table")
    print(f"[server] vector_store backend: {VECTOR_STORE}", file=sys.stderr)

    if args.self_test:
        raise SystemExit(await _self_test())

    if args.transport == "stdio":
        # Cursor MCP integration commonly uses stdio transport.
        async with stdio_server() as (read_stream, write_stream):
            await app.run(read_stream, write_stream, app.create_initialization_options())
        return

    # SSE transport (useful for manual testing)
    import uvicorn

    print(f"Starting watsonx.data Presto MCP Server (SSE) on {args.host}:{args.port}")
    print(f"SSE endpoint: http://{args.host}:{args.port}/sse")
    print(f"Presto connection: {PRESTO_HOST}:{PRESTO_PORT} (tls={PRESTO_TLS}, verify={PRESTO_TLS_VERIFY})")

    config = uvicorn.Config(starlette_app, host=args.host, port=args.port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())

# Made with Bob
