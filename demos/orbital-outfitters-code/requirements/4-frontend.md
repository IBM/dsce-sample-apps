# Requirements: Frontend UI

## 1. Overview

Build a React single-page application (SPA) for the **Orbital Suppliers** e-commerce website. The application is a space-themed retail storefront that allows users to browse products by category, use an AI-powered agentic search assistant, manage a shopping cart, place orders, and manage their account. It communicates exclusively with the Express backend via REST API calls using axios.

---

## 2. Environment Variables

All environment variables that differ between deployments live in `.env` at the project root — never hard-coded in source files.

| Variable | Local / Rancher (containers) | OpenShift |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3001` | `""` (empty string) |

### How `VITE_BACKEND_URL` works

- Vite bakes this value into the browser bundle at build time.
- Setting it to `""` on OpenShift makes axios use **relative URLs** (e.g. `/api/products`). The browser sends these to the same origin, and the nginx proxy inside the frontend pod routes them internally to `http://backend:3001`.
- **Never** set `VITE_BACKEND_URL` to an OpenShift hostname or internal container hostname — the browser would attempt a cross-origin request directly to the backend on an internal port, which browsers block as a mixed-content or CORS error.

---

## 3. Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 (JSX, functional components, hooks) |
| Build tool | Vite |
| HTTP client | axios — `baseURL` set to `import.meta.env.VITE_BACKEND_URL` |
| Language | JavaScript (.jsx / .js) — no TypeScript |
| Routing | React Router v6 |
| State | React Context API (no Redux) |

All frontend source files live under `frontend/`.

---

## 4. Directory Structure

```
frontend/
├── public/
│   └── assets/                  # Copied icon PNGs and static GIFs at build time
├── src/
│   ├── components/              # Shared, reusable components (NavBar, LoginModal, etc.)
│   ├── pages/                   # One file per route (HomePage, CartPage, etc.)
│   ├── context/
│   │   ├── AuthContext.jsx      # Auth state + login/logout helpers
│   │   └── CartContext.jsx      # Cart item count + refresh helper
│   ├── api/
│   │   └── axiosClient.js       # Configured axios instance
│   ├── App.jsx                  # Route definitions
│   └── main.jsx                 # React DOM entry point, context providers
├── docs/                        # Developer documentation (see §13)
├── .env                         # VITE_BACKEND_URL (not committed for production secrets)
└── vite.config.js
```

---

## 5. Pages

Each page is a file under `frontend/src/pages/`. All pages share the `<NavBar>` component at the top. Pages marked **requires login** must redirect unauthenticated users to the Login Modal before rendering the protected content.

### 5.1 Home Page

**Route:** `/`

**Visual reference:** `specifications/frontend/design-mockups/home/home_page.png`

#### Layout

| Zone | Description |
|---|---|
| Background | Full-viewport animated GIF: `home_page_background.gif`. Covers the hero section behind the logo and headline. |
| Logo | `logo_orbital_suppliers.png` — top-left, inside the NavBar. Clicking it navigates to `/`. |
| Headline | Large bold text: **"GEAR UP FOR YOUR SPACE JOURNEY"** over the background image. Sub-headline paragraph below. |
| Search bar | Full-width text input with a blue **SEARCH** button. On submit navigates to `/products?q=<query>`. |
| Category shortcuts | Three clickable cards below the search bar: **Life Support**, **Navigation**, **Space Suits**. Each card shows the category icon, a label, and a short prompt example. Clicking navigates to `/products?category=<slug>`. |
| Featured products strip | Horizontal row of ~5 product thumbnail cards with product name and one-line description. Each links to `/products/<id>`. |
| Trust-badges footer strip | Four items: Mission-Ready Quality, Secure Checkout, Fast Galactic Shipping, Explorer Support. Icon + label + short text. |

#### Category shortcut icons (use exact PNGs — no emoji)

| Card | Icon file |
|---|---|
| Life Support | `home/icons/search_life_support.png` |
| Navigation | `home/icons/search_navigation.png` |
| Space Suits | `home/icons/search_space_suits.png` |

---

### 5.2 Product Listing Page

**Route:** `/products`

**Query params:** `?q=<search_term>` and/or `?category=<slug>`

#### Layout

- Page title: **"Products"** (or the category name when filtered).
- **Filter sidebar or top bar:** category dropdown/buttons to filter results. Pre-populate from `GET /api/categories`.
- **Search bar** at the top: text input. On change (or submit) updates `?q=` in the URL and re-fetches.
- **Product grid:** 3–4 columns of product cards. Each card shows product image, name, short description, price, and an **Add to Cart** button.
  - If the user is not logged in, the Add to Cart button shows the Login Modal with the context message *"Please sign in to add this item to the cart."*
- **Loading state:** show a spinner or skeleton while fetching.
- **Empty state:** "No products found" message when the result set is empty.

#### API calls

| Action | Endpoint |
|---|---|
| Fetch all / search | `GET /api/products?q=<term>&category=<slug>` |
| Fetch categories | `GET /api/categories` |
| Add to cart | `POST /api/cart` (requires auth header) |

---

### 5.3 Product Detail Page

**Route:** `/products/:id`

**Visual reference:** `specifications/frontend/design-mockups/product-page/product_page.png`

#### Layout

- **Breadcrumb:** Home › Category › Product name.
- **Left column:** Product image (large).
- **Right column:**
  - Product name (H1), category badge, stock status badge ("In Stock" in green).
  - Short description paragraph.
  - Metadata row: Weight, Dimensions.
  - Price (large, bold).
  - **Quantity selector:** `−` / number input / `+` controls. Default quantity: 1.
  - **Add to Cart** button (blue, full-width on mobile). Uses icon `cart/icons/action_add_to_cart.png`.
    - If not logged in: open Login Modal with message *"Please sign in to add this item to the cart."*
  - Trust-badge row (same four badges as Home).
- **Tabs below:** "Reviews" tab and "Features" tab.
  - **Reviews tab:** list of user reviews; each shows avatar initials, star rating (1–5), and review text.
  - **Features tab:** bullet list of product feature descriptions.

#### API calls

| Action | Endpoint |
|---|---|
| Fetch product | `GET /api/products/:id` |
| Fetch reviews | `GET /api/products/:id/reviews` |
| Add to cart | `POST /api/cart` (requires auth header) |

---

### 5.4 Cart Page

**Route:** `/cart`  
**Requires login.** If the user is not authenticated, show the Login Modal with message *"Please sign in to view your cart."*

**Visual references:**
- Logged-in with items: `specifications/frontend/design-mockups/cart/cart_logged_in_full.png`
- Logged-in empty cart: `specifications/frontend/design-mockups/cart/cart_logged_in_empty.png`

#### Layout — authenticated, items present

- **Back link:** `← CONTINUE SHOPPING` (uses icon `cart/icons/action_back_arrow.png`) navigates to `/products`.
- **Page title:** "SHOPPING CART" — item count subtitle (e.g. "3 items").
- **Line items table (left ~65% width):**
  - Each row: product thumbnail image, product name + short description, quantity `−`/`+` controls, unit price, line total.
  - Remove item: clicking `−` to 0 removes the item, or provide an explicit remove icon.
- **Order summary panel (right ~35% width):**
  - Subtotal, Shipping (show "Free" or `$0.00`), **Total** (bold, large blue text).
  - **CONTINUE SHOPPING** button (outlined style) → `/products`.
  - **CHECKOUT** button (solid blue, full-width) with icon `cart/icons/action_add_to_cart.png` → `/checkout`.

#### Layout — authenticated, empty cart

- Large centered cart icon `cart/icons/cart_empty_large.png`.
- "Your cart is empty" heading.
- "Add some products to get started!" sub-text.
- **CONTINUE SHOPPING** button → `/products`.

#### API calls

| Action | Endpoint |
|---|---|
| Fetch cart | `GET /api/cart` |
| Update quantity | `PUT /api/cart/:itemId` |
| Remove item | `DELETE /api/cart/:itemId` |

---

### 5.5 Checkout Page

**Route:** `/checkout`  
**Requires login.**

**Visual reference:** `specifications/frontend/design-mockups/cart/checkout.png`

#### Layout

- **Breadcrumb stepper:** Cart → **Checkout** → Confirmation (the stepper uses step numbers; Checkout is the active step).
- **Page title:** "CHECKOUT" with sub-text "Secure checkout for your orbital order".
- **Left column (form, ~60% width):**

  **Section 1 — Contact Information**
  - Full Name (text), Email Address (email), Phone Number (tel).

  **Section 2 — Shipping Address**
  - Address line 1 (text), Address line 2 (optional, text).
  - City (text), State/Region (text with dropdown), ZIP Code (text), Country (dropdown, default "United States").

  **Section 3 — Payment Method**
  - Display static message: *"Payment handling not yet supported or required."* (matches the mockup exactly).

- **Right column — Order Summary panel (~40% width):**
  - Line items: product image thumbnail, product name, qty, line price.
  - Subtotal, Shipping (Free), Tax (7.98% of subtotal, labelled "Tax (7.98%) ⓘ"), **Total** (bold blue).
  - **PLACE ORDER** button (solid blue, full-width). On click: call `POST /api/orders`, then navigate to `/orders/<newOrderId>`.
  - **RETURN TO CART** button (outlined, full-width) → `/cart`.
  - Lock icon + "256-bit encrypted secure checkout" caption below buttons.

#### API calls

| Action | Endpoint |
|---|---|
| Place order | `POST /api/orders` with shipping address payload |

---

### 5.6 Orders Page

**Route:** `/orders`  
**Requires login.**

**Visual reference:** `specifications/frontend/design-mockups/orders/my_orders.png`

#### Layout

- **Page title:** "MY ORDERS" — order count subtitle (e.g. "2 orders").
- **Order cards list:** one card per order.
  - Card header: Order ID (e.g. "Order #ORD-1001"), order date.
  - Status badge:
    - "Delivered" — green badge with icon `orders/icons/order_status_delivered.png`.
    - "Processing" — orange badge with icon `orders/icons/order_status_processing.png`.
  - Total price (top-right of card).
  - Product thumbnail strip: up to 2–3 product images with name + "Qty: N".
  - Action buttons:
    - **VIEW DETAILS** (icon `orders/icons/view_details.png`) → `/orders/:id`.
    - **TRACK ORDER** (icon `orders/icons/track_status.png`) → shows "Functionality under development" alert (see §10).

#### API calls

| Action | Endpoint |
|---|---|
| Fetch orders | `GET /api/orders` (requires auth header) |

---

### 5.7 Order Detail Page

**Route:** `/orders/:id`  
**Requires login.**

#### Layout

- **Back link:** `← MY ORDERS` → `/orders`.
- **Page title:** Order ID + order date.
- **Status badge** (same styling as Orders page).
- **Items table:** product image, name, qty, unit price, line total.
- **Order summary totals:** Subtotal, Shipping, Tax, Total.
- **Shipping address block:** full address from the order record.

#### API calls

| Action | Endpoint |
|---|---|
| Fetch order | `GET /api/orders/:id` (requires auth header) |

---

### 5.8 Agentic Search Page

**Route:** `/search`

**Visual reference:** `specifications/frontend/design-mockups/agentic-search/agentic_search.png`

#### Layout

- **Chat area (scrollable, takes up ~85% of viewport height):**
  - User messages: right-aligned bubble (light background), preceded by a user avatar icon (right side). Shows timestamp (HH:MM AM/PM).
  - Agent responses: left-aligned panel with a robot avatar icon (left side), labelled **"Product Assistant"**.
    - Each agent response includes:
      - A paragraph of natural-language explanation text.
      - A **2×2 grid of product cards** (exactly 4 products). Each product card shows:
        - Product thumbnail image.
        - Product name (bold, linked to `/products/:id`).
        - One-line description.
        - **ADD TO CART** button using icon `agentic-search/icons/action_refresh.png` for the refresh action — the cart add button uses standard cart icon styling.
  - Chat scrolls to the bottom after each new message pair.

- **Input bar (fixed at the bottom):**
  - Text input: placeholder "Ask about products...".
  - **Refresh / clear button** (left of input): uses icon `agentic-search/icons/action_refresh.png`. Clears the conversation history.
  - **Submit button** (right of input): uses icon `agentic-search/icons/submit_search.png`. Sends query on click or pressing Enter.

#### Behaviour

- On submit, POST the user's message to the agentic search endpoint.
- Append a user bubble immediately, then append the agent response when the API responds.
- While awaiting the response, show a typing indicator (three animated dots) in the agent bubble position.
- The Refresh button clears `messages` state and resets the conversation.

#### API calls

| Action | Endpoint |
|---|---|
| Send message | `POST /api/agent/search` with `{ query: "<text>" }` |

---

### 5.9 Account Page

**Route:** `/account`  
**Requires login.**

**Visual reference:** `specifications/frontend/design-mockups/account/account.png`

#### Layout

- **Page title:** "ACCOUNT" with sub-text "Manage your account information and preferences."
- **Left sidebar navigation:** icon + label for each section:
  - Account Overview (`account/icons/account_overview_user.png`)
  - Order History (`account/icons/account_order_history_clock.png`)
  - Addresses (`account/icons/account_addresses_pin.png`)
  - Payment Methods (`account/icons/account_payment_methods_card.png`)
  - Security (`account/icons/account_security_shield.png`)
  - Preferences (`account/icons/account_preferences_gear.png`)
- **Main content panel — Account Overview (default view):**
  - User avatar (generic icon), user full name, "Welcome back!" sub-text.
  - **EDIT ACCOUNT** button (outlined, top-right of panel).
  - **Account Information** section: Name field, Email field, Phone field (all read-only until Edit mode is active).
  - **Shipping Address** section: formatted address block, **EDIT ADDRESS** button.
  - **Password** section: masked password field, **CHANGE PASSWORD** button.
  - **Preferences** section: checkbox "Email me about new products, special offers, and updates."
  - **SAVE CHANGES** button (solid blue, bottom-right).

#### API calls

| Action | Endpoint |
|---|---|
| Fetch profile | `GET /api/users/profile` (requires auth header) |
| Update profile | `PUT /api/users/profile` (requires auth header) |

---

### 5.10 Login Modal

**Visual reference:** `specifications/frontend/design-mockups/login/login_popup.png`

The Login Modal is a reusable overlay component rendered by `<LoginModal>` in `components/`. It is **not** a separate route — it renders on top of any page.

#### Layout

- White modal card, centered on a dimmed overlay. Clicking the overlay closes the modal.
- **Close button (×)** top-right of the card.
- **Logo:** `logo_orbital_suppliers.png`.
- **Title:** "Sign In".
- **Context message:** injected by the calling page (e.g. *"Please sign in to view your cart."* or *"Please sign in to add this item to the cart."*). Plain text, shown below the title.
- **Email field:** label "Email", type `email`, initially blank.
- **Password field:** label "Password", type `password` with show/hide toggle (eye icon).
- **LOGIN button:** full-width, solid blue (`#2850B8`). On click: `POST /api/auth/login` with `{ email, password }`. On success: call `login(token, user)` from `AuthContext`, close modal.
- **"Autocomplete with random user" button:** full-width, outlined style. On click: call `GET /api/users/random` to fetch a random user's email and pre-fill both `email` and `password` fields with the returned values. Does **not** auto-submit — user must still click LOGIN.
- **Error state:** display an inline error message below the LOGIN button on failed login (e.g. "Invalid email or password.").

---

## 6. Auth Context

**File:** `frontend/src/context/AuthContext.jsx`

Provides authentication state globally via React Context.

```
AuthContext shape:
  token        — string | null   (JWT bearer token)
  user         — object | null   (id, email, firstName, lastName)
  isLoggedIn   — boolean         (derived: token !== null)
  login(token, user) — stores token + user in state and localStorage
  logout()           — clears state and localStorage, navigates to "/"
```

#### Implementation rules

- On app mount, read `token` and `user` from `localStorage` to restore session.
- `login()` writes both to `localStorage`.
- `logout()` removes both from `localStorage`.
- Wrap the entire app in `<AuthProvider>` inside `main.jsx`.

---

## 7. Cart Context

**File:** `frontend/src/context/CartContext.jsx`

Provides live cart item count to the NavBar badge.

```
CartContext shape:
  cartCount         — number   (total item quantity in cart)
  refreshCartCount() — re-fetches GET /api/cart and updates cartCount
```

#### Implementation rules

- On user login, call `refreshCartCount()` immediately.
- On user logout, reset `cartCount` to `0`.
- After every successful **Add to Cart** action, call `refreshCartCount()`.
- The NavBar reads `cartCount` from this context to render the badge number over the cart icon.
- Wrap the entire app in `<CartProvider>` inside `main.jsx` (inside `<AuthProvider>`).

---

## 8. API Client

**File:** `frontend/src/api/axiosClient.js`

```js
import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
});

// Attach JWT on every request if present
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
```

- **All API calls** across every page and context must use this `axiosClient` instance — never use `fetch` or a separately configured axios instance.
- No need to set `Content-Type` manually; axios sets it automatically for JSON bodies.
- On a `401` response, call `logout()` from `AuthContext` (guard against redirect loops on the login flow itself).

---

## 9. Icons

All icons throughout the application **must** use the PNG files provided in `specifications/frontend/design-mockups/<page>/icons/`. Do **not** substitute Unicode emoji, CSS content characters, or third-party icon libraries in place of these provided assets.

Copy icon PNGs into `frontend/public/assets/icons/<page>/` during project setup so Vite serves them as static assets.

### Icon inventory by page

| Page | Icon file | Usage |
|---|---|---|
| **NavBar (home)** | `home/icons/nav_cart.png` | Cart button |
| **NavBar (home)** | `home/icons/nav_orders_clipboard.png` | Orders button |
| **NavBar (home)** | `home/icons/nav_account_user.png` | Account button |
| **NavBar (home)** | `home/icons/nav_login_arrow.png` | Login button (logged out) |
| **NavBar (home)** | `home/icons/nav_logout_arrow.png` | Logout button (logged in) |
| **Home** | `home/icons/search_life_support.png` | Life Support category shortcut |
| **Home** | `home/icons/search_navigation.png` | Navigation category shortcut |
| **Home** | `home/icons/search_space_suits.png` | Space Suits category shortcut |
| **Cart** | `cart/icons/action_add_to_cart.png` | Add to Cart / Checkout button |
| **Cart** | `cart/icons/action_back_arrow.png` | ← Continue Shopping link |
| **Cart** | `cart/icons/cart_empty_large.png` | Empty cart illustration |
| **Cart** | `cart/icons/cart_login_required.png` | Login-required cart state |
| **Orders** | `orders/icons/order_status_delivered.png` | "Delivered" status badge |
| **Orders** | `orders/icons/order_status_processing.png` | "Processing" status badge |
| **Orders** | `orders/icons/view_details.png` | VIEW DETAILS button |
| **Orders** | `orders/icons/track_status.png` | TRACK ORDER button |
| **Agentic Search** | `agentic-search/icons/action_refresh.png` | Clear / refresh conversation |
| **Agentic Search** | `agentic-search/icons/submit_search.png` | Submit query button |
| **Account** | `account/icons/account_overview_user.png` | Sidebar — Account Overview |
| **Account** | `account/icons/account_order_history_clock.png` | Sidebar — Order History |
| **Account** | `account/icons/account_addresses_pin.png` | Sidebar — Addresses |
| **Account** | `account/icons/account_payment_methods_card.png` | Sidebar — Payment Methods |
| **Account** | `account/icons/account_security_shield.png` | Sidebar — Security |
| **Account** | `account/icons/account_preferences_gear.png` | Sidebar — Preferences |

---

## 10. "Functionality Under Development" Pattern

Some UI elements exist in the design mockups but have no backend implementation. When a user clicks one of these elements, display a modal alert — do **not** navigate or silently fail.

### Elements that trigger this alert

| Page | Element |
|---|---|
| Orders | **TRACK ORDER** button |

### Alert modal spec

- White modal card, centered, dimmed overlay backdrop.
- Title: **"Functionality Under Development"**
- Body text: *"This feature is not yet available. Please check back soon."*
- Single **OK** button (solid blue) to dismiss.
- Reuse a generic `<UnderDevelopmentModal>` component in `components/`.

---

## 11. Brand Colors

Use the IBM 2026 brand palette exclusively. Do not introduce ad-hoc hex values outside this set.

| Color family | Darkest | Dark | Original | Light | Lightest |
|---|---|---|---|---|---|
| Teal | `#021F1F` | `#0F6E6E` | `#6ADADA` | `#B2F2F2` | `#D2F7F7` |
| Purple | `#160040` | `#5E28C0` | `#A56EFF` | `#D5ACFF` | `#EAD0FF` |
| Indigo | `#060440` | `#3E3CB8` | `#8A87FE` | `#BDBCFF` | `#DCDCFF` |
| Blue | `#031040` | `#2850B8` | `#6FA1FE` | `#AACAFF` | `#CCDDFF` |
| Blue-green | `#041E22` | `#226E78` | `#6FBEC5` | `#A8DADD` | `#C8E6E8` |
| Green | `#051F0E` | `#1E7A40` | `#6FDC8C` | `#AAEBB8` | `#C8F2D0` |

### Recommended role mappings

| Role | Token |
|---|---|
| Primary action buttons (LOGIN, CHECKOUT, PLACE ORDER, SAVE CHANGES) | Blue Dark `#2850B8` |
| Primary button hover | Blue Darkest `#031040` |
| Active NavBar link underline / accent | Blue Dark `#2850B8` |
| "In Stock" / "Delivered" status badge | Green Dark `#1E7A40` |
| "Processing" status badge | (orange — use `#E07B00`, the one acceptable exception for status semantics) |
| Agentic search submit button | Blue Dark `#2850B8` |
| Link text / category badges | Blue Original `#6FA1FE` |
| Page background gradient (hero) | Blue Lightest `#CCDDFF` → white |
| Trust-badge icon tint | Blue Dark `#2850B8` |

---

## 12. CORS Requirement

The backend Express server must include CORS middleware that allows requests from the frontend origin.

- **Local:** allow `http://localhost:5173` (Vite default dev port).
- **OpenShift:** because the browser calls the same origin (`/api/...` via nginx proxy), no additional CORS origin is needed — but the middleware must not block same-origin preflight requests.
- The backend team must ensure `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Authorization, Content-Type`, and `Access-Control-Allow-Methods: GET, POST, PUT, DELETE` are set correctly.

This is a backend responsibility but the frontend developer must verify it during integration testing by checking browser DevTools → Network for CORS errors.

---

## 13. Documentation

Write short developer documentation under `frontend/docs/`. Each file must be ≤ 4 pages / ~120 lines.

| File | Contents |
|---|---|
| `frontend/docs/setup.md` | Prerequisites, `npm install`, `npm run dev`, env var setup |
| `frontend/docs/architecture.md` | Directory layout, routing table, context diagram |
| `frontend/docs/api-integration.md` | axiosClient usage, auth header pattern, error handling conventions |

---

## 14. Route Summary

| Path | Component | Auth required |
|---|---|---|
| `/` | `HomePage` | No |
| `/products` | `ProductListingPage` | No |
| `/products/:id` | `ProductDetailPage` | No |
| `/cart` | `CartPage` | Yes |
| `/checkout` | `CheckoutPage` | Yes |
| `/orders` | `OrdersPage` | Yes |
| `/orders/:id` | `OrderDetailPage` | Yes |
| `/search` | `AgenticSearchPage` | No |
| `/account` | `AccountPage` | Yes |

Routes that require auth should be wrapped in a `<ProtectedRoute>` component that shows the Login Modal (not a redirect) when `isLoggedIn` is `false`, so the user stays on the attempted page after authenticating.
