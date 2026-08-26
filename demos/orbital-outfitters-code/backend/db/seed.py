"""
Orbital Suppliers — database seed script.

Usage:
    venv/bin/python backend/db/seed.py

Reads .env from the repository root, provisions the target schema, creates all
tables, imports CSV data, and generates synthetic orders.  The entire operation
runs inside a single transaction that is committed only when every step
succeeds; any error triggers a full rollback.
"""

import csv
import hashlib
import hmac
import os
import random
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# ── 0. Configuration ──────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

DB_HOST = os.environ["DB_HOST"]
DB_PORT = os.environ["DB_PORT"]
DB_NAME = os.environ["DB_NAME"]
DB_USER = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]
DB_SSL = os.environ.get("DB_SSL", "false").lower() in ("true", "require")
DB_SCHEMA = os.environ["DB_SCHEMA"]
PASSWORD_HASH_SECRET = os.environ["PASSWORD_HASH_SECRET"]
USER_PASSWORD = os.environ["USER_PASSWORD"]

DATA_DIR = ROOT / "specifications" / "data"

TAX_RATE = 0.0798
RANDOM_SEED = 42  # deterministic inventory quantities and review dates
random.seed(RANDOM_SEED)


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
    conn.autocommit = False
    return conn


def _password_hash(email: str) -> str:
    text = email.lower().strip() + "_" + USER_PASSWORD
    return hmac.new(
        PASSWORD_HASH_SECRET.encode(),
        text.encode(),
        hashlib.sha256,
    ).hexdigest()


def _reviewer_initials(review_text: str):
    """First two uppercase alphabetic characters from the review text."""
    letters = re.sub(r"[^a-zA-Z]", "", review_text)
    if len(letters) < 2:
        return None
    return letters[:2].upper()


def _spread_date(days_back_max: int, *, skew_recent: bool = False) -> datetime:
    """Random UTC datetime within the last *days_back_max* days."""
    if skew_recent:
        # square-root skew: smaller values (more recent) are more common
        x = random.random()
        days_ago = int((1 - x ** 0.5) * days_back_max)
    else:
        days_ago = random.randint(0, days_back_max)
    seconds_ago = days_ago * 86400 + random.randint(0, 86399)
    return datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)


def _order_status(placed_at: datetime) -> str:
    """Bias older orders toward 'delivered', recent toward 'processing'/'shipped'."""
    age_days = (datetime.now(timezone.utc) - placed_at).days
    if age_days > 30:
        return "delivered"
    if age_days > 7:
        return "shipped"
    return "processing"


# ── DDL ───────────────────────────────────────────────────────────────────────

DDL = f"""
CREATE SCHEMA IF NOT EXISTS {DB_SCHEMA};

CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.users (
    user_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    username      VARCHAR(100),
    area_code     CHAR(3),
    phone         VARCHAR(20),
    address_1     VARCHAR(255),
    address_2     VARCHAR(255),
    city          VARCHAR(100),
    state         VARCHAR(50),
    zip_code      VARCHAR(20),
    password_hash VARCHAR(64) NOT NULL,
    email_opt_in  BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.products (
    product_id         VARCHAR(32) PRIMARY KEY,
    name               VARCHAR(255) NOT NULL,
    description        TEXT NOT NULL,
    image_url          TEXT NOT NULL,
    width_inches       NUMERIC(10,2) NOT NULL,
    height_inches      NUMERIC(10,2) NOT NULL,
    depth_inches       NUMERIC(10,2) NOT NULL,
    weight_lbs         NUMERIC(10,2) NOT NULL,
    category           VARCHAR(100) NOT NULL,
    price              NUMERIC(10,2) NOT NULL,
    shipping_days      INTEGER NOT NULL,
    feature1           TEXT,
    feature2           TEXT,
    feature3           TEXT,
    feature4           TEXT,
    in_stock           BOOLEAN NOT NULL DEFAULT true,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    currency           VARCHAR(3) NOT NULL DEFAULT 'USD',
    inventory_quantity INTEGER NOT NULL DEFAULT 0,
    average_rating     NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    review_count       INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.product_reviews (
    id                 INTEGER PRIMARY KEY,
    product_id         VARCHAR(32) NOT NULL REFERENCES {DB_SCHEMA}.products(product_id),
    review             TEXT NOT NULL,
    score              SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    reviewer_initials  CHAR(2),
    user_id            INTEGER REFERENCES {DB_SCHEMA}.users(user_id),
    created_at         TIMESTAMPTZ,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.cart (
    cart_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       INTEGER NOT NULL UNIQUE REFERENCES {DB_SCHEMA}.users(user_id),
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    item_count    INTEGER NOT NULL DEFAULT 0,
    subtotal      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax_rate      NUMERIC(6,4) NOT NULL DEFAULT 0.0798,
    tax_amount    NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.cart_items (
    cart_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cart_id      INTEGER NOT NULL REFERENCES {DB_SCHEMA}.cart(cart_id) ON DELETE CASCADE,
    product_id   VARCHAR(32) NOT NULL REFERENCES {DB_SCHEMA}.products(product_id),
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price   NUMERIC(10,2),
    line_total   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.orders (
    order_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number       VARCHAR(20) NOT NULL UNIQUE,
    user_id            INTEGER NOT NULL REFERENCES {DB_SCHEMA}.users(user_id),
    status             VARCHAR(20) NOT NULL,
    subtotal           NUMERIC(10,2) NOT NULL,
    shipping_cost      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax_rate           NUMERIC(6,4) NOT NULL DEFAULT 0.0798,
    tax_amount         NUMERIC(10,2) NOT NULL,
    total_amount       NUMERIC(10,2) NOT NULL,
    item_count         INTEGER NOT NULL DEFAULT 0,
    shipping_address_1 VARCHAR(255) NOT NULL,
    shipping_address_2 VARCHAR(255),
    shipping_city      VARCHAR(100) NOT NULL,
    shipping_state     VARCHAR(50) NOT NULL,
    shipping_zip       VARCHAR(20) NOT NULL,
    placed_at          TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.order_items (
    order_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES {DB_SCHEMA}.orders(order_id) ON DELETE CASCADE,
    product_id    VARCHAR(32) NOT NULL REFERENCES {DB_SCHEMA}.products(product_id),
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(10,2) NOT NULL,
    line_total    NUMERIC(10,2),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

INDEXES = [
    f"CREATE INDEX IF NOT EXISTS idx_products_category ON {DB_SCHEMA}.products (category)",
    f"CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON {DB_SCHEMA}.product_reviews (product_id)",
    f"CREATE INDEX IF NOT EXISTS idx_orders_user_placed ON {DB_SCHEMA}.orders (user_id, placed_at DESC)",
    f"CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON {DB_SCHEMA}.order_items (order_id)",
    f"CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON {DB_SCHEMA}.cart_items (cart_id)",
]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    now = datetime.now(timezone.utc)
    conn = _connect()
    cur = conn.cursor()

    try:
        # ── Set search path ───────────────────────────────────────────────────
        cur.execute(f"SET search_path TO {DB_SCHEMA}, public")

        # ── 1. Schema + tables ────────────────────────────────────────────────
        print("Creating schema and tables…")
        # psycopg2 requires one statement per execute(); split on ";"
        for stmt in DDL.split(";"):
            stmt = stmt.strip()
            if stmt:
                cur.execute(stmt)
        for stmt in INDEXES:
            cur.execute(stmt)
        print("  ✓ schema and tables ready")

        # ── 2. Users ──────────────────────────────────────────────────────────
        print("Importing users…")
        user_rows = []  # [(user_id, address fields…), …] populated after insert
        with open(DATA_DIR / "users.csv", newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                email = row["email"].lower().strip()
                username = email.split("@")[0]
                address_2 = None if row["address_2"].strip().upper() == "NULL" else row["address_2"].strip()
                pw_hash = _password_hash(email)
                cur.execute(
                    f"""
                    INSERT INTO {DB_SCHEMA}.users
                        (first_name, last_name, email, username, area_code, phone,
                         address_1, address_2, city, state, zip_code,
                         password_hash, email_opt_in, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (email) DO NOTHING
                    """,
                    (
                        row["first_name"].strip(),
                        row["last_name"].strip(),
                        email,
                        username,
                        row["area_code"].strip() or None,
                        row["phone"].strip() or None,
                        row["address_1"].strip() or None,
                        address_2,
                        row["city"].strip() or None,
                        row["state"].strip() or None,
                        row["zip_code"].strip() or None,
                        pw_hash,
                        False,
                        now,
                        now,
                    ),
                )

        # Fetch all users (handles re-runs where ON CONFLICT skipped rows)
        cur.execute(
            f"""
            SELECT user_id, address_1, address_2, city, state, zip_code
            FROM {DB_SCHEMA}.users
            ORDER BY user_id
            """
        )
        user_rows = cur.fetchall()
        print(f"  ✓ {len(user_rows)} users")

        # ── 3. Carts (one per user) ───────────────────────────────────────────
        print("Creating carts…")
        for (uid, *_) in user_rows:
            cur.execute(
                f"""
                INSERT INTO {DB_SCHEMA}.cart (user_id, status, created_at, updated_at)
                VALUES (%s, 'active', %s, %s)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (uid, now, now),
            )
        print(f"  ✓ carts seeded")

        # ── 4. Products ───────────────────────────────────────────────────────
        print("Importing products…")
        product_ids = []
        product_prices = {}  # product_id → Decimal price
        with open(DATA_DIR / "products.csv", newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                in_stock = row["in_stock"].strip().upper() == "TRUE"
                inventory = random.randint(25, 250) if in_stock else 0
                cur.execute(
                    f"""
                    INSERT INTO {DB_SCHEMA}.products
                        (product_id, name, description, image_url,
                         width_inches, height_inches, depth_inches, weight_lbs,
                         category, price, shipping_days,
                         feature1, feature2, feature3, feature4,
                         in_stock, is_active, currency, inventory_quantity,
                         average_rating, review_count, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (product_id) DO NOTHING
                    """,
                    (
                        row["product_id"].strip(),
                        row["name"].strip(),
                        row["description"].strip(),
                        row["image_url"].strip(),
                        float(row["width_inches"]),
                        float(row["height_inches"]),
                        float(row["depth_inches"]),
                        float(row["weight_lbs"]),
                        row["category"].strip(),
                        float(row["price"]),
                        int(row["shipping_days"]),
                        row["feature_1"].strip() or None,
                        row["feature_2"].strip() or None,
                        row["feature_3"].strip() or None,
                        row["feature_4"].strip() or None,
                        in_stock,
                        True,
                        "USD",
                        inventory,
                        0.00,
                        0,
                        now,
                        now,
                    ),
                )
                pid = row["product_id"].strip()
                product_ids.append(pid)
                product_prices[pid] = float(row["price"])

        # Ensure product_ids and prices cover any pre-existing rows too
        cur.execute(f"SELECT product_id, price FROM {DB_SCHEMA}.products")
        for pid, price in cur.fetchall():
            if pid not in product_prices:
                product_ids.append(pid)
                product_prices[pid] = float(price)

        print(f"  ✓ {len(product_ids)} products")

        # ── 5. Product reviews ────────────────────────────────────────────────
        print("Importing product reviews…")
        review_count = 0
        with open(DATA_DIR / "product-reviews.csv", newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                created = _spread_date(365)
                initials = _reviewer_initials(row["review"])
                cur.execute(
                    f"""
                    INSERT INTO {DB_SCHEMA}.product_reviews
                        (id, product_id, review, score,
                         reviewer_initials, user_id, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        int(row["id"]),
                        row["product_id"].strip(),
                        row["review"].strip(),
                        int(row["score"]),
                        initials,
                        None,
                        created,
                        created,
                    ),
                )
                review_count += 1

        print(f"  ✓ {review_count} reviews")

        # ── 6. Update product rating summaries ────────────────────────────────
        print("Updating product rating summaries…")
        cur.execute(
            f"""
            UPDATE {DB_SCHEMA}.products p
            SET review_count   = sub.cnt,
                average_rating = sub.avg_score,
                updated_at     = now()
            FROM (
                SELECT product_id,
                       COUNT(*)                    AS cnt,
                       ROUND(AVG(score)::NUMERIC, 2) AS avg_score
                FROM {DB_SCHEMA}.product_reviews
                GROUP BY product_id
            ) sub
            WHERE p.product_id = sub.product_id
            """
        )
        print("  ✓ rating summaries updated")

        # ── 7. Orders + order items ───────────────────────────────────────────
        print("Generating orders…")
        used_order_numbers: set[str] = set()

        # Fetch any order numbers already in DB (idempotent re-run guard)
        cur.execute(f"SELECT order_number FROM {DB_SCHEMA}.orders")
        for (on,) in cur.fetchall():
            used_order_numbers.add(on)

        order_count = 0
        order_item_count = 0

        for user_id, addr1, addr2, city, state, zip_code in user_rows:
            n_orders = random.randint(3, 5)
            for _ in range(n_orders):
                placed_at = _spread_date(548, skew_recent=True)  # ~18 months

                # Unique order number
                while True:
                    suffix = str(random.randint(0, 9999)).zfill(4)
                    order_num = f"ORD-{placed_at.strftime('%Y%m%d')}-{suffix}"
                    if order_num not in used_order_numbers:
                        used_order_numbers.add(order_num)
                        break

                status = _order_status(placed_at)

                # Pick 1–5 distinct products
                n_products = random.randint(1, 5)
                chosen = random.sample(product_ids, min(n_products, len(product_ids)))

                items = []  # (product_id, quantity, unit_price, line_total)
                for pid in chosen:
                    qty = random.randint(1, 3)
                    unit_price = product_prices[pid]
                    line_total = round(qty * unit_price, 2)
                    items.append((pid, qty, unit_price, line_total))

                subtotal = round(sum(i[3] for i in items), 2)
                tax_amount = round(subtotal * TAX_RATE, 2)
                total_amount = round(subtotal + tax_amount, 2)
                item_count = sum(i[1] for i in items)

                cur.execute(
                    f"""
                    INSERT INTO {DB_SCHEMA}.orders
                        (order_number, user_id, status,
                         subtotal, shipping_cost, tax_rate, tax_amount, total_amount,
                         item_count,
                         shipping_address_1, shipping_address_2,
                         shipping_city, shipping_state, shipping_zip,
                         placed_at, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (order_number) DO NOTHING
                    RETURNING order_id
                    """,
                    (
                        order_num,
                        user_id,
                        status,
                        subtotal,
                        0.00,
                        TAX_RATE,
                        tax_amount,
                        total_amount,
                        item_count,
                        addr1,
                        addr2,
                        city,
                        state,
                        zip_code,
                        placed_at,
                        placed_at,
                        placed_at,
                    ),
                )
                row = cur.fetchone()
                if row is None:
                    continue  # skipped by ON CONFLICT
                order_id = row[0]
                order_count += 1

                for pid, qty, unit_price, line_total in items:
                    cur.execute(
                        f"""
                        INSERT INTO {DB_SCHEMA}.order_items
                            (order_id, product_id, quantity, unit_price, line_total)
                        VALUES (%s,%s,%s,%s,%s)
                        """,
                        (order_id, pid, qty, unit_price, line_total),
                    )
                    order_item_count += 1

        print(f"  ✓ {order_count} orders, {order_item_count} order items")

        # ── 8. Commit ─────────────────────────────────────────────────────────
        conn.commit()
        print("\nAll done — transaction committed.")

    except Exception:
        conn.rollback()
        print("\nERROR — transaction rolled back.")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
