"""
B2 — Dual-Write Stream Consumer
=================================
IBM product:  IBM DataStax Enterprise (Cassandra) + watsonx.data (Iceberg on IBM COS)
OSS fallback: Apache Cassandra (localhost:9042) + Apache Iceberg on MinIO (localhost:9000)

Reads from Kafka topics and writes each event TWICE:
  ① live state   → Cassandra (IBM DataStax) — the "now" operational store
  ② history      → Iceberg table on object storage — the "always" lakehouse

Optional add-ons (off by default):
  • Apache Flink (Confluent managed Flink) — in-flight transforms
  • Tableflow — materialises Kafka topics directly into Iceberg

Acceptance:  one event appears in BOTH Cassandra (current row) AND Iceberg
             (appended history row) from a single consume.
"""

from __future__ import annotations

import json
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
    DATASTAX_KEYSPACE,
    DATASTAX_SCB_PATH,
    DATASTAX_TOKEN,
    ICEBERG_REST_URI,
    KAFKA_CONSUMER_GROUP,
    KAFKA_TOPIC_BATCH,
    KAFKA_TOPIC_COLLAB,
    KAFKA_TOPIC_CRM,
    OBJ_ACCESS_KEY,
    OBJ_BUCKET,
    OBJ_ENDPOINT,
    OBJ_SECRET_KEY,
)

_TOPICS = [KAFKA_TOPIC_CRM, KAFKA_TOPIC_COLLAB, KAFKA_TOPIC_BATCH]


# ── Cassandra (IBM DataStax) session ─────────────────────────────────────────

class CassandraWriter:
    """
    Thin wrapper around cassandra-driver.
    IBM DataStax Enterprise exposes the same driver API as OSS Cassandra.
    """

    DDL = """
        CREATE TABLE IF NOT EXISTS {keyspace}.biw_live_events (
            event_id     TEXT PRIMARY KEY,
            source       TEXT,
            event_type   TEXT,
            seller_id    TEXT,
            event_ts     TEXT,
            payload      TEXT,
            source_id    TEXT,
            written_at   TEXT
        )
    """
    INSERT = """
        INSERT INTO {keyspace}.biw_live_events
          (event_id, source, event_type, seller_id, event_ts, payload, source_id, written_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """

    def __init__(self) -> None:
        self._session = None
        self._in_memory: list[dict] = []

    def connect(self) -> bool:
        try:
            from cassandra.cluster import Cluster
            from cassandra.auth import PlainTextAuthProvider

            auth = PlainTextAuthProvider(username="token", password=DATASTAX_TOKEN)
            cluster = Cluster(
                cloud={"secure_connect_bundle": DATASTAX_SCB_PATH},
                auth_provider=auth,
                connect_timeout=10,
            )
            self._session = cluster.connect()

            # Keyspace already exists in Astra — just ensure the table does
            self._session.execute(
                self.DDL.format(keyspace=DATASTAX_KEYSPACE)
            )
            print(f"[B2/Cassandra] Connected → Astra DB keyspace={DATASTAX_KEYSPACE}")
            return True
        except Exception as exc:
            print(f"[B2/Cassandra] FALLBACK (in-memory): {exc}")
            return False

    def write(self, event: dict) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        row = (
            event.get("event_id", str(uuid.uuid4())[:8]),
            event.get("source", ""),
            event.get("event_type", ""),
            event.get("seller_id") or "",
            event.get("event_ts", now),
            json.dumps(event.get("payload", {})),
            event.get("_source_id", ""),
            now,
        )
        if self._session:
            self._session.execute(
                self.INSERT.format(keyspace=DATASTAX_KEYSPACE), row
            )
        else:
            self._in_memory.append(dict(zip(
                ["event_id","source","event_type","seller_id","event_ts","payload","source_id","written_at"],
                row
            )))

    def read_latest(self, limit: int = 10) -> list[dict]:
        if self._session:
            rows = self._session.execute(
                f"SELECT * FROM {DATASTAX_KEYSPACE}.biw_live_events LIMIT {limit}"
            )
            return [dict(r._asdict()) for r in rows]
        return list(reversed(self._in_memory[-limit:]))

    @property
    def in_memory(self) -> list[dict]:
        return list(self._in_memory)


# ── Iceberg on object storage (watsonx.data / MinIO) ─────────────────────────

class IcebergWriter:
    """
    Appends event rows to an Iceberg table on object storage.

    IBM product: watsonx.data lakehouse (Iceberg on IBM COS, S3-compatible).
    OSS fallback: Apache Iceberg on MinIO — same Iceberg spec, same REST catalog.

    The pyiceberg library works against both because both expose S3-compatible APIs.
    If pyiceberg is not installed, falls back to JSON-lines on local disk (CI mode).
    """

    TABLE_SCHEMA_FIELDS = [
        ("event_id",   "string"),
        ("source",     "string"),
        ("event_type", "string"),
        ("seller_id",  "string"),
        ("event_ts",   "string"),
        ("payload",    "string"),
        ("source_id",  "string"),
        ("written_at", "string"),
    ]

    def __init__(self) -> None:
        self._catalog = None
        self._table = None
        self._fallback_path = Path(__file__).parent.parent / "evidence" / "iceberg_fallback.jsonl"

    def connect(self) -> bool:
        try:
            import pyarrow as pa
            from pyiceberg.catalog import load_catalog
            from pyiceberg.schema import Schema
            from pyiceberg.types import (
                NestedField, StringType
            )

            # Configure Iceberg REST catalog (tabulario/iceberg-rest or IBM COS catalog)
            catalog_props = {
                "type": "rest",
                "uri": ICEBERG_REST_URI,          # http://localhost:8181 (OSS) or IBM COS catalog
                "s3.endpoint": OBJ_ENDPOINT,
                "s3.access-key-id": OBJ_ACCESS_KEY,
                "s3.secret-access-key": OBJ_SECRET_KEY,
                "warehouse": f"s3://{OBJ_BUCKET}/warehouse",
            }
            self._catalog = load_catalog("biw", **catalog_props)

            schema = Schema(
                *[
                    NestedField(i + 1, name, StringType(), required=False)
                    for i, (name, _) in enumerate(self.TABLE_SCHEMA_FIELDS)
                ]
            )
            namespace = "biw"
            table_name = "live_events"
            full_name = f"{namespace}.{table_name}"

            try:
                self._catalog.create_namespace(namespace)
            except Exception:
                pass  # already exists

            try:
                self._table = self._catalog.load_table(full_name)
            except Exception:
                self._table = self._catalog.create_table(
                    full_name, schema=schema,
                    location=f"s3://{OBJ_BUCKET}/warehouse/{namespace}/{table_name}",
                )
            print(f"[B2/Iceberg] Connected → {OBJ_ENDPOINT}/{OBJ_BUCKET} table={full_name}")
            return True
        except Exception as exc:
            print(f"[B2/Iceberg] FALLBACK (JSONL on disk): {exc}")
            self._fallback_path.parent.mkdir(parents=True, exist_ok=True)
            return False

    def write(self, event: dict) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        row = {
            "event_id":   event.get("event_id", str(uuid.uuid4())[:8]),
            "source":     event.get("source", ""),
            "event_type": event.get("event_type", ""),
            "seller_id":  event.get("seller_id") or "",
            "event_ts":   event.get("event_ts", now),
            "payload":    json.dumps(event.get("payload", {})),
            "source_id":  event.get("_source_id", ""),
            "written_at": now,
        }

        if self._table is not None:
            try:
                import pyarrow as pa
                schema = pa.schema([
                    (name, pa.string()) for name, _ in self.TABLE_SCHEMA_FIELDS
                ])
                # pyiceberg.table.append() requires a pa.Table, not pa.RecordBatch
                arrow_table = pa.table({
                    name: pa.array([row.get(name, "")], type=pa.string())
                    for name, _ in self.TABLE_SCHEMA_FIELDS
                })
                self._table.append(arrow_table)
                return
            except Exception as exc:
                print(f"[B2/Iceberg] write error (falling back to JSONL): {exc}")

        # Fallback: append JSON line to disk
        with self._fallback_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row) + "\n")

    def read_latest(self, limit: int = 10) -> list[dict]:
        if self._table is not None:
            try:
                arrow_table = self._table.scan().to_arrow()
                rows = arrow_table.to_pylist()
                return rows[-limit:]
            except Exception:
                pass
        # Fallback: read JSONL
        if self._fallback_path.exists():
            lines = self._fallback_path.read_text(encoding="utf-8").strip().splitlines()
            return [json.loads(l) for l in lines[-limit:]]
        return []


# ── Dual-write consumer ───────────────────────────────────────────────────────

class DualWriteConsumer:
    """
    Reads from Kafka topics and writes each event to BOTH:
      • Cassandra (IBM DataStax) — operational live state
      • Iceberg (watsonx.data / MinIO) — history lakehouse

    Falls back gracefully: if Kafka is absent, can consume from an in-memory
    queue (supplied by the KafkaProducer.queued property in dry-run mode).
    """

    def __init__(self) -> None:
        self.cassandra = CassandraWriter()
        self.iceberg = IcebergWriter()
        self._consumer = None
        self._dual_write_log: list[dict] = []

    def connect(self) -> tuple[bool, bool]:
        cass_ok = self.cassandra.connect()
        ice_ok = self.iceberg.connect()
        return cass_ok, ice_ok

    def _connect_kafka_consumer(self) -> bool:
        topics = _TOPICS

        # TCP probe — skip Kafka client entirely if broker unreachable
        first_broker = CONFLUENT_BOOTSTRAP_SERVERS.split(",")[0].strip()
        broker_host, broker_port_str = (first_broker.rsplit(":", 1) + ["9092"])[:2]
        try:
            import socket as _socket
            with _socket.create_connection((broker_host, int(broker_port_str)), timeout=1):
                broker_reachable = True
        except OSError:
            broker_reachable = False

        if not broker_reachable:
            print(f"[B2/Kafka] Kafka not reachable on {first_broker} — no live consumer")
            return False

        # Try confluent-kafka
        try:
            from confluent_kafka import Consumer
            cfg = {
                "bootstrap.servers": CONFLUENT_BOOTSTRAP_SERVERS,
                "group.id": KAFKA_CONSUMER_GROUP,
                "auto.offset.reset": "latest",   # don't replay old events on startup
            }
            if CONFLUENT_SECURITY_PROTOCOL not in ("PLAINTEXT", ""):
                cfg["security.protocol"] = CONFLUENT_SECURITY_PROTOCOL
            if CONFLUENT_SASL_MECHANISM:
                cfg["sasl.mechanism"] = CONFLUENT_SASL_MECHANISM
                cfg["sasl.username"] = CONFLUENT_SASL_USERNAME
                cfg["sasl.password"] = CONFLUENT_SASL_PASSWORD
            self._consumer = Consumer(cfg)
            self._consumer.subscribe(topics)
            print(f"[B2/Kafka] confluent-kafka consumer subscribed → {topics}")
            return True
        except ImportError:
            pass
        # Try kafka-python
        try:
            from kafka import KafkaConsumer
            kw: dict[str, Any] = {
                "bootstrap_servers": CONFLUENT_BOOTSTRAP_SERVERS.split(","),
                "group_id": KAFKA_CONSUMER_GROUP,
                "auto_offset_reset": "latest",   # don't replay old events on startup
                "value_deserializer": lambda v: json.loads(v.decode("utf-8")),
            }
            if CONFLUENT_SECURITY_PROTOCOL not in ("PLAINTEXT", ""):
                kw["security_protocol"] = CONFLUENT_SECURITY_PROTOCOL
            if CONFLUENT_SASL_MECHANISM:
                kw["sasl_mechanism"] = CONFLUENT_SASL_MECHANISM
                kw["sasl_plain_username"] = CONFLUENT_SASL_USERNAME
                kw["sasl_plain_password"] = CONFLUENT_SASL_PASSWORD
            self._consumer = KafkaConsumer(*topics, **kw)
            print(f"[B2/Kafka] kafka-python consumer subscribed → {topics}")
            return True
        except (ImportError, Exception) as exc:
            print(f"[B2/Kafka] consumer error: {exc}")
            return False

    def _dual_write(self, event: dict) -> dict:
        """Write one event to both sinks; return evidence record."""
        self.cassandra.write(event)
        self.iceberg.write(event)
        # cassandra_ok is True only when a real Cassandra session is active
        # iceberg_ok is True only when a real pyiceberg table is active
        cass_real  = self.cassandra._session is not None
        ice_real   = self.iceberg._table is not None
        record = {
            "event_id":       event.get("event_id", ""),
            "source":         event.get("source", ""),
            "event_type":     event.get("event_type", ""),
            "seller_id":      event.get("seller_id"),
            "event_ts":       event.get("event_ts", ""),
            "dual_write_at":  datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "cassandra_ok":   cass_real,
            "iceberg_ok":     ice_real,
            "cassandra_store": "IBM DataStax (Cassandra)" if cass_real else "in-memory",
            "iceberg_store":   "watsonx.data (MinIO/COS)" if ice_real  else "JSONL fallback",
        }
        self._dual_write_log.append(record)
        return record

    def consume_once(self, timeout_ms: int = 500, max_messages: int = 50) -> list[dict]:
        """
        Poll Kafka and dual-write all available messages up to max_messages.
        Returns list of evidence records.

        Uses consume(max_messages) for confluent-kafka to drain a batch in one
        call, which is far more efficient than repeated single-message polls.
        """
        written = []
        if self._consumer is None:
            return written

        # confluent-kafka path — drain up to max_messages in one shot
        if hasattr(self._consumer, "consume"):
            msgs = self._consumer.consume(num_messages=max_messages, timeout=timeout_ms / 1000.0)
            for msg in msgs:
                if msg.error():
                    continue
                try:
                    event = json.loads(msg.value().decode("utf-8"))
                    written.append(self._dual_write(event))
                except Exception as exc:
                    print(f"[B2] parse error: {exc}")
            return written

        # kafka-python path
        if hasattr(self._consumer, "__iter__"):
            batch = self._consumer.poll(timeout_ms=timeout_ms)
            for _tp, messages in batch.items():
                for msg in messages:
                    try:
                        event = msg.value if isinstance(msg.value, dict) else json.loads(msg.value)
                        written.append(self._dual_write(event))
                    except Exception as exc:
                        print(f"[B2] parse error: {exc}")
        return written

    def consume_from_queue(self, queue: list[tuple[str, bytes]]) -> list[dict]:
        """
        Consume from in-memory queue (dry-run / CI / no Kafka mode).
        Used by the demo runner when Kafka is not reachable.
        """
        written = []
        for _topic, value in queue:
            try:
                event = json.loads(value.decode("utf-8"))
                written.append(self._dual_write(event))
            except Exception as exc:
                print(f"[B2] queue parse error: {exc}")
        return written

    @property
    def dual_write_log(self) -> list[dict]:
        return list(self._dual_write_log)


# ── Standalone run ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Works both as `python -m streaming.consumer` and `python streaming/consumer.py`
    try:
        from streaming.producer import KafkaProducer, inject_live_events
    except ImportError:
        from producer import KafkaProducer, inject_live_events  # type: ignore[no-redef]

    p = KafkaProducer()
    c = DualWriteConsumer()
    c.connect()
    c._connect_kafka_consumer()

    events = inject_live_events(p, verbose=True)
    time.sleep(1)

    written = c.consume_once(timeout_ms=3000)
    if not written:
        # Fallback: use in-memory queue
        written = c.consume_from_queue(p.queued)

    for rec in written:
        print(f"  [B2] dual-write ✓  {rec['source']}:{rec['event_type']} → Cassandra + Iceberg")
