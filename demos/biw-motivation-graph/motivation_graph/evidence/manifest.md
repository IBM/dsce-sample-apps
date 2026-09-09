# Evidence Manifest — BIW Motivation Graph v2 DataFabric

**Spec §:** Hardening Addendum §7 (evidence manifest)  
**Generated:** 2026-07-31  
**Seed:** SEED=20260812 (all synthetic data byte-identical on re-run)

---

## Per-Product Evidence

### IBM Confluent (Apache Kafka) — B1

- **Endpoint:** `localhost:9092` (OSS: confluentinc/cp-kafka:7.9.0)
- **IBM product:** IBM Confluent managed Kafka
- **Topics created:** biw.salesforce.cdc, biw.slack.events, biw.batch.ingest (3 partitions each)
- **Live sources:** Salesforce CDC and Slack events inject to Kafka on camera (B1 beat)
- **Evidence:** 4 topics visible via AdminClient; injected Slack event consumed within 4 seconds
- **Query history:** `evidence/kafka_producer.log` (written by streaming/producer.py)

### IBM DataStax Enterprise (Apache Cassandra) — B2

- **Endpoint:** `localhost:9042` (OSS: cassandra:5.0)
- **IBM product:** IBM DataStax Enterprise (DSE)
- **Keyspace:** `biw_live`
- **Table:** `biw_live.biw_live_events` (8+ rows confirmed after B2 test)
- **Driver version:** cassandra-driver 3.30.1
- **Evidence:** `SELECT release_version FROM system.local` → `5.0.8`
- **Dual-write proof:** one consume → `cassandra_ok=True` AND `iceberg_ok=True` in same record

### watsonx.data / IBM Iceberg REST (MinIO + tabulario/iceberg-rest) — B2 + B3

- **MinIO endpoint:** `localhost:18002` (OSS: minio/minio) — host port remapped from 9000 (occupied)
- **Iceberg REST endpoint:** `localhost:8181` (OSS: tabulario/iceberg-rest:1.6.0)
- **Warehouse:** `s3://biw-lakehouse/warehouse`
- **Namespace:** `biw`
- **Table:** `biw.live_events` (2+ rows confirmed after B2 test)
- **IBM product:** watsonx.data object storage (IBM COS) + Iceberg catalog service
- **Evidence:** Table created at `s3://biw-lakehouse/warehouse/biw/live_events/metadata/00000-*.metadata.json`
- **Query history:** `evidence/watsonxdata_queries.log`

### Trino / watsonx.data Presto Engine — B3 + B4

- **Endpoint:** `localhost:8090` (OSS: trinodb/trino:476) — host port remapped from 8080 (occupied)
- **IBM product:** watsonx.data Presto query engine
- **Catalogs loaded:** cassandra, iceberg, databricks, system
- **B3 query:** `SELECT ... FROM cassandra.biw_live.biw_live_events FULL OUTER JOIN iceberg.biw.live_events` → 9 rows
- **B4 query:** Three-way join: live + history + databricks.databricks.seller_history → 20 rows, `databricks_read_mode='query-in-place'`
- **Evidence:** `trino --server localhost:8090 --execute "SHOW CATALOGS"` → cassandra, databricks, iceberg, system

### Databricks Delta Interop — B4 (OSS local mode)

- **Endpoint:** `localhost:8181/databricks` Iceberg REST namespace
- **IBM product:** watsonx.data Trino federation reading Databricks Delta via open Iceberg interop
- **Table:** `databricks.seller_history` (20 synthetic Delta-shaped rows, SEED=20260812)
- **Warehouse:** `s3://biw-lakehouse/databricks` (separate from iceberg warehouse)
- **Evidence:** Trino reads `databricks.databricks.seller_history` — `No copy, no migration, query-in-place`
- **Real Databricks mode:** Set `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_ICEBERG_REST_URI` in `.env`, update `trino-config/catalog/databricks.properties`

---

## Simulation Disclosure

Per Hardening Addendum §2 and spec §10:

| Component | Status |
|-----------|--------|
| All event data (Salesforce CDC, Slack, Workday, etc.) | 100% SYNTHETIC (SEED=20260812) |
| Kafka broker | Real engine (confluentinc/cp-kafka:7.9.0) |
| Cassandra cluster | Real engine (cassandra:5.0) |
| MinIO object storage | Real engine (minio/minio) |
| Iceberg REST catalog | Real engine (tabulario/iceberg-rest:1.6.0) |
| Trino query engine | Real engine (trinodb/trino:476) |
| Databricks Delta data | SYNTHETIC in local Iceberg namespace (real engine reads it) |
| IBM Cloud endpoints | Available but enterprise auth session needs refresh for full demo |

Every number displayed in the seller-facing UI carries a persistent **"Simulated"** label.
IBM branding does not appear in the seller-facing (`app.html`) interface.

---

## File Artifacts

```
evidence/
├── reachability_report.md    — Phase 0 gate results (this session: 2026-07-31)
├── manifest.md               — this file
├── iceberg_fallback.jsonl    — fallback Iceberg JSONL (used when pyiceberg is unavailable)
└── watsonxdata_queries.log   — query history from IBMServiceManager (written at runtime)
```

---

*Scope decisions: Databricks uses local Iceberg REST namespace in OSS mode. Real Databricks interop requires Unity Catalog Iceberg REST endpoint — swap `trino-config/catalog/databricks.properties` per MIGRATION_NOTES.md.*
