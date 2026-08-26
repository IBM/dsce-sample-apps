terraform {
  required_version = ">= 1.5"
  required_providers {
    ibm = {
      source  = "IBM-Cloud/ibm"
      version = "~> 1.67"
    }
  }
}

provider "ibm" {
  region           = var.region
  resource_group   = var.resource_group
  # IBMCLOUD_API_KEY is read automatically from the environment
}

# ── VPC (already exists — imported) ────────────────────────────────────────────
resource "ibm_is_vpc" "main" {
  name           = "orbital-suppliers-vpc"
  resource_group = data.ibm_resource_group.main.id
}

# ── Subnets (already exist — imported) ─────────────────────────────────────────
resource "ibm_is_subnet" "zone1" {
  name            = "orbital-suppliers-subnet-us-south-1"
  vpc             = ibm_is_vpc.main.id
  zone            = "${var.region}-1"
  ipv4_cidr_block = "10.240.0.0/24"
  resource_group  = data.ibm_resource_group.main.id
}

resource "ibm_is_subnet" "zone2" {
  name            = "orbital-suppliers-subnet-us-south-2"
  vpc             = ibm_is_vpc.main.id
  zone            = "${var.region}-2"
  ipv4_cidr_block = "10.240.64.0/24"
  resource_group  = data.ibm_resource_group.main.id
}

# ── ROKS cluster ────────────────────────────────────────────────────────────────
resource "ibm_container_vpc_cluster" "main" {
  name                                = var.cluster_name
  vpc_id                              = ibm_is_vpc.main.id
  flavor                              = var.worker_flavor
  worker_count                        = var.worker_count
  kube_version                        = var.ocp_version
  resource_group_id                   = data.ibm_resource_group.main.id
  cos_instance_crn                    = "crn:v1:bluemix:public:cloud-object-storage:global:a/e65910fa61ce9072d64902d03f3d4774:0d6d25cf-167a-49e3-9825-599ba57cb518::"

  zones {
    subnet_id = ibm_is_subnet.zone1.id
    name      = "${var.region}-1"
  }

  lifecycle {
    ignore_changes = [kube_version]
  }
}

# ── ICR namespace (already exists — imported) ───────────────────────────────────
resource "ibm_cr_namespace" "main" {
  name              = var.icr_namespace
  resource_group_id = data.ibm_resource_group.main.id
}

# ── Data sources ────────────────────────────────────────────────────────────────
data "ibm_resource_group" "main" {
  name = var.resource_group
}
