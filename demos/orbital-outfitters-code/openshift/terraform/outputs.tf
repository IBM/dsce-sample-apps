output "cluster_id" {
  description = "ROKS cluster ID"
  value       = ibm_container_vpc_cluster.main.id
}

output "cluster_ingress_hostname" {
  description = "Cluster ingress hostname (OCP_APP_HOSTNAME)"
  value       = ibm_container_vpc_cluster.main.ingress_hostname
}

output "icr_url" {
  description = "ICR registry URL"
  value       = "us.icr.io/${var.icr_namespace}"
}
