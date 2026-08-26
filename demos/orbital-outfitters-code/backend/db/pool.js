import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const { Pool } = pg;

const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
});

pool.on('connect', async (client) => {
  await client.query(`SET search_path TO ${process.env.DB_SCHEMA}`);
});

export async function query(text, params) {
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA}`);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export default pool;
