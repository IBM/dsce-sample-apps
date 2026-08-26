variable "region" {
  description = "IBM Cloud region"
  type        = string
}

variable "resource_group" {
  description = "IBM Cloud resource group name"
  type        = string
}

variable "cluster_name" {
  description = "ROKS cluster name"
  type        = string
}

variable "worker_flavor" {
  description = "Worker node flavor"
  type        = string
  default     = "cxf.8x16"
}

variable "worker_count" {
  description = "Number of worker nodes per zone"
  type        = number
  default     = 2
}

variable "ocp_version" {
  description = "OpenShift version"
  type        = string
}

variable "icr_namespace" {
  description = "IBM Container Registry namespace"
  type        = string
}
