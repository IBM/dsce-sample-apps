#!/usr/bin/env bash
set -euo pipefail

info() {
  echo "[INFO] $1"
}

success() {
  echo "[OK]   $1"
}

error() {
  echo "[ERROR] $1"
  exit 1
}

echo "==========================================="
echo " Installing Terraform and Ansible"
echo "==========================================="

if [[ "$EUID" -ne 0 ]]; then
  error "Please run as root or with sudo"
fi

if [[ -f /etc/os-release ]]; then
  . /etc/os-release
else
  error "Unable to detect operating system"
fi

info "Detected OS: ${NAME}"

install_prereqs() {
  info "Installing system prerequisites..."

  if [[ "$ID" == "ubuntu" || "$ID_LIKE" == *"debian"* ]]; then
    apt-get update -y >/dev/null 2>&1
    apt-get install -y \
      curl wget unzip gnupg software-properties-common \
      python3 python3-pip >/dev/null 2>&1

  elif [[ "$ID" == "rhel" || "$ID_LIKE" == *"rhel"* || "$ID" == "rocky" || "$ID" == "almalinux" ]]; then
    yum install -y \
      yum-utils curl wget unzip \
      python3 python3-pip >/dev/null 2>&1

  elif [[ "$ID" == "amzn" ]]; then
    yum install -y \
      yum-utils curl wget unzip \
      python3 python3-pip >/dev/null 2>&1
  else
    error "Unsupported OS: $ID"
  fi

  success "Prerequisites installed"
}

ensure_python() {
  info "Validating Python runtime for Ansible..."

  if ! command -v python3 >/dev/null 2>&1; then
    error "python3 is required but not found"
  fi

  if [[ ! -x /usr/bin/python ]]; then
    ln -sf /usr/bin/python3 /usr/bin/python
    info "Created /usr/bin/python symlink to python3"
  fi

  success "Python runtime ready"
}

install_terraform() {
  info "Installing Terraform..."

  TERRAFORM_VERSION="1.8.5"
  TMP_DIR="/tmp/terraform-install"

  mkdir -p "$TMP_DIR"
  cd "$TMP_DIR"

  info "Downloading Terraform ${TERRAFORM_VERSION}"
  wget -q https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip

  info "Extracting Terraform binary"
  unzip -oq terraform_${TERRAFORM_VERSION}_linux_amd64.zip

  mv terraform /usr/local/bin/
  chmod +x /usr/local/bin/terraform

  if command -v terraform >/dev/null 2>&1; then
    success "Terraform installed successfully"
    terraform version | head -n 1
  else
    error "Terraform installation failed"
  fi

  rm -rf "$TMP_DIR"
}

install_ansible() {
  info "Installing Ansible..."

  if [[ "$ID" == "ubuntu" || "$ID_LIKE" == *"debian"* ]]; then
    add-apt-repository --yes ppa:ansible/ansible >/dev/null 2>&1
    apt-get update -y >/dev/null 2>&1
    apt-get install -y ansible >/dev/null 2>&1

  elif [[ "$ID" == "rhel" || "$ID_LIKE" == *"rhel"* || "$ID" == "rocky" || "$ID" == "almalinux" ]]; then
    dnf install -y ansible-core >/dev/null 2>&1

  elif [[ "$ID" == "amzn" ]]; then
    amazon-linux-extras enable ansible2 >/dev/null 2>&1
    yum install -y ansible >/dev/null 2>&1
  else
    error "Unsupported OS for Ansible installation"
  fi

  ansible --version 2>/dev/null | head -n 1 || info "Ansible installed successfully"
}

install_prereqs
install_terraform
ensure_python
install_ansible

echo "==========================================="
success "Terraform and Ansible installation completed"
echo "==========================================="
