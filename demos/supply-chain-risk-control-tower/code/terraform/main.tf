# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
# If an existing environment ID is provided, look it up instead of creating
# a new one. This is required when the Cloud Resource Management API key
# does not have permission to create new Confluent Cloud environments.
locals {
  use_existing_env = var.existing_environment_id != ""
  environment_id   = local.use_existing_env ? var.existing_environment_id : confluent_environment.scrc[0].id
}

resource "confluent_environment" "scrc" {
  count        = local.use_existing_env ? 0 : 1
  display_name = var.environment_name
}

data "confluent_environment" "existing" {
  count = local.use_existing_env ? 1 : 0
  id    = var.existing_environment_id
}

# ---------------------------------------------------------------------------
# Kafka cluster
# ---------------------------------------------------------------------------
resource "confluent_kafka_cluster" "scrc" {
  display_name = var.cluster_name
  availability = var.cluster_availability
  cloud        = var.cloud_provider
  region       = var.region

  basic {}

  environment {
    id = local.environment_id
  }
}

# ---------------------------------------------------------------------------
# Service account + role binding
# ---------------------------------------------------------------------------
resource "confluent_service_account" "scrc_app" {
  display_name = "scrc-app"
  description  = "Service account for Supply Chain Risk Control Tower producers and consumers."
}

resource "confluent_role_binding" "scrc_env_admin" {
  principal   = "User:${confluent_service_account.scrc_app.id}"
  role_name   = "EnvironmentAdmin"
  crn_pattern = local.use_existing_env ? data.confluent_environment.existing[0].resource_name : confluent_environment.scrc[0].resource_name
}

# ---------------------------------------------------------------------------
# Kafka cluster API key (for producer / consumer / topic management)
# ---------------------------------------------------------------------------
resource "confluent_api_key" "scrc_kafka_api_key" {
  display_name = "scrc-kafka-api-key"
  description  = "Kafka API key for Supply Chain Risk Control Tower app."

  owner {
    id          = confluent_service_account.scrc_app.id
    api_version = confluent_service_account.scrc_app.api_version
    kind        = confluent_service_account.scrc_app.kind
  }

  managed_resource {
    id          = confluent_kafka_cluster.scrc.id
    api_version = confluent_kafka_cluster.scrc.api_version
    kind        = confluent_kafka_cluster.scrc.kind

    environment {
      id = local.environment_id
    }
  }

  depends_on = [confluent_role_binding.scrc_env_admin]
}

# ---------------------------------------------------------------------------
# Schema Registry
# ---------------------------------------------------------------------------
# In Confluent Cloud, Schema Registry is auto-provisioned per environment
# under Stream Governance. The provider exposes it only as a data source.
#
# IMPORTANT: Schema Registry is NOT available in all environments by default.
# If your environment does not have Stream Governance enabled, this data source
# lookup will fail during `terraform apply`. In that case either:
#   a) Enable Stream Governance (Essentials tier is free) in the Confluent UI, or
#   b) Set schema_registry_enabled = false in terraform.tfvars to skip SR resources.
data "confluent_schema_registry_cluster" "scrc" {
  count = var.schema_registry_enabled ? 1 : 0

  environment {
    id = local.environment_id
  }

  depends_on = [
    confluent_environment.scrc,
    confluent_kafka_cluster.scrc,
  ]
}

# Schema Registry API key — only created when SR is enabled and found
resource "confluent_api_key" "scrc_sr_api_key" {
  count        = var.schema_registry_enabled ? 1 : 0
  display_name = "scrc-schema-registry-api-key"
  description  = "Schema Registry API key for Supply Chain Risk Control Tower app."

  owner {
    id          = confluent_service_account.scrc_app.id
    api_version = confluent_service_account.scrc_app.api_version
    kind        = confluent_service_account.scrc_app.kind
  }

  managed_resource {
    id          = data.confluent_schema_registry_cluster.scrc[0].id
    api_version = data.confluent_schema_registry_cluster.scrc[0].api_version
    kind        = data.confluent_schema_registry_cluster.scrc[0].kind

    environment {
      id = local.environment_id
    }
  }

  depends_on = [confluent_role_binding.scrc_env_admin]
}

# ---------------------------------------------------------------------------
# Kafka topics
# ---------------------------------------------------------------------------
resource "confluent_kafka_topic" "topics" {
  for_each = var.topic_names

  kafka_cluster {
    id = confluent_kafka_cluster.scrc.id
  }

  topic_name       = each.value
  partitions_count = var.topic_partitions
  rest_endpoint    = confluent_kafka_cluster.scrc.rest_endpoint

  config = {
    "cleanup.policy" = "delete"
    "retention.ms"   = "604800000"
  }

  credentials {
    key    = confluent_api_key.scrc_kafka_api_key.id
    secret = confluent_api_key.scrc_kafka_api_key.secret
  }
}
