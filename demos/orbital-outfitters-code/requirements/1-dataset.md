# Dataset Generation Requirements

## Overview
This task builds the database dataset layer for the Orbital Suppliers demo website under [`backend/db/`](backend/db/). The implementation must provision the Postgres schema named in [`DB_SCHEMA`](.env), create all required tables, load the provided CSV seed data, and generate additional synthetic commerce data needed by the UI and backend flows.

The dataset must support:
- authentication against imported users using a deterministic [`password_hash`](requirements/1-dataset.md)
- product listing and product detail pages backed by imported products and reviews
- logged-in cart functionality with one active cart per user
- order history pages populated with realistic generated orders and order items
- checkout-related totals that use free shipping and a fixed 7.98% tax rate

All implementation files for this work must be created under [`backend/db/`](backend/db/).

## Environment variables
The dataset generation script must read the following variables from [`.env`](.env):

| Variable | Required | Purpose |
|---|---|---|
| `DB_HOST` | yes | Postgres hostname used by [`psycopg2.connect()`](requirements/1-dataset.md) |
| `DB_PORT` | yes | Postgres port used by [`psycopg2.connect()`](requirements/1-dataset.md) |
| `DB_NAME` | yes | Database name |
| `DB_USER` | yes | Database username |
| `DB_PASSWORD` | yes | Database password |
| `DB_SSL` | yes | SSL mode selector. Treat the current value `true` as a requirement to connect with `sslmode='require'`. |
| `DB_SCHEMA` | yes | Target schema to create and populate. Current value is `ai_retail_83032671`. |
| `PASSWORD_HASH_SECRET` | yes | HMAC secret used to generate [`users.password_hash`](requirements/1-dataset.md) |
| `USER_PASSWORD` | yes | Shared demo password combined with normalized email when generating [`users.password_hash`](requirements/1-dataset.md) |

No other [`.env`](.env) values are consumed by the dataset generation work.

## Database schema
The final schema must contain these seven tables in the schema named by [`DB_SCHEMA`](.env):
- [`users`](requirements/1-dataset.md)
- [`products`](requirements/1-dataset.md)
- [`product_reviews`](requirements/1-dataset.md)
- [`orders`](requirements/1-dataset.md)
- [`order_items`](requirements/1-dataset.md)
- [`cart`](requirements/1-dataset.md)
- [`cart_items`](requirements/1-dataset.md)

The draft schema is the minimum baseline. Additional fields below are required to support the design comps and predictable backend behavior, especially rating summaries, cart math, order timestamps, and product/listing metadata.

### DDL
```sql
CREATE SCHEMA IF NOT EXISTS ai_retail_83032671;

CREATE TABLE IF NOT EXISTS ai_retail_83032671.users (
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100),
    area_code CHAR(3),
    phone VARCHAR(20),
    address_1 VARCHAR(255),
    address_2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    password_hash VARCHAR(64) NOT NULL,
    email_opt_in BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_retail_83032671.products (
    product_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    width_inches NUMERIC(10,2) NOT NULL,
    height_inches NUMERIC(10,2) NOT NULL,
    depth_inches NUMERIC(10,2) NOT NULL,
    weight_lbs NUMERIC(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    shipping_days INTEGER NOT NULL,
    feature1 TEXT,
    feature2 TEXT,
    feature3 TEXT,
    feature4 TEXT,
    in_stock BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    inventory_quantity INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_retail_83032671.product_reviews (
    id INTEGER PRIMARY KEY,
    product_id VARCHAR(32) NOT NULL REFERENCES ai_retail_83032671.products(product_id),
    review TEXT NOT NULL,
    score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    reviewer_initials CHAR(2),
    user_id INTEGER REFERENCES ai_retail_83032671.users(user_id),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_retail_83032671.cart (
    cart_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES ai_retail_83032671.users(user_id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    item_count INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0798,
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_retail_83032671.cart_items (
    cart_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cart_id INTEGER NOT NULL REFERENCES ai_retail_83032671.cart(cart_id) ON DELETE CASCADE,
    product_id VARCHAR(32) NOT NULL REFERENCES ai_retail_83032671.products(product_id),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10,2),
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS ai_retail_83032671.orders (
    order_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES ai_retail_83032671.users(user_id),
    status VARCHAR(20) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0798,
    tax_amount NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    shipping_address_1 VARCHAR(255) NOT NULL,
    shipping_address_2 VARCHAR(255),
    shipping_city VARCHAR(100) NOT NULL,
    shipping_state VARCHAR(50) NOT NULL,
    shipping_zip VARCHAR(20) NOT NULL,
    placed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_retail_83032671.order_items (
    order_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES ai_retail_83032671.orders(order_id) ON DELETE CASCADE,
    product_id VARCHAR(32) NOT NULL REFERENCES ai_retail_83032671.products(product_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    line_total NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Required schema notes
- Map CSV columns [`feature_1`..`feature_4`](specifications/data/products.csv:1) into database columns `feature1`..`feature4` exactly as required by the draft schema.
- Store money values with two decimal places using `NUMERIC(10,2)`.
- Keep [`product_reviews.id`](specifications/data/product-reviews.csv:1) aligned to the source CSV values instead of generating new ids.
- Add [`average_rating`](requirements/1-dataset.md) and [`review_count`](requirements/1-dataset.md) to [`products`](requirements/1-dataset.md) because product cards and product detail pages commonly need summary review data without recalculating it on every request.
- Add cart/order rollup fields [`item_count`](requirements/1-dataset.md), [`subtotal`](requirements/1-dataset.md), [`tax_amount`](requirements/1-dataset.md), and [`total_amount`](requirements/1-dataset.md) so the UI can render complete summaries directly.
- Add [`placed_at`](requirements/1-dataset.md) to [`orders`](requirements/1-dataset.md) to represent customer-facing order time separately from generic audit timestamps.
- Create one [`cart`](requirements/1-dataset.md) row for every imported user so the logged-in cart flow always has a backing record.

## Data generation steps
Create a Python script under [`backend/db/`](backend/db/) that performs the following steps in order.

### 1. Load configuration and connect to Postgres
- Use Python 3 and [`psycopg2`](requirements/1-dataset.md).
- Read [`.env`](.env) values before opening the database connection.
- Build the connection with:
  - `host=DB_HOST`
  - `port=DB_PORT`
  - `dbname=DB_NAME`
  - `user=DB_USER`
  - `password=DB_PASSWORD`
  - `sslmode='require'` when `DB_SSL` is `require` or `true`
- Disable autocommit until all schema creation and data loading steps succeed, then commit once at the end.

### 2. Create the target schema
- Execute `CREATE SCHEMA IF NOT EXISTS <DB_SCHEMA>`.
- Set the session search path to the target schema plus `public`, or fully qualify every table reference.
- Do not drop or modify other schemas.

### 3. Create all tables
- Execute the DDL in the order: [`users`](requirements/1-dataset.md), [`products`](requirements/1-dataset.md), [`product_reviews`](requirements/1-dataset.md), [`cart`](requirements/1-dataset.md), [`cart_items`](requirements/1-dataset.md), [`orders`](requirements/1-dataset.md), [`order_items`](requirements/1-dataset.md).
- The script may use `CREATE TABLE IF NOT EXISTS` but the requirements assume a new empty schema.
- After table creation, create indexes that materially support the app:
  - `users(email)` unique constraint already covers login lookup
  - index `products(category)`
  - index `product_reviews(product_id)`
  - index `orders(user_id, placed_at DESC)`
  - index `order_items(order_id)`
  - index `cart_items(cart_id)`

### 4. Import users from CSV
Source file: [`specifications/data/users.csv`](specifications/data/users.csv)

Processing rules:
- Parse the header row and import all rows.
- Normalize `email` with `lower().strip()` before storage.
- Treat CSV value `NULL` as SQL `NULL` for [`address_2`](specifications/data/users.csv:2).
- Set `username` to the portion of normalized email before `@`.
- Generate [`password_hash`](requirements/1-dataset.md) with:

```python
hmac.new(
    PASSWORD_HASH_SECRET.encode(),
    (email.lower().strip() + "_" + USER_PASSWORD).encode(),
    hashlib.sha256,
).hexdigest()
```

- Set `email_opt_in=false` for all imported users unless a source file later provides a value.
- Set `created_at` and `updated_at` to the script execution timestamp.
- Insert one active [`cart`](requirements/1-dataset.md) row for each inserted user immediately after user import.

### 5. Import products from CSV
Source file: [`specifications/data/products.csv`](specifications/data/products.csv)

Processing rules:
- Parse and insert every source row.
- Map source columns `feature_1`..`feature_4` to target columns `feature1`..`feature4`.
- Convert `width_inches`, `height_inches`, `depth_inches`, `weight_lbs`, and `price` to numeric values.
- Convert `in_stock` from CSV text (`TRUE`/`FALSE`) to boolean.
- Set `is_active=true` for all imported products.
- Set `currency='USD'` for all imported products.
- Set `inventory_quantity` deterministically to a realistic in-stock number, for example a random integer in `[25, 250]` when `in_stock=true`, otherwise `0`.
- Initialize `average_rating=0`, `review_count=0`, `created_at=now`, and `updated_at=now` before reviews are loaded.

### 6. Import product reviews from CSV
Source file: [`specifications/data/product-reviews.csv`](specifications/data/product-reviews.csv)

Processing rules:
- Parse and insert every source row preserving source `id`.
- Leave `user_id=NULL` because the review CSV does not map reviews to known users.
- Derive `reviewer_initials` from a deterministic rule so the field is populated for display. Use the first two alphabetic characters from the review text after stripping punctuation and uppercase them; if fewer than two characters exist, store `NULL`.
- Generate `created_at` values with realistic spread across the previous 365 days.
- Set `updated_at=created_at`.
- After all reviews load, update each row in [`products`](requirements/1-dataset.md) with:
  - `review_count = COUNT(product_reviews.id)`
  - `average_rating = ROUND(AVG(product_reviews.score), 2)`

### 7. Generate orders and order items
Generated data must create realistic purchase history for every imported user.

Rules:
- Generate between 3 and 5 orders per user.
- For each order, choose between 1 and 5 distinct products.
- For each selected product, generate `quantity` between 1 and 3.
- Use the imported [`products.price`](requirements/1-dataset.md) as [`order_items.unit_price`](requirements/1-dataset.md).
- Compute `line_total = ROUND(quantity * unit_price, 2)`.
- Compute `subtotal = SUM(line_total)`.
- Use `tax_rate = 0.0798` for every order.
- Compute `tax_amount = ROUND(subtotal * tax_rate, 2)`.
- Set `shipping_cost = 0.00` for every order.
- Compute `total_amount = subtotal + tax_amount + shipping_cost`.
- Set `item_count = SUM(quantity)`.
- Copy shipping address fields from the owning user row.
- Generate realistic timestamps distributed over the previous 18 months, with more recent dates slightly more common than older ones.
- Set [`orders.created_at`](requirements/1-dataset.md) equal to [`placed_at`](requirements/1-dataset.md), and [`updated_at`](requirements/1-dataset.md) equal to [`placed_at`](requirements/1-dataset.md).
- Use realistic statuses such as `delivered`, `processing`, and `shipped`; bias older orders toward `delivered` and very recent orders toward `processing` or `shipped`.
- Generate unique order numbers in the format `ORD-YYYYMMDD-XXXX`, where:
  - `YYYYMMDD` comes from [`placed_at`](requirements/1-dataset.md)
  - `XXXX` is a zero-padded 4-digit random number
  - if a generated number collides, regenerate until unique within the schema

### 8. Finalize cart state
- Leave all carts in `status='active'`.
- Keep [`cart_items`](requirements/1-dataset.md) empty unless future requirements explicitly ask for seeded cart contents.
- Ensure each cart summary remains zeroed:
  - `item_count=0`
  - `subtotal=0.00`
  - `tax_amount=0.00`
  - `shipping_cost=0.00`
  - `total_amount=0.00`

### 9. Commit transaction
- Commit only after all inserts and generated updates succeed.
- On failure, rollback the transaction so the schema is not partially populated.
- Close cursor and connection cleanly.

## File locations
All dataset-generation implementation files must live under [`backend/db/`](backend/db/). At minimum the work should include:
- a Python loader/generator script, for example [`backend/db/generate_dataset.py`](backend/db/generate_dataset.py)
- optional SQL helper files under [`backend/db/`](backend/db/) if the implementer prefers to separate DDL from Python logic
- any short execution notes or README for this work under [`backend/db/`](backend/db/)

Do not place dataset generation code under other directories.

## Validation
The implementation is complete only when the developer can verify the following against the target schema.

### Script execution validation
- Install the dependency in the shared virtual environment and run the generator from the repository root.
- The script exits successfully without uncaught exceptions.
- The target schema [`ai_retail_83032671`](.env) exists after execution.

### Data validation queries
Run these checks against [`DB_SCHEMA`](.env):

```sql
SELECT COUNT(*) AS user_count FROM ai_retail_83032671.users;
SELECT COUNT(*) AS product_count FROM ai_retail_83032671.products;
SELECT COUNT(*) AS review_count FROM ai_retail_83032671.product_reviews;
SELECT COUNT(*) AS cart_count FROM ai_retail_83032671.cart;
SELECT COUNT(*) AS order_count FROM ai_retail_83032671.orders;
SELECT COUNT(*) AS order_item_count FROM ai_retail_83032671.order_items;
```

Expected outcomes:
- `user_count` equals the number of data rows in [`users.csv`](specifications/data/users.csv)
- `product_count` equals the number of data rows in [`products.csv`](specifications/data/products.csv)
- `review_count` equals the number of data rows in [`product-reviews.csv`](specifications/data/product-reviews.csv)
- `cart_count = user_count`
- `order_count` is between `3 * user_count` and `5 * user_count`
- every order has between 1 and 5 corresponding [`order_items`](requirements/1-dataset.md)

### Integrity validation queries
```sql
SELECT COUNT(*) FROM ai_retail_83032671.users WHERE password_hash IS NULL OR password_hash = '';
SELECT COUNT(*) FROM ai_retail_83032671.orders WHERE shipping_cost <> 0.00 OR tax_rate <> 0.0798;
SELECT COUNT(*) FROM ai_retail_83032671.order_items WHERE line_total <> ROUND(quantity * unit_price, 2);
SELECT COUNT(*) FROM ai_retail_83032671.products WHERE review_count < 0 OR average_rating < 0 OR average_rating > 5;
SELECT COUNT(*) FROM ai_retail_83032671.cart WHERE status <> 'active';
```

All validation queries above must return `0` except the row-count queries.

## Dependencies
Install the required Python dependency into the shared [`venv/`](venv/) environment:

```bash
source venv/bin/activate
pip install psycopg2-binary
```

The dataset generation implementation must use [`psycopg2-binary`](requirements/1-dataset.md) for the Postgres connection.