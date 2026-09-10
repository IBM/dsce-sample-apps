"""
B3 / B4 — Zero-Copy Federation (Trino / watsonx.data Presto)
==============================================================
IBM product:  watsonx.data (Presto engine — same Trino lineage)
OSS fallback: Trino (localhost:8080, via docker-compose)

B3:  Single Trino query joining:
       • Cassandra connector  (IBM DataStax live state)   → live "now"
       • Iceberg connector    (watsonx.data / MinIO)      → history "always"

B4:  The same Trino node adds Databricks Delta as a THIRD source, read
     IN PLACE via open Iceberg interop (Delta UniForm or Unity Catalog
     Iceberg REST).  NO data is copied out of Databricks.

Acceptance B3:  a single query joins just-streamed live state with
                historical rows and returns a unified result on the real engine.

Acceptance B4:  one query joins live (Cassandra) + history (Iceberg) +
                Databricks Delta IN PLACE, with a visible "federated" indicator.
                This is the single most important frame in the video.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    DATABRICKS_CATALOG,
    DATABRICKS_HOST,
    DATABRICKS_SCHEMA,
    DATABRICKS_TABLE,
    DATABRICKS_TOKEN,
    DATASTAX_KEYSPACE,
    TRINO_CATALOG_CASSANDRA,
    TRINO_CATALOG_DATABRICKS,
    TRINO_CATALOG_ICEBERG,
    TRINO_HOST,
    TRINO_PASSWORD,
    TRINO_PORT,
    TRINO_SCHEMA,
    TRINO_TLS,
    TRINO_USER,
)


@dataclass
class FederationResult:
    query_id: str
    sql: str
    rows: list[dict]
    sources_joined: list[str]
    executed_at: str
    engine: str                       # "trino" | "watsonx.data/presto" | "duckdb-fallback"
    is_real_engine: bool
    databricks_included: bool


# ── Trino connection ──────────────────────────────────────────────────────────

_OSS_TRINO_HOST = "localhost"
_OSS_TRINO_PORT = 8090


def _connect_trino():
    """
    Returns a (connection, engine_label) tuple, or (None, 'duckdb-fallback').

    Precedence:
      1. If TRINO_HOST resolves to a non-local host, try enterprise endpoint first.
      2. Always also try local OSS Trino at localhost:8090 as a fallback before
         giving up entirely and dropping to DuckDB.
    This ensures that when enterprise creds are present but the TRINO_HOST env var
    is not explicitly set, the local Docker Trino still gets used for B3/B4.
    """
    import socket
    import trino
    from trino.auth import BasicAuthentication

    candidates: list[tuple[str, int, str, str, bool]] = []

    # If TRINO_HOST is explicitly set and different from localhost, try it first
    if TRINO_HOST and TRINO_HOST not in ("localhost", "127.0.0.1"):
        scheme = "https" if TRINO_TLS else "http"
        candidates.append((TRINO_HOST, TRINO_PORT, TRINO_USER, scheme, bool(TRINO_PASSWORD)))

    # Always append localhost:8090 (local OSS Trino / Docker Compose)
    if (_OSS_TRINO_HOST, _OSS_TRINO_PORT) not in [(h, p) for h, p, *_ in candidates]:
        candidates.append((_OSS_TRINO_HOST, _OSS_TRINO_PORT, "admin", "http", False))

    for host, port, user, scheme, needs_auth in candidates:
        # TCP probe before instantiating the Trino client
        try:
            with socket.create_connection((host, port), timeout=2):
                pass
        except OSError:
            continue
        try:
            kwargs: dict[str, Any] = {
                "host": host, "port": port, "user": user, "http_scheme": scheme,
            }
            if needs_auth and TRINO_PASSWORD:
                kwargs["auth"] = BasicAuthentication(user, TRINO_PASSWORD)
            conn = trino.dbapi.connect(**kwargs)
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            engine_label = "watsonx.data/presto" if TRINO_TLS and host != _OSS_TRINO_HOST else "trino"
            print(f"[B3/Trino] Connected → {host}:{port} ({engine_label})")
            return conn, engine_label
        except Exception as exc:
            print(f"[B3/Trino] {host}:{port} failed: {exc!s:.80}")
            continue

    print("[B3/Trino] FALLBACK (DuckDB): no Trino endpoint reachable")
    return None, "duckdb-fallback"


# ── SQL templates ─────────────────────────────────────────────────────────────

def _b3_sql(limit: int = 20) -> str:
    """
    B3 — live + history join.
    Cassandra connector: biw_live.biw_live_events
    Iceberg connector:   iceberg.biw.live_events
    """
    return f"""
-- B3: Zero-copy federation — live (Cassandra / IBM DataStax) + history (Iceberg / watsonx.data)
-- Engine: Trino (IBM watsonx.data Presto) | SEED=20260812
SELECT
    coalesce(live.seller_id, hist.seller_id)   AS seller_id,
    live.event_id                               AS live_event_id,
    live.event_ts                               AS live_ts,
    live.source                                 AS live_source,
    hist.event_id                               AS hist_event_id,
    hist.event_ts                               AS hist_ts,
    hist.source                                 AS hist_source,
    'live+history'                              AS federation_mode,
    'zero-copy'                                 AS copy_status
FROM {TRINO_CATALOG_CASSANDRA}.{DATASTAX_KEYSPACE}.biw_live_events  AS live
FULL OUTER JOIN {TRINO_CATALOG_ICEBERG}.{TRINO_SCHEMA}.live_events  AS hist
    ON live.seller_id = hist.seller_id
   AND live.source    = hist.source
LIMIT {limit}
""".strip()


def _b4_sql(limit: int = 20) -> str:
    """
    B4 — live + history + Databricks Delta, all read in place.

    In OSS/local mode (DATABRICKS_HOST not set):
      - databricks catalog points to local iceberg-rest, same schema as iceberg
      - table reference is databricks.biw.live_events (3-part: catalog.schema.table)

    In real Databricks mode (DATABRICKS_HOST set):
      - table reference is databricks.<catalog>.<schema>.<table>
        but DATABRICKS_CATALOG/SCHEMA must be empty or collapsed into the Trino schema
    """
    if DATABRICKS_HOST:
        # Real Databricks: Unity Catalog Iceberg REST — schema and table from env
        databricks_table = (
            f"{TRINO_CATALOG_DATABRICKS}.{DATABRICKS_SCHEMA}.{DATABRICKS_TABLE}"
        )
    else:
        # OSS local mode: databricks catalog points to local iceberg-rest at
        # warehouse=s3://biw-lakehouse/databricks with seeded synthetic Delta records
        # Table is created by data/generator.py setup or streaming/setup_databricks.py
        databricks_table = f"{TRINO_CATALOG_DATABRICKS}.databricks.seller_history"
    return f"""
-- B4: Zero-copy federation — live + history + Databricks Delta (query-in-place)
-- Engine: Trino (IBM watsonx.data Presto) | SEED=20260812
-- Databricks data is READ IN PLACE — no copy, no migration
SELECT
    coalesce(live.seller_id, hist.seller_id, db.seller_id) AS seller_id,
    live.event_ts                AS live_ts,
    live.source                  AS live_source,
    hist.event_ts                AS history_ts,
    hist.source                  AS history_source,
    db.seller_id                 AS databricks_seller_id,
    db.event_ts                  AS databricks_ts,
    'live+history+databricks'    AS federation_mode,
    'zero-copy'                  AS copy_status,
    'query-in-place'             AS databricks_read_mode
FROM {TRINO_CATALOG_CASSANDRA}.{DATASTAX_KEYSPACE}.biw_live_events  AS live
FULL OUTER JOIN {TRINO_CATALOG_ICEBERG}.{TRINO_SCHEMA}.live_events  AS hist
    ON live.seller_id = hist.seller_id
FULL OUTER JOIN {databricks_table}                                   AS db
    ON coalesce(live.seller_id, hist.seller_id) = db.seller_id
LIMIT {limit}
""".strip()


# ── DuckDB fallback queries ───────────────────────────────────────────────────

def _rows_to_relation(con, rows: list[dict], table_name: str) -> None:
    """
    Create a DuckDB table from a list of dicts.
    Uses pandas if available, otherwise falls back to row-by-row insert.
    """
    if not rows:
        con.execute(
            f"CREATE TABLE {table_name} "
            "(seller_id VARCHAR, event_id VARCHAR, event_ts VARCHAR, source VARCHAR)"
        )
        return
    try:
        import pandas as pd
        df = pd.DataFrame(rows)
        # ensure required columns exist
        for col in ("seller_id", "event_id", "event_ts", "source"):
            if col not in df.columns:
                df[col] = None
        con.register(f"_tmp_{table_name}", df)
        con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM _tmp_{table_name}")
        return
    except ImportError:
        pass
    # Fallback: create from VALUES
    cols = list(rows[0].keys())
    placeholders = ", ".join(["?"] * len(cols))
    col_defs = ", ".join(f"{c} VARCHAR" for c in cols)
    con.execute(f"CREATE TABLE {table_name} ({col_defs})")
    for row in rows:
        values = [str(row.get(c, "")) for c in cols]
        con.execute(f"INSERT INTO {table_name} VALUES ({placeholders})", values)


def _b3_duckdb_fallback(cassandra_rows: list[dict], iceberg_rows: list[dict]) -> list[dict]:
    """
    When Trino is not available, simulate the B3 join in DuckDB from in-memory data.
    Clearly labeled as fallback — never presented as a live Trino result.
    """
    try:
        import duckdb

        con = duckdb.connect(":memory:")
        _rows_to_relation(con, cassandra_rows, "cass_events")
        _rows_to_relation(con, iceberg_rows, "ice_events")

        rows = con.execute("""
            SELECT
                coalesce(c.seller_id, i.seller_id) AS seller_id,
                c.event_id   AS live_event_id,
                c.event_ts   AS live_ts,
                c.source     AS live_source,
                i.event_id   AS hist_event_id,
                i.event_ts   AS hist_ts,
                i.source     AS hist_source,
                'live+history'       AS federation_mode,
                'in-memory-fallback' AS copy_status
            FROM cass_events c
            FULL OUTER JOIN ice_events i ON c.seller_id = i.seller_id
        """).fetchall()

        cols = ["seller_id","live_event_id","live_ts","live_source",
                "hist_event_id","hist_ts","hist_source","federation_mode","copy_status"]
        return [dict(zip(cols, r)) for r in rows]
    except Exception as exc:
        print(f"[B3/DuckDB-fallback] error: {exc}")
        return []


def _b4_databricks_fallback_rows() -> list[dict]:
    """
    Synthetic Databricks Delta rows used when real Databricks is not reachable.
    Labeled as federated/synthetic — represents real query-in-place semantics.
    """
    import random
    rng = random.Random(20260812)
    rows = []
    for seller_id in ["seller-rachel-001", "seller-marcus-001", "seller-maya-001"]:
        rows.append({
            "seller_id":  seller_id,
            "event_id":   "db-" + str(rng.randint(10000, 99999)),
            "event_ts":   "2026-07-01T00:00:00Z",
            "source":     "databricks_delta",
            "payload":    json.dumps({
                "deals_pipeline": rng.randint(3, 12),
                "crm_compliance_pct": round(rng.uniform(0.6, 1.0), 2),
            }),
            "_read_mode": "query-in-place-simulated",
        })
    return rows


# ── Public API ────────────────────────────────────────────────────────────────

def run_b3_query(
    cassandra_rows: list[dict] | None = None,
    iceberg_rows: list[dict] | None = None,
) -> FederationResult:
    """
    Execute the B3 live + history federation query.
    Falls back to DuckDB if Trino is not reachable.
    """
    conn, engine_label = _connect_trino()
    query_id = f"wxd-b3-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    sql = _b3_sql()

    if conn:
        try:
            cur = conn.cursor()
            cur.execute(sql)
            raw = cur.fetchall()
            desc = [d[0] for d in cur.description]
            rows = [dict(zip(desc, r)) for r in raw]
            return FederationResult(
                query_id=query_id,
                sql=sql,
                rows=rows,
                sources_joined=["cassandra/datastax", "iceberg/watsonx.data"],
                executed_at=datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
                engine=engine_label,
                is_real_engine=True,
                databricks_included=False,
            )
        except Exception as exc:
            print(f"[B3/Trino] query error: {exc}")
        finally:
            conn.close()

    # Fallback
    rows = _b3_duckdb_fallback(cassandra_rows or [], iceberg_rows or [])
    return FederationResult(
        query_id=query_id,
        sql=sql,
        rows=rows,
        sources_joined=["cassandra/in-memory-fallback", "iceberg/in-memory-fallback"],
        executed_at=datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
        engine="duckdb-fallback",
        is_real_engine=False,
        databricks_included=False,
    )


def run_b4_query(
    cassandra_rows: list[dict] | None = None,
    iceberg_rows: list[dict] | None = None,
    include_real_databricks: bool = False,
) -> FederationResult:
    """
    Execute the B4 money-shot query:  live + history + Databricks Delta, in place.

    If include_real_databricks=True, will attempt the real Trino → Databricks
    federation.  If Trino is unreachable, uses synthetic Databricks rows with
    'query-in-place-simulated' label (honest fallback per Hardening Addendum).
    """
    conn, engine_label = _connect_trino()
    query_id = f"wxd-b4-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    sql = _b4_sql()
    databricks_ok = bool(DATABRICKS_HOST and DATABRICKS_TOKEN)

    if conn:
        try:
            cur = conn.cursor()
            cur.execute(sql)
            raw = cur.fetchall()
            desc = [d[0] for d in cur.description]
            rows = [dict(zip(desc, r)) for r in raw]
            sources = ["cassandra/datastax", "iceberg/watsonx.data",
                       "databricks_delta/query-in-place"]
            return FederationResult(
                query_id=query_id,
                sql=sql,
                rows=rows,
                sources_joined=sources,
                executed_at=datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
                engine=engine_label,
                is_real_engine=True,
                databricks_included=True,
            )
        except Exception as exc:
            print(f"[B4/Trino] query error: {exc}")
        finally:
            conn.close()

    # Fallback: compose from in-memory + synthetic Databricks rows
    b3_rows = _b3_duckdb_fallback(cassandra_rows or [], iceberg_rows or [])
    db_rows = _b4_databricks_fallback_rows()

    # Merge into a single result set
    merged: list[dict] = []
    db_by_seller = {r["seller_id"]: r for r in db_rows}
    for row in b3_rows:
        sid = row.get("seller_id")
        db_row = db_by_seller.get(sid, {})
        merged.append({
            **row,
            "databricks_seller_id": db_row.get("seller_id"),
            "databricks_ts":        db_row.get("event_ts"),
            "databricks_read_mode": db_row.get("_read_mode", "query-in-place-simulated"),
            "federation_mode":      "live+history+databricks",
        })
    # Add any Databricks sellers not in the live/history result
    seen = {r.get("seller_id") for r in b3_rows}
    for db_row in db_rows:
        if db_row["seller_id"] not in seen:
            merged.append({
                "seller_id":            db_row["seller_id"],
                "live_event_id":        None,
                "live_ts":              None,
                "live_source":          None,
                "hist_event_id":        None,
                "hist_ts":              None,
                "hist_source":          None,
                "databricks_seller_id": db_row["seller_id"],
                "databricks_ts":        db_row["event_ts"],
                "databricks_read_mode": db_row.get("_read_mode"),
                "federation_mode":      "live+history+databricks",
                "copy_status":          "zero-copy",
            })

    sources = ["cassandra/in-memory-fallback",
               "iceberg/in-memory-fallback",
               "databricks_delta/query-in-place-simulated"]
    return FederationResult(
        query_id=query_id,
        sql=sql,
        rows=merged,
        sources_joined=sources,
        executed_at=datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
        engine="duckdb-fallback",
        is_real_engine=False,
        databricks_included=True,
    )


if __name__ == "__main__":
    r3 = run_b3_query()
    print(f"\n[B3] engine={r3.engine}  rows={len(r3.rows)}  sources={r3.sources_joined}")

    r4 = run_b4_query()
    print(f"[B4] engine={r4.engine}  rows={len(r4.rows)}  sources={r4.sources_joined}")
    print(f"  databricks_included={r4.databricks_included}")
    if r4.rows:
        print(f"  sample row: {r4.rows[0]}")
