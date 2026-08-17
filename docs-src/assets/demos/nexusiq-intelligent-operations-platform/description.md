**Script Duration:** 15–20 minutes &nbsp;|&nbsp; **Audience:** Technical stakeholders, architects, data engineers, operations & C-suite

---

**1. Set up the environment (once)**

Run `demo/scripts/manual_load_iceberg_all.sql` in the watsonx.data Query Workspace to create 9 Iceberg tables and 70 rows of demo data. Copy `mcp-servers/query-layer/.env.example` → `.env` and fill in Presto host/credentials and Astra DB / HCD connection details. Run `python demo/scripts/reset_and_load_astra.py` to embed and load the 6 runbook PDFs into the vector store.

---

**2. Open the project in VS Code with IBM Bob**

Switch Bob to the **"AI Driven Analyst"** mode (defined in `.bob/custom_modes.yaml`). The MCP server registered in `.bob/mcp.json` starts automatically — verify the Bob status bar shows the MCP server connected.

---

**3. Tell the business story first (2 min)**

Set the scene: *"A PLATINUM customer — €250K lifetime value — has a delayed order. The root cause, the fix, and the compensation policy live in three different places. Watch this get answered in 2 seconds."*

---

**4. Run the five demo question blocks**

- **Q1 (structured root cause):** *"Why is order O-10452 delayed?"* — Bob queries orders, inventory, and shipment events via SQL.
- **Q2 (federated):** *"Why is O-10452 delayed and what should we do per our runbooks?"* — Bob runs SQL + vector search, cites runbooks rb-1, rb-2, rb-4 and past incident inc-2.
- **Q3 (customer profile):** *"Tell me about customer C-9001."* — Demonstrates cross-table join across tier, LTV, region, and segment.
- **Q4 (revenue at risk):** *"How much revenue is at risk from delayed orders?"* — Aggregation across tiers and regions.
- **Q5 (real-time, optional):** Start the Kafka consumer, produce a new order, then ask *"Show me orders from the last 5 minutes"* — the new order appears in <500 ms.

---

**5. Close with the business value summary**

Emphasise the five outcomes: 100× faster decisions, consistent policy application, proactive service, €250K LTV protected, and a platform pattern reusable across industries (healthcare, financial services, manufacturing, retail).
