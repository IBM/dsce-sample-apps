output "environment_id" {
  description = "Confluent Cloud environment ID used by this deployment."
  value       = local.environment_id
}

output "kafka_cluster_id" {
  description = "Confluent Cloud Kafka cluster ID."
  value       = confluent_kafka_cluster.scrc.id
}

output "bootstrap_endpoint" {
  description = "Kafka bootstrap endpoint (SASL_SSL://host:port). setup.sh strips the SASL_SSL:// prefix."
  value       = confluent_kafka_cluster.scrc.bootstrap_endpoint
}

output "rest_endpoint" {
  description = "Confluent Cloud Kafka REST endpoint."
  value       = confluent_kafka_cluster.scrc.rest_endpoint
}

output "app_service_account_id" {
  description = "Service account ID for the scrc-app principal."
  value       = confluent_service_account.scrc_app.id
}

output "app_kafka_api_key" {
  description = "Kafka cluster API key ID for scrc-app."
  value       = confluent_api_key.scrc_kafka_api_key.id
  sensitive   = true
}

output "app_kafka_api_secret" {
  description = "Kafka cluster API key secret for scrc-app."
  value       = confluent_api_key.scrc_kafka_api_key.secret
  sensitive   = true
}

# ---------------------------------------------------------------------------
# Schema Registry outputs
# These are empty strings when schema_registry_enabled = false.
# setup.sh treats them as optional and writes empty values to .env in that case.
# ---------------------------------------------------------------------------
output "schema_registry_url" {
  description = "Schema Registry REST endpoint. Empty when schema_registry_enabled = false."
  value       = var.schema_registry_enabled ? data.confluent_schema_registry_cluster.scrc[0].rest_endpoint : ""
}

output "schema_registry_api_key" {
  description = "Schema Registry API key ID. Empty when schema_registry_enabled = false."
  value       = var.schema_registry_enabled ? confluent_api_key.scrc_sr_api_key[0].id : ""
  sensitive   = true
}

output "schema_registry_api_secret" {
  description = "Schema Registry API key secret. Empty when schema_registry_enabled = false."
  value       = var.schema_registry_enabled ? confluent_api_key.scrc_sr_api_key[0].secret : ""
  sensitive   = true
}
