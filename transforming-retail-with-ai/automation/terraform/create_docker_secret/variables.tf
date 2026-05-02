variable "namespace" {
  description = "Target namespace"
  type        = string
}

variable "docker_username" {
  description = "Docker Hub username"
  type        = string
}

variable "docker_password" {
  description = "Docker Hub password"
  type        = string
  sensitive   = true
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

