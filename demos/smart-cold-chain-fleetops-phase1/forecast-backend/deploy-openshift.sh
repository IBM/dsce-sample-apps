#!/bin/bash

# FleetOps Forecasting Service - OpenShift Deployment Script
# Usage: ./deploy-openshift.sh [apply|delete|update-config|logs|status]

set -e

PROJECT="fleetops-backend"
APP_NAME="fleetops-forecasting"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if oc is installed
if ! command -v oc &> /dev/null; then
    print_error "oc CLI not found. Please install OpenShift CLI."
    exit 1
fi

# Check if logged in
if ! oc whoami &> /dev/null; then
    print_error "Not logged in to OpenShift. Please run: oc login"
    exit 1
fi

# Switch to project
print_info "Switching to project: $PROJECT"
oc project $PROJECT || {
    print_error "Failed to switch to project $PROJECT"
    exit 1
}

# Function to apply resources
apply_resources() {
    print_info "Applying ConfigMap..."
    oc apply -f openshift-configmap.yaml
    
    print_info "Applying Secret..."
    oc apply -f openshift-secret.yaml
    
    print_info "Applying Deployment, Service, and Route..."
    oc apply -f openshift-deployment.yaml
    
    print_info "Waiting for deployment to be ready..."
    oc rollout status deployment/$APP_NAME --timeout=5m
    
    print_info "Getting route URL..."
    ROUTE_URL=$(oc get route $APP_NAME -o jsonpath='{.spec.host}')
    
    print_info "Deployment complete!"
    echo ""
    echo "=========================================="
    echo "Service URL: https://$ROUTE_URL"
    echo "Health Check: https://$ROUTE_URL/health"
    echo "API Docs: https://$ROUTE_URL/docs"
    echo "=========================================="
}

# Function to delete resources
delete_resources() {
    print_warn "Deleting all resources..."
    oc delete -f openshift-deployment.yaml --ignore-not-found=true
    oc delete -f openshift-secret.yaml --ignore-not-found=true
    oc delete -f openshift-configmap.yaml --ignore-not-found=true
    print_info "Resources deleted successfully"
}

# Function to update config
update_config() {
    print_info "Updating ConfigMap..."
    oc apply -f openshift-configmap.yaml
    
    print_info "Restarting deployment to pick up new config..."
    oc rollout restart deployment/$APP_NAME
    oc rollout status deployment/$APP_NAME --timeout=5m
    
    print_info "Config updated and deployment restarted"
}

# Function to show logs
show_logs() {
    print_info "Fetching logs for $APP_NAME..."
    oc logs -f deployment/$APP_NAME
}

# Function to show status
show_status() {
    print_info "Deployment Status:"
    oc get deployment $APP_NAME
    echo ""
    
    print_info "Pods:"
    oc get pods -l app=$APP_NAME
    echo ""
    
    print_info "Service:"
    oc get service $APP_NAME
    echo ""
    
    print_info "Route:"
    oc get route $APP_NAME
    echo ""
    
    print_info "ConfigMap:"
    oc get configmap fleetops-forecasting-config
    echo ""
    
    print_info "Secret:"
    oc get secret fleetops-forecasting-secrets
}

# Main script logic
case "${1:-apply}" in
    apply)
        apply_resources
        ;;
    delete)
        delete_resources
        ;;
    update-config)
        update_config
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 [apply|delete|update-config|logs|status]"
        echo ""
        echo "Commands:"
        echo "  apply         - Deploy the forecasting service (default)"
        echo "  delete        - Delete all resources"
        echo "  update-config - Update ConfigMap and restart deployment"
        echo "  logs          - Show application logs"
        echo "  status        - Show deployment status"
        exit 1
        ;;
esac

# Made with Bob
