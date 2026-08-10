
# Retail Application – JMeter Spike Test Framework

This repository contains a **JMeter-based spike test framework** used to simulate load on the Retail Sample Application backend.

The framework executes a **three-phase load test**:
1. Warm-up
2. Spike
3. Cool-down

---

## 1. Prerequisites

### Platform Requirements
- Retail Sample Application deployed on **OpenShift**
- Publicly accessible **backend route** (HTTPS)

### Workstation / Runner Requirements
- Apache **JMeter 5.6.3**
- **Java 11 or Java 17**
- Bash shell (Linux / macOS)
- Network access to backend route

### Required Files
- `retail_spike.jmx` – JMeter test plan
- `run_spike.sh` – Test execution script
- `users.csv` – Test users for login

---

## 2. APIs Used in Spike Test

### Authentication
- `POST /api/auth/login`
- `GET /api/user/profile`

### Product & Catalog
- `GET /api/catalog/products`
- `GET /api/catalog/product/{id}`

### Cart Operations
- `POST /api/cart/add`
- `GET /api/cart`
- `PUT /api/cart/update`
- `DELETE /api/cart/clear`

### Checkout & Orders
- `POST /api/checkout`
- `POST /api/orders/create`
- `GET /api/orders`
- `GET /api/orders/{orderId}`

### Health Check
- `GET /health`

---

## 3. Spike Test Phases

### Phase 1 – Warm-up
- Users: 20
- Ramp-up: 10 seconds
- Loops: 1
- Output: `warmup.jtl`

### Phase 2 – Spike Load
- Users: 300
- Ramp-up: 90 seconds
- Loops: 80
- Duration: ~5 minutes
- Output: `spike_5min.jtl`

### Phase 3 – Cool-down
- Users: 40
- Ramp-up: 20 seconds
- Loops: 1
- Output: `cooldown.jtl`

---

## 4. Running the Spike Test

### Script Usage
```bash
./run_spike.sh <backend-route>
```

### Example
```bash
./run_spike.sh retail-backend-tbb.tbb-us-east-1-cx2-8x16-2bef1f4b4097001da9502000c44fc2b2-0000.us-east.containers.appdomain.cloud
```

The backend route is injected into JMeter as:
- `-JserverHost=<backend-route>`

---

## 5. Test Results

Generated result files:
- `warmup.jtl`
- `spike_5min.jtl`
- `cooldown.jtl`

These can be analyzed using:
- JMeter GUI
- JMeter HTML Dashboard
- Excel / Grafana / Prometheus

---

## 6. Notes
- Load parameters can be tuned in `run_spike.sh`
- JMeter must have access to the `users.csv` file
- Ensure sufficient cluster capacity before spike testing
