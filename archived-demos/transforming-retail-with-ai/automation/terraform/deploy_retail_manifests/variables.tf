variable "namespace" {
  description = "Target OpenShift namespace"
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

variable "docker_username" {
  description = "Docker Hub username to be used in image references"
  type        = string
}

variable "postgres_db" {
  type = string
}

variable "postgres_user" {
  type = string
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

