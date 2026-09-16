# SRE Copilot — Demo Script

---

## Overview

Demonstrates how the watsonx Orchestrate SRE Copilot agent analyzes live IT infrastructure incidents — performing root cause analysis, severity classification, and generating step-by-step remediation runbooks — with optional real-time safety controls managed from an Admin Panel.

---

**Step 1 — Orient the Audience on the Incident Board**

1. Open the app and point out the **Kanban board** — incidents are grouped into four severity columns: Critical, High, Medium, Low.
2. Draw attention to the **KPI bar** at the top: live counts per severity, Open Incidents, Avg MTTR, and SLA Breach Risk badges.
3. Note that the board is pre-loaded with 8 realistic seed incidents covering OOMKilled pods, DB connection pool exhaustion, Redis latency spikes, memory leaks, disk pressure, and more.

---

**Step 2 — Explore an Incident in Detail**

1. Click any **Critical** incident card to open the **Incident Detail Drawer**.
2. Walk through the enriched metadata panel: Assignee, Environment, Region, Alert Source, and Runbook reference — showing that context is pulled from PagerDuty, Datadog, Splunk, GitHub, and Confluence automatically.
3. Scroll down to the **Raw Logs** section — point out the colour-coded ERROR / WARN / INFO lines.
4. Click **Close** to dismiss the drawer.

---

**Step 3 — Run an AI Analysis**

1. On the same incident card, click the **Analyze** button.
2. The **Analysis Drawer** opens and the **watsonx Orchestrate thinking animation** begins — a terminal-style typewriter shows the agent connecting, retrieving context, scanning error patterns, querying alert history, cross-referencing metrics, and generating the runbook.
3. When the result appears, walk through the three sections:
   - **Root Cause** — specific log entries and timestamps cited.
   - **Severity Classification** — confirmed or reclassified severity with business impact justification.
   - **Remediation Steps** — 5–8 numbered, immediately actionable steps with exact CLI commands.

---

**Step 4 — Follow-Up Chat**

1. In the chat input at the bottom of the Analysis Drawer, type a follow-up question such as: *"How long will the fix take?"* or *"Which team should own this remediation?"*
2. Show the agent answering concisely — 2–5 sentences — with full incident context and prior analysis automatically injected.
3. Try one of the **suggested question chips** to demonstrate the one-click workflow.

---

**Step 5 — Mark the Incident Resolved**

1. Click **Mark Resolved** in the footer of the Analysis Drawer.
2. Close the drawer and return to the board — the incident card now shows the **timeline progress bar** fully complete: Detected → Assigned → Analyzing → Resolved.

---

**Step 6 — Live Incident Generation**

1. In the toolbar above the board, set the **Auto-generate** dropdown to **Every 5 sec**.
2. Watch new incidents appear live across all severity columns, drawn randomly from 12 realistic IT ops templates (Kubernetes node failures, Redis split-brain, Elasticsearch shard issues, network latency spikes, and more).
3. Set the dropdown back to **Off** before continuing.

---

**Step 7 — Agent Controls (Admin Panel)**

1. Click the **⚙️ Settings** icon in the top-right header.
2. Enter the admin password to unlock the panel.
3. Toggle on **PII Filter**, **Content Guardrails**, and **Secrets Detector** one by one — explain each control:
   - **PII Filter** — masks IP addresses, email addresses, and phone numbers before they reach the agent or appear in responses.
   - **Content Guardrails** — blocks jailbreak attempts, prompt injection, and off-topic content.
   - **Secrets Detector** — redacts API keys, JWT tokens, and private keys from incident logs and agent output.
4. Point out the **🔒 Controls Active** badge that appears in the KPI bar — confirming the controls are live on the agent.
5. Run another analysis to show the controls in action on a real incident.

---

**Step 8 — Reset the Board**

1. In the Admin Panel, scroll to the **Board Management** section.
2. Click **Reset Board** and confirm in the modal — this restores the 8 seed incidents and resets the ID counter, ready for the next demo session.
