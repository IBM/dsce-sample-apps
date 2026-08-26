import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import requireAuth from '../middleware/auth.js';
import { query } from '../db/pool.js';

const router = Router();

const userSelect = `
  SELECT user_id, first_name, last_name, email, username, area_code, phone,
         address_1, address_2, city, state, zip_code,
         email_opt_in, created_at, password_hash
  FROM users
`;

const profileFields = `
  user_id, first_name, last_name, email, username,
  area_code, phone, address_1, address_2, city, state, zip_code,
  email_opt_in, created_at
`;

router.post('/login', async (req, res) => {
  const { login, password } = req.body ?? {};

  if (!login || !password) {
    return res.status(400).json({ error: 'login and password are required' });
  }

  try {
    const trimmedLogin = String(login).trim();
    const emailLower = trimmedLogin.includes('@') ? trimmedLogin.toLowerCase() : null;
    const result = await query(
      `${userSelect}
       WHERE email = LOWER(TRIM($1)) OR username = $1
       LIMIT 1`,
      [trimmedLogin],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const digest = crypto
      .createHmac('sha256', process.env.PASSWORD_HASH_SECRET)
      .update(`${emailLower ?? user.email.toLowerCase().trim()}_${password}`)
      .digest('hex');

    if (digest !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
    );

    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

router.get('/random-user', async (_req, res) => {
  try {
    const result = await query(
      `SELECT email FROM users ORDER BY RANDOM() LIMIT 1`,
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'No users found' });
    return res.json({ email: user.email, password: process.env.USER_PASSWORD });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch random user' });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT ${profileFields}
       FROM users
       WHERE user_id = $1`,
      [req.user.user_id],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch {
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  const allowedFields = [
    'first_name',
    'last_name',
    'phone',
    'area_code',
    'address_1',
    'address_2',
    'city',
    'state',
    'zip_code',
    'email_opt_in',
  ];

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, field)) {
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  values.push(req.user.user_id);

  try {
    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE user_id = $${values.length}
       RETURNING ${profileFields}`,
      values,
    );

    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

export default router;
