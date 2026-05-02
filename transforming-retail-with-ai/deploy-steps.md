# Retail Application Deployment Guide

**Purpose:** End-to-end instructions for deploying the Retail Sample App
to an OpenShift cluster using the automated deployment script.

------------------------------------------------------------------------

## 1. Overview

This document describes how to execute the deployment script that
installs prerequisites, builds and pushes container images, logs into
OpenShift, deploys application manifests, rebuilds frontend assets with
the dynamic backend route, and loads the PostgreSQL database.

The deployment script automates the following:

-   Installing unzip, podman, Java 11, OC CLI, and Apache JMeter.
-   Downloading the Retail App source from GitHub.
-   Updating image references to use the user-provided Docker Hub
    account
-   Building and pushing backend and frontend container images.
-   Logging in to OpenShift and preparing the target namespace.
-   Deploying backend, frontend, PostgreSQL, and Kubernetes manifests.
-   Rebuilding the frontend with the actual backend route.
-   Restarting deployments.
-   Loading database seed data.

------------------------------------------------------------------------

## 2. Prerequisites

### 2.1 Required Access

Before running the deployment script, ensure the following:

  -----------------------------------------------------------------------
  Requirement                        Description

  - Root access                        Script must be executed as root.

  - Docker Hub account                 Username and password/token needed
                                     for pushing images.

  - OpenShift access                   `oc login` token and API server
                                     endpoint.

  - OpenShift version                  Tested with OpenShift **4.18.x**.

  - Internet access                    Required to download tools and
                                     GitHub source repo.
------------------------------------------------------------------------

## 3. Required Inputs

The script expects **four positional parameters**:

    ./deploy.sh <OC_TOKEN> <OC_SERVER> <DOCKER_USERNAME> <DOCKER_PASSWORD>

Where:

  Parameter           Description
  ------------------- ----------------------------------------------
  `OC_TOKEN`          OpenShift login token (from `oc whoami -t`).
  `OC_SERVER`         OpenShift API server URL.
  `DOCKER_USERNAME`   Docker Hub username.
  `DOCKER_PASSWORD`   Docker Hub password or PAT.

Example:

    ./deploy.sh sha256~xyz https://api.mycluster.openshift.com:6443 mydockeruser mydockerpass

------------------------------------------------------------------------

## 4. Script Workflow Summary

### 4.1 Install Prerequisites

-   Installs unzip, podman, and Java 11\
-   Installs OpenShift CLI (oc)\
-   Installs Apache JMeter 5.6.3

### 4.2 Download Source Code

-   Downloads the GitHub repo ZIP\
-   Extracts into `/root/retailapp-main`

### 4.3 Update Kubernetes YAMLs

The script performs automated replacement of image repository
references:

    sed -i "s/technologybuildingblocks/<DOCKER_USERNAME>/g" k8s/frontend-deployment.yaml
    sed -i "s/technologybuildingblocks/<DOCKER_USERNAME>/g" k8s/backend-deployment.yaml

### 4.4 Build and Push Images

Backend:

    podman build -t docker.io/<username>/retail-backend:1.0.0 .
    podman push docker.io/<username>/retail-backend:1.0.0

Initial frontend build:

    podman build -t docker.io/<username>/retail-frontend:1.0.0 --build-arg VITE_API_BASE_URL=""
    podman push docker.io/<username>/retail-frontend:1.0.0

### 4.5 OpenShift Login and Namespace Setup

-   Logs into the OpenShift cluster\
-   Creates Docker registry pull secret\
-   Applies namespace and SCC\
-   Deploys Kubernetes manifests under `/k8s`

### 4.6 Rebuild Frontend With Backend Route

Retrieve backend route:

    oc get route -n tbb | grep retail-backend | awk '{print $2}'

Rebuild frontend with:

    --build-arg VITE_API_BASE_URL=https://<backend-route>/api

### 4.7 Restart Deployments

    oc rollout restart deployment/retail-backend -n tbb
    oc rollout restart deployment/retail-frontend -n tbb

### 4.8 Load Database

-   Copy SQL dump into PostgreSQL pod\
-   Execute SQL import using psql

------------------------------------------------------------------------

## 5. Running the Deployment Script

### 5.1 Make the script executable

    chmod +x deploy.sh

### 5.2 Execute with required parameters

    ./deploy.sh <OC_TOKEN> <OC_SERVER> <DOCKER_USERNAME> <DOCKER_PASSWORD>

### 5.3 Successful Completion

You should see:

    ---- Deployment completed successfully. ----
    [INFO] Retail App deployed, images built, database loaded, and cluster updated.

------------------------------------------------------------------------

## 6. Post‑Deployment Validation

### Check pod status

    oc get pods -n tbb

Expected:

  Component         Status
  ----------------- ---------
  retail-backend    Running
  retail-frontend   Running
  retail-postgres   Running

### Obtain frontend route

    oc get route -n tbb | grep retail-frontend

Open in browser:

    https://<frontend-route>

### Test backend health

    curl https://<backend-route>/api/health

Expected:

    {"status":"UP"}

------------------------------------------------------------------------

## 7. Troubleshooting

### Podman login fails

    podman login docker.io

### PostgreSQL pod not found

    oc get pods -l app=retail-postgres -n tbb

### Frontend cannot reach backend

Verify backend route:

    oc get route -n tbb retail-backend

------------------------------------------------------------------------

## 8. Directory Layout After Script Execution

    /root/retailapp-main/
    │── backend/
    │── frontend/
    │── k8s/
    │── db/full_dump.sql
    deploy.sh

------------------------------------------------------------------------

## 9. Notes

-   Script must run on RHEL/CentOS compatible environments.
-   Docker Hub rate limits may apply.
