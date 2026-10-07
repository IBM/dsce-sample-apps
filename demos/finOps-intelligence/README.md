# IBM Cloudability + IBM Turbonomic: Continuous FinOps & Automated Cloud Cost Optimization

An enterprise React application built to showcase the combined power of **IBM Cloudability** (Financial Intelligence & Visibility) and **IBM Turbonomic** (Application-Aware Resource Optimization & Automated Actions).

---

## 🎯 Strategic Value Proposition

> **"Optimize every cloud dollar by combining financial accountability with automated, performance-aware resource optimization."**

- **IBM Cloudability**: Tells you *where* the money is going and *why* (Cost allocation, Showback/Chargeback, Budgeting, Unit Economics, FinOps FOCUS reporting).
- **IBM Turbonomic**: Determines *what* infrastructure changes to make and *automatically executes* them safely without degrading application SLA/performance.
- **Closed-Loop Cycle**: **INFORM ➔ OPTIMIZE ➔ OPERATE ➔ MEASURE**

---

## 🚀 Key Features

1. **Executive Multi-Cloud FinOps Dashboard**:
   - $2M/mo multi-cloud enterprise baseline across Retail, Banking, and Analytics workloads.
   - Real-time KPI trackers (Run-rate spend, budget variance, monthly & annualized savings).
2. **IBM Cloudability Financial Intelligence**:
   - Application spend vs budget comparison charts.
   - Tag-based business unit allocation & showback.
   - Category breakdowns (Compute VMs, Kubernetes pods, Databases, Storage, Network egress).
   - FinOps Unit Economics (Cost per Checkout Order, Cost per Financial Transaction, Cost per Query).
3. **IBM Turbonomic Optimization Engine**:
   - Performance-aware rightsizing across AWS EC2, Azure VMs, Kubernetes pods (CPU/memory requests & limits), RDS/Aurora databases, and unattached storage.
   - Workload parking automation for non-production environments during idle off-hours.
   - Interactive 1-click execution or bulk automation of recommended actions.
4. **End-to-End Closed-Loop Workflow**:
   - Step-by-step visual walkthrough of **INFORM ➔ OPTIMIZE ➔ OPERATE ➔ MEASURE**.
   - Live cycle simulation showing real-time budget convergence.
5. **REST API Protocol Explorer**:
   - Interactive inspector for Cloudability (`/reporting/reports/spend-by-dimension`, `/reporting/views`, `/business-metrics/unit-economics`) and Turbonomic (`/api/v3/actions`, `/api/v3/actions/{actionId}`).
   - Live simulated request execution with real headers, authentication tokens, and response payloads.
6. **Dynamic Input Configuration**:
   - Accepts custom environment parameters via **JSON file upload** (`sample-enterprise-environment.json` included) or interactive form fields.
   - Export modified configs or reset back to default scenario.

---

## 🛠️ Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- **Recharts** for charts and spend visualisations
- **Lucide React** for enterprise cloud icons

---

## 🏃 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```

---

## 📂 Environment Input File (`sample-enterprise-environment.json`)

Upload your multi-cloud environment topology and API keys directly using the **"Input File / Config"** button in the header.
