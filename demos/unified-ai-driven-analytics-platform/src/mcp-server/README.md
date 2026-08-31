# query-layer (MCP Server)

## Purpose

This MCP server exposes **read-only Presto tools** (e.g. `execute_select`, `list_catalogs`) and a **vector_search** tool for a local **watsonx.data Developer Edition** instance. Presto is typically accessed via `kubectl port-forward` to the coordinator in the `wxd` namespace; vector search queries **DataStax HCD** (runbooks/incidents) via CQL.

It connects to Presto using **HTTPS + Basic authentication** and is intended for **IBM Project Bob** (`.bob/mcp.json`) or **Cursor** (MCP settings) with stdio transport.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

- `PRESTO_HOST`: usually `localhost` (when using port-forward)
- `PRESTO_PORT`: usually `8443` (HTTPS)
- `PRESTO_USER`: usually `ibmlhadmin`
- `PRESTO_PASSWORD`: Presto password (for Dev Edition commonly `password`)
- `PRESTO_TLS`: `true` for HTTPS
- `PRESTO_TLS_VERIFY`: set to `false` for self-signed certs in dev
- **Vector search (optional):** `HCD_HOST`, `HCD_PORT`, `HCD_USER`, `HCD_PASSWORD` (defaults: 127.0.0.1, 9042, cassandra, cassandra). Optional: `HCD_RUNBOOKS_KEYSPACE`, `HCD_RUNBOOKS_TABLE` (defaults: `runbooks`, `runbooks`). Used by `vector_search` to query runbooks/incidents in HCD.

### Vector search tool dependencies

The `vector_search` tool requires `cassandra-driver` and `sentence-transformers` (listed in `requirements.txt`). If you see **"No module named 'cassandra'"** when Cursor (or another client) runs the MCP server, the environment that runs the server is missing those packages. Fix:

1. Use the **same virtualenv** that runs the server (e.g. `./mcp-servers/wxd-presto-local/.venv` when started from the project root).
2. Run: `./.venv/bin/pip install cassandra-driver sentence-transformers` (or `pip install -r requirements.txt`).
3. **Python version:** `cassandra-driver` builds best on Python 3.11 or 3.12. If the venv uses Python 3.14 and the build fails, recreate the venv with Python 3.12: `python3.12 -m venv .venv` then `pip install -r requirements.txt`.
4. Restart the MCP server (e.g. reload Cursor or restart the process that runs the server).

## Create a virtual environment

From this folder (or from repo root: `cd mcp-servers/wxd-presto-local` then run the same):

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

Use **Python 3.11 or 3.12** if you need `vector_search`; `cassandra-driver` may not build on Python 3.14 (see "Vector search tool dependencies" above).

## Run a quick connectivity self-test

```bash
./.venv/bin/python server.py --self-test --dotenv ./.env
```

Expected: JSON with `"ok": true` and a list of catalogs.

## Run as an MCP server (stdio)

When the server is **added to Cursor’s MCP config**, Cursor starts it automatically (no need to run it in a terminal). Configure the server in Bob (`.bob/mcp.json`) or Cursor (MCP settings). **Cursor:** include `vector_search` in the server's `alwaysAllow` list so the assistant can use it for Q2 (runbook blending); see the main [README](../README.md) "Using Cursor" section for a full config example. For manual runs (e.g. debugging), from this folder:

```bash
./.venv/bin/python server.py --transport stdio --dotenv ./.env
```

## Demo schema (Maximize the Value of Enterprise Data)

When answering questions about **order O-10452** or the demo storyline, use these catalogs and tables. **Do not use `sample_data.gosales`** — that is a different sample dataset (Go Sales); demo orders live in `postgres.ops`.

| Data | Catalog | Schema | Tables |
|------|---------|--------|--------|
| Orders, items, customers, warehouses | `postgres` | `ops` | `orders`, `order_items`, `customers_ops`, `warehouses` |
| Shipment events, inventory, policy, customer analytics | `iceberg_data` | `curated_demo` | `shipment_events`, `inventory_daily`, `compensation_policy`, `customer_tier_ltv`, `customer_region_segment` |

- Order IDs are **varchar** (e.g. `'O-10452'`), not integer. Query: `SELECT * FROM postgres.ops.orders WHERE order_id = 'O-10452'`.
- Customer analytics (tier, LTV, region, segment) are in `iceberg_data.curated_demo` tables.

**For Bob (and other AI tools):** Each tool's description includes this schema hint so the assistant gets it when listing or calling tools. Responses from `list_catalogs` (and from `list_schemas` / `list_tables` when `sample_data` is used) also include a `demo_schema_hint` or `demo_note` pointing to `postgres.ops` and away from `sample_data.gosales`.

## Tools exposed

- `get_instance_details`
  - Returns connection info and coordinator details (derived from `system.runtime.nodes`)
- `list_catalogs`
  - Runs `SHOW CATALOGS`
- `list_schemas`
  - Runs `SHOW SCHEMAS FROM <catalog>`
- `list_tables`
  - Runs `SHOW TABLES FROM <catalog>.<schema>`
- `describe_table`
  - Runs `DESCRIBE <catalog>.<schema>.<table>`
- `execute_select`
  - Executes **read-only** queries: `SELECT`, `SHOW`, `DESCRIBE`, and `WITH` (CTE) statements
- `vector_search`
  - Searches the **HCD** vector store (runbooks, incidents) via CQL ANN. Params: `query` (string), `top_k` (optional, default 3). Returns `chunks` with `id`, `text`, `source`. Used for Q2 (next best action) to blend runbook guidance with SQL results. Requires HCD running and the runbooks table populated — see main [README](../README.md) Section F and `demo/scripts/load_runbooks_hcd.py`. Env: `HCD_HOST`, `HCD_PORT`, `HCD_USER`, `HCD_PASSWORD` (optional: `HCD_RUNBOOKS_KEYSPACE`, `HCD_RUNBOOKS_TABLE`).

## Notes / security

- This server is intentionally **read-only** (no `INSERT/UPDATE/DELETE`).
- `.env` contains credentials; don’t commit it to source control (it’s gitignored by `mcp-servers/wxd-presto-local/.gitignore`).

### Finding the Presto password (Dev Edition)

If you don’t know the password, in many Dev Edition installs it is the `LH_AUTH_PASSWORD` field in the `ibm-lh-config-secret`:

```bash
kubectl get secret -n wxd ibm-lh-config-secret -o jsonpath='{.data.LH_AUTH_PASSWORD}' | base64 -d; echo
```

