# Executive Summary — BIW Data Platform Demo
**BI Worldwide × IBM · August 12, 2026 Leadership Session**
**Owner:** Build Engineering AMER, IBM

---

## What This Is

A working demo whose hero is **BIW's data-integration problem**: 18+ heterogeneous sources — some real-time, some batch, some sitting in another vendor's lakehouse — unified into one open lakehouse that answers questions across all of them in seconds, **without ripping out the tools BIW already runs**.

A seller motivation/nudge is the visible payoff at the end, but the platform underneath is the point. It is not a slide deck: it is a running pipeline — synthetic data, real engines, recorded to video — that makes the data-portfolio argument true rather than asserted.

> *"Motivation Graph" is BIW's conceptual name for the application idea. Technically the demo leads with the data layer; the app on top is a thin lens, and no graph is built. The data-integration platform is what is being sold.*

---

## What It Proves

**1. BIW's data is genuinely hard — 18+ sources, many velocities.**
Salesforce (CDC), Slack (real-time), Workday (nightly batch), file drops, a Databricks table, and a dozen more SaaS systems — each arriving a different way. The demo *shows* this heterogeneity on a live control view, rather than asserting it.

**2. watsonx.data unifies live + history as one open lakehouse.**
Streamed events are dual-written to an operational store (Cassandra — the "now") and to the Iceberg lakehouse (the "always"). A single Trino/Presto query joins them **zero-copy**. Minutes of latency, not a warehouse migration.

**3. It coexists with Databricks — no rip-and-replace. (The commercial thesis.)**
The same federation that joins live + history also reaches **BIW's Databricks Delta tables in place**, over open Iceberg formats, with zero copy. IBM wins the integration, streaming, and serving layers; the incumbent keeps the rest.

**4. The unified data drives a real outcome.**
A personalized seller nudge is produced from signals that visibly came from three or more different sources — making the value of unification legible in one frame.

---

## What Is Demonstrated

**Segment 1 — the problem, made visible (~3.5 min).** Open on the 18-source control view. Inject a live Slack event and a Salesforce change on camera; watch them flow through Kafka → dual-write into Cassandra (live) *and* Iceberg (history) → queryable in seconds. Run one query that unites live + history. Then the money shot: the same query reaches into **Databricks in place** and joins it — no copy, no migration.

**Segment 2 — the payoff + the platform (~2 min).** The unified data drives the seller nudge; pull back to the architecture with watsonx.data at the center. An optional AI tier (retrieval + generation) is shown briefly, off by default.

**The build is real, not simulated.** Each open-source engine the demo runs on *is* the engine inside its IBM product — Kafka **is** IBM Confluent, Cassandra **is** IBM DataStax Enterprise, Iceberg + Trino **is** watsonx.data. Data is 100% synthetic and seeded; the engines processing it are real, with evidence captured per the reachability gate.

---

## The Commercial Thesis

A **land-and-expand** motion. BIW has already chosen Databricks and Amazon for parts of their stack. The demo does not fight that choice — it monetizes it. watsonx.data federates *over* the incumbents via open formats, landing IBM in the integration, streaming, and serving layers without a rip-and-replace. Open table formats (Iceberg, multi-engine, multi-cloud) are the differentiator against both Databricks (Delta lock-in) and Amazon (Redshift/Glue/Kinesis lock-in): nothing BIW puts in is ever trapped.

The 18-source integration problem is the beachhead. Winning it opens the path to the broader data portfolio — and to the outcome-based-pricing/measurement conversation that a unified, governed data layer eventually makes possible.

---

## Competitive Frame

| Incumbent | What BIW keeps | Where IBM wins the building block |
|---|---|---|
| **Databricks** | Delta Lake, data science, existing BI/ML | 18-source integration, real-time streaming, live+history federation, low-cost serving — Databricks read **in place**, zero copy |
| **Amazon** | S3 storage, AWS-native pipelines | Open, multi-cloud lakehouse that runs *on* their AWS without locking them to Redshift/Glue/Kinesis |

---

## Audience and Use

**Primary audience:** Biz (VP Build Americas) + BIW executive team, August 12, 2026.
**Format:** Recorded video, two segments (~5–6 min total).
**Role:** Evidence that makes the recommended data-platform architecture concrete rather than a blueprint — a step toward the renewal conversation, not a standalone showcase.

---

## Key Guardrails

- All data is synthetic, seeded (`SEED=20260812`), and labeled as such in every frame showing a number.
- **No rip-and-replace framing.** The win is coexistence; never imply BIW should drop Databricks, Snowflake, or Redshift.
- **Databricks data is read in place, never copied.** A copy turns the pitch into migration — the opposite of the story.
- **Open formats are the message.** Do not demo a proprietary/lock-in path.
- **"Motivation Graph" is conceptual naming.** No graph database and no graph library are built; the app is a thin lens over the unified data.
- The real-time streaming path is genuinely real-time on camera, or it is honestly narrated as simulated — never faked.
- The AI tier stays thin and off by default; it is not the focus.
- IBM branding does not appear in the seller-facing segment.

---

*BI Worldwide × IBM · Data-fabric cut · SEED=20260812 · synthetic data · zero-copy coexistence*
