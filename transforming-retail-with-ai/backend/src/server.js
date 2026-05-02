// backend/src/server.js
// CRITICAL: Instana collector MUST be the first require
require('@instana/collector')({
  tracing: {
    enabled: true,
    automaticTracingEnabled: true,
    stackTraceLength: 10
  },
  metrics: {
    transmissionDelay: 1000
  }
});

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const featureRoutes = require("./features_1_2_3_4_14");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "changeme-in-prod";

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Mount feature routes (/wishlist, /me, /admin/metrics, login trend, etc.)
app.use("/api", featureRoutes);

/* -------------------------------------------------------------
 * HEALTH CHECKS
 * ----------------------------------------------------------- */
app.get("/health/live", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/ready", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ready" });
  } catch (err) {
    console.error("Readiness check failed:", err.message);
    res.status(500).json({ status: "not_ready" });
  }
});

/* -------------------------------------------------------------
 * AUTH MIDDLEWARE FOR CORE API
 * ----------------------------------------------------------- */
function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.userId,
      username: payload.username,
      is_admin: payload.is_admin || false
    };
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/* -------------------------------------------------------------
 * HELPER: GET OR CREATE OPEN CART
 * ----------------------------------------------------------- */
async function getOrCreateCart(userId, client = null) {
  const executor = client || db;

  const result = await executor.query(
    "SELECT id FROM carts WHERE user_id = $1 AND status = 'OPEN' ORDER BY id DESC LIMIT 1",
    [userId]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  const insert = await executor.query(
    "INSERT INTO carts (user_id, status) VALUES ($1, 'OPEN') RETURNING id",
    [userId]
  );
  return insert.rows[0].id;
}

/* -------------------------------------------------------------
 * LOGIN (with logging + login_events insertion)
 * ----------------------------------------------------------- */
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};

  console.log("[LOGIN] Attempted login:", username);

  if (!username || !password) {
    console.warn("[LOGIN] Missing username/password");
    return res.status(400).json({ message: "Username and password required" });
  }

  try {
    // Fetch user
    const result = await db.query(
      `SELECT id, username, password_hash, default_address, is_admin
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      console.warn("[LOGIN] Invalid credentials: user not found", username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    let match = false;

    // bcrypt password check
    if (user.password_hash && user.password_hash.startsWith("$2")) {
      match = await bcrypt.compare(password, user.password_hash);
    } else {
      // first-time bcrypt conversion
      match = password === user.password_hash;
      if (match) {
        const newHash = await bcrypt.hash(password, 10);
        await db.query(
          "UPDATE users SET password_hash = $1 WHERE id = $2",
          [newHash, user.id]
        );
        console.log(
          "[LOGIN] Converted plaintext password → bcrypt for user_id:",
          user.id
        );
      }
    }

    if (!match) {
      console.warn("[LOGIN] Invalid password for user:", username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Log successful login in login_events
    console.log(
      "[LOGIN] Success → inserting login_events row for user_id:",
      user.id
    );
    await db.query("INSERT INTO login_events (user_id) VALUES ($1)", [user.id]);
    console.log("[LOGIN] login_events entry added.");

    // Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        is_admin: user.is_admin
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    console.log("[LOGIN] Login completed for:", username);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        default_address: user.default_address,
        is_admin: user.is_admin
      }
    });
  } catch (err) {
    console.error("[LOGIN] Internal error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * LOGOUT (stateless – logs event, frontend clears token)
 * ----------------------------------------------------------- */
app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    console.log(
      "[LOGOUT] User logging out:",
      req.user.username,
      "(id:",
      req.user.id,
      ")"
    );
    // If later you add a logout_events table, you can insert here.
    // For now it's stateless; frontend deletes the JWT from storage.
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("[LOGOUT] Error while logging out:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * PRODUCTS
 * ----------------------------------------------------------- */
app.get("/api/products", async (req, res) => {
  const { search, category, sort } = req.query;

  let query = "SELECT * FROM products WHERE 1=1";
  const params = [];
  let idx = 1;

  if (search) {
    query += ` AND (LOWER(name) LIKE $${idx} OR LOWER(description) LIKE $${idx})`;
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  if (category) {
    query += ` AND category = $${idx}`;
    params.push(category);
    idx++;
  }

  if (sort === "price_asc") {
    query += " ORDER BY price ASC";
  } else if (sort === "price_desc") {
    query += " ORDER BY price DESC";
  } else if (sort === "rating_desc") {
    query += " ORDER BY rating DESC NULLS LAST";
  } else {
    query += " ORDER BY id ASC";
  }

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("[PRODUCTS] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * CART – GET
 * ----------------------------------------------------------- */
app.get("/api/cart", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const cartId = await getOrCreateCart(userId);

    const items = await db.query(
      `SELECT ci.id AS cart_item_id, ci.quantity,
              p.id AS product_id, p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    const total = items.rows.reduce(
      (sum, row) => sum + Number(row.price) * row.quantity,
      0
    );

    res.json({ cartId, items: items.rows, total });
  } catch (err) {
    console.error("[CART] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * CART – ADD ITEM
 * ----------------------------------------------------------- */
app.post("/api/cart/add", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body || {};
  const qty = Number(quantity) || 1;

  if (!productId || qty <= 0) {
    return res
      .status(400)
      .json({ message: "Invalid product or quantity" });
  }

  try {
    const cartId = await getOrCreateCart(userId);

    const existing = await db.query(
      "SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2",
      [cartId, productId]
    );

    if (existing.rows.length > 0) {
      const newQty = existing.rows[0].quantity + qty;
      await db.query(
        "UPDATE cart_items SET quantity = $1 WHERE id = $2",
        [newQty, existing.rows[0].id]
      );
    } else {
      await db.query(
        "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)",
        [cartId, productId, qty]
      );
    }

    const items = await db.query(
      `SELECT ci.id AS cart_item_id, ci.quantity,
              p.id AS product_id, p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    const total = items.rows.reduce(
      (sum, row) => sum + Number(row.price) * row.quantity,
      0
    );

    res.json({ cartId, items: items.rows, total });
  } catch (err) {
    console.error("[CART ADD] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * CART – UPDATE ITEM
 * ----------------------------------------------------------- */
app.put("/api/cart/item/:itemId", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.itemId;
  const qty = Number(req.body.quantity);

  if (Number.isNaN(qty)) {
    return res.status(400).json({ message: "Invalid quantity" });
  }

  try {
    const cartId = await getOrCreateCart(userId);

    if (qty <= 0) {
      await db.query("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2", [
        itemId,
        cartId
      ]);
    } else {
      await db.query(
        "UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id = $3",
        [qty, itemId, cartId]
      );
    }

    const items = await db.query(
      `SELECT ci.id AS cart_item_id, ci.quantity,
              p.id AS product_id, p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    const total = items.rows.reduce(
      (sum, row) => sum + Number(row.price) * row.quantity,
      0
    );

    res.json({ cartId, items: items.rows, total });
  } catch (err) {
    console.error("[CART UPDATE] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * CART – DELETE ITEM
 * ----------------------------------------------------------- */
app.delete("/api/cart/item/:itemId", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.itemId;

  try {
    const cartId = await getOrCreateCart(userId);

    await db.query("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2", [
      itemId,
      cartId
    ]);

    const items = await db.query(
      `SELECT ci.id AS cart_item_id, ci.quantity,
              p.id AS product_id, p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    const total = items.rows.reduce(
      (sum, row) => sum + Number(row.price) * row.quantity,
      0
    );

    res.json({ cartId, items: items.rows, total });
  } catch (err) {
    console.error("[CART DELETE] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * MY ORDERS
 * ----------------------------------------------------------- */
app.get("/api/orders/my", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, total_amount, status, delivery_address,
              payment_method, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[ORDERS MY] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------------------------------------
 * CHECKOUT
 * ----------------------------------------------------------- */
app.post("/api/orders/checkout", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { deliveryAddress, paymentMethod } = req.body || {};

  if (!deliveryAddress || !paymentMethod) {
    return res.status(400).json({
      message: "Delivery address and payment method required"
    });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const cartId = await getOrCreateCart(userId, client);

    const cartItems = await client.query(
      `SELECT ci.id, ci.quantity,
              p.id AS product_id, p.stock, p.price, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1
       FOR UPDATE`,
      [cartId]
    );

    if (cartItems.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cart is empty" });
    }

    let totalAmt = 0;
    for (const item of cartItems.rows) {
      if (item.stock < item.quantity) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: `Insufficient stock for ${item.name}`,
          productId: item.product_id
        });
      }
      totalAmt += Number(item.price) * item.quantity;
    }

    for (const item of cartItems.rows) {
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, status, payment_method, delivery_address)
       VALUES ($1, $2, 'PLACED', $3, $4)
       RETURNING id`,
      [userId, totalAmt, paymentMethod, deliveryAddress]
    );

    const orderId = orderRes.rows[0].id;

    for (const item of cartItems.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    await client.query("UPDATE carts SET status = 'CONVERTED' WHERE id = $1", [
      cartId
    ]);
    await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);

    await client.query("COMMIT");

    console.log("[CHECKOUT] Order placed:", orderId);

    res.json({
      orderId,
      totalAmount: totalAmt,
      status: "PLACED"
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[CHECKOUT] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
});

/* -------------------------------------------------------------
 * START SERVER
 * ----------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`Retail backend running on port ${PORT}`);
});

