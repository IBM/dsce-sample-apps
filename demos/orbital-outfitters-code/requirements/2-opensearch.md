# Requirements: OpenSearch Vector DB (replaces ChromaDB)

Implements [`specifications/2-rag-opensearch.md`](../specifications/2-rag-opensearch.md).

---

## 1. Overview

Replace ChromaDB with OpenSearch as the vector store for the `/agentSearch` RAG pipeline.

**Scope of change:**

| Area | What changes |
|---|---|
| `vector-db/` | `embed.js` rewritten; `package.json` updated; `venv/` removed |
| `backend/` | `package.json` gains `@opensearch-project/opensearch`; `/agentSearch` handler swaps client |
| `rancher/docker-compose.yml` | `chromadb` service → `opensearch` service |
| `.env` | `CHROMA_*` vars removed; `OPENSEARCH_*` vars added |
| `.gitignore` | Remove `vector-db/chroma-data`; confirm `vector-db/node_modules/` is present |
| `openshift/jobs/` | Dockerfile healthcheck URL updated; Job ConfigMap keys updated |

**Nothing else changes.** Spec 3 (`/agentSearch` endpoint structure), Spec 5 (agentic search), and Spec 10 (OpenShift Job manifest shape) are unaffected except where explicitly called out below.

---

## 2. Environment Variables

### 2a. Variables to ADD to `.env` and `rancher/.env.docker.example`

```dotenv
# ── OpenSearch ────────────────────────────────────────────────────────────────
OPENSEARCH_HOST=localhost
OPENSEARCH_PORT=9200
OPENSEARCH_INDEX=products
```

**Environment-specific values** (mirrors the pattern in [`specifications/environments.md`](../specifications/environments.md)):

| Variable | Local (native) | Rancher (containers) | OpenShift |
|---|---|---|---|
| `OPENSEARCH_HOST` | `localhost` | `opensearch` | `opensearch` |
| `OPENSEARCH_PORT` | `9200` | `9200` | `9200` |
| `OPENSEARCH_INDEX` | `products` | `products` | `products` |

`OPENSEARCH_HOST` must use the Docker service name (`opensearch`) in all container environments so inter-container DNS resolves correctly.

### 2b. Variables to REMOVE from `.env` and `rancher/.env.docker.example`

```
CHROMA_HOST
CHROMA_PORT
CHROMA_SERVER_URL
```

Remove all lines containing `CHROMA_` from every env file. These are the vars documented in `specifications/environments.md` — that file must also be updated to replace the three `CHROMA_*` rows with the three `OPENSEARCH_*` rows above.

### 2c. Variables consumed by `vector-db/embed.js` (read from `.env`)

`embed.js` reads the following vars. All already exist in `.env` — no new DB values needed:

```
OPENSEARCH_HOST        # e.g. localhost
OPENSEARCH_PORT        # e.g. 9200
OPENSEARCH_INDEX       # e.g. products
DB_HOST                # fa089a8d-c3ba-41a6-b09e-744439606f53.bn2a2uid0up8mv7mv2ig.databases.appdomain.cloud
DB_PORT                # 30481
DB_NAME                # ibmclouddb
DB_USER                # ibm_cloud_631e0df5_bd8c_49bc_b3a4_a9b5024a38a1
DB_PASSWORD            # (from .env)
DB_SSL                 # true
DB_SCHEMA              # ai_retail_83032671
```

### 2d. Variables consumed by the backend `/agentSearch` handler

```
OPENSEARCH_HOST
OPENSEARCH_PORT
OPENSEARCH_INDEX
```

---

## 3. OpenSearch Docker Setup (Local Dev)

Run OpenSearch locally with a single `docker run` command. No Python venv, no Chroma client — OpenSearch is fully self-contained.

```bash
docker run -d \
  --name opensearch \
  -p 9200:9200 \
  -e discovery.type=single-node \
  -e DISABLE_SECURITY_PLUGIN=true \
  opensearchproject/opensearch:2.13.0
```

**Verify it is healthy before running `embed.js`:**

```bash
curl -s http://localhost:9200/_cluster/health | jq .status
# expected: "green" or "yellow"
```

> **Air-gapped / OpenShift note:** The ROKS cluster (`orbital-suppliers`, `us-south`) has no public internet egress. Do **not** reference `opensearchproject/opensearch` in any pod spec or Job manifest. Build the image locally and push to ICR (`us.icr.io/orbital-suppliers/opensearch:2.13.0`) before deploying — see Spec 9 for the ICR push workflow.

---

## 4. Directory Structure

All new files live under `vector-db/`. No files move outside this directory.

```
vector-db/
├── embed.js          ← rewritten (ES module, OpenSearch client)
├── package.json      ← new (replaces any existing one)
└── node_modules/     ← gitignored, created by npm install
```

Files to **delete** from `vector-db/` if they exist:

```
vector-db/chroma-data/     ← remove entire directory
vector-db/embed.py         ← remove if exists (Python predecessor)
vector-db/requirements.txt ← remove if exists
```

`.gitignore` already contains `vector-db/node_modules/` and `vector-db/.cache/`. Confirm `vector-db/chroma-data/` is not listed as an exception; if it is, remove that line.

---

## 5. `embed.js` Implementation

**File:** `vector-db/embed.js`  
**Module type:** ES module (`"type": "module"` in `package.json`)  
**Entry point:** run directly with `node vector-db/embed.js` from the repo root.

### 5a. Load environment variables

```javascript
import 'dotenv/config';

const OPENSEARCH_HOST  = process.env.OPENSEARCH_HOST;
const OPENSEARCH_PORT  = process.env.OPENSEARCH_PORT;
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX;

const DB_HOST     = process.env.DB_HOST;
const DB_PORT     = process.env.DB_PORT;
const DB_NAME     = process.env.DB_NAME;
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_SSL      = process.env.DB_SSL === 'true';
const DB_SCHEMA   = process.env.DB_SCHEMA;
```

`dotenv/config` silently no-ops when `.env` is absent (container deployments inject vars via `envFrom`).

### 5b. Connect to Postgres and fetch active products

Use `pg` (the `pg` npm package). Connect with SSL when `DB_SSL=true`. Query all active products from the correct schema:

```javascript
import pg from 'pg';
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

const { rows: products } = await db.query(
  `SELECT product_id, product_name, product_description, product_image_url
   FROM ${DB_SCHEMA}.products
   WHERE is_active = true`
);
```

`rejectUnauthorized: false` is required for IBM Cloud PostgreSQL's self-signed CA in this project.

### 5c. Create the OpenSearch client

```javascript
import { Client } from '@opensearch-project/opensearch';

const opensearch = new Client({
  node: `http://${OPENSEARCH_HOST}:${OPENSEARCH_PORT}`,
});
```

No auth headers — `DISABLE_SECURITY_PLUGIN=true` is set on the local container and the Rancher/OpenShift service.

### 5d. Create the k-NN index (idempotent)

Check for existence first so the script is safely re-runnable:

```javascript
const indexExists = await opensearch.indices.exists({ index: OPENSEARCH_INDEX });

if (!indexExists.body) {
  await opensearch.indices.create({
    index: OPENSEARCH_INDEX,
    body: {
      settings: {
        'index.knn': true,
      },
      mappings: {
        properties: {
          embedding: {
            type:      'knn_vector',
            dimension: 384,
            method: {
              name:      'hnsw',
              engine:    'nmslib',
              // space_type defaults to 'l2'; cosine similarity is not required
              // for all-MiniLM-L6-v2 with OpenSearch knn
            },
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
```

**Index settings rationale:**

| Setting | Value | Why |
|---|---|---|
| `index.knn` | `true` | Activates the k-NN plugin for this index |
| `dimension` | `384` | `all-MiniLM-L6-v2` output size |
| `engine` | `nmslib` | Default k-NN engine in OpenSearch 2.x |
| `method.name` | `hnsw` | Hierarchical NSW graph; best accuracy/speed trade-off |

### 5e. Embed each product and upsert to OpenSearch

```javascript
import { pipeline } from '@xenova/transformers';

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

for (let i = 0; i < products.length; i++) {
  const product = products[i];

  // Generate 384-dim embedding from product_description
  const output = await extractor(product.product_description, {
    pooling:   'mean',
    normalize: true,
  });

  // output.data is a Float32Array; OpenSearch requires a plain JS Array
  const embeddingVector = Array.from(output.data);

  await opensearch.index({
    index:   OPENSEARCH_INDEX,
    id:      product.product_id,   // upsert: existing doc with same _id is replaced
    body: {
      embedding:           embeddingVector,
      product_id:          product.product_id,
      product_name:        product.product_name,
      product_description: product.product_description,
      product_image_url:   product.product_image_url,
    },
    refresh: 'wait_for',  // index is queryable immediately after each upsert
  });

  console.log(`Upserted ${product.product_id} (${i + 1}/${products.length})`);
}
```

**Key implementation notes:**

- `pooling: 'mean'` + `normalize: true` — required options for `all-MiniLM-L6-v2` to produce correct sentence embeddings. Must match the options used at query time in the backend.
- `Array.from(output.data)` — `Float32Array` is not JSON-serialisable; convert before passing to the client.
- `id: product.product_id` — using the product ID as `_id` makes the operation a natural upsert (re-run overwrites, no duplicates).
- `refresh: 'wait_for'` — ensures each document is searchable before moving to the next. Acceptable for a one-off batch job; do not use in high-throughput scenarios.

### 5f. Shutdown

```javascript
await db.end();
console.log('Embedding complete.');
```

No explicit OpenSearch client close is needed — the HTTP client cleans up on process exit.

---

## 6. `package.json`

**File:** `vector-db/package.json`

```json
{
  "name": "vector-db",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "embed": "node embed.js"
  },
  "dependencies": {
    "@opensearch-project/opensearch": "^2",
    "@xenova/transformers": "^2",
    "dotenv": "^16",
    "pg": "^8"
  }
}
```

Install from `vector-db/`:

```bash
cd vector-db && npm install
```

The `@xenova/transformers` package downloads `Xenova/all-MiniLM-L6-v2` from HuggingFace on first run and caches it to `vector-db/.cache/` (already gitignored). For OpenShift, the model must be baked into the image at build time — see Section 8 and Spec 10.

---

## 7. Backend `/agentSearch` Query

**File:** `backend/` (the existing `/agentSearch` handler — do not change route structure or response shape)

### 7a. Install the client in `backend/`

```bash
cd backend && npm install @opensearch-project/opensearch@^2
```

### 7b. Instantiate the client (module-level singleton)

```javascript
import { Client } from '@opensearch-project/opensearch';

const opensearch = new Client({
  node: `http://${process.env.OPENSEARCH_HOST}:${process.env.OPENSEARCH_PORT}`,
});
```

Read `OPENSEARCH_HOST`, `OPENSEARCH_PORT`, and `OPENSEARCH_INDEX` from `process.env` (loaded via `dotenv` at startup, identical to every other backend env var).

### 7c. Embed the user query

Use the same model and same options as `embed.js`. The model **must match** — a query embedded with different options will return wrong results:

```javascript
import { pipeline } from '@xenova/transformers';

// Initialise once at module load (lazy-loads the model on first call)
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// Inside the /agentSearch handler:
const queryOutput = await extractor(userQuery, { pooling: 'mean', normalize: true });
const queryEmbedding = Array.from(queryOutput.data);
```

### 7d. OpenSearch knn query

Return the top 4 nearest neighbours:

```javascript
const result = await opensearch.search({
  index: process.env.OPENSEARCH_INDEX,
  body: {
    size: 4,
    query: {
      knn: {
        embedding: {
          vector: queryEmbedding,  // plain JS Array of 384 floats
          k:      4,
        },
      },
    },
  },
});

const products = result.body.hits.hits.map(h => h._source);
// products is Array<{ product_id, product_name, product_description, product_image_url }>
// Pass to the watsonx Orchestrate agent call unchanged (same shape as ChromaDB results)
```

**Query shape contract:**

| Field | Value | Notes |
|---|---|---|
| `size` | `4` | Max results returned in the HTTP response body |
| `query.knn.embedding.vector` | `Array<number>` (length 384) | Must be plain Array, not Float32Array |
| `query.knn.embedding.k` | `4` | k-NN neighbours to retrieve; must equal `size` |
| `result.body.hits.hits[n]._source` | product object | All stored fields are returned; no `_fields` filter needed |

The response shape passed to the watsonx Orchestrate call and returned to the frontend (`{ agent_response, products[] }`) is **unchanged** — only the source of `products[]` changes.

---

## 8. Rancher `docker-compose.yml` — OpenSearch Service

Replace the `chromadb` service block with the following. All other services are unchanged except the `backend` service's `environment` section (swap `CHROMA_*` for `OPENSEARCH_*`).

### 8a. New `opensearch` service

```yaml
opensearch:
  image: opensearchproject/opensearch:2.13.0
  container_name: opensearch
  environment:
    - discovery.type=single-node
    - DISABLE_SECURITY_PLUGIN=true
  ports:
    - "9200:9200"
  healthcheck:
    test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health || exit 1"]
    interval: 15s
    timeout: 10s
    retries: 5
    start_period: 30s
```

No named volume is required for local Rancher usage — the container's ephemeral storage is sufficient because `embed.js` re-populates the index on every run. If persistence across container restarts is needed, add:

```yaml
    volumes:
      - opensearch-data:/usr/share/opensearch/data

volumes:
  opensearch-data:
```

### 8b. Updated `backend` service environment block

Remove `CHROMA_*` entries. Add:

```yaml
    environment:
      # ... existing vars unchanged ...
      - OPENSEARCH_HOST=opensearch        # Docker service name
      - OPENSEARCH_PORT=9200
      - OPENSEARCH_INDEX=${OPENSEARCH_INDEX}
```

### 8c. `embed` service (if defined in docker-compose)

If a separate `embed` service runs `embed.js` in Rancher, update its environment the same way — replace `CHROMA_*` with the three `OPENSEARCH_*` vars and add `depends_on: opensearch` with `condition: service_healthy`.

---

## 9. Validation

Run these checks after `embed.js` completes to confirm the index is populated correctly.

### 9a. Cluster health

```bash
curl -s http://localhost:9200/_cluster/health | jq '{status: .status, active_shards: .active_shards}'
```

Expected: `status` is `"green"` or `"yellow"` (single-node clusters are always `"yellow"`).

### 9b. Index exists and has correct mapping

```bash
curl -s http://localhost:9200/products/_mapping | jq '.products.mappings.properties | keys'
```

Expected output includes: `["embedding", "product_description", "product_id", "product_image_url", "product_name"]`

### 9c. Document count matches active product count

```bash
curl -s http://localhost:9200/products/_count | jq .count
```

Expected: the number of rows returned by `SELECT COUNT(*) FROM ai_retail_83032671.products WHERE is_active = true` on the IBM Cloud PostgreSQL database. These two numbers must be equal.

### 9d. Spot-check a document by `product_id`

```bash
curl -s http://localhost:9200/products/_doc/sprocket_001 | jq '{id: ._id, name: ._source.product_name}'
```

Replace `sprocket_001` with an actual `product_id` from the database. Expected: `_found: true` with the correct `product_name`.

### 9e. End-to-end knn query smoke test

```bash
# Requires: a 384-element vector (abbreviated here for readability)
curl -s -X POST http://localhost:9200/products/_search \
  -H 'Content-Type: application/json' \
  -d '{
    "size": 4,
    "query": {
      "knn": {
        "embedding": {
          "vector": [0.01, 0.02, ...],
          "k": 4
        }
      }
    }
  }' | jq '.hits.hits | length'
```

Expected: `4` (or fewer if the index has fewer than 4 documents).

Use the `/agentSearch` endpoint directly for a real end-to-end test — this curl is only useful for confirming the index responds to knn queries before the backend is running.

---

## 10. OpenShift Job Updates (Spec 10 carry-forward)

The following changes to `openshift/jobs/` are required as a consequence of this spec. They are called out here so the backend developer and the OpenShift developer are aligned:

| File | Change |
|---|---|
| `openshift/jobs/Dockerfile.embed` | Replace ChromaDB healthcheck poll URL `http://chromadb:8000/api/v2/heartbeat` with `http://opensearch:9200/_cluster/health` |
| `openshift/jobs/embed-job.yaml` | In `envFrom` ConfigMap (`app-config`), replace `CHROMA_HOST`, `CHROMA_PORT`, `CHROMA_COLLECTION_NAME` keys with `OPENSEARCH_HOST`, `OPENSEARCH_PORT`, `OPENSEARCH_INDEX` |
| `openshift/jobs/download-model.mjs` | No change — model download is independent of the vector store |

No changes to `deploy.sh`, the Job TTL, init container structure, or ICR image push workflow.
