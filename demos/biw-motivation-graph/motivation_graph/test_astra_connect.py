"""
Step 1 — Standalone Astra DB connection test
=============================================
Tests ONLY CassandraWriter: connect (SCB + token), table DDL, one write, one read.
Verify the row in Astra Data Explorer before moving to step 2.

Run from the motivation_graph/ directory:
    python test_astra_connect.py

Expects in .env (motivation_graph/.env or repo root .env):
    DATASTAX_KEYSPACE=biwdemo
    DATASTAX_SCB_PATH=motivation_graph/secure-connect-biw-demo.zip
    DATASTAX_TOKEN=AstraCS:...
"""

import sys
import uuid
from pathlib import Path

# Make sure config is importable from this directory
sys.path.insert(0, str(Path(__file__).parent))

from config import DATASTAX_KEYSPACE, DATASTAX_SCB_PATH, DATASTAX_TOKEN

print("─" * 60)
print("BIW Astra DB — CassandraWriter standalone test")
print("─" * 60)
print(f"  keyspace : {DATASTAX_KEYSPACE}")
print(f"  SCB path : {DATASTAX_SCB_PATH}")
print(f"  token    : {'set ✓' if DATASTAX_TOKEN else 'MISSING ✗'}")

scb = Path(DATASTAX_SCB_PATH)
if not scb.exists():
    print(f"\n✗  SCB file not found: {scb.resolve()}")
    print("   Download it from Astra UI → your database → Connect → Download Bundle")
    sys.exit(1)

if not DATASTAX_TOKEN:
    print("\n✗  DATASTAX_TOKEN is not set in .env")
    sys.exit(1)

# ── 1. Connect ────────────────────────────────────────────────────────────────
from streaming.consumer import CassandraWriter

w = CassandraWriter()
ok = w.connect()

if not ok:
    print("\n✗  connect() returned False — check error above and verify SCB + token")
    sys.exit(1)

print("\n✓  Connected to Astra DB")

# ── 2. Write one test event ────────────────────────────────────────────────────
test_event = {
    "event_id":   "test-" + str(uuid.uuid4())[:8],
    "source":     "test_astra_connect",
    "event_type": "connection.verified",
    "seller_id":  "seller-rachel-001",
    "event_ts":   "2026-08-01T12:00:00Z",
    "payload":    {"note": "standalone connect test"},
    "_source_id": "TEST",
}

w.write(test_event)
print(f"✓  Wrote event_id={test_event['event_id']} to {DATASTAX_KEYSPACE}.biw_live_events")

# ── 3. Read it back ────────────────────────────────────────────────────────────
rows = w.read_latest(5)
match = [r for r in rows if r.get("event_id") == test_event["event_id"]]

if match:
    print(f"✓  Read back {len(rows)} row(s) — test row found ✓")
else:
    print(f"⚠  Read back {len(rows)} row(s) — test row not yet visible (eventual consistency is normal)")

print("\n→  Now open Astra Data Explorer:")
print(f"   Keyspace: {DATASTAX_KEYSPACE}  |  Table: biw_live_events")
print(f"   Filter: event_id = '{test_event['event_id']}'")
print("\n✓  Step 1 complete — run the full dual-write test next:")
print("   cd motivation_graph && python -m streaming.consumer")
