# Confluent Cloud — Quick Start Guide

**IBM Confluent Cluster:** `cluster_biw` (GCP us-south1)  
**All data is synthetic** (SEED=20260812)

---

## ✓ Prerequisites Met

✅ Confluent Cloud cluster configured  
✅ 3 Kafka topics created with 3 partitions each  
✅ API credentials stored in `.env` (gitignored)  
✅ Ingestion script ready to run  
✅ Network connectivity verified  

---

## 1. Push Data to Confluent (30 seconds)

### All Sellers
```bash
cd BIW-motivation-graph/motivation_graph
python3 confluent_ingester.py
```

### Single Seller
```bash
python3 confluent_ingester.py --seller seller-rachel-001
```

### Preview First (Recommended)
```bash
python3 confluent_ingester.py --dry-run
```

---

## 2. What Gets Sent

| Seller | Salesforce | Workday | Teams | Total |
|--------|-----------|---------|-------|-------|
| **rachel-001** | 8 events | 2 events | 10 events | 20 |
| **marcus-001** | 9 events | 2 events | 8 events | 19 |
| **maya-001** | 9 events | 1 event | 4 events | 14 |
| **TOTAL** | **26** | **5** | **22** | **53** |

### Topics
- `biw.salesforce.cdc` — Salesforce opportunity + account changes
- `biw.batch.ingest` — Workday nightly batch + file drops
- `biw.slack.events` — Teams/Slack real-time events

---

## 3. Verify Data Arrived

### Option A: Confluent Cloud Console (Easiest)
1. Go to **cluster_biw** → **Topics** → **biw.salesforce.cdc**
2. Click **Messages** tab
3. Watch events appear in real-time

### Option B: CLI
```bash
cd BIW-motivation-graph
./bin/confluent kafka topic consume biw.salesforce.cdc --from-beginning \
  --api-key ENL2WJA6ZLQBJVV7 \
  --api-secret <your-secret>
```

### Option C: Python Consumer
```bash
python3 streaming/consumer.py
```

---

## 4. Environment Setup

Your credentials are already configured in `.env`:

```
CONFLUENT_BOOTSTRAP_SERVERS=pkc-zgp5j7.us-south1.gcp.confluent.cloud:9092
CONFLUENT_SASL_USERNAME=ENL2WJA6ZLQBJVV7
CONFLUENT_SASL_PASSWORD=cfltALSQrWNeYEx21FhDc8Gmljot1qsVAYN0kmPRCNk+0tNQNjYv44CvPxW5KmhQ
CONFLUENT_SECURITY_PROTOCOL=SASL_SSL
CONFLUENT_SASL_MECHANISM=PLAIN
```

**Note:** `.env` is gitignored — credentials are never committed.

---

## 5. Add New API Key (If Needed)

```bash
./bin/confluent login --save
./bin/confluent environment use env-6651wj
./bin/confluent kafka cluster use lkc-38rzxdw
./bin/confluent api-key create --resource lkc-38rzxdw --description "new-key"
```

Update `.env` with the new key/secret.

---

## 6. Regenerate Fresh Data

To create new synthetic data with the same seed:

```bash
cd BIW-motivation-graph/motivation_graph
python3 data/generate_seller_json.py
```

Then ingest:
```bash
python3 confluent_ingester.py
```

---

## 7. Key Facts

- **Safe to re-run:** Running the ingester multiple times appends data (no deduplication)
- **Deterministic:** SEED=20260812 produces identical data on re-run
- **Timeout:** Producer waits up to 30s for Confluent to acknowledge delivery
- **Dependencies:** `confluent-kafka==2.8.0` or `kafka-python==2.0.5` (installed via `requirements.txt`)

---

## 8. Troubleshooting

**Data doesn't appear after 30 seconds?**
1. Verify `.env` credentials (API key may have expired)
2. Test network: `ping pkc-zgp5j7.us-south1.gcp.confluent.cloud`
3. Check Confluent Cloud console for cluster alerts
4. Run dry-run: `python3 confluent_ingester.py --dry-run`
5. Check stderr for SASL auth errors

**Need to reset topics?**
```bash
./bin/confluent kafka topic delete biw.salesforce.cdc
./bin/confluent kafka topic delete biw.batch.ingest
./bin/confluent kafka topic delete biw.slack.events

./bin/confluent kafka topic create biw.salesforce.cdc --partitions 3
./bin/confluent kafka topic create biw.batch.ingest --partitions 3
./bin/confluent kafka topic create biw.slack.events --partitions 3
```

---

## 9. Reference

- **Full setup details:** See [`CONFLUENT.md`](CONFLUENT.md)
- **Project README:** See [`README.md`](README.md)
- **Ingestion script:** [`motivation_graph/confluent_ingester.py`](motivation_graph/confluent_ingester.py)
- **Producer code:** [`motivation_graph/streaming/producer.py`](motivation_graph/streaming/producer.py)
- **Consumer code:** [`motivation_graph/streaming/consumer.py`](motivation_graph/streaming/consumer.py)

---

**Ready to go!** Run `python3 confluent_ingester.py` in `motivation_graph/` directory.
