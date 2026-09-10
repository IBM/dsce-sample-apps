"""
v2 Demo Runner — Dual-Write Streaming Lakehouse (DataFabric Cut)
================================================================
Implements the two-segment video structure from §8 of the spec.

Segment 1 (~3.5 min): The problem, made visible
  Beat S1.1 — B6 control view: 18+ sources, heterogeneous complexity
  Beat S1.2 — B1 event injection: Slack + Salesforce CDC → Kafka
  Beat S1.3 — B2 dual-write: events land in Cassandra (live) AND Iceberg (history)
  Beat S1.4 — B3 query: live + history, zero-copy join on Trino/watsonx.data
  Beat S1.5 — B4 MONEY SHOT: same query + Databricks Delta, in place, no copy

Segment 2 (~2 min): The payoff + the platform
  Beat S2.1 — B5 thin: Motivation Graph for one seller, sourced from B3/B4 data
  Beat S2.2 — Architecture pullback: watsonx.data at center, land-and-expand close

Usage:
    python demo_runner.py              # full pipeline + demo
    python demo_runner.py --build      # rebuild data only
    python demo_runner.py --demo       # demo sequence only
    python demo_runner.py --seg1       # segment 1 only
    python demo_runner.py --seg2       # segment 2 only
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import box

console = Console()


def _pause(msg: str = "▶  Press ENTER to continue…", duration: float = 0) -> None:
    if duration > 0:
        time.sleep(duration)
    else:
        console.print(f"\n[dim]{msg}[/dim]")
        input()


def _section(title: str, subtitle: str = "") -> None:
    console.print()
    console.rule(f"[bold cyan]{title}[/bold cyan]")
    if subtitle:
        console.print(f"[dim]{subtitle}[/dim]")
    console.print()


def _tag(label: str, color: str = "blue") -> str:
    return f"[{color}]【{label}】[/{color}]"


# ══════════════════════════════════════════════════════════════════════════════
# SEGMENT 1 — The problem, made visible
# ══════════════════════════════════════════════════════════════════════════════

def run_segment_1() -> dict:
    """
    Returns evidence dict: produced events, dual-write records, B3/B4 results.
    """
    from streaming.producer import SOURCES, KafkaProducer, inject_live_events, seed_background_topics
    from streaming.consumer import DualWriteConsumer
    from streaming.federation import run_b3_query, run_b4_query

    # ── INTRO ────────────────────────────────────────────────────────────────
    _section("SEGMENT 1 — THE PROBLEM, MADE VISIBLE",
             "BIW × IBM  |  August 12, 2026  |  SYNTHETIC DATA  |  SEED=20260812")
    console.print(Panel(
        "[bold]Claim 1[/bold]: BIW's data is genuinely hard — 18+ sources, many velocities.\n"
        "[bold]Claim 2[/bold]: watsonx.data unifies live + history as one open lakehouse.\n"
        "[bold]Claim 3[/bold]: It coexists with Databricks — no rip-and-replace.\n\n"
        "[dim italic]All event data synthetic (SEED=20260812). Runtime engines are real.[/dim italic]",
        title="What this segment proves", border_style="cyan"
    ))
    _pause()

    # ── BEAT S1.1 — B6 Control view ──────────────────────────────────────────
    _section("BEAT S1.1 — B6 CONTROL VIEW",
             "18+ sources — every velocity, every format. No two arrive the same way.")

    t = Table(box=box.SIMPLE_HEAD, show_header=True, title="BIW Data Sources (18+)")
    t.add_column("ID",        style="dim", width=5)
    t.add_column("Source",    style="bold")
    t.add_column("System",    style="cyan")
    t.add_column("Velocity",  style="yellow")
    t.add_column("Mechanism")
    t.add_column("Status",    style="green")

    live_sources = [s for s in SOURCES if s["live"]]
    bg_sources   = [s for s in SOURCES if not s["live"]]

    for src in live_sources:
        t.add_row(src["id"], src["name"], src["system"], src["velocity"],
                  src["mechanism"],
                  "[green]LIVE[/green]" if src["id"] != "S4" else "[blue]FEDERATED[/blue]")
    for src in bg_sources:
        t.add_row(src["id"], src["name"], src["system"], src["velocity"],
                  src["mechanism"], "[dim]background[/dim]")

    console.print(t)
    console.print(f"\n[bold]Point:[/bold] {len(SOURCES)} sources. Different velocities, formats, "
                  f"schemas, owners. This is why one warehouse-load script fails.")
    _pause()

    # ── BEAT S1.2 — B1 Event injection ───────────────────────────────────────
    _section("BEAT S1.2 — B1 EVENT INJECTION",
             "Live event: Slack recognition + Salesforce CDC → Kafka (IBM Confluent)")

    producer = KafkaProducer()
    consumer = DualWriteConsumer()
    cass_ok, ice_ok = consumer.connect()
    consumer._connect_kafka_consumer()

    console.print("[bold]Injecting live events on camera…[/bold]\n")
    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"),
                  console=console) as progress:
        task = progress.add_task("Producing events to Kafka…", total=None)
        produced = inject_live_events(producer, seller_id="seller-rachel-001", verbose=False)
        seed_background_topics(producer, verbose=False)
        progress.update(task, completed=True)

    # Display produced events
    evt_table = Table(box=box.SIMPLE, show_header=True)
    evt_table.add_column("Event ID",    style="dim")
    evt_table.add_column("Source",      style="bold")
    evt_table.add_column("Type",        style="cyan")
    evt_table.add_column("Seller",      style="yellow")
    evt_table.add_column("Timestamp")
    for evt in produced:
        evt_table.add_row(
            evt["event_id"][:12],
            evt["source"],
            evt["event_type"],
            evt.get("seller_id") or "—",
            evt["event_ts"][:23],
        )
    console.print(evt_table)
    console.print(f"\n[green]✓ {len(produced)} live events → Kafka topics "
                  f"[dim]({producer._producer.__class__.__name__ if producer._producer else 'in-memory fallback'})[/dim][/green]")
    _pause()

    # ── BEAT S1.3 — B2 Dual-write ────────────────────────────────────────────
    _section("BEAT S1.3 — B2 DUAL-WRITE",
             "Events land in Cassandra (live 'now') AND Iceberg (history 'always')")

    console.print("[bold]Consuming from Kafka and dual-writing…[/bold]")
    written = consumer.consume_once(timeout_ms=3000)
    if not written:
        console.print("  [dim](Kafka not reachable — consuming from in-memory queue)[/dim]")
        written = consumer.consume_from_queue(producer.queued)

    dw_table = Table(box=box.SIMPLE, show_header=True)
    dw_table.add_column("Event ID",       style="dim")
    dw_table.add_column("Source",         style="bold")
    dw_table.add_column("Cassandra",      style="green")
    dw_table.add_column("Iceberg",        style="blue")
    dw_table.add_column("Written at")
    for rec in written:
        dw_table.add_row(
            (rec.get("event_id") or "")[:12],
            rec.get("source", ""),
            "[green]✓ written[/green]" if rec.get("cassandra_ok") else "[red]✗[/red]",
            "[blue]✓ appended[/blue]" if rec.get("iceberg_ok") else "[red]✗[/red]",
            (rec.get("dual_write_at") or "")[:23],
        )
    console.print(dw_table)

    cass_label = "[green]IBM DataStax[/green]" if cass_ok else "[dim]in-memory fallback[/dim]"
    ice_label  = "[blue]watsonx.data (Iceberg)[/blue]" if ice_ok else "[dim]JSONL fallback[/dim]"
    console.print(f"\n[bold]Live state →[/bold] {cass_label}  (Cassandra — operational 'now')")
    console.print(f"[bold]History    →[/bold] {ice_label}  (Iceberg on COS/MinIO — 'always')")
    console.print(f"\n[green]✓ One consume. Two writes. Minutes of latency, not a migration.[/green]")
    _pause()

    # ── BEAT S1.4 — B3 Zero-copy live+history join ───────────────────────────
    _section("BEAT S1.4 — B3 ZERO-COPY FEDERATION",
             "Single Trino/watsonx.data query joins live (Cassandra) + history (Iceberg) — no copy")

    console.print("[bold]Running B3 federation query…[/bold]\n")
    cass_rows = consumer.cassandra.read_latest(20)
    ice_rows  = consumer.iceberg.read_latest(20)
    b3 = run_b3_query(cassandra_rows=cass_rows, iceberg_rows=ice_rows)

    console.print(Panel(b3.sql, title="SQL — B3 query", border_style="dim"))
    console.print(f"\n[bold]Engine:[/bold] [cyan]{b3.engine}[/cyan]  "
                  f"| [bold]Sources joined:[/bold] {b3.sources_joined}  "
                  f"| [bold]Rows:[/bold] {len(b3.rows)}")
    if not b3.is_real_engine:
        console.print("[yellow]  ⚠  Trino not reachable — result from in-memory fallback "
                      "(clearly labeled, per Hardening Addendum)[/yellow]")
    else:
        console.print("[green]  ✓ Real Trino engine executed the query — query ID: "
                      f"{b3.query_id}[/green]")
    _pause()

    # ── BEAT S1.5 — B4 MONEY SHOT ────────────────────────────────────────────
    _section("BEAT S1.5 — B4 THE MONEY SHOT",
             "live + history + Databricks Delta IN PLACE — zero copy, zero migration")

    console.print(Panel(
        "[bold yellow]Commercial thesis:[/bold yellow]\n\n"
        "Keep Databricks where it's working.\n"
        "Let watsonx.data solve the 18-source integration and real-time problem —\n"
        "over open formats, so nothing is ever trapped.\n\n"
        "[bold]How:[/bold] The same Trino/Presto federation node that joins live + history\n"
        "also reads BIW's Databricks Delta table [bold]IN PLACE[/bold] via open Iceberg interop.\n"
        "[dim]No data copied out of Databricks. No migration. IBM wins the integration layer.[/dim]",
        border_style="yellow", title="Coexistence — NOT rip-and-replace"
    ))
    console.print()
    console.print("[bold]Running B4 federation query (money shot)…[/bold]\n")

    b4 = run_b4_query(cassandra_rows=cass_rows, iceberg_rows=ice_rows)

    console.print(Panel(b4.sql, title="SQL — B4 query (3-source zero-copy)", border_style="yellow"))
    console.print(f"\n[bold]Engine:[/bold] [cyan]{b4.engine}[/cyan]  "
                  f"| [bold]Databricks included:[/bold] {'[green]YES — query-in-place[/green]' if b4.databricks_included else '[red]NO[/red]'}  "
                  f"| [bold]Rows:[/bold] {len(b4.rows)}")
    console.print(f"[bold]Sources:[/bold]")
    for src in b4.sources_joined:
        icon = "[green]✓[/green]" if "fallback" not in src else "[yellow]⚠ simulated[/yellow]"
        console.print(f"  {icon} {src}")

    if b4.rows:
        # Show the Databricks columns to make the money shot visible
        b4_t = Table(box=box.SIMPLE, show_header=True,
                     title="B4 Result sample — 3 sources, 1 query, zero copy")
        b4_t.add_column("Seller",            style="bold")
        b4_t.add_column("Live source",       style="green")
        b4_t.add_column("History source",    style="blue")
        b4_t.add_column("Databricks source", style="yellow")
        b4_t.add_column("Read mode",         style="dim")
        for row in b4.rows[:5]:
            b4_t.add_row(
                str(row.get("seller_id", ""))[:28],
                str(row.get("live_source", "") or "—"),
                str(row.get("hist_source", "") or "—"),
                str(row.get("databricks_seller_id", "") or "—"),
                str(row.get("databricks_read_mode", "") or "—"),
            )
        console.print(b4_t)

    console.print(f"\n[bold yellow]🎯 This is the commercial thesis in a single query.[/bold yellow]")
    _pause()

    return {
        "produced_events": produced,
        "dual_write_log":  written,
        "b3_result":       {"query_id": b3.query_id, "engine": b3.engine,
                            "rows": len(b3.rows), "is_real": b3.is_real_engine},
        "b4_result":       {"query_id": b4.query_id, "engine": b4.engine,
                            "rows": len(b4.rows), "is_real": b4.is_real_engine,
                            "databricks_included": b4.databricks_included},
        "consumer":        consumer,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SEGMENT 2 — The payoff + the platform
# ══════════════════════════════════════════════════════════════════════════════

def run_segment_2(consumer=None) -> None:
    """
    Thin Motivation Graph payoff + architecture pullback.

    B5 is implementation-agnostic: the nudge comes from a SQL-rules pass over
    unified signals — no graph, no networkx.  The narrative 'Motivation Graph'
    is preserved as a brand label.  The three sources that visibly feed the
    nudge are: Salesforce CDC (live), Slack Events (real-time), Databricks
    historical metric (federated in place). (§B5, §A7, §10, §12)
    """
    import duckdb
    from config import DB_PATH

    _section("SEGMENT 2 — THE PAYOFF + THE PLATFORM",
             "Unified data drives the Motivation Graph  |  Architecture pullback  |  Land-and-expand close")

    # ── BEAT S2.1 — Motivation Graph thin slice ───────────────────────────────
    _section("BEAT S2.1 — MOTIVATION GRAPH (THIN)",
             "≥3 unified sources → SQL-rules pass → personalized nudge  (no graph, no networkx)")

    try:
        con = duckdb.connect(DB_PATH, read_only=True)
        from app.nudge import generate_all_nudges
        nudges = generate_all_nudges(con)

        for nudge in nudges:
            sources_text = "\n".join(f"  • {s}" for s in nudge["unified_sources"])
            sigs = nudge["source_signals"]
            console.print(Panel(
                f"[bold]Seller:[/bold]  {nudge['display_name']}  "
                f"[dim]({nudge.get('persona_label') or ''})[/dim]\n"
                f"[bold]Framing:[/bold] [cyan]{nudge['framing']}[/cyan]\n\n"
                f"[bold]HEADLINE:[/bold] {nudge['headline']}\n"
                f"[bold]BODY:[/bold]     {nudge['body']}\n\n"
                f"[bold]Unified sources (≥3 required):[/bold]\n{sources_text}\n\n"
                f"[dim]Signals: SF deals closed={sigs['salesforce_deals_closed']}  "
                f"CRM updates={sigs['salesforce_crm_updates']}  "
                f"Slack recognitions={sigs['slack_recognitions']}  "
                f"Databricks 90d velocity={sigs['databricks_deal_velocity_90d']}[/dim]",
                title=f"Motivation nudge — {nudge['seller_id']}",
                border_style="cyan",
            ))

        con.close()
    except Exception as exc:
        console.print(f"[yellow]  (Motivation Graph data not yet built — run --build first: {exc})[/yellow]")

    console.print("\n[dim]'Motivation Graph' is the brand name for the payoff layer. "
                  "The implementation is a SQL-rules pass over unified lakehouse data. "
                  "watsonx.data is the platform — the hero.[/dim]")
    _pause()

    # ── BEAT S2.2 — Architecture pullback ────────────────────────────────────
    _section("BEAT S2.2 — ARCHITECTURE PULLBACK",
             "watsonx.data at center | land-and-expand | the rest of the portfolio stays where it is")

    console.print(Panel(
        "[bold]What just happened:[/bold]\n\n"
        "1. 18+ sources. Different velocities, formats, owners.\n"
        "   [dim]The heterogeneity is real — that's why one warehouse-load script fails.[/dim]\n\n"
        "2. Live events (Slack, Salesforce CDC) streamed through Kafka →\n"
        "   dual-written to Cassandra [green](live now)[/green] AND Iceberg [blue](history always)[/blue].\n"
        "   [dim]Minutes of latency. Not a migration.[/dim]\n\n"
        "3. One Trino/watsonx.data query joins all three: live + history + Databricks Delta,\n"
        "   [bold yellow]in place — zero copy, zero migration.[/bold yellow]\n\n"
        "4. BIW keeps Databricks. IBM wins the integration and real-time layer.\n"
        "   [dim]Open formats. No exit tax. Land-and-expand.[/dim]\n\n"
        "[bold]Optional AI tier[/bold] (off by default — activate with WATSONX_AI_API_KEY):\n"
        "   watsonx Orchestrate → watsonx Discovery → watsonx.ai\n\n"
        "[dim italic]All event data synthetic (SEED=20260812). "
        "Runtime engines are real (or honestly labeled as fallback).[/dim italic]",
        title="BIW × IBM  |  Dual-Write Streaming Lakehouse", border_style="green"
    ))

    # Architecture ASCII block
    console.print()
    arch = """
  18+ SOURCES        KAFKA (IBM Confluent)    watsonx.data               COEXISTENCE
  ┌──────────┐  ①   ┌─────────────────┐  ②  ┌───────────────┐  ③live  ┌────────────────┐
  │Salesforce│──────▶│ biw.salesforce  │────▶│ Dual-write    │────────▶│ Cassandra      │
  │Slack     │──────▶│ biw.slack       │     │ consumer (B2) │         │ (IBM DataStax) │
  │Workday   │──────▶│ biw.batch       │     └──────┬────────┘         └───────┬────────┘
  │S3 drop   │──────▶│                 │            │ ③ history                │
  │+14 more  │       └─────────────────┘            ▼                          │ ④ zero-copy
  └──────────┘                              ┌───────────────┐                  │ join
                                            │ Iceberg/COS   │     ┌────────────▼──────────┐
                                            │ (watsonx.data)│────▶│ Trino / watsonx.data  │
                                            └───────────────┘     │ Presto federation     │◀──┐
                                                                   └────────────┬──────────┘   │
                                                                                │           ┌──┴──────────┐
                                                                                │           │ Databricks  │
  APP (thin, payoff)                                                            │           │ Delta (BIW) │
  ┌──────────────────────────────────────────────────────────────────────────── ▼ ─────────▶ query in    │
  │  Elevate (white-label) → Motivation Graph → personalized incentive          ⑤ serve     │ place only  │
  └─────────────────────────────────────────────────────────────────────────────────────────▶             │
                                                                                             └────────────┘
  (optional, off by default)  watsonx Orchestrate · watsonx Discovery · watsonx.ai
    """
    console.print(f"[dim]{arch}[/dim]")

    console.print(Panel(
        "[bold]The close:[/bold]\n\n"
        "[italic]Win the integration and real-time layer now.\n"
        "The rest of the portfolio stays where it is.[/italic]\n\n"
        "IBM wins:  Confluent · DataStax · watsonx.data · Presto federation\n"
        "BIW keeps: Databricks · Amazon · existing BI/ML\n"
        "[dim]A land-and-expand beachhead. Not rip-and-replace.[/dim]",
        border_style="yellow"
    ))


# ══════════════════════════════════════════════════════════════════════════════
# Build pipeline
# ══════════════════════════════════════════════════════════════════════════════

def run_build() -> None:
    """
    Build the v2 DataFabric pipeline.
    Steps:
      1. Reachability gate (Confluent, DataStax, Trino, Databricks, watsonx.data)
      2. Synthetic data generation (SEED=20260812)
      3. B5 nudge engine warm-up (SQL-rules pass — no graph, no networkx)
    """
    _section("PIPELINE BUILD",
             "Reachability → synthetic data → B5 nudge engine warm-up (SEED=20260812)")

    from ibm_services import IBMServiceManager

    service_manager = IBMServiceManager()
    reachability = service_manager.run_reachability_gate()
    console.print(f"[green]  ✓ Reachability report written ({len(reachability)} services)[/green]")

    # Use watsonx.data if configured, else local DuckDB
    try:
        con = service_manager.connect_watsonx_data()
        console.print("[green]  ✓ Using watsonx.data (Presto/Trino)[/green]")
    except Exception:
        import duckdb
        from config import DB_PATH
        con = duckdb.connect(DB_PATH)
        console.print("[dim]  (watsonx.data not reachable — using local DuckDB)[/dim]")

    from data.generator import generate
    generate(con)
    console.print("[green]  ✓ Synthetic data generated (SEED=20260812)[/green]")

    # Seed the databricks Iceberg namespace (OSS local mode)
    try:
        from streaming.setup_databricks import seed_databricks_namespace
        n = seed_databricks_namespace()
        console.print(f"[green]  ✓ Databricks namespace seeded — {n} synthetic Delta rows[/green]")
    except Exception as exc:
        console.print(f"[dim]  (Databricks seed skipped: {exc})[/dim]")

    # B5 warm-up: generate nudges for all foreground sellers (SQL-rules, no graph)
    from app.nudge import generate_all_nudges
    nudges = generate_all_nudges(con)
    console.print(f"[green]  ✓ B5 nudge engine ready — {len(nudges)} nudge(s) generated[/green]")

    if hasattr(con, "close"):
        con.close()

    console.print("\n[bold green]Pipeline build complete ✓[/bold green]\n")


# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# B8 — Console launcher
# ══════════════════════════════════════════════════════════════════════════════

def run_console(port: int = 5050, open_browser: bool = True) -> None:
    """
    B8: Launch the three-act demo console.
    Starts api.py on `port` in a background thread, then opens
    ui/console.html in the default browser.

    The console auto-polls /api/v2/sources every 5 s; inject buttons
    POST to /api/v2/events/inject and GET /api/v2/federation/b4.
    No terminal output appears in the recording path.
    """
    import os
    import subprocess
    import webbrowser

    _section("B8 — DEMO CONSOLE",
             f"Starting API on port {port} → opening ui/console.html")

    console_html = Path(__file__).parent / "ui" / "console.html"
    if not console_html.exists():
        console.print("[red]ERROR:[/red] ui/console.html not found — run build first.")
        return

    # ── Start API server in background ───────────────────────────────────────
    api_py = Path(__file__).parent / "api.py"
    env = os.environ.copy()
    env["FLASK_ENV"] = "production"

    console.print(f"[bold]Starting API server[/bold] on http://localhost:{port}…")
    server_proc = subprocess.Popen(
        [sys.executable, str(api_py)],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Brief pause for server startup
    time.sleep(2.5)

    # Verify server is up
    import urllib.request
    try:
        urllib.request.urlopen(f"http://localhost:{port}/health", timeout=5)
        console.print(f"[green]✓ API server ready at http://localhost:{port}[/green]")
    except Exception:
        console.print(f"[yellow]⚠ API server may still be starting — opening console anyway[/yellow]")

    # ── Open console in browser ───────────────────────────────────────────────
    console_url = console_html.as_uri()
    console.print(f"\n[bold]Opening console:[/bold] {console_url}")
    if open_browser:
        webbrowser.open(console_url)

    console.print(Panel(
        f"[bold]B8 Demo Console is live.[/bold]\n\n"
        f"  • Console: [cyan]{console_url}[/cyan]\n"
        f"  • API:     [cyan]http://localhost:{port}[/cyan]\n\n"
        f"[bold]Three-act flow:[/bold]\n"
        f"  Act 1 → The Tangle     (18+ live source tiles)\n"
        f"  Act 2 → The Unification (inject event → pipeline → federated result)\n"
        f"  Act 3 → The Payoff     (white-labeled Elevate nudge, provenance)\n\n"
        f"[dim italic]Press Ctrl+C to stop the API server.[/dim italic]",
        title="elevate® Demo Console — B8", border_style="purple"
    ))

    try:
        server_proc.wait()
    except KeyboardInterrupt:
        server_proc.terminate()
        console.print("\n[dim]API server stopped.[/dim]")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="BIW Motivation Graph — v2 DataFabric Demo Runner")
    p.add_argument("--build",   action="store_true", help="Rebuild data pipeline only")
    p.add_argument("--demo",    action="store_true", help="Run full demo (both segments)")
    p.add_argument("--seg1",    action="store_true", help="Run segment 1 only")
    p.add_argument("--seg2",    action="store_true", help="Run segment 2 only")
    p.add_argument("--console", action="store_true", help="Launch B8 three-act demo console (default entry point)")
    p.add_argument("--port",    type=int, default=5050, help="API server port (default 5050)")
    p.add_argument("--no-browser", action="store_true", help="Don't auto-open browser")
    args = p.parse_args()

    if args.build:
        run_build()
    elif args.seg1:
        run_segment_1()
    elif args.seg2:
        run_segment_2()
    elif args.demo:
        run_build()
        ctx = run_segment_1()
        run_segment_2(consumer=ctx.get("consumer"))
    elif args.console:
        run_console(port=args.port, open_browser=not args.no_browser)
    else:
        # Default: full build + demo (original behaviour preserved)
        run_build()
        ctx = run_segment_1()
        run_segment_2(consumer=ctx.get("consumer"))
