# Specification 8: Terraform — OpenShift Cluster on IBM Cloud

Provision the IBM Cloud infrastructure required to run the Orbital Suppliers application: a VPC, two subnets (one per zone), a Red Hat OpenShift on IBM Cloud (ROKS) cluster, and an IBM Cloud Container Registry (ICR) namespace. All Terraform files go under `openshift/terraform/`. Kubernetes manifests for Spec 9 go under `openshift/manifests/`.

## Prerequisites

Activate the `infrastructure-as-code-terraform` and `openshift-devops` skills before writing any code.

Check each CLI tool before proceeding. If `ibmcloud` is missing, **stop and tell the user** — it requires interactive `sudo` and cannot be automated. Direct them to the [IBM Cloud CLI Getting Started page](https://cloud.ibm.com/docs/cli?topic=cli-getting-started).

| Tool | Min version | Install if missing |
|------|------------|-------------------|
| `ibmcloud` CLI | any | ❌ User must install manually (requires `sudo`) |
| `terraform` | ≥ 1.5 | `brew install terraform` |
| `oc` (OpenShift client) | ≥ 4.21 | `brew install openshift-cli` |
| IBM Cloud provider | ~> 1.67 | pulled automatically by `terraform init` |

**Required `ibmcloud` plugins** — install if missing:

| Plugin | Install command |
|--------|----------------|
| `vpc-infrastructure` | `ibmcloud plugin install vpc-infrastructure` — required to inspect VPC/subnet IDs |
| `container-service` | `ibmcloud plugin install container-service` — required for `ibmcloud oc` commands |
| `container-registry` | `ibmcloud plugin install container-registry` — required for ICR namespace operations |

## VPC Networking Constraints

ROKS on VPC provisions worker nodes with **no Public Gateway** attached. Pods have no outbound internet access. All external services must be reached via VPC Virtual Private Endpoints (VPEs) or IBM Cloud private endpoints.

This affects every service that pods need to reach:

| Service | Approach |
|---|---|
| IBM Cloud Databases for PostgreSQL | VPE — provisioned in Step 4 of this spec |
| IBM Cloud Container Registry (ICR) | VPE — auto-created by IKS |
| HuggingFace / npm / pip registries | Must be pre-fetched at image build time on your local machine |
| Any other internet endpoint | Not reachable from pods |

> **Do NOT attach a Public Gateway** — it gives all pods unrestricted internet egress and violates least-privilege networking.

## Scope

This spec provisions **infrastructure only**. Kubernetes workloads are handled in Spec 9.

| Task | This spec | Spec 9 |
|------|-----------|--------|
| VPC, subnets, ROKS cluster, ICR namespace | ✅ | — |
| COS remote state bucket | ✅ | — |
| K8s Namespace, Deployments, Services, Routes | — | ✅ |
| Secrets (`DB_PASSWORD`, `JWT_SECRET`, `WO_API_KEY`) | — | ✅ |
| PVC for OpenSearch | — | ✅ |
| Image builds and `docker push` | — | ✅ |
| Frontend image with `VITE_BACKEND_URL` build arg | — | ✅ (needs `OCP_APP_HOSTNAME` from this spec) |

## Required @.env variables
Validate this variables are present in @.env with valid values.

| Variable | Purpose |
|----------|---------|
| `IBMCLOUD_API_KEY` | IBM Cloud provider auth |
| `IBM_CLOUD_RESOURCE_GROUP` | IBM Cloud resource group |
| `ROKS_REGION` | Region for all resources |
| `ROKS_CLUSTER_NAME` | ROKS cluster name |
| `ROKS_WORKER_FLAVOR` | Worker node type (`cxf.8x16`) |
| `ROKS_WORKER_COUNT` | Workers per zone (2) |
| `ROKS_OCP_VERSION` | OCP version (`4.16_openshift`) |
| `ICR_NAMESPACE` | Container registry namespace |

## Requirements

- All credentials come from `.env`. **Never hard-code them in `.tf` files.**
- `terraform.tfvars` holds non-secret values only and should be committed.
- `IBMCLOUD_API_KEY` is read from the environment by the IBM provider automatically — do not set it in any `.tf` or `.tfvars` file.
- Pin the IBM Cloud provider to `~> 1.67` and Terraform to `>= 1.5`.
- Use an IBM Cloud Object Storage (COS) S3-compatible backend for remote state. See Step 1 for the non-obvious setup detail.
- Resources to provision: `ibm_is_vpc`, two `ibm_is_subnet` (zones `us-south-1` and `us-south-2`, `/24` each), `ibm_container_vpc_cluster`, `ibm_cr_namespace`.
- Subnet names must follow the convention `orbital-suppliers-subnet-<zone>` (e.g. `orbital-suppliers-subnet-us-south-1`) — not a numeric suffix — so names are self-documenting and zone-consistent.
- Use IBM Cloud's default VPC CIDR allocations: `10.240.0.0/24` for `us-south-1` and `10.240.64.0/24` for `us-south-2`. IBM assigns non-contiguous /24 blocks per zone by default.
- Set `lifecycle { ignore_changes = [kube_version] }` on the cluster to prevent drift from IBM-managed minor version updates.
- Outputs required by Spec 9: `cluster_id`, `cluster_ingress_hostname`, `icr_url`.
- Write simple setup docs under `openshift/docs/` (`setup.md` runbook + `configuration.md` variable reference).

## Step 1: COS remote state (one-time manual setup)

This step has a non-obvious gotcha: **`ibmcloud resource service-instance-create` does not print the instance GUID**. After creating the COS instance, retrieve the GUID separately:

```bash
ibmcloud resource service-instance orbital-suppliers-cos --output JSON | grep '"guid"' | head -1
```

Then create the bucket and HMAC credentials using that GUID. Add `COS_HMAC_ACCESS_KEY_ID` and `COS_HMAC_SECRET_ACCESS_KEY` to `.env`.

> **Why `AWS_*` env var names?** The Terraform `s3` backend reads `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` by convention. IBM COS is S3-compatible — these are IBM HMAC keys, not AWS keys. Export them before `terraform init`:
> ```bash
> export AWS_ACCESS_KEY_ID=$COS_HMAC_ACCESS_KEY_ID
> export AWS_SECRET_ACCESS_KEY=$COS_HMAC_SECRET_ACCESS_KEY
> ```

The `backend.tf` S3 configuration must include `skip_credentials_validation`, `skip_metadata_api_check`, `skip_region_validation`, `skip_requesting_account_id`, and `use_path_style = true` — all required for COS compatibility.

> **Terraform ≥ 1.12 note:** Use `endpoints = { s3 = "https://..." }` (nested block), **not** the deprecated top-level `endpoint = "..."` key, which was removed in Terraform 1.12+.

## Step 1b: Import existing resources (if infrastructure already exists)

If the VPC, subnets, cluster, or ICR namespace were provisioned outside Terraform (e.g. by a prior run), import them before running `terraform plan` to avoid duplicates or errors.

```bash
# Gather IDs first
ibmcloud target -g $IBM_CLOUD_RESOURCE_GROUP
ibmcloud oc clusters                          # → cluster ID
ibmcloud is vpcs                              # → VPC ID  (requires vpc-infrastructure plugin)
ibmcloud is subnets                           # → subnet IDs

# Import each resource (run from openshift/terraform/)
terraform import ibm_is_vpc.main                  <vpc-id>
terraform import ibm_is_subnet.zone1              <subnet-us-south-1-id>
terraform import ibm_is_subnet.zone2              <subnet-us-south-2-id>
terraform import ibm_container_vpc_cluster.main   <cluster-id>
terraform import ibm_cr_namespace.main            <icr-namespace-name>
```

ICR namespace import ID is just the namespace name (e.g. `orbital-suppliers`), not a region-prefixed path.

## Step 2: Apply

```bash
set -a; source .env; set +a
export AWS_ACCESS_KEY_ID=$COS_HMAC_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$COS_HMAC_SECRET_ACCESS_KEY

cd openshift/terraform
terraform init && terraform validate && terraform plan -out=cluster.tfplan
terraform apply cluster.tfplan
```

> Cluster provisioning takes **20–35 minutes**. The IBM provider polls until the cluster reaches `normal` state — do not interrupt.

## Step 3: Post-apply `oc` login

Authenticate `oc` using the cluster ID from Terraform output, verify nodes are `Ready`, then write the ingress hostname to `.env`:

```bash
ibmcloud target -g $IBM_CLOUD_RESOURCE_GROUP
ibmcloud oc cluster config --cluster $(terraform output -raw cluster_id) --admin
oc get nodes
```

> **Note:** `ibmcloud target -g <resource_group>` must be run before `ibmcloud oc cluster config` — the command fails with "cluster not found" if the resource group is not targeted first.

## Step 4: Provision PostgreSQL VPE

Pods have no internet egress and cannot reach the public DB hostname. Create a VPE so all pods connect to PostgreSQL via the private network. Run this after `terraform apply` completes.

**Find the PostgreSQL instance CRN and worker security group:**
```bash
# Find the DB instance — note the guid matching your DB_HOST prefix
ibmcloud resource service-instances --service-name databases-for-postgresql \
  --all-resource-groups --output json | python3 -c "
import json,sys
for i in json.load(sys.stdin):
    print(i['name'], '|', i['guid'])
"

# Worker security group is named kube-<cluster-id>
ibmcloud is security-groups --resource-group-name $IBM_CLOUD_RESOURCE_GROUP 2>&1 | grep kube-
```

**Create the VPE:**
```bash
ibmcloud is endpoint-gateway-create \
  --name "orbital-suppliers-postgresql-vpe" \
  --vpc <vpc-id> \
  --target "crn:v1:bluemix:public:databases-for-postgresql:us-south:a/<account>:<db-guid>::" \
  --new-reserved-ip '{"subnet":{"id":"<subnet-zone1-id>"}}' \
  --new-reserved-ip '{"subnet":{"id":"<subnet-zone2-id>"}}' \
  --sg <cluster-worker-sg-id> \
  --resource-group-name $IBM_CLOUD_RESOURCE_GROUP
```

The output includes a **Service Endpoints** field — the private hostname follows the pattern:
```
<db-guid>.<hash>.private.databases.appdomain.cloud
```
This hostname uses the **same port** as the public endpoint.

**Add to `.env`:**
```bash
DB_HOST_PRIVATE=<private-hostname-from-vpe-output>
```

> **Which DB instance?** The `<db-guid>` in your `DB_HOST` is the first segment of the hostname (e.g. `fa089a8d` from `fa089a8d-c3ba-....databases.appdomain.cloud`). Match that to the instance GUID in the listing above — there may be multiple PostgreSQL instances in the account.

No dedicated cluster DB user is required. The same `DB_USER` / `DB_PASSWORD` credentials from your IBM Cloud PostgreSQL instance work over the VPE private connection. No schema grants need to be run.

Once the VPE is created, add `DB_HOST_PRIVATE` to `.env` using the actual private hostname:
```bash
DB_HOST_PRIVATE=fa089a8d-c3ba-41a6-b09e-744439606f53.bn2a2uid0up8mv7mv2ig.private.databases.appdomain.cloud
```

> **Note:** `DB_USER` and `DB_PASSWORD` are unchanged — the same credentials used to seed the database work over the VPE private connection.

## Output @.env variables

Add `OCP_APP_HOSTNAME` to @.env. Required for downstream Specifications (e.g. when deploying containers to OpenShift).

```bash
echo "OCP_APP_HOSTNAME=$(terraform output -raw cluster_ingress_hostname)" >> ../../.env
```

## Cleanup

- Add `openshift/terraform/.terraform/`, `*.tfplan`, and `terraform.tfstate*` to `.gitignore`.
- Never commit `terraform.tfstate` — state lives in COS.
- `COS_HMAC_*` keys go in `.env` only — never in `.tfvars` or `.tf` files.
