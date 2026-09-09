"""
B1 Enhanced — Multi-Source Event Producer with Continuous Streaming
====================================================================

Extends producer.py with:
  1. Workday batch generation (nightly employee records)
  2. Salesforce opportunity streaming with continuous changes (stage changes, amount updates)
  3. Teams message/presence streaming with high-frequency updates
  4. Live demonstration mode showing constant data arrival

All sellers exist consistently across all three sources.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    CONFLUENT_BOOTSTRAP_SERVERS,
    KAFKA_TOPIC_BATCH,
    KAFKA_TOPIC_COLLAB,
    KAFKA_TOPIC_CRM,
)
from streaming.source_schemas import SourceSchemaGenerator


# Named sellers — the 3 demo personas with full static data files.
# Used for the live demo stream so every event the client sees on screen
# maps to a known seller profile (Rachel, Marcus, Maya).
ALL_SELLER_IDS = [
    "seller-rachel-001",
    "seller-marcus-001",
    "seller-maya-001",
]

# Extended pool — uncomment to expand the stream to a full 20-seller org
# ALL_SELLER_IDS += [f"seller-{i:03d}" for i in range(1, 18)]


class EnhancedKafkaProducer:
    """
    Enhanced producer that generates realistic streaming data from all three sources
    while maintaining seller consistency.
    
    In dry-run mode with api_url set, events are POSTed directly to /api/v2/events/feed
    so the live watcher sees them in real-time.
    """

    def __init__(self, dry_run: bool = False, api_url: str | None = None):
        self._dry_run = dry_run
        self._api_url = api_url or "http://localhost:5050"
        self._producer = None
        self._fallback_queue: list[tuple[str, bytes]] = []
        self._schema_gen = SourceSchemaGenerator()

        if not dry_run:
            self._producer = self._connect()

    def _connect(self):
        """Reuse connection logic from original producer."""
        from streaming.producer import KafkaProducer as OriginalProducer

        original = OriginalProducer(dry_run=False)
        return original._producer

    def produce(self, topic: str, event: dict) -> None:
        """Produce event to Kafka AND feed to the API for real-time SSE delivery.

        When api_url is set (always in demo mode):
          - Real Confluent path: writes to Kafka for durability, THEN feeds the
            API directly so the browser sees it instantly without waiting for
            the consumer group rebalance.
          - Dry-run path: skips Kafka entirely, feeds API only.

        This means the demo browser dashboard is always instant regardless of
        whether events are going to real Confluent or not.
        """
        value = json.dumps(event).encode("utf-8")
        key = (event.get("seller_id") or event.get("event_id") or "").encode("utf-8")

        if self._dry_run or self._producer is None:
            # No Kafka — feed directly to API (or queue if API also unreachable)
            if self._api_url:
                self._feed_to_api(event)
            else:
                self._fallback_queue.append((topic, value))
            return

        # Real Confluent path — write to Kafka for durability
        if hasattr(self._producer, "produce") and hasattr(self._producer, "flush"):
            self._producer.produce(topic, value=value, key=key)
            self._producer.poll(0)
        elif hasattr(self._producer, "send"):
            self._producer.send(topic, value=value, key=key)
        else:
            self._fallback_queue.append((topic, value))

        # ALSO feed directly to API so SSE clients see it instantly
        # (avoids the Kafka consumer group rebalance delay in the browser)
        if self._api_url:
            self._feed_to_api(event)
    
    def _feed_to_api(self, event: dict) -> None:
        """POST a single event to /api/v2/events/feed for real-time watcher."""
        try:
            import urllib.request
            import urllib.error
            
            url = f"{self._api_url}/api/v2/events/feed"
            payload = json.dumps({"events": [{"event": event}]}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    # Success — log the response status
                    _ = resp.read()
            except urllib.error.URLError as e:
                # API not reachable; fall back to local queue
                self._fallback_queue.append(("", event.get("event_id", "")))
        except Exception:
            # On any error, queue locally
            pass

    def flush(self, timeout: float = 5.0) -> None:
        """Flush pending messages."""
        if self._producer is None:
            return
        if hasattr(self._producer, "flush"):
            self._producer.flush(timeout)

    @property
    def queued(self) -> list[tuple[str, bytes]]:
        """Return in-memory queue (dry-run / CI mode)."""
        return list(self._fallback_queue)

    # ═══════════════════════════════════════════════════════════════════════════════
    # WORKDAY — Batch Ingestion
    # ═══════════════════════════════════════════════════════════════════════════════

    def produce_workday_batch(self, verbose: bool = True) -> list[dict]:
        """
        Produce a complete Workday nightly batch for all sellers.

        Simulates: Nightly extract of employee records with occasional updates
        (promotions, compensation changes, location changes).
        """
        events = self._schema_gen.make_workday_batch_file(ALL_SELLER_IDS)
        produced = []

        for event in events:
            self.produce(KAFKA_TOPIC_BATCH, event)
            produced.append(event)
            if verbose:
                record_type = event.get("record_type", "")
                seller_id = event.get("seller_id", "N/A")
                event_type = event.get("event_type", "")
                print(
                    f"  [B1/Workday] → {KAFKA_TOPIC_BATCH}  {record_type}:{event_type}  "
                    f"seller={seller_id}  ts={event.get('event_ts')}"
                )

        self.flush()
        return produced

    # ═══════════════════════════════════════════════════════════════════════════════
    # SALESFORCE — Streaming (CDC) Ingestion with Continuous Updates
    # ═══════════════════════════════════════════════════════════════════════════════

    def produce_salesforce_streaming_batch(self, batch_count: int = 10, verbose: bool = True) -> list[dict]:
        """
        Produce a batch of Salesforce opportunity events showing continuous changes.

        This is the "live streaming" demo: shows deals progressing through stages,
        amounts changing, close dates shifting — all in real-time.
        """
        produced = []

        for _ in range(batch_count):
            seller_id = self._schema_gen.rng.choice(ALL_SELLER_IDS)
            subtype = self._schema_gen.rng.choices(
                ["standard", "stage_change", "amount_change", "close_date_change", "new_opportunity"],
                weights=[30, 25, 20, 15, 10],
                k=1,
            )[0]

            event = self._schema_gen.make_salesforce_opportunity_event(seller_id, subtype)
            self.produce(KAFKA_TOPIC_CRM, event)
            produced.append(event)

            if verbose:
                event_type = event.get("event_type", "")
                opp_id = event.get("payload", {}).get("opportunity_id", "?")
                stage = event.get("payload", {}).get("stage", "?")
                amount = event.get("payload", {}).get("amount_usd", 0)
                print(
                    f"  [B1/Salesforce] → {KAFKA_TOPIC_CRM}  {event_type}  "
                    f"seller={seller_id}  opp={opp_id}  stage={stage}  amount=${amount:,.0f}"
                )

        self.flush()
        return produced

    # ═══════════════════════════════════════════════════════════════════════════════
    # TEAMS — Streaming (Chat/Presence) Ingestion with High Frequency Updates
    # ═══════════════════════════════════════════════════════════════════════════════

    def produce_teams_streaming_batch(self, batch_count: int = 10, verbose: bool = True) -> list[dict]:
        """
        Produce a batch of Teams events showing live team collaboration.

        This is the "live collaboration" demo: messages, reactions, presence updates
        flowing in real-time to show team activity.
        """
        produced = []

        for _ in range(batch_count):
            seller_id = self._schema_gen.rng.choice(ALL_SELLER_IDS)
            event_type = self._schema_gen.rng.choices(
                ["message", "presence", "reaction"],
                weights=[60, 25, 15],
                k=1,
            )[0]

            if event_type == "message":
                msg_type = self._schema_gen.rng.choices(
                    ["standard", "recognition", "achievement", "question"],
                    weights=[50, 20, 15, 15],
                    k=1,
                )[0]
                event = self._schema_gen.make_teams_message_event(seller_id, msg_type)
            elif event_type == "presence":
                event = self._schema_gen.make_teams_presence_event(seller_id)
            else:  # reaction
                reactor = self._schema_gen.rng.choice(ALL_SELLER_IDS)
                event = self._schema_gen.make_teams_reaction_event(seller_id, reactor)

            self.produce(KAFKA_TOPIC_COLLAB, event)
            produced.append(event)

            if verbose:
                etype = event.get("event_type", "")
                channel = event.get("payload", {}).get("channel", "?")
                status = event.get("payload", {}).get("status", "?")
                print(
                    f"  [B1/Teams] → {KAFKA_TOPIC_COLLAB}  {etype}  "
                    f"seller={seller_id}  channel={channel}  status={status}"
                )

        self.flush()
        return produced

    # ═══════════════════════════════════════════════════════════════════════════════
    # LIVE DEMONSTRATION MODE
    # ═══════════════════════════════════════════════════════════════════════════════

    def run_live_demo_sequence(
        self,
        duration_seconds: int = 30,
        event_frequency_hz: float = 1.5,
        verbose: bool = True,
    ) -> dict[str, list[dict]]:
        """
        Run a continuous live streaming demo sequence.

        Produces events at constant frequency (~event_frequency_hz per second)
        across all three sources to showcase real-time data arrival.

        Perfect for: Demonstrating that the system picks up constant data changes,
        showing the control view update in real-time, proving sub-second latency.
        """
        start_time = time.time()
        all_events = {"salesforce": [], "teams": []}
        event_count = 0
        seconds_elapsed = 0

        interval = 1.0 / event_frequency_hz  # seconds between events

        if verbose:
            print(
                f"\n[B1 LIVE DEMO] Starting {duration_seconds}s continuous stream "
                f"@ {event_frequency_hz} events/sec (~{event_frequency_hz * duration_seconds:.0f} total events)"
            )
            print(f"  Sellers: {len(ALL_SELLER_IDS)} | Sources: Salesforce (CRM) + Teams (collab) cycling\n")

        next_event_time = time.time()

        while time.time() - start_time < duration_seconds:
            current_time = time.time()
            seconds_elapsed = current_time - start_time

            # Time to produce next event?
            if current_time >= next_event_time:
                # Alternate between Salesforce and Teams only
                # (Workday is batch — not shown in the live stream demo)
                source_idx = event_count % 2
                if source_idx == 0:
                    # Salesforce CDC
                    event = self._schema_gen.make_salesforce_opportunity_event(
                        self._schema_gen.rng.choice(ALL_SELLER_IDS),
                        self._schema_gen.rng.choices(
                            ["standard", "stage_change", "amount_change"],
                            weights=[40, 35, 25],
                            k=1,
                        )[0],
                    )
                    self.produce(KAFKA_TOPIC_CRM, event)
                    all_events["salesforce"].append(event)
                    if verbose:
                        print(
                            f"[{seconds_elapsed:5.1f}s] SF  {event.get('payload', {}).get('opportunity_id')} | "
                            f"{event.get('payload', {}).get('stage')} | "
                            f"${event.get('payload', {}).get('amount_usd', 0):>10.0f}"
                        )

                else:
                    # Teams / collaboration
                    event = self._schema_gen.make_teams_message_event(
                        self._schema_gen.rng.choice(ALL_SELLER_IDS),
                        self._schema_gen.rng.choices(
                            ["standard", "recognition", "achievement"],
                            weights=[50, 30, 20],
                            k=1,
                        )[0],
                    )
                    self.produce(KAFKA_TOPIC_COLLAB, event)
                    all_events["teams"].append(event)
                    if verbose:
                        msg_text = event.get("payload", {}).get("text", "")[:40]
                        print(f"[{seconds_elapsed:5.1f}s] TMS {event.get('seller_id')} | {msg_text}...")

                event_count += 1
                next_event_time = current_time + interval

            # Sleep briefly to avoid busy-waiting
            time.sleep(0.001)

        self.flush()

        if verbose:
            print(
                f"\n[B1 LIVE DEMO] Completed: {event_count} events in {seconds_elapsed:.1f}s "
                f"({event_count/seconds_elapsed:.1f} events/sec)"
            )
            print(f"  Salesforce: {len(all_events['salesforce'])} events")
            print(f"  Teams:      {len(all_events['teams'])} events")

        return all_events


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Enhanced multi-source Kafka producer")
    parser.add_argument(
        "--mode",
        choices=["batch", "stream", "demo", "all"],
        default="all",
        help="Production mode: batch (Workday only), stream (Salesforce+Teams once), demo (continuous), or all",
    )
    parser.add_argument("--demo-duration", type=int, default=30, help="Demo mode duration in seconds")
    parser.add_argument(
        "--demo-frequency", type=float, default=2.0, help="Demo mode event frequency (events/sec)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Dry run (no Kafka, show queued events)")
    parser.add_argument("--api-url", default="http://localhost:5000", help="API server URL for live feed (dry-run mode)")

    args = parser.parse_args()

    producer = EnhancedKafkaProducer(dry_run=args.dry_run, api_url=args.api_url)

    if args.mode in ("batch", "all"):
        print("\n═ Workday Batch ═")
        producer.produce_workday_batch(verbose=True)

    if args.mode in ("stream", "all"):
        print("\n═ Salesforce Streaming ═")
        producer.produce_salesforce_streaming_batch(batch_count=5, verbose=True)

        print("\n═ Teams Streaming ═")
        producer.produce_teams_streaming_batch(batch_count=5, verbose=True)

    if args.mode == "demo":
        print("\n═ LIVE DEMO MODE ═")
        producer.run_live_demo_sequence(
            duration_seconds=args.demo_duration,
            event_frequency_hz=args.demo_frequency,
            verbose=True,
        )

    if args.dry_run:
        print(f"\n[DRY RUN] Queued {len(producer.queued)} events (no Kafka)")
