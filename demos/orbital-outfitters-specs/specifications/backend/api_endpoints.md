# API Endpoints to Build
These are the minimal endpoints to write.  If you identify others, then build them too.

```markdown
### Auth endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/login` | — | Accept `{login, password}` where `login` is email or username. Return `{token, user}`. |
| `POST` | `/auth/logout` | — | Stateless — client discards token. |
| `GET`  | `/auth/me` | JWT | Return current user's full profile. |
| `PUT`  | `/auth/me` | JWT | Update profile fields (name, phone, address, email_opt_in, password). |

### Product endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/products` | — | List active products. Supports `?search=`, `?category=`, `?page=`, `?limit=`. |
| `GET` | `/products/:id` | — | Single product with its `reviews[]` array. |

### Cart endpoints (JWT required)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`    | `/cart` | JWT | Get the authenticated user's active cart with items and totals. Creates an empty cart if none exists. |
| `POST`   | `/cart/items` | JWT | Add `{product_id, quantity}` to cart. |
| `PUT`    | `/cart/items/:cart_item_id` | JWT | Update item quantity. |
| `DELETE` | `/cart/items/:cart_item_id` | JWT | Remove item from cart. |

### Order endpoints (JWT required)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/orders` | JWT | Checkout: convert active cart into an order. Accepts shipping address fields. Applies 7.98% tax, free shipping. Clears cart on success. |
| `GET`  | `/orders` | JWT | List the authenticated user's orders, newest first. |
| `GET`  | `/orders/:id` | JWT | Single order detail with `items[]` and product info. |

### Agent search endpoint
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/agentSearch` | — | Natural-language product search. Embeds query with `Xenova/all-MiniLM-L6-v2`, queries ChromaDB top-4, passes results to the `product_search` agent in watsonx Orchestrate. Returns `{agent_response, products[]}`. |
```