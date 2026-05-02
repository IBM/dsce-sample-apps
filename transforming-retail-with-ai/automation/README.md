# Retail Application Deployment Automation  
**Ansible + Terraform on OpenShift**

---

## Overview

This document describes the end-to-end automation for deploying the Retail Sample Application on an OpenShift cluster using Ansible and Terraform.

Ansible orchestrates environment preparation, image builds, authentication, and sequencing. Terraform is used for Kubernetes/OpenShift resource provisioning and database initialization.

---

## High-Level Flow

1. Export required environment variables  
2. Run Ansible playbook (`site.yaml`)  
3. Ansible invokes Terraform modules  
4. Terraform deploys Kubernetes/OpenShift resources  
5. Database is initialized once using Terraform automation  

---

## Automation Components

### Ansible Responsibilities
- Install prerequisites
- Install OpenShift CLI (`oc`)
- Download application source
- Build & push container images
- Login to OpenShift
- Create Docker registry secret
- Invoke Terraform modules
- Restart deployments
- Trigger database load

### Terraform Responsibilities
- Namespace creation
- Kubernetes manifests deployment
- Service, Route, HPA provisioning
- PostgreSQL database initialization

---

## Prerequisites

- Linux VM (RHEL/CentOS/Rocky)
- OpenShift cluster access
- Docker Hub (or compatible registry) credentials
- Root or sudo privileges
- Internet access

---
## Download Retail Application Source Code

Follow the steps below to download the Retail Sample Application source code from GitHub.

Ensure the following tools are available on your system:

Linux terminal access
wget installed

RHEL / CentOS:

```bash
sudo yum install -y wget
```

Step 1: Navigate to the Working Directory

Choose a directory where you want to download the source code.

cd /opt
(You may choose a different directory if required.)

Step 2: Download the Source Code ZIP

Run the following command to download the latest version of the Retail Application source code from GitHub:

```bash
wget https://github.com/SunilManika/retailapp/archive/refs/heads/main.zip
```

This command downloads the repository as a compressed ZIP file named:
```bash
main.zip
```
Step 3: Verify the Download

Confirm that the ZIP file was downloaded successfully:
```bash
ls -lh main.zip
```

You should see the main.zip file listed with a non-zero file size.

Step 4: Extract the Source Code

Unzip the downloaded archive:

```bash
unzip main.zip
```

This will create a directory:

```bash
retailapp-main/
```
Step 5: Navigate to the Application Directory

```bash
cd retailapp-main
```

You now have access to the full Retail Application source code, including backend, frontend, Terraform, and Ansible automation assets.

---

## Environment Variables

Export the following variables before running the automation:

```bash
export OCP_SERVER="https://a200-e.us-west.containers.cloud.ibm.com:32533"
export OCP_TOKEN="sha256~MxZb2J1NOk7XJ2H2fgBPDbZd6IIHffQG"

export DOCKER_USERNAME="technologybuildingblocks"
export DOCKER_PASSWORD="Workshops@123"
```

---

## Deployment Command

Run the following command from the root directory:

```bash
ansible-playbook site.yaml
```

---

## site.yaml (Execution Flow)

```yaml
- hosts: localhost
  become: true
  gather_facts: false

  vars:
    namespace: retail-automation-ansible
    app_dir: /opt/retailapp
    terraform_dir: /media/gold/gold

    ocp_server: "{{ lookup('env','OCP_SERVER') }}"
    ocp_token: "{{ lookup('env','OCP_TOKEN') }}"

    docker_username: "{{ lookup('env','DOCKER_USERNAME') }}"
    docker_password: "{{ lookup('env','DOCKER_PASSWORD') }}"

  tasks:
    - include_role: { name: install_prereqs }
    - include_role: { name: install_oc_cli }
    - include_role: { name: install_jmeter }
    - include_role: { name: download_application }
    - include_role: { name: update_yaml_images }
    - include_role: { name: oc_login }
    - include_role: { name: terraform_create_docker_secret }
    - include_role: { name: build_postgresql }
    - include_role: { name: build_backend }
    - include_role: { name: build_frontend_initial }
    - include_role: { name: terraform_prepare_namespace }
    - include_role: { name: terraform_deploy_retail_manifests }
    - include_role: { name: rebuild_frontend_with_route }
    - include_role: { name: restart_deployments }
    - include_role: { name: terraform_load_database }
```

---

## Post Deployment Validation

```bash
oc get pods -n retail-automation-ansible
oc get routes -n retail-automation-ansible
```

---

## Cleanup (Optional)

```bash
terraform destroy -auto-approve
```

---

## Summary

This automation provides:
- Fully repeatable deployment
- Secure environment-based configuration
- Clear separation of orchestration (Ansible) and infrastructure (Terraform)
- Production-aligned OpenShift deployment

---
