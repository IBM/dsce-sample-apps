"""Shared configuration loaded from .env (project root or parent).

v2 DataFabric — environment variables
--------------------------------------
Confluent (IBM Kafka):              CONFLUENT_*
DataStax (IBM Cassandra):           DATASTAX_*
MinIO (OSS) / IBM COS:              MINIO_* / COS_*
Databricks interop:                 DATABRICKS_*
Trino (OSS) / watsonx.data Presto:  TRINO_* (also reuses WATSONX_DATA_HOST)
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Try project-local .env first, then parent (workspace root)
_here = Path(__file__).parent
for _candidate in [_here / ".env", _here.parent / ".env"]:
    if _candidate.exists():
        load_dotenv(_candidate, override=False)
        break

SEED = int(os.getenv("SEED", "20260812"))
# Local DuckDB used only by the synthetic generator (test/local dev scratch).
# The v2 pipeline runtime uses Trino/watsonx.data; DuckDB never serves as the
# pipeline runtime (Hardening Addendum §3).
DB_PATH = os.getenv("LOCAL_DB_PATH", str(_here / "data" / "motivation_graph.duckdb"))

# ── watsonx.ai ────────────────────────────────────────────────────────────────
WATSONX_AI_API_KEY = os.getenv("WATSONX_AI_API_KEY") or os.getenv("WATSONX_API_KEY", "")
WATSONX_AI_PROJECT_ID = os.getenv("WATSONX_AI_PROJECT_ID") or os.getenv("WATSONX_PROJECT") or os.getenv("WATSONX_PROJECT_ID", "")
WATSONX_REGION = os.getenv("WATSONX_REGION", "us-south")
WATSONX_AI_MODEL = os.getenv("WATSONX_AI_MODEL") or os.getenv("WATSONX_MODEL") or os.getenv("WATSONX_MODEL_ID", "granite-3-8b-instruct")
WATSONX_AI_URL = os.getenv("WATSONX_AI_URL", f"https://{WATSONX_REGION}.ml.cloud.ibm.com")

# ── watsonx.data / Trino (IBM: watsonx.data Presto, OSS: local Trino) ─────────
WATSONX_DATA_HOST = os.getenv("WATSONX_DATA_HOST", "")
WATSONX_DATA_PORT = int(os.getenv("WATSONX_DATA_PORT", "443"))
WATSONX_DATA_CATALOG = os.getenv("WATSONX_DATA_CATALOG", "")
WATSONX_DATA_SCHEMA = os.getenv("WATSONX_DATA_SCHEMA", "")
WATSONX_DATA_USER = os.getenv("WATSONX_DATA_USER", "")
WATSONX_DATA_PASSWORD = os.getenv("WATSONX_DATA_PASSWORD", "")
# watsonx.data Presto auth uses Basic Auth with a derived username and the
# IAM API key (WATSONX_AI_API_KEY) as the password — NOT a bearer token.
#   user     = "ibmlhapikey_<ibm-email>"
#   password = WATSONX_AI_API_KEY
WATSONX_DATA_PRESTO_USER = (
    f"ibmlhapikey_{WATSONX_DATA_USER}" if WATSONX_DATA_USER else ""
)

# Trino: explicit TRINO_HOST/PORT env vars take precedence; fall back to
# WATSONX_DATA_HOST only if TRINO_HOST is not set; final default is localhost.
# This keeps the local OSS Trino (port 8090) reachable when enterprise creds
# are set in the shell but TRINO_HOST is not explicitly overridden.
TRINO_HOST = os.getenv("TRINO_HOST") or os.getenv("WATSONX_DATA_HOST") or "localhost"
# Default port 8090: Trino container maps host:8090 → container:8080 to avoid
# collision with SSH tunnels that commonly occupy host port 8080.
# If WATSONX_DATA_HOST is set (enterprise), port 30186 is used; OSS local = 8090.
_trino_port_default = "8090" if not os.getenv("WATSONX_DATA_HOST") else os.getenv("WATSONX_DATA_PORT", "30186")
TRINO_PORT = int(os.getenv("TRINO_PORT", _trino_port_default))
TRINO_USER = os.getenv("TRINO_USER") or os.getenv("WATSONX_DATA_USER") or "admin"
TRINO_PASSWORD = os.getenv("TRINO_PASSWORD") or os.getenv("WATSONX_DATA_PASSWORD") or ""
# Catalog names: default to watsonx.data catalog when WATSONX_DATA_CATALOG is set,
# fall back to OSS Trino defaults ("iceberg", "cassandra", "databricks").
TRINO_CATALOG_ICEBERG = os.getenv("TRINO_CATALOG_ICEBERG") or os.getenv("WATSONX_DATA_CATALOG") or "iceberg"
TRINO_CATALOG_CASSANDRA = os.getenv("TRINO_CATALOG_CASSANDRA", "cassandra")
TRINO_CATALOG_DATABRICKS = os.getenv("TRINO_CATALOG_DATABRICKS", "databricks")
# Schema: inherit from WATSONX_DATA_SCHEMA when set; OSS default is "biw"
TRINO_SCHEMA = os.getenv("TRINO_SCHEMA") or os.getenv("WATSONX_DATA_SCHEMA") or "biw"
# TLS: required for watsonx.data (port 30186); auto-enable when WATSONX_DATA_HOST
# is set and TRINO_TLS is not explicitly overridden.
_tls_default = "true" if os.getenv("WATSONX_DATA_HOST") else "false"
TRINO_TLS = os.getenv("TRINO_TLS", _tls_default).lower() in ("1", "true", "yes")

# ── watsonx Orchestrate ────────────────────────────────────────────────────────
WATSONX_ORCHESTRATE_URL = os.getenv("WATSONX_ORCHESTRATE_URL", "")
WATSONX_ORCHESTRATE_API_KEY = os.getenv("WATSONX_ORCHESTRATE_API_KEY", "")
WATSONX_ORCHESTRATE_ENV_ID = os.getenv("WATSONX_ORCHESTRATE_ENV_ID", "")

# ── watsonx.governance ─────────────────────────────────────────────────────────
WATSONX_GOVERNANCE_URL = os.getenv("WATSONX_GOVERNANCE_URL", "")
WATSONX_GOVERNANCE_API_KEY = os.getenv("WATSONX_GOVERNANCE_API_KEY", "")
WATSONX_GOVERNANCE_SPACE_ID = os.getenv("WATSONX_GOVERNANCE_SPACE_ID", "")
WATSONX_GOVERNANCE_INVENTORY_ID = os.getenv("WATSONX_GOVERNANCE_INVENTORY_ID", "")

# ── B1: Confluent / Apache Kafka  (IBM: IBM Confluent, OSS: localhost:9092) ────
CONFLUENT_BOOTSTRAP_SERVERS = os.getenv("CONFLUENT_BOOTSTRAP_SERVERS", "localhost:9092")
CONFLUENT_SECURITY_PROTOCOL = os.getenv("CONFLUENT_SECURITY_PROTOCOL", "PLAINTEXT")
CONFLUENT_SASL_MECHANISM = os.getenv("CONFLUENT_SASL_MECHANISM", "")
CONFLUENT_SASL_USERNAME = os.getenv("CONFLUENT_SASL_USERNAME", "")
CONFLUENT_SASL_PASSWORD = os.getenv("CONFLUENT_SASL_PASSWORD", "")
KAFKA_TOPIC_CRM = os.getenv("KAFKA_TOPIC_CRM", "biw.salesforce.cdc")
KAFKA_TOPIC_COLLAB = os.getenv("KAFKA_TOPIC_COLLAB", "biw.slack.events")
KAFKA_TOPIC_BATCH = os.getenv("KAFKA_TOPIC_BATCH", "biw.batch.ingest")
# Consumer group
KAFKA_CONSUMER_GROUP = os.getenv("KAFKA_CONSUMER_GROUP", "biw-dualwrite-consumer")

# ── B2: DataStax / Apache Cassandra  (IBM: IBM DataStax, OSS: localhost:9042) ──
DATASTAX_KEYSPACE = os.getenv("DATASTAX_KEYSPACE", "biwdemo")
DATASTAX_SCB_PATH = os.getenv("DATASTAX_SCB_PATH", "secure-connect-biw-demo.zip")
DATASTAX_TOKEN = os.getenv("DATASTAX_TOKEN") 

# ── B2: MinIO (OSS local) / IBM Cloud Object Storage ─────────────────────────
# IBM COS is S3-compatible. Set COS_* vars to switch from local MinIO to IBM COS;
# all pipeline code consumes the effective OBJ_* vars and needs no other changes.
# Obtain HMAC credentials from: IBM Cloud Console → Cloud Object Storage →
# Service credentials → New credential (toggle "Include HMAC credential": on).

# Iceberg REST catalog endpoint (local OSS: tabulario/iceberg-rest on port 8181)
ICEBERG_REST_URI = os.getenv("ICEBERG_REST_URI", "http://localhost:8181")

# MinIO host port remapped to 18002 (ports 9000-9014 occupied by Rancher Desktop proxy on this host)
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:18002")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "biw-lakehouse")

# IBM COS credentials (HMAC).  Leave empty to keep using MinIO.
# Endpoint format: https://s3.<region>.cloud-object-storage.appdomain.cloud
COS_ENDPOINT = os.getenv("COS_ENDPOINT", "")
COS_ACCESS_KEY = os.getenv("COS_ACCESS_KEY", "")
COS_SECRET_KEY = os.getenv("COS_SECRET_KEY", "")
COS_BUCKET = os.getenv("COS_BUCKET", "")
COS_REGION = os.getenv("COS_REGION", "us-south")

# Effective object-store config: prefer IBM COS when all four COS_* vars are set
_cos_active = bool(COS_ENDPOINT and COS_ACCESS_KEY and COS_SECRET_KEY and COS_BUCKET)
OBJ_ENDPOINT = COS_ENDPOINT if _cos_active else MINIO_ENDPOINT
OBJ_ACCESS_KEY = COS_ACCESS_KEY if _cos_active else MINIO_ACCESS_KEY
OBJ_SECRET_KEY = COS_SECRET_KEY if _cos_active else MINIO_SECRET_KEY
OBJ_BUCKET = COS_BUCKET if _cos_active else MINIO_BUCKET

# ── B4: Databricks Delta / Iceberg interop ─────────────────────────────────────
# Two paths: Delta UniForm REST or Unity Catalog Iceberg REST
DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")          # e.g. adb-xxx.azuredatabricks.net
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")
# Iceberg REST catalog URI exposed by Unity Catalog
DATABRICKS_ICEBERG_REST_URI = os.getenv("DATABRICKS_ICEBERG_REST_URI", "")
DATABRICKS_ICEBERG_WAREHOUSE = os.getenv("DATABRICKS_ICEBERG_WAREHOUSE", "")
DATABRICKS_CATALOG = os.getenv("DATABRICKS_CATALOG", "main")
DATABRICKS_SCHEMA = os.getenv("DATABRICKS_SCHEMA", "biw_demo")
DATABRICKS_TABLE = os.getenv("DATABRICKS_TABLE", "seller_history")

# ── Program dates ──────────────────────────────────────────────────────────────
PROGRAM_START = "2026-07-13"
PROGRAM_END = "2026-08-09"
HISTORY_START = "2025-07-13"

# ── Paths ──────────────────────────────────────────────────────────────────────
EVIDENCE_DIR = _here / "evidence"
REACHABILITY_REPORT_PATH = EVIDENCE_DIR / "reachability_report.md"
MANIFEST_PATH = EVIDENCE_DIR / "manifest.md"
