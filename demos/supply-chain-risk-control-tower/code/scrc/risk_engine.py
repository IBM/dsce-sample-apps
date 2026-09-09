from __future__ import annotations

from dataclasses import asdict
import json
from typing import Any

from rich.console import Console
from rich.panel import Panel
import typer

from .kafka_utils import consume_loop, consumer_config, produce_json, producer_config
from .risk_logic import score_component_risk
from .sample_data import scenario_events
from .settings import TOPICS, load_settings
from .slack_alerts import send_slack_alert

app = typer.Typer(help="Consume supply chain events, calculate risk, and publish recommendations.")
console = Console()

INPUT_TOPIC_KEYS = [
    "supplier_profiles",
    "component_master",
    "purchase_orders",
    "shipments",
    "inventory_levels",
    "customer_orders",
    "external_risk_events",
]


class RiskEngineState:
    def __init__(self) -> None:
        self.suppliers: dict[str, dict[str, Any]] = {}
        self.component_master: dict[str, dict[str, Any]] = {}
        self.inventory_levels: dict[str, dict[str, Any]] = {}
        self.purchase_orders: dict[str, dict[str, Any]] = {}
        self.shipments: dict[str, dict[str, Any]] = {}
        self.customer_orders_by_component: dict[str, list[dict[str, Any]]] = {}
        self.external_risk_events: list[dict[str, Any]] = []

    def update(self, topic: str, key: str | None, event: dict[str, Any]) -> set[str]:
        """Update state and return component IDs that should be rescored."""
        affected_components: set[str] = set()

        if topic == TOPICS["supplier_profiles"]:
            supplier_id = event["supplier_id"]
            self.suppliers[supplier_id] = event
            for component_id in event.get("alternate_for_components", []):
                affected_components.add(component_id)

        elif topic == TOPICS["component_master"]:
            component_id = event["component_id"]
            self.component_master[component_id] = event
            affected_components.add(component_id)

        elif topic == TOPICS["inventory_levels"]:
            component_id = event["component_id"]
            self.inventory_levels[component_id] = event
            affected_components.add(component_id)

        elif topic == TOPICS["purchase_orders"]:
            self.purchase_orders[event["po_id"]] = event
            affected_components.add(event["component_id"])

        elif topic == TOPICS["shipments"]:
            self.shipments[event["shipment_id"]] = event
            affected_components.add(event["component_id"])

        elif topic == TOPICS["customer_orders"]:
            component_id = event["component_id"]
            orders = self.customer_orders_by_component.setdefault(component_id, [])
            orders = [order for order in orders if order["customer_order_id"] != event["customer_order_id"]]
            orders.append(event)
            self.customer_orders_by_component[component_id] = orders
            affected_components.add(component_id)

        elif topic == TOPICS["external_risk_events"]:
            self.external_risk_events.append(event)
            impacted_routes = {event.get("route_id")}
            for shipment in self.shipments.values():
                if shipment.get("route_id") in impacted_routes:
                    affected_components.add(shipment["component_id"])

        return affected_components

    def can_score(self, component_id: str) -> bool:
        return component_id in self.inventory_levels and component_id in self.component_master


class RiskPublisher:
    def __init__(self, producer: Any | None, slack_webhook_url: str | None) -> None:
        self.producer = producer
        self.slack_webhook_url = slack_webhook_url

    def publish(self, risk: dict[str, Any], recommendation: dict[str, Any], alert: dict[str, Any]) -> None:
        if self.producer:
            produce_json(self.producer, TOPICS["risk_scores"], risk["risk_id"], risk)
            produce_json(self.producer, TOPICS["recommendations"], recommendation["recommendation_id"], recommendation)
            produce_json(self.producer, TOPICS["alerts"], alert["alert_id"], alert)
            self.producer.flush(5)
        else:
            console.print(Panel(json.dumps(risk, indent=2), title="Risk Score", expand=False))
            console.print(Panel(json.dumps(recommendation, indent=2), title="Recommendation", expand=False))
            console.print(Panel(json.dumps(alert, indent=2), title="Control Tower Alert", expand=False))

        if self.slack_webhook_url and alert.get("severity") in {"HIGH", "CRITICAL"}:
            send_slack_alert(self.slack_webhook_url, alert)


def process_event(state: RiskEngineState, publisher: RiskPublisher, topic: str, key: str | None, event: dict[str, Any]) -> None:
    affected_components = state.update(topic, key, event)
    for component_id in sorted(affected_components):
        if not state.can_score(component_id):
            continue
        risk, recommendation, alert = score_component_risk(
            component_id=component_id,
            suppliers=state.suppliers,
            component_master=state.component_master,
            inventory_levels=state.inventory_levels,
            purchase_orders=state.purchase_orders,
            shipments=state.shipments,
            customer_orders_by_component=state.customer_orders_by_component,
            external_risk_events=state.external_risk_events,
        )
        publisher.publish(asdict(risk), asdict(recommendation), asdict(alert))


@app.command()
def main(
    dry_run: bool = typer.Option(False, help="Run with in-memory synthetic events and print outputs."),
    scenario: str = typer.Option("supplier_delay", help="Scenario to use for dry run."),
    count: int = typer.Option(8, help="Dry-run event batches."),
) -> None:
    settings = load_settings()
    state = RiskEngineState()

    if dry_run:
        console.print("Running risk engine in dry-run mode.")
        publisher = RiskPublisher(producer=None, slack_webhook_url=None)
        for topic_key, key, event in scenario_events(scenario=scenario, count=count):
            process_event(state, publisher, TOPICS[topic_key], key, event)
        return

    from confluent_kafka import Consumer, Producer

    producer = Producer(producer_config(settings.kafka))
    publisher = RiskPublisher(producer=producer, slack_webhook_url=settings.slack_webhook_url)
    consumer = Consumer(consumer_config(settings.kafka))
    topics = [TOPICS[key] for key in INPUT_TOPIC_KEYS]
    consume_loop(consumer, topics, lambda topic, key, event: process_event(state, publisher, topic, key, event))


if __name__ == "__main__":
    app()
