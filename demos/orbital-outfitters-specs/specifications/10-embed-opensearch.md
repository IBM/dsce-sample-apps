# Specification 10: Embed Product Data into OpenSearch on OpenShift

Run `vector-db/embed.js` inside the cluster as a Kubernetes **Job**, populating OpenSearch with product embeddings from IBM Cloud PostgreSQL. Run this after Specs 8 and 9 are complete and all pods are `Ready`.

A Job is used rather than running `embed.js` locally because OpenSearch is only reachable inside the cluster via ClusterIP. The Job uses internal networking and is safely re-runnable on demand. An init container on the OpenSearch StatefulSet was ruled out — it would re-embed on every pod restart.

## Prerequisites

- All pods in `orbital-suppliers` namespace are `Ready` (`oc get pods -n orbital-suppliers`)
- Load skill: `ibm-cloud`

---

## Step 1: Build the embed image

Place `Dockerfile.embed` and `embed-job.yaml` under `openshift/jobs/`. The build context must be the repo root so the Dockerfile can `COPY vector-db/`.

### Dockerfile requirements

- Use `FROM node:20` (Debian-based, same as backend — required for `onnxruntime-node` glibc binaries).
- Install `curl` via `apt-get` — the same image is reused as the `wait-for-opensearch` init container. Do not use a separate public image (`curlimages/curl`, `busybox`, etc.) — the cluster cannot pull from public registries.
- **Bake the embedding model at build time.** `@xenova/transformers` downloads `Xenova/all-MiniLM-L6-v2` from HuggingFace at runtime — the cluster has no internet egress and this will time out. Add a helper script and run it during `docker build` (your local machine has internet access):

  ```js
  // openshift/jobs/download-model.mjs
  import { pipeline, env } from '@xenova/transformers';
  env.allowLocalModels = true;
  await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  process.exit(0);
  ```

  ```dockerfile
  COPY openshift/jobs/download-model.mjs ./vector-db/download-model.mjs
  RUN cd vector-db && node download-model.mjs
  ```

- Use `vector-db/embed.js` **unchanged** — env vars are injected via the Job's `envFrom` at runtime.

### Build and push

```bash
set -a; source .env; set +a
REGISTRY="${ICR_HOSTNAME}/${ICR_NAMESPACE}"

docker build --platform linux/amd64 -f openshift/jobs/Dockerfile.embed \
  -t "${REGISTRY}/embed:latest" .
docker push "${REGISTRY}/embed:latest"
```

---

## Step 2: Create the Job manifest

`openshift/jobs/embed-job.yaml`:

- Set `ttlSecondsAfterFinished: 3600` — the Job auto-cleans after 1 hour. Stream logs before then if needed.
- Add a `wait-for-opensearch` init container using the `embed` image that polls `/_cluster/health` before starting:

  ```bash
  until curl -sf http://opensearch:9200/_cluster/health | grep -qv '"status":"red"'; do
    echo "Waiting for OpenSearch..."; sleep 5;
  done
  echo "OpenSearch is ready."
  ```

- The main `embed` container uses `envFrom` referencing `app-config` (ConfigMap) and `app-secrets` (Secret) from Spec 9 — no additional env var configuration needed.

---

## Step 3: Run the job

Apply the manifest after `deploy.sh` completes and OpenSearch is `Ready`:

```bash
oc apply -f openshift/jobs/embed-job.yaml -n orbital-suppliers
oc logs -f job/embed-job -n orbital-suppliers
oc wait --for=condition=complete job/embed-job -n orbital-suppliers --timeout=600s
```

Verify the index was populated:

```bash
oc exec statefulset/opensearch -n orbital-suppliers -- \
  curl -s http://localhost:9200/products/_count
```

---

## Re-running

`embed.js` uses upsert — re-running is safe and updates changed products without duplicating vectors.

```bash
oc delete job embed-job -n orbital-suppliers
oc apply -f openshift/jobs/embed-job.yaml -n orbital-suppliers
```

---

## Environment variables

All injected via cluster resources — no changes to the Job manifest needed between environments.

| Variable | Source |
|----------|--------|
| `OPENSEARCH_HOST`, `OPENSEARCH_PORT`, `OPENSEARCH_INDEX` | ConfigMap `app-config` |
| `DB_HOST` (private VPE hostname), `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_SSL` | ConfigMap `app-config` |
| `DB_USER`, `DB_PASSWORD` | Secret `app-secrets` |
