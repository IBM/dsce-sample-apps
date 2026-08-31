variable "namespace" {
  type = string
}

variable "ocp_server" {
  type = string
}

variable "ocp_token" {
  type      = string
  sensitive = true
}


