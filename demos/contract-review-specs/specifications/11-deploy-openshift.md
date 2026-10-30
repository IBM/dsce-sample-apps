# Specification 11: Deploy the UI Proxy to OpenShift
The following specification outlines how to deploy the `ui_proxy` (UI + API gateway) to an OpenShift cluster (e.g. Red Hat OpenShift on IBM Cloud) behind a TLS Route.

## Prerequisites
Check each item before proceeding. Stop and tell the user if anything is missing.

| Tool | Check |
|---|---|
| `ibmcloud` CLI, `oc` CLI | `ibmcloud version`, `oc version --client` |
| Docker / Podman running | `docker info` |
| Tool services deployed (Spec 10) and agent imported (Spec 6) | `WXO_AGENT_ID` set |
| `.env` | `ICR_HOSTNAME`, `ICR_NAMESPACE`, `OCP_NAMESPACE`, `IBMCLOUD_API_KEY` |

Load the following skills: `ibm-cloud` (CLI, ICR login, `oc` targeting).

## Architecture
| Item | Value |
|---|---|
| Workload | `Deployment contract-reviewer-ui`, **`replicas: 1`** (sessions are in memory; a restart signs everyone out; scaling out requires a shared store) |
| Image | `icr.io/<namespace>/contract-reviewer-ui:2.0.0` (built from `services/ui_proxy`) |
| Service | port `80` → container `8080` |
| Route | TLS `edge`, `insecureEdgeTerminationPolicy: Redirect` |
| External services | WXO (SaaS), AstraDB, IBM COS — reached over the internet or private endpoints |

## Step 1: Build and push (`linux/amd64`)
```bash
set -a; source .env; set +a
ibmcloud cr login
docker build --no-cache --platform linux/amd64 -t "${ICR_HOSTNAME}/${ICR_NAMESPACE}/contract-reviewer-ui:2.0.0" services/ui_proxy
docker push "${ICR_HOSTNAME}/${ICR_NAMESPACE}/contract-reviewer-ui:2.0.0"
```
`index.html` must be in the build context (`COPY index.html .` in the Dockerfile).

## Step 2: Namespace and pull secret
```bash
oc new-project "$OCP_NAMESPACE" || oc project "$OCP_NAMESPACE"
oc get secret all-icr-io -n default -o json | python3 -c "
import sys,json; s=json.load(sys.stdin)
s['metadata']={'name':s['metadata']['name'],'namespace':'$OCP_NAMESPACE'}; print(json.dumps(s))" | oc apply -f -
oc secrets link default all-icr-io --for=pull
```
New namespaces do not inherit the ICR pull secret; without this pods hit `ImagePullBackOff`.

## Step 3: Secrets (never committed)
Create via `oc create secret generic … --dry-run=client -o yaml | oc apply -f -` from `.env`:

| Secret | Keys |
|---|---|
| `ui-proxy-secret` | `WXO_BASE_URL, WXO_API_KEY, WXO_AGENT_ID, UI_USERNAME, UI_PASSWORD, ALLOWED_ORIGIN` |
| `astradb-secret` | `ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_COLLECTION` |
| `cos-secret` | `COS_API_KEY, COS_SERVICE_INSTANCE_ID, COS_ENDPOINT, COS_BUCKET` |

`ALLOWED_ORIGIN` should be the Route URL (`https://contract-reviewer-<namespace>.apps.<cluster>`) or an empty string for same-origin only. `UI_PASSWORD` must be a long random value (≥ 12 chars).

## Step 4: Manifests (`services/ui_proxy/k8s/deployment.yaml`)
The Deployment, Service and Route live in one file. Required properties:
* `automountServiceAccountToken: false`; pod `securityContext: {runAsNonRoot: true, seccompProfile: {type: RuntimeDefault}}`.
* Container `securityContext`: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`; mount an `emptyDir` at `/tmp`.
* All environment variables injected with `secretKeyRef` from the three secrets above.
* `readinessProbe` and `livenessProbe` → `GET /health` on 8080 (initial delay 5 s / 10 s; period 10 s / 30 s).
* Resources: requests `100m` CPU / `128Mi`; limits `500m` / `256Mi` (raise memory if large PDFs are routinely uploaded — PyMuPDF needs headroom).
* Do **not** require `anyuid` or a custom SCC — the image runs as UID 10001 and works under `restricted-v2`.

```bash
oc apply -f services/ui_proxy/k8s/deployment.yaml
oc rollout status deployment/contract-reviewer-ui
oc get route contract-reviewer-ui -o jsonpath='{.spec.host}'
```

## Step 5: Route hardening
* TLS edge termination with HTTP→HTTPS redirect (already in the manifest).
* **Set HSTS on the Route** — the app does not: `oc annotate route contract-reviewer-ui haproxy.router.openshift.io/hsts_header="max-age=31536000;includeSubDomains"`.
* The app trusts the **last** `X-Forwarded-For` hop (the OpenShift router) for rate limiting.

## Validation
* `https://<route>/health` → `{"status":"ok"}`; `https://<route>/` redirects to `/login`; sign in and complete the Spec 8 journey.
* `oc get pod -o jsonpath='{.items[0].spec.containers[0].securityContext}'` shows read-only root FS and dropped capabilities.
* `oc scale` is **not** used; replicas stay at 1.

## Known limitations (document in `services/ui_proxy/docs/`)
Single shared login and no roles; in-memory sessions; no HSTS from the app; agent replies and `clause_index` flow into prompts and the UI renders links from the LLM reply — restrict links to an allow-list if hostile vendor PDFs are in the threat model; transitive dependencies are not hash-pinned (run `pip-audit` before each release).

## Cleanup
* Documentation: `services/ui_proxy/docs/setup.md` and `configuration.md`, ≤ 3 pages each.
* `.gitignore`: `kubeconfig`, `*.kubeconfig`, generated secret manifests.
