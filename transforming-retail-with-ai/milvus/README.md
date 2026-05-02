# Milvus Setup

This directory contains configuration for Milvus vector database.

## Files

- `milvus-compose.yaml` - Docker Compose configuration for Milvus
- `run-local.sh` - Script to run Milvus locally

## Usage

To run Milvus locally:

```bash
./run-local.sh
```

This will start Milvus using Docker Compose.

## Requirements

- Docker
- Docker Compose

## Configuration

The Milvus instance will be available at:
- Milvus: `localhost:19530`
- Attu (Web UI): `localhost:8000`

## Documentation

For more information about Milvus, visit: https://milvus.io/docs
