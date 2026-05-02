import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_BASE_URL
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ---------------------
    AUTH
----------------------*/
export async function login(username, password) {
  const res = await api.post("/auth/login", { username, password });
  return res.data;
}

export async function logout() {
  // Best-effort server-side logout. Even if it fails,
  // frontend will still clear local token/session.
  try {
    const res = await api.post("/auth/logout");
    return res.data;
  } catch (err) {
    // Let caller decide how to handle or ignore
    throw err;
  }
}

/* ---------------------
    PRODUCTS
----------------------*/
export async function getProducts(params = {}) {
  const res = await api.get("/products", { params });
  return res.data;
}

/* ---------------------
    CART
----------------------*/
export async function getCart() {
  const res = await api.get("/cart");
  return res.data;
}

export async function addToCart(productId, quantity = 1) {
  const res = await api.post("/cart/add", { productId, quantity });
  return res.data;
}

export async function updateCartItem(itemId, quantity) {
  const res = await api.put(`/cart/item/${itemId}`, { quantity });
  return res.data;
}

export async function deleteCartItem(itemId) {
  const res = await api.delete(`/cart/item/${itemId}`);
  return res.data;
}

export async function checkout(cartPayload) {
  const res = await api.post("/orders/checkout", cartPayload);
  return res.data;
}

/* ---------------------
    ORDERS
----------------------*/
export async function getMyOrders() {
  const res = await api.get("/orders/my");
  return res.data;
}

/* ---------------------
    WISHLIST (NEW)
----------------------*/
export async function getWishlist() {
  const res = await api.get("/wishlist");
  return res.data;
}

export async function addToWishlist(productId) {
  const res = await api.post("/wishlist", { productId });
  return res.data;
}

export async function removeFromWishlist(productId) {
  const res = await api.delete(`/wishlist/${productId}`);
  return res.data;
}

/* ---------------------
    PROFILE (NEW)
----------------------*/
export async function getProfile() {
  const res = await api.get("/me");
  return res.data;
}

export async function updateDefaultAddress(defaultAddress) {
  const res = await api.put("/me/address", { defaultAddress });
  return res.data;
}

/* ---------------------
    ADMIN METRICS (NEW)
----------------------*/
export async function getAdminMetrics() {
  const res = await api.get("/admin/metrics");
  return res.data;
}

export async function getLoginTrend12h() {
  const res = await api.get("/admin/login-trend-12h");
  return res.data;
}

/* ---------------------
    PRODUCT INSIGHTS (NEW)
    OPTIMIZED: Pass product name to skip backend DB query
    NEW: Pass useRAG parameter to control RAG API calls
----------------------*/
export async function getProductInsights(productId, productName = null, useRAG = false) {
  const params = {
    ...(productName && { name: productName }),
    useRAG: useRAG.toString()
  };
  const res = await api.get(`/products/${productId}/insights`, { params });
  return res.data;
}

export default api;

