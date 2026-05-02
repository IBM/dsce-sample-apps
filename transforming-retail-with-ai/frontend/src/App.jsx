import React, { useState, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  useNavigate,
  Link,
  useLocation
} from "react-router-dom";

import {
  login,
  logout as apiLogout,
  getProducts,
  getCart,
  addToCart,
  updateCartItem,
  deleteCartItem,
  checkout,
  addToWishlist,
  getMyOrders
} from "./api";

import "./App.css";
import "./components/ProductInsightsModal.css";

/* === NEW IMPORTS (PAGES / COMPONENTS) === */
import WishlistPage from "./pages/WishlistPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ProductReviews from "./components/ProductReviews";
import ProductInsightsModal from "./components/ProductInsightsModal";
import RAGToggle from "./components/RAGToggle";

/* -----------------------------------------------------------
 * Toast popup – centered with small animation
 * --------------------------------------------------------- */
function Toast({ visible, message, type }) {
  if (!visible) return null;

  const backdropStyle = {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 60
  };

  const boxStyle = {
    minWidth: "220px",
    maxWidth: "320px",
    padding: "14px 20px",
    borderRadius: "999px",
    backgroundColor: type === "error" ? "#fee2e2" : "#0f172a",
    color: type === "error" ? "#b91c1c" : "#f9fafb",
    fontSize: 14,
    fontWeight: 500,
    boxShadow: "0 18px 40px rgba(15,23,42,0.45)",
    transform: "translateY(0)",
    animation: "toast-pop 0.35s ease-out",
    pointerEvents: "auto",
    textAlign: "center"
  };

  return (
    <div style={backdropStyle}>
      <div style={boxStyle}>{message}</div>
    </div>
  );
}

/* ---- NAVBAR ---- */

function Navbar({ user, onLogout, ragEnabled, onRagToggle }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  const isCatalog = location.pathname === "/";

  const active = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  return (
    <nav className="nav">
      <div className="nav-left">
        <span className="nav-logo">Retail Demo</span>
      </div>

      {!isLogin && (
        <div className="nav-center">
          <Link to="/" className={active("/")}>
            Catalog
          </Link>

          {user && (
            <>
              <Link to="/cart" className={active("/cart")}>
                Cart
              </Link>
              <Link to="/orders" className={active("/orders")}>
                Orders
              </Link>

              {/* NEW NAV LINKS */}
              <Link to="/wishlist" className={active("/wishlist")}>
                Wishlist
              </Link>
              <Link to="/profile" className={active("/profile")}>
                Profile
              </Link>

              {user.is_admin && (
                <Link to="/admin" className={active("/admin")}>
                  Admin
                </Link>
              )}
            </>
          )}
        </div>
      )}

      <div className="nav-right">
        {user ? (
          <div className="nav-right-content">
            <span className="nav-user">Hi, {user.username}</span>
            <button onClick={onLogout} className="btn-secondary">
              Logout
            </button>
            {isCatalog && (
              <div className="rag-toggle-nav">
                <RAGToggle isEnabled={ragEnabled} onToggle={onRagToggle} />
              </div>
            )}
          </div>
        ) : (
          !isLogin && (
            <Link to="/login" className="btn-primary">
              Login
            </Link>
          )
        )}
      </div>
    </nav>
  );
}

/* ---- LOGIN PAGE ---- */

function LoginPage({ onLogin, onLoginSuccess }) {
  const [username, setUsername] = useState("aarav.sharma");
  const [password, setPassword] = useState("Password@123");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await login(username, password);

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));

      onLogin(data.user);
      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  }

  return (
    <div className="login-page">
      <div className="login-overlay" />
      <div className="login-card fade-in">
        <div className="login-avatar">R</div>

        <h2 className="login-title">Sign in</h2>
        <p className="login-subtitle">
          Use your demo credentials to continue.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="field-input"
              placeholder="Enter username"
            />
          </label>

          <label className="field-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="Enter password"
            />
          </label>

          {error && <div className="error-text">{error}</div>}

          <button className="btn-primary" type="submit">
            Login
          </button>
        </form>

        <div className="login-footer">
          Demo users: 50 real users
          Password: <code>Password@123</code>
        </div>
      </div>
    </div>
  );
}

/* ---- CATALOG PAGE ---- */

function CatalogPage({ onAddToCart, onAddToWishlist, onProductClick }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");

  async function load() {
    const data = await getProducts({ search, sort });
    setProducts(data);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <h2 className="page-title">Product Catalog</h2>

      <div className="filter-bar">
        <input
          className="field-input"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="field-input"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="">Sort</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>
        <button className="btn-secondary" onClick={load}>
          Apply
        </button>
      </div>

      <div className="product-grid">
        {products.map((p) => (
          <div
            className="product-card"
            key={p.id}
            onClick={() => onProductClick(p.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="product-image">
              <img src={p.image_url} alt={p.name} />
            </div>

            <div className="product-body">
              <h3 className="product-name">{p.name}</h3>
              <div className="product-meta">
                <span className="product-price">₹{p.price}</span>
                <span className="product-stock">Stock {p.stock}</span>
              </div>

              {/* Optional inline reviews */}
              {/* <ProductReviews productId={p.id} /> */}

              <div className="product-actions">
                <button
                  className="btn-primary-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(p.id);
                  }}
                >
                  Add to Cart
                </button>

                <button
                  className="btn-wishlist-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToWishlist(p.id);
                  }}
                >
                  ❤️ Wishlist
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- CART ---- */

function CartPage({ showToast }) {
  const [cart, setCart] = useState(null);
  const [address, setAddress] = useState("");
  const [paymentMethod] = useState("CARD");
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await getCart();
    setCart(data);
  }

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("authUser"));
    if (stored?.default_address) setAddress(stored.default_address);

    load();
  }, []);

  async function qty(itemId, q) {
    const res = await updateCartItem(itemId, Number(q));
    setCart(res);
  }

  async function remove(itemId) {
    const res = await deleteCartItem(itemId);
    setCart(res);
  }

  async function place() {
    setMsg("");
    try {
      const order = await checkout({
        deliveryAddress: address,
        paymentMethod
      });
      if (showToast) {
        showToast(`Order ${order.orderId} placed successfully`, "success");
      }
      await load();
    } catch (e) {
      setMsg("Checkout failed.");
      if (showToast) {
        showToast("Checkout failed", "error");
      }
    }
  }

  if (!cart)
    return (
      <div className="page">
        <h2>Loading...</h2>
      </div>
    );

  return (
    <div className="page">
      <h2 className="page-title">Your Cart</h2>

      {cart.items.length === 0 ? (
        <p>Cart empty</p>
      ) : (
        <>
          <table className="table">
            <tbody>
              {cart.items.map((item) => (
                <tr key={item.cart_item_id}>
                  <td>{item.name}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      className="qty-input"
                      onChange={(e) => qty(item.cart_item_id, e.target.value)}
                    />
                  </td>
                  <td>₹{item.price}</td>
                  <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                  <td>
                    <button
                      className="btn-secondary-sm"
                      onClick={() => remove(item.cart_item_id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Total: ₹{cart.total}</h3>

          <div className="checkout-section">
            <label>
              Delivery address
              <textarea
                className="field-input textarea"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>

            <button className="btn-primary" onClick={place}>
              Checkout
            </button>

            {msg && <p className="info-text">{msg}</p>}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- ORDERS ---- */

function OrdersPage() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    getMyOrders().then(setOrders);
  }, []);

  return (
    <div className="page">
      <h2 className="page-title">My Orders</h2>

      {orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <table className="table">
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>₹{o.total_amount}</td>
                <td>{o.status}</td>
                <td>{o.payment_method}</td>
                <td>{o.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---- ROOT APP ---- */

function App() {
  const [user, setUser] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [ragEnabled, setRagEnabled] = useState(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem("ragEnabled");
    return stored === "true";
  });
  const [toastState, setToastState] = useState({
    visible: false,
    message: "",
    type: "info"
  });

  const toastTimerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const u = localStorage.getItem("authUser");
    if (u) setUser(JSON.parse(u));
  }, []);

  // Handle RAG toggle
  function handleRagToggle(enabled) {
    setRagEnabled(enabled);
    localStorage.setItem("ragEnabled", enabled.toString());
    showToast(
      enabled ? "RAG Intelligence enabled" : "RAG Intelligence disabled",
      "info"
    );
  }

  function showToast(message, type = "info") {
    setToastState({ visible: true, message, type });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(
      () => setToastState((prev) => ({ ...prev, visible: false })),
      2200
    );
  }

  // NEW: call backend /auth/logout, then clear client state
  async function handleLogout() {
    try {
      await apiLogout();
    } catch (err) {
      console.error("Logout API failed (will still clear client state):", err);
    } finally {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
      setUser(null);
      navigate("/login");
      showToast("Logged out", "info");
    }
  }

  async function handleAddToCart(productId) {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await addToCart(productId, 1);
      showToast("Added to cart", "success");
    } catch {
      showToast("Unable to add to cart", "error");
    }
  }

  async function handleAddToWishlist(productId) {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await addToWishlist(productId);
      showToast("Added to wishlist", "success");
    } catch {
      showToast("Unable to add to wishlist", "error");
    }
  }

  function handleProductClick(productId) {
    setSelectedProductId(productId);
  }

  function handleCloseModal() {
    setSelectedProductId(null);
  }

  return (
    <div className="app-root">
      <Navbar
        user={user}
        onLogout={handleLogout}
        ragEnabled={ragEnabled}
        onRagToggle={handleRagToggle}
      />

      <div className="app-content">
        <Routes>
          <Route
            path="/"
            element={
              <CatalogPage
                onAddToCart={handleAddToCart}
                onAddToWishlist={handleAddToWishlist}
                onProductClick={handleProductClick}
              />
            }
          />
          <Route
            path="/login"
            element={
              <LoginPage
                onLogin={setUser}
                onLoginSuccess={(u) =>
                  showToast(`Welcome back, ${u.username}`, "success")
                }
              />
            }
          />
          <Route path="/cart" element={<CartPage showToast={showToast} />} />
          <Route path="/orders" element={<OrdersPage />} />

          {/* NEW ROUTES */}
          <Route
            path="/wishlist"
            element={
              user ? (
                <WishlistPage showToast={showToast} />
              ) : (
                <LoginPage
                  onLogin={setUser}
                  onLoginSuccess={(u) =>
                    showToast(`Welcome back, ${u.username}`, "success")
                  }
                />
              )
            }
          />
          <Route
            path="/profile"
            element={
              user ? (
                <ProfilePage showToast={showToast} />
              ) : (
                <LoginPage
                  onLogin={setUser}
                  onLoginSuccess={(u) =>
                    showToast(`Welcome back, ${u.username}`, "success")
                  }
                />
              )
            }
          />
          <Route
            path="/admin"
            element={
              user && user.is_admin ? (
                <AdminDashboardPage />
              ) : (
                <LoginPage
                  onLogin={setUser}
                  onLoginSuccess={(u) =>
                    showToast(`Welcome back, ${u.username}`, "success")
                  }
                />
              )
            }
          />
        </Routes>
      </div>

      {/* GLOBAL POPUP */}
      <Toast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
      />

      {/* PRODUCT INSIGHTS MODAL */}
      {selectedProductId && (
        <ProductInsightsModal
          productId={selectedProductId}
          onClose={handleCloseModal}
          ragEnabled={ragEnabled}
        />
      )}
    </div>
  );
}

export default App;

