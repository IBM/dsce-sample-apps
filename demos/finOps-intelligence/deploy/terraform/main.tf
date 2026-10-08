# Terraform Configuration for IBM Cloud Code Engine Deployment

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    ibm = {
      source  = "IBM-Cloud/ibm"
      version = ">= 1.65.0"
    }
  }
}

variable "ibmcloud_api_key" {
  description = "IBM Cloud API Key"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "IBM Cloud Region (e.g. us-south, us-east, eu-de)"
  type        = string
  default     = "us-south"
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "default"
}

variable "project_name" {
  description = "Name of the Code Engine Project"
  type        = string
  default     = "finops-turbo-project"
}

variable "app_name" {
  description = "Name of the Code Engine Application"
  type        = string
  default     = "turbo-cloud-demo"
}

variable "image_reference" {
  description = "Container image reference (e.g. icr.io/namespace/turbo-cloud-demo:latest)"
  type        = string
}

provider "ibm" {
  ibmcloud_api_key = var.ibmcloud_api_key
  region           = var.region
}

data "ibm_resource_group" "group" {
  name = var.resource_group_name
}

resource "ibm_code_engine_project" "ce_project" {
  name              = var.project_name
  resource_group_id = data.ibm_resource_group.group.id
}

resource "ibm_code_engine_app" "ce_app" {
  project_id      = ibm_code_engine_project.ce_project.project_id
  name            = var.app_name
  image_reference = var.image_reference
  image_port      = 8080

  scale_min_instances = 0
  scale_max_instances = 3
  scale_cpu_limit     = "0.5"
  scale_memory_limit  = "1G"

  probe_ready {
    type     = "http"
    path     = "/health"
    port     = 8080
    interval = 10
    timeout  = 5
  }

  probe_liveness {
    type     = "http"
    path     = "/health"
    port     = 8080
    interval = 30
    timeout  = 5
  }
}

output "application_endpoint" {
  description = "Public URL of the deployed application"
  value       = ibm_code_engine_app.ce_app.endpoint
}
