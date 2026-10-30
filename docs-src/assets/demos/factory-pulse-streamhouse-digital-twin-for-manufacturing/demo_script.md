**Duration:** 10–12 minutes
**Audience:** Plant and operations leaders, data and integration architects, AI and analytics teams
**Mode:** Runs live against IBM Confluent Cloud, or fully offline in the browser (the header shows **BROWSER SIMULATION**)

> Tip: the **Demo playbook** tab in the left menu has the same flow as built-in, clickable steps.

---

**Step 1 — Set the Scene: Command Center (1 min)**

1. Open the app. It starts on **Command center**.
2. Point out the four live KPIs: **Total throughput**, **Network OEE**, **Active incidents** and **Telemetry rate**.
3. Point to the **US factory network** map: six plants, 36 robots, all streaming.

**Say:** "Every robot in these six plants streams temperature, vibration, quality and throughput. Each reading is checked against a schema before it lands on an IBM Confluent Kafka topic, so this view is the current state of the business, not last night's batch."

**Step 2 — Open a Plant: Digital Twin (1 min)**

1. Click **Detroit** on the map, then **Open digital twin**.
2. Point out the six robot arms, the conveyor moving parts between stations, the **LINE RUNNING** banner and the **Live sensor stream**.
3. Optional: click **Atlanta** or **Louisville** under **Plant selection** to show that each plant runs a different production line.

**Say:** "This is a live digital twin. Each plant builds something different. In Detroit, six robots weld and assemble car subframes."

**Step 3 — Inject Early Bearing Wear: The Predictive Window (1.5 min)**

1. In **Fault injection lab**, set **Scenario** to **Predictive bearing wear**.
2. Set **Severity** to about **50%** and click **Inject scenario**.
3. One robot starts to shudder and its vibration climbs. The banner changes to **PREDICTIVE ALERT · line still running**.

**Say:** "Only one robot is affected, as on a real floor. The line is still running, and this is the predictive window. Flink SQL is already watching the vibration stream and has raised a risk signal before anything breaks."

**Step 4 — Show the Stream Processing: Flink SQL (1 min)**

1. Open the **Flink SQL** tab.
2. Walk through **02 · Predictive risk**, then **03 · Shift performance**.
3. If the Flink statements are deployed in your Confluent Cloud environment, point to **Derived topic monitor** to show the real output.

**Say:** "These statements run continuously in IBM Confluent. They turn raw telemetry into `factory-risk-signals`, 1-minute KPIs and quality alerts while the data is still moving."

**Step 5 — Let It Fail: The Line Stops (1 min)**

1. Go back to **Digital twin**. Raise **Severity** to **85%** and click **Inject scenario**.
2. The robot trips into a protective stop. The conveyor holds, the banner shows **LINE STOPPED**, and output and OEE drop.

**Say:** "If nobody acts, the wear gets worse. One robot stops, so the whole line stops. A critical event lands on the governed `factory-maintenance-events` topic."

**Step 6 — Explain the Architecture: Streamhouse (1.5 min)**

1. Open the **Streamhouse** tab.
2. Click through **Capture → Stream → Transform → Govern → Serve**.
3. Point to the two paths at the bottom: **Tableflow → Apache Iceberg** (analytics in IBM watsonx.data) and **RTCE → MCP → AI agents** (operations).

**Say:** "One governed stream serves everyone. Schema contracts and lineage come from Stream Governance. The lakehouse gets history as open Iceberg tables, and AI agents get the current state through the Real-Time Context Engine. The Streamhouse doesn't replace existing MES, SCADA or ERP systems; it connects them."

**Step 7 — React to the Event: Actions (1 min)**

1. Open the **Actions** tab.
2. Contrast **Confluent Flink Topic Actions** (deduplicate, mask, transform with no SQL) with the business actions on the right.
3. Scroll to the **Maintenance & incident timeline** to show the warning and critical events.

**Say:** "The same event can drive a work order, an alert or a dashboard, and each one subscribes to the topic. There's no new point-to-point integration."

**Step 8 — Give AI Live Context: AI Context / MCP (1.5 min)**

1. Open the **AI context / MCP** tab.
2. Under **Ask Factory Pulse**, click **Which robot needs maintenance right now?**
3. The answer names the robot, with its live vibration, temperature, status and OEE.
4. If an RTCE endpoint is configured, click **Discover remote MCP tools** and invoke one to show a real MCP call.

**Say:** "Be clear with the audience: the built-in panel is a rule-based preview over the live snapshot. In production, the Real-Time Context Engine serves this same current state to agents such as watsonx Orchestrate over MCP, so their answers reflect what's happening now."

**Step 9 — Close the Loop: Repair (30 s)**

1. Go back to **Digital twin** and click **Simulate repair**. You can also use **Schedule maintenance** in **Actions**.
2. The robot recovers and the line restarts.
3. Click **Restore healthy state** to reset the demo.

**Say:** "The fix is scheduled, the robot is repaired, and the line restarts."

**Step 10 — Wrap Up (30 s)**

**Say:** "Earlier warning. A line that stops safely when a robot fails. Live, governed context for AI. And open history for analytics. That's a Streamhouse on IBM Confluent."

**Suggested next step:** a discovery workshop to map the customer's own OT and MES events to a first Streamhouse use case.

---

**Variations**

- **Thermal excursion:** the robot overheats and glows red.
- **Quality drift:** defective parts are flagged and rejected.
- **Demand surge:** the line speeds up with no fault.
- **No backend:** the app falls back to an in-browser simulation, and switches back automatically when the backend responds.
