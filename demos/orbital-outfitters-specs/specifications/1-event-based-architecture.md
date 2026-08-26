# Spec: Real-Time Event Streaming with Confluent Cloud

## Goal

Add a Confluent Cloud event-streaming layer to the Orbital Suppliers application so key user, order, cart, search, and inventory activities are emitted as real-time events.

The implementation should support analytics, inventory alerts, and a live activity feed without changing the existing synchronous user flows.

This is an additive feature. Existing backend APIs, frontend flows, and deployment pipelines must continue to work when Confluent environment variables are not configured.

## Required Skill

Use the existing `data-streaming-confluent` skill for all reusable Confluent implementation details, including:

- Confluent Cloud provisioning
- Kafka topic creation
- Schema Registry configuration
- Flink SQL implementation
- Terraform patterns
- Producer and consumer implementation patterns
- Test producer scripts
- Credential handling
- Setup, test, and cleanup scripts
- Secure `.gitignore` defaults

This spec should define only the Orbital Suppliers application behavior, event contracts, integration points, and acceptance criteria. The implementation should rely on the existing skill instead of duplicating reusable Confluent guidance in this spec.

## Existing Specs Used

This spec builds on the existing Orbital Suppliers implementation:

- Dataset and PostgreSQL schema from Spec 1
- Backend APIs from Spec 3
- Frontend Home page from Spec 4
- Rancher deployment from Spec 7
- OpenShift deployment from Spec 9
- Shared environment configuration from `environments.md`

## Capabilities to Add

Add the following event-streaming capabilities:

1. Publish order events when an order is created or updated.
2. Publish cart events when items are added or removed.
3. Publish agentic search query events when users search through the agent.
4. Publish product inventory update events when inventory changes.
5. Generate inventory alerts when inventory falls below defined thresholds.
6. Add a live activity feed on the Home page using anonymized order and search events.

## Event Streams

| Topic | Purpose | Key |
|---|---|---|
| `orders` | Order created and order status updated events | `order_id` |
| `cart-events` | Cart item added and removed events | `cart_id` |
| `search-queries` | Agentic search query events | `session_id` |
| `products-stream` | Product inventory update events | `product_id` |
| `inventory-alerts` | Low-stock alerts generated from inventory events | `product_id` |

## Backend Event Sources

Emit events only after successful application actions. Event publishing must not block the HTTP response or break the existing API behavior.

| Route / Action | Topic | Event Type |
|---|---|---|
| `POST /orders` | `orders` | `ORDER_PLACED` |
| `PUT /orders/:id` | `orders` | `ORDER_UPDATED` |
| `POST /cart/items` | `cart-events` | `ITEM_ADDED` |
| `DELETE /cart/items/:id` | `cart-events` | `ITEM_REMOVED` |
| `POST /agentSearch` | `search-queries` | `SEARCH_PERFORMED` |
| Product inventory decrement | `products-stream` | `INVENTORY_UPDATED` |

## Event Contract Rules

All emitted events must follow these rules:

- Use snake_case field names.
- Use millisecond epoch timestamps.
- Include an `event_type` field.
- Include an `event_time` field.
- Do not expose full user names in events consumed by the activity feed.
- Use a pre-resolved anonymized `display_name`, such as `James S.`, or fallback to `Someone`.
- Generate a per-request `session_id` for agentic search events.

## Required Event Fields

### `orders`

Required fields:

- `order_id`
- `order_number`
- `user_id`
- `display_name`
- `status`
- `total_amount`
- `item_count`
- `event_type`
- `event_time`

### `cart-events`

Required fields:

- `cart_id`
- `user_id`
- `product_id`
- `product_name`
- `quantity`
- `event_type`
- `event_time`

### `search-queries`

Required fields:

- `session_id`
- `query`
- `result_count`
- `agent_responded`
- `event_type`
- `event_time`

### `products-stream`

Required fields:

- `product_id`
- `name`
- `category`
- `price`
- `inventory_quantity`
- `in_stock`
- `event_type`
- `event_time`

### `inventory-alerts`

Required fields:

- `product_id`
- `name`
- `category`
- `inventory_quantity`
- `alert_level`
- `alert_time`

## Inventory Alert Rules

Generate inventory alerts from `products-stream` using the following thresholds:

| Inventory Quantity | Alert Level |
|---|---|
| `0` | `OUT_OF_STOCK` |
| `1–5` | `CRITICAL` |
| `6–20` | `LOW` |

The implementation pattern for Flink SQL, tables, jobs, windowing, and deployment should come from the `data-streaming-confluent` skill.

## Cart Abandonment Rule

Detect carts that have at least one `ITEM_ADDED` event but no corresponding order completion within the configured analysis window.

The `data-streaming-confluent` skill should determine the appropriate Flink implementation pattern.

## Live Activity Feed

Add a backend activity endpoint and a Home page live activity component.

Requirements:

- Use Server-Sent Events or the standard project-approved real-time pattern.
- Show the latest five anonymized activities.
- Render nothing if Confluent is unavailable.
- Do not break the Home page if the connection fails.
- Do not require JWT because activity data is anonymized.
- Do not expose full names or sensitive user data.

Example activity text:

- `James S. just ordered 3 items`
- `Someone searched: "communication devices for hearing loss"`

## Deployment Requirements

Add Confluent environment variables to local, Rancher, and OpenShift deployment configuration using the existing environment-management patterns.

Requirements:

- Sensitive values must be stored as secrets.
- Non-sensitive bootstrap or endpoint values may be stored in config.
- Missing or invalid Confluent variables must not prevent the application from starting.
- Existing application functionality must continue to work without Confluent.

## Security and Privacy Requirements

- Do not commit Confluent credentials to source control.
- Do not expose full customer names in the live activity feed.
- Do not require authentication for the activity feed unless sensitive data is added later.
- Keep Confluent integration optional for local development.

## Acceptance Criteria

The implementation is complete when the following are true:

- Creating an order emits an `ORDER_PLACED` event.
- Updating an order status emits an `ORDER_UPDATED` event.
- Adding a cart item emits an `ITEM_ADDED` event.
- Removing a cart item emits an `ITEM_REMOVED` event.
- Performing an agentic search emits a `SEARCH_PERFORMED` event with a generated `session_id`.
- Product inventory changes emit an `INVENTORY_UPDATED` event.
- Inventory updates can generate `LOW`, `CRITICAL`, or `OUT_OF_STOCK` alerts.
- The Home page displays recent anonymized order and search activity when Confluent is available.
- The Home page renders normally when Confluent is unavailable.
- Existing backend, frontend, Rancher, and OpenShift flows continue to work.
- No Confluent credentials are committed to source control.

## Notes for Implementation

The implementation should avoid embedding generic Confluent setup details in this spec. Any reusable Confluent guidance must be retrieved from the existing `data-streaming-confluent` skill so future specs can reuse the same established patterns.

## Implementation

Create all new application files under [`specifications/backend/`](specifications/backend) and [`specifications/frontend/`](specifications/frontend) so this repository remains self-contained.

### Backend Requirements

Build an Express backend that preserves the API behavior described in [`specifications/backend/api_endpoints.md`](specifications/backend/api_endpoints.md) and adds Confluent integration as an optional layer.

#### Data storage model for this repo

Because this repository does not include a prebuilt database-backed implementation, provide a lightweight application implementation that:

- Loads products and users from [`specifications/data/products.csv`](specifications/data/products.csv) and [`specifications/data/users.csv`](specifications/data/users.csv).
- Uses an in-memory store for carts, orders, and sessions.
- Keeps the existing endpoint shapes and authentication behavior compatible with [`specifications/backend/api_endpoints.md`](specifications/backend/api_endpoints.md).
- Treats this in-memory implementation as the local reference implementation for the Confluent feature.

#### Required backend behavior

Implement these endpoints:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `PUT /auth/me`
- `GET /products`
- `GET /products/:id`
- `GET /cart`
- `POST /cart/items`
- `PUT /cart/items/:cart_item_id`
- `DELETE /cart/items/:cart_item_id`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `PUT /orders/:id`
- `POST /agentSearch`
- `GET /activity/stream`
- `GET /health`

Additional behavior:

- Use JWT for authenticated endpoints.
- Keep request and response payload fields in snake_case.
- Emit Confluent events only after the underlying action succeeds.
- If Confluent is not configured, skip publishing silently and keep the HTTP response successful.
- If Confluent publishing fails, log the failure and do not fail the request.
- Generate a `session_id` for every [`POST /agentSearch`](specifications/backend/api_endpoints.md) request.
- Add an in-process fallback activity stream so the Home page can still subscribe safely even when Confluent is unavailable, but return no activity items unless streaming is configured or new local events are generated.

#### Event payload mapping

Use these event payloads:

##### Order placed / updated

```json
{
  "order_id": "uuid",
  "order_number": "ORD-10001",
  "user_id": "user-1",
  "display_name": "James S.",
  "status": "processing",
  "total_amount": 120.45,
  "item_count": 3,
  "event_type": "ORDER_PLACED",
  "event_time": 1735689600000
}
```

##### Cart event

```json
{
  "cart_id": "cart-1",
  "user_id": "user-1",
  "product_id": "product-1",
  "product_name": "Orbital EVA Gloves",
  "quantity": 2,
  "event_type": "ITEM_ADDED",
  "event_time": 1735689600000
}
```

##### Search event

```json
{
  "session_id": "uuid",
  "query": "communication devices for hearing loss",
  "result_count": 4,
  "agent_responded": true,
  "event_type": "SEARCH_PERFORMED",
  "event_time": 1735689600000
}
```

##### Product inventory event

```json
{
  "product_id": "product-1",
  "name": "Orbital EVA Gloves",
  "category": "space_suits",
  "price": 99.99,
  "inventory_quantity": 4,
  "in_stock": true,
  "event_type": "INVENTORY_UPDATED",
  "event_time": 1735689600000
}
```

##### Inventory alert event

```json
{
  "product_id": "product-1",
  "name": "Orbital EVA Gloves",
  "category": "space_suits",
  "inventory_quantity": 4,
  "alert_level": "CRITICAL",
  "alert_time": 1735689600000
}
```

#### Inventory and alert logic

- Decrement inventory when an order is created.
- Emit one `INVENTORY_UPDATED` event per affected product after the order is created.
- Also emit an `inventory-alerts` event when the updated inventory quantity is between `0` and `20` inclusive according to the threshold table in this spec.
- If inventory is insufficient, fail order creation before publishing any order or inventory event.

#### Activity feed behavior

Use [`GET /activity/stream`](specifications/11-confluent-streaming.md) as a Server-Sent Events endpoint that:

- broadcasts only anonymized order and search activities,
- keeps at most the latest five items in memory,
- sends SSE `data:` payloads as JSON arrays of activity objects,
- does not require JWT,
- sends an initial event immediately after connect,
- tolerates disconnected clients without crashing the server.

Each activity object must contain:

- `id`
- `type`
- `text`
- `event_time`

### Frontend Requirements

Build a React frontend under [`specifications/frontend/src/`](specifications/frontend/src) that includes:

- a Home page matching the intent of [`specifications/4-frontend-ui.md`](specifications/4-frontend-ui.md),
- product browsing,
- login modal or inline login flow,
- cart page,
- orders page,
- agentic search UI,
- a live activity component on the Home page.

The live activity component must:

- connect to [`GET /activity/stream`](specifications/11-confluent-streaming.md),
- render the latest five activities,
- render nothing when no activity is available,
- fail quietly if the SSE connection cannot be established,
- never display full customer names.

### Confluent Integration Requirements

Use the `data-streaming-confluent` skill for reusable setup details, but implement these project-specific files:

- Terraform under [`specifications/confluent/terraform/`](specifications/confluent/terraform)
- Flink SQL under [`specifications/confluent/flink/`](specifications/confluent/flink)
- Optional producer/consumer support code under [`specifications/confluent/python/`](specifications/confluent/python)
- Setup, test, and cleanup scripts under [`specifications/confluent/scripts/`](specifications/confluent/scripts)
- Minimal docs under [`specifications/confluent/docs/`](specifications/confluent/docs)

Confluent assets must define the topics in this spec and include inventory alert generation from `products-stream` using the skill's approved patterns.

### Deployment Requirements for this repo

Add deployment artifacts under [`specifications/rancher/`](specifications/rancher) and [`specifications/openshift/`](specifications/openshift) that wire in the new Confluent environment variables while keeping the app runnable without them.

At minimum:

- extend [`.env_template`](.env_template) with optional Confluent variables,
- keep sensitive Confluent credentials out of source control,
- add/update [`.gitignore`](.gitignore) entries for generated env files and Confluent local artifacts,
- provide local container orchestration for frontend and backend,
- provide OpenShift manifests or scripts that separate config from secrets.

### Validation Requirements

The implementation is only complete when all of the following pass:

- backend install and test commands,
- frontend install and build commands,
- any backend or frontend linting configured by the implementation,
- Terraform formatting and validation for files under [`specifications/confluent/terraform/`](specifications/confluent/terraform),
- a simple runtime verification that the app still works when Confluent variables are unset.
