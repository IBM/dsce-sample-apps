# Data table and column names
The following data schema should be sufficient to power the Orbital Supplier's website.  Use exactly as shown while adding additional tables and columns as needed.


```markdown
| Table       | Key columns (non-exhaustive)                                              |
|-------------|---------------------------------------------------------------------------|
| Table | Column | Type | Notes |
|-------|--------|------|-------|
| **`cart`** | `cart_id` | `integer` | PK, auto |
| | `user_id` | `integer` | NOT NULL — **UNIQUE constraint: one cart per user** |
| | `status` | `varchar` | DEFAULT `'active'` |
| | `created_at`, `updated_at` | `timestamptz` | DEFAULT `now()` |
| **`cart_items`** | `cart_item_id` | `integer` | PK, auto |
| | `cart_id` | `integer` | NOT NULL |
| | `product_id` | `varchar` | NOT NULL |
| | `quantity` | `integer` | DEFAULT `1` |
| | `unit_price` | `numeric` | nullable |
| | `added_at` | `timestamptz` | DEFAULT `now()` |
| **`orders`** | `order_id` | `integer` | PK, auto |
| | `order_number` | `varchar` | **NOT NULL** — must be supplied on INSERT |
| | `user_id` | `integer` | NOT NULL |
| | `status` | `varchar` | NOT NULL |
| | `subtotal` | `numeric` | NOT NULL |
| | `shipping_cost` | `numeric` | DEFAULT `0.00` |
| | `tax_rate` | `numeric` | DEFAULT `0.0798` |
| | `tax_amount` | `numeric` | NOT NULL |
| | `total_amount` | `numeric` | NOT NULL |
| | `shipping_address_1` | `varchar` | **NOT NULL** — must be supplied on INSERT |
| | `shipping_address_2` | `varchar` | nullable |
| | `shipping_city` | `varchar` | **NOT NULL** |
| | `shipping_state` | `varchar` | **NOT NULL** |
| | `shipping_zip` | `varchar` | **NOT NULL** |
| | `created_at` | `timestamptz` | **NOT NULL** — supply `NOW()` |
| | `updated_at` | `timestamptz` | DEFAULT `now()` |
| **`order_items`** | `order_item_id` | `integer` | PK, auto |
| | `order_id` | `integer` | NOT NULL |
| | `product_id` | `varchar` | NOT NULL |
| | `quantity` | `integer` | NOT NULL |
| | `unit_price` | `numeric` | NOT NULL |
| | `line_total` | `numeric` | nullable |
| **`products`** | `product_id` | `varchar` | PK (`sprocket_###`) |
| | `name`, `description`, `image_url` | `varchar/text` | NOT NULL |
| | `width_inches`, `height_inches`, `depth_inches`, `weight_lbs` | `numeric` | NOT NULL |
| | `category` | `varchar` | NOT NULL |
| | `price` | `numeric` | NOT NULL |
| | `shipping_days` | `integer` | NOT NULL |
| | `feature1`–`feature4` | `text` | nullable — **no underscore** (not `feature_1`) |
| | `in_stock`, `is_active` | `boolean` | DEFAULT `true` |
| | `currency` | `varchar` | DEFAULT `'USD'` |
| | `inventory_quantity` | `integer` | DEFAULT `0` |
| **`product_reviews`** | `id` | `integer` | NOT NULL |
| | `product_id` | `varchar` | NOT NULL |
| | `review` | `text` | NOT NULL |
| | `score` | `smallint` | NOT NULL |
| | `reviewer_initials` | `char(2)` | nullable |
| | `user_id` | `integer` | nullable |
| | `created_at` | `timestamptz` | nullable |
| **`users`** | `user_id` | `integer` | PK, auto |
| | `first_name`, `last_name` | `varchar` | NOT NULL |
| | `email` | `varchar` | NOT NULL |
| | `username` | `varchar` | nullable |
| | `area_code` | `char` | nullable |
| | `phone` | `varchar` | nullable |
| | `address_1`–`address_2`, `city`, `state`, `zip_code` | `varchar` | nullable |
| | `password_hash` | `varchar` | NOT NULL |
| | `email_opt_in` | `boolean` | DEFAULT `false` |
| | `created_at` | `timestamptz` | DEFAULT `now()` |
```