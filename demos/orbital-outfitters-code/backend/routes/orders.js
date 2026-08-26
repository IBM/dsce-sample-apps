import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import pool, { query } from '../db/pool.js';

const router = Router();
const TAX_RATE = 0.0798;

router.post('/', requireAuth, async (req, res) => {
  const {
    shipping_address_1,
    shipping_address_2 = null,
    shipping_city,
    shipping_state,
    shipping_zip,
  } = req.body ?? {};

  if (!shipping_address_1 || !shipping_city || !shipping_state || !shipping_zip) {
    return res.status(400).json({ error: 'Missing shipping fields' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA}`);

    const cartResult = await client.query(
      `SELECT c.cart_id, ci.cart_item_id, ci.product_id, ci.quantity, ci.unit_price
       FROM cart c
       JOIN cart_items ci ON ci.cart_id = c.cart_id
       WHERE c.user_id = $1 AND c.status = 'active'
       ORDER BY ci.cart_item_id`,
      [req.user.user_id],
    );

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const cartId = cartResult.rows[0].cart_id;
    const items = cartResult.rows.map((item) => ({
      ...item,
      line_total: (Number(item.unit_price) * Number(item.quantity)).toFixed(2),
    }));

    const subtotalNumber = items.reduce((sum, item) => sum + Number(item.line_total), 0);
    const taxAmountNumber = Number((subtotalNumber * TAX_RATE).toFixed(2));
    const shippingCostNumber = 0;
    const totalAmountNumber = Number((subtotalNumber + taxAmountNumber + shippingCostNumber).toFixed(2));
    const orderNumber = `ORD-${Date.now()}`;

    const orderResult = await client.query(
      `INSERT INTO orders (
         order_number, user_id, status, subtotal, shipping_cost, tax_rate, tax_amount,
         total_amount, shipping_address_1, shipping_address_2,
         shipping_city, shipping_state, shipping_zip, created_at, updated_at
       )
       VALUES (
         $1, $2, 'processing', $3, $4, $5, $6,
         $7, $8, $9,
         $10, $11, $12, NOW(), NOW()
       )
       RETURNING order_id, order_number, status, subtotal, tax_rate, tax_amount,
                 shipping_cost, total_amount, shipping_address_1, shipping_address_2,
                 shipping_city, shipping_state, shipping_zip, created_at`,
      [
        orderNumber,
        req.user.user_id,
        subtotalNumber.toFixed(2),
        shippingCostNumber.toFixed(2),
        TAX_RATE.toFixed(4),
        taxAmountNumber.toFixed(2),
        totalAmountNumber.toFixed(2),
        shipping_address_1,
        shipping_address_2,
        shipping_city,
        shipping_state,
        shipping_zip,
      ],
    );

    const order = orderResult.rows[0];
    const createdItems = [];

    for (const item of items) {
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING order_item_id, product_id, quantity, unit_price, line_total`,
        [order.order_id, item.product_id, item.quantity, item.unit_price, item.line_total],
      );
      createdItems.push(itemResult.rows[0]);
    }

    await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
    await client.query(
      `UPDATE cart SET status = 'completed', updated_at = NOW() WHERE cart_id = $1`,
      [cartId],
    );

    await client.query('COMMIT');
    return res.status(201).json({ ...order, items: createdItems });
  } catch {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const ordersResult = await query(
      `SELECT order_id, order_number, status, subtotal, tax_amount, shipping_cost,
              total_amount, shipping_address_1, shipping_address_2,
              shipping_city, shipping_state, shipping_zip, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.user_id],
    );

    return res.json({ orders: ordersResult.rows });
  } catch {
    return res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA}`);

    const detailResult = await client.query(
      `SELECT o.order_id, o.order_number, o.status,
              o.subtotal, o.tax_rate, o.tax_amount, o.shipping_cost, o.total_amount,
              o.shipping_address_1, o.shipping_address_2,
              o.shipping_city, o.shipping_state, o.shipping_zip,
              o.created_at,
              json_agg(
                json_build_object(
                  'order_item_id', oi.order_item_id,
                  'product_id', oi.product_id,
                  'product_name', p.name,
                  'product_image_url', p.image_url,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'line_total', oi.line_total
                ) ORDER BY oi.order_item_id
              ) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       JOIN products p ON p.product_id = oi.product_id
       WHERE o.order_id = $1 AND o.user_id = $2
       GROUP BY o.order_id`,
      [orderId, req.user.user_id],
    );

    if (detailResult.rows[0]) {
      return res.json(detailResult.rows[0]);
    }

    const existsResult = await client.query(`SELECT user_id FROM orders WHERE order_id = $1`, [orderId]);

    if (!existsResult.rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(403).json({ error: 'Order does not belong to this user' });
  } catch {
    return res.status(500).json({ error: 'Failed to load order' });
  } finally {
    client.release();
  }
});

export default router;
