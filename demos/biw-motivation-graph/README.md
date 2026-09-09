# BIW Data Platform Demo — Project README

**BI Worldwide × IBM · Build Engineering AMER**
**Demo date:** August 12, 2026
**Owner:** Build Engineering, IBM AMER

> All data in this repository is 100% synthetic and seeded (`SEED=20260812`). No real or client data is present anywhere in the pipeline. Synthetic describes the *rows* — the engines processing them are real.

> **Quick start for pushing data:** See [`CONFLUENT_QUICK_START.md`](CONFLUENT_QUICK_START.md) — one-page guide to ingest synthetic data into IBM Confluent Cloud.

> **Build status:** v1 is deleted and the v2 data-fabric pipeline is built (generator, streaming dual-write, Databricks federation, provenance nudge, `api.py`, `demo_runner.py`). **One task remains — B8, the Demo Console** (unify the acts, build Act 2's federation theater, restyle to Elevate). See [`BIW_Motivation_Graph_BOB_ConsoleUI_Prompt.md`](BIW_Motivation_Graph_BOB_ConsoleUI_Prompt.md); design target is [`elevate_demo_console_mockup.html`](elevate_demo_console_mockup.html). The earlier `BIW_Motivation_Graph_BOB_v2_Migration_Prompt.md` (delete-v1 + build-v2) is **complete/superseded**.

---

## Overview

This repository contains the **BIW Data Platform demo** — a working pipeline whose hero is BIW's **data-integration problem**: 18+ heterogeneous sources (real-time streams, CDC feeds, nightly batch, files, and an existing Databricks lakehouse) unified into **one open lakehouse** that can be queried across all of them in seconds, **without ripping out the tools BIW already runs**.

A seller motivation/nudge is the visible payoff at the end, but the platform underneath is the point. The demo proves the data-portfolio argument by making it *run*, not by asserting it on a slide.

> **"Motivation Graph" is conceptual naming** from BIW's design-thinking work. The demo leads with the data layer; the app on top is a thin lens, and **no graph is built** (no graph database, no `networkx`). The data-integration platform is what is being sold.

---

## What the demo proves

1. **BIW's data is genuinely hard — 18+ sources, many velocities.** Shown on a live control view, not asserted.
2. **watsonx.data unifies live + history as one open lakehouse.** Streamed events are dual-written to Cassandra (live "now") and Iceberg (full "always"); one Trino/Presto query joins them **zero-copy**.
3. **It coexists with Databricks — no rip-and-replace.** The same federation reaches BIW's Databricks Delta tables **in place**, zero copy. *This is the commercial thesis.*
4. **The unified data drives a real outcome.** A personalized nudge that visibly depends on ≥3 unified sources.

---

## Architecture — dual-write streaming lakehouse

```
 18+ SOURCES        INGESTION         DATA PLATFORM (watsonx.data)              COEXISTENCE       APP (thin)
 Salesforce/CDC  ─▶            ┌─▶ Cassandra (live state) ─┐
 Slack/stream    ─▶  Kafka  ─▶ │                           ├─▶ Trino/Presto ─▶ Databricks   ─▶  Motivation
 Workday/batch   ─▶ (Confluent)│    dual-write consumer    │   zero-copy        Delta (BIW,       nudge
 file drops      ─▶            └─▶ Iceberg on COS (history)─┘   federation       read in place)    (Elevate)
 …14 more        ─▶
                     (optional, off by default) AI tier: Orchestrate · watsonx Discovery · watsonx.ai
```

Every open-source engine the demo runs on **is** the engine inside its IBM product. Build on OSS locally; provision the IBM-managed version for the boxes shown on camera.

| Layer | Open source (build on) | IBM enterprise product |
|---|---|---|
| Streaming ingestion | Apache Kafka | **IBM Confluent** |
| Operational live state | Apache Cassandra | **IBM DataStax Enterprise** |
| Lakehouse (history) | Apache Iceberg on object store | **watsonx.data lakehouse** (Iceberg on IBM COS) |
| Federation / query | Trino | **watsonx.data (Presto)** |
| Coexistence | Delta read in place via Iceberg interop | Databricks (BIW keeps) |
| *Optional* retrieval | OpenSearch | **watsonx Discovery** |
| *Optional* generation | Ollama · llama3.2 | **watsonx.ai (BYOM)** |
| *Optional* flow/agents | Langflow | **watsonx Orchestrate / ADK** |
| Consumer UI | your app | Elevate (white-labeled) |

See [`motivation_graph_architecture_v2_datafabric.html`](motivation_graph_architecture_v2_datafabric.html) for the interactive diagram.

---

## Repository structure (v2 target)

```
.
├── EXECUTIVE_SUMMARY.md                                  # One-page leadership brief (v2)
├── README.md                                             # This file
├── BIW_Engagement_Brief.md                               # Standing account context — read first
├── BIW_Motivation_Graph_Demo_Build_Spec_v2_DataFabric.md # The build specification
├── BIW_Motivation_Graph_BOB_Hardening_Addendum.md        # Real-vs-simulated enforcement (governs the build)
├── BIW_Motivation_Graph_BOB_ConsoleUI_Prompt.md         # ACTIVE task sent to BOB — build the Demo Console (B8)
├── BIW_Motivation_Graph_BOB_v2_Migration_Prompt.md       # Delete-v1 + build-v2 task (complete/superseded)
├── elevate_demo_console_mockup.html                      # Elevate-style Demo Console mockup — the UI design target
├── motivation_graph_architecture_v2_datafabric.html      # Interactive architecture diagram
│
└── motivation_graph/                        # Runnable pipeline
    ├── config.py                            # Environment / credential config
    ├── ibm_services.py                      # Clients: Confluent(Kafka), DataStax(Cassandra), watsonx.data(Trino), Databricks interop
    ├── docker-compose.yml                   # Local OSS: Kafka, Cassandra, Trino, MinIO (Iceberg)
    ├── demo_runner.py                       # Scripted end-to-end playback (B7)
    ├── run.sh                               # Single-command launcher
    ├── requirements.txt
    │
    ├── generator/                           # Synthetic 18-source data generator (seeded)
    ├── streaming/
    │   ├── producer.py                      # 18+ sources → Kafka (Salesforce CDC, Slack, …)   [B1]
    │   ├── dual_write_consumer.py           # Kafka → Cassandra (live) + Iceberg (history)      [B2]
    │   └── federation.py                    # Trino zero-copy join incl. Databricks in place    [B3, B4]
    ├── control_view/                        # 18-source data-complexity dashboard logic         [B6]
    ├── app/
    │   ├── nudge.py                         # Thin motivation/nudge lens — NO graph              [B5]
    │   └── actions.py                       # Actionable tasks + Salesforce/Slack payloads      [B5b]
    ├── ui/
    │   ├── control_view.html                # Live source-status dashboard
    │   ├── app.html                         # White-labeled nudge experience (no IBM marks)
    │   ├── console.html                     # 3-act demo console (Act 3 hosts the seller view)
    │   ├── seller.html                      # Seller-persona view — served at /seller
    │   └── seller_surfaces.{css,js}         # Salesforce + Slack surface renderers (shared)
    ├── trino-config/                        # Trino catalogs: iceberg, cassandra, databricks
    ├── evidence/                            # reachability_report.md, manifest.md, query logs, traces
    └── tests/
        └── test_pipeline.py
```

---

## Pipeline components

Built in this order (see spec §5). Each has acceptance criteria; all "real" products obey the Hardening Addendum.

| ID | Component | What it does |
|---|---|---|
| **G** | Synthetic source generator | Seeded generator for 18+ sources across every velocity/format (`SEED=20260812`); byte-identical on re-run |
| **B1** | Ingestion backbone | 18+ sources publish onto Kafka (≥3 topics); Salesforce CDC + Slack are the live ones |
| **B2** | Stream processor (dual-write) | One consumer writes each event twice: **Cassandra** (live state) + **Iceberg** (history) |
| **B3** | Zero-copy federation | Trino/Presto joins live (Cassandra) + history (Iceberg) in one SQL statement, no copy |
| **B4** | Databricks coexistence | Same Trino node adds BIW's **Databricks Delta in place** via Iceberg interop — the money shot |
| **B5** | Intelligent payoff layer | Unified data → rule-based selection + watsonx.ai nudge copy (pinned), with a **"Why this?" provenance** panel citing ≥3 sources. Implementation-agnostic; **no graph** |
| **B6** | Data-complexity control view | All 18+ sources: velocity, format, last-landed, row count, status (live/batch/federated) — Act 1 of the console |
| **B7** | Demo runner | Scripted playback with on-camera event injection and the B4 join; drives the console; deterministic for clean capture |
| **B8** | Demo Console UI | The exec surface, three acts — Act 1 control view · Act 2 live federation theater (event injection + zero-copy Databricks badge) · Act 3 white-labeled nudge with provenance. **No terminal output on camera** |

watsonx.ai is **baked in** for the Act-3 nudge copy (the exec payoff). A *fuller* RAG tier (Orchestrate → watsonx Discovery) remains optional and off by default.

---

## Prerequisites

- Python 3.11+, Docker (local OSS stack)
- Access to the IBM services below (credentials in environment variables — never committed)

### Required environment variables

```bash
# IBM Confluent (Kafka)
KAFKA_BOOTSTRAP_SERVERS=<host:port>
KAFKA_API_KEY=<key>
KAFKA_API_SECRET=<secret>

# IBM DataStax Enterprise (Cassandra)
CASSANDRA_CONTACT_POINTS=<host>
CASSANDRA_KEYSPACE=<keyspace>
CASSANDRA_USER=<user>
CASSANDRA_PASSWORD=<password>

# watsonx.data (Trino/Presto + object storage)
WATSONX_DATA_HOST=<host>
WATSONX_DATA_PORT=8443
WATSONX_DATA_USER=<user>
WATSONX_DATA_CATALOG=<catalog>
WATSONX_DATA_SCHEMA=<schema>
COS_ENDPOINT=<s3-compatible-endpoint>
COS_BUCKET=<bucket>

# Databricks interop (query-in-place)
DATABRICKS_ICEBERG_CATALOG_URI=<unity-catalog-iceberg-rest-or-uniform-endpoint>
DATABRICKS_TOKEN=<read-token>
```

Store these in a `.env` file at the repo root (`.env` is `.gitignore`d). For local development the OSS equivalents (Kafka, Cassandra, Trino, Iceberg+MinIO) come up via `docker compose`.

---

## ⚡ Live Streaming Demo (client-facing real-time showcase)

The cleanest way to show a client Confluent's real-time streaming capability:

```bash
cd motivation_graph
python3 -m streaming.demo_launcher
```

That single command:
1. Starts the Flask API on port 5050 (threaded, SSE-ready)
2. Opens `ui/live_demo.html` in your browser automatically
3. Streams Salesforce CDC + Teams + Workday events to Confluent Kafka continuously
4. The browser dashboard updates **instantly** via Server-Sent Events — no polling, no refresh

**What the client sees in the dashboard:**
- A dark real-time feed where event cards appear and animate as they land
- Per-source counters (Salesforce / Workday / Teams) ticking up live
- Each event showing dual-write status: ✓ Cassandra + ✓ Iceberg
- Events-per-second meter and live latency display
- Pipeline health panel confirming Confluent is connected

**Demo options:**

```bash
# Run for 5 minutes at 2 events/second (recommended for a client call)
python3 -m streaming.demo_launcher --duration 300 --hz 2

# No Confluent credentials? Use in-memory fallback — works identically in the browser
python3 -m streaming.demo_launcher --dry-run

# Fire a single on-camera injection (for a precise live moment)
python3 -m streaming.demo_launcher --inject --seller seller-rachel-001

# Just the producer side (if API is already running)
python3 -m streaming.enhanced_producer --mode demo --demo-duration 120 --demo-frequency 2
```

**Three-terminal setup (maximum visibility on camera):**

```
Terminal 1 — API server:
  cd motivation_graph && python3 api.py

Terminal 2 — continuous producer:
  cd motivation_graph && python3 -m streaming.enhanced_producer --mode demo --demo-duration 300

Terminal 3 — watch terminal output in sync with browser:
  cd motivation_graph && python3 -m streaming.live_watcher
```

Open `motivation_graph/ui/live_demo.html` in your browser. All three terminal streams and the browser dashboard update from the same SSE connection.

---

## Quickstart

```bash
cd motivation_graph
pip install -r requirements.txt
docker compose up -d                 # local Kafka, Cassandra, Trino, MinIO
```

**Phase 0 — reachability gate (run before building anything):**

```bash
python -c "from ibm_services import reachability_check; reachability_check()"
```

Probes Confluent, DataStax, watsonx.data, and the Databricks interop; writes `evidence/reachability_report.md`. Any `reachable: no` service is escalated — **never** silently swapped for a local substitute (Hardening Addendum §1).

**Generate data and run the demo:**

```bash
python -m generator --seed 20260812
bash run.sh
```

`run.sh` executes `demo_runner.py`: generate → produce to Kafka → dual-write → federate (incl. Databricks in place) → serve the nudge → render control view. Then open `ui/control_view.html` and `ui/app.html`.

---

## Evidence and compliance

Every product claim is backed by a verifiable artifact. After a run, `evidence/manifest.md` must show a real-service artifact for every product scoped "real":

| Service | Required artifact |
|---|---|
| IBM Confluent (Kafka) | Topic + a consumer/offset record showing the demo's events |
| IBM DataStax (Cassandra) | Keyspace/table + the live-state row written from a streamed event |
| watsonx.data (Trino/Iceberg) | Engine query-history log showing the federated demo SELECTs |
| Databricks interop | Query result proving the Delta table was read **in place** (not copied) |

A demo is not "done" until the manifest is complete. Any component reaching a local substitute without a recorded human decision is non-compliant per the [Hardening Addendum](BIW_Motivation_Graph_BOB_Hardening_Addendum.md).

---

## What not to build / guardrails

- **No rip-and-replace framing.** The win is coexistence; never imply BIW should drop Databricks/Snowflake/Redshift.
- **No copying Databricks data.** B4 is query-in-place. A copy turns the pitch into migration — the opposite of the story.
- **No closed-format lock-in messaging.** Open (Iceberg, multi-engine, multi-cloud) is the differentiator vs. Databricks and Amazon.
- **No graph.** "Motivation Graph" is conceptual naming. No graph database, no `networkx` — the app is a thin lens over the unified data.
- **No faked real-time.** The Kafka → dual-write path is genuinely real-time on camera, or honestly narrated as simulated.
- **Don't build 18 real connectors.** 5 sources live, the rest as pipeline definitions / generated background.
- The AI/payoff layer is baked in but **provenance-forward** — every nudge shows its unified sources, so it serves the data story rather than competing with it.
- **The demo runs through the Console (B8), never the terminal.** IBM branding does not appear in the seller-facing Act 3. Every frame showing a number carries a persistent "Simulated" label.

---

## The nudge payoff (thin app)

The app is a thin lens whose only job is to make the data-integration value legible. It produces a personalized nudge for one seller that visibly draws on multiple unified sources — e.g., a Salesforce deal (CDC/live) + a Slack recognition (stream/live) + a historical performance metric (Databricks, federated). Personas (Rachel, Marcus, Maya) from BIW's `Seller Profiles` deck may be used to make the nudge concrete, but they are **not** the focus and no persona-discovery or graph logic is built.

---

## Seller-persona delivery — Salesforce, Slack and BluePoints

The nudge answers *why should I care*; the action list answers *what do I do next*. `app/actions.py` turns each nudge into the tasks that close the seller's gap, and renders them into the three surfaces sellers already work in.

* **Points always close the gap.** Each seller's tasks sum to exactly their `points_to_go` (Rachel 800 · Marcus 1,600 · Maya 2,100), so the goal is never out of reach. Enforced by `TestB5b_ActionPlan::test_tasks_sum_to_the_gap`.
* **Every task cites its signal.** Each carries the `why` and the source that produced it (Salesforce CDC live, Slack Events live, or Databricks read in place) — the platform's reasoning, not a generic to-do list.
* **One payload, three surfaces.** All render from the same `/api/actions/<seller_id>` response.

**The three surfaces**

| Channel | How the nudge arrives |
|---|---|
| `salesforce` | Lightning component on the home page + bell/custom notification |
| `slack` | Block Kit DM from the Elevate app, one button per task |
| `bluepoints` | **Thanks@IBM** — the live Elevate deployment. The nudge is a home card and each task is a **Challenge** awarding **BluePoints**. |

BluePoints is the program's own surface, so the nudge isn't a notification — it *is* content, sitting alongside My Personal Balance, the marketplaces and the Recognition Feed, with the open task count on the Challenges nav item.

**Where to see it**

| Surface | URL |
|---|---|
| Standalone seller view | `http://localhost:5050/seller` (`?seller=…&channel=bluepoints`) |
| Inside the demo console | `/console` → Act 3 → *Where the nudge lands* |

**Endpoints**

| Endpoint | Purpose |
|---|---|
| `GET  /api/actions/<seller_id>` | Action plan + goal progress + embedded nudge |
| `POST /api/actions/<seller_id>/complete` | Mark one task done (in-memory demo state) |
| `POST /api/actions/<seller_id>/reset` | Clear completion state between runs |
| `GET  /api/actions/<seller_id>/payload/<channel>` | The exact JSON that ships to `salesforce` \| `slack` \| `bluepoints` |
| `POST /api/actions/<seller_id>/deliver` | Send it — preview-only unless credentials are set |

**Real delivery (optional).** Nothing is posted to a live workspace by default. `deliver` only sends when the channel's credentials are present, so what the demo shows is exactly what would ship:

| Variable | Channel |
|---|---|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook |
| `SF_NOTIFICATION_URL` + `SF_ACCESS_TOKEN` | Salesforce CustomNotification API |
| `ELEVATE_API_URL` + `ELEVATE_API_KEY` | Thanks@IBM (Elevate) nudge/challenge API |
| `SF_INSTANCE_URL` | Org base URL for Lightning deeplinks (default `https://biw-sales.lightning.force.com`) |
| `ELEVATE_PROGRAM` / `ELEVATE_CURRENCY` | Program and currency names (default `Thanks@IBM` / `BluePoints`) |

---

## Running tests

```bash
cd motivation_graph
pytest tests/test_pipeline.py -v
```

---

## Key documents

| Document | Purpose |
|---|---|
| [`BIW_Engagement_Brief.md`](BIW_Engagement_Brief.md) | Standing account context — read before any new session |
| [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) | One-page leadership brief (v2) |
| [`BIW_Motivation_Graph_Demo_Build_Spec_v2_DataFabric.md`](BIW_Motivation_Graph_Demo_Build_Spec_v2_DataFabric.md) | The build specification (data-integration / coexistence) |
| [`BIW_Motivation_Graph_BOB_Hardening_Addendum.md`](BIW_Motivation_Graph_BOB_Hardening_Addendum.md) | Real-vs-simulated enforcement; governs the build |
| [`BIW_Motivation_Graph_BOB_ConsoleUI_Prompt.md`](BIW_Motivation_Graph_BOB_ConsoleUI_Prompt.md) | **Active** BOB task — build the Demo Console (B8) |
| [`elevate_demo_console_mockup.html`](elevate_demo_console_mockup.html) | Elevate-style Demo Console mockup — the UI design target |
| [`BIW_Motivation_Graph_BOB_v2_Migration_Prompt.md`](BIW_Motivation_Graph_BOB_v2_Migration_Prompt.md) | Delete-v1 + build-v2 task (complete/superseded) |
| [`motivation_graph_architecture_v2_datafabric.html`](motivation_graph_architecture_v2_datafabric.html) | Interactive architecture diagram |

---

## People

| Role | Team |
|---|---|
| Build Engineering owner | IBM AMER |
| Account narrative and strategic framing | IBM |
| Scheduling and executive engagement | IBM |
| BIW incentive-design context | BIW |
| Build team | IBM |
| Confluent coordination | Confluent |
| Confluent/Kafka technical education | Confluent |

---

*BI Worldwide × IBM · Data-fabric cut · SEED=20260812 · synthetic data · zero-copy coexistence*
