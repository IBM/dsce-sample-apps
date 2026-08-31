terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
  }
}

############################
# Provider
############################
provider "kubernetes" {
  host                   = var.ocp_server
  token                  = var.ocp_token
}

############################
# Validate namespace exists
############################
data "kubernetes_namespace" "existing" {
  metadata {
    name = var.namespace
  }
}

############################
# Label namespace (optional)
############################
resource "kubernetes_labels" "namespace_labels" {
  api_version = "v1"
  kind        = "Namespace"

  metadata {
    name = data.kubernetes_namespace.existing.metadata[0].name
  }

  labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "app"                          = "retail"
  }
}

############################
# Grant ANYUID SCC
# Equivalent to:
# oc adm policy add-scc-to-user anyuid -z tbb -n <namespace>
############################
resource "kubernetes_role_binding_v1" "anyuid_scc" {
  metadata {
    name      = "anyuid-scc"
    namespace = var.namespace
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "system:openshift:scc:anyuid"
  }

  subject {
    kind      = "ServiceAccount"
    name      = "default"
    namespace = var.namespace
  }
}

