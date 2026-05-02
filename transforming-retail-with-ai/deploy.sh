#!/usr/bin/env bash
set -euo pipefail

## Input Parameters
OC_TOKEN="${1:-}"
OC_SERVER="${2:-}"
DOCKER_USERNAME="${3:-}"
DOCKER_PASSWORD="${4:-}"

[[ -z "$OC_TOKEN" || -z "$OC_SERVER" || -z "$DOCKER_USERNAME" || -z "$DOCKER_PASSWORD" ]] && \
    { echo "Usage: $0 <OC_TOKEN> <OC_SERVER> <DOCKER_USERNAME> <DOCKER_PASSWORD>"; exit 1; }

[[ $EUID -ne 0 ]] && { echo "This script must be run as root."; exit 1; }

OPENSHIFT_VERSION="4.18.28"
JMETER_VERSION="5.6.3"

NAMESPACE="tbb"
POSTGRES_LABEL="app=retail-postgres"

BACKEND_IMAGE="docker.io/${DOCKER_USERNAME}/retail-backend:1.0.0"
FRONTEND_IMAGE="docker.io/${DOCKER_USERNAME}/retail-frontend:1.0.0"

GITHUB_ZIP_URL="https://github.com/SunilManika/retailapp/archive/refs/heads/main.zip"

JMETER_INSTALL_DIR="/opt/jmeter"
JMETER_HOME="${JMETER_INSTALL_DIR}/apache-jmeter-${JMETER_VERSION}"

########################################
step()  { echo; echo "---- $* ----"; }
info()  { echo "[INFO] $*"; }
fail()  { echo "[ERROR] $*" >&2; exit 1; }

########################################
run_cmd() {
    description="$1"; shift
    info "$description"
    if ! output=$(eval "$*" 2>&1); then
        echo
        echo "[FAILED] $description"
        echo "----- ERROR OUTPUT -----"
        echo "$output"
        echo "------------------------"
        exit 1
    fi
}

########################################
spinner() {
    local pid=$1 delay=0.15 spin='|/-\'
    while ps -p "$pid" > /dev/null 2>&1; do
        printf " [%c]  " "$spin"
        spin=${spin#?}${spin%${spin#?}}
        sleep "$delay"
        printf "\b\b\b\b\b\b"
    done
    printf "      \b\b\b\b\b"
}

########################################

install_prereqs() {
    step "Installing prerequisites"
    run_cmd "Installing unzip, podman, Java 11" \
        "yum -y -q install unzip podman java-11-openjdk"
}

install_oc_cli() {
    step "Installing OpenShift CLI"
    run_cmd "Downloading oc CLI" \
        "wget -q https://mirror.openshift.com/pub/openshift-v4/x86_64/clients/ocp/${OPENSHIFT_VERSION}/openshift-client-linux-${OPENSHIFT_VERSION}.tar.gz"
    run_cmd "Extracting oc CLI" "tar -xzf openshift-client-linux-${OPENSHIFT_VERSION}.tar.gz"
    run_cmd "Moving oc binaries" "mv oc kubectl /usr/local/bin/"
}

install_jmeter() {
    step "Installing JMeter $JMETER_VERSION"
    mkdir -p "$JMETER_INSTALL_DIR"
    cd "$JMETER_INSTALL_DIR"
    run_cmd "Downloading JMeter" \
        "wget -q https://dlcdn.apache.org/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.zip"
    run_cmd "Unzipping JMeter" "unzip -qo apache-jmeter-${JMETER_VERSION}.zip"
    export JMETER_HOME PATH="$JMETER_HOME/bin:$PATH"
}

download_application() {
    step "Downloading application source"
    cd ~
    run_cmd "Downloading retailapp ZIP" "wget -q $GITHUB_ZIP_URL -O main.zip"
    run_cmd "Unzipping repo" "unzip -qo main.zip"
}

update_yaml_images() {
    step "Updating YAMLs with Docker username"
    sed -i "s/technologybuildingblocks/${DOCKER_USERNAME}/g" ~/retailapp-main/k8s//frontend-deployment.yaml
    sed -i "s/technologybuildingblocks/${DOCKER_USERNAME}/g" ~/retailapp-main/k8s//backend-deployment.yaml
    sed -i "s/namespace: tbb/namespace: ${NAMESPACE}/g" ~/retailapp-main/k8s/*.yaml
    sed -i "s/name: tbb/name: $NAMESPACE/g" ~/retailapp-main/k8s/namespace.yaml
}

oc_login() {
    step "Logging into OpenShift"
    run_cmd "oc login" \
        "oc login --token=$OC_TOKEN --server=$OC_SERVER"
}

create_docker_secret() {
    step "Creating Docker registry pull secret"
    run_cmd "Creating dockerhub-secret" \
        "oc create secret docker-registry dockerhub-secret \
            --docker-server=docker.io \
            --docker-username=$DOCKER_USERNAME \
            --docker-password=$DOCKER_PASSWORD \
            --docker-email=test123@test.com \
            -n $NAMESPACE || true"
}

build_and_push_backend() {
    step "Building backend image"
    cd ~/retailapp-main/backend/
    run_cmd "Build backend" "podman build -t $BACKEND_IMAGE . > /dev/null"
    run_cmd "Push backend"  "podman push $BACKEND_IMAGE > /dev/null"
}

build_and_push_frontend_initial() {
    step "Building initial frontend image"
    cd ~/retailapp-main/frontend/
    run_cmd "Build frontend (initial)" \
        "podman build -t $FRONTEND_IMAGE --build-arg VITE_API_BASE_URL='' . > /dev/null"
    run_cmd "Push frontend (initial)" "podman push $FRONTEND_IMAGE > /dev/null"
}

prepare_namespace() {
    step "Creating namespace and applying SCC"
    run_cmd "Apply namespace" "oc apply -f ~/retailapp-main/k8s/namespace.yaml"
    run_cmd "Apply SCC to service account" \
        "oc adm policy add-scc-to-user anyuid -z tbb -n $NAMESPACE"
}

deploy_manifests() {
    step "Applying Kubernetes manifests"
    run_cmd "oc apply" "oc apply -f ~/retailapp-main/k8s/"
}

rebuild_frontend_with_route() {
    step "Fetching backend route"
    BACKEND_ROUTE=$(oc get route -n "$NAMESPACE" | grep retail-backend | awk '{print $2}' || true)
    [[ -z "$BACKEND_ROUTE" ]] && fail "Could not retrieve backend route."
    info "Backend route: $BACKEND_ROUTE"

    step "Rebuilding frontend image with backend route"
    cd ~/retailapp-main/frontend/
    run_cmd "Build frontend (final)" \
        "podman build -t $FRONTEND_IMAGE --build-arg VITE_API_BASE_URL=https://$BACKEND_ROUTE/api . > /dev/null"
    run_cmd "Push frontend (final)" "podman push $FRONTEND_IMAGE > /dev/null"
}

restart_deployments() {
    step "Restarting deployments"

    info "Restarting backend"
    oc rollout restart deployment/retail-backend -n "$NAMESPACE" > /dev/null
    (oc rollout status deployment/retail-backend -n "$NAMESPACE" > /dev/null) & spinner $!

    info "Restarting frontend"
    oc rollout restart deployment/retail-frontend -n "$NAMESPACE" > /dev/null
    (oc rollout status deployment/retail-frontend -n "$NAMESPACE" > /dev/null) & spinner $!
}

load_database() {
    step "Loading database"

    cd ~/retailapp-main

    info "Locating PostgreSQL pod..."
    for _ in {1..10}; do
        POD=$(oc get pod -n "$NAMESPACE" -l "$POSTGRES_LABEL" -o jsonpath='{.items[0].metadata.name}' || true)
        [[ -n "$POD" ]] && break
        sleep 5
    done

    [[ -z "$POD" ]] && fail "PostgreSQL pod not found."
    info "PostgreSQL pod: $POD"

    run_cmd "Copy SQL dump" \
        "oc cp postgres/full_dump.sql -n $NAMESPACE $POD:/tmp/full_dump.sql"

    run_cmd "Import database" \
        "oc exec -n $NAMESPACE $POD -- bash -c 'psql -U retail_user -d retaildb < /tmp/full_dump.sql'"
}

# MAIN SCRIPT EXECUTION
install_prereqs
install_oc_cli
install_jmeter

download_application
cd ~/retailapp-main
update_yaml_images

run_cmd "Podman login" \
    "podman login -u ${DOCKER_USERNAME} -p '${DOCKER_PASSWORD}' docker.io"

build_and_push_backend
build_and_push_frontend_initial

oc_login
create_docker_secret

prepare_namespace
deploy_manifests

rebuild_frontend_with_route
restart_deployments
load_database

step "Deployment completed successfully."
info "Retail App deployed, images built, database loaded, and cluster updated."
