#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-milvus-compose.yaml}"
ENGINE="${ENGINE:-docker}"

MILVUS_USERNAME="${MILVUS_USERNAME:-root}"
MILVUS_PASSWORD="${MILVUS_PASSWORD:-Milvus}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
MINIO_BUCKET="${MINIO_BUCKET:-milvus-bucket}"

if [[ "${MILVUS_USERNAME}" != "root" ]]; then
  echo "Milvus initial startup user is fixed to 'root'."
  echo "Using root as the Milvus username and ignoring MILVUS_USERNAME=${MILVUS_USERNAME}."
fi

export MILVUS_USERNAME="root"
export MILVUS_PASSWORD
export MINIO_ROOT_USER
export MINIO_ROOT_PASSWORD
export MINIO_BUCKET

compose_cmd() {
  if [[ "${ENGINE}" == "podman" ]]; then
    podman compose -f "${COMPOSE_FILE}" "$@"
  else
    docker compose -f "${COMPOSE_FILE}" "$@"
  fi
}

case "${1:-start}" in
  start)
    compose_cmd up -d
    echo
    echo "Started services."
    echo "Milvus:"
    echo "  Host: localhost"
    echo "  Port: 19530"
    echo "  Username: root"
    echo "  Password: ${MILVUS_PASSWORD}"
    echo "  Web UI: http://localhost:9091/webui/"
    echo
    echo "MinIO:"
    echo "  API: http://localhost:9000"
    echo "  Console: http://localhost:9001"
    echo "  Username: ${MINIO_ROOT_USER}"
    echo "  Password: ${MINIO_ROOT_PASSWORD}"
    echo "  Bucket: ${MINIO_BUCKET}"
    ;;

  stop)
    compose_cmd down
    ;;

  restart)
    compose_cmd down
    compose_cmd up -d
    ;;

  logs)
    compose_cmd logs
    ;;

  logs-follow)
    compose_cmd logs -f
    ;;

  status)
    compose_cmd ps
    ;;

  delete)
    compose_cmd down --remove-orphans
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|logs|logs-follow|status|delete}"
    echo
    echo "Examples:"
    echo '  ./run.sh start'
    echo '  MILVUS_PASSWORD=StrongPass123 ./run.sh start'
    echo '  ENGINE=podman MILVUS_PASSWORD=StrongPass123 MINIO_ROOT_USER=myminio MINIO_ROOT_PASSWORD=MyMinioPass123 ./run.sh start'
    exit 1
    ;;
esac
