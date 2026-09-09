"""
Live Streaming Demo Launcher
=============================
Single command that starts the full real-time demo:

  1. Spins up the Flask API server (port 5050, threaded for SSE)
  2. Waits for the API to be ready
  3. Opens the live_demo.html browser dashboard automatically
  4. Starts the enhanced producer in continuous streaming mode
     (events flow: Producer → Kafka → dual-write → SSE → Browser)

Usage:
  cd motivation_graph
  python3 -m streaming.demo_launcher

Options:
  --duration   How long to stream (seconds).  Default 30.
  --hz         Events per second.              Default 1.5.
  --no-browser Skip auto-opening the browser.
  --dry-run    Use in-memory fallback (no Confluent credentials needed).
  --seller     Override seller ID for single on-camera injection only.
  --inject     Fire one injection then exit (no continuous stream).
"""

from __future__ import annotations

import argparse
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

# Ensure imports resolve from motivation_graph root
sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Start API server in background thread ─────────────────────────────────────

def _start_api(port: int = 5050) -> threading.Thread:
    """Launch the Flask API in a daemon thread so it dies with the launcher."""

    def _run():
        # Suppress Flask startup banner — the launcher prints its own
        import logging
        log = logging.getLogger("werkzeug")
        log.setLevel(logging.WARNING)

        from api import app
        # threaded=True is required for SSE (each client gets its own thread)
        app.run(host="127.0.0.1", port=port, debug=False, threaded=True, use_reloader=False)

    t = threading.Thread(target=_run, daemon=True, name="api-server")
    t.start()
    return t


def _wait_for_api(port: int, retries: int = 30, interval: float = 0.5) -> bool:
    """Poll until the API responds on /health or gives up after retries."""
    url = f"http://localhost:{port}/health"
    for _ in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=1):
                return True
        except Exception:
            time.sleep(interval)
    return False


# ── Open browser ─────────────────────────────────────────────────────────────

def _open_browser(port: int) -> None:
    html_path = Path(__file__).parent.parent / "ui" / "live_demo.html"
    if html_path.exists():
        webbrowser.open(html_path.as_uri())
    else:
        webbrowser.open(f"http://localhost:{port}/api/v2/events/live")


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="BIW Live Streaming Demo Launcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--duration",   type=int,   default=30,    help="Stream duration in seconds (default 30)")
    parser.add_argument("--hz",         type=float, default=1.5,   help="Events per second (default 1.5)")
    parser.add_argument("--port",       type=int,   default=5050,  help="API port (default 5050)")
    parser.add_argument("--no-browser", action="store_true",       help="Skip auto-opening the browser")
    parser.add_argument("--dry-run",    action="store_true",       help="No Confluent — use in-memory fallback + direct API feed")
    parser.add_argument("--inject",     action="store_true",       help="Fire one on-camera injection then exit")
    parser.add_argument("--seller",     default="seller-rachel-001", help="Seller ID for injection (default seller-rachel-001)")
    args = parser.parse_args()

    GREEN  = "\033[92m"
    CYAN   = "\033[96m"
    YELLOW = "\033[93m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"
    GREY   = "\033[90m"

    print(f"\n{BOLD}{'═'*64}{RESET}")
    print(f"{BOLD}  elevate® — Live Streaming Demo{RESET}")
    print(f"{BOLD}{'═'*64}{RESET}\n")

    # ── 1. Start API ──────────────────────────────────────────────────────────
    print(f"  {CYAN}[1/4]{RESET} Starting API server on port {args.port}…")
    _start_api(args.port)

    if not _wait_for_api(args.port):
        print(f"  {YELLOW}✗ API server did not start within 15 s. Aborting.{RESET}")
        sys.exit(1)
    print(f"  {GREEN}✓{RESET} API ready  →  http://localhost:{args.port}/health")

    # ── 2. Open browser ───────────────────────────────────────────────────────
    if not args.no_browser:
        print(f"  {CYAN}[2/4]{RESET} Opening live dashboard in browser…")
        _open_browser(args.port)
        time.sleep(0.5)   # give browser a moment to start connecting SSE
        print(f"  {GREEN}✓{RESET} Dashboard opened")
    else:
        html_path = Path(__file__).parent.parent / "ui" / "live_demo.html"
        print(f"  {CYAN}[2/4]{RESET} {GREY}--no-browser: open manually → {html_path}{RESET}")

    # ── 3. Inject-only mode ───────────────────────────────────────────────────
    if args.inject:
        print(f"\n  {CYAN}[3/4]{RESET} Single injection for seller {args.seller}…")
        try:
            payload = f'{{"seller_id":"{args.seller}"}}'.encode()
            req = urllib.request.Request(
                f"http://localhost:{args.port}/api/v2/events/inject",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                import json
                data = json.loads(resp.read())
            print(f"  {GREEN}✓{RESET} Injected {data.get('produced', 0)} event(s) → dual-written {data.get('dual_written', 0)}")
        except Exception as exc:
            print(f"  {YELLOW}✗ Injection failed: {exc}{RESET}")
        print(f"\n  {GREY}Ctrl+C to close the API server{RESET}\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print(f"\n{BOLD}  Session ended.{RESET}\n")
        return

    # ── 4. Start producer ────────────────────────────────────────────────────
    print(f"\n  {CYAN}[3/4]{RESET} Starting enhanced producer…")
    print(f"  {GREY}  mode=demo  duration={args.duration}s  hz={args.hz}  dry_run={args.dry_run}{RESET}")

    from streaming.enhanced_producer import EnhancedKafkaProducer

    # Always pass api_url so the producer feeds the API directly for instant
    # SSE delivery — even in real-Confluent mode events are also written to Kafka
    api_url = f"http://localhost:{args.port}"
    producer = EnhancedKafkaProducer(dry_run=args.dry_run, api_url=api_url)

    print(f"  {GREEN}✓{RESET} Producer ready\n")
    print(f"  {CYAN}[4/4]{RESET} Streaming live — {args.duration}s @ {args.hz} events/s\n")
    print(f"{BOLD}{'─'*64}{RESET}")
    print(f"  {'TIME':>6}  {'SRC':<12}  {'EVENT / DETAIL':<40}")
    print(f"{'─'*64}{RESET}")

    # Use the live demo sequence (verbose output visible in terminal)
    try:
        producer.run_live_demo_sequence(
            duration_seconds=args.duration,
            event_frequency_hz=args.hz,
            verbose=True,
        )
    except KeyboardInterrupt:
        print(f"\n{BOLD}  Stopped by user.{RESET}")

    print(f"\n{BOLD}{'═'*64}{RESET}")
    print(f"{BOLD}  Stream complete — {args.duration}s session finished{RESET}")
    print(f"  {GREY}The browser dashboard retains all events.{RESET}")
    print(f"  {GREY}Ctrl+C to close the API server.{RESET}")
    print(f"{BOLD}{'═'*64}{RESET}\n")

    # Keep API alive so browser can still query history
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n{BOLD}  Session ended.{RESET}\n")


if __name__ == "__main__":
    main()
