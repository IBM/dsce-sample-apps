#!/usr/bin/env python3
"""
Ingest JSON files from data/sellers/ into IBM Confluent Cloud Kafka.

Usage:
    python3 confluent_ingester.py [--dry-run] [--seller SELLER_ID]

Examples:
    python3 confluent_ingester.py                    # All sellers, live
    python3 confluent_ingester.py --dry-run          # Preview only
    python3 confluent_ingester.py --seller seller-rachel-001  # Single seller
    python3 confluent_ingester.py --dry-run --seller seller-rachel-001

Prerequisites:
    1. Set environment variables or .env file:
       CONFLUENT_BOOTSTRAP_SERVERS=pkc-xxxxx.region.provider.confluent.cloud:9092
       CONFLUENT_SASL_USERNAME=YOUR_API_KEY
       CONFLUENT_SASL_PASSWORD=YOUR_API_SECRET
       CONFLUENT_SECURITY_PROTOCOL=SASL_SSL
       CONFLUENT_SASL_MECHANISM=PLAIN

    2. Create topics in Confluent Cloud:
       biw.salesforce.cdc
       biw.batch.ingest
       biw.slack.events
"""

import json
import sys
import argparse
from pathlib import Path

# Setup path
sys.path.insert(0, str(Path(__file__).parent))
from config import (
    CONFLUENT_BOOTSTRAP_SERVERS,
    CONFLUENT_SASL_MECHANISM,
    CONFLUENT_SASL_PASSWORD,
    CONFLUENT_SASL_USERNAME,
    CONFLUENT_SECURITY_PROTOCOL,
)
from streaming.producer import KafkaProducer

# Constants
SELLERS = ["seller-rachel-001", "seller-marcus-001", "seller-maya-001"]
DATA_DIR = Path(__file__).parent / "data" / "sellers"
TOPICS = {
    "salesforce": "biw.salesforce.cdc",
    "workday": "biw.batch.ingest",
    "teams": "biw.slack.events",
}


def load_jsonl(filepath: Path) -> list[dict]:
    """Load JSONL file (one JSON object per line, may have blank lines for readability)."""
    events = []
    if not filepath.exists():
        return events
    with open(filepath, "r") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"⚠️  Skipped malformed JSON in {filepath.name}: {line[:50]}...")
    return events


def main():
    parser = argparse.ArgumentParser(
        description="Ingest JSON files into IBM Confluent Cloud Kafka",
        epilog="For help with Confluent credentials, see README.md or confluent_ingester.py docstring",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be sent (don't actually produce to Kafka)",
    )
    parser.add_argument(
        "--seller",
        type=str,
        default=None,
        help="Single seller to ingest (default: all three personas)",
    )
    args = parser.parse_args()

    sellers = [args.seller] if args.seller else SELLERS
    producer = KafkaProducer(dry_run=args.dry_run)

    print(f"\n{'='*80}")
    print(f"🚀 IBM Confluent Cloud Ingester")
    print(f"{'='*80}")
    print(f"Bootstrap: {CONFLUENT_BOOTSTRAP_SERVERS}")
    print(f"Mode: {'DRY-RUN (no data sent)' if args.dry_run else 'LIVE (data will be sent to Confluent)'}")
    print(f"Sellers: {', '.join(sellers)}")
    print(f"Topics: {list(TOPICS.values())}")
    print(f"\n")

    total_events = 0
    events_by_topic = {topic: 0 for topic in TOPICS.values()}

    for seller_id in sellers:
        seller_dir = DATA_DIR / seller_id
        if not seller_dir.exists():
            print(f"⚠️  Seller directory not found: {seller_dir}")
            continue

        print(f"[{seller_id}]")

        # Salesforce CDC
        sf_file = seller_dir / f"{seller_id}_salesforce.jsonl"
        sf_events = load_jsonl(sf_file)
        for evt in sf_events:
            producer.produce(TOPICS["salesforce"], evt)
            events_by_topic[TOPICS["salesforce"]] += 1
            total_events += 1
        print(f"  ✓ {TOPICS['salesforce']:<30} {len(sf_events):2d} events")

        # Workday Batch
        wd_file = seller_dir / f"{seller_id}_workday.jsonl"
        wd_events = load_jsonl(wd_file)
        for evt in wd_events:
            producer.produce(TOPICS["workday"], evt)
            events_by_topic[TOPICS["workday"]] += 1
            total_events += 1
        print(f"  ✓ {TOPICS['workday']:<30} {len(wd_events):2d} events")

        # Teams / Slack
        teams_file = seller_dir / f"{seller_id}_teams.jsonl"
        teams_events = load_jsonl(teams_file)
        for evt in teams_events:
            producer.produce(TOPICS["teams"], evt)
            events_by_topic[TOPICS["teams"]] += 1
            total_events += 1
        print(f"  ✓ {TOPICS['teams']:<30} {len(teams_events):2d} events")

        print()

    # Flush to Kafka — wait up to 30s for all deliveries
    producer.flush(timeout=30.0)

    # Summary
    print(f"{'='*80}")
    print(f"Summary:")
    for topic, count in sorted(events_by_topic.items()):
        print(f"  {topic:<30} {count:2d} events")
    print(f"{'='*80}")
    print(f"✓ Total: {total_events} events")
    if args.dry_run:
        print(f"   (DRY-RUN mode: no data was actually sent)")
    else:
        print(f"   (LIVE mode: data has been pushed to IBM Confluent Cloud)")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
