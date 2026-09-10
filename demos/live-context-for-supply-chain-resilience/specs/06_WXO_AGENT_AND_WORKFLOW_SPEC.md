# wxO Agent and Workflow Specification

**Spec:** 06_WXO_AGENT_AND_WORKFLOW_SPEC.md  
**Version:** 2.0  
**Status:** Approved  
**Classification:** SYNTHETIC DEMO — not real Shell or Pearl GTL operational data

---

## 1. Purpose

This specification defines the IBM watsonx Orchestrate (wxO) agent architecture, inter-agent routing rules, tool assignments, investigation orchestration, and deterministic approval workflow for the Turnaround Supply Chain Intelligence (TSCI) solution.

The agent layer translates structured supply-chain events and tool outputs into explainable, evidence-backed recommendations that a human planner can understand and act on. No agent in this system may fabricate data, execute write actions without approval, or omit resilience posture context from a recommendation.

---

## 2. Agent Architecture Overview

```
User / Control Tower UI
         │
         ▼
┌─────────────────────────────────────────┐
│        tsci_primary_agent               │  ReAct style, routes to collaborators
│        (llama-3.2-90b-vision-instruct   │  or granite-3.3-8b-instruct fallback)
└──────────────┬──────────────────────────┘
               │
       ┌───────┼───────────────────────────────────┐
       │       │         │           │              │
       ▼       ▼         ▼           ▼              ▼
  Risk   Inventory  Procurement  Resilience   Engineering
  Invest  Agent      Agent        Monitor      Knowledge
  Agent                           Agent        Agent
                                    │
                              MitigationAgent
                                    │
                         Confluent Intelligence
                              Agent (pack)
```

All 8 agents are registered in the same wxO environment. The primary agent orchestrates the investigation; collaborators are called as sub-agents or via tool delegation depending on the wxO deployment topology.

---

## 3. Primary Agent Specification

### 3.1 Identity

| Property | Value |
|---|---|
| **Name** | `tsci_primary_agent` |
| **Title** | Turnaround Supply Chain Risk Agent |
| **Platform** | IBM watsonx Orchestrate |
| **Style** | `react` |
| **Primary Model** | `meta-llama/llama-3-2-90b-vision-instruct` |
| **Fallback Model** | `ibm/granite-3-3-8b-instruct` |

### 3.2 Purpose

Investigate supply-chain risks affecting turnaround material readiness, coordinate specialised tools and agents, explain business impact including the full supply-chain resilience posture across the approved vendor network, recommend evidence-backed mitigation, and request human approval before any write action executes.

### 3.3 Model Configuration

| Parameter | Value |
|---|---|
| `temperature` | 0.1 |
| `max_tokens` | 2048 |
| `parallel_tool_calls` | `true` |
| `stream` | `false` |

### 3.4 Never-Do Rules (Primary Agent)

The primary agent MUST NEVER:

1. Fabricate inventory quantities, locations, or ETAs
2. Fabricate supplier lead times or constraint status
3. Claim engineering compatibility without retrieved evidence (`grounded: true`)
4. Execute any write tool (`request_mitigation_approval`, `execute_inventory_transfer`, `execute_supplier_expedite`) without a prior `APPROVED` approval record
5. Hide conflicting evidence — conflicting evidence must be surfaced and escalated
6. Present a supplier with an active `HIGH` or `CRITICAL` constraint as a feasible sourcing option
7. Omit resilience posture context from any recommendation
8. Recommend a substitute material without evidence from `DOC-SUB-001` or `DOC-ENG-001`

---

## 4. Collaborator Agent Specifications

### 4.1 RiskInvestigationAgent

| Property | Value |
|---|---|
| **Name** | `risk_investigation_agent` |
| **Responsibility** | Retrieve risk facts, shipment details, material requirements, and work package context. Establish the timeline and quantify the shortage |
| **Tools Assigned** | `get_risk`, `get_shipment`, `get_work_package` |
| **Routing Trigger** | User asks why the risk matters; primary agent needs baseline facts at start of investigation |

**Outputs required:**
- Risk ID, severity, event time
- Shipment current ETA vs. required date → delay in days
- Shortage quantity (required − available unreserved)
- Work package ID, planned start, affected asset

---

### 4.2 InventoryAgent

| Property | Value |
|---|---|
| **Name** | `inventory_agent` |
| **Responsibility** | Find all available unreserved inventory across permitted warehouse locations; exclude reserved/committed quantities; identify future demand conflicts |
| **Tools Assigned** | `get_inventory_options` |
| **Routing Trigger** | User asks where the material exists or whether a transfer is possible |

**Outputs required:**
- List of locations with available quantity ≥ shortage
- Earliest date material could be at destination
- Any demand conflicts that would reduce available quantity

---

### 4.3 ProcurementAgent

| Property | Value |
|---|---|
| **Name** | `procurement_agent` |
| **Responsibility** | Find approved supplier alternatives with live constraint status; exclude suppliers with active HIGH/CRITICAL constraints from the feasible set; surface constrained supplier status with reason and estimated resolution; identify expediting possibilities for unconstrained suppliers only |
| **Tools Assigned** | `get_supplier_options`, `get_supplier_resilience_status` |
| **Routing Trigger** | User asks about supplier or expedite options; primary agent needs sourcing alternatives |

**Outputs required:**
- List of AVL-approved suppliers filtered by constraint status
- For each unconstrained supplier: tier, lead time, expedite feasibility
- For each constrained supplier: constraint type, severity, estimated resolution date
- Reason constrained suppliers are excluded from feasible options

---

### 4.4 ResilienceMonitorAgent

| Property | Value |
|---|---|
| **Name** | `resilience_monitor_agent` |
| **Responsibility** | Provide the complete supply chain resilience picture for a critical material. Consumes the live `SupplyChainResilienceProfile` and answers questions about the full supplier network, not just the primary shipment |
| **Tools Assigned** | `get_resilience_profile`, `get_avl_status`, `get_port_status` |
| **Routing Triggers** | User asks about supply network resilience; user asks why all suppliers are constrained; user asks about port congestion impact; user asks about AVL status changes; user asks which suppliers remain unconstrained |

**Outputs required:**
- `SupplyChainResilienceProfile`: readiness status, resilience score, unconstrained supplier count
- AVL status for all approved tiers (PRIMARY, SECONDARY, TERTIARY, SPOT)
- Port disruption status for relevant ports
- Profile age in seconds; STALE warning if `> 300`

**ALWAYS included** in full investigation chain to provide resilience context even when the primary question is about inventory or procurement.

---

### 4.5 EngineeringKnowledgeAgent

| Property | Value |
|---|---|
| **Name** | `engineering_knowledge_agent` |
| **Responsibility** | Retrieve engineering and procurement evidence from the RAG corpus; validate whether substitution or compatibility claims are supported by approved documentation |
| **Tools Assigned** | `retrieve_enterprise_knowledge` |
| **Routing Trigger** | User asks about compatibility, substitution, engineering specifications, or procurement policy |

**Outputs required:**
- RAGResponse with `grounded` flag
- Evidence items with `evidenceId`, `documentId`, `revision`, `section`, `excerpt`
- If `grounded: false`: explicit statement that evidence is insufficient; do not claim compatibility

---

### 4.6 MitigationAgent

| Property | Value |
|---|---|
| **Name** | `mitigation_agent` |
| **Responsibility** | Build feasible mitigation options using only unconstrained approved sources and verified inventory; call the deterministic scoring service; summarise tradeoffs including the resilience dimension |
| **Tools Assigned** | `evaluate_mitigation_options` |
| **Routing Trigger** | All preceding investigation agents have been called; user asks "what should we do?" or primary agent needs scored options |

**Outputs required:**
- Ranked list of mitigation options: WAIT, EXPEDITE, TRANSFER, ALTERNATE_SUPPLIER, SUBSTITUTE
- Score breakdown per option: schedule (45%), technical (25%), supply (20%), cost (10%)
- Infeasibility reason for any option excluded from the feasible set
- `near_equivalent_top_two` flag if top two options have scores within 5%

---

### 4.7 Confluent Intelligence Agent

| Property | Value |
|---|---|
| **Name** | `confluent_intelligence_agent` |
| **Responsibility** | Answer questions about Confluent event streams, Kafka topic contents, Flink job attribution, and event causality chains. Provides the event-level evidence trail for how a risk was detected |
| **Tools Assigned** | 8 Confluent pack tools (via `confluent_mcp_v1` toolkit) |
| **Tools** | `listTopics`, `getMetadata`, `queryData` (× topics: `supply.risk.detected`, `supply.shipment.updated`, `supply.supplier.status.changed`, `supply.port.status.changed`, `supply.approved_vendor.changed`, `turnaround.material.required`, `supply.material.readiness.assessed`, `crag.*` topics) |
| **Routing Trigger** | User asks about Confluent events, Kafka causality, Flink job attribution, event trace by correlation ID; or any "show me the raw events" request |

---

## 5. Tool Assignment Matrix

| Tool | Primary | RiskInv | Inventory | Procurement | Resilience | EngKnow | Mitigation | Confluent |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `get_risk` | | ✓ | | | | | | |
| `get_shipment` | | ✓ | | | | | | |
| `get_work_package` | | ✓ | | | | | | |
| `get_inventory_options` | | | ✓ | | | | | |
| `get_supplier_options` | | | | ✓ | | | | |
| `retrieve_enterprise_knowledge` | | | | | | ✓ | | |
| `evaluate_mitigation_options` | | | | | | | ✓ | |
| `request_mitigation_approval` | ✓ | | | | | | | |
| `execute_inventory_transfer` | ✓ | | | | | | | |
| `execute_supplier_expedite` | ✓ | | | | | | | |
| `get_resilience_profile` | | | | | ✓ | | | |
| `get_avl_status` | | | | | ✓ | | | |
| `get_port_status` | | | | | ✓ | | | |
| `get_supplier_resilience_status` | | | ✓ | ✓ | | | | |
| `listTopics` | | | | | | | | ✓ |
| `getMetadata` | | | | | | | | ✓ |
| `queryData` (×6 topics) | | | | | | | | ✓ |

Write tools (`request_mitigation_approval`, `execute_inventory_transfer`, `execute_supplier_expedite`) are assigned only to the primary agent. Collaborators have read-only tool access.

---

## 6. Routing Rules

The primary agent routes to collaborators based on the following conditions, evaluated in order:

| Priority | Condition | Delegate |
|---|---|---|
| 1 | User asks about Confluent events, Kafka topics, Flink jobs, event trace, correlation ID in event stream | `confluent_intelligence_agent` |
| 2 | User asks why the risk matters / what happened / what is the baseline situation | `risk_investigation_agent` |
| 3 | User asks where material exists / inventory locations / transfer feasibility | `inventory_agent` |
| 4 | User asks about suppliers / expedite options / sourcing alternatives | `procurement_agent` |
| 5 | User asks about resilience posture / supply network / constrained suppliers / port congestion / AVL changes | `resilience_monitor_agent` |
| 6 | User asks about compatibility / substitution / engineering specs / procurement policy | `engineering_knowledge_agent` |
| 7 | User asks "what should we do?" / requests recommendation / asks for scored options | Full investigation chain (see §7) |
| 8 | User asks to approve or execute a mitigation | Approval workflow (see §8) |

---

## 7. Full Investigation Orchestration Chain

When the user asks a comprehensive question ("What should we do about this risk?"), the primary agent calls the following agents **in sequence**, using each agent's output as input context for the next:

```
Step 1: risk_investigation_agent
  → Output: timeline, shortage, work package context

Step 2: inventory_agent
  → Input: material_id, shortage_qty from Step 1
  → Output: available locations, transfer feasibility

Step 3: procurement_agent
  → Input: material_id from Step 1
  → Output: approved unconstrained suppliers, expedite options

Step 4: resilience_monitor_agent   ← ALWAYS called; provides network-wide context
  → Input: work_package_id, material_id
  → Output: resilience profile, AVL status, port status

Step 5: engineering_knowledge_agent   ← Called if substitution signals present
  → Input: material_id, query about compatibility/substitution
  → Output: RAGResponse with grounded evidence

Step 6: mitigation_agent
  → Input: all outputs from Steps 1–5
  → Output: ranked mitigation options with scores and resilience context
```

The primary agent synthesises all outputs into the standard response format (§9) and presents the recommendation with required approval gate.

---

## 8. Deterministic Approval Workflow

### 8.1 Overview

No write action executes without an `APPROVED` approval record. The approval record contains a SHA-256 hash of the mitigation option at approval time. If the option has changed since approval (re-scored, constraint status changed), execution MUST be refused.

### 8.2 Workflow Steps

| Step | Action | Agent/System | Description |
|---|---|---|---|
| 1 | `revalidate_current_risk_state` | `risk_investigation_agent` | Re-fetch risk; confirm it is still OPEN/INVESTIGATING (not already mitigated by another path) |
| 2 | `revalidate_option_feasibility` | `mitigation_agent` | Re-score the chosen option; confirm it is still feasible |
| 3 | `revalidate_supplier_constraint_status` | `procurement_agent` | Re-check live constraint state for the chosen supplier; refuse if constraint has worsened to HIGH/CRITICAL since initial investigation |
| 4 | `revalidate_avl_status` | `resilience_monitor_agent` | Re-check AVL for the chosen supplier; refuse if supplier has been removed from the AVL since investigation |
| 5 | `request_mitigation_approval` | Primary agent (write tool) | Create `ApprovalRequest` with option snapshot hash; status → `PENDING` |
| 6 | `wait_for_human_approval` | Human via UI | Human reviews recommendation, constraint context, and evidence; provides approver name; approves or rejects |
| 7 | Execute by type | Primary agent | Branch on approved option type (see below) |
| 8 | `publish_risk_status_change` | Backend | Update risk status; emit `supply.risk.detected` with updated status; return execution summary |

### 8.3 Execution Branch

| Option Type | Action | Pre-condition |
|---|---|---|
| `TRANSFER` | `execute_inventory_transfer` | Re-check source inventory still available; quantity ≥ shortage |
| `EXPEDITE` | `execute_supplier_expedite` | Re-check supplier constraint is `CLEARED`; supplier is still on AVL |
| `SUBSTITUTE` | Stop; require engineering approval | Substitution MUST go through full engineering approval process; agent cannot auto-execute |
| `WAIT` | Record decision only | No action taken; risk status → `MITIGATED` with WAIT rationale |
| `ALTERNATE_SUPPLIER` | `execute_supplier_expedite` | Same pre-condition as EXPEDITE |

### 8.4 Hash Integrity

```
optionHash = SHA-256(JSON.stringify(option_snapshot_at_approval_time))
```

At execution time:
```python
current_hash = sha256(json.dumps(current_option, sort_keys=True))
if current_hash != stored_hash:
    raise IntegrityError("Option changed since approval — re-approval required")
```

### 8.5 Approval Expiry

`ApprovalRequest.expiry` = `approvedAt + 24 hours`. Execution after expiry is refused; a new approval request must be raised with a fresh option snapshot.

---

## 9. Agent Response Format Standard

Every primary agent response to a risk investigation MUST include all of the following sections:

### 9.1 Section Definitions

| Section | Purpose | Required? |
|---|---|---|
| **Risk** | State the risk ID, severity, and one-sentence summary of what is at stake | Always |
| **Why it matters** | Business impact: which work package, which asset, turnaround schedule exposure in days | Always |
| **Facts** | Structured facts from tool outputs: ETA, required date, delay days, shortage qty, work package details | Always |
| **Resilience Posture** | Network-wide supplier picture: constrained/unconstrained counts, port status, AVL tier status, resilience score | Always |
| **Evidence** | Retrieved document evidence with `evidenceId`, `title`, `revision`, `excerpt` | When knowledge-grounded claims are made |
| **Options** | Scored mitigation options with feasibility, score breakdown, and infeasibility reasons for excluded options | When options are available |
| **Recommendation** | The agent's top recommendation with full justification (see §9.2) | Always when options available |
| **Required approval** | Statement of what action requires human approval and which approver has authority | Always when recommending a write action |

### 9.2 Recommendation Must Include

Every recommendation MUST contain all of the following:

| Field | Description |
|---|---|
| `chosen_option` | Option ID and type (TRANSFER, EXPEDITE, etc.) |
| `reasons` | Prose justification referencing facts, scores, and evidence |
| `major_tradeoffs` | What is given up or risked by choosing this option over alternatives |
| `evidence_ids` | List of `evidenceId` values supporting any knowledge-grounded claim |
| `score_breakdown` | Scores: schedule (45%), technical (25%), supply (20%), cost (10%) |
| `uncertainties` | Known unknowns (e.g., supplier capacity not yet confirmed) |
| `resilience_context` | Network-level context object (see below) |

### 9.3 Resilience Context Object (Required in Every Recommendation)

```json
{
  "primary_supplier_status": "CONSTRAINED — QUALITY_HOLD",
  "secondary_supplier_status": "AVAILABLE",
  "unconstrained_approved_supplier_count": 1,
  "resilience_score": 38,
  "port_disruptions_affecting_supply": [
    { "port": "SGSIN", "severity": "HIGH", "disruption_type": "CONGESTION" }
  ]
}
```

---

## 10. Never-Do Rules (All Agents)

These rules apply to every agent in the TSCI wxO deployment:

| Rule | Description |
|---|---|
| ND-01 | Never fabricate inventory quantities, ETAs, lead times, or supplier status |
| ND-02 | Never claim a part is compatible or substitutable without `grounded: true` RAG evidence |
| ND-03 | Never present a supplier with `constraint_severity: HIGH` or `CRITICAL` as feasible |
| ND-04 | Never execute a write tool without a valid, non-expired `APPROVED` ApprovalRequest |
| ND-05 | Never hide conflicting evidence; surface all conflicts explicitly |
| ND-06 | Never omit the `Resilience Posture` section from a risk investigation response |
| ND-07 | Never recommend autonomous engineering substitution; always require human engineering sign-off |
| ND-08 | Never present synthetic demo data as real Shell or Pearl GTL operational data |
| ND-09 | Never answer a question about real system credentials, real financial exposure, or real personnel data |
| ND-10 | Never retry a failed write tool without surfacing the failure to the user |

---

## 11. Business Requirements Traceability

| Requirement | Spec | Satisfied By |
|---|---|---|
| FR-005 Retrieve approved supplier alternatives | 01 | ProcurementAgent + `get_supplier_options` |
| FR-007 Retrieve knowledge through RAG | 01 | EngineeringKnowledgeAgent + `retrieve_enterprise_knowledge` |
| FR-009 Generate at least three mitigation classes | 01 | MitigationAgent + `evaluate_mitigation_options` |
| FR-010 Rank mitigation options using deterministic inputs | 01 | Deterministic scoring service via `evaluate_mitigation_options` |
| FR-012 Require human approval for any write/action | 01 | Steps 5–6 of approval workflow; write tools on primary agent only |
| FR-013 Execute only approved deterministic workflow steps | 01 | SHA-256 hash integrity check at execution time |
| FR-025 Agent must answer resilience posture question | 01 | ResilienceMonitorAgent always included in full investigation |
| NFR-002 Recommendation includes facts, evidence, score breakdown | 01 | §9.2 Recommendation must-include list |
| SC-004 Substitute not recommended without evidence | 01 | ND-02 + GR-01 in RAG spec |
| SC-005 Write action cannot execute before approval | 01 | Approval workflow §8 |
| SC-009 Dashboard shows constrained/unconstrained supplier count | 01 | ResilienceMonitorAgent `get_resilience_profile` |

---

## 12. Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-AGENT-01 | Primary agent uses `react` style and calls collaborators in documented sequence | wxO agent config inspection |
| AC-AGENT-02 | No write tool executes without a valid `APPROVED` ApprovalRequest | Integration test: attempt execution without approval; verify rejection |
| AC-AGENT-03 | Recommendation always includes `resilience_context` with unconstrained supplier count | End-to-end test with CVA-8842 scenario |
| AC-AGENT-04 | Agent refuses to claim CVA-8842 substitutability without RAG evidence | Demo test: ask "can CVA-8842 be substituted?" with empty corpus |
| AC-AGENT-05 | Constrained supplier never appears in feasible options set | Unit test: inject HIGH-constraint supplier; verify excluded from scored options |
| AC-AGENT-06 | SHA-256 hash mismatch at execution time returns `IntegrityError` | Unit test: modify option after approval; verify execution refused |
| AC-AGENT-07 | Approval expires 24 hours after `approvedAt`; expired approvals refused | Unit test: back-date `approvedAt`; verify expiry check |
