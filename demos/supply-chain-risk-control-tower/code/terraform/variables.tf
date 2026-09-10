variable "confluent_cloud_api_key" {
  description = "Confluent Cloud API key with permissions to create environments and clusters."
  type        = string
  sensitive   = true
}

variable "confluent_cloud_api_secret" {
  description = "Confluent Cloud API secret."
  type        = string
  sensitive   = true
}

variable "existing_environment_id" {
  description = <<-EOT
    Optional. Reuse an existing Confluent Cloud environment (e.g. env-abc123) instead of
    creating a new one. When set, Terraform imports the environment rather than creating it.
    Required when your Cloud Resource Management API key cannot create new environments.
  EOT
  type        = string
  default     = ""
}

variable "cloud_provider" {
  description = "Cloud provider for Confluent Cloud cluster."
  type        = string
  default     = "AWS"
}

variable "region" {
  description = "Cloud region for Confluent Cloud cluster."
  type        = string
  default     = "us-east-2"
}

variable "environment_name" {
  description = "Confluent Cloud environment name."
  type        = string
  default     = "scrc-building-block"
}

variable "cluster_name" {
  description = "Confluent Cloud Kafka cluster name."
  type        = string
  default     = "scrc-demo-cluster"
}

variable "cluster_availability" {
  description = "Cluster availability. Use SINGLE_ZONE for demos unless your org requires otherwise."
  type        = string
  default     = "SINGLE_ZONE"
}

variable "topic_partitions" {
  description = "Default partition count for demo topics."
  type        = number
  default     = 3
}

variable "schema_registry_enabled" {
  description = <<-EOT
    Whether to look up and create API keys for Schema Registry.
    Set to false if your Confluent environment does not have Stream Governance
    (Schema Registry) enabled — this prevents Terraform apply from failing.
    You can enable it later and re-run terraform apply.
  EOT
  type        = bool
  default     = true
}

variable "topic_names" {
  description = "Kafka topics for the Supply Chain Risk Control Tower."
  type        = set(string)
  default = [
    "supplier_profiles",
    "component_master",
    "purchase_orders",
    "shipments",
    "inventory_levels",
    "customer_orders",
    "external_risk_events",
    "supply_chain_risk_scores",
    "supply_chain_recommendations",
    "control_tower_alerts",
  ]
}
