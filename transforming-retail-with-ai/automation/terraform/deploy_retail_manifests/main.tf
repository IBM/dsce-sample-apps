terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
  }
}

provider "kubernetes" {
  host  = var.ocp_server
  token = var.ocp_token
}

locals {
  manifest_templates = fileset("${path.module}/k8s", "*.yaml.tpl")
}

resource "kubernetes_manifest" "retail" {
  for_each = { for f in local.manifest_templates : f => f }

  manifest = yamldecode(
    templatefile(
      "${path.module}/k8s/${each.value}",
      {
        namespace       = var.namespace
        docker_username = var.docker_username

        postgres_db        = base64encode(var.postgres_db)
        postgres_user      = base64encode(var.postgres_user)
        postgres_password  = base64encode(var.postgres_password)
      }
    )
  )

  field_manager {
    name            = "terraform"
    force_conflicts = false
  }
}
