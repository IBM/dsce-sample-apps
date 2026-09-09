"""
Live Streaming Watcher
======================
Run this in a terminal while the enhanced_producer is running in another.
Polls /api/v2/events/live every second and prints a live scrolling feed
so you can watch Workday, Salesforce, and Teams events arrive in real time.

Usage (two terminals side-by-side):

  Terminal 1 — start the API server:
    cd motivation_graph
    python3 api.py

  Terminal 2 — start the producer (continuous stream):
    cd motivation_graph
    python3 -m streaming.enhanced_producer --mode demo --demo-duration 60

  Terminal 3 — watch the live feed:
    cd motivation_graph
    python3 -m streaming.live_watcher

Press Ctrl+C to stop the watcher.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── ANSI colour codes ─────────────────────────────────────────────────────────
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
CYAN    = "\033[96m"
MAGENTA = "\033[95m"
RED     = "\033[91m"
GREY    = "\033[90m"
BOLD    = "\033[1m"
RESET   = "\033[0m"

SOURCE_COLOURS = {
    "salesforce": GREEN,
    "workday":    CYAN,
    "teams":      MAGENTA,
    "slack":      MAGENTA,
}

EVENT_SYMBOLS = {
    "opportunity.stage_changed":   "🔄",
    "opportunity.updated":         "📊",
    "opportunity.created":         "✨",
    "opportunity.amount_changed":  "💰",
    "opportunity.close_date_changed": "📅",
    "account.updated":             "🏢",
    "employee.record.sync":        "👤",
    "employee.promotion":          "🎖️",
    "employee.compensation.update":"💵",
    "employee.location.change":    "📍",
    "message.posted":              "💬",
    "presence.changed":            "🟢",
    "message.reaction_added":      "👍",
}


def _colour_for(source: str) -> str:
    return SOURCE_COLOURS.get(source.lower(), GREY)


def _symbol_for(event_type: str) -> str:
    return EVENT_SYMBOLS.get(event_type, "•")


def _fetch_live(base_url: str, n: int) -> list[dict]:
    """Fetch the latest N dual-written events from the API."""
    url = f"{base_url}/api/v2/events/live?n={n}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            return data.get("dual_write_log", [])
    except Exception:
        return []


def _inject(base_url: str, seller_id: str) -> dict:
    """POST /api/v2/events/inject to fire a live event on-camera."""
    url = f"{base_url}/api/v2/events/inject"
    payload = json.dumps({"seller_id": seller_id}).encode()
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())


def _source_summary(events: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for e in events:
        s = e.get("source", "unknown")
        counts[s] = counts.get(s, 0) + 1
    return counts


def _format_row(event: dict, idx: int) -> str:
    """Format a single event as a coloured terminal row."""
    source     = event.get("source", "?")
    event_type = event.get("event_type", "?")
    seller_id  = event.get("seller_id") or "—"
    ts         = event.get("dual_write_at") or event.get("event_ts") or "?"
    cass_ok    = event.get("cassandra_ok", False)
    ice_ok     = event.get("iceberg_ok", False)

    col   = _colour_for(source)
    sym   = _symbol_for(event_type)
    src_label  = f"{col}{source:<12}{RESET}"
    type_label = f"{event_type:<38}"
    seller     = f"{GREY}{seller_id:<24}{RESET}"
    sinks = (
        f"{GREEN}✓ Cassandra{RESET}" if cass_ok else f"{GREY}○ Cassandra{RESET}"
    ) + "  " + (
        f"{GREEN}✓ Iceberg{RESET}" if ice_ok else f"{GREY}○ Iceberg{RESET}"
    )
    ts_short = ts[11:23] if len(ts) > 12 else ts   # HH:MM:SS.mmm

    return f"  {GREY}{idx:>4}{RESET}  {sym}  {src_label}  {type_label}  {seller}  {sinks}  {GREY}{ts_short}{RESET}"


def run_watcher(base_url: str, poll_hz: float, burst_mode: bool) -> None:
    """Main watcher loop."""
    interval = 1.0 / poll_hz
    seen_ids: set[str] = set()
    total = 0
    start = time.time()

    print(f"\n{BOLD}{'─'*90}{RESET}")
    print(f"{BOLD}  BIW Live Streaming Watcher{RESET}  {GREY}polling {base_url} @ {poll_hz}Hz{RESET}")
    print(f"{BOLD}{'─'*90}{RESET}")
    print(f"  {'#':>4}  {'SRC':<14}  {'EVENT TYPE':<38}  {'SELLER':<24}  {'SINKS':<26}  TIME")
    print(f"{'─'*90}")

    try:
        while True:
            events = _fetch_live(base_url, n=100)
            new_events = [e for e in events if e.get("event_id") not in seen_ids]

            for event in new_events:
                eid = event.get("event_id", "")
                seen_ids.add(eid)
                total += 1
                print(_format_row(event, total))

            # Status bar (overwrites same line)
            elapsed = time.time() - start
            summary = _source_summary(list(events))
            parts = "  ".join(
                f"{_colour_for(s)}{s}{RESET}={n}" for s, n in sorted(summary.items())
            )
            bar = (
                f"\r{GREY}  elapsed={elapsed:5.1f}s  "
                f"total={total}  "
                f"{parts}  "
                f"[Ctrl+C to stop]{RESET}   "
            )
            sys.stdout.write(bar)
            sys.stdout.flush()

            time.sleep(interval)

    except KeyboardInterrupt:
        elapsed = time.time() - start
        summary = _source_summary([e for e in _fetch_live(base_url, 500)])
        print(f"\n\n{BOLD}{'─'*90}{RESET}")
        print(f"{BOLD}  Session ended{RESET}  {elapsed:.1f}s  {total} new events observed")
        for s, n in sorted(summary.items()):
            col = _colour_for(s)
            print(f"    {col}{s:<14}{RESET}  {n} total events")
        print(f"{BOLD}{'─'*90}{RESET}\n")


def run_inject_demo(base_url: str, seller_id: str) -> None:
    """Fire a single on-camera live injection and print the result."""
    print(f"\n{BOLD}── Injecting live event for {seller_id} ──{RESET}")
    try:
        result = _inject(base_url, seller_id)
        produced = result.get("produced", 0)
        written  = result.get("dual_written", 0)
        log      = result.get("dual_write_log", [])

        print(f"{GREEN}✓ Produced:     {produced} event(s) → Kafka{RESET}")
        print(f"{GREEN}✓ Dual-written: {written} event(s) → Cassandra + Iceberg{RESET}")

        for entry in log:
            source     = entry.get("source", "?")
            event_type = entry.get("event_type", "?")
            cass       = entry.get("cassandra_store", "?")
            ice        = entry.get("iceberg_store", "?")
            sym        = _symbol_for(event_type)
            col        = _colour_for(source)
            print(f"  {sym}  {col}{source}{RESET}  {event_type}")
            print(f"       {GREY}Cassandra → {cass}{RESET}")
            print(f"       {GREY}Iceberg   → {ice}{RESET}")

        print(f"\n{GREY}Injected at {result.get('injected_at')}{RESET}\n")
    except Exception as exc:
        print(f"{RED}✗ Injection failed: {exc}{RESET}")
        print(f"{GREY}Is the API server running?  python3 api.py{RESET}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BIW live streaming watcher")
    parser.add_argument("--url",    default="http://localhost:5000", help="API base URL")
    parser.add_argument("--hz",     default=2.0, type=float,         help="Poll frequency (default 2)")
    parser.add_argument("--inject", metavar="SELLER_ID", default=None,
                        help="Fire one on-camera injection then exit")
    args = parser.parse_args()

    if args.inject:
        run_inject_demo(args.url, args.inject)
    else:
        run_watcher(args.url, poll_hz=args.hz, burst_mode=False)
