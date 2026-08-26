# QA Issues Log

## STATUS: All critical functionality passing. Minor visual gaps only.

---

## ISSUE-001: Home page featured products — vertical stack instead of horizontal scroll
**Page:** Home (`/`)
**Severity:** Minor (cosmetic)
**Status:** Open
**Description:** The design comp shows featured products as a single horizontal row. The implementation renders them in a multi-column grid that stacks vertically. Functionally equivalent but layout differs from mockup.
**Fix:** Change `frontend/src/pages/HomePage.jsx` featured product section to a horizontal `overflow-x: auto` strip with fixed-width cards.

---

## ISSUE-002: Agent response occasionally includes preamble text
**Page:** Agentic Search (`/search`)
**Severity:** Minor
**Status:** Open
**Description:** Some watsonx Orchestrate responses begin with "Hello! I am watsonx Orchestrate, an AI assistant, created by IBM." before the actual product recommendation. The agent instructions say not to restate product names but do not suppress the intro preamble.
**Fix:** Update `agent/product_search.yaml` instructions to add: "Do not introduce yourself. Begin your response directly with product insights."
**Re-QA:** Re-run all 3 agentic search test questions after fixing.

---

## ISSUE-003: Orders page — product thumbnails not shown in list view
**Page:** Orders (`/orders`)
**Severity:** Minor
**Status:** Open
**Description:** The design comp shows 1-2 product images inline on each order card in the list view. The `GET /orders` endpoint does not return items (only the `GET /orders/:id` detail endpoint does). The list view shows shipping address instead of product thumbnails.
**Fix option A:** Add a `LIMIT 2` items sub-query to the `GET /orders` list endpoint to return preview items.
**Fix option B:** Accept current behaviour (shipping address instead of thumbnails) as a known gap.

---

## ISSUE-004: Account page has 6 nav items; design comp shows only 2
**Page:** Account (`/account`)
**Severity:** Minor (cosmetic)
**Status:** Open
**Description:** Implementation has 6 sidebar nav items (Overview, Order History, Addresses, Payment Methods, Security, Preferences). The design comp only shows Account Overview and Order History. Extra items all correctly show "Functionality under development" when clicked.
**Resolution:** Not a blocking issue — extra items work correctly with the development placeholder. Can reduce to 2 items to match comp exactly if desired.

---

## PASSING — No issues
- Backend user journey (login → 3 items → checkout → 4 items → checkout → verify 2 orders) ✅
- Product listing page ✅
- Product detail page with reviews and features ✅
- Cart logged-out state (matches design comp) ✅
- Login modal (matches design comp) ✅
- Agentic Search Q1 (dog entertainment) ✅
- Agentic Search Q2 (healthcare for young adults) ✅
- Agentic Search Q3 (hearing loss devices) ✅
- Orders page shows login prompt when unauthenticated ✅
- "Functionality under development" modal fires on Track Order ✅
