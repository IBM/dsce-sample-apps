**Step 1 — Review the Campus Overview**

1. Open the **Overview** tab.
2. Show the three-building campus (**A**: acute care, **B**: outpatient, **C**: support).
3. Point out the **1,080 kW protected floor** for Building A. All buildings are **GREEN**.

**Step 2 — Explore the Weather & Forecast**

1. Open the **Weather & Forecast** tab.
2. Trace the 7-day forecast and the **Storm Week Profile**.
3. Note that the curves are simulated for the demo. In production they are driven by IBM Environmental Intelligence Suite and Granite forecasts. The grid outage is a what-if scenario, not a prediction.

**Step 3 — Highlight Autonomous Battery Pre-Charging**

1. Point out the purple dashed line on **May 4**.
2. Explain that the MMS autonomously pre-charges the battery to **85%** when storm risk crosses its threshold, and the battery holds that level until the storm.

**Step 4 — Run the Storm Demo**

1. Return to the **Overview** tab and click **Run Storm Demo**.
2. Building A goes **AMBER** as the storm approaches and inverter **MG-17** degrades 11%.

**Step 5 — Review the Storm Impact**

1. Show the **Storm Impact** view: solar decays to 0 while the wind turbine keeps generating.
2. The AI flags grid-loss risk: battery plus wind must carry the 1,080 kW floor.

**Step 6 — Review Alerts & Actions**

1. Open the **Alerts & Actions** tab (red badge).
2. Review the autonomous battery staging.
3. Review the human-in-the-loop plan to shed **215 kW** of nonclinical load with **0 kW clinical impact**.

**Step 7 — Approve and Execute the Plan**

1. Click **Approve & Execute Plan**. Demand steps down by 215 kW.
2. At **14:50** the grid fails and the campus islands at the 1,080 kW protected floor, with battery plus wind carrying it until the grid returns at **16:30**.
3. The campus returns to **GREEN** with a Maximo work order synced.

**Step 8 — Ask the Agent**

1. Open the **Agent** tab.
2. Ask the watsonx Orchestrate agent why the load shed was recommended.

**Step 9 — Close on the Architecture**

1. Close on the **Architecture** tab to show how the pieces fit together.
