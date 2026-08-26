# Configuration Reference

## Required `.env` variables

| Variable | Description |
|---|---|
| `IBMCLOUD_API_KEY` | IBM Cloud API key |
| `ROKS_REGION` | IBM Cloud region (`us-south`) |
| `IBM_CLOUD_RESOURCE_GROUP` | Resource group name |
| `ROKS_CLUSTER_NAME` | ROKS cluster name |
| `ROKS_WORKER_FLAVOR` | Worker node flavor (`cxf.8x16`) |
| `ROKS_WORKER_COUNT` | Workers per zone (`2`) |
| `ROKS_OCP_VERSION` | OpenShift version (`4.21_openshift`) |
| `ICR_NAMESPACE` | ICR namespace (`orbital-suppliers`) |
| `ICR_HOSTNAME` | ICR hostname (`us.icr.io`) |
| `COS_HMAC_ACCESS_KEY_ID` | COS HMAC key for Terraform state backend |
| `COS_HMAC_SECRET_ACCESS_KEY` | COS HMAC secret for Terraform state backend |
| `OCP_APP_HOSTNAME` | Cluster ingress hostname (set after `terraform apply`) |
| `DB_HOST_PRIVATE` | PostgreSQL VPE private hostname (set after VPE creation) |
| `DB_USER` | Dedicated cluster DB user (`orbital_app`) |
| `DB_PASSWORD` | Dedicated cluster DB password |

## Environment-specific values

| Variable | Local | OpenShift |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3001` | `""` (empty) |
| `DB_HOST` | Public hostname | `DB_HOST_PRIVATE` (VPE) |
| `WO_INSTANCE_URL` | Public endpoint | `WO_INSTANCE_URL_PRIVATE` |

## ConfigMap `app-config` (non-sensitive, cluster-side)

`BACKEND_PORT`, `OPENSEARCH_HOST`, `OPENSEARCH_PORT`, `OPENSEARCH_INDEX`, `DB_HOST` (private), `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_SSL`

## Secret `app-secrets` (sensitive, never committed)

`DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `PASSWORD_HASH_SECRET`, `SESSION_SECRET`, `WO_API_KEY`, `WO_INSTANCE_URL`, `WO_AGENT_ID`, `WO_ENVIRONMENT_ID`
