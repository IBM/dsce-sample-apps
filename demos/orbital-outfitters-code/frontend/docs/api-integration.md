# API Integration Guide

## axiosClient

**File:** `src/api/axiosClient.js`

All HTTP calls **must** use the single configured `axiosClient` instance — never `fetch` or a separate axios instance.

```js
import axiosClient from '../api/axiosClient';

// GET example
const res = await axiosClient.get('/products?page=1&limit=12');
console.log(res.data.products);

// POST with body
const res = await axiosClient.post('/cart/items', { product_id: 42, quantity: 1 });

// DELETE
await axiosClient.delete(`/cart/items/${itemId}`);
```

## Auth Header Pattern

`axiosClient` automatically attaches the JWT on every request via a request interceptor:

```js
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

No manual header setup is needed in page components.

## Endpoint Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | No | `{ login, password }` → `{ token, user }` |
| GET | `/auth/me` | Yes | Current user profile |
| GET | `/products` | No | `?search=&category=&page=&limit=` |
| GET | `/products/:id` | No | Product + reviews[] |
| GET | `/cart` | Yes | `{ items[], subtotal, item_count }` |
| POST | `/cart/items` | Yes | `{ product_id, quantity }` |
| PUT | `/cart/items/:id` | Yes | `{ quantity }` |
| DELETE | `/cart/items/:id` | Yes | Remove item |
| POST | `/orders` | Yes | `{ shipping_address_1, shipping_city, shipping_state, shipping_zip }` |
| GET | `/orders` | Yes | `{ orders[] }` |
| GET | `/orders/:id` | Yes | Order with `items[]` |
| POST | `/agentSearch` | No | `{ query }` → `{ agent_response, products[] }` |

## Error Handling Conventions

- Wrap API calls in `try/catch`. For user-visible errors, set a local `error` state and render it inline.
- On a `401` response, the user's session has expired. Call `logout()` from `useAuth()` to clear state.
- Network errors: catch and show a friendly message; never expose raw error objects to the UI.
- Loading state: always set a `loading` boolean before the call and clear it in `finally`.
