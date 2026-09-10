from __future__ import annotations

import time
from typing import Optional

from rich.console import Console
import typer

from .kafka_utils import produce_json, producer_config
from .sample_data import scenario_events
from .settings import TOPICS, load_settings

app = typer.Typer(help="Produce synthetic supply chain events to Confluent Cloud Kafka topics.")
console = Console()


@app.command()
def main(
    scenario: str = typer.Option("supplier_delay", help="supplier_delay, port_congestion, inventory_drop, or recovery"),
    count: int = typer.Option(20, help="Number of event batches to generate."),
    interval: float = typer.Option(1.0, help="Seconds between individual events."),
    dry_run: bool = typer.Option(False, help="Print events without sending to Kafka."),
    limit: Optional[int] = typer.Option(None, help="Optional hard limit of individual events."),
) -> None:
    settings = load_settings()
    producer = None
    if not dry_run:
        from confluent_kafka import Producer

        producer = Producer(producer_config(settings.kafka))

    sent = 0
    for topic_key, key, event in scenario_events(scenario=scenario, count=count):
        topic = TOPICS[topic_key]
        if dry_run:
            console.print({"topic": topic, "key": key, "value": event})
        else:
            assert producer is not None
            produce_json(producer, topic=topic, key=key, value=event)
        sent += 1
        if limit and sent >= limit:
            break
        time.sleep(interval)

    if producer:
        producer.flush(30)
    console.print(f"Produced {sent} events for scenario '{scenario}'.")


if __name__ == "__main__":
    app()
