# Specification 10: Deploy the Tool Services to IBM Code Engine
The following specification outlines how to deploy `search_contract_clause` and `regenerate_pdf` to IBM Cloud Code Engine so watsonx Orchestrate (a SaaS service) can call them over public HTTPS.

## Prerequisites
Check each item before proceeding. Stop and tell the user if anything is missing.

| Tool | Check |
|---|---|
| `ibmcloud` CLI + `code-engine` and `container-registry` plugins | `ibmcloud version` |
| Docker / Podman / Rancher running | `docker info` |
| `.env` values | `IBMCLOUD_API_KEY`, `IBM_CLOUD_RESOURCE_GROUP`, `ICR_HOSTNAME`, `ICR_NAMESPACE`, `CODE_ENGINE_PROJECT`, service `.env` files filled in |

Load the following skills: `ibm-cloud` (CLI, ICR login, Code Engine).

## Requirements to follow
* Images must be built for **`linux/amd64`** (`--platform linux/amd64`) — Apple Silicon builds otherwise fail on Code Engine.
* Use `ibmcloud cr login` (never `docker login` directly).
* Secrets go in Code Engine **secrets**, not in the image and not as plain `--env` literals in committed scripts.
* Provide a repeatable script `scripts/deploy_code_engine.sh` that is safe to re-run.

## Step 1: Log in and select the project
```bash
set -a; source .env; set +a
ibmcloud login --apikey "$IBMCLOUD_API_KEY" -g "$IBM_CLOUD_RESOURCE_GROUP"
ibmcloud ce project select -n "$CODE_ENGINE_PROJECT" || ibmcloud ce project create -n "$CODE_ENGINE_PROJECT"
ibmcloud cr login
ibmcloud cr namespace-add "$ICR_NAMESPACE" 2>/dev/null || true
```
If `ICR_NAMESPACE` ends in `xxxxxxxx` replace it with a random 8-char `[0-9a-z]` string and save it back to `.env` first.

## Step 2: Build and push
```bash
REGISTRY="${ICR_HOSTNAME}/${ICR_NAMESPACE}"
for svc in search_contract_clause regenerate_pdf; do
  name=${svc//_/-}
  docker build --platform linux/amd64 -t "$REGISTRY/$name:2.0.0" services/$svc
  docker push "$REGISTRY/$name:2.0.0"
done
```

## Step 3: Registry access and secrets
```bash
ibmcloud ce registry create --name icr-secret --server "$ICR_HOSTNAME" --username iamapikey --password "$IBMCLOUD_API_KEY"
ibmcloud ce secret create --name search-contract-clause-secret --from-env-file services/search_contract_clause/.env
ibmcloud ce secret create --name regenerate-pdf-secret         --from-env-file services/regenerate_pdf/.env
```

## Step 4: Create / update the applications
```bash
ibmcloud ce application create --name search-contract-clause \
  --image "$REGISTRY/search-contract-clause:2.0.0" --registry-secret icr-secret \
  --env-from-secret search-contract-clause-secret --port 8080 \
  --cpu 0.5 --memory 1G --min-scale 1 --max-scale 3
ibmcloud ce application create --name regenerate-pdf \
  --image "$REGISTRY/regenerate-pdf:2.0.0" --registry-secret icr-secret \
  --env-from-secret regenerate-pdf-secret --port 8080 \
  --cpu 1 --memory 2G --min-scale 1 --max-scale 3
```
Use `ibmcloud ce application update` when the apps already exist (the script must branch on `application get`). `min-scale 1` avoids cold-start timeouts during chat.

## Step 5: Record the URLs and register the tools
```bash
ibmcloud ce application get --name search-contract-clause --output url
ibmcloud ce application get --name regenerate-pdf --output url
```
Put each URL in `servers[0].url` of the corresponding OpenAPI JSON, then follow Spec 6 Step 1 (connection with `X-API-Key`, import tools).

## Validation
* `curl https://<url>/health` → `{"status":"ok"}`; without key `POST` → `401/403`; with key → 200.
* From WXO: a chat question about the standard template triggers `searchClause` and returns clauses.

## Cleanup
* Documentation: super simple, non-verbose, max 3–4 pages per .md; place into `services/<svc>/docs/`.
* Never commit generated `.env` files.
