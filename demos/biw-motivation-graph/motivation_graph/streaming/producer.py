"""
B1 — Kafka Event Producer (18+ sources, 5 shown live)
======================================================
IBM product:  IBM Confluent (Kafka)
OSS fallback: Apache Kafka (localhost:9092, via docker-compose)

Sources:
  LIVE  (real Kafka topics, used for on-camera injection):
    S1  Salesforce CDC    → biw.salesforce.cdc
    S2  Slack Events      → biw.slack.events
    S3  Workday batch     → biw.batch.ingest (bulk load topic)
    S4  Databricks Delta  → federated via Trino (no Kafka topic; B4)
    S5  S3 file drop      → biw.batch.ingest (file-drop sub-type)

  BACKGROUND (generated, no live Kafka connection required):
    Microsoft Teams, SAP SuccessFactors, Elevate points ledger,
    Rewards marketplace catalog, LMS certs, Zendesk/ServiceNow,
    Marketo/HubSpot, Google Workspace/calendar, clickstream,
    Qualtrics/Medallia, NetSuite/ERP, PRM/partner system,
    mobile-app events — totaling 18+

Acceptance:  a synthetic Slack event injected on camera reaches
             Kafka and is consumed within seconds.
"""

from __future__ import annotations

import json
import random
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    CONFLUENT_BOOTSTRAP_SERVERS,
    CONFLUENT_SASL_MECHANISM,
    CONFLUENT_SASL_PASSWORD,
    CONFLUENT_SASL_USERNAME,
    CONFLUENT_SECURITY_PROTOCOL,
    KAFKA_TOPIC_BATCH,
    KAFKA_TOPIC_COLLAB,
    KAFKA_TOPIC_CRM,
    SEED,
)

_rng = random.Random(SEED)

# ── 18+ source catalog ────────────────────────────────────────────────────────

SOURCES: list[dict[str, Any]] = [
    # id, name, system, velocity, mechanism, topic
    {"id": "S1",  "name": "Salesforce",          "system": "CRM",               "velocity": "near-real-time",   "mechanism": "CDC → Kafka",           "topic": "biw.salesforce.cdc",   "live": True},
    {"id": "S2",  "name": "Slack",                "system": "Collaboration",     "velocity": "real-time stream", "mechanism": "Events API → Kafka",    "topic": "biw.slack.events",     "live": True},
    {"id": "S3",  "name": "Workday",              "system": "HRIS",              "velocity": "nightly batch",    "mechanism": "Bulk load",             "topic": "biw.batch.ingest",     "live": True},
    {"id": "S4",  "name": "Databricks Delta",     "system": "Existing lakehouse","velocity": "federated",        "mechanism": "Iceberg interop, zero-copy","topic": None,              "live": True},
    {"id": "S5",  "name": "S3 / file drop",       "system": "Object storage",    "velocity": "micro-batch",      "mechanism": "Parquet/CSV on object store","topic": "biw.batch.ingest","live": True},
    {"id": "S6",  "name": "Microsoft Teams",      "system": "Collaboration",     "velocity": "near-real-time",   "mechanism": "Graph API → Kafka",      "topic": "biw.batch.ingest",     "live": False},
    {"id": "S7",  "name": "SAP SuccessFactors",   "system": "HCM",               "velocity": "nightly batch",    "mechanism": "REST bulk extract",      "topic": "biw.batch.ingest",     "live": False},
    {"id": "S8",  "name": "Elevate Points Ledger","system": "Loyalty",           "velocity": "near-real-time",   "mechanism": "DB CDC → Kafka",         "topic": "biw.salesforce.cdc",   "live": False},
    {"id": "S9",  "name": "Rewards Catalog",      "system": "Marketplace",       "velocity": "daily batch",      "mechanism": "API pull",               "topic": "biw.batch.ingest",     "live": False},
    {"id": "S10", "name": "LMS / Certs",          "system": "Learning",          "velocity": "nightly batch",    "mechanism": "SCORM API bulk extract", "topic": "biw.batch.ingest",     "live": False},
    {"id": "S11", "name": "Zendesk / ServiceNow", "system": "Support",           "velocity": "near-real-time",   "mechanism": "Webhook → Kafka",        "topic": "biw.slack.events",     "live": False},
    {"id": "S12", "name": "Marketo / HubSpot",    "system": "Marketing",         "velocity": "hourly micro-batch","mechanism": "API poll",              "topic": "biw.batch.ingest",     "live": False},
    {"id": "S13", "name": "Google Workspace",     "system": "Calendar/Docs",     "velocity": "hourly micro-batch","mechanism": "Pub/Sub → Kafka",       "topic": "biw.slack.events",     "live": False},
    {"id": "S14", "name": "Clickstream",          "system": "Product analytics", "velocity": "real-time stream", "mechanism": "Browser SDK → Kafka",    "topic": "biw.slack.events",     "live": False},
    {"id": "S15", "name": "Qualtrics / Medallia", "system": "Voice of Customer", "velocity": "daily batch",      "mechanism": "REST bulk export",       "topic": "biw.batch.ingest",     "live": False},
    {"id": "S16", "name": "NetSuite / ERP",       "system": "Finance",           "velocity": "nightly batch",    "mechanism": "JDBC bulk extract",      "topic": "biw.batch.ingest",     "live": False},
    {"id": "S17", "name": "PRM / Partner system", "system": "Partnerships",      "velocity": "daily batch",      "mechanism": "SFTP / API pull",        "topic": "biw.batch.ingest",     "live": False},
    {"id": "S18", "name": "Mobile app events",    "system": "Mobile",            "velocity": "real-time stream", "mechanism": "Mobile SDK → Kafka",     "topic": "biw.slack.events",     "live": False},
]

# ── Kafka producer helper ─────────────────────────────────────────────────────

def _build_producer_config() -> dict:
    """Build kafka-python / confluent-kafka producer config."""
    cfg: dict[str, Any] = {
        "bootstrap.servers": CONFLUENT_BOOTSTRAP_SERVERS,
    }
    if CONFLUENT_SECURITY_PROTOCOL and CONFLUENT_SECURITY_PROTOCOL != "PLAINTEXT":
        cfg["security.protocol"] = CONFLUENT_SECURITY_PROTOCOL
    if CONFLUENT_SASL_MECHANISM:
        cfg["sasl.mechanism"] = CONFLUENT_SASL_MECHANISM
        cfg["sasl.username"] = CONFLUENT_SASL_USERNAME
        cfg["sasl.password"] = CONFLUENT_SASL_PASSWORD
    return cfg


def _ts_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


# ── Per-source event generators ───────────────────────────────────────────────

def make_salesforce_cdc_event(seller_id: str | None = None) -> dict:
    """Simulated Salesforce opportunity CDC record."""
    sid = seller_id or f"sf-seller-{_rng.randint(1, 20):03d}"
    return {
        "event_id":    "sf-" + str(uuid.uuid4())[:8],
        "source":      "salesforce",
        "event_type":  "opportunity.updated",
        "seller_id":   sid,
        "event_ts":    _ts_now(),
        "payload": {
            "opportunity_id":  "opp-" + str(uuid.uuid4())[:8],
            "stage":           _rng.choice(["Proposal", "Negotiation", "Closed Won", "Closed Lost"]),
            "amount_usd":      round(_rng.uniform(10_000, 500_000), 2),
            "close_date":      "2026-08-09",
            "crm_compliance":  _rng.choice([True, True, True, False]),   # 75% compliant
        },
        "_source_id":  "S1",
        "_simulated":  True,
    }


def make_slack_event(seller_id: str | None = None, event_type: str = "recognition") -> dict:
    """Simulated Slack Events API payload (recognition or nudge channel)."""
    sid = seller_id or f"slack-seller-{_rng.randint(1, 20):03d}"
    messages = {
        "recognition": f"Great close on that deal, {sid.split('-')[1].title()}! 🎉",
        "nudge":       "Reminder: CRM update helps unlock your next milestone.",
        "join":        f"{sid} joined #elevate-close-strong",
    }
    return {
        "event_id":   "slack-" + str(uuid.uuid4())[:8],
        "source":     "slack",
        "event_type": event_type,
        "seller_id":  sid,
        "event_ts":   _ts_now(),
        "payload": {
            "channel":   "elevate-close-strong",
            "user":      sid,
            "text":      messages.get(event_type, ""),
            "ts":        str(time.time()),
        },
        "_source_id": "S2",
        "_simulated": True,
    }


def make_workday_batch_event(seller_id: str | None = None) -> dict:
    """Simulated Workday HR bulk record (nightly batch load)."""
    sid = seller_id or f"wd-seller-{_rng.randint(1, 20):03d}"
    return {
        "event_id":   "wd-" + str(uuid.uuid4())[:8],
        "source":     "workday",
        "event_type": "employee.record.sync",
        "seller_id":  sid,
        "event_ts":   _ts_now(),
        "payload": {
            "employee_id":      sid,
            "role":             _rng.choice(["AE", "SAE", "SAM"]),
            "department":       "Sales",
            "manager_id":       "mgr-001",
            "hire_date":        "2021-03-15",
            "team_start_date":  "2026-01-01",
        },
        "_source_id": "S3",
        "_simulated": True,
    }


def make_file_drop_event(file_type: str = "partner_extract") -> dict:
    """Simulated S3/object-store file drop (partner/channel extracts)."""
    return {
        "event_id":   "fd-" + str(uuid.uuid4())[:8],
        "source":     "s3_file_drop",
        "event_type": "file.arrived",
        "seller_id":  None,
        "event_ts":   _ts_now(),
        "payload": {
            "bucket":        "biw-partner-drops",
            "key":           f"extracts/{file_type}/2026-08-01_{_rng.randint(1000,9999)}.parquet",
            "size_bytes":    _rng.randint(50_000, 5_000_000),
            "format":        _rng.choice(["parquet", "csv"]),
            "row_estimate":  _rng.randint(500, 50_000),
        },
        "_source_id": "S5",
        "_simulated": True,
    }


def make_background_event(source: dict) -> dict:
    """Generic background event for the 13 non-live sources."""
    return {
        "event_id":   f"{source['id'].lower()}-" + str(uuid.uuid4())[:8],
        "source":     source["name"].lower().replace(" ", "_").replace("/", "_"),
        "event_type": "data.sync",
        "seller_id":  None,
        "event_ts":   _ts_now(),
        "payload": {
            "record_count": _rng.randint(100, 100_000),
            "velocity":     source["velocity"],
            "format":       "parquet",
        },
        "_source_id": source["id"],
        "_simulated": True,
    }


# ── Produce helpers ───────────────────────────────────────────────────────────

class KafkaProducer:
    """
    Thin wrapper.  Uses confluent-kafka when available (production / IBM Confluent),
    falls back to kafka-python (simpler OSS install), falls back to in-memory
    queue (no Kafka at all — for unit tests / CI).
    """

    def __init__(self, dry_run: bool = False):
        self._dry_run = dry_run
        self._producer = None
        self._fallback_queue: list[tuple[str, bytes]] = []

        if not dry_run:
            self._producer = self._connect()

    def _connect(self):
        cfg = _build_producer_config()

        # Quick TCP probe before attempting any Kafka client — avoids
        # flooding stderr with rdkafka connection-refused noise when the
        # broker isn't running.
        first_broker = CONFLUENT_BOOTSTRAP_SERVERS.split(",")[0].strip()
        broker_host, broker_port_str = (first_broker.rsplit(":", 1) + ["9092"])[:2]
        try:
            import socket as _socket
            with _socket.create_connection((broker_host, int(broker_port_str)), timeout=1):
                broker_reachable = True
        except OSError:
            broker_reachable = False

        if not broker_reachable:
            print(f"[B1] Kafka not reachable on {first_broker} — using in-memory fallback")
            return None

        # Try confluent-kafka first (preferred — same client IBM Confluent uses)
        try:
            from confluent_kafka import Producer as ConfluentProducer
            p = ConfluentProducer(cfg)
            print(f"[B1] Confluent Kafka producer connected → {CONFLUENT_BOOTSTRAP_SERVERS}")
            return p
        except ImportError:
            pass

        # Fall back to kafka-python
        try:
            from kafka import KafkaProducer as KP
            kw: dict[str, Any] = {
                "bootstrap_servers": CONFLUENT_BOOTSTRAP_SERVERS.split(","),
                "value_serializer": lambda v: v,
            }
            if CONFLUENT_SECURITY_PROTOCOL not in ("PLAINTEXT", ""):
                kw["security_protocol"] = CONFLUENT_SECURITY_PROTOCOL
            if CONFLUENT_SASL_MECHANISM:
                kw["sasl_mechanism"] = CONFLUENT_SASL_MECHANISM
                kw["sasl_plain_username"] = CONFLUENT_SASL_USERNAME
                kw["sasl_plain_password"] = CONFLUENT_SASL_PASSWORD
            p = KP(**kw)
            print(f"[B1] kafka-python producer connected → {CONFLUENT_BOOTSTRAP_SERVERS}")
            return p
        except (ImportError, Exception) as exc:
            print(f"[B1] Kafka client error: {exc} — using in-memory fallback")

        return None

    def produce(self, topic: str, event: dict) -> None:
        value = json.dumps(event).encode("utf-8")
        key = (event.get("seller_id") or event.get("event_id") or "").encode("utf-8")

        if self._dry_run or self._producer is None:
            self._fallback_queue.append((topic, value))
            return

        # confluent-kafka path
        if hasattr(self._producer, "produce") and hasattr(self._producer, "flush"):
            self._producer.produce(topic, value=value, key=key)
            self._producer.poll(0)
            return

        # kafka-python path
        if hasattr(self._producer, "send"):
            self._producer.send(topic, value=value, key=key)
            return

        self._fallback_queue.append((topic, value))

    def flush(self, timeout: float = 30.0) -> None:
        if self._producer is None:
            return
        if hasattr(self._producer, "flush"):
            self._producer.flush(timeout)

    @property
    def queued(self) -> list[tuple[str, bytes]]:
        """Return in-memory queue (dry-run / CI mode)."""
        return list(self._fallback_queue)


# ── On-camera injection (B1 acceptance) ──────────────────────────────────────

def inject_live_events(
    producer: KafkaProducer,
    seller_id: str = "seller-rachel-001",
    verbose: bool = True,
) -> list[dict]:
    """
    Inject the on-camera live events:
      1. Slack recognition event (S2) → real-time stream
      2. Salesforce CDC opportunity update (S1) → CDC
    Returns the list of produced events for evidence logging.
    """
    events = [
        (KAFKA_TOPIC_COLLAB, make_slack_event(seller_id, "recognition")),
        (KAFKA_TOPIC_CRM,    make_salesforce_cdc_event(seller_id)),
    ]
    produced = []
    for topic, event in events:
        producer.produce(topic, event)
        produced.append(event)
        if verbose:
            print(f"  [B1] → {topic}  {event['source']}:{event['event_type']}  "
                  f"seller={event.get('seller_id')}  ts={event['event_ts']}")
    producer.flush()
    return produced


def seed_background_topics(producer: KafkaProducer, verbose: bool = False) -> None:
    """
    Produce one background event per non-live source into biw.batch.ingest.
    These represent the 13 narrated-but-not-live sources.
    """
    bg_sources = [s for s in SOURCES if not s["live"] and s["topic"]]
    for src in bg_sources:
        event = make_background_event(src)
        producer.produce(src["topic"], event)
        if verbose:
            print(f"  [B1-bg] → {src['topic']}  {src['name']}")
    # Also drop a Workday + file-drop batch record
    producer.produce(KAFKA_TOPIC_BATCH, make_workday_batch_event())
    producer.produce(KAFKA_TOPIC_BATCH, make_file_drop_event())
    producer.flush()
    if verbose:
        print(f"[B1] {len(bg_sources) + 2} background events seeded")


if __name__ == "__main__":
    p = KafkaProducer()
    inject_live_events(p, verbose=True)
    seed_background_topics(p, verbose=True)
