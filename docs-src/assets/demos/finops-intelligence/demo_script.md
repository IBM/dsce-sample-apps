# FinOps Intelligence — Demo Script

## Step 1: Set the Stage & Enterprise Context

**Screen / Tab to Open:** Click on the **Overview (Closed-Loop FinOps)** tab in the top navigation.

**On-Screen Actions:**
- Point to the top metric header cards:
  - **Current Monthly Spend:** $2,000,000/mo ($24M annual run-rate across AWS, Azure, GCP).
  - **Identified Waste / Optimization Opportunity:** $460,000/mo ($5.52M/year).
- Point to the interactive **Closed-Loop Workflow** diagram (INFORM → OPTIMIZE → OPERATE → MEASURE).

---

## Step 2: INFORM — Financial Intelligence & Attribution

**Screen / Tab to Open:** Click on the **Financial Intelligence** tab.

**On-Screen Actions:**
- Highlight the **Spend vs. Budget Variance Chart**.
- Select/filter the **Retail E-Commerce Platform** card in the spend allocation breakdown.
- Point out the category cost split: Compute VMs ($180k), Kubernetes Pods ($80k), and Databases ($60k).

---

## Step 3: Advanced Capabilities — ML Forecasting & Anomaly Detection

**Screen / Tab to Open:** Switch to the **Capabilities Hub / Advanced Capabilities** sub-tab.

**On-Screen Actions:**
- Point to the **Machine Learning Spend Forecast** curve showing the unconstrained $2.75M run-rate trajectory.
- Hover over the **Real-Time Anomaly Alerts** (e.g., cross-region data transfer spike and orphaned unattached storage volumes).

---

## Step 4: OPTIMIZE & OPERATE — Automated Resource Actions

**Screen / Tab to Open:** Switch to the **Resource Optimization** tab.

**On-Screen Actions:**
- Filter the action list by **Retail E-Commerce**.
- Walk through the specific AI-generated recommendations:
  - Rightsize AWS EC2 m5.2xlarge → m5.xlarge (+$28,500/mo savings)
  - Scale down Kubernetes Container Pod CPU/Memory limits (+$22,000/mo savings)
  - Workload Parking for non-prod staging during off-hours (+$14,500/mo savings)
  - Database instance rightsizing & orphaned volume deletion (+$15,000/mo savings)
- Click **"Execute All Actions for Retail"** (or click individual Execute buttons).
- Show the live status change to **EXECUTED** and the real-time spend counter dropping from $370,000/mo to $290,000/mo ($80,000/mo savings | $960,000/year).

---

## Step 5: MEASURE — Verified ROI & Business Outcomes

**Screen / Tab to Open:** Switch to the **Executive Value** tab.

**On-Screen Actions:**
- Point to the **Realized Savings Summary:**
  - Retail realized savings: $80,000/mo ($960,000/yr).
  - Enterprise total potential: $460,000/mo ($5.52M/yr).
- Point to the **Unit Economic Improvement:** Cost per checkout dropped by 21.6%.
- Highlight the **4 Strategic Executive Pillars:**
  - **Lower Cost:** Elimination of recurring multi-cloud waste.
  - **Financial Accountability:** Precise showback and unit economics.
  - **Automated Operations:** Non-disruptive, policy-driven execution.
  - **Assured Performance:** Workloads sized continuously for actual demand.

---

## Step 6: Enterprise Extensibility & Next Steps

**Screen / Tab to Open:** Switch to the **API Explorer** or **Config** modal.

**On-Screen Actions:**
- In the **REST API Explorer**, select a sample endpoint (e.g., `/reporting/reports/spend-by-dimension` or Turbonomic `/api/v3/actions`) and click **"Send Request"** to show the live payload.
- Open the **Environment Config** modal to demonstrate loading a customer's custom environment JSON.
