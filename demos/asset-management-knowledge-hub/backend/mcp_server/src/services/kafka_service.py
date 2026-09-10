"""Confluent / Apache Kafka service for the MCP server.

Provides a lightweight connection check and topic listing using the
AdminClient from the ``confluent-kafka`` package.  If no bootstrap
servers are configured the service returns a "not configured" result
so the UI can distinguish between "not set up" and "unreachable".
"""

from __future__ import annotations

from shared.config import kafka as cfg
from shared.logging import get_logger

logger = get_logger(__name__)


class KafkaService:
    """Kafka admin operations required by the MCP server status endpoint."""

    def test_connection(self) -> dict:
        """Try to connect to the Kafka cluster and list available topics.

        Returns a dict with keys:
          configured  — bool: bootstrap_servers is set in env
          connected   — bool: AdminClient reached the cluster
          topics      — list[str]: topic names (empty on failure)
          error       — str | None: human-readable error on failure
        """
        if not cfg.bootstrap_servers:
            return {
                "configured": False,
                "connected":  False,
                "topics":     [],
                "error":      "KAFKA_BOOTSTRAP_SERVERS is not configured.",
            }

        try:
            from confluent_kafka.admin import AdminClient  # lazy import — optional dep
        except ImportError:
            return {
                "configured": True,
                "connected":  False,
                "topics":     [],
                "error":      "confluent-kafka package is not installed.",
            }

        admin_config = {
            "bootstrap.servers":  cfg.bootstrap_servers,
            "security.protocol":  cfg.security_protocol,
            "sasl.mechanism":     cfg.sasl_mechanism,
            "sasl.username":      cfg.api_key,
            "sasl.password":      cfg.api_secret,
            # Fast timeout so the status check doesn't hang the HTTP response
            "socket.timeout.ms":        8000,
            "request.timeout.ms":       8000,
            "metadata.request.timeout.ms": 8000,
        }

        try:
            admin = AdminClient(admin_config)
            # list_topics() with timeout=8 s raises an exception on failure
            metadata = admin.list_topics(timeout=8)
            topics = sorted(
                t for t in metadata.topics
                if not t.startswith("_")   # hide internal __consumer_offsets etc.
            )
            logger.info("Kafka connection OK", extra={"topic_count": len(topics)})
            return {
                "configured": True,
                "connected":  True,
                "topics":     topics,
                "error":      None,
            }
        except Exception as exc:
            logger.error("Kafka connection failed", extra={"error": str(exc)})
            return {
                "configured": True,
                "connected":  False,
                "topics":     [],
                "error":      str(exc),
            }


# Module-level singleton
kafka_service = KafkaService()
