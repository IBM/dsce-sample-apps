#!/usr/bin/env bash
set -euo pipefail

# Supply Chain Risk Control Tower — setup script
#
# What it does:
#   1. Creates code/terraform/terraform.tfvars if it does not exist
#   2. Runs terraform init and terraform apply
#   3. Reads Terraform outputs for Kafka + Schema Registry credentials
#   4. Writes .env (all runtime credentials in one place)
#   5. Optionally creates a Python virtual environment and installs dependencies

AUTO_APPROVE="false"
FORCE_ENV="false"
SKIP_PYTHON_INSTALL="false"

usage() {
  cat <<USAGE
Usage: ./scripts/setup.sh [options]

Options:
  --auto-approve        Run terraform apply -auto-approve
  --force-env           Overwrite .env after creating a timestamped backup
  --skip-python-install Skip Python virtualenv and pip install step
  -h, --help            Show this help

Examples:
  ./scripts/setup.sh
  ./scripts/setup.sh --auto-approve
  ./scripts/setup.sh --auto-approve --force-env
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto-approve)      AUTO_APPROVE="true";        shift ;;
    --force-env)         FORCE_ENV="true";            shift ;;
    --skip-python-install) SKIP_PYTHON_INSTALL="true"; shift ;;
    -h|--help)           usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: '$1' is required but was not found in PATH." >&2
    exit 1
  fi
}

prompt_default() {
  local prompt="$1"
  local default_value="$2"
  local value
  read -r -p "$prompt [$default_value]: " value
  echo "${value:-$default_value}"
}

prompt_secret() {
  local prompt="$1"
  local value
  read -r -s -p "$prompt: " value
  echo >&2
  echo "$value"
}

prompt_yn() {
  # Returns 0 (true) for y/Y/yes, 1 (false) for anything else.
  local prompt="$1"
  local default="${2:-n}"
  local answer
  read -r -p "$prompt [y/N]: " answer
  answer="${answer:-$default}"
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *)           return 1 ;;
  esac
}

mask() {
  local value="$1"
  if [[ ${#value} -le 8 ]]; then
    echo "****"
  else
    echo "${value:0:4}****${value: -4}"
  fi
}

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/code/terraform"
TFVARS_FILE="$TERRAFORM_DIR/terraform.tfvars"
ENV_FILE="$PROJECT_ROOT/.env"

cd "$PROJECT_ROOT"

require_command terraform
require_command python

if [[ ! -d "$TERRAFORM_DIR" ]]; then
  echo "ERROR: terraform directory not found at: $TERRAFORM_DIR" >&2
  exit 1
fi

# ── terraform.tfvars ─────────────────────────────────────────────────────────

if [[ ! -f "$TFVARS_FILE" ]]; then
  echo "terraform.tfvars was not found. Creating it now."
  echo
  echo "You need a Confluent Cloud Resource Management API key here, NOT a Kafka cluster API key."
  echo "Create it in: Confluent Cloud UI → API keys → Add API key → My account → Cloud resource management."
  echo

  CONFLUENT_CLOUD_API_KEY_INPUT="${CONFLUENT_CLOUD_API_KEY:-}"
  CONFLUENT_CLOUD_API_SECRET_INPUT="${CONFLUENT_CLOUD_API_SECRET:-}"

  if [[ -z "$CONFLUENT_CLOUD_API_KEY_INPUT" ]]; then
    read -r -p "Enter Confluent Cloud Resource Management API key: " CONFLUENT_CLOUD_API_KEY_INPUT
  fi

  if [[ -z "$CONFLUENT_CLOUD_API_SECRET_INPUT" ]]; then
    CONFLUENT_CLOUD_API_SECRET_INPUT="$(prompt_secret "Enter Confluent Cloud Resource Management API secret")"
  fi

  EXISTING_ENVIRONMENT_ID_INPUT="${EXISTING_ENVIRONMENT_ID:-}"
  if [[ -z "$EXISTING_ENVIRONMENT_ID_INPUT" ]]; then
    echo
    echo "If your account cannot create new environments (e.g. restricted key), enter an existing"
    echo "environment ID such as env-abc123. Leave blank to let Terraform create a new environment."
    read -r -p "Existing Confluent environment ID (or leave blank): " EXISTING_ENVIRONMENT_ID_INPUT
  fi

  CLOUD_PROVIDER_INPUT="$(prompt_default "Cloud provider" "${CLOUD_PROVIDER:-AWS}")"
  REGION_INPUT="$(prompt_default "Region" "${CONFLUENT_REGION:-us-east-2}")"
  ENVIRONMENT_NAME_INPUT="$(prompt_default "Environment name" "${CONFLUENT_ENVIRONMENT_NAME:-scrc-building-block}")"
  CLUSTER_NAME_INPUT="$(prompt_default "Cluster name" "${CONFLUENT_CLUSTER_NAME:-scrc-demo-cluster}")"

  echo
  echo "Schema Registry (Confluent Stream Governance) is required to register Avro/JSON schemas."
  echo "It is auto-provisioned per environment and the Essentials tier is free."
  echo "Disable only if your environment does not have Stream Governance enabled."
  SR_ENABLED_INPUT="true"
  if prompt_yn "Enable Schema Registry support?"; then
    SR_ENABLED_INPUT="true"
  else
    SR_ENABLED_INPUT="false"
  fi

  cat > "$TFVARS_FILE" <<TFVARS
confluent_cloud_api_key    = "$CONFLUENT_CLOUD_API_KEY_INPUT"
confluent_cloud_api_secret = "$CONFLUENT_CLOUD_API_SECRET_INPUT"

# Leave empty to create a new environment; set to env-xxxxx to reuse an existing one.
existing_environment_id    = "$EXISTING_ENVIRONMENT_ID_INPUT"

environment_name           = "$ENVIRONMENT_NAME_INPUT"
cloud_provider             = "$CLOUD_PROVIDER_INPUT"
region                     = "$REGION_INPUT"
cluster_name               = "$CLUSTER_NAME_INPUT"
cluster_availability       = "SINGLE_ZONE"
topic_partitions           = 3

# Set to false if your Confluent environment does not have Stream Governance enabled.
schema_registry_enabled    = $SR_ENABLED_INPUT
TFVARS
  chmod 600 "$TFVARS_FILE"
  echo "Created $TFVARS_FILE"
else
  echo "Using existing $TFVARS_FILE"
fi

# ── Terraform init + apply ────────────────────────────────────────────────────

echo
echo "Running terraform init..."
terraform -chdir="$TERRAFORM_DIR" init

echo
echo "Running terraform apply..."
if [[ "$AUTO_APPROVE" == "true" ]]; then
  terraform -chdir="$TERRAFORM_DIR" apply -auto-approve
else
  terraform -chdir="$TERRAFORM_DIR" apply
fi

# ── Read Terraform outputs ────────────────────────────────────────────────────

echo
echo "Reading Terraform outputs..."

# tf_output <name> [optional]
#   Reads a Terraform output by name using -raw.
#   For sensitive outputs, -raw emits the plain value directly without the
#   "(sensitive value)" annotation that `terraform output` (no flags) shows.
#   Both stdout and stderr are captured; stderr is discarded except on failure
#   so that provider warnings don't contaminate the variable value.
#   If "optional" is passed, an empty/missing value returns "" instead of exiting.
tf_output() {
  local name="$1"
  local optional="${2:-}"
  local value
  local tf_stderr
  local tf_exit

  # Use a temp file for stderr so we can inspect it without mixing into $value.
  local tmpfile
  tmpfile="$(mktemp)"

  value="$(terraform -chdir="$TERRAFORM_DIR" output -raw "$name" 2>"$tmpfile")"
  tf_exit=$?
  tf_stderr="$(cat "$tmpfile")"
  rm -f "$tmpfile"

  if [[ $tf_exit -ne 0 ]]; then
    if [[ "$optional" == "optional" ]]; then
      echo "WARNING: Terraform output '$name' not found — leaving blank in .env" >&2
      echo ""
      return 0
    fi
    echo "ERROR: Required Terraform output '$name' was not found." >&2
    echo "       Run 'terraform apply' inside $TERRAFORM_DIR first." >&2
    [[ -n "$tf_stderr" ]] && echo "$tf_stderr" >&2
    exit 1
  fi

  # Terraform -raw on a sensitive empty-string output exits 0 but prints nothing.
  # That is a valid "disabled" state (e.g. schema_registry_enabled = false).
  if [[ -z "$value" ]]; then
    if [[ "$optional" == "optional" ]]; then
      echo ""
      return 0
    fi
    echo "ERROR: Terraform output '$name' exists but is empty. Check code/terraform/outputs.tf." >&2
    exit 1
  fi

  echo "$value"
}

BOOTSTRAP_ENDPOINT="$(tf_output bootstrap_endpoint)"
APP_KAFKA_API_KEY="$(tf_output app_kafka_api_key)"
APP_KAFKA_API_SECRET="$(tf_output app_kafka_api_secret)"
ENVIRONMENT_ID="$(tf_output environment_id optional)"
KAFKA_CLUSTER_ID="$(tf_output kafka_cluster_id optional)"
APP_SERVICE_ACCOUNT_ID="$(tf_output app_service_account_id optional)"
SR_URL="$(tf_output schema_registry_url optional)"
SR_API_KEY="$(tf_output schema_registry_api_key optional)"
SR_API_SECRET="$(tf_output schema_registry_api_secret optional)"

# Confluent bootstrap_endpoint may include SASL_SSL:// prefix. Python client expects host:port only.
BOOTSTRAP_SERVERS="${BOOTSTRAP_ENDPOINT#SASL_SSL://}"

# ── Validate mandatory Kafka values ──────────────────────────────────────────

if [[ -z "$BOOTSTRAP_SERVERS" || -z "$APP_KAFKA_API_KEY" || -z "$APP_KAFKA_API_SECRET" ]]; then
  echo "ERROR: One or more required Kafka outputs are empty." >&2
  echo "       Run 'terraform output' inside $TERRAFORM_DIR to debug." >&2
  exit 1
fi

# ── Handle missing Schema Registry outputs ───────────────────────────────────
# SR outputs are empty when schema_registry_enabled = false in terraform.tfvars,
# OR when Stream Governance is not yet enabled in the Confluent environment.
# In either case, offer to collect SR credentials manually so .env is complete.

if [[ -z "$SR_URL" || -z "$SR_API_KEY" || -z "$SR_API_SECRET" ]]; then
  echo
  echo "Schema Registry credentials were not populated by Terraform."
  echo "This happens when:"
  echo "  1. schema_registry_enabled = false in terraform.tfvars, OR"
  echo "  2. Stream Governance (Schema Registry) is not yet enabled in the Confluent environment."
  echo "  3. Terraform apply has not been run yet, or the SR API key resource failed."
  echo
  echo "To enable it: Confluent Cloud UI → Environment → Stream Governance → Enable Essentials (free)."
  echo "Then re-run this script to repopulate .env, or fill in the values manually."
  echo
  if prompt_yn "Enter Schema Registry credentials manually now?"; then
    echo
    echo "Find the Schema Registry URL in: Confluent Cloud → Environment → Schema Registry → Endpoint"
    read -r -p "Schema Registry URL (https://psrc-xxxxx...): " SR_URL_MANUAL
    SR_URL="${SR_URL_MANUAL:-}"

    echo
    echo "Create a Schema Registry API key in: Confluent Cloud → Environment → Schema Registry → API Keys"
    read -r -p "Schema Registry API key: " SR_KEY_MANUAL
    SR_API_KEY="${SR_KEY_MANUAL:-}"

    SR_SECRET_MANUAL="$(prompt_secret "Schema Registry API secret")"
    SR_API_SECRET="${SR_SECRET_MANUAL:-}"
  else
    echo "Leaving Schema Registry values empty in .env. Fill them in manually before running register_schemas."
  fi
fi

# ── Write .env ────────────────────────────────────────────────────────────────

if [[ -f "$ENV_FILE" ]]; then
  BACKUP_FILE="$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"
  cp "$ENV_FILE" "$BACKUP_FILE"
  if [[ "$FORCE_ENV" != "true" ]]; then
    echo
    echo ".env already exists. Backup created at: $BACKUP_FILE"
    if ! prompt_yn "Overwrite .env with Terraform outputs?"; then
      echo "Keeping existing .env. Values from this run:"
      echo "  CONFLUENT_BOOTSTRAP_SERVERS=$BOOTSTRAP_SERVERS"
      echo "  CONFLUENT_API_KEY=$(mask "$APP_KAFKA_API_KEY")"
      echo "  CONFLUENT_API_SECRET=$(mask "$APP_KAFKA_API_SECRET")"
      [[ -n "$SR_URL" ]] && echo "  SCHEMA_REGISTRY_URL=$SR_URL"
      exit 0
    fi
  else
    echo ".env already exists. Backup created at: $BACKUP_FILE"
  fi
fi

cat > "$ENV_FILE" <<ENVEOF
# Generated by scripts/setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Do NOT commit this file — it contains secrets. It is gitignored.

# ------------------------------------------------------------
# Confluent Cloud — Kafka cluster (producer, consumer, UI)
# Cluster-scoped credentials created by Terraform for scrc-app service account.
# ------------------------------------------------------------
CONFLUENT_BOOTSTRAP_SERVERS=$BOOTSTRAP_SERVERS
CONFLUENT_API_KEY=$APP_KAFKA_API_KEY
CONFLUENT_API_SECRET=$APP_KAFKA_API_SECRET
CONFLUENT_CLIENT_ID=supply-chain-risk-control-tower
CONFLUENT_CONSUMER_GROUP=scrc-risk-engine

# Terraform-managed resource IDs (informational — not required at runtime)
CONFLUENT_ENVIRONMENT_ID=$ENVIRONMENT_ID
CONFLUENT_KAFKA_CLUSTER_ID=$KAFKA_CLUSTER_ID
CONFLUENT_APP_SERVICE_ACCOUNT_ID=$APP_SERVICE_ACCOUNT_ID

# ------------------------------------------------------------
# Confluent Schema Registry
# Required to run: scripts/register_schemas.sh
# Enable Stream Governance in the Confluent UI, then re-run setup.sh if blank.
# ------------------------------------------------------------
SCHEMA_REGISTRY_URL=$SR_URL
SCHEMA_REGISTRY_API_KEY=$SR_API_KEY
SCHEMA_REGISTRY_API_SECRET=$SR_API_SECRET

# ------------------------------------------------------------
# Slack alerting (optional)
# Incoming webhook URL from your Slack App configuration.
# ------------------------------------------------------------
SLACK_WEBHOOK_URL=

# ------------------------------------------------------------
# OpenSearch dashboard (optional — see docs/specs/04-opensearch-dashboard.md)
# ------------------------------------------------------------
OPENSEARCH_URL=http://localhost:9200
OPENSEARCH_USERNAME=
OPENSEARCH_PASSWORD=

# ------------------------------------------------------------
# IBM watsonx.ai (optional — see docs/agents/)
# ------------------------------------------------------------
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSONX_URL=
ENVEOF
chmod 600 "$ENV_FILE"

# ── Summary ───────────────────────────────────────────────────────────────────

echo
echo "Wrote $ENV_FILE"
echo
echo "  Bootstrap servers  : $BOOTSTRAP_SERVERS"
echo "  Kafka API key      : $(mask "$APP_KAFKA_API_KEY")"
echo "  Kafka API secret   : $(mask "$APP_KAFKA_API_SECRET")"
if [[ -n "$SR_URL" ]]; then
  echo "  Schema Registry URL: $SR_URL"
  echo "  SR API key         : $(mask "$SR_API_KEY")"
  echo "  SR API secret      : $(mask "$SR_API_SECRET")"
else
  echo "  Schema Registry    : NOT populated"
  echo "    → Enable Stream Governance in Confluent UI, then re-run setup.sh"
  echo "    → Or fill in SCHEMA_REGISTRY_URL / SCHEMA_REGISTRY_API_KEY / SCHEMA_REGISTRY_API_SECRET in .env"
fi

# ── Python virtualenv + install ───────────────────────────────────────────────

if [[ "$SKIP_PYTHON_INSTALL" != "true" ]]; then
  echo
  echo "Creating Python virtual environment..."
  python -m venv "$PROJECT_ROOT/.venv"
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.venv/bin/activate"
  python -m pip install --upgrade pip --quiet
  python -m pip install -e ".[dev]"
  echo
  echo "Python setup complete."
  echo "Activate later with: source .venv/bin/activate"
fi

echo
echo "Setup complete. Next steps:"
echo "  source .venv/bin/activate"
echo "  bash scripts/register_schemas.sh    # push JSON schemas to Schema Registry"
echo "  python -m scrc.producer             # start event producer"
echo "  python -m scrc.risk_engine          # start risk scoring engine"
echo "  python code/ui/kafka_bridge.py      # Carbon UI SSE bridge"
