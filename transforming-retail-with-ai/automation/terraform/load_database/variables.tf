variable "namespace" {
  description = "Target namespace for Retail app"
  type        = string
}

variable "ocp_server" {
  description = "OpenShift API server URL"
  type        = string
}

variable "ocp_token" {
  description = "OpenShift API token"
  type        = string
  sensitive   = true
}

