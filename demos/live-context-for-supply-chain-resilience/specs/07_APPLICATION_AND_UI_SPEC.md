# Application and UI Specification

**Spec:** 07_APPLICATION_AND_UI_SPEC.md  
**Version:** 2.0  
**Status:** Approved  
**Classification:** SYNTHETIC DEMO — not real Shell or Pearl GTL operational data

---

## 1. Purpose

This specification defines the TSCI front-end application: its technology stack, routing, page behaviour, component contracts, API client, watsonx Orchestrate integration, and UX rules.

The UI is a single-page React application that serves as the **control tower** for turnaround supply-chain risk. It consumes the FastAPI backend over a Vite proxy and delegates conversational AI to watsonx Orchestrate through a second proxy path.

---

## 2. Tech Stack

| Package | Version | Purpose |
|---|---|---|
| `react` | 18.3.1 | UI framework |
| `react-dom` | 18.3.1 | DOM renderer |
| `react-router-dom` | 6.26.0 | Client-side routing (React Router v6) |
| `@carbon/react` | 1.71.0 | IBM Carbon Design System components |
| `@carbon/icons-react` | 11.48.0 | Carbon icon set |
| `axios` | 1.7.0 | HTTP client for all backend and wxO calls |
| `vite` | 5.3.0 | Build tool and development server (port 3000) |
| `typescript` | 5.4.0 | Static type checking |
| `sass` | 1.77.0 | SCSS preprocessing for Carbon theme overrides |

### 2.1 Build Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite --port 3000` | Development server with HMR |
| `build` | `vite build` | Production build to `ui/dist/` |
| `typecheck` | `tsc --noEmit` | Type-only check without compilation |
| `lint` | `eslint src --ext ts,tsx` | ESLint with TypeScript rules |

### 2.2 Access

- UI: `http://localhost:3000` — Login: credentials set via `DEMO_USERNAME` / `DEMO_PASSWORD` env vars (see `backend/.env.example`)
- Backend API docs: `http://localhost:3001/api/docs`

---

## 3. Application Layout

### 3.1 `AppLayout` Component

**Path:** `ui/src/components/layout/AppLayout.tsx`  
**Props:** `{ children, user: AuthUser, onLogout }`

The layout provides:

- **Collapsible sidebar** with navigation items and project selector
- **Navigation items** (in order): Dashboard, Supply Resilience (Agent), Active Risks, Confluent Events, Shipments, Configuration
- **Project selector dropdown** at sidebar top: current project label displayed
- **User footer** at sidebar bottom: username, logout button

All authenticated routes are rendered inside `AppLayout`. Unauthenticated access redirects to `/login`.

### 3.2 Route Table

All routes use React Router v6 `<Routes>`. Auth gate is applied before route rendering.

| Path | Component | Purpose |
|---|---|---|
| `/` | Redirect | → `/dashboard` |
| `/dashboard` | `DashboardPage` | Turnaround readiness overview |
| `/risks` | `ActiveRisksPage` | Risk registry |
| `/risks/:riskId` | `RiskDetailPage` | Single risk detail and approval workflow |
| `/agent` | `AgentPage` | Conversational AI (AskBob / wxO) |
| `/login` | `LoginPage` | Demo authentication |
| `/events` | `EventsPage` | Confluent event stream monitor |
| `/shipments` | `ShipmentsPage` | Inbound logistics and material readiness |
| `/configuration` | `ConfigurationPage` | System configuration and demo controls |

---

## 4. Pages

### 4.1 DashboardPage — `/dashboard`

**Purpose:** Turnaround readiness overview with live KPI tiles, resilience posture strip, and risk event table.

**API Calls on Mount:**
- `getRisks()` → `GET /api/risks`
- `getResilienceProfile('TW-2047', 'CVA-8842')` → `GET /api/resilience/profile?work_package_id=TW-2047&material_id=CVA-8842`
- `getPortStatus('SGSIN', 'CVA-8842')` → `GET /api/resilience/port-status?port_code=SGSIN&material_id=CVA-8842` (fails silently on error)

**Components Displayed:**

1. **Port Disruption Ticker** — scrolling banner shown only when port `severity ∈ {HIGH, CRITICAL}` AND `status !== 'NO_DISRUPTION'`. Shows port name, code, disruption type, severity, and estimated impact. Live dot indicator blinks.

2. **KPI Tile Grid** (4 columns):
   - Critical Risks count (red)
   - High Risks count (magenta)
   - Open count (blue)
   - Mitigated count (green)

3. **Supply Chain Resilience Posture Strip** (demo: CVA-8842 / TW-2047):
   - Stale warning shown when `profileAgeSecs > 300`
   - 7 tiles: Material code, Readiness badge, Resilience score (0–100, color-coded), Unconstrained suppliers (red=0, amber=1, green≥2), Transfer locations count, Primary supplier status badge, Secondary supplier status badge

4. **Recent Risk Events Table** — columns: Risk ID, Severity tag, Material, Work Package, Type, Status tag, Detected At. Each row navigates to `/risks/:riskId`. Empty-state message shown when `risks.length === 0`.

**User Actions:**
- Click risk row → navigate to `/risks/:riskId`
- Resilience strip auto-refreshes on interval (configurable, default 60s)

---

### 4.2 ActiveRisksPage — `/risks`

**Purpose:** Full risk registry grouped by severity, with filtering.

**API Calls:**
- `getRisks()` → `GET /api/risks` (on mount and on Refresh click)

**Components Displayed:**

1. **Header** with Refresh button (icon button)

2. **KPI Grid** (5 columns): Critical, High, Open, Investigating, Mitigated

3. **Filter Bar**: severity chips `[ALL, CRITICAL, HIGH, MEDIUM, LOW]` + status chips + result count label + "Clear filters" link

4. **Risk Groups** sorted CRITICAL → HIGH → MEDIUM → LOW:
   - Collapsed card header: chevron, Risk ID, Severity tag, Status tag, meta (material, WP, type, detected-at)
   - Status tag colours: `OPEN`=red, `INVESTIGATING`=blue, `MITIGATION_PROPOSED`=purple, `APPROVED`=teal, `MITIGATED`=green, `CLOSED`=warm-gray
   - Expanded card body: Facts grid (Required By, Current ETA, Delay days, Shortage Qty, Delay Reason, Shipment ID, Correlation ID), Resilience flags pills, link → `/risks/:riskId`

**Resilience flags pills** (shown when flag is true):
- Primary Constrained (red)
- Secondary Constrained (red)
- Alt Inventory Available (green)
- Substitute Approved (teal)

---

### 4.3 RiskDetailPage — `/risks/:riskId`

**Purpose:** Full risk investigation view with mitigation options, resilience panel, and approval workflow execution.

**API Calls:**
- `getRisk(riskId)` → `GET /api/risks/:riskId`
- `getRiskOptions(riskId)` → `GET /api/risks/:riskId/options`
- `getWorkPackage(wpId)` → `GET /api/work-packages/:wpId`
- `getShipment(shipmentId)` → `GET /api/shipments/:shipmentId`
- `getResilienceProfile(wpId, materialId)` → `GET /api/resilience/profile?...`
- `requestApproval(riskId, optionId, summary)` → `POST /api/actions/approval-requests`
- `approveRequest(approvalId, approver)` → `POST /api/actions/approval-requests/:id/approve`
- `executeTransfer(payload)` → `POST /api/actions/inventory-transfer`
- `executeExpedite(payload)` → `POST /api/actions/supplier-expedite`
- `markMitigated(payload)` → `POST /api/actions/mark-mitigated`

**Components Displayed:**

1. **Breadcrumb**: Dashboard > Risk ID

2. **Header**: Risk ID as title, Correlation ID as subtitle, Severity tag, Status tag

3. **Stale Profile Warning** (Carbon `InlineNotification`, kind=warning) — shown when `profileAgeSecs > 300`

4. **Progress Indicator** (4 steps, derived from approval/mitigation state):
   - Risk Detected → Options Available → Approval Granted → Risk Mitigated

5. **Mitigated Banner** — green checkmark panel (shown when risk is `MITIGATED`): mitigation type, approver name, transfer or expedite ID

6. **Two-Column Facts Grid:**
   - **Left — Material/Shipment Facts:** Material ID, Needed by (date), Current ETA (red if late), Units available (± shortage in red/green), Root cause (delay reason), Port of departure, Port of entry, Resolved by
   - **Right — Affected Work:** Work Package ID, Turnaround ID, Asset, Planned start, Status tag (red=AT_RISK, green=CONFIRMED), Mitigated at, Actioned by

7. **Supply Chain Resilience Posture Panel:**
   - Readiness badge, resilience score, stale tag
   - 6-cell grid: Primary supplier status, Secondary supplier status, Approved backup suppliers count, Warehouse transfer locations count, Alternate suppliers count, Time remaining (days, red when < 7)

8. **Near-Equivalent Notice** — Carbon `InlineNotification` (kind=info) shown when `near_equivalent_top_two === true`

9. **Mitigation Options Grid:**
   - **Feasible options** — light-green card: "Best option" tag on highest-scored, score bars (schedule 45% / technical 25% / supply 20% / cost 10%), meta (estimated ready date, incremental cost, approval tags), "Request Approval" button
   - **Infeasible options** — light-red card: "Not feasible" tag, Carbon `InlineNotification` (kind=warning) showing `constraint_type` (severity) and constraint reasons list

10. **Approval Panel** (shown when approved, not yet mitigated) — warning icon, option summary, approver name, approved-at timestamp, expiry timestamp

11. **Approval Modal** — triggered by "Request Approval" button:
    - Option summary display
    - Synthetic data warning
    - Approver name input (required)
    - "Approve & execute" and "Cancel" buttons

**Approval Modal Flow:**
```
1. requestApproval(riskId, optionId, summary) → ApprovalRequest { status: PENDING }
2. approveRequest(approvalId, approverName)   → ApprovalRequest { status: APPROVED }
3. Branch on option.type:
   TRANSFER        → executeTransfer({ approval_request_id, risk_id, option_id,
                        source_location_id: 'REGIONAL-WH-DEMO',
                        destination_location_id, material_id, quantity: 1 })
   EXPEDITE        → executeExpedite({ approval_request_id, risk_id, option_id,
                        shipment_id, requested_eta: now + 7 days })
   WAIT / ALTERNATE_SUPPLIER / SUBSTITUTE
                   → markMitigated({ approval_request_id, risk_id, option_id })
```

---

### 4.4 AgentPage — `/agent` (AskBob)

**Purpose:** Conversational interface to the full wxO agent pool. The primary entry point for investigation-driven questions.

**API Calls:**
- `createThread()` → `POST /wxo/v1/threads` (on first user message)
- `sendAndWait(threadId, text, onPoll, maxWaitMs=90000, intervalMs=1500)` → polling wrapper
- `retrieveKnowledge(query, filters)` → `POST /api/knowledge/retrieve` (standalone RAG)
- `demoClearAndSimulate()` → `POST /api/demo/reset` then `POST /api/demo/simulate-delay`

**Components Displayed:**

1. **Agent Roster Sidebar** (5 agent tiles):
   | Agent | Colour | Role Description |
   |---|---|---|
   | Resilience Monitor | blue | Supply network posture |
   | Inventory Agent | teal | Stock & transfer analysis |
   | Procurement Agent | orange | Supplier & sourcing ops |
   | Engineering Knowledge Agent | cyan | Design & specs |
   | Confluent Intelligence Agent | purple | Event evidence & trace |

2. **Suggested Prompts** (grouped):
   - **Supply Resilience:** "What is the resilience posture for CVA-8842?", "Which suppliers are constrained and why?", "What is the port congestion impact on SHP-90017?"
   - **Risk & Mitigation:** "Why is the CVA-8842 shipment at risk?", "Compare the mitigation options for risk RISK-0001", "What approvals are needed to expedite?"
   - **Confluent Event Trace:** "Trace the events behind correlation ID CORR-8842-01", "Which Flink job detected this risk?", "Show me the Kafka event that triggered the risk"

3. **Chat History** (scrolling, auto-scroll to bottom on new message):
   - User messages: right-aligned bubble
   - Agent messages: left-aligned with agent avatar + name + role label; text body; optional stat cards; evidence blocks (`EvidenceBlock` component per evidence item)
   - System messages: centred, gray, italic (e.g., "Routing to Resilience Monitor Agent…")
   - Progress tracker (animated steps list) shown while response is pending
   - Grounded badge per agent message: green "Grounded" if `RAGResponse.grounded === true`, gray "Not grounded" otherwise

4. **Message Input** — textarea (3 rows) + Send button; spinner shown while waiting for response

5. **Demo Button** — "Run Resilience Scenario": triggers `demoClearAndSimulate()` + narrates events via system messages

**Agent Routing** (pattern-matched on message text by primary agent; UI shows which agent is active):

| Pattern | Displayed Agent |
|---|---|
| "resilience" / "posture" / "network" | Resilience Monitor |
| "inventory" / "transfer" / "stock" | Inventory Agent |
| "supplier" / "procurement" / "expedite" | Procurement Agent |
| "engineering" / "spec" / "compatible" / "substitute" | Engineering Knowledge Agent |
| "confluent" / "kafka" / "flink" / "trace" / "event" | Confluent Intelligence Agent |

---

### 4.5 LoginPage — `/login`

**Purpose:** Demo authentication gate before accessing any other route.

**Behaviour:**
- Displays username and password input fields
- Valid credentials: `ops_admin` / `passw0rd`
- On success: store `AuthUser` in React component state; redirect to `/dashboard`
- Session is in-memory only; logout clears state and returns to `/login`
- No persistent token or cookie; refresh requires re-login

---

### 4.6 EventsPage — `/events`

**Purpose:** Confluent Kafka event stream monitor and Flink job status viewer for debugging and demo narrative.

**Components Displayed:**

1. **Topic Summary Cards** (7 cards, clickable to filter feed):
   - `supply.supplier.status.changed`
   - `supply.port.status.changed`
   - `supply.shipment.updated`
   - `supply.approved_vendor.changed`
   - `turnaround.material.required`
   - `supply.risk.detected`
   - `supply.material.readiness.assessed`

2. **Event Controls:** total event count, Live toggle (auto-generates simulated events every 4s when on), "Clear filter" button

3. **Event Feed** (scrolling, newest at top):
   - Kind badge (SUPPLIER_STATUS, PORT_STATUS, SHIPMENT, etc.)
   - Topic label
   - Event key
   - SIM badge (orange) when `simulated: true`
   - Relative timestamp
   - Expand chevron → formatted JSON payload
   - Card border colour by kind

4. **Flink SQL Rules** section: static job cards showing name, RUNNING status indicator, and abbreviated SQL query. Examples:
   - `risk_rule_v2` — detects SUPPLY_DELAY when ETA > required date and stock < required
   - `readiness_assessment_job` — computes `SupplyChainResilienceProfile` on supplier/port events

---

### 4.7 AvlLiveTab

**Purpose:** Live Approved Vendor List (AVL) feed sourced from the `crag_rag_agent_v1` continuous RAG agent, displayed as a tab within the Events or Shipments page context.

**Data Source:** `crag.avl.changed` Kafka topic via Confluent MCP  
**Refresh:** On mount and polling every 30s  
**Shows:** Supplier ID, material ID, AVL status, constraint type, constraint severity, effective date, tier classification

---

### 4.8 ShipmentsPage — `/shipments`

**Purpose:** Inbound logistics tracker showing shipment status, delays, and material readiness register.

**API Calls:**
- `getRisks()` → `GET /api/risks`
- `getShipment(shipmentId)` → `GET /api/shipments/:shipmentId` (batched via `Promise.allSettled` for all known demo shipment IDs)

**Components Displayed:**

1. **KPI Grid** (6 columns): Delayed Shipments, In Transit, Critical Risks, Open Risks, Materials At Risk, Materials Confirmed

2. **Active Risk Events Table:** Risk ID, Severity, Material, Work Package, Type, Status, Detected At. Clickable → `/risks/:riskId`

3. **Active Shipments Table:** Shipment ID, Material, Status, Supplier, Original ETA, Current ETA (red if delayed), Delay tag, Port/Location

4. **Material Readiness Register** (static demo data, 5 materials):
   - CVA-8842 — AT RISK
   - GS-7701 — CONFIRMED
   - BP-4410 — CONFIRMED
   - SV-3320 — CONFIRMED
   - TC-8800 — UNKNOWN

---

### 4.9 ConfigurationPage — `/configuration`

**Purpose:** Administration panel for Confluent connection settings, backend API configuration, and demo scenario controls.

**API Calls:**
- `demoClearAndSimulate()` → `POST /api/demo/reset` + `POST /api/demo/simulate-delay`
- `demoReset()` → `POST /api/demo/reset`

**3-Tab Layout:**

| Tab | Contents |
|---|---|
| **Confluent** | Connection status pill + test button; REST Proxy URL, API key, secret; read mode dropdown (auto / direct / trace); timeout, lookback, max-records; allowed topics textarea; Schema Registry URL + credentials |
| **Backend API** | TSCI Backend URL; wxO Base URL + API Key; Demo Mode toggle; Log Level dropdown; Demo Scenario section with "Simulate Delay Scenario" button + "Reset Demo" button (with loading state and result toast) |
| **System** | Embedding model URL/model name; OpenSearch host/credentials (placeholder for future admin) |

**Features:** Status pills (Connected / Disconnected / Not tested), test-connection buttons, toast notifications on save/test, editable fields with helper text hints.

---

## 5. Shared Components

### 5.1 `EvidenceBlock`

**Path:** `ui/src/components/shared/EvidenceBlock.tsx`  
**Props:** `{ evidence: Evidence }`  
**Renders:** Document title, revision tag, section tag, relevance percentage tag (color-coded), verbatim excerpt, evidence ID and document ID meta-line.

### 5.2 `ReadinessBadge`

**Path:** `ui/src/components/shared/ReadinessBadge.tsx`  
**Props:** `{ status: ReadinessStatus }`  
**Renders:** Carbon Tag: `CONFIRMED`=green, `AT_RISK`=amber, `CRITICAL`=red, `UNKNOWN`=gray.

### 5.3 `ScoreBar`

**Path:** `ui/src/components/shared/ScoreBar.tsx`  
**Props:** `{ label: string; value: number; weight: number }`  
**Renders:** Label + weight %, horizontal bar (green < 30, amber < 60, red ≥ 60), numeric value.

### 5.4 `SeverityTag`

**Path:** `ui/src/components/shared/SeverityTag.tsx`  
**Props:** `{ severity: RiskSeverity }`  
**Renders:** Carbon Tag: `CRITICAL`=red, `HIGH`=magenta, `MEDIUM`=warm-gray, `LOW`=green.

---

## 6. API Client

**Path:** `ui/src/api/client.ts`  
**Base URL:** `/api` (proxied to `http://localhost:3001` by Vite)  
**Client:** Axios instance  
**Headers:** `Content-Type: application/json`  
**Correlation ID:** Injected on every request via `x-correlation-id` header (retrieved from `sessionStorage`); response header value captured and stored for next request.

### 6.1 Core Read Endpoints

| Function | Method | Path | Response |
|---|---|---|---|
| `getRisks()` | GET | `/risks` | `{ risks: RiskEvent[], total: number }` |
| `getRisk(id)` | GET | `/risks/:id` | `{ risk: RiskEvent }` |
| `getRiskOptions(id)` | GET | `/risks/:id/options` | `{ ranked_options: MitigationOption[], near_equivalent_top_two: boolean }` |
| `getShipment(id)` | GET | `/shipments/:id` | `{ shipment: Shipment }` |
| `getWorkPackage(id)` | GET | `/work-packages/:id` | `{ work_package: WorkPackage, requirements: MaterialRequirement[] }` |
| `retrieveKnowledge(query, filters)` | POST | `/knowledge/retrieve` | `RAGResponse` |

### 6.2 Resilience Endpoints

| Function | Method | Path | Query Params |
|---|---|---|---|
| `getResilienceProfile(wpId, matId)` | GET | `/resilience/profile` | `work_package_id`, `material_id` |
| `getAvlStatus(matId)` | GET | `/resilience/avl` | `material_id` |
| `getPortStatus(portCode, matId?)` | GET | `/resilience/port-status` | `port_code`, `material_id?` |
| `getSupplierResilienceStatus(suppId, matId?)` | GET | `/resilience/supplier-status` | `supplier_id`, `material_id?` |

### 6.3 Write (Action) Endpoints

| Function | Method | Path | Body |
|---|---|---|---|
| `requestApproval(riskId, optionId, summary)` | POST | `/actions/approval-requests` | `{ risk_id, option_id, recommendation_summary }` |
| `approveRequest(approvalId, approver)` | POST | `/actions/approval-requests/:id/approve` | `{ approver }` |
| `rejectRequest(approvalId, approver)` | POST | `/actions/approval-requests/:id/reject` | `{ approver }` |
| `executeTransfer(payload)` | POST | `/actions/inventory-transfer` | `{ approval_request_id, risk_id, option_id, source_location_id, destination_location_id, material_id, quantity }` |
| `executeExpedite(payload)` | POST | `/actions/supplier-expedite` | `{ approval_request_id, risk_id, option_id, shipment_id, requested_eta }` |
| `markMitigated(payload)` | POST | `/actions/mark-mitigated` | `{ approval_request_id, risk_id, option_id }` |

### 6.4 Demo Endpoints

| Function | Method | Path | Body |
|---|---|---|---|
| `demoClearAndSimulate()` | POST (×2) | `/demo/reset` + `/demo/simulate-delay` | `{ shipment_id: 'SHP-90017', requirement_id: 'MR-7781' }` |
| `demoReset()` | POST | `/demo/reset` | — |

---

## 7. watsonx Orchestrate Integration

**Path:** `ui/src/api/wxo.ts`  
All wxO calls route through `/wxo` Vite proxy → `VITE_WXO_BASE_URL`.

### 7.1 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_WXO_BASE_URL` | watsonx Orchestrate API base URL | For wxO chat |
| `VITE_WXO_API_KEY` | API key for wxO authentication | For wxO chat |
| `VITE_WXO_AGENT_NAME` | Primary agent name (default: `tsci_primary_agent`) | For wxO chat |
| `VITE_WXO_CRAG_AGENT_NAME` | Continuous RAG agent name (default: `crag_rag_agent_v1`) | For AVL live tab |
| `VITE_WXO_USERNAME` | Auth username (alternative to API key) | Optional |
| `VITE_WXO_PASSWORD` | Auth password | With username |
| `VITE_WXO_TENANT_ID` | Tenant ID (appended to auth URL) | Optional |

`wxoConfigured()` returns `true` if both `VITE_WXO_BASE_URL` and (`VITE_WXO_API_KEY` or `VITE_WXO_USERNAME`) are set.

### 7.2 Authentication

1. `POST /wxo/v1/auth/token` with `application/x-www-form-urlencoded`: `username=...&password=...&grant_type=password`
2. JWT cached in module-level `_token`; refreshed 2 minutes before expiry (~1 hour TTL)
3. On 401 response: clear cache, retry once
4. All requests: `Authorization: Bearer <token>`

### 7.3 Thread Lifecycle

| Step | Call | Endpoint |
|---|---|---|
| 1 | `createThread()` | `POST /wxo/v1/threads` → `{ id, status, agent_id }` |
| 2 | `sendMessage(threadId, text)` | `POST /wxo/v1/threads/:id/messages` |
| 3 | `getThread(threadId)` | `GET /wxo/v1/threads/:id` (status poll) |
| 4 | `listMessages(threadId)` | `GET /wxo/v1/threads/:id/messages` → `{ items: WxoMessage[] }` |

### 7.4 `sendAndWait` Polling

```typescript
sendAndWait(threadId, text, onPoll?, maxWaitMs=90_000, intervalMs=1_500)
```

- Snapshots message count before sending
- Sends message, then polls every `intervalMs`
- Calls `onPoll(messages)` on each tick (used to update progress indicator)
- Resolves when `thread.status === 'ready'` AND new assistant message detected
- Throws `WxoError` if `maxWaitMs` exceeded

---

## 8. Vite Proxy Configuration

```typescript
// ui/vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': 'http://localhost:3001',          // FastAPI backend
    '/iam': {                                  // IBM IAM token endpoint
      target: 'https://iam.cloud.ibm.com',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/iam/, ''),
    },
    '/wxo': {                                  // watsonx Orchestrate
      target: process.env.VITE_WXO_BASE_URL,
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/wxo/, ''),
    },
  },
}
```

---

## 9. Carbon Component Usage Guidelines

| Pattern | Carbon Component |
|---|---|
| Risk severity tags | `Tag` with `type` prop mapped to RiskSeverity |
| Notification banners | `InlineNotification` (kind: warning / error / info) |
| Data tables | `DataTable` + `TableToolbar` |
| Modals (approval) | `Modal` with controlled `open` state |
| Progress indicator | `ProgressIndicator` + `ProgressStep` |
| Status pills | `Tag` with custom `className` for status colours |
| Loading state | `InlineLoading` in buttons; `DataTableSkeleton` on load |
| Expandable rows | Accordion-style `Tile` with chevron icon toggle |
| Toast notifications | `ToastNotification` via portal |
| Sidebar navigation | `SideNav`, `SideNavItems`, `SideNavLink` |

Do not introduce non-Carbon component libraries (e.g. MUI, Ant Design). Use Carbon tokens for all colour and spacing overrides.

---

## 10. Accessibility Requirements

| Requirement | Implementation |
|---|---|
| All interactive elements keyboard-navigable | Carbon components satisfy this by default; custom components must include `tabIndex` and keyboard handlers |
| All images and icons have `aria-label` | Carbon icon components receive `aria-label` prop |
| Colour is never the sole indicator of status | Status tags always include text label alongside colour |
| Stale warnings are announced to screen readers | Use `aria-live="polite"` on stale warning notification |
| Approval modal traps focus while open | Carbon `Modal` handles focus trap natively |
| Error messages are associated with inputs | Carbon `FormItem` with `invalid` + `invalidText` props |
| Page title updates on route change | `document.title` updated in each page `useEffect` |

---

## 11. UX Rules

1. **Never display synthetic data as real Shell operational data.** Label all demo records clearly with a "SYNTHETIC DATA ONLY" badge or note.
2. **Show source timestamps** on all live data: `event_time`, `assessed_at`, `evaluated_at`, `created_at`.
3. **Show evidence for knowledge-grounded claims.** Render `EvidenceBlock` for each evidence item; always show relevance score.
4. **Show "Insufficient evidence" if `grounded === false`.** Never render an unsupported answer as fact.
5. **Require explicit approval interaction before any write executes.** Approval modal with approver name input is mandatory; no shortcuts.
6. **Display stale-data warning if resilience profile age > 300 seconds.** Shown in dashboard strip and risk detail panel.
7. **Infeasible options must show constraint type and severity.** Red "Not feasible" tag + warning notification with full reason list.
8. **Constrained suppliers must never appear as feasible options.** `feasible: false` on any ALTERNATE_SUPPLIER option where supplier has HIGH/CRITICAL constraint.
9. **Port disruption ticker shown only for HIGH or CRITICAL severity.** Ticker is absent when `severity === 'LOW'` or `status === 'NO_DISRUPTION'`.
10. **All demo/simulated events show SIM badge** (orange) to distinguish them from real events.
11. **Progress indicator on risk detail reflects actual approval state**, not optimistic pre-execution state.

---

## 12. Business Requirements Traceability

| Requirement | Spec | Satisfied By |
|---|---|---|
| FR-015 Display active risks in a control tower | 01 | `ActiveRisksPage`, `DashboardPage` |
| FR-016 Support conversational investigation through wxO | 01 | `AgentPage` + wxO integration |
| FR-023 Dashboard shows live resilience posture | 01 | Resilience posture strip on `DashboardPage` |
| NFR-010 Demo isolation; all data clearly synthetic | 01 | UX Rule 1 + SYNTHETIC DATA badge |
| SC-006 End-to-end correlation ID visible | 01 | `x-correlation-id` header + displayed in risk cards |
| SC-007 UI shows event, risk, evidence, recommendation, approval, final status | 01 | `EventsPage`, `RiskDetailPage`, `AgentPage` |

---

## 13. Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-UI-01 | All 9 routes render without TypeScript errors | `npm run typecheck` passes |
| AC-UI-02 | Port disruption ticker is absent when severity is LOW | UI test: mock LOW port status; verify no ticker |
| AC-UI-03 | Approval modal requires approver name; "Approve & execute" is disabled without it | UI test: click without name; verify button disabled |
| AC-UI-04 | Stale profile warning appears when `profileAgeSecs > 300` | UI test: mock `profileAgeSecs = 400`; verify warning |
| AC-UI-05 | Infeasible option card shows constraint type and reason | UI test: mock infeasible option; verify warning notification content |
| AC-UI-06 | Agent page shows "Insufficient evidence" when `grounded: false` | UI test: mock RAGResponse with `grounded: false` |
| AC-UI-07 | `sendAndWait` throws `WxoError` after `maxWaitMs` | Unit test: mock long-running thread; verify error after 90s |
