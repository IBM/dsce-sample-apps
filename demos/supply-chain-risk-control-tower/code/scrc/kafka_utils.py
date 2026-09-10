from __future__ import annotations

import json
from typing import Any, Callable

try:
    from confluent_kafka import Consumer, KafkaException, Producer
except ModuleNotFoundError:  # Allows dry-run mode without installing Kafka client first.
    Consumer = Producer = None  # type: ignore

    class KafkaException(Exception):
        pass

from .settings import KafkaSettings


def producer_config(settings: KafkaSettings) -> dict[str, Any]:
    if not settings.is_configured:
        raise ValueError("Confluent Kafka settings are missing. Check .env or run --dry-run.")
    return {
        "bootstrap.servers": settings.bootstrap_servers,
        "security.protocol": "SASL_SSL",
        "sasl.mechanism": "PLAIN",
        "sasl.username": settings.api_key,
        "sasl.password": settings.api_secret,
        "client.id": settings.client_id,
        "enable.idempotence": True,
        "acks": "all",
    }


def consumer_config(settings: KafkaSettings, group_id: str | None = None) -> dict[str, Any]:
    if not settings.is_configured:
        raise ValueError("Confluent Kafka settings are missing. Check .env or run --dry-run.")
    return {
        "bootstrap.servers": settings.bootstrap_servers,
        "security.protocol": "SASL_SSL",
        "sasl.mechanism": "PLAIN",
        "sasl.username": settings.api_key,
        "sasl.password": settings.api_secret,
        "group.id": group_id or settings.consumer_group,
        "client.id": settings.client_id,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    }


def json_serializer(value: dict[str, Any]) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")


def json_deserializer(value: bytes) -> dict[str, Any]:
    return json.loads(value.decode("utf-8"))


def delivery_report(err, msg) -> None:
    if err is not None:
        print(f"Delivery failed for record {msg.key()}: {err}")
    else:
        print(f"Delivered to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}")


def produce_json(producer: Any, topic: str, key: str, value: dict[str, Any]) -> None:
    producer.produce(topic=topic, key=key.encode("utf-8"), value=json_serializer(value), callback=delivery_report)
    producer.poll(0)


def consume_loop(
    consumer: Any,
    topics: list[str],
    handle_record: Callable[[str, str | None, dict[str, Any]], None],
) -> None:
    consumer.subscribe(topics)
    print(f"Subscribed to: {', '.join(topics)}")
    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())
            key = msg.key().decode("utf-8") if msg.key() else None
            value = json_deserializer(msg.value())
            handle_record(msg.topic(), key, value)
    except KeyboardInterrupt:
        print("Stopping consumer.")
    finally:
        consumer.close()
