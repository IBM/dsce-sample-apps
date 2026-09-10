"""
B6 — Data-Complexity Control View (API endpoints)
===================================================
One operator view: all 18+ sources with name, velocity, format,
last-landed timestamp, row count, pipeline status.

Live sources tick in real time; Databricks shows "federated — query in place".

GET /api/v2/sources          — all 18+ sources + pipeline status
GET /api/v2/pipeline/status  — current build-block health (B1-B5)
GET /api/v2/federation/b3    — run B3 query (live+history) and return result
GET /api/v2/federation/b4    — run B4 query (live+history+Databricks) — money shot
POST /api/v2/events/inject   — on-camera live event injection (B1 acceptance test)
POST /api/v2/events/feed     — direct-feed for dry-run producer
GET /api/v2/events/live      — last N events dual-written (Cassandra + Iceberg)
GET /api/v2/events/stream    — SSE stream: push new events to browser in real time
POST /api/v2/stream/start    — trigger 30-second live demo stream (background thread)
GET  /api/v2/stream/status   — current stream status (running / idle)
"""

from __future__ import annotations

import json
import queue
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Blueprint, Response, jsonify, request

sys.path.insert(0, str(Path(__file__).parent.parent))
from streaming.producer import SOURCES, KafkaProducer, inject_live_events, seed_background_topics
from streaming.consumer import DualWriteConsumer
from streaming.federation import run_b3_query, run_b4_query

# ── Singletons (lazy-init per request to keep startup fast) ───────────────────
_producer: KafkaProducer | None = None
_consumer: DualWriteConsumer | None = None
_consumer_lock = threading.Lock()

# ── SSE subscriber queues ─────────────────────────────────────────────────────
# Each connected SSE client gets its own queue.  The dual-write path pushes
# every new event into all live queues so clients see it within milliseconds.
_sse_subscribers: list[queue.Queue] = []
_sse_lock = threading.Lock()


def _sse_broadcast(record: dict) -> None:
    """Push a dual-write record to every connected SSE subscriber."""
    payload = "data: " + json.dumps(record) + "\n\n"
    with _sse_lock:
        dead = []
        for q in _sse_subscribers:
            try:
                q.put_nowait(payload)
            except queue.Full:
                dead.append(q)
        for q in dead:
            _sse_subscribers.remove(q)

def _get_producer() -> KafkaProducer:
    global _producer
    if _producer is None:
        _producer = KafkaProducer()
    return _producer

# ── Background Kafka drain thread ────────────────────────────────────────────
# Continuously polls all three topics and dual-writes + broadcasts to SSE.
# Started once when the consumer singleton is first created.
_drain_thread: threading.Thread | None = None

# ── Live demo stream state ────────────────────────────────────────────────────
_stream_thread: threading.Thread | None = None
_stream_lock = threading.Lock()
_stream_status: dict = {"state": "idle", "started_at": None, "duration": 30, "hz": 1.5}

def _start_drain_thread(consumer: "DualWriteConsumer") -> None:
    """Spin up a background thread that drains Kafka and broadcasts to SSE."""
    global _drain_thread
    if _drain_thread is not None and _drain_thread.is_alive():
        return
    if consumer._consumer is None:
        return  # no Kafka connection — nothing to drain

    def _drain_loop() -> None:
        while True:
            try:
                records = consumer.consume_once(timeout_ms=500)
                for rec in records:
                    _sse_broadcast(rec)
            except Exception:
                pass  # never crash the drain thread
            time.sleep(0.05)

    _drain_thread = threading.Thread(target=_drain_loop, daemon=True, name="kafka-drain")
    _drain_thread.start()


def _get_consumer() -> DualWriteConsumer:
    global _consumer
    with _consumer_lock:
        if _consumer is None:
            _consumer = DualWriteConsumer()
            _consumer.connect()
            _consumer._connect_kafka_consumer()
            _start_drain_thread(_consumer)
    return _consumer


# ── Blueprint ─────────────────────────────────────────────────────────────────

bp = Blueprint("v2", __name__, url_prefix="/api/v2")


@bp.get("/sources")
def sources():
    """
    B6: All 18+ sources with live status.
    Returns the authoritative SOURCES catalog + enriched status.
    """
    consumer = _get_consumer()
    log = consumer.dual_write_log
    last_by_source: dict[str, str] = {}
    count_by_source: dict[str, int] = {}
    for rec in log:
        s = rec.get("source", "")
        last_by_source[s] = rec.get("dual_write_at", "")
        count_by_source[s] = count_by_source.get(s, 0) + 1

    result = []
    for src in SOURCES:
        src_name_key = src["name"].lower().replace(" ", "_").replace("/", "_")
        # S4 (Databricks) is federated, never lands via Kafka
        if src["id"] == "S4":
            status = "federated — query in place"
            last_landed = None
            row_count = None
        else:
            last = last_by_source.get(src_name_key) or last_by_source.get(src["id"].lower())
            status = "live" if src["live"] else "batch"
            if last:
                status = "streaming ✓" if src["live"] else "batch ✓"
            last_landed = last or None
            row_count = count_by_source.get(src_name_key, 0) or None

        result.append({
            "id":           src["id"],
            "name":         src["name"],
            "system":       src["system"],
            "velocity":     src["velocity"],
            "mechanism":    src["mechanism"],
            "topic":        src["topic"],
            "is_live":      src["live"],
            "status":       status,
            "last_landed":  last_landed,
            "row_count":    row_count,
            "format":       _infer_format(src),
        })

    return jsonify(result)


@bp.get("/pipeline/status")
def pipeline_status():
    """
    B6: Current health of each building block.
    Checks reachability of Kafka, Cassandra, MinIO/COS, Trino, Databricks.
    """
    from config import (
        CONFLUENT_BOOTSTRAP_SERVERS,
        DATASTAX_SCB_PATH,
        TRINO_HOST, TRINO_PORT,
        DATABRICKS_HOST,
        OBJ_ENDPOINT, OBJ_BUCKET,
    )

    blocks = []

    # B1 — Kafka / IBM Confluent
    kafka_ok, kafka_note = _probe_tcp(CONFLUENT_BOOTSTRAP_SERVERS.split(",")[0])
    blocks.append({
        "block": "B1", "name": "Kafka / IBM Confluent",
        "ibm_product": "IBM Confluent (Kafka)",
        "oss_fallback": "Apache Kafka",
        "status": "ok" if kafka_ok else "fallback",
        "note": kafka_note or CONFLUENT_BOOTSTRAP_SERVERS,
    })

    # B2a — Cassandra / IBM DataStax (Astra — reachability shown via SCB path)
    cass_configured = bool(DATASTAX_SCB_PATH and DATASTAX_SCB_PATH != "secure-connect-biw-demo.zip")
    blocks.append({
        "block": "B2a", "name": "Cassandra / IBM DataStax",
        "ibm_product": "IBM DataStax Enterprise",
        "oss_fallback": "Apache Cassandra",
        "status": "configured" if cass_configured else "fallback",
        "note": DATASTAX_SCB_PATH if cass_configured else "SCB not configured — using in-memory",
    })

    # B2b — Object store / IBM COS or MinIO (Iceberg)
    obj_ok, obj_note = _probe_http(OBJ_ENDPOINT)
    blocks.append({
        "block": "B2b", "name": "Object store / Iceberg (IBM COS or MinIO)",
        "ibm_product": "IBM Cloud Object Storage",
        "oss_fallback": "MinIO",
        "status": "ok" if obj_ok else "fallback",
        "note": obj_note or f"{OBJ_ENDPOINT}/{OBJ_BUCKET}",
    })

    # B3/B4 — Trino / watsonx.data Presto
    trino_ok, trino_note = _probe_tcp(f"{TRINO_HOST}:{TRINO_PORT}")
    blocks.append({
        "block": "B3/B4", "name": "Trino / watsonx.data Presto",
        "ibm_product": "watsonx.data (Presto engine)",
        "oss_fallback": "Apache Trino",
        "status": "ok" if trino_ok else "fallback",
        "note": trino_note or f"{TRINO_HOST}:{TRINO_PORT}",
    })

    # B4 — Databricks interop
    db_configured = bool(DATABRICKS_HOST)
    blocks.append({
        "block": "B4-databricks", "name": "Databricks Delta (coexistence)",
        "ibm_product": "watsonx.data → Databricks open Iceberg interop",
        "oss_fallback": "Synthetic rows (labeled)",
        "status": "configured" if db_configured else "simulated",
        "note": DATABRICKS_HOST or "Not configured — using synthetic Databricks rows",
    })

    # B5 — Optional AI tier
    from config import WATSONX_AI_API_KEY, WATSONX_AI_PROJECT_ID
    ai_ok = bool(WATSONX_AI_API_KEY and WATSONX_AI_PROJECT_ID)
    blocks.append({
        "block": "B5", "name": "AI tier (optional, off by default)",
        "ibm_product": "watsonx.ai / Orchestrate / Discovery",
        "oss_fallback": "Ollama / Langflow / OpenSearch",
        "status": "configured" if ai_ok else "off",
        "note": "watsonx.ai reachable" if ai_ok else "off by default — set WATSONX_AI_API_KEY to enable",
    })

    return jsonify({
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
        "blocks": blocks,
    })


@bp.get("/federation/b3")
def federation_b3():
    """B3 — Run zero-copy live+history federation query."""
    consumer = _get_consumer()
    cassandra_rows = consumer.cassandra.read_latest(20)
    iceberg_rows = consumer.iceberg.read_latest(20)

    result = run_b3_query(
        cassandra_rows=cassandra_rows,
        iceberg_rows=iceberg_rows,
    )
    return jsonify({
        "query_id":          result.query_id,
        "engine":            result.engine,
        "is_real_engine":    result.is_real_engine,
        "databricks_included": result.databricks_included,
        "sources_joined":    result.sources_joined,
        "executed_at":       result.executed_at,
        "row_count":         len(result.rows),
        "rows":              result.rows[:20],
        "sql":               result.sql,
    })


@bp.get("/federation/b4")
def federation_b4():
    """
    B4 — The money shot.
    Zero-copy join: live (Cassandra) + history (Iceberg) + Databricks Delta in place.
    """
    consumer = _get_consumer()
    cassandra_rows = consumer.cassandra.read_latest(20)
    iceberg_rows = consumer.iceberg.read_latest(20)

    result = run_b4_query(
        cassandra_rows=cassandra_rows,
        iceberg_rows=iceberg_rows,
    )
    return jsonify({
        "query_id":          result.query_id,
        "engine":            result.engine,
        "is_real_engine":    result.is_real_engine,
        "databricks_included": result.databricks_included,
        "sources_joined":    result.sources_joined,
        "executed_at":       result.executed_at,
        "row_count":         len(result.rows),
        "rows":              result.rows[:20],
        "sql":               result.sql,
        "commercial_thesis": (
            "Keep Databricks where it's working. "
            "IBM wins the integration and real-time layer — "
            "over open formats, so nothing is ever trapped."
        ),
    })


@bp.post("/events/inject")
def inject_event():
    """
    B1 acceptance: on-camera live event injection.
    Injects a Slack event + Salesforce CDC event for a given seller.

    Events are published to Kafka AND dual-written immediately from the
    producer-side payload — this avoids the race condition where the
    Kafka consumer would poll an old-offset message instead of the one
    just produced (consumer group starts from earliest on first connect).
    """
    body = request.get_json(silent=True) or {}
    seller_id = body.get("seller_id", "seller-rachel-001")

    producer = _get_producer()
    consumer = _get_consumer()

    # Produce to Kafka (real or in-memory fallback)
    produced = inject_live_events(producer, seller_id=seller_id, verbose=True)

    # Dual-write directly from the produced payload — no polling race condition
    written = []
    for event in produced:
        record = consumer._dual_write(event)
        written.append(record)
        _sse_broadcast(record)

    return jsonify({
        "produced":      len(produced),
        "dual_written":  len(written),
        "events":        produced,
        "dual_write_log": written,
        "seller_id":     seller_id,
        "injected_at":   datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
    })


@bp.post("/events/feed")
def feed_events():
    """
    Direct feed for producer (dry-run mode).
    Accepts a JSON array of events: [{"topic": "...", "event": {...}}, ...]
    Dual-writes each event, broadcasts via SSE, and returns the log.

    This solves the live-watcher gap: producer in dry-run mode can POST events
    directly to the API instead of queuing them locally, ensuring the watcher
    and the browser dashboard both see real-time updates.
    """
    body = request.get_json(silent=True) or {}
    events_to_feed = body.get("events", [])

    if not isinstance(events_to_feed, list):
        return jsonify({"error": "events must be a list"}), 400

    consumer = _get_consumer()
    written_log = []

    for item in events_to_feed:
        if not isinstance(item, dict):
            continue
        event = item.get("event", {})
        if not isinstance(event, dict):
            continue

        record = consumer._dual_write(event)
        written_log.append(record)
        # Push to any open SSE connections immediately
        _sse_broadcast(record)

    return jsonify({
        "fed":           len(events_to_feed),
        "dual_written":  len(written_log),
        "dual_write_log": written_log,
        "fed_at":        datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
    })


@bp.get("/events/live")
def live_events():
    """Latest N events dual-written to Cassandra + Iceberg."""
    n = request.args.get("n", default=20, type=int)
    consumer = _get_consumer()

    cass_rows = consumer.cassandra.read_latest(n)
    ice_rows = consumer.iceberg.read_latest(n)
    log = consumer.dual_write_log[-n:]

    return jsonify({
        "cassandra_rows":  cass_rows,
        "iceberg_rows":    ice_rows,
        "dual_write_log":  log,
        "cassandra_count": len(cass_rows),
        "iceberg_count":   len(ice_rows),
    })


@bp.get("/events/stream")
def events_stream():
    """
    SSE endpoint — push new dual-write records to the browser in real time.

    Each message is a JSON-encoded dual-write record identical to the objects
    in dual_write_log. The browser connects once and receives events as they
    arrive from Kafka (or the in-memory producer in dry-run mode).

    The client sends a heartbeat comment every 15 s to keep the connection
    alive through proxies that time out idle connections.
    """
    client_q: queue.Queue = queue.Queue(maxsize=500)
    with _sse_lock:
        _sse_subscribers.append(client_q)

    def generate():
        try:
            yield ": connected\n\n"          # immediate handshake comment
            last_heartbeat = time.time()
            while True:
                try:
                    # Block up to 15 s waiting for the next event
                    payload = client_q.get(timeout=15)
                    yield payload
                    last_heartbeat = time.time()
                except queue.Empty:
                    # Send a keep-alive comment so the connection isn't dropped
                    yield ": heartbeat\n\n"
                    last_heartbeat = time.time()
        except GeneratorExit:
            pass
        finally:
            with _sse_lock:
                try:
                    _sse_subscribers.remove(client_q)
                except ValueError:
                    pass

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":  "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )


@bp.post("/stream/start")
def stream_start():
    """
    Trigger a 30-second live demo stream.

    Spawns EnhancedKafkaProducer.run_live_demo_sequence() in a background thread.
    Events flow: Producer → Confluent Kafka → dual-write → SSE → browser.
    While the producer also feeds /events/feed directly, the SSE broadcast
    means the browser sees each event within ~50 ms of production.

    Body (optional JSON):
      { "duration": 30, "hz": 1.5 }
    """
    global _stream_thread, _stream_status

    with _stream_lock:
        if _stream_thread is not None and _stream_thread.is_alive():
            return jsonify({"ok": False, "reason": "stream already running"}), 409

        body = request.get_json(silent=True) or {}
        duration = int(body.get("duration", 30))
        hz = float(body.get("hz", 1.5))

        _stream_status = {
            "state":      "running",
            "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
            "duration":   duration,
            "hz":         hz,
        }

        def _run_stream():
            try:
                from streaming.enhanced_producer import EnhancedKafkaProducer
                producer = EnhancedKafkaProducer(
                    dry_run=False,
                    api_url="http://localhost:5050",
                )
                producer.run_live_demo_sequence(
                    duration_seconds=duration,
                    event_frequency_hz=hz,
                    verbose=False,
                )
            except Exception as exc:
                pass  # never crash — browser just stops receiving events
            finally:
                with _stream_lock:
                    _stream_status["state"] = "idle"

        _stream_thread = threading.Thread(
            target=_run_stream, daemon=True, name="live-stream"
        )
        _stream_thread.start()

    return jsonify({
        "ok":        True,
        "duration":  duration,
        "hz":        hz,
        "started_at": _stream_status["started_at"],
    })


@bp.get("/stream/status")
def stream_status():
    """Return current live demo stream state."""
    with _stream_lock:
        return jsonify(dict(_stream_status))


# ── Probe helpers ─────────────────────────────────────────────────────────────

def _probe_tcp(host_port: str) -> tuple[bool, str]:
    """Quick TCP reachability check."""
    try:
        import socket
        if ":" in host_port:
            host, port_str = host_port.rsplit(":", 1)
            port = int(port_str)
        else:
            host, port = host_port, 80

        with socket.create_connection((host, port), timeout=2):
            return True, f"tcp://{host}:{port} reachable"
    except Exception as exc:
        return False, str(exc)


def _probe_http(url: str) -> tuple[bool, str]:
    """Quick HTTP reachability check."""
    try:
        import urllib.request
        req = urllib.request.Request(url, method="HEAD")
        resp = urllib.request.urlopen(req, timeout=2)
        return True, f"HTTP {resp.status}"
    except Exception as exc:
        return False, str(exc)


def _infer_format(src: dict) -> str:
    m = src.get("mechanism", "").lower()
    if "parquet" in m or "cdc" in m:
        return "parquet / json"
    if "bulk" in m or "batch" in m:
        return "csv / parquet"
    if "webhook" in m or "api" in m:
        return "json"
    if "iceberg" in m:
        return "iceberg (delta)"
    return "json"
