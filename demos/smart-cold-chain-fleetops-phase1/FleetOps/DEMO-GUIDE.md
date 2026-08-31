# FleetOps Demo Guide

How to demonstrate Manual vs Automated mode using the built-in demo endpoints.

## What the Demo Covers

The demo shows two contrast modes for handling a truck temperature breach:

- **Manual mode** — System alerts the operator and waits for a human to send commands.
- **Automated mode** — System detects the breach and sends commands without human intervention.

---

## Prerequisites

1. **FleetOps running** (local or deployed):

   ```bash
   # Local
   cd FleetOps && npm start

   # Or deployed on OpenShift — get the URL:
   oc get route fleetops -o jsonpath='{.spec.host}'
   ```

2. **fleetops-backend running** and connected via `COLDCHAIN_API_URL` in your `.env`.

3. Verify everything is healthy:

   ```bash
   curl http://localhost:4000/health
   curl http://localhost:4000/api/trucks
   ```

---

## Demo Endpoints

FleetOps exposes three demo-control endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/demo/info` | GET | Lists available demo endpoints and recommended trucks |
| `/api/demo/force-critical/:truckId` | POST | Forces a truck to critical temperature (−5.0 °C) |
| `/api/demo/reset-truck/:truckId` | POST | Resets a truck to normal temperature (−16.0 °C) |

### Quick reference

```bash
BASE=http://localhost:4000   # or your deployed URL

# Show demo info
curl $BASE/api/demo/info

# Force TRUCK-003 to critical
curl -X POST $BASE/api/demo/force-critical/TRUCK-003

# Reset TRUCK-003 to normal
curl -X POST $BASE/api/demo/reset-truck/TRUCK-003
```

---

## Option 1: Automated Demo Script (Recommended)

The script forces trucks into critical state at the right moment and pauses so you can demonstrate each phase in the UI.

```bash
cd FleetOps
chmod +x demo-script.sh

# Local instance (default)
./demo-script.sh

# Deployed instance
./demo-script.sh https://fleetops-fleetops-backend.apps.<your-cluster>
```

### What happens

#### Phase 1 — Manual Mode (you control the pace)

1. Script forces **TRUCK-003** to critical (−5.0 °C).
2. Script **pauses** — follow the on-screen instructions:
   - Open FleetOps → Operations tab → TRUCK-003 shows RED / CRITICAL.
   - Observe & Optimize tab → Execute Turbonomic action (if enabled).
   - Activity Log shows **"⚠️ Manual intervention required"**.
   - Manually send "Emergency_Cooling_On" from the TRUCK-003 card.
3. Press **Enter** to continue.

#### Phase 2 — Automated Mode (you control the pace)

1. Script forces **TRUCK-004** to critical.
2. Script **pauses** — follow the on-screen instructions:
   - Click "Auto" button in the header.
   - Operations tab → TRUCK-004 shows RED / CRITICAL.
   - Execute Turbonomic action again.
   - Activity Log shows **"🚀 Automated sequence executing"**.
   - Watch: Emergency_Cooling_On sent → truck rerouted → resume scheduled.
3. Press **Enter** to finish.

---

## Option 2: Manual Control

Use this when you want full control over the timing.

**Before the demo — reset everything to a clean state:**

```bash
./reset-all-trucks.sh
```

**Force a truck critical:**

```bash
curl -X POST http://localhost:4000/api/demo/force-critical/TRUCK-003
```

**Reset a truck:**

```bash
curl -X POST http://localhost:4000/api/demo/reset-truck/TRUCK-003
```

---

## Recommended Trucks

| Truck | Route | Notes |
|-------|-------|-------|
| **TRUCK-003** | Boston → New York | ✅ Stations on route — rerouting works |
| **TRUCK-004** | Chicago → Detroit | ✅ Stations on route — rerouting works |
| TRUCK-009 | Indianapolis → Columbus | ⚠️ No stations on route — avoid for rerouting demos |

---

## Demo Checklist

### Before the demo

- [ ] FleetOps is running and reachable
- [ ] `curl /health` returns `{"status":"healthy"}`
- [ ] `curl /api/trucks` returns truck data
- [ ] Run `./reset-all-trucks.sh` to start with a clean state
- [ ] Open FleetOps in browser; verify all trucks show green

### Phase 1 — Manual Mode

- [ ] Force TRUCK-003 critical
- [ ] Operations tab — TRUCK-003 shows RED
- [ ] (Optional) Observe tab — Execute Turbonomic action
- [ ] Activity Log — "⚠️ Manual intervention required"
- [ ] Manually send "Emergency_Cooling_On" from TRUCK-003 card
- [ ] Activity Log — manual command confirmed

### Phase 2 — Automated Mode

- [ ] Click "Auto" button in header
- [ ] Activity Log — "Switched to AUTOMATED mode"
- [ ] Force TRUCK-004 critical
- [ ] Operations tab — TRUCK-004 shows RED
- [ ] (Optional) Execute Turbonomic action
- [ ] Activity Log — "🚀 Automated sequence executing"
- [ ] Automated commands fire: Emergency_Cooling_On → Reroute → Resume

### After the demo

- [ ] Run `./reset-all-trucks.sh` to restore normal state

---

## Talking Points

### Manual Mode

> "In manual mode, operators maintain full control. The system alerts them but waits for a human decision. This is appropriate for high-stakes scenarios where human judgment is required."

### Automated Mode

> "In automated mode, the system responds instantly — no human in the loop. Response time drops from minutes to seconds, preventing cargo loss and freeing operators to focus on strategic decisions."

### Business Impact

> "Automated response can protect a $200k+ pharmaceutical cargo shipment. At scale — managing 1,000+ trucks with the same team — this is the difference between viable and not."

---

## Troubleshooting

### FleetOps not responding

```bash
# Check health
curl http://localhost:4000/health

# Start if not running
cd FleetOps && npm start
```

### Truck not going critical

```bash
# Verify the endpoint responded with success
curl -X POST http://localhost:4000/api/demo/force-critical/TRUCK-003
# Expected: {"success":true, ...}

# Check current truck status
curl http://localhost:4000/api/trucks | grep -A5 TRUCK-003
```

### fleetops-backend not reachable

Check your `COLDCHAIN_API_URL` in `.env`, then:

```bash
# Confirm FleetOps can proxy to the backend
curl http://localhost:4000/api/trucks
```

If deployed on OpenShift, check the backend pod:

```bash
oc get pods -n fleetops-backend
oc logs -f deployment/fleetops-backend
```
