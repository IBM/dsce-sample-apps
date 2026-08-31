terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

resource "null_resource" "load_database" {

  triggers = {
    namespace = var.namespace
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e

      echo "Waiting for PostgreSQL pod to be Ready..."
      oc wait --for=condition=Ready pod \
        -l app=retail-postgres \
        -n ${var.namespace} \
        --timeout=300s

      POD=$(oc get pod -n ${var.namespace} -l app=retail-postgres -o jsonpath='{.items[0].metadata.name}')
      echo "Using pod: $POD"

      echo "Waiting for PostgreSQL to accept connections..."
      until oc exec -n ${var.namespace} $POD -- \
        pg_isready -h localhost -U retail_user -d retaildb; do
        echo "PostgreSQL not ready yet, retrying in 5s..."
        sleep 5
      done

      echo "PostgreSQL is ready. Importing database..."

      oc exec -n ${var.namespace} $POD -- \
        psql -h localhost -U retail_user -d retaildb -f /tmp/full_dump.sql

      echo "Database load completed successfully"
    EOT
  }
}
