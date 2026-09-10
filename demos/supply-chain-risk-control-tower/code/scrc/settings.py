from __future__ import annotations

from dataclasses import dataclass
import os
from dotenv import load_dotenv


@dataclass(frozen=True)
class KafkaSettings:
    bootstrap_servers: str
    api_key: str
    api_secret: str
    client_id: str = "supply-chain-risk-control-tower"
    consumer_group: str = "scrc-risk-engine"

    @property
    def is_configured(self) -> bool:
        return all([self.bootstrap_servers, self.api_key, self.api_secret])


@dataclass(frozen=True)
class SchemaRegistrySettings:
    url: str
    api_key: str
    api_secret: str

    @property
    def is_configured(self) -> bool:
        return all([self.url, self.api_key, self.api_secret])


@dataclass(frozen=True)
class AppSettings:
    kafka: KafkaSettings
    schema_registry: SchemaRegistrySettings
    slack_webhook_url: str | None
    opensearch_url: str | None
    watsonx_url: str | None


def load_settings() -> AppSettings:
    load_dotenv()
    return AppSettings(
        kafka=KafkaSettings(
            bootstrap_servers=os.getenv("CONFLUENT_BOOTSTRAP_SERVERS", ""),
            api_key=os.getenv("CONFLUENT_API_KEY", ""),
            api_secret=os.getenv("CONFLUENT_API_SECRET", ""),
            client_id=os.getenv("CONFLUENT_CLIENT_ID", "supply-chain-risk-control-tower"),
            consumer_group=os.getenv("CONFLUENT_CONSUMER_GROUP", "scrc-risk-engine"),
        ),
        schema_registry=SchemaRegistrySettings(
            url=os.getenv("SCHEMA_REGISTRY_URL", ""),
            api_key=os.getenv("SCHEMA_REGISTRY_API_KEY", ""),
            api_secret=os.getenv("SCHEMA_REGISTRY_API_SECRET", ""),
        ),
        slack_webhook_url=os.getenv("SLACK_WEBHOOK_URL") or None,
        opensearch_url=os.getenv("OPENSEARCH_URL") or None,
        watsonx_url=os.getenv("WATSONX_URL") or None,
    )


TOPICS = {
    "supplier_profiles": "supplier_profiles",
    "component_master": "component_master",
    "purchase_orders": "purchase_orders",
    "shipments": "shipments",
    "inventory_levels": "inventory_levels",
    "customer_orders": "customer_orders",
    "external_risk_events": "external_risk_events",
    "risk_scores": "supply_chain_risk_scores",
    "recommendations": "supply_chain_recommendations",
    "alerts": "control_tower_alerts",
}
