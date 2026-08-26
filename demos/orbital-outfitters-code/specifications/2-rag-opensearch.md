# Specification 2.1: RAG Vector Search using OpenSearch

This specification replaces [Spec 2 (ChromaDB)](2-rag-chromadb.md) with OpenSearch as the vector store. All other specs remain unchanged — the `/agentSearch` endpoint in Spec 3, the agentic search in Spec 5, and the embed Job in Spec 10 all continue to work; only the underlying vector DB client and server change.

## Prerequisites

Load the following skills plus any others that seem relevant — new ones may be added over time:
- `udi-opensearch` — UDI ingestion pipelines into OpenSearch, embeddings, and connection registration

## Requirements

- **Directory structure:** All new files go under [`./vector-db`](../vector-db). Replace `embed.js` in place — Spec 10's Job builds from that path unchanged.
- All environment variables must be read from `.env`.

## OpenSearch Server

Run OpenSearch locally using Docker. No Python venv is needed — OpenSearch is a self-contained container.

```bash
docker run -d \
  --name opensearch \
  -p 9200:9200 \
  -e discovery.type=single-node \
  -e DISABLE_SECURITY_PLUGIN=true \
  opensearchproject/opensearch:2.13.0
```

Health check endpoint: `GET http://localhost:9200/_cluster/health`

> **OpenShift / air-gapped note:** The cluster has no public internet egress. Build the OpenSearch image locally and push it to ICR, or switch to IBM Cloud OpenSearch (see [Spec 9](9-containerize-openshift.md)). Do **not** reference `opensearchproject/opensearch` directly in any pod spec.

### Network Configuration

The server defaults to `http://localhost:9200`. For container networking (Rancher / OpenShift), expose on `0.0.0.0` and update `OPENSEARCH_HOST` in `.env` to the service name (e.g. `opensearch`).

## Node.js Client

Install the official OpenSearch JavaScript client inside `vector-db/`:

```bash
npm install @opensearch-project/opensearch@^2
```

Instantiate the client:

```javascript
import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: `http://${OPENSEARCH_HOST}:${OPENSEARCH_PORT}`,
});
```

## Step 1: Create the Products Index

Before embedding, create (or confirm existence of) a `k-NN` index sized for `all-MiniLM-L6-v2`'s 384-dimensional vectors:

```javascript
await client.indices.create({
  index: OPENSEARCH_INDEX,
  body: {
    settings: { 'index.knn': true },
    mappings: {
      properties: {
        embedding:           { type: 'knn_vector', dimension: 384, method: { name: 'hnsw', engine: 'nmslib' } },
        product_id:          { type: 'keyword' },
        product_name:        { type: 'keyword' },
        product_description: { type: 'text' },
        product_image_url:   { type: 'keyword' },
      },
    },
  },
});
```

Use `existsAlias` / `exists` to skip creation if the index already exists — the embed script must be safely re-runnable.

## Step 2: Generate Embeddings and Populate OpenSearch

Use `@xenova/transformers/all-MiniLM-L6-v2` (384 dimensions) — identical to Spec 2. The same model must be used at query time in the backend.

For each active product, embed `product_description` then upsert the document using the product's `product_id` as the document `_id`:

```javascript
await client.index({
  index:   OPENSEARCH_INDEX,
  id:      product.product_id,
  body: {
    embedding:           embeddingVector,  // Float32Array → plain JS array
    product_id:          product.product_id,
    product_name:        product.product_name,
    product_description: product.product_description,
    product_image_url:   product.product_image_url,
  },
  refresh: 'wait_for',
});
```

Log progress per product (e.g. `Upserted sprocket_001 (1/50)`).

## Step 3: Backend Query Change (Spec 3 `/agentSearch`)

In the backend's `/agentSearch` handler, replace the ChromaDB query with an OpenSearch `knn` query returning the top 4 results:

```javascript
const result = await opensearchClient.search({
  index: OPENSEARCH_INDEX,
  body: {
    size: 4,
    query: {
      knn: {
        embedding: { vector: queryEmbedding, k: 4 },
      },
    },
  },
});

const products = result.body.hits.hits.map(h => h._source);
```

Install `@opensearch-project/opensearch` in `backend/` as well.

## Cleanup

- **Environment variables:** Add to `.env` and `rancher/.env.docker.example`:

  ```
  # ── OpenSearch ────────────────────────────────────────────────────────────────
  OPENSEARCH_HOST=localhost
  OPENSEARCH_PORT=9200
  OPENSEARCH_INDEX=products
  ```

  Remove the `CHROMA_*` variables.

- **`.gitignore`:** Remove any `vector-db/chroma-data` exception added in Spec 2. Add `vector-db/node_modules/` if not already present. OpenSearch data lives in the container volume, not the repo.

- **Rancher `docker-compose.yml`:** Replace the `chromadb` service with the `opensearch` container shown above. Update the `backend` service to inject `OPENSEARCH_*` env vars instead of `CHROMA_*`.

- **Spec 10 (OpenShift embed Job):** Update `openshift/jobs/Dockerfile.embed` — replace the ChromaDB healthcheck poll URL (`/api/v2/heartbeat`) with `http://opensearch:9200/_cluster/health`. Update the Job's `envFrom` ConfigMap to supply `OPENSEARCH_HOST`, `OPENSEARCH_PORT`, `OPENSEARCH_INDEX` instead of `CHROMA_*`. No other changes to `deploy.sh` or the Job manifest structure are required.
