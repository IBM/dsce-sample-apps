"""
Orbital Suppliers — database validation script.

Usage:
    venv/bin/python backend/db/validate.py

Connects to the Postgres database defined in .env and prints row counts and
integrity checks for every table in the target schema.
"""

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

DB_HOST = os.environ["DB_HOST"]
DB_PORT = os.environ["DB_PORT"]
DB_NAME = os.environ["DB_NAME"]
DB_USER = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]
DB_SSL = os.environ.get("DB_SSL", "false").lower() in ("true", "require")
DB_SCHEMA = os.environ["DB_SCHEMA"]


def _connect():
    kwargs = dict(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    if DB_SSL:
        kwargs["sslmode"] = "require"
    conn = psycopg2.connect(**kwargs)
    conn.autocommit = True
    return conn


def _count(cur, table: str) -> int:
    cur.execute(f"SELECT COUNT(*) FROM {DB_SCHEMA}.{table}")
    return cur.fetchone()[0]


def _scalar(cur, sql: str) -> int:
    cur.execute(sql)
    return cur.fetchone()[0]


def main():
    conn = _connect()
    cur = conn.cursor()

    s = DB_SCHEMA

    print(f"\n{'─' * 50}")
    print(f"Schema: {s}")
    print(f"{'─' * 50}")

    # ── Row counts ────────────────────────────────────────────────────────────
    tables = ["users", "products", "product_reviews", "cart", "cart_items", "orders", "order_items"]
    print("\nRow counts:")
    counts = {}
    for t in tables:
        n = _count(cur, t)
        counts[t] = n
        print(f"  {t:<20} {n:>8,}")

    # ── Derived expectations ──────────────────────────────────────────────────
    print("\nExpectation checks:")
    user_count = counts["users"]
    order_count = counts["orders"]

    cart_ok = counts["cart"] == user_count
    print(f"  cart_count == user_count          {'✓' if cart_ok else '✗'}  ({counts['cart']} == {user_count})")

    orders_lo = 3 * user_count
    orders_hi = 5 * user_count
    orders_ok = orders_lo <= order_count <= orders_hi
    print(f"  orders in [3×, 5×] users          {'✓' if orders_ok else '✗'}  ({order_count} in [{orders_lo}, {orders_hi}])")

    # ── Integrity checks (all should be 0) ───────────────────────────────────
    print("\nIntegrity checks (all should be 0):")

    checks = [
        (
            "users with no password_hash",
            f"SELECT COUNT(*) FROM {s}.users WHERE password_hash IS NULL OR password_hash = ''",
        ),
        (
            "orders with wrong shipping_cost or tax_rate",
            f"SELECT COUNT(*) FROM {s}.orders WHERE shipping_cost <> 0.00 OR tax_rate <> 0.0798",
        ),
        (
            "order_items with wrong line_total",
            f"SELECT COUNT(*) FROM {s}.order_items WHERE line_total <> ROUND(quantity * unit_price, 2)",
        ),
        (
            "products with invalid ratings",
            f"SELECT COUNT(*) FROM {s}.products WHERE review_count < 0 OR average_rating < 0 OR average_rating > 5",
        ),
        (
            "carts not active",
            f"SELECT COUNT(*) FROM {s}.cart WHERE status <> 'active'",
        ),
        (
            "orders missing shipping address",
            f"SELECT COUNT(*) FROM {s}.orders WHERE shipping_address_1 IS NULL OR shipping_city IS NULL",
        ),
    ]

    all_ok = True
    for label, sql in checks:
        n = _scalar(cur, sql)
        ok = n == 0
        all_ok = all_ok and ok
        print(f"  {label:<42} {'✓' if ok else '✗'}  ({n})")

    print(f"\n{'─' * 50}")
    print("Overall:", "✓ PASS" if all_ok else "✗ FAIL — see checks above")
    print(f"{'─' * 50}\n")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
