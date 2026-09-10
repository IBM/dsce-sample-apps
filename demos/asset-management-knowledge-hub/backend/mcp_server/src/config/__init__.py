"""MCP Server configuration.

Extends the shared configuration with MCP-specific settings.
"""

from __future__ import annotations

import os
from shared.config import opensearch, watsonx, maximo, servicenow, kafka, app  # re-export shared cfg

# ── MCP-specific ──────────────────────────────────────────────────────────────

class ServerConfig:
    port: int = int(os.environ.get("PORT", "6868"))
    http_enabled: bool = os.environ.get("HTTP_ENABLED", "1") == "1"
    debug: bool = os.environ.get("DEBUG_MCP", "0") == "1"
    allowed_hosts: list[str] = (
        [h.strip().lower() for h in os.environ["ALLOWED_HOSTS"].split(",")]
        if os.environ.get("ALLOWED_HOSTS")
        else []
    )
    name: str = os.environ.get("MCP_SERVER_NAME", "maximo-knowledge-hub")
    version: str = os.environ.get("MCP_SERVER_VERSION", "1.0.0")

    # Web-knowledge index populated by the spiderbot
    web_knowledge_index: str = os.environ.get("SPIDERBOT_INDEX", "maximo_web_knowledge")


server = ServerConfig()

__all__ = ["opensearch", "watsonx", "maximo", "servicenow", "kafka", "app", "server"]
