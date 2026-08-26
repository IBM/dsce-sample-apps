import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import { query } from '../db/pool.js';

const router = Router();

async function getOrCreateCart(userId) {
  // Upsert: if a cart exists (any status), reactivate it; otherwise create it.
  const result = await query(
    `INSERT INTO cart (user_id, status, created_at, updated_at)
     VALUES ($1, 'active', NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET status = 'active', updated_at = NOW()
     RETURNING cart_id, status, created_at, updated_at`,
    [userId],
  );
  return result.rows[0];
}

async function buildCartResponse(userId) {
  const cart = await getOrCreateCart(userId);

  const result = await query(
    `SELECT c.cart_id, c.status, c.created_at, c.updated_at,
            ci.cart_item_id, ci.product_id, ci.quantity, ci.unit_price, ci.added_at,
            p.name AS product_name, p.description AS product_description, p.image_url AS product_image_url, p.price
     FROM cart c
     LEFT JOIN cart_items ci ON ci.cart_id = c.cart_id
     LEFT JOIN products p ON p.product_id = ci.product_id
     WHERE c.user_id = $1 AND c.status = 'active'
     ORDER BY ci.cart_item_id`,
    [userId],
  );

  const firstRow = result.rows[0] ?? cart;
  const items = result.rows
    .filter((row) => row.cart_item_id)
    .map((row) => {
      const lineTotal = (Number(row.unit_price) * Number(row.quantity)).toFixed(2);
      return {
        cart_item_id: row.cart_item_id,
        product_id: row.product_id,
        product_name: row.product_name,
        product_description: row.product_description,
        product_image_url: row.product_image_url,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_total: lineTotal,
      };
    });

  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0).toFixed(2);

  return {
    cart_id: firstRow.cart_id,
    status: firstRow.status,
    created_at: firstRow.created_at,
    updated_at: firstRow.updated_at,
    items,
    subtotal,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    return res.json(await buildCartResponse(req.user.user_id));
  } catch {
    return res.status(500).json({ error: 'Failed to load cart' });
  }
});

router.post('/items', requireAuth, async (req, res) => {
  const { product_id, quantity } = req.body ?? {};

  if (!product_id || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'product_id and quantity >= 1 are required' });
  }

  try {
    const cart = await getOrCreateCart(req.user.user_id);
    const productResult = await query(
      `SELECT product_id, price
       FROM products
       WHERE product_id = $1 AND is_active = true`,
      [product_id],
    );

    const product = productResult.rows[0];

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const existingItem = await query(
      `SELECT cart_item_id, quantity
       FROM cart_items
       WHERE cart_id = $1 AND product_id = $2`,
      [cart.cart_id, product_id],
    );

    if (existingItem.rows[0]) {
      await query(
        `UPDATE cart_items
         SET quantity = quantity + $1
         WHERE cart_item_id = $2`,
        [quantity, existingItem.rows[0].cart_item_id],
      );
    } else {
      await query(
        `INSERT INTO cart_items (cart_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [cart.cart_id, product_id, quantity, product.price],
      );
    }

    await query(`UPDATE cart SET updated_at = NOW() WHERE cart_id = $1`, [cart.cart_id]);
    return res.status(201).json(await buildCartResponse(req.user.user_id));
  } catch {
    return res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

router.put('/items/:cart_item_id', requireAuth, async (req, res) => {
  const cartItemId = Number(req.params.cart_item_id);
  const { quantity } = req.body ?? {};

  if (!Number.isInteger(cartItemId) || !Number.isInteger(quantity)) {
    return res.status(400).json({ error: 'Valid cart_item_id and quantity are required' });
  }

  try {
    const ownership = await query(
      `SELECT ci.cart_item_id, c.cart_id
       FROM cart_items ci
       JOIN cart c ON c.cart_id = ci.cart_id
       WHERE ci.cart_item_id = $1 AND c.user_id = $2 AND c.status = 'active'`,
      [cartItemId, req.user.user_id],
    );

    if (!ownership.rows[0]) {
      return res.status(403).json({ error: 'Cart item does not belong to this user' });
    }

    if (quantity < 1) {
      await query(`DELETE FROM cart_items WHERE cart_item_id = $1`, [cartItemId]);
    } else {
      await query(
        `UPDATE cart_items
         SET quantity = $1
         WHERE cart_item_id = $2`,
        [quantity, cartItemId],
      );
    }

    await query(`UPDATE cart SET updated_at = NOW() WHERE cart_id = $1`, [ownership.rows[0].cart_id]);
    return res.json(await buildCartResponse(req.user.user_id));
  } catch {
    return res.status(500).json({ error: 'Failed to update cart item' });
  }
});

router.delete('/items/:cart_item_id', requireAuth, async (req, res) => {
  const cartItemId = Number(req.params.cart_item_id);

  if (!Number.isInteger(cartItemId)) {
    return res.status(400).json({ error: 'Valid cart_item_id is required' });
  }

  try {
    const ownership = await query(
      `SELECT ci.cart_item_id, c.cart_id
       FROM cart_items ci
       JOIN cart c ON c.cart_id = ci.cart_id
       WHERE ci.cart_item_id = $1 AND c.user_id = $2 AND c.status = 'active'`,
      [cartItemId, req.user.user_id],
    );

    if (!ownership.rows[0]) {
      return res.status(403).json({ error: 'Cart item does not belong to this user' });
    }

    await query(`DELETE FROM cart_items WHERE cart_item_id = $1`, [cartItemId]);
    await query(`UPDATE cart SET updated_at = NOW() WHERE cart_id = $1`, [ownership.rows[0].cart_id]);
    return res.json(await buildCartResponse(req.user.user_id));
  } catch {
    return res.status(500).json({ error: 'Failed to delete cart item' });
  }
});

export default router;
