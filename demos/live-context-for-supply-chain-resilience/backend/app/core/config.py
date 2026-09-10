# backend/app/core/config.py
# Externalised configuration – spec/08, NFR-009 (Portability)
# No secrets in source control. Use .env or environment variables.

from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Server
    port: int = 3001
    api_correlation_header: str = "x-correlation-id"

    # Confluent
    confluent_bootstrap_servers: str = ""
    confluent_api_key: str = ""
    confluent_api_secret: str = ""
    confluent_schema_registry_url: str = ""
    confluent_schema_registry_api_key: str = ""
    confluent_schema_registry_api_secret: str = ""

    # OpenSearch
    opensearch_host: str = "http://localhost:9200"
    opensearch_username: str = "admin"
    opensearch_password: str = ""

    # Embedding
    embedding_service_url: str = ""
    embedding_model: str = "ibm/slate-125m-english-rtrvr"

    # wxO
    wxo_base_url: str = ""
    wxo_api_key: str = ""

    # Demo
    demo_mode: bool = True
    demo_facility_label: str = "Pearl GTL Turnaround Demo"
    demo_warning: str = "SYNTHETIC_DATA_ONLY"
    demo_username: str = "CHANGE_ME"
    demo_password: str = "CHANGE_ME"

    # Log
    log_level: str = "info"


settings = Settings()
