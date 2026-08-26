# Orbital Suppliers — OpenShift Setup

## Prerequisites

- `ibmcloud` CLI with plugins: `vpc-infrastructure`, `container-service`, `container-registry`
- `terraform >= 1.5`
- `oc >= 4.21` (`brew install openshift-cli`)
- `kustomize` (`brew install kustomize`)
- Docker or Podman (running)
- `.env` populated (see `configuration.md`)

## One-time COS remote state setup

Already done for this project. HMAC keys are in `.env` as `COS_HMAC_ACCESS_KEY_ID` / `COS_HMAC_SECRET_ACCESS_KEY`.

## Deploy cluster (Spec 8)

```bash
set -a; source .env; set +a
export AWS_ACCESS_KEY_ID=$COS_HMAC_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$COS_HMAC_SECRET_ACCESS_KEY

cd openshift/terraform
terraform init
terraform import ibm_is_vpc.main r006-47fa7514-3d88-40f5-822b-de3b60976479
terraform import ibm_is_subnet.zone1 0717-66c0c5e7-b8c5-43ce-ac80-a78780d30721
terraform import ibm_is_subnet.zone2 0727-a0f911b6-6a97-4a86-9aa6-c299e547c8d1
terraform import ibm_cr_namespace.main orbital-suppliers
terraform validate && terraform plan -out=cluster.tfplan
terraform apply cluster.tfplan
```

Cluster provisioning takes 20–35 minutes.

## Post-apply

```bash
# Login to cluster
ibmcloud target -g orbital-suppliers-rg
ibmcloud oc cluster config --cluster $(terraform output -raw cluster_id) --admin
oc get nodes

# Write ingress hostname to .env
echo "OCP_APP_HOSTNAME=$(terraform output -raw cluster_ingress_hostname)" >> ../../.env
```

## Deploy application (Spec 9)

After `OCP_APP_HOSTNAME`, `DB_USER`, `DB_PASSWORD`, and `DB_HOST_PRIVATE` are set in `.env`:

```bash
cd ../..
./openshift/deploy.sh prod
```

## Run embed Job (Spec 10)

After all pods are Ready:

```bash
oc apply -f openshift/jobs/embed-job.yaml -n orbital-suppliers
oc logs -f job/embed-job -n orbital-suppliers
```
