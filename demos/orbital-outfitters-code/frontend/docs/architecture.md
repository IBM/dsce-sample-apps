# Architecture — Orbital Suppliers Frontend

## Directory Layout

```
frontend/src/
├── api/
│   └── axiosClient.js        # Single configured axios instance; injects JWT
├── components/
│   ├── LoginModal.jsx         # Auth overlay — renders on any page
│   ├── NavBar.jsx             # Top navigation; cart badge from CartContext
│   ├── ProductCard.jsx        # Reusable product tile for grid/strip
│   └── UnderDevelopmentModal.jsx  # Generic "coming soon" modal
├── context/
│   ├── AuthContext.jsx        # token, user, isLoggedIn, login(), logout()
│   └── CartContext.jsx        # cartCount, refreshCartCount()
├── pages/
│   ├── HomePage.jsx           # / — hero, category shortcuts, featured products
│   ├── ProductListingPage.jsx # /products — grid with sidebar filter + pagination
│   ├── ProductDetailPage.jsx  # /products/:id — image, reviews/features tabs
│   ├── CartPage.jsx           # /cart — line items + summary panel
│   ├── CheckoutPage.jsx       # /checkout — contact + address + payment form
│   ├── OrdersPage.jsx         # /orders — order cards list
│   ├── OrderDetailPage.jsx    # /orders/:id — order detail + totals
│   ├── AgenticSearchPage.jsx  # /search — AI chat interface
│   └── AccountPage.jsx        # /account — profile overview + sidebar nav
├── App.jsx                    # Route definitions; ProtectedRoute wrapper
└── main.jsx                   # ReactDOM.createRoot; BrowserRouter + providers
```

## Routing Table

| Path | Component | Auth required |
|---|---|---|
| `/` | `HomePage` | No |
| `/products` | `ProductListingPage` | No |
| `/products/:id` | `ProductDetailPage` | No |
| `/cart` | `CartPage` | Yes (inline modal) |
| `/checkout` | `CheckoutPage` | Yes (ProtectedRoute) |
| `/orders` | `OrdersPage` | Yes (inline modal) |
| `/orders/:id` | `OrderDetailPage` | Yes (inline modal) |
| `/search` | `AgenticSearchPage` | No |
| `/account` | `AccountPage` | Yes (inline modal) |

## Context Diagram

```
BrowserRouter
  └── AuthProvider          (token + user in localStorage)
        └── CartProvider    (cartCount refreshed on login/add-to-cart)
              └── App       (React Router <Routes>)
                    ├── NavBar  (reads cartCount, shows LoginModal on demand)
                    └── Pages   (consume useAuth(), useCart())
```

## Auth Flow

1. User clicks Login → `<LoginModal>` opens.
2. `POST /auth/login` returns `{ token, user }`.
3. `AuthContext.login()` stores both in state **and** `localStorage`.
4. `CartContext.refreshCartCount()` is called immediately after login.
5. On refresh, `AuthProvider` reads `localStorage` to restore session.
6. Logout clears state + `localStorage`; `cartCount` resets to 0.
