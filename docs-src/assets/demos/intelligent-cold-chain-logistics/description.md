Jump to: [Operations Manager](#part-1--operations-manager-persona) · [Driver](#part-2--driver-persona) · [SRE](#part-3--sre-persona)

---

## Part 1 — Operations Manager Persona

Demonstrates how IBM FleetOptx ColdPulse uses AI forecasting models and multi-agent systems to detect, analyze, and resolve critical fleet disruptions automatically.

**Step 1 — Switch User Persona**

1. Locate the persona dropdown menu in the top-right corner of the interface.
2. Select **Operations Manager – Sarah Chen** to access full operational management controls.

**Step 2 — Monitor Fleet Operations**

1. Navigate to the main **Operations** dashboard.
2. Review the live fleet metrics and active alerts:
   - Identify vehicles flagged with **critical cooling system threshold breaches**.
3. Click any vehicle displaying a **Critical** alert in the Alerts sidebar to view its alert history and cargo breach parameters.

**Step 3 — Evaluate Predictive Risk (Forecasting Tower)**

1. Click the **Forecasting** tab in the top navigation bar.
2. Review the AI-Powered Forecasting summary page:
   - View high-risk trucks flagged by the **IBM Granite Time Series** forecasting model.
   - Note the **confidence score** and projected **time-to-spoilage**.
3. Click **View Forecast** for any truck showing an active breach to analyze detailed predictions:
   - **Temperature Breach Prediction** — historical trends vs. AI future predictions (e.g., 80% risk in next 8 hours).
   - **Weather Impact Forecast** — route conditions and severity levels.
   - **Station Availability Forecast** — available service bays along the route.

**Step 4 — Trigger Multi-Agent AI Analysis**

1. Click the blue **Analyze** button next to an active critical alert.
2. You will be automatically routed to the **Agents** tab.
3. Observe four specialized AI agents executing in parallel:
   - **Weather Agent** — evaluates radar, temperatures, and severe weather delays along route segments.
   - **Station Agent** — searches nearby emergency cooling and repair facilities, available bays, and wait times.
   - **Route Agent** — evaluates alternative rerouting options based on fuel usage, cost, and arrival times.
   - **Decision Agent** — aggregates all findings to generate a unified recommendation, risk score, financial analysis, and post-recovery plan.
4. Click **"Click for full details"** on any agent card to drill into its segment data.

**Step 5 — Check Autonomous Resolution**

1. In the Decision Agent detail window, review the recommended action: **EMERGENCY\_REROUTE**.
2. Click **Close** on the Decision Agent detail window.
3. Observe the **Notification Agent** trigger automatically:
   - The system reserves an emergency cooling bay at the selected service station.
   - An automated WhatsApp notification with updated navigation details is sent to the driver's device.

> **Note:** For DSCE, the notification option is kept disabled during this demo workflow. Please check the video for full functionality.

---

## Part 2 — Driver Persona

Shows how IBM FleetOptx ColdPulse supports the Driver Persona — automatically processing critical telemetry alerts, rerouting drivers to emergency cooling hubs, and presenting clear actionable instructions without manual intervention.

**Step 1 — Switch User Persona**

1. Locate the persona dropdown menu in the top-right corner of the interface.
2. Select **Driver Persona** to open the dedicated Driver View portal.

**Step 2 — Select Driver Profile**

1. Locate the **Select Driver Profile** dropdown in the top-left section of the dashboard.
2. Select the driver/truck profile displaying a **Critical** alert status to view its active telemetry.

**Step 3 — Review Vehicle & Cargo Telemetry**

1. Navigate to the **My Truck** section in the central panel.
2. Monitor real-time status:
   - **Cargo Temp** — observe active temperature alerts (highlighted warning levels).
   - **Vehicle Status** — check fuel levels, route progress, remaining distance, ETA, speed, and overall cargo status.

**Step 4 — Access Reroute Notifications**

1. Locate the **Notifications** panel on the right side of the screen.
2. Review the automated **EMERGENCY\_REROUTE** notification:
   - Updated destination details (e.g., assigned emergency service plaza).
   - Facility proximity, estimated arrival window, cargo temperature recovery buffer, weather clearance, and available docking status.

**Step 5 — Verify Rerouted Destination & Navigation**

1. Check the **Destination Station** panel to confirm assigned facility details:
   - **Route & Station Type** — station location, service type, and coordinates.
   - **Status & Bay Availability** — confirm an active service bay is reserved for emergency cooling.
2. Reference the **My Current Route** map panel on the left to trace the live GPS trajectory updated with the new service plaza destination.

**Step 6 — Review Delivery History**

1. Scroll to the **My Recent Deliveries** panel at the bottom of the interface.
2. Review past completed routes, cargo categories, total distances, and duration logs to verify historical operational compliance.

---

## Part 3 — SRE Persona

> **Note:** For DSCE, application observability is kept disabled during this demo workflow. Please check the video for full functionality.
