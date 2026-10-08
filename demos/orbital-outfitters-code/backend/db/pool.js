import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const { Pool } = pg;

// Validate DB_SCHEMA is a safe identifier before embedding it in SQL.
// PostgreSQL SET search_path does not support parameterised ($1) placeholders,
// so we must allowlist the value ourselves (letters, digits, underscores only).
const rawSchema = process.env.DB_SCHEMA ?? 'public';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(rawSchema)) {
  throw new Error(`DB_SCHEMA contains invalid characters: "${rawSchema}"`);
}
const DB_SCHEMA = rawSchema;

// Only enable SSL when explicitly requested; always require the server cert to
// be verified so we do not silently connect to a MITM endpoint.
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
});

pool.on('connect', async (client) => {
  // DB_SCHEMA has been validated as a safe identifier above.
  await client.query(`SET search_path TO ${DB_SCHEMA}`);
});

export async function query(text, params) {
  const client = await pool.connect();

  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export default pool;
