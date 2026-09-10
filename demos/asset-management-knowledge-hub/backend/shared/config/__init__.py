"""Shared configuration loader — reads from the root .env file."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Always load the single consolidated .env at the repo root
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(dotenv_path=_ROOT_ENV, override=False)


def _int(key: str, default: int) -> int:
    """Read an integer env var with a default."""
    try:
        return int(os.environ[key])
    except (KeyError, ValueError):
        return default


def _bool(key: str, default: bool = False) -> bool:
    """Read a boolean env var (true/1/yes = True)."""
    val = os.environ.get(key, "").lower()
    if val in ("true", "1", "yes"):
        return True
    if val in ("false", "0", "no"):
        return False
    return default


# ── OpenSearch ────────────────────────────────────────────────────────────────

class OpenSearchConfig:
    host: str = os.environ.get("OPENSEARCH_HOST", "https://localhost:9200")
    username: str = os.environ.get("OPENSEARCH_USERNAME", "admin")
    password: str = os.environ.get("OPENSEARCH_PASSWORD", "admin")
    index: str = os.environ.get("OPENSEARCH_INDEX", "maximo-documents")
    verify_ssl: bool = _bool("OPENSEARCH_VERIFY_SSL", False)


# ── WatsonX ───────────────────────────────────────────────────────────────────

class WatsonXConfig:
    api_key: str = os.environ.get("WATSONX_API_KEY", "")
    project_id: str = os.environ.get("WATSONX_PROJECT_ID", "")
    url: str = os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    model_id: str = os.environ.get("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")
    embedding_model_id: str = os.environ.get(
        "WATSONX_EMBEDDING_MODEL_ID", "ibm/slate-30m-english-rtrvr-v2"
    )
    embedding_dimension: int = _int("EMBEDDING_DIMENSION", 384)


# ── Maximo ────────────────────────────────────────────────────────────────────

class MaximoConfig:
    base_url: str = os.environ.get("MAXIMO_URL", "http://localhost:7001/maximo/oslc")
    username: str = os.environ.get("MAXIMO_USERNAME", "")
    password: str = os.environ.get("MAXIMO_PASSWORD", "")
    api_key: str = os.environ.get("MAXIMO_API_KEY", "")
    timeout: int = _int("MAXIMO_TIMEOUT", 30)
    verify_ssl: bool = _bool("MAXIMO_VERIFY_SSL", False)


# ── ServiceNow ────────────────────────────────────────────────────────────────

class ServiceNowConfig:
    instance_url: str = os.environ.get("SERVICENOW_INSTANCE_URL", "")
    username: str = os.environ.get("SERVICENOW_USERNAME", "")
    password: str = os.environ.get("SERVICENOW_PASSWORD", "")
    timeout: int = _int("SERVICENOW_TIMEOUT", 20)
    verify_ssl: bool = _bool("SERVICENOW_VERIFY_SSL", True)


# ── IBM COS ───────────────────────────────────────────────────────────────────

class COSConfig:
    api_key: str = os.environ.get("COS_API_KEY", "")
    bucket_name: str = os.environ.get("COS_BUCKET_NAME", "")
    endpoint: str = os.environ.get("COS_ENDPOINT", "")
    bucket_instance_crn: str = os.environ.get("COS_BUCKET_INSTANCE_CRN", "")
    region: str = os.environ.get("COS_REGION", "us-south")
    # HMAC credentials — optional, only needed for the S3-compatible ingestion path
    # Set COS_HMAC_ACCESS_KEY_ID / COS_HMAC_SECRET_ACCESS_KEY to enable S3 block
    hmac_access_key: str = os.environ.get("COS_HMAC_ACCESS_KEY_ID", "")
    hmac_secret_key: str = os.environ.get("COS_HMAC_SECRET_ACCESS_KEY", "")


# ── Confluent / Apache Kafka ──────────────────────────────────────────────────

class KafkaConfig:
    bootstrap_servers: str = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "")
    security_protocol: str = os.environ.get("KAFKA_SECURITY_PROTOCOL", "SASL_SSL")
    sasl_mechanism: str    = os.environ.get("KAFKA_SASL_MECHANISM", "PLAIN")
    api_key: str           = os.environ.get("KAFKA_API_KEY", "")
    api_secret: str        = os.environ.get("KAFKA_API_SECRET", "")
    topics: str            = os.environ.get("KAFKA_TOPICS", "")
    group_id: str          = os.environ.get("KAFKA_GROUP_ID", "maximo-knowledge-hub")
    schema_registry_url: str    = os.environ.get("SCHEMA_REGISTRY_URL", "")
    schema_registry_key: str    = os.environ.get("SCHEMA_REGISTRY_API_KEY", "")
    schema_registry_secret: str = os.environ.get("SCHEMA_REGISTRY_API_SECRET", "")


# ── Application ───────────────────────────────────────────────────────────────

class AppConfig:
    backend_port: int = _int("BACKEND_PORT", 8080)
    node_env: str = os.environ.get("NODE_ENV", "production")
    log_level: str = os.environ.get("LOG_LEVEL", "INFO").upper()
    jwt_secret: str = os.environ.get("JWT_SECRET", "change-this-in-production")
    session_secret: str = os.environ.get("SESSION_SECRET", "change-this-in-production")
    cors_origin: str = os.environ.get("CORS_ORIGIN", "http://localhost:3002")


# ── Singleton accessors ───────────────────────────────────────────────────────

opensearch = OpenSearchConfig()
watsonx = WatsonXConfig()
maximo = MaximoConfig()
servicenow = ServiceNowConfig()
cos = COSConfig()
kafka = KafkaConfig()
app = AppConfig()
