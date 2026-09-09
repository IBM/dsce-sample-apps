"""
setup_databricks.py — Seed the local 'databricks' Iceberg namespace

In OSS local mode, the Trino 'databricks' catalog points to the local iceberg-rest
REST catalog with warehouse=s3://biw-lakehouse/databricks.

This script creates the 'databricks.seller_history' table and seeds it with
synthetic Delta-shaped data (SEED=20260812).  Run this once after 'docker compose up'.

Usage:
    python streaming/setup_databricks.py
"""
from __future__ import annotations
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    COS_ENDPOINT,
    COS_REGION,
    ICEBERG_REST_URI,
    OBJ_ACCESS_KEY,
    OBJ_BUCKET,
    OBJ_ENDPOINT,
    OBJ_SECRET_KEY,
)


def seed_databricks_namespace() -> int:
    """Seed the local Databricks-mirroring Iceberg namespace. Returns row count."""
    try:
        from pyiceberg.catalog import load_catalog
        from pyiceberg.schema import Schema
        from pyiceberg.types import NestedField, StringType
        import pyarrow as pa
    except ImportError as exc:
        print(f"[setup_databricks] missing package: {exc}")
        return 0

    catalog_props = {
        "type": "rest",
        "uri": ICEBERG_REST_URI,
        "warehouse": f"s3://{OBJ_BUCKET}/databricks",
        "s3.endpoint": OBJ_ENDPOINT,
        "s3.access-key-id": OBJ_ACCESS_KEY,
        "s3.secret-access-key": OBJ_SECRET_KEY,
        "s3.path-style-access": "true",
        "client.region": COS_REGION if COS_ENDPOINT else "us-east-1",
    }

    cat = load_catalog("databricks-local", **catalog_props)

    # Ensure namespace exists
    try:
        cat.create_namespace("databricks")
        print("[setup_databricks] Created namespace 'databricks'")
    except Exception:
        pass  # already exists

    # Schema for synthetic Delta-shaped seller history
    schema = Schema(
        NestedField(1, "seller_id", StringType(), required=False),
        NestedField(2, "event_id", StringType(), required=False),
        NestedField(3, "event_ts", StringType(), required=False),
        NestedField(4, "source", StringType(), required=False),
        NestedField(5, "metric_name", StringType(), required=False),
        NestedField(6, "metric_value", StringType(), required=False),
        NestedField(7, "deal_velocity_90d", StringType(), required=False),
    )

    try:
        t = cat.load_table("databricks.seller_history")
        cnt = t.scan().to_arrow().num_rows
        if cnt >= 20:
            print(f"[setup_databricks] Table already seeded ({cnt} rows)")
            return cnt
    except Exception:
        t = cat.create_table(
            "databricks.seller_history",
            schema=schema,
            location=f"s3://{OBJ_BUCKET}/databricks/databricks/seller_history",
        )
        print("[setup_databricks] Created table databricks.seller_history")

    # Seed synthetic data (SEED=20260812 — byte-identical on re-run)
    rng = random.Random(20260812)
    sellers = [
        "seller-rachel-001", "seller-marcus-001", "seller-maya-001",
        "seller-priya-001", "seller-liam-001",
    ]
    rows = []
    for seller in sellers:
        for _ in range(4):
            rows.append({
                "seller_id": seller,
                "event_id": f"db-{rng.randint(10000, 99999)}",
                "event_ts": (
                    f"2026-0{rng.randint(1, 7)}-"
                    f"{rng.randint(1, 28):02d}T00:00:00Z"
                ),
                "source": "databricks_delta",
                "metric_name": rng.choice(["deals_pipeline", "crm_score", "call_volume"]),
                "metric_value": str(round(rng.uniform(0.5, 15.0), 2)),
                "deal_velocity_90d": str(rng.randint(2, 18)),
            })

    arrow_tbl = pa.table(
        {col: [r[col] for r in rows]
         for col in ["seller_id", "event_id", "event_ts", "source",
                     "metric_name", "metric_value", "deal_velocity_90d"]},
    )
    t.append(arrow_tbl)
    count = t.scan().to_arrow().num_rows
    print(f"[setup_databricks] Seeded {count} synthetic Delta rows (SEED=20260812)")
    return count


if __name__ == "__main__":
    n = seed_databricks_namespace()
    print(f"Done — {n} rows in databricks.seller_history")
