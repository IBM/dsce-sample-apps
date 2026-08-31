terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
  }
}


provider "kubernetes" {
  host                   = var.ocp_server
  token                  = var.ocp_token
}

# Ensure namespace exists (idempotent)
resource "kubernetes_namespace" "ns" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_secret_v1" "dockerhub" {
  metadata {
    name      = "dockerhub-secret"
    namespace = kubernetes_namespace.ns.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "index.docker.io" = {
          auth = base64encode("${var.docker_username}:${var.docker_password}")
        }
      }
    })
  }

  depends_on = [
    kubernetes_namespace.ns
  ]
}

