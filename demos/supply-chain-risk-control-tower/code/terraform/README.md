# Terraform — Confluent Cloud Infrastructure

This directory provisions all Confluent Cloud resources required for the Supply Chain Risk Control Tower demo.

Run from project root via `scripts/setup.sh --auto-approve`, which handles variable prompting, Terraform execution, and writing `.env` automatically.

To run Terraform directly:

```bash
cd code/terraform
# terraform.tfvars is created interactively by scripts/setup.sh
# To create it manually, copy the fields from variables.tf and fill in your values
terraform init
terraform plan
terraform apply
```

## Resources created

| Resource | Purpose |
|----------|---------|
| `confluent_environment` | Isolated demo environment |
| `confluent_kafka_cluster` | Basic single-zone Kafka cluster |
| `confluent_service_account` | Application service account |
| `confluent_api_key` (Kafka) | Cluster-scoped credentials for producer and risk engine |
| `confluent_api_key` (SR) | Schema Registry credentials for schema registration |
| `confluent_kafka_topic` x 10 | All input and output topics |

## Outputs

After `terraform apply`, the following values are written to `.env` by `scripts/setup.sh`:

| Output | Variable |
|--------|----------|
| `bootstrap_endpoint` | `CONFLUENT_BOOTSTRAP_SERVERS` |
| `app_kafka_api_key` | `CONFLUENT_API_KEY` |
| `app_kafka_api_secret` | `CONFLUENT_API_SECRET` |
| `schema_registry_url` | `SCHEMA_REGISTRY_URL` |
| `schema_registry_api_key` | `SCHEMA_REGISTRY_API_KEY` |
| `schema_registry_api_secret` | `SCHEMA_REGISTRY_API_SECRET` |

To view sensitive outputs manually:

```bash
terraform -chdir=code/terraform output -raw app_kafka_api_key
terraform -chdir=code/terraform output -raw app_kafka_api_secret
```

## Important notes

- `terraform.tfvars` contains API credentials and is gitignored. Do not commit it.
- `terraform.tfstate` stores resource state and is gitignored. Back it up or use remote state for shared environments.
- The scaffold does not create managed connectors. Connector setup depends on each customer's source systems, networking, and governance requirements.
