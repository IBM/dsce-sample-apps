import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Invalid page or limit' });
  }

  const conditions = ['is_active = true'];
  const params = [];

  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  if (req.query.category) {
    params.push(req.query.category);
    conditions.push(`category = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  try {
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM products
       WHERE ${whereClause}`,
      params,
    );

    const productParams = [...params, limit, offset];
    const productsResult = await query(
      `SELECT product_id, name AS product_name, description AS product_description,
              image_url AS product_image_url, category, price, currency,
              in_stock, inventory_quantity, shipping_days,
              width_inches, height_inches, depth_inches, weight_lbs,
              feature1, feature2, feature3, feature4
       FROM products
       WHERE ${whereClause}
       ORDER BY name
       LIMIT $${productParams.length - 1} OFFSET $${productParams.length}`,
      productParams,
    );

    return res.json({
      products: productsResult.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.product_id, p.name AS product_name, p.description AS product_description,
              p.image_url AS product_image_url, p.category, p.price, p.currency,
              p.in_stock, p.inventory_quantity, p.shipping_days,
              p.width_inches, p.height_inches, p.depth_inches, p.weight_lbs,
              p.feature1, p.feature2, p.feature3, p.feature4,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', r.id,
                    'review', r.review,
                    'score', r.score,
                    'reviewer_initials', r.reviewer_initials,
                    'created_at', r.created_at
                  ) ORDER BY r.created_at DESC
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS reviews
       FROM products p
       LEFT JOIN product_reviews r ON r.product_id = p.product_id
       WHERE p.product_id = $1
       GROUP BY p.product_id`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Failed to load product' });
  }
});

export default router;
