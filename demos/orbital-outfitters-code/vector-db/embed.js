import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
import pg from 'pg';
import { Client } from '@opensearch-project/opensearch';
import { pipeline } from '@xenova/transformers';

const OPENSEARCH_HOST  = process.env.OPENSEARCH_HOST  ?? 'localhost';
const OPENSEARCH_PORT  = process.env.OPENSEARCH_PORT  ?? '9200';
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX ?? 'products';

const DB_HOST     = process.env.DB_HOST;
const DB_PORT     = process.env.DB_PORT;
const DB_NAME     = process.env.DB_NAME;
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_SSL      = process.env.DB_SSL === 'true';
const DB_SCHEMA   = process.env.DB_SCHEMA;

// ── Postgres ──────────────────────────────────────────────────────────────────
const { Client: PgClient } = pg;

const db = new PgClient({
  host:     DB_HOST,
  port:     Number(DB_PORT),
  database: DB_NAME,
  user:     DB_USER,
  password: DB_PASSWORD,
  ssl:      DB_SSL ? { rejectUnauthorized: false } : false,
});

await db.connect();
console.log('Connected to Postgres.');

const { rows: products } = await db.query(
  `SELECT product_id, name AS product_name, description AS product_description,
          image_url AS product_image_url
   FROM ${DB_SCHEMA}.products
   WHERE is_active = true`
);
console.log(`Fetched ${products.length} active products.`);

// ── OpenSearch ────────────────────────────────────────────────────────────────
const opensearch = new Client({
  node: `http://${OPENSEARCH_HOST}:${OPENSEARCH_PORT}`,
});

const indexExists = (await opensearch.indices.exists({ index: OPENSEARCH_INDEX })).body;

if (!indexExists) {
  await opensearch.indices.create({
    index: OPENSEARCH_INDEX,
    body: {
      settings: { 'index.knn': true },
      mappings: {
        properties: {
          embedding: {
            type:      'knn_vector',
            dimension: 384,
            method: { name: 'hnsw', engine: 'nmslib' },
          },
          product_id:          { type: 'keyword' },
          product_name:        { type: 'keyword' },
          product_description: { type: 'text' },
          product_image_url:   { type: 'keyword' },
        },
      },
    },
  });
  console.log(`Created index: ${OPENSEARCH_INDEX}`);
} else {
  console.log(`Index already exists: ${OPENSEARCH_INDEX}`);
}

// ── Embed & upsert ────────────────────────────────────────────────────────────
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

for (let i = 0; i < products.length; i++) {
  const product = products[i];

  const output = await extractor(product.product_description, {
    pooling:   'mean',
    normalize: true,
  });

  const embeddingVector = Array.from(output.data);

  await opensearch.index({
    index:   OPENSEARCH_INDEX,
    id:      product.product_id,
    body: {
      embedding:           embeddingVector,
      product_id:          product.product_id,
      product_name:        product.product_name,
      product_description: product.product_description,
      product_image_url:   product.product_image_url,
    },
    refresh: 'wait_for',
  });

  console.log(`Upserted ${product.product_id} (${i + 1}/${products.length})`);
}

// ── Shutdown ──────────────────────────────────────────────────────────────────
await db.end();
console.log('Embedding complete.');
