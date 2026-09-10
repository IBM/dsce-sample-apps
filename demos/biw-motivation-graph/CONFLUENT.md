# Confluent Cloud Integration

Cluster **cluster_biw** on GCP us-south1. All data is synthetic (SEED=20260812).

## Credentials

Store in `.env` at the repo root (already gitignored):

```
CONFLUENT_BOOTSTRAP_SERVERS=pkc-zgp5j7.us-south1.gcp.confluent.cloud:9092
CONFLUENT_SASL_USERNAME=<kafka-api-key>
CONFLUENT_SASL_PASSWORD=<kafka-api-secret>
CONFLUENT_SECURITY_PROTOCOL=SASL_SSL
CONFLUENT_SASL_MECHANISM=PLAIN
```

The Kafka API key (`ENL2WJA6ZLQBJVV7`) was created under **cluster_biw → API keys** with resource scope `lkc-38rzxdw`. The global API key (`NTKBYQFDBGXROSRE`) is for Confluent Cloud admin (CLI login) — it cannot produce/consume messages.

## Topics

| Topic | Source | Partition count |
|---|---|---|
| `biw.salesforce.cdc` | Salesforce opportunity + account CDC events | 3 |
| `biw.batch.ingest` | Workday employee records (nightly batch) | 3 |
| `biw.slack.events` | Teams messages, presence, reactions | 3 |

## Workflow

### 1. Regenerate source data (optional — files already committed)

```bash
cd motivation_graph
python3 data/generate_seller_json.py
```

Produces one JSONL file per source per persona under `data/sellers/`:

```
data/sellers/
  seller-rachel-001/
    seller-rachel-001_salesforce.jsonl
    seller-rachel-001_workday.jsonl
    seller-rachel-001_teams.jsonl
  seller-marcus-001/  ...
  seller-maya-001/    ...
```

### 2. Preview what will be sent

```bash
cd motivation_graph
python3 confluent_ingester.py --dry-run
```

### 3. Ingest to Confluent

```bash
python3 confluent_ingester.py
```

Single seller:

```bash
python3 confluent_ingester.py --seller seller-rachel-001
```

### 4. Verify in Confluent console

**cluster_biw → Topics → biw.salesforce.cdc → Messages**

Or via CLI (must be logged in with `./bin/confluent login --save`):

```bash
cd /path/to/BIW
./bin/confluent kafka topic consume biw.salesforce.cdc --from-beginning \
  --api-key ENL2WJA6ZLQBJVV7 \
  --api-secret <secret>
```

## Adding a new API key

```bash
./bin/confluent login --save
./bin/confluent environment use env-6651wj
./bin/confluent kafka cluster use lkc-38rzxdw
./bin/confluent api-key create --resource lkc-38rzxdw --description "your-description"
```

Update `.env` with the new key/secret.

## Re-creating topics (if cluster is reset)

```bash
./bin/confluent kafka topic create biw.salesforce.cdc --partitions 3
./bin/confluent kafka topic create biw.batch.ingest   --partitions 3
./bin/confluent kafka topic create biw.slack.events   --partitions 3
```
