# Supply Chain Risk Control Tower — Carbon UI

A self-contained IBM Carbon Design dashboard with two modes:

| Mode | What runs | Kafka needed? |
|------|-----------|---------------|
| **Simulation** | In-browser JS engine, identical logic to `code/scrc/risk_logic.py` | No |
| **Live Kafka** | `kafka_bridge.py` connects to real Confluent Cloud topics via SSE | Yes |

---

## Simulation mode (no Kafka)

```bash
# Open directly in browser — no server needed
open code/ui/index.html

# Or serve locally
python -m http.server 8080 --directory code/ui
# → http://localhost:8080
```

Click **Start Simulation** on the Control Tower page. Events are generated in-browser, risk is scored identically to the Python engine, and all charts and cards update in real time.

---

## Live Kafka mode

### Step 1 — Provision infrastructure and write .env

```bash
./scripts/setup.sh --auto-approve
```

Your `.env` must have `CONFLUENT_BOOTSTRAP_SERVERS`, `CONFLUENT_API_KEY`, and `CONFLUENT_API_SECRET` set. `setup.sh` does this automatically.

### Step 2 — Activate virtual environment

```bash
source .venv/bin/activate          # Linux / macOS
.venv\Scripts\activate             # Windows
```

### Step 3 — Start the bridge

```bash
python code/ui/kafka_bridge.py
```

Expected output:
```
[bridge] Project root : /path/to/supply-chain-risk-control-tower
[bridge] Python       : /path/to/.venv/bin/python
[bridge] Starting HTTP server on http://0.0.0.0:8765
[bridge] SSE events   : http://localhost:8765/events
[bridge] Kafka consumer subscribed to 10 topics
```

### Step 4 — Open the UI and switch to Live mode

```bash
open code/ui/index.html
# or: python -m http.server 8080 --directory code/ui
```

Click **Switch to Live Kafka →** in the mode bar. The bar turns teal once connected.

### Step 5 — Launch a scenario

Select a scenario (e.g. **Supplier Delay**), set batches and speed, then click **Start Simulation**.

The bridge will:
1. Start `python -m scrc.risk_engine` (subscribes to all 7 input topics)
2. Start `python -m scrc.producer --scenario <name> --count N --interval T`
3. Stream every Kafka message from all 10 topics back to the browser via SSE

---

## Data flow

```
Browser (index.html)
  │  EventSource  →  GET /events   (SSE stream)
  │  fetch POST   →  POST /start   (launch producer + engine)
  │  fetch POST   →  POST /stop    (stop processes)
  ▼
kafka_bridge.py  (http://localhost:8765)
  │  Kafka Consumer  ── subscribes to all 10 topics
  │  subprocess.Popen ── python -m scrc.risk_engine
  │  subprocess.Popen ── python -m scrc.producer --scenario ...
  ▼
Confluent Cloud
  input  topics (7): supplier_profiles · component_master · purchase_orders
                     shipments · inventory_levels · customer_orders · external_risk_events
  output topics (3): supply_chain_risk_scores · supply_chain_recommendations · control_tower_alerts
```

---

## Bridge API

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/` | GET | — | Health + uptime |
| `/status` | GET | — | Process and consumer status |
| `/events` | GET | — | SSE stream (all Kafka events + process logs) |
| `/start` | POST | `{"scenario":"supplier_delay","count":20,"interval":1.0}` | Launch risk engine + producer |
| `/stop` | POST | `{"target":"all"}` | Stop processes |
| `/restart-engine` | POST | — | Restart just the risk engine |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Mode bar stays red DISCONNECTED | Start `python code/ui/kafka_bridge.py` |
| Bridge starts but no Kafka events arrive | Check `.env` — `CONFLUENT_BOOTSTRAP_SERVERS` must be set |
| `[bridge] ERROR: Kafka not configured` | Run `./scripts/setup.sh` to populate `.env` |
| Producer exits immediately | Confirm `.venv` is active; try `python -m scrc.producer --dry-run` |
| CORS error in browser console | Serve via `python -m http.server 8080 --directory code/ui`, not `file://` |
| Port 8765 in use | `BRIDGE_PORT=8766 python code/ui/kafka_bridge.py` |
