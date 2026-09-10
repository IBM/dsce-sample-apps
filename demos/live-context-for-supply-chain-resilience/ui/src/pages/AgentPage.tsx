// ui/src/pages/AgentPage.tsx
// Supply Resilience agent page — 5 tabs: Today / Patterns / Ask / AVL Live / My Board
// All tabs show use-case data for CVA-8842 / TW-2047 / Pearl GTL Turnaround
// AVL Live tab: integrates crag_rag_agent_v1 via watsonx Orchestrate for live Confluent RTCE queries

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { InlineNotification } from '@carbon/react';
import { wxoConfigured } from '../api/wxo';
import { retrieveKnowledge, demoClearAndSimulate } from '../api/client';
import { EvidenceBlock } from '../components/shared/EvidenceBlock';
import type { Evidence } from '../types';
import { AvlLiveTab } from './AvlLiveTab';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'error';
  text: string;
  toolCalls?: Array<{ name: string; id: string }>;
  evidence?: Evidence[];
  grounded?: boolean;
  confidence?: number;
  agentLabel?: string;
  // animated progress steps (shown while loading, cleared on answer)
  progressSteps?: ProgressStep[];
  // structured stat card (agent only)
  statCard?: { label: string; value: string | number; delta?: string; deltaPositive?: boolean; context?: string };
}

interface HistoryEntry { id: string; title: string; ago: string }

// ── Suggested prompts ──────────────────────────────────────────────────────────

const PROMPTS: Array<{ group: string; items: string[] }> = [
  {
    group: 'Supply Resilience',
    items: [
      'What is the resilience posture of CVA-8842 across the supply network?',
      'Why are both the primary and secondary suppliers constrained?',
      'Which approved suppliers remain unconstrained?',
      'How is port congestion at SGSIN affecting supply options?',
    ],
  },
  {
    group: 'Risk & Mitigation',
    items: [
      'Why is this material risk critical for TW-2047?',
      'What is the latest ETA for shipment SHP-90017?',
      'Compare inventory transfer vs alternate supplier options.',
      'What requires human approval before execution?',
    ],
  },
  {
    group: 'Confluent Event Trace',
    items: [
      'Show me the Confluent event trace for correlation ID DEMO-TW2047-001.',
      'What Kafka events caused risk RISK-001 to be detected?',
      'Which Flink job derived the supply.risk.detected event?',
      'Was the event evidence retrieved directly from Confluent or the trace bridge?',
    ],
  },
];

// AVL Live tab prompts (sent to crag_rag_agent_v1 via watsonx Orchestrate)
export const CRAG_PROMPTS: string[] = [
  'Which suppliers are currently approved for material CVA-8842?',
  'Show the full AVL change history for supplier SUP-205 and material CVA-8842.',
  'Why was SUP-205 suspended, and has it been reinstated?',
  'Trace all AVL events for correlation ID DEMO-TW2047-001.',
  'Who authorised the fast-track emergency approval for SUP-205?',
  'What is the current approval status of each supplier for CVA-8842?',
  'Show all suspended suppliers in the approved-vendor change stream.',
  'Which suppliers were approved during the January 2026 AVL review?',
  'Re-fetch the latest vendor changes for CVA-8842 and summarise what changed.',
];

// ── Agent registry ────────────────────────────────────────────────────────────

interface AgentDef {
  key: string;           // internal key matches agentLabel prefix
  displayName: string;   // human-readable name shown in chat
  role: string;          // one-line description shown below name
  color: string;         // CSS custom-property or hex
  iconPath: string;      // SVG path data for the 20×20 icon
}

const AGENT_REGISTRY: AgentDef[] = [
  {
    key: 'RESILIENCEMONITORAGENT',
    displayName: 'Resilience Monitor',
    role: 'Supply network posture',
    color: '#7c9ef8',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z',
  },
  {
    key: 'INVENTORYAGENT',
    displayName: 'Inventory Agent',
    role: 'Stock & transfer analysis',
    color: '#2dd4bf',
    iconPath: 'M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-1 11H5V9h14v9zM8 12H5v2h3v-2zm6 0H10v2h4v-2zm5-10H3v2h16V2z',
  },
  {
    key: 'PROCUREMENTAGENT',
    displayName: 'Procurement Agent',
    role: 'Supplier & sourcing ops',
    color: '#fb923c',
    iconPath: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z',
  },
  {
    key: 'ENGINEERINGKNOWLEDGEAGENT',
    displayName: 'Engineering Knowledge',
    role: 'Spec & substitute review',
    color: '#facc15',
    iconPath: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
  },
  {
    key: 'RISKINVESTIGATIONAGENT',
    displayName: 'Risk Investigation',
    role: 'Timeline & shipment risk',
    color: '#f87171',
    iconPath: 'M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z',
  },
  {
    key: 'MITIGATIONAGENT',
    displayName: 'Mitigation Agent',
    role: 'Option ranking & decisions',
    color: '#4ade80',
    iconPath: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
  },
  {
    key: 'CONFLUENTINTELLIGENCEAGENT',
    displayName: 'Confluent Intelligence',
    role: 'Kafka event trace & evidence',
    color: '#a78bfa',
    iconPath: 'M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0l4 4-4 4v-3h-4v-2h4v-3z',
  },
  {
    key: 'TSCI AGENT',
    displayName: 'TSCI Agent',
    role: 'Supply chain orchestrator',
    color: '#7c9ef8',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  },
  // ── CRAG: Continuous RAG agent — live Confluent RTCE AVL queries ─────────
  {
    key: 'CRAG_RAG_AGENT_V1',
    displayName: 'Vendor Intelligence Agent',
    role: '',
    color: '#22d3ee',
    iconPath: 'M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5v-5l-2.28 2.28C7.81 18 6 15.21 6 12c0-4.08 3.05-7.44 7-7.93V2.05z',
  },
];

function getAgentDef(agentLabel: string | undefined): AgentDef {
  const key = (agentLabel ?? '').toUpperCase().split(' · ')[0]!.trim();
  return AGENT_REGISTRY.find(a => key.startsWith(a.key)) ?? AGENT_REGISTRY[AGENT_REGISTRY.length - 1]!;
}

// ── Agent routing (stub mode) ─────────────────────────────────────────────────

export interface ProgressStep {
  label: string;  // e.g. "Querying resilience profile…"
  done: boolean;
}

const ROUTING: Array<{ pattern: RegExp; label: string; steps: string[] }> = [
  // CRAG routing — MUST be first: catches AVL supplier IDs before generic rules grab them
  { pattern: /SUP-205|SUP-101|SUP-203|approved.vendor.changed|vendor.history|reinstated|fast.track.*approval|compliance.*suspension|crag_rag/i,
    label: 'CRAG_RAG_AGENT_V1',
    steps: ['Routing to AVL Intelligence…', 'Calling confluent_mcp_v1:getMetadata', 'Calling confluent_mcp_v1:queryData', 'Reading RTCE rows…', 'Composing answer…'] },
  { pattern: /confluent|kafka|event trace|topic|partition|offset|flink|DEMO-TW2047|trace bridge/i,
    label: 'ConfluentIntelligenceAgent',
    steps: ['Routing to Confluent Intelligence…', 'Calling get_confluent_event_trace', 'Calling get_confluent_records', 'Building event sequence…', 'Composing answer…'] },
  { pattern: /resilience|supply network|constrained|unconstrained|AVL|approved vendor/i,
    label: 'ResilienceMonitorAgent',
    steps: ['Routing to Resilience Monitor…', 'Calling get_resilience_profile', 'Calling get_avl_status', 'Composing answer…'] },
  { pattern: /port|SGSIN|congestion/i,
    label: 'ResilienceMonitorAgent',
    steps: ['Routing to Resilience Monitor…', 'Calling get_port_status', 'Composing answer…'] },
  { pattern: /inventory|transfer|available|where else/i,
    label: 'InventoryAgent',
    steps: ['Routing to Inventory Agent…', 'Calling get_inventory_options', 'Evaluating transfer feasibility…', 'Composing answer…'] },
  { pattern: /supplier|expedite|alternate|procurement/i,
    label: 'ProcurementAgent',
    steps: ['Routing to Procurement Agent…', 'Calling get_supplier_resilience_status', 'Checking AVL…', 'Composing answer…'] },
  { pattern: /substitute|engineering spec|evidence/i,
    label: 'EngineeringKnowledgeAgent',
    steps: ['Routing to Engineering Knowledge…', 'Retrieving engineering spec…', 'Checking substitution criteria…', 'Composing answer…'] },
  { pattern: /work package|risk|timeline|shipment|ETA/i,
    label: 'RiskInvestigationAgent',
    steps: ['Routing to Risk Investigation…', 'Calling get_risk', 'Calling get_shipment', 'Composing answer…'] },
  { pattern: /recommend|compare|what should/i,
    label: 'MitigationAgent',
    steps: ['Routing to Mitigation Agent…', 'Calling evaluate_mitigation_options', 'Ranking options…', 'Composing answer…'] },
];

const DEFAULT_STEPS = ['Routing query…', 'Searching knowledge base…', 'Composing answer…'];

const TOOL_LABELS: Record<string, string> = {
  get_resilience_profile:          'ResilienceMonitorAgent › get_resilience_profile',
  get_avl_status:                  'ResilienceMonitorAgent › get_avl_status',
  get_port_status:                 'ResilienceMonitorAgent › get_port_status',
  get_supplier_resilience_status:  'ProcurementAgent › get_supplier_resilience_status',
  get_risk:                        'RiskInvestigationAgent › get_risk',
  get_shipment:                    'RiskInvestigationAgent › get_shipment',
  get_inventory_options:           'InventoryAgent › get_inventory_options',
  evaluate_mitigation_options:     'MitigationAgent › evaluate_mitigation_options',
  // Confluent Intelligence tools
  get_confluent_event_trace:       'ConfluentIntelligenceAgent › get_confluent_event_trace',
  get_confluent_records:           'ConfluentIntelligenceAgent › get_confluent_records',
  list_confluent_topics:           'ConfluentIntelligenceAgent › list_confluent_topics',
  get_topic_schema:                'ConfluentIntelligenceAgent › get_topic_schema',
  get_consumer_lag:                'ConfluentIntelligenceAgent › get_consumer_lag',
  get_flink_jobs:                  'ConfluentIntelligenceAgent › get_flink_jobs',
  get_flink_job_details:           'ConfluentIntelligenceAgent › get_flink_job_details',
  search_events_by_key:            'ConfluentIntelligenceAgent › search_events_by_key',
  get_topic_latest_offsets:        'ConfluentIntelligenceAgent › get_topic_latest_offsets',
  // CRAG AVL Intelligence (Confluent MCP) tools
  'confluent_mcp_v1:listTopics':   'AVL Intelligence › listTopics',
  'confluent_mcp_v1:getMetadata':  'AVL Intelligence › getMetadata',
  'confluent_mcp_v1:queryData':    'AVL Intelligence › queryData',
};

function inferRoute(text: string) { return ROUTING.find(r => r.pattern.test(text)); }
function inferLabel(text: string) { return inferRoute(text)?.label; }
function tlabel(name: string) { return TOOL_LABELS[name] ?? name; }

// ── Stub answer bank (used when backend is offline) ───────────────────────────

interface StubAnswer {
  pattern: RegExp;
  agentLabel: string;
  answer: string;
  confidence: number;   // 0–1, displayed as %
  evidence: import('../types').Evidence[];
}

const STUB_ANSWERS: StubAnswer[] = [
  // ── Supply Resilience ─────────────────────────────────────────────────────
  // Q1: "What is the resilience posture of CVA-8842 across the supply network?"
  {
    pattern: /resilience posture|CVA-8842.*supply network|supply network.*CVA-8842/i,
    agentLabel: 'RESILIENCEMONITORAGENT',
    confidence: 0.87,
    answer: `## Resilience Posture — CVA-8842 / TW-2047

The current supply network posture for **CVA-8842** (Control Valve Actuator) is **CRITICAL**. A composite resilience score of **60.5 / 100** has been computed as of 2026-03-06T08:14Z.

### Supplier Status

| Supplier | Tier | Status | Constraint |
|---|---|---|---|
| SUP-101 RotaTech Industrial | PRIMARY | QUALITY_HOLD | CRITICAL — ISO 9001 non-conformance NCA-2026-047 |
| SUP-203 Gulf Actuators Co | SECONDARY | PORT_CONGESTION | HIGH — SGSIN 4–6 day delay |
| SUP-205 Asia Valve Corp | TERTIARY | UNCONSTRAINED | ACTIVE — no open constraints |

### Key Risk Factors

- **Need-by date:** 2026-03-18 (12 days remaining)
- **Unconstrained approved suppliers:** 1 of 3
- **Shipment SHP-90017** (from SUP-203): ETA slipped to 2026-03-22 — **4-day overrun**
- **Inventory transfer:** 1 feasible source — REGIONAL-WH-DEMO (3 units available)

### Recommended Next Steps

1. Immediately qualify SUP-205 for emergency order (lead-time 8 days)
2. Initiate inventory transfer request from REGIONAL-WH-DEMO pending engineering sign-off
3. Monitor SGSIN port clearance — estimated 2026-03-10

> **Resilience score** is calculated as a weighted composite of: unconstrained supplier count (40%), days-to-required buffer (30%), alternative inventory availability (20%), and AVL depth (10%).`,
    evidence: [
      {
        evidence_id: 'EV-RES-001',
        document_id: 'DOC-RESILIENCE-PROFILE-CVA8842',
        title: 'Supply Chain Resilience Profile — CVA-8842',
        revision: 'v2.4',
        section: '§3.1 Supplier Status Summary',
        excerpt: 'Primary supplier SUP-101 placed on QUALITY_HOLD following ISO 9001 audit NCA-2026-047 on 2026-02-28. Secondary supplier SUP-203 impacted by PORT_CONGESTION at SGSIN since 2026-03-02.',
        relevance_score: 0.96,
        retrieval_method: 'vector',
      },
      {
        evidence_id: 'EV-RES-002',
        document_id: 'DOC-AVL-CVA8842',
        title: 'Approved Vendor List — CVA-8842',
        revision: 'Rev 11',
        section: '§2 Active Vendors',
        excerpt: 'SUP-205 (Asia Valve Corp) retains APPROVED status with no open constraints. Tier TERTIARY. Minimum order quantity 1 unit. Standard lead-time 8 business days.',
        relevance_score: 0.91,
        retrieval_method: 'vector',
      },
      {
        evidence_id: 'EV-RES-003',
        document_id: 'DOC-SHIPMENT-SHP90017',
        title: 'Shipment Record — SHP-90017',
        revision: 'current',
        section: '§1 Tracking',
        excerpt: 'Original ETA: 2026-03-18. Current ETA: 2026-03-22. Delay reason: PORT_CONGESTION SGSIN. Logistics provider: Maersk Line. Port of entry: Pearl GTL Terminal.',
        relevance_score: 0.88,
        retrieval_method: 'hybrid',
      },
    ],
  },
  // Q2: "Why are both the primary and secondary suppliers constrained?"
  {
    pattern: /both.*primary.*secondary.*supplier|primary.*secondary.*constrained|why.*both.*supplier/i,
    agentLabel: 'RESILIENCEMONITORAGENT',
    confidence: 0.83,
    answer: `## Why Both Primary and Secondary Suppliers are Constrained

### SUP-101 (PRIMARY) — QUALITY_HOLD / CRITICAL

RotaTech Industrial was placed on a **QUALITY_HOLD** on 2026-02-28 following ISO 9001 internal audit **NCA-2026-047**. The non-conformance relates to a torque calibration deviation found in actuator batch B-2026-012. All outbound shipments are suspended pending re-inspection and corrective action sign-off.

- **Affected batches:** B-2026-009 through B-2026-014
- **Estimated resolution:** 2026-03-20 (subject to QA sign-off)
- **Pearl GTL mitigation:** Cannot expedite; new PO would also be affected by hold

### SUP-203 (SECONDARY) — PORT_CONGESTION / HIGH

Gulf Actuators Co's shipment **SHP-90017** departed on 2026-03-01 but has been held at **Singapore (SGSIN)** since 2026-03-03 due to a container terminal backlog caused by back-to-back Typhoon Doksuri vessel diversions. The estimated port clearance is 2026-03-10, giving a revised ETA of 2026-03-22 — a **4-day slip** against the TW-2047 need-by.

- **Port disruption start:** 2026-03-02
- **Impacted shipments at SGSIN:** 18 vessels, 3 Pearl GTL pending shipments
- **Reroute via air freight (WSSS):** feasible, adds SGD 14,200 cost, reduces ETA to 2026-03-12

> The coincidence of a quality event and an external logistics disruption simultaneously affecting PRIMARY and SECONDARY is a **supply concentration risk** that the AVL expansion program (approved 2025-Q4) is intended to address.`,
    evidence: [
      {
        evidence_id: 'EV-SUP-001',
        document_id: 'DOC-QUALITY-HOLD-SUP101',
        title: 'Quality Hold Notice — SUP-101 RotaTech Industrial',
        revision: 'QN-2026-047',
        section: '§1 Non-Conformance Summary',
        excerpt: 'Torque calibration deviation detected in actuator batches B-2026-009 to B-2026-014. All outbound shipments suspended effective 2026-02-28 pending corrective action verification.',
        relevance_score: 0.97,
        retrieval_method: 'vector',
      },
      {
        evidence_id: 'EV-PORT-001',
        document_id: 'DOC-PORT-SGSIN-DISRUPTION',
        title: 'Port Disruption Advisory — SGSIN March 2026',
        revision: 'PA-2026-031',
        section: '§2 Impact Assessment',
        excerpt: 'Container terminal congestion at Singapore (SGSIN) resulting from vessel diversions linked to Typhoon Doksuri. Estimated 4–6 day delay on all affected consignments. Clearance forecast 2026-03-10.',
        relevance_score: 0.94,
        retrieval_method: 'vector',
      },
    ],
  },
  // Q3: "Which approved suppliers remain unconstrained?"
  {
    pattern: /which.*approved.*supplier.*unconstrained|approved supplier.*unconstrained|unconstrained.*approved|supplier.*remain.*unconstrained/i,
    agentLabel: 'RESILIENCEMONITORAGENT',
    confidence: 0.91,
    answer: `## Unconstrained Approved Suppliers — CVA-8842

Of the 3 vendors on the Approved Vendor List for **CVA-8842**, only **1 remains unconstrained**:

### SUP-205 — Asia Valve Corp (TERTIARY)

| Field | Value |
|---|---|
| AVL Status | APPROVED |
| Tier | TERTIARY |
| Constraint | None |
| Lead-time | 8 business days |
| MOQ | 1 unit |
| Last Pearl GTL order | Never (new vendor) |
| Contact | procurement@asiavalve.sg |

### Important Caveats

- SUP-205 has **no prior delivery history** at Pearl GTL. Engineering sign-off is required before a first production order is placed (per Procurement Policy PP-07 §4.3).
- A conditional PO with a hold point at goods receipt inspection is recommended.
- Sample / test kit request can be triggered in parallel to compress lead-time.

### Action Required

> **Procurement Agent** can draft a conditional emergency PO for SUP-205 in the next 2 hours. Engineering review of the CVA-8842 spec sheet against Asia Valve Corp's AS-7742 datasheet is required before release. Estimated sign-off time: 4 hours.`,
    evidence: [
      {
        evidence_id: 'EV-AVL-001',
        document_id: 'DOC-AVL-CVA8842',
        title: 'Approved Vendor List — CVA-8842',
        revision: 'Rev 11',
        section: '§2.3 SUP-205 Asia Valve Corp',
        excerpt: 'SUP-205 APPROVED status. Tier TERTIARY. No current constraints. First-order engineering review required per PP-07 §4.3 before placement of production PO.',
        relevance_score: 0.95,
        retrieval_method: 'vector',
      },
      {
        evidence_id: 'EV-POL-001',
        document_id: 'DOC-PROCUREMENT-POLICY-PP07',
        title: 'Procurement Policy PP-07 — New Vendor First Orders',
        revision: 'v3.1',
        section: '§4.3 Engineering Sign-off',
        excerpt: 'For any vendor with no prior delivery history at this site, a first-order engineering review comparing vendor datasheet against approved material specification is mandatory. GIH hold point applies.',
        relevance_score: 0.82,
        retrieval_method: 'bm25',
      },
    ],
  },
  // Q4: "How is port congestion at SGSIN affecting supply options?"
  {
    pattern: /port congestion.*SGSIN|SGSIN.*affect|how.*port.*congestion/i,
    agentLabel: 'RESILIENCEMONITORAGENT',
    confidence: 0.89,
    answer: `## Port Congestion at SGSIN — Supply Impact

Singapore (SGSIN) has been experiencing **HIGH severity** container terminal congestion since 2026-03-02, caused by cascading vessel diversions following Typhoon Doksuri.

### Current Status

| Metric | Value |
|---|---|
| Disruption type | PORT_CONGESTION |
| Severity | HIGH |
| Start date | 2026-03-02 |
| Estimated clearance | 2026-03-10 |
| Impacted vessels | 18+ |
| Pearl GTL shipments affected | 3 |

### Impact on CVA-8842 / TW-2047

Shipment **SHP-90017** (1 unit CVA-8842 from SUP-203 Gulf Actuators Co) is held at SGSIN. The revised ETA of **2026-03-22** misses the TW-2047 need-by date of 2026-03-18 by **4 days**.

### Available Reroute Options

1. **Air freight via WSSS** — Transit time 2 days, cost +SGD 14,200, adjusted ETA **2026-03-12** ✓
2. **Reroute via HKGKG** — Sea transit, transit time +1 day, adjusted ETA **2026-03-19** (still 1-day slip)
3. **Wait for port clearance** — Revised ETA 2026-03-22, 4-day overrun — **not recommended**

> Air freight via WSSS is the fastest path but requires Procurement approval for the cost delta.`,
    evidence: [
      {
        evidence_id: 'EV-PORT-001',
        document_id: 'DOC-PORT-SGSIN-DISRUPTION',
        title: 'Port Disruption Advisory — SGSIN March 2026',
        revision: 'PA-2026-031',
        section: '§1 Situation Summary',
        excerpt: 'Port of Singapore SGSIN reporting HIGH severity congestion from 2026-03-02. Cause: cascading vessel diversions, Typhoon Doksuri aftermath. Estimated clearance 2026-03-10.',
        relevance_score: 0.98,
        retrieval_method: 'vector',
      },
      {
        evidence_id: 'EV-SHP-001',
        document_id: 'DOC-SHIPMENT-SHP90017',
        title: 'Shipment Tracking — SHP-90017',
        revision: 'current',
        section: '§2 Current Status',
        excerpt: 'Status: HELD AT PORT. Current location: SGSIN terminal 3B. Revised ETA Pearl GTL: 2026-03-22. Air freight reroute feasibility: confirmed (WSSS). Cost delta: SGD 14,200.',
        relevance_score: 0.93,
        retrieval_method: 'hybrid',
      },
    ],
  },

  // ── Risk & Mitigation ────────────────────────────────────────────────────────
  // Q5: "Why is this material risk critical for TW-2047?"
  {
    pattern: /material.*risk.*critical|risk.*critical.*TW-2047|why.*risk.*critical|why.*material.*risk/i,
    agentLabel: 'RISKINVESTIGATIONAGENT',
    confidence: 0.85,
    answer: `## Why CVA-8842 Risk is CRITICAL for TW-2047

**RISK-CVA8842-TW2047** is classified CRITICAL based on a multi-factor assessment:

### Risk Score Breakdown

| Factor | Score | Reason |
|---|---|---|
| Schedule proximity | 9 / 10 | Need-by in 12 days with 4-day ETA slip |
| Supplier availability | 8 / 10 | 2 of 3 AVL suppliers constrained |
| Material criticality | 10 / 10 | CVA-8842 is mandatory for TW-2047 critical path |
| Inventory buffer | 7 / 10 | 0 units on-site; 3 units at REGIONAL-WH-DEMO |
| **Composite CRITICAL score** | **8.5 / 10** | Exceeds threshold of 7.5 |

### Work Package Context

- **Work package:** TW-2047 — Pearl GTL Compressor Train 3 Turnaround
- **Material role:** CVA-8842 (Control Valve Actuator) controls lube oil pressure regulation on compressor driver. Without it, the train **cannot be returned to service**.
- **Planned return-to-service:** 2026-03-20
- **Impact of 4-day slip:** 4 additional days of production loss at approximately **USD 280,000 / day** throughput value.

### Escalation Status

Risk has been escalated to Turnaround Manager and Supply Chain Lead. Human approval is required before executing any mitigation action.`,
    evidence: [
      {
        evidence_id: 'EV-RISK-001',
        document_id: 'DOC-RISK-CVA8842-TW2047',
        title: 'Risk Record — RISK-CVA8842-TW2047',
        revision: 'v1.2',
        section: '§3 Severity Assessment',
        excerpt: 'Composite CRITICAL risk score 8.5/10. Primary drivers: near-term need-by date (12 days), zero on-site inventory, 2 of 3 AVL suppliers constrained. CVA-8842 is on TW-2047 critical path.',
        relevance_score: 0.97,
        retrieval_method: 'vector',
      },
      {
        evidence_id: 'EV-WP-001',
        document_id: 'DOC-TW2047-WORKPACKAGE',
        title: 'Work Package TW-2047 — Pearl GTL Compressor Train 3',
        revision: 'Rev 4',
        section: '§5 Critical Materials Register',
        excerpt: 'CVA-8842 (qty 1) listed as MANDATORY. No substitution approved. Required by 2026-03-18. Governs critical path task CP-047-F: lube oil system re-commissioning.',
        relevance_score: 0.94,
        retrieval_method: 'vector',
      },
    ],
  },
  // Q6: "What is the latest ETA for shipment SHP-90017?"
  {
    pattern: /SHP-90017|latest.*ETA.*shipment|ETA.*shipment.*SHP|latest.*shipment/i,
    agentLabel: 'RISKINVESTIGATIONAGENT',
    confidence: 0.92,
    answer: `## Shipment SHP-90017 — Latest ETA

### Tracking Summary

| Field | Value |
|---|---|
| Shipment ID | SHP-90017 |
| Material | CVA-8842 (1 unit) |
| Supplier | SUP-203 Gulf Actuators Co |
| PO Reference | PO-44821 |
| Logistics provider | Maersk Line / MV Orion Star |
| Departed | 2026-03-01 (Dubai, AEDXB) |
| Current location | SGSIN Terminal 3B — HELD |
| **Original ETA** | **2026-03-18** |
| **Current ETA** | **2026-03-22** |
| **Delay** | **+4 days** |
| Delay reason | PORT_CONGESTION — SGSIN HIGH |

### Revised ETA Scenarios

| Scenario | ETA | Meets need-by? | Cost delta |
|---|---|---|---|
| Status quo (sea, wait) | 2026-03-22 | ❌ 4-day slip | — |
| Reroute via HKGKG | 2026-03-19 | ❌ 1-day slip | +SGD 2,800 |
| Air freight WSSS | 2026-03-12 | ✅ 6-day buffer | +SGD 14,200 |

> **Recommendation:** Expedite via air freight (WSSS). Requires Procurement approval for cost delta. RiskInvestigationAgent has raised approval request **APR-SHP90017-001** — pending Turnaround Manager sign-off.`,
    evidence: [
      {
        evidence_id: 'EV-SHP-001',
        document_id: 'DOC-SHIPMENT-SHP90017',
        title: 'Shipment Record — SHP-90017',
        revision: 'current',
        section: '§1 Full Tracking Detail',
        excerpt: 'Current ETA: 2026-03-22. Delayed 4 days versus original ETA 2026-03-18. Delay reason: PORT_CONGESTION SGSIN. Vessel: MV Orion Star (IMO 9782341). Last port call update: 2026-03-05T14:22Z.',
        relevance_score: 0.99,
        retrieval_method: 'vector',
      },
    ],
  },
  // Q7: "Compare inventory transfer vs alternate supplier options."
  {
    pattern: /inventory transfer.*vs.*alternate|compare.*inventory.*transfer|inventory transfer.*alternate|compare.*alternate.*supplier/i,
    agentLabel: 'MITIGATIONAGENT',
    confidence: 0.78,
    answer: `## Mitigation Options — Inventory Transfer vs Alternate Supplier

MitigationAgent has evaluated **4 feasible options** for RISK-CVA8842-TW2047.

### Option Ranking

| Rank | Option | Est. Ready Date | Cost Delta | Schedule Risk | Recommended |
|---|---|---|---|---|---|
| 1 | **Transfer from REGIONAL-WH-DEMO** | 2026-03-10 | USD 3,400 (logistics) | LOW | ✅ |
| 2 | **Expedite SHP-90017 (air freight)** | 2026-03-12 | SGD 14,200 | LOW-MEDIUM | ✅ |
| 3 | **Emergency order SUP-205** | 2026-03-14 | +12% unit premium | MEDIUM | Conditional |
| 4 | **Wait — sea route SHP-90017** | 2026-03-22 | None | HIGH | ❌ |

### Inventory Transfer (REGIONAL-WH-DEMO) — Detail

- **Source:** REGIONAL-WH-DEMO — 3 units CVA-8842 in bonded store (lot L-2024-117)
- **Engineering note:** Same manufacturer (RotaTech) and revision as TW-2047 BOM requirement — **no engineering review needed**
- **Logistics:** Road freight, Pearl GTL ETA 2 days from release
- **Approval required:** Supply Chain Lead + Warehouse Release (2-step, estimated 6 hours)

### Alternate Supplier (SUP-205) — Detail

- **Vendor:** Asia Valve Corp — TERTIARY, no prior Pearl GTL delivery history
- **Lead-time:** 8 business days from confirmed PO
- **Engineering review:** Required (first order PP-07 §4.3) — estimated 4 hours
- **Risk:** No track record; GIH hold point on goods receipt

> **Recommendation:** Initiate transfer from REGIONAL-WH-DEMO immediately (fastest, lowest risk). Expedite air freight on SHP-90017 as parallel track. Emergency order SUP-205 only if transfer is blocked.`,
    evidence: [
      {
        evidence_id: 'EV-MIT-001',
        document_id: 'DOC-MITIGATION-OPTIONS-RISK001',
        title: 'Mitigation Option Evaluation — RISK-CVA8842-TW2047',
        revision: 'v1.0',
        section: '§4 Ranked Options',
        excerpt: 'Option 1: Inventory transfer REGIONAL-WH-DEMO. Est. ready 2026-03-10. Schedule risk LOW. No engineering review required. Lot L-2024-117 matches BOM revision. Cost USD 3,400.',
        relevance_score: 0.95,
        retrieval_method: 'vector',
      },
      {
        evidence_id: 'EV-INV-001',
        document_id: 'DOC-INVENTORY-REGIONAL-WH-DEMO',
        title: 'Inventory Record — REGIONAL-WH-DEMO',
        revision: 'current',
        section: '§3 CVA-8842 Stock',
        excerpt: 'CVA-8842 — 3 units in bonded store. Lot L-2024-117. Manufactured by RotaTech Industrial. Shelf life expires 2028-01-15. Status: AVAILABLE FOR TRANSFER.',
        relevance_score: 0.91,
        retrieval_method: 'hybrid',
      },
    ],
  },
  // Q8: "What requires human approval before execution?"
  {
    pattern: /human approval|requires.*human.*approval|what.*requires.*approval|approval.*before.*execution/i,
    agentLabel: 'MITIGATIONAGENT',
    confidence: 0.82,
    answer: `## Actions Requiring Human Approval

The following mitigation actions for RISK-CVA8842-TW2047 are **blocked pending human approval**. No automated action has been taken.

### Open Approval Requests

| Approval ID | Action | Approver Required | Status | Expires |
|---|---|---|---|---|
| APR-001 | Inventory transfer — REGIONAL-WH-DEMO | Supply Chain Lead | **PENDING** | 2026-03-07T23:59Z |
| APR-002 | Expedite SHP-90017 via air freight (SGD 14,200) | Turnaround Manager + Procurement Lead | **PENDING** | 2026-03-07T23:59Z |
| APR-003 | Emergency PO — SUP-205 (conditional) | Procurement Lead + Engineering Sign-off | **PENDING** | 2026-03-08T12:00Z |

### Why Human Approval is Required

Per **Governance Policy GP-SC-04**:
- Inventory transfers across site boundaries require Supply Chain Lead sign-off
- Unplanned logistics cost overruns > SGD 5,000 require Turnaround Manager approval
- First-order POs to new vendors require Engineering and Procurement dual approval

### How to Approve

1. Navigate to **Active Risks → RISK-CVA8842-TW2047 → Mitigation Options**
2. Select the action you wish to approve
3. Click **Approve** and enter your employee ID

> Clock is running — APR-001 expires in **~38 hours**. Delay beyond expiry will require re-assessment.`,
    evidence: [
      {
        evidence_id: 'EV-GOV-001',
        document_id: 'DOC-GOVERNANCE-GP-SC-04',
        title: 'Supply Chain Governance Policy GP-SC-04',
        revision: 'v2.0',
        section: '§3 Approval Thresholds',
        excerpt: 'Cross-site inventory transfers: Supply Chain Lead approval mandatory. Unplanned logistics cost delta > SGD 5,000: Turnaround Manager approval required. New vendor first PO: dual Engineering + Procurement sign-off.',
        relevance_score: 0.90,
        retrieval_method: 'bm25',
      },
      {
        evidence_id: 'EV-APR-001',
        document_id: 'DOC-APPROVAL-APR001',
        title: 'Approval Request APR-001',
        revision: 'current',
        section: '§1 Request Detail',
        excerpt: 'Transfer request: 1 unit CVA-8842 from REGIONAL-WH-DEMO to Pearl GTL. Requested by: RiskInvestigationAgent. Approver: Supply Chain Lead. Expiry: 2026-03-07T23:59Z. Status: PENDING.',
        relevance_score: 0.87,
        retrieval_method: 'vector',
      },
    ],
  },

  // ── Confluent Event Trace ─────────────────────────────────────────────────────
  // Q9: "Show me the Confluent event trace for correlation ID DEMO-TW2047-001."
  {
    pattern: /DEMO-TW2047|Confluent event trace|correlation.*ID.*DEMO|show.*event.*trace/i,
    agentLabel: 'CONFLUENTINTELLIGENCEAGENT',
    confidence: 0.88,
    answer: `Correlation ID DEMO-TW2047-001 was traced across 4 Kafka topics. Here is the full event sequence:

Confluent Evidence
Source: DIRECT CONFLUENT

Event sequence (oldest → newest):

1. supply.shipment.delay.detected
   correlation_id: DEMO-TW2047-001
   shipment_id: SHP-90017
   material_id: CVA-8842
   delay_days: 4
   reason: PORT_CONGESTION
   port_code: SGSIN
   Partition: 2  Offset: 18841  Timestamp: 2026-03-05T06:02:11Z

2. supply.supplier.constraint.updated
   correlation_id: DEMO-TW2047-001
   supplier_id: SUP-101
   constraint_type: QUALITY_HOLD
   constraint_severity: CRITICAL
   affected_material: CVA-8842
   Partition: 0  Offset: 4402  Timestamp: 2026-03-05T06:04:38Z

3. supply.resilience.profile.recomputed
   correlation_id: DEMO-TW2047-001
   work_package_id: TW-2047
   material_id: CVA-8842
   resilience_score: 60.5
   readiness_status: CRITICAL
   unconstrained_supplier_count: 1
   Partition: 1  Offset: 9917  Timestamp: 2026-03-05T06:05:03Z

4. supply.risk.detected
   correlation_id: DEMO-TW2047-001
   risk_id: RISK-CVA8842-TW2047
   severity: CRITICAL
   mitigation_options_count: 4
   requires_approval: true
   Partition: 3  Offset: 2201  Timestamp: 2026-03-05T06:05:31Z`,
    evidence: [
      {
        evidence_id: 'EV-CF-001',
        document_id: 'TOPIC:supply.shipment.delay.detected',
        title: 'Kafka Topic — supply.shipment.delay.detected',
        revision: 'schema v3',
        section: 'Partition 2, Offset 18841',
        excerpt: 'Event key: SHP-90017. Payload: delay_days=4, reason=PORT_CONGESTION, port_code=SGSIN. Consumed by: ResilienceComputeFlink, RiskDetectionFlink.',
        relevance_score: 0.96,
        retrieval_method: 'confluent_direct',
      },
      {
        evidence_id: 'EV-CF-002',
        document_id: 'TOPIC:supply.risk.detected',
        title: 'Kafka Topic — supply.risk.detected',
        revision: 'schema v2',
        section: 'Partition 3, Offset 2201',
        excerpt: 'Event key: RISK-CVA8842-TW2047. Payload: severity=CRITICAL, mitigation_options_count=4. Produced by: RiskDetectionFlink job risk-detection-v2.3.1.',
        relevance_score: 0.93,
        retrieval_method: 'confluent_direct',
      },
    ],
  },
  // Q10: "What Kafka events caused risk RISK-001 to be detected?"
  {
    pattern: /RISK-001|Kafka.*event.*caused|what.*Kafka.*event|Kafka.*caused.*risk/i,
    agentLabel: 'CONFLUENTINTELLIGENCEAGENT',
    confidence: 0.81,
    answer: `## Kafka Events That Caused RISK-001 Detection

**RISK-CVA8842-TW2047** (aliased RISK-001 in demo context) was triggered by a convergence of two independent Kafka events processed by the **RiskDetectionFlink** job within a 3-minute window:

### Triggering Events

**Event 1 — supply.shipment.delay.detected** (2026-03-05T06:02:11Z)
- Shipment SHP-90017 flagged for 4-day delay at SGSIN
- Produced by: LogisticsConnectorService v1.4 (Maersk API webhook)
- Topic partition 2, offset 18841

**Event 2 — supply.supplier.constraint.updated** (2026-03-05T06:04:38Z)
- SUP-101 QUALITY_HOLD/CRITICAL constraint recorded for CVA-8842
- Produced by: QualitySystemConnector (triggered by NCA-2026-047 audit close)
- Topic partition 0, offset 4402

### Flink Processing

The **ResilienceComputeFlink** job ingested both events and recomputed the resilience profile for TW-2047/CVA-8842, producing a score of **60.5** (CRITICAL threshold: <65).

The **RiskDetectionFlink** job consumed the recomputed profile event and — detecting CRITICAL status with need-by in 12 days — emitted the **supply.risk.detected** event to partition 3.

> Without the port congestion event, the quality hold alone would have scored 72.0 (HIGH, not CRITICAL). The dual constraint triggered the CRITICAL classification.`,
    evidence: [
      {
        evidence_id: 'EV-CF-003',
        document_id: 'FLINK-JOB:risk-detection-v2.3.1',
        title: 'Flink Job — RiskDetectionFlink v2.3.1',
        revision: 'deploy 2026-01-15',
        section: 'Risk scoring logic §4',
        excerpt: 'CRITICAL classification fires when: resilience_score < 65 AND days_to_required < 15. Dual-constraint scenario (quality_hold + port_congestion) on same material produces additive penalty of -12 points.',
        relevance_score: 0.89,
        retrieval_method: 'confluent_direct',
      },
    ],
  },
  // Q11: "Which Flink job derived the supply.risk.detected event?"
  {
    pattern: /which.*Flink.*job|Flink.*job.*derived|Flink.*supply.*risk.*detected/i,
    agentLabel: 'CONFLUENTINTELLIGENCEAGENT',
    confidence: 0.86,
    answer: `## Flink Job — supply.risk.detected Producer

The **supply.risk.detected** event for RISK-CVA8842-TW2047 was derived by the **RiskDetectionFlink** job.

### Job Details

| Field | Value |
|---|---|
| Job name | RiskDetectionFlink |
| Version | v2.3.1 |
| Deployed | 2026-01-15T09:00Z |
| Kafka input topic | supply.resilience.profile.recomputed |
| Kafka output topic | supply.risk.detected |
| Checkpoint interval | 30 seconds |
| Parallelism | 4 |
| State backend | RocksDB |

### Processing Logic (simplified)

\`\`\`
WHEN resilience_profile_recomputed
  IF resilience_score < threshold(readiness_status)
  AND days_to_required < 15
  AND unconstrained_supplier_count < 2
  THEN emit supply.risk.detected
\`\`\`

### Upstream Pipeline

1. **LogisticsConnectorService** → \`supply.shipment.delay.detected\`
2. **QualitySystemConnector** → \`supply.supplier.constraint.updated\`
3. **ResilienceComputeFlink** → \`supply.resilience.profile.recomputed\`
4. **RiskDetectionFlink** → \`supply.risk.detected\` ← *this job*
5. **MitigationEvaluatorFlink** → \`supply.mitigation.options.available\`

> Both upstream producers (Logistics and Quality connectors) run as Kafka Connect source connectors feeding into separate Flink jobs before converging at the resilience recompute step.`,
    evidence: [
      {
        evidence_id: 'EV-CF-004',
        document_id: 'FLINK-JOB:risk-detection-v2.3.1',
        title: 'Flink Job Specification — RiskDetectionFlink',
        revision: 'v2.3.1',
        section: '§2 Job Configuration',
        excerpt: 'Input: supply.resilience.profile.recomputed (consumer group: risk-detector-cg). Output: supply.risk.detected. Trigger condition: resilience_score < 65 with days_to_required < 15.',
        relevance_score: 0.94,
        retrieval_method: 'confluent_direct',
      },
    ],
  },
  // Q12: "Was the event evidence retrieved directly from Confluent or the trace bridge?"
  {
    pattern: /retrieved.*directly.*Confluent|directly.*from Confluent|Confluent.*or.*trace bridge|trace bridge|direct.*Confluent/i,
    agentLabel: 'CONFLUENTINTELLIGENCEAGENT',
    confidence: 0.79,
    answer: `## Evidence Source: DIRECT CONFLUENT vs TRACE BRIDGE FALLBACK

For correlation ID **DEMO-TW2047-001**, event evidence was retrieved via **DIRECT CONFLUENT**.

### What This Means

| Mode | Description |
|---|---|
| **DIRECT CONFLUENT** | The Confluent Intelligence Agent connected directly to the Kafka cluster and fetched raw event records using offset-based retrieval. Data is live and authoritative. |
| **TRACE BRIDGE FALLBACK** | Used when direct Kafka access is unavailable (e.g. network timeout, consumer group lag > threshold). The agent falls back to the trace bridge cache — a 15-minute materialised snapshot stored in the knowledge base. |

### This Session

- **Primary fetch:** \`get_confluent_event_trace\` (DIRECT) — succeeded on first attempt
- **Latency:** 340ms for 4 events across 4 partitions
- **Consumer group:** \`tsci-intelligence-agent-cg\`
- **Lag at fetch time:** 0 (fully caught up)
- **Fallback triggered:** No

### When to Expect Fallback

Trace bridge fallback is triggered if:
- Consumer group lag exceeds 5,000 messages
- Confluent Cloud API returns 429 (rate limit) after 3 retries
- Network timeout > 8 seconds

> In fallback mode, the source badge shows "⇄ TRACE BRIDGE FALLBACK" and a staleness timestamp is included in the evidence footer. In DIRECT mode, data reflects the moment of query.`,
    evidence: [
      {
        evidence_id: 'EV-CF-005',
        document_id: 'DOC-TSCI-CONFLUENT-AGENT-ARCH',
        title: 'TSCI Confluent Intelligence Agent — Architecture',
        revision: 'v1.1',
        section: '§5 Retrieval Mode Selection',
        excerpt: 'DIRECT CONFLUENT mode selected when: consumer group lag < 5000, Confluent API reachable, response latency < 8s. Fallback to TRACE BRIDGE CACHE when any condition fails. Cache TTL: 15 minutes.',
        relevance_score: 0.88,
        retrieval_method: 'vector',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CRAG stub answers — 5-event AVL scenario via crag_rag_agent_v1
  // These fire in stub mode (backend offline). Live mode sends to WXO directly.
  // ══════════════════════════════════════════════════════════════════════════════

  // CRAG-1: Current AVL status for CVA-8842
  {
    pattern: /which supplier.*approved.*CVA-8842|current.*approval.*status|current AVL|approved.*CVA-8842/i,
    agentLabel: 'CRAG_RAG_AGENT_V1',
    confidence: 0.95,
    answer: `## Current AVL Status — CVA-8842 (Live RTCE)

*This answer was re-fetched from Confluent RTCE at query time.*

Query: \`supply.approved_vendor.changed\` WHERE \`MATERIAL_ID\` = 'CVA-8842'

| SUPPLIER_ID | CHANGE_TYPE  | EFFECTIVE_DATE | CURRENT STANDING |
|-------------|--------------|----------------|-----------------|
| \`SUP-101\`   | **APPROVED** | 2026-01-15     | ✅ APPROVED (primary) |
| \`SUP-203\`   | **APPROVED** | 2026-01-15     | ✅ APPROVED (secondary) |
| \`SUP-205\`   | **REINSTATED** | 2026-09-15   | ✅ REINSTATED (tertiary) |

All three suppliers are currently on the Approved Vendor List for **CVA-8842** (control-valve actuator assembly). SUP-205 was suspended on 2026-09-01 then reinstated on 2026-09-15 after expedited compliance clearance.

---
**Source:** DIRECT CONFLUENT — live RTCE read via Confluent MCP
**Topic:** \`supply.approved_vendor.changed\`
**Cluster:** \`lkc-0xddjd2\` · env \`env-o7qy3j\` · us-east-1
*SYNTHETIC DEMO — not real Shell or Pearl GTL operational data.*`,
    evidence: [
      {
        evidence_id: 'EV-CRAG-001',
        document_id: 'RTCE:supply.approved_vendor.changed',
        title: 'Confluent RTCE — supply.approved_vendor.changed',
        revision: 'live',
        section: 'All rows: MATERIAL_ID = CVA-8842',
        excerpt: 'SUP-101 APPROVED 2026-01-15; SUP-203 APPROVED 2026-01-15; SUP-205 REINSTATED 2026-09-15. Three AVL events returned. Current standing derived from latest EFFECTIVE_DATE per supplier.',
        relevance_score: 0.99,
        retrieval_method: 'vector',
      },
    ],
  },

  // CRAG-2: Full AVL history for SUP-205
  {
    pattern: /AVL.*history.*SUP-205|SUP-205.*history|full.*SUP-205|show.*SUP-205/i,
    agentLabel: 'CRAG_RAG_AGENT_V1',
    confidence: 0.97,
    answer: `## Full AVL Event History — SUP-205 / CVA-8842 (Live RTCE)

*This answer was re-fetched from Confluent RTCE at query time.*

Query: \`supply.approved_vendor.changed\` WHERE \`SUPPLIER_ID\` = 'SUP-205' AND \`MATERIAL_ID\` = 'CVA-8842'

| # | EVENT_ID    | CHANGE_TYPE    | EFFECTIVE_DATE | REASON                                     | AUTHORISED_BY    |
|---|-------------|----------------|----------------|--------------------------------------------|-----------------|
| 3 | EVT-…       | **APPROVED**   | 2026-08-27     | Fast-track emergency tertiary approval     | DEMO-PROCUREMENT |
| 4 | EVT-…       | **SUSPENDED**  | 2026-09-01     | Supplier suspended following compliance review | DEMO-PROCUREMENT |
| 5 | EVT-…       | **REINSTATED** | 2026-09-15     | Supplier reinstated after expedited compliance clearance | DEMO-PROCUREMENT |

### Sequence Narrative
1. **Event 3 — APPROVED (2026-08-27):** With both primary (SUP-101) and secondary (SUP-203) suppliers constrained, Demo Precision Valve Corp. was fast-track approved as an emergency tertiary source for CVA-8842.
2. **Event 4 — SUSPENDED (2026-09-01):** A routine compliance review triggered a suspension pending document verification.
3. **Event 5 — REINSTATED (2026-09-15):** After expedited clearance, SUP-205 was reinstated. Current status: **REINSTATED** (effectively active).

CORRELATION_ID for all events: \`DEMO-TW2047-001\`

---
**Source:** DIRECT CONFLUENT — live RTCE read via Confluent MCP
**Topic:** \`supply.approved_vendor.changed\`
*SYNTHETIC DEMO — not real Shell or Pearl GTL operational data.*`,
    evidence: [
      {
        evidence_id: 'EV-CRAG-002',
        document_id: 'RTCE:supply.approved_vendor.changed',
        title: 'Confluent RTCE — supply.approved_vendor.changed',
        revision: 'live',
        section: 'SUPPLIER_ID = SUP-205, MATERIAL_ID = CVA-8842',
        excerpt: 'Three events returned: APPROVED 2026-08-27 (fast-track emergency), SUSPENDED 2026-09-01 (compliance review), REINSTATED 2026-09-15 (expedited clearance). All share CORRELATION_ID DEMO-TW2047-001.',
        relevance_score: 0.99,
        retrieval_method: 'vector',
      },
    ],
  },

  // CRAG-3: Why was SUP-205 suspended + has it been reinstated?
  {
    pattern: /why.*SUP-205.*suspended|SUP-205.*reinstat|suspended.*reinstat/i,
    agentLabel: 'CRAG_RAG_AGENT_V1',
    confidence: 0.96,
    answer: `## SUP-205 Suspension & Reinstatement — CVA-8842

*This answer was re-fetched from Confluent RTCE at query time.*

### Suspension — Event 4

| Field          | Value |
|----------------|-------|
| CHANGE_TYPE    | **SUSPENDED** |
| EFFECTIVE_DATE | 2026-09-01 |
| REASON         | Supplier suspended following compliance review |
| AUTHORISED_BY  | \`DEMO-PROCUREMENT\` |
| CORRELATION_ID | \`DEMO-TW2047-001\` |

SUP-205 (Demo Precision Valve Corp.) was **suspended on 2026-09-01** after an internal compliance review raised documentation concerns. All procurement activity against this supplier was halted pending clearance.

### Reinstatement — Event 5

| Field          | Value |
|----------------|-------|
| CHANGE_TYPE    | **REINSTATED** |
| EFFECTIVE_DATE | 2026-09-15 |
| REASON         | Supplier reinstated after expedited compliance clearance |
| AUTHORISED_BY  | \`DEMO-PROCUREMENT\` |

**Yes — SUP-205 has been reinstated.** The expedited compliance review completed 14 days after suspension and SUP-205 was restored to the Approved Vendor List on 2026-09-15. Current standing: **REINSTATED** (active).

---
**Source:** DIRECT CONFLUENT — live RTCE read via Confluent MCP
**Topic:** \`supply.approved_vendor.changed\`
*SYNTHETIC DEMO — not real Shell or Pearl GTL operational data.*`,
    evidence: [
      {
        evidence_id: 'EV-CRAG-003',
        document_id: 'RTCE:supply.approved_vendor.changed',
        title: 'Confluent RTCE — supply.approved_vendor.changed',
        revision: 'live',
        section: 'SUP-205 SUSPENDED → REINSTATED sequence',
        excerpt: 'Event 4: SUSPENDED 2026-09-01 — compliance review. Event 5: REINSTATED 2026-09-15 — expedited compliance clearance. Both authorised by DEMO-PROCUREMENT under DEMO-TW2047-001.',
        relevance_score: 0.98,
        retrieval_method: 'vector',
      },
    ],
  },

  // CRAG-4: Trace all AVL events for DEMO-TW2047-001
  {
    pattern: /trace.*DEMO-TW2047|all.*AVL.*DEMO-TW2047|correlation.*DEMO-TW2047/i,
    agentLabel: 'CRAG_RAG_AGENT_V1',
    confidence: 0.98,
    answer: `## All AVL Events — Correlation DEMO-TW2047-001 (Live RTCE)

*This answer was re-fetched from Confluent RTCE at query time.*

Query: \`supply.approved_vendor.changed\` WHERE \`CORRELATION_ID\` = 'DEMO-TW2047-001' LIMIT 50

| # | SUPPLIER_ID | CHANGE_TYPE    | EFFECTIVE_DATE | REASON                                         | AUTHORISED_BY    | EVENT_ID |
|---|-------------|----------------|----------------|------------------------------------------------|-----------------|----------|
| 1 | \`SUP-101\`   | **APPROVED**   | 2026-01-15     | Annual AVL review — primary re-qualified       | PROCUREMENT-DEMO | EVT-…    |
| 2 | \`SUP-203\`   | **APPROVED**   | 2026-01-15     | Annual AVL review — secondary re-qualified     | PROCUREMENT-DEMO | EVT-…    |
| 3 | \`SUP-205\`   | **APPROVED**   | 2026-08-27     | Fast-track emergency tertiary approval         | DEMO-PROCUREMENT | EVT-…    |
| 4 | \`SUP-205\`   | **SUSPENDED**  | 2026-09-01     | Supplier suspended following compliance review | DEMO-PROCUREMENT | EVT-…    |
| 5 | \`SUP-205\`   | **REINSTATED** | 2026-09-15     | Supplier reinstated after expedited compliance clearance | DEMO-PROCUREMENT | EVT-… |

### Supplier Story — Work Package TW-2047

Work package **TW-2047** (Pearl GTL Turnaround) requires material **CVA-8842** (control-valve actuator assembly, safety-critical).

- **Jan 2026:** Annual AVL review re-qualifies both primary (SUP-101) and secondary (SUP-203) suppliers.
- **Aug 2026:** With supply risks on both primary and secondary, an emergency fast-track qualifies tertiary SUP-205.
- **Sep 2026:** A compliance review triggers a 14-day suspension of SUP-205, then expedited clearance restores it.

Final standing: **SUP-101 APPROVED · SUP-203 APPROVED · SUP-205 REINSTATED**

---
**Source:** DIRECT CONFLUENT — live RTCE read via Confluent MCP
**Topic:** \`supply.approved_vendor.changed\`
*SYNTHETIC DEMO — not real Shell or Pearl GTL operational data.*`,
    evidence: [
      {
        evidence_id: 'EV-CRAG-004',
        document_id: 'RTCE:supply.approved_vendor.changed',
        title: 'Confluent RTCE — supply.approved_vendor.changed',
        revision: 'live',
        section: 'CORRELATION_ID = DEMO-TW2047-001',
        excerpt: '5 events returned. Events 1–2: annual AVL review Jan 2026. Event 3: emergency tertiary Aug 2026. Events 4–5: compliance suspension then reinstatement Sep 2026.',
        relevance_score: 0.99,
        retrieval_method: 'vector',
      },
    ],
  },

  // CRAG-5: Who authorised the fast-track emergency approval?
  {
    pattern: /authoris.*fast.track|authoris.*emergency.*tertiary|who.*approved.*emergency/i,
    agentLabel: 'CRAG_RAG_AGENT_V1',
    confidence: 0.94,
    answer: `## Emergency Tertiary Approval — SUP-205 Authorisation

*This answer was re-fetched from Confluent RTCE at query time.*

Query: \`supply.approved_vendor.changed\` WHERE \`SUPPLIER_ID\` = 'SUP-205' AND \`CHANGE_TYPE\` = 'APPROVED'

**Event 3 — APPROVED (fast-track emergency):**

| Field          | Value |
|----------------|-------|
| CHANGE_TYPE    | **APPROVED** |
| EFFECTIVE_DATE | 2026-08-27 |
| REASON         | Fast-track emergency tertiary approval |
| **AUTHORISED_BY** | **\`DEMO-PROCUREMENT\`** |
| CORRELATION_ID | \`DEMO-TW2047-001\` |
| MATERIAL_ID    | \`CVA-8842\` |
| SUPPLIER_ID    | \`SUP-205\` |

The emergency tertiary approval for **SUP-205** (Demo Precision Valve Corp.) was authorised by **\`DEMO-PROCUREMENT\`** on 2026-08-27. This was a fast-track process — the January annual review approved SUP-101 and SUP-203 (both via \`PROCUREMENT-DEMO\`), while this emergency was handled by the \`DEMO-PROCUREMENT\` team.

---
**Source:** DIRECT CONFLUENT — live RTCE read via Confluent MCP
**Topic:** \`supply.approved_vendor.changed\`
*SYNTHETIC DEMO — not real Shell or Pearl GTL operational data.*`,
    evidence: [
      {
        evidence_id: 'EV-CRAG-005',
        document_id: 'RTCE:supply.approved_vendor.changed',
        title: 'Confluent RTCE — supply.approved_vendor.changed',
        revision: 'live',
        section: 'SUPPLIER_ID = SUP-205, CHANGE_TYPE = APPROVED',
        excerpt: 'Event 3: APPROVED 2026-08-27, REASON=Fast-track emergency tertiary approval, AUTHORISED_BY=DEMO-PROCUREMENT, CORRELATION_ID=DEMO-TW2047-001.',
        relevance_score: 0.98,
        retrieval_method: 'vector',
      },
    ],
  },
];

/**
 * Match a user query against the stub answer bank.
 * Returns the best matching StubAnswer, or null if no match.
 */
export function matchStubAnswer(text: string): StubAnswer | null {
  return STUB_ANSWERS.find(a => a.pattern.test(text)) ?? null;
}

// ── Rich answer renderer ───────────────────────────────────────────────────────
// Patterns for domain entity highlighting
const ENTITY_RE   = /\b(CVA-\d+|TW-\d+|SUP-\d+|SHP-\d+|MR-\d+|PO-\d+|RISK-[\w-]+|REGIONAL-[\w-]+)\b/g;
const STATUS_TAGS: Array<{ re: RegExp; cls: string }> = [
  { re: /\b(QUALITY_HOLD|SUSPENDED|REVOKED|FORCE_MAJEURE)\b/g,             cls: 'rag-tag rag-tag--critical' },
  { re: /\b(CRITICAL)\b/g,                                                   cls: 'rag-tag rag-tag--critical' },
  { re: /\b(PORT_CONGESTION|LEAD_TIME_EXTENSION|CAPACITY_CONSTRAINT)\b/g,  cls: 'rag-tag rag-tag--warning'  },
  { re: /\b(HIGH)\b/g,                                                       cls: 'rag-tag rag-tag--warning'  },
  { re: /\b(UNCONSTRAINED|ACTIVE|APPROVED|CLEARED|GROUNDED)\b/g,            cls: 'rag-tag rag-tag--ok'       },
  { re: /\b(MEDIUM|LOW)\b/g,                                                 cls: 'rag-tag rag-tag--info'     },
  { re: /\b(TERTIARY|SECONDARY|PRIMARY)\b/g,                                 cls: 'rag-tag rag-tag--tier'     },
];

/**
 * Tokenise inline markdown within a text fragment:
 *   **bold**, `code`, [text](url), entity IDs, and status tags.
 */
function tokeniseInline(text: string, keyBase: string): React.ReactNode[] {
  // Tokenise: markdown links → **bold** → `code` → entity IDs → status tags
  const INLINE_RE = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(...tokenisePlain(text.slice(last, m.index), `${keyBase}-p${idx++}`));
    }
    if (m[2] && m[3]) {
      // markdown link [label](url)
      nodes.push(
        <a key={`${keyBase}-lnk${idx++}`} href={m[3]} target="_blank" rel="noopener noreferrer"
           className="rag-link">
          {m[2]}
        </a>
      );
    } else if (m[4]) {
      // **bold**
      nodes.push(<strong key={`${keyBase}-b${idx++}`}>{m[4]}</strong>);
    } else if (m[5]) {
      // `code`
      nodes.push(<code key={`${keyBase}-c${idx++}`} className="rag-inline-code">{m[5]}</code>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push(...tokenisePlain(text.slice(last), `${keyBase}-p${idx}`));
  }
  return nodes;
}

/** Tokenise a plain-text fragment for entity IDs and status tags only */
function tokenisePlain(text: string, keyBase: string): React.ReactNode[] {
  const entityParts = text.split(ENTITY_RE);
  const nodes: React.ReactNode[] = [];
  entityParts.forEach((part, i) => {
    if (ENTITY_RE.test(part)) {
      ENTITY_RE.lastIndex = 0;
      nodes.push(<strong key={`${keyBase}-e${i}`} className="rag-entity">{part}</strong>);
      return;
    }
    ENTITY_RE.lastIndex = 0;
    let remaining = part;
    let tagKey = 0;
    STATUS_TAGS.forEach(({ re, cls }) => {
      const pieces = remaining.split(re);
      if (pieces.length === 1) return;
      const replaced: React.ReactNode[] = [];
      pieces.forEach((piece, pi) => {
        if (re.test(piece)) {
          re.lastIndex = 0;
          replaced.push(<span key={`${keyBase}-s${i}-${cls}-${tagKey++}-${pi}`} className={cls}>{piece}</span>);
        } else {
          re.lastIndex = 0;
          replaced.push(piece);
        }
      });
      remaining = '__REPLACED__';
      nodes.push(...replaced);
    });
    if (remaining !== '__REPLACED__') nodes.push(remaining);
  });
  return nodes;
}

/** Legacy alias kept for Confluent event-card usage */
function tokeniseLine(line: string, keyBase: string): React.ReactNode[] {
  return tokeniseInline(line, keyBase);
}

/** Detect lines of the form "KEY: value" or "KEY · value" to render as a fact grid */
function isFactLine(line: string) {
  return /^[A-Z][A-Z0-9 _&/-]{1,40}[:\u00b7·]/.test(line.trim());
}

interface RichAnswerProps { text: string }

/** Extract sources list from the RAG preamble without rendering them inline */
function extractSources(text: string): string[] {
  const m = text.match(/^Based on retrieved enterprise knowledge \(([^)]+)\)/i);
  return m
    ? (m[1] ?? '').split('",').map(s => s.replace(/^["(]|[")]/g, '').trim()).filter(Boolean)
    : [];
}

/** Strip preamble and SYNTHETIC markers from answer text */
function cleanAnswerText(text: string): string {
  const PREAMBLE_RE = /^Based on retrieved enterprise knowledge \([^)]+\),?\s*(the following is relevant to your query:?\s*)?/i;
  const SYNTHETIC_RE = /\s*\[SYNTHETIC DEMO[^\]]*\]\s*$/i;
  return text
    .replace(PREAMBLE_RE, '')
    .replace(SYNTHETIC_RE, '')
    .replace(/\bAll data (is )?SYNTHETIC DEMO\.?\s*$/i, '')
    .trim();
}

// ── Markdown block renderer ────────────────────────────────────────────────────

type MdBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'bullet'; items: string[] }
  | { kind: 'ordered'; items: string[] }
  | { kind: 'blockquote'; lines: string[] }
  | { kind: 'hr' }
  | { kind: 'para'; lines: string[] };

/** Parse markdown text into a sequence of typed blocks */
function parseMdBlocks(text: string): MdBlock[] {
  const lines = text.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i]!;
    const line = raw.trimEnd();

    // Skip blank lines
    if (line.trim() === '') { i++; continue; }

    // Heading
    const hm = line.match(/^(#{1,4})\s+(.+)$/);
    if (hm) {
      blocks.push({ kind: 'heading', level: Math.min(hm[1]!.length, 4) as 1|2|3|4, text: hm[2]!.trim() });
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      blocks.push({ kind: 'hr' });
      i++; continue;
    }

    // Table — collect header + separator + rows
    if (/^\|.+\|/.test(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|/.test((lines[i] ?? '').trim())) {
        tableLines.push(lines[i]!);
        i++;
      }
      const parseRow = (r: string) =>
        r.split('|').slice(1, -1).map(c => c.trim());
      const [headerRow, , ...dataRows] = tableLines; // skip separator row (index 1)
      if (headerRow) {
        blocks.push({
          kind: 'table',
          headers: parseRow(headerRow),
          rows: dataRows.filter(r => !/^[\s|:-]+$/.test(r)).map(parseRow),
        });
      }
      continue;
    }

    // Bullet list
    if (/^[\s]*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*+]\s+/.test((lines[i] ?? '').trimEnd())) {
        items.push((lines[i]!).replace(/^[\s]*[-*+]\s+/, '').trimEnd());
        i++;
      }
      blocks.push({ kind: 'bullet', items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test((lines[i] ?? '').trimEnd())) {
        items.push((lines[i]!).replace(/^\s*\d+[.)]\s+/, '').trimEnd());
        i++;
      }
      blocks.push({ kind: 'ordered', items });
      continue;
    }

    // Blockquote
    if (/^>\s*/.test(line)) {
      const qlines: string[] = [];
      while (i < lines.length && /^>\s*/.test((lines[i] ?? '').trimEnd())) {
        qlines.push((lines[i]!).replace(/^>\s*/, '').trimEnd());
        i++;
      }
      blocks.push({ kind: 'blockquote', lines: qlines });
      continue;
    }

    // Paragraph — collect until blank line or block-level token
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,4}\s|[-*+]\s|\d+[.)]\s|>\s|\|[-*_]{3,})/.test((lines[i] ?? '').trimEnd())
    ) {
      paraLines.push((lines[i]!).trimEnd());
      i++;
    }
    if (paraLines.length) blocks.push({ kind: 'para', lines: paraLines });
  }

  return blocks;
}

/** Render a sequence of parsed markdown blocks to React elements */
function renderMdBlocks(blocks: MdBlock[], keyPfx: string): React.ReactNode[] {
  return blocks.map((block, bi) => {
    const k = `${keyPfx}-${bi}`;
    switch (block.kind) {
      case 'heading': {
        const content = tokeniseInline(block.text, k);
        if (block.level === 1) return <h2 key={k} className="rag-md-h1">{content}</h2>;
        if (block.level === 2) return <h3 key={k} className="rag-md-h2">{content}</h3>;
        if (block.level === 3) return <h4 key={k} className="rag-md-h3">{content}</h4>;
        return <h5 key={k} className="rag-md-h4">{content}</h5>;
      }
      case 'hr':
        return <hr key={k} className="rag-md-hr" />;
      case 'table':
        return (
          <div key={k} className="rag-md-table-wrap">
            <table className="rag-md-table">
              <thead>
                <tr>{block.headers.map((h, hi) => (
                  <th key={hi}>{tokeniseInline(h, `${k}-th${hi}`)}</th>
                ))}</tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>{row.map((cell, ci) => (
                    <td key={ci}>{tokeniseInline(cell, `${k}-td${ri}-${ci}`)}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'bullet':
        return (
          <ul key={k} className="rag-bullet-list">
            {block.items.map((item, ii) => (
              <li key={ii}>{tokeniseInline(item, `${k}-li${ii}`)}</li>
            ))}
          </ul>
        );
      case 'ordered':
        return (
          <ol key={k} className="rag-ordered-list">
            {block.items.map((item, ii) => (
              <li key={ii}>{tokeniseInline(item, `${k}-li${ii}`)}</li>
            ))}
          </ol>
        );
      case 'blockquote':
        return (
          <blockquote key={k} className="rag-blockquote">
            {block.lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {tokeniseInline(l, `${k}-bq${li}`)}
              </React.Fragment>
            ))}
          </blockquote>
        );
      case 'para':
      default:
        return (
          <p key={k} className="rag-para">
            {block.lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {tokeniseInline(line, `${k}-pl${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
    }
  });
}

// ── Confluent event-trace block parser ────────────────────────────────────────

interface ConfluentEvent {
  index: number;
  topic: string;
  fields: string[];
  meta: string; // "Partition: N  Offset: N  Timestamp: …"
}

interface ConfluentBlock {
  source: 'DIRECT CONFLUENT' | 'TRACE BRIDGE FALLBACK' | string;
  events: ConfluentEvent[];
  missing: string[];
  preamble: string; // text before "Confluent Evidence"
  postamble: string; // text after the block
}

/** Returns null if the text does not contain a Confluent Evidence block. */
function parseConfluentBlock(text: string): ConfluentBlock | null {
  if (!/Confluent Evidence/i.test(text)) return null;

  const headerRe  = /^Confluent Evidence\s*$/im;
  const sourceRe  = /^Source:\s*(.+)$/im;
  const seqRe     = /^Event sequence[^:]*:\s*$/im;
  const missingRe = /^Missing topics[^:]*:\s*$/im;
  const eventRe   = /^\s*(\d+)\.\s+(.+)$/m;

  const headerMatch = headerRe.exec(text);
  if (!headerMatch) return null;

  const preamble = text.slice(0, headerMatch.index).trim();
  const body     = text.slice(headerMatch.index);

  const sourceMatch = sourceRe.exec(body);
  const source = sourceMatch ? sourceMatch[1]!.trim() : 'UNKNOWN';

  // Split body into event-sequence section and optional missing-topics section
  const seqMatch     = seqRe.exec(body);
  const missingMatch = missingRe.exec(body);

  const eventLines: string[] = [];
  if (seqMatch) {
    const evStart = seqMatch.index + seqMatch[0].length;
    const evEnd   = missingMatch ? missingMatch.index : body.length;
    eventLines.push(...body.slice(evStart, evEnd).split('\n'));
  }

  const missing: string[] = [];
  if (missingMatch) {
    const mStart = missingMatch.index + missingMatch[0].length;
    body.slice(mStart).split('\n').forEach(l => {
      const m = l.match(/^\s*[-–]\s*(.+)/);
      if (m) missing.push(m[1]!.trim());
    });
  }

  // Parse numbered events: index line, then indented field lines, then meta line
  const events: ConfluentEvent[] = [];
  let current: ConfluentEvent | null = null;
  for (const raw of eventLines) {
    const line = raw.trimEnd();
    const numMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (current) events.push(current);
      current = { index: parseInt(numMatch[1]!, 10), topic: numMatch[2]!.trim(), fields: [], meta: '' };
      continue;
    }
    if (!current) continue;
    const metaMatch = line.match(/^\s+(Partition:\s*\d+\s+Offset:\s*\d+\s+Timestamp:.+)$/);
    if (metaMatch) {
      current.meta = metaMatch[1]!.trim();
    } else if (line.trim()) {
      current.fields.push(line.trim());
    }
  }
  if (current) events.push(current);

  // Anything after the block (after last missing entry or last event meta)
  const postamble = '';

  return { source, events, missing, preamble, postamble };
}

/** Pill for DIRECT CONFLUENT vs TRACE BRIDGE FALLBACK */
function SourceBadge({ source }: { source: string }) {
  const isDirect = /DIRECT CONFLUENT/i.test(source);
  return (
    <span className={`confluent-source-badge ${isDirect ? 'confluent-source-badge--direct' : 'confluent-source-badge--bridge'}`}>
      {isDirect ? '⚡ DIRECT CONFLUENT' : '⇄ TRACE BRIDGE FALLBACK'}
    </span>
  );
}

/** Render a single Confluent event card */
function ConfluentEventCard({ ev }: { ev: ConfluentEvent }) {
  return (
    <div className="confluent-event-card">
      <div className="confluent-event-header">
        <span className="confluent-event-index">{ev.index}</span>
        <code className="confluent-event-topic">{ev.topic}</code>
      </div>
      {ev.fields.length > 0 && (
        <div className="confluent-event-fields">
          {ev.fields.map((f, i) => {
            const colonIdx = f.indexOf(':');
            if (colonIdx > -1) {
              const k = f.slice(0, colonIdx).trim();
              const v = f.slice(colonIdx + 1).trim();
              return (
                <span key={i} className="confluent-event-field">
                  <span className="confluent-field-key">{k}</span>
                  <span className="confluent-field-val">{tokeniseLine(v, `ev${ev.index}f${i}`)}</span>
                </span>
              );
            }
            return <span key={i} className="confluent-event-field">{f}</span>;
          })}
        </div>
      )}
      {ev.meta && <div className="confluent-event-meta">{ev.meta}</div>}
    </div>
  );
}

export const RichAnswer: React.FC<RichAnswerProps> = ({ text }) => {
  const clean = cleanAnswerText(text);

  // ── Confluent Evidence block takes priority ────────────────────────────────
  const confluentBlock = parseConfluentBlock(clean);
  if (confluentBlock) {
    return (
      <div className="rag-rich-answer">
        {confluentBlock.preamble && (
          <p className="rag-para">{tokeniseLine(confluentBlock.preamble, 'cfpre')}</p>
        )}
        <div className="confluent-evidence-block">
          <div className="confluent-evidence-header">
            <span className="confluent-evidence-title">Confluent Evidence</span>
            <SourceBadge source={confluentBlock.source} />
          </div>
          {confluentBlock.events.length > 0 && (
            <div className="confluent-event-list">
              <div className="confluent-event-list-label">Event sequence (oldest → newest)</div>
              {confluentBlock.events.map(ev => (
                <ConfluentEventCard key={ev.index} ev={ev} />
              ))}
            </div>
          )}
          {confluentBlock.missing.length > 0 && (
            <div className="confluent-missing-topics">
              <div className="confluent-missing-label">Missing topics</div>
              <ul className="confluent-missing-list">
                {confluentBlock.missing.map((m, i) => (
                  <li key={i}>{tokeniseLine(m, `cfmiss${i}`)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Markdown-aware renderer ────────────────────────────────────────────────
  return (
    <div className="rag-rich-answer">
      {renderMdBlocks(parseMdBlocks(clean), 'md')}
    </div>
  );
};

// ── Agent avatar (per-agent coloured icon) ─────────────────────────────────────

interface AgentAvatarProps { agentLabel?: string; size?: number }

const AgentAvatar: React.FC<AgentAvatarProps> = ({ agentLabel, size = 32 }) => {
  const def = getAgentDef(agentLabel);
  return (
    <div
      className="agent-avatar"
      style={{ '--agent-color': def.color, width: size, height: size } as React.CSSProperties}
      aria-hidden="true"
      title={def.displayName}
    >
      <svg viewBox="0 0 24 24" fill={def.color} width={size * 0.55} height={size * 0.55}>
        <path d={def.iconPath} />
      </svg>
    </div>
  );
};

// ── Agent name block (avatar + name + role) ───────────────────────────────────

interface AgentNameBlockProps { agentLabel?: string; isThinking?: boolean }

export const AgentNameBlock: React.FC<AgentNameBlockProps> = ({ agentLabel, isThinking }) => {
  const def = getAgentDef(agentLabel);
  return (
    <div className="agent-name-block">
      <AgentAvatar agentLabel={agentLabel} size={30} />
      <div className="agent-name-text">
        <span className="agent-name-primary" style={{ color: def.color }}>{def.displayName}</span>
        {def.role && <span className="agent-name-role">{def.role}</span>}
      </div>
      {isThinking && (
        <div className="agent-thinking-pill">
          <span className="agent-thinking-dot" />
          thinking
        </div>
      )}
    </div>
  );
};

// ── Progress tracker (animated step list shown while loading) ─────────────────

interface AgentProgressProps { steps: ProgressStep[]; agentLabel?: string }

export const AgentProgressTracker: React.FC<AgentProgressProps> = ({ steps, agentLabel }) => (
  <div className="agent-progress-tracker">
    <AgentNameBlock agentLabel={agentLabel} isThinking />
    <ol className="agent-progress-steps">
      {steps.map((step, i) => (
        <li key={i} className={`agent-progress-step${step.done ? ' done' : i === steps.filter(s => s.done).length ? ' active' : ''}`}>
          <span className="agent-step-icon" aria-hidden="true">
            {step.done
              ? <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
              : <span className="agent-step-spinner" />}
          </span>
          <span className="agent-step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  </div>
);

// ── Bob avatar SVG (kept for backward compat on system messages) ──────────────

const BobAvatar: React.FC = () => (
  <div className="bob-chat-avatar" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M37.6315 23.4399C38.4128 23.4399 39.1941 22.9191 39.5847 22.1378C39.8452 21.4867 39.8452 20.8356 39.5847 20.3148C39.3243 19.6637 38.8034 19.273 38.1524 19.1428L37.1106 18.7522C36.8502 12.1112 32.2927 6.51191 25.9121 4.55868C25.9121 3.64717 25.0006 2.99609 24.0891 2.99609H17.8388C16.9272 2.99609 16.146 3.64717 16.0157 4.55868C9.50497 6.64213 4.94743 12.2414 4.68699 18.8824L3.64527 19.273C2.99419 19.4032 2.47333 19.7939 2.2129 20.445C1.95247 21.096 1.95247 21.7471 2.2129 22.268C2.60355 23.0493 3.38484 23.5701 4.16613 23.5701H5.07764C5.07764 23.8306 5.07764 24.091 4.94743 24.4816H3.9057C2.86398 24.4816 2.08269 25.2629 2.08269 26.3047V31.1226C2.08269 32.1644 2.86398 32.9457 3.9057 32.9457H4.94743C5.33807 36.201 7.94238 38.6751 11.328 38.6751H30.079C33.4646 38.6751 36.0689 36.0708 36.4596 32.9457H37.5013C38.543 32.9457 39.3243 32.1644 39.3243 31.1226V26.3047C39.3243 25.2629 38.543 24.4816 37.5013 24.4816H36.4596C36.4596 24.2212 36.4596 23.9608 36.3293 23.5701H37.6315V23.4399Z" fill="currentColor"/>
      <path d="M32.8139 17.9727C23.829 16.8008 18.4902 16.8008 8.98442 17.9727C8.59378 17.9727 8.33334 18.3633 8.46356 18.754C8.85421 19.1446 9.24485 19.4051 9.24485 19.2749C18.7506 18.1029 23.6988 18.1029 32.6836 19.2749C32.9441 19.2749 33.3347 19.0144 33.3347 18.754C33.3347 18.3633 33.0743 18.1029 32.8139 17.9727Z" fill="currentColor"/>
    </svg>
  </div>
);

// ── Pin icon ───────────────────────────────────────────────────────────────────

const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
    <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
  </svg>
);

// ── Send arrow icon ────────────────────────────────────────────────────────────

export const SendArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
    <path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>
  </svg>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const AgentPage: React.FC = () => {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    wxoConfigured().then(setIsLive).catch(() => setIsLive(false));
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      agentLabel: 'TSCI AGENT · SUPPLY CHAIN',
      text: 'Initialising agent connection…',
    },
  ]);

  // Update welcome message once we know whether WXO is live
  useEffect(() => {
    setMessages(prev => {
      const first = prev[0];
      if (!first || first.id !== 'welcome') return prev;
      return [
        {
          ...first,
          text: isLive
            ? 'Connected to watsonx Orchestrate. I coordinate RiskInvestigationAgent, ResilienceMonitorAgent, InventoryAgent, ProcurementAgent, EngineeringKnowledgeAgent, and MitigationAgent.\n\nHow can I help?'
            : 'Running in local RAG stub mode. Configure WXO_API_KEY on the backend to connect to watsonx Orchestrate.\n\nHow can I help?',
        },
        ...prev.slice(1),
      ];
    });
  }, [isLive]);

  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: 'h1', title: 'Resilience posture CVA-8842', ago: '18 minutes ago' },
    { id: 'h2', title: 'SHP-90017 ETA and delay options', ago: '2 hours ago' },
  ]);

  const [activeTab, setActiveTab] = useState<'Today' | 'Patterns' | 'Ask' | 'AVL Live' | 'My Board'>('Ask');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  // Left-panel visibility + per-group collapse
  const [historyPanelOpen, setHistoryPanelOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Context pane visibility per message
  const [openContext, setOpenContext] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll main chat
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send (stub) — Ask tab always uses backend stub, never WXO live ──────────

  const sendStub = useCallback(async (text: string) => {
    const route = inferRoute(text);
    const agentLabel = (route?.label ?? 'TSCI AGENT').toUpperCase();
    const stepLabels = route?.steps ?? DEFAULT_STEPS;

    // Use a monotonic counter so user + agent IDs are never the same timestamp
    const uid = `stub-u-${Date.now()}-${Math.random()}`;
    const pid = `stub-a-${Date.now()}-${Math.random()}`;

    setMessages(prev => [...prev, { id: uid, role: 'user', text }]);
    setLoading(true);

    // Insert placeholder message with progress steps (all pending)
    const initialSteps: ProgressStep[] = stepLabels.map(label => ({ label, done: false }));
    setMessages(prev => [...prev, {
      id: pid,
      role: 'agent',
      agentLabel,
      text: '…',
      progressSteps: initialSteps,
    }]);

    // Kick off fetch immediately — race against the step ticker
    let ragResult: Awaited<ReturnType<typeof retrieveKnowledge>> | null = null;
    let ragError = false;
    const fetchDone = retrieveKnowledge(text, {})
      .then(r => { ragResult = r; })
      .catch(() => { ragError = true; });

    // Tick steps with randomised delays (400–1100ms) so each step feels like a real tool call
    for (let i = 0; i < stepLabels.length - 1; i++) {
      const delay = 400 + Math.floor(Math.random() * 700);
      await new Promise<void>(res => setTimeout(res, delay));
      setMessages(prev => prev.map(m => {
        if (m.id !== pid || !m.progressSteps) return m;
        return {
          ...m,
          progressSteps: m.progressSteps.map((s, si) => si <= i ? { ...s, done: true } : s),
        };
      }));
    }

    // Wait for fetch to finish (may already be done)
    await fetchDone;

    if (ragError) {
      // Try stub answer bank before showing error
      const stub = matchStubAnswer(text);
      if (stub) {
        setMessages(prev => prev.map(m => m.id === pid ? {
          ...m,
          agentLabel: stub.agentLabel,
          text: stub.answer,
          evidence: stub.evidence,
          grounded: true,
          confidence: stub.confidence,
          progressSteps: undefined,
        } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === pid ? {
          ...m,
          role: 'error' as const,
          text: '❌ Backend unreachable — is the FastAPI backend running?',
          progressSteps: undefined,
        } : m));
      }
    } else if (ragResult) {
      // Capture in typed const so TypeScript narrows correctly inside closures
      const result = ragResult as import('../types').RAGResponse;
      // Stub answers take priority — they are more specific than generic RAG policy docs.
      // Only fall through to the raw RAG result if no stub matches.
      const stub = matchStubAnswer(text);
      if (stub) {
        setMessages(prev => prev.map(m => m.id === pid ? {
          ...m,
          agentLabel: stub.agentLabel,
          text: stub.answer,
          evidence: stub.evidence,
          grounded: true,
          confidence: stub.confidence,
          progressSteps: undefined,
        } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === pid ? {
          ...m,
          text: result.grounded ? result.answer : `⚠ Insufficient evidence: ${result.answer}`,
          evidence: result.evidence,
          grounded: result.grounded,
          confidence: result.confidence,
          progressSteps: undefined,
        } : m));
      }
    }

    setLoading(false);
  }, []);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setInput('');
    setHistory(prev => [{ id: Date.now().toString(), title: t.slice(0, 48), ago: 'Just now' }, ...prev].slice(0, 20));
    return sendStub(t);
  }, [loading, sendStub]);

  // ── New chat ────────────────────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    setMessages([{ id: 'welcome-new', role: 'system', text: 'New conversation started.' }]);
  }, []);

  // ── Demo simulate ──────────────────────────────────────────────────────────

  const handleSimulate = async () => {
    setSimulating(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: '🔄 Running demo: SUP-101 QUALITY_HOLD/CRITICAL · SGSIN CONGESTION/HIGH · SHP-90017 delayed…' }]);
    try {
      const result = await demoClearAndSimulate();
      if (result.risk_detected) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          agentLabel: 'TSCI AGENT · RISK SCENARIO',
          text: `Risk detected for CVA-8842 / TW-2047.\nSUP-101 PRIMARY: QUALITY_HOLD/CRITICAL\nSUP-203 SECONDARY: PORT_CONGESTION/HIGH (via SGSIN)\nUnconstrained approved: 1 (SUP-205 TERTIARY)\nTransfer available: REGIONAL-WH-DEMO`,
          statCard: {
            label: 'RESILIENCE SCORE · 30 DAYS',
            value: '60.5',
            delta: 'CRITICAL posture',
            deltaPositive: false,
            context: `Risk: ${result.risk_id} · Severity: ${result.severity}`,
          },
        }]);
        if (isLive && result.risk_detected) {
          await send('What is the resilience posture of CVA-8842 and what mitigation options are available?');
        }
      } else {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'error', text: '⚠ No risk detected. Check backend logs.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'error', text: '❌ Simulation failed' }]);
    } finally {
      setSimulating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bob-ask-root">
      {/* ── Page title (TSCI Supply Chain style) ───────────────────────────── */}
      <div className="bob-ask-page-header">
        <div>
          <h1 className="bob-ask-title">Supply Chain Agent</h1>
          <p className="bob-ask-subtitle">
            {isLive ? 'watsonx Orchestrate · multi-agent orchestration' : 'Stub mode · local RAG · configure WXO credentials on the backend to connect'}
          </p>
        </div>
        <div className="bob-wxo-pill" data-live={isLive}>
          <span className="bob-wxo-dot" />
          {isLive ? 'wxO Live' : 'wxO Offline'}
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="bob-tab-bar">
        {(['Today', 'Patterns', 'Ask', 'AVL Live', 'My Board'] as const).map((tab) => (
          <button key={tab} className={`bob-tab${activeTab === tab ? ' active' : ''}${tab === 'AVL Live' ? ' bob-tab--confluent' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'Today' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>}
            {tab === 'Patterns' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>}
            {tab === 'Ask' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>}
            {tab === 'AVL Live' && <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5v-5l-2.28 2.28C7.81 18 6 15.21 6 12c0-4.08 3.05-7.44 7-7.93V2.05z"/></svg>}
            {tab === 'My Board' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>}
            {tab}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TODAY tab — turnaround readiness snapshot for CVA-8842 / TW-2047
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Today' && (
        <div className="tsci-agent-tab-panel">
          <div className="tsci-section-title tsci-agent-tab-heading">
              TODAY · SUPPLY READINESS SNAPSHOT
          </div>

          {/* Hero stat cards */}
          <div className="tsci-grid tsci-grid--stats tsci-agent-stat-grid">
            {[
              { label: 'RESILIENCE SCORE', value: '60.5', delta: 'CRITICAL posture', neg: true, ctx: 'CVA-8842 · TW-2047' },
              { label: 'DAYS TO NEED-BY', value: '12', delta: '2026-03-18 required', neg: true, ctx: 'Control Valve Actuator' },
              { label: 'UNCONSTRAINED SUPPLIERS', value: '1', delta: 'SUP-205 TERTIARY', neg: false, ctx: '2 of 3 constrained' },
              { label: 'SHIPMENT ETA SLIP', value: '+4d', delta: 'SHP-90017 delayed', neg: true, ctx: 'Via SGSIN congestion' },
            ].map(card => (
              <div key={card.label} className="bob-stat-card">
                <div className="bob-stat-card-label">{card.label}</div>
                <div className="bob-stat-card-value">{card.value}</div>
                <div className={`bob-stat-card-delta ${card.neg ? 'neg' : 'pos'}`}>{card.delta}</div>
                <div className="bob-stat-card-context">{card.ctx}</div>
              </div>
            ))}
          </div>

          {/* Supplier posture table */}
          <div className="tsci-agent-section">
            <div className="tsci-section-title">
              APPROVED VENDOR LIST — CVA-8842
            </div>
            {[
              { id: 'SUP-101', name: 'RotaTech Industrial', tier: 'PRIMARY',   status: 'QUALITY_HOLD / CRITICAL', constrained: true },
              { id: 'SUP-203', name: 'Gulf Actuators Co',  tier: 'SECONDARY',  status: 'PORT_CONGESTION / HIGH (SGSIN)', constrained: true },
              { id: 'SUP-205', name: 'Asia Valve Corp',    tier: 'TERTIARY',   status: 'ACTIVE — UNCONSTRAINED', constrained: false },
            ].map(s => (
              <div key={s.id} className="tsci-supplier-row" style={{ borderColor: s.constrained ? 'rgba(248,113,113,0.25)' : 'rgba(74,222,128,0.2)' }}>
                <span className="tsci-supplier-id">{s.id}</span>
                <span className="tsci-supplier-name">{s.name}</span>
                <span className="tsci-supplier-tier">{s.tier}</span>
                <span className="tsci-supplier-status" style={{ color: s.constrained ? 'var(--tsci-red)' : 'var(--tsci-green)' }}>{s.status}</span>
              </div>
            ))}
          </div>

          {/* Active risk summary */}
          <div className="tsci-agent-risk-card">
            <div className="tsci-section-title tsci-section-title--danger">
              ACTIVE RISK · RISK-CVA8842-TW2047 · CRITICAL
            </div>
            <div className="tsci-agent-risk-copy">
              Control Valve Actuator <strong>CVA-8842</strong> required for work package <strong>TW-2047</strong> by <strong>2026-03-18</strong>.<br/>
              Primary supplier <strong>SUP-101</strong> is on quality hold. Shipment <strong>SHP-90017</strong> from secondary supplier delayed 4 days due to port congestion at <strong>SGSIN</strong>.<br/>
              One unconstrained approved supplier remains (<strong>SUP-205</strong>). Inventory transfer from <strong>REGIONAL-WH-DEMO</strong> is feasible.
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          PATTERNS tab — supply chain risk trend analysis
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Patterns' && (
        <div className="tsci-agent-tab-panel">
          <div className="tsci-section-title tsci-agent-tab-heading">
            SUPPLY CHAIN RISK PATTERNS · PEARL GTL
          </div>

          {/* Pattern cards */}
          {[
            {
              title: 'Supplier Concentration Risk',
              severity: 'CRITICAL',
              desc: 'CVA-8842 has 3 approved vendors, but 2 of 3 are currently constrained (quality hold + port congestion). Single-source dependency is a structural risk.',
              actions: ['Activate SUP-205 as primary', 'Expand AVL to 5 vendors', 'Negotiate safety stock agreement'],
            },
            {
              title: 'Port Congestion — SGSIN',
              severity: 'HIGH',
              desc: 'Singapore (SGSIN) has 4+ day delay affecting all shipments routed via this hub. SUP-203 shipment SHP-90017 impacted. 3 other pending shipments for other materials may be affected.',
              actions: ['Reroute SHP-90017 via HKGKG', 'Expedite via air freight', 'Monitor port clearance forecast'],
            },
            {
              title: 'Turnaround Schedule Tension',
              severity: 'HIGH',
              desc: 'TW-2047 need-by date is 2026-03-18 (12 days). Current ETA for SHP-90017 is 2026-03-22 — a 4-day overrun. Critical path compression required.',
              actions: ['Pull-in transfer from REGIONAL-WH-DEMO', 'Advance vendor selection decision', 'Compress installation schedule window'],
            },
            {
              title: 'AVL Compliance — SUP-205 Untested',
              severity: 'MEDIUM',
              desc: 'SUP-205 (Asia Valve Corp) is approved TERTIARY vendor but has no recent delivery history at Pearl GTL. Engineering sign-off required before first order.',
              actions: ['Request test kit / sample', 'Engineering review: CVA-8842 spec', 'Conditional PO with hold point'],
            },
          ].map(p => {
            const col = p.severity === 'CRITICAL' ? 'var(--tsci-red)' : p.severity === 'HIGH' ? 'var(--tsci-orange)' : 'var(--tsci-yellow)';
            const bg = p.severity === 'CRITICAL' ? 'rgba(248,113,113,0.07)' : p.severity === 'HIGH' ? 'rgba(251,146,60,0.07)' : 'rgba(250,204,21,0.07)';
            return (
              <div key={p.title} className="tsci-pattern-card" style={{ background: bg, borderColor: `${col}30`, borderLeftColor: col }}>
                <div className="tsci-pattern-head">
                  <span className="tsci-pattern-title">{p.title}</span>
                  <span className="tsci-badge" style={{ color: col, background: `${col}1a` }}>{p.severity}</span>
                </div>
                <div className="tsci-pattern-desc">{p.desc}</div>
                <div className="tsci-pattern-actions">
                  {p.actions.map(a => (
                    <span key={a} className="tsci-pattern-action">→ {a}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ASK tab — two-panel chat (history sidebar + agent chat area)
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Ask' && (
        <div className="bob-ask-body">

          {/* History sidebar — whole panel hide/show toggle */}
          <button
            className="bob-history-panel-toggle"
            aria-label={historyPanelOpen ? 'Hide chat panel' : 'Show chat panel'}
            onClick={() => setHistoryPanelOpen(o => !o)}
            title={historyPanelOpen ? 'Hide panel' : 'Show panel'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
              {historyPanelOpen
                ? <><path d="M11 19l-7-7 7-7"/><path d="M21 12H4"/></>
                : <><path d="M13 5l7 7-7 7"/><path d="M3 12h18"/></>}
            </svg>
          </button>

          {historyPanelOpen && (
            <div className="bob-ask-history">
              <button className="bob-new-chat-btn" onClick={handleNewChat}>NEW CHAT</button>
              <div className="bob-history-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input type="text" placeholder="Search chats" className="bob-history-search-input" />
              </div>
              <div className="bob-history-label">
                SUGGESTED
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" className="tsci-history-info-icon"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              </div>
              <div className="bob-history-list">
                {PROMPTS.map(group => {
                  const isCollapsed = collapsedGroups.has(group.group);
                  return (
                    <div key={group.group} className="bob-history-group">
                      <button
                        className="bob-history-group-label bob-history-group-toggle"
                        onClick={() => setCollapsedGroups(prev => {
                          const n = new Set(prev);
                          n.has(group.group) ? n.delete(group.group) : n.add(group.group);
                          return n;
                        })}
                        aria-expanded={!isCollapsed}
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"
                          className={`bob-group-chevron${isCollapsed ? ' collapsed' : ''}`} aria-hidden="true">
                          <path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z"/>
                        </svg>
                        {group.group}
                      </button>
                      {!isCollapsed && group.items.map(p => (
                        <button key={p} className="bob-history-item" onClick={() => send(p)} disabled={loading}>
                          <div className="bob-history-item-title">{p}</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {/* Demo Scenario group */}
                {(() => {
                  const isCollapsed = collapsedGroups.has('Demo Scenario');
                  return (
                    <div className="bob-history-group">
                      <button
                        className="bob-history-group-label bob-history-group-toggle"
                        onClick={() => setCollapsedGroups(prev => {
                          const n = new Set(prev);
                          n.has('Demo Scenario') ? n.delete('Demo Scenario') : n.add('Demo Scenario');
                          return n;
                        })}
                        aria-expanded={!isCollapsed}
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"
                          className={`bob-group-chevron${isCollapsed ? ' collapsed' : ''}`} aria-hidden="true">
                          <path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z"/>
                        </svg>
                        Demo Scenario
                      </button>
                      {!isCollapsed && (
                        <button className="bob-history-item bob-demo-btn" onClick={handleSimulate} disabled={simulating}>
                          <div className="bob-history-item-title">{simulating ? 'Running scenario…' : '▶ Run resilience scenario'}</div>
                          <div className="bob-history-item-ago">CVA-8842 · TW-2047</div>
                        </button>
                      )}
                    </div>
                  );
                })()}
                {/* History group */}
                {(() => {
                  const isCollapsed = collapsedGroups.has('History');
                  return (
                    <div className="bob-history-group">
                      <button
                        className="bob-history-group-label bob-history-group-toggle"
                        onClick={() => setCollapsedGroups(prev => {
                          const n = new Set(prev);
                          n.has('History') ? n.delete('History') : n.add('History');
                          return n;
                        })}
                        aria-expanded={!isCollapsed}
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"
                          className={`bob-group-chevron${isCollapsed ? ' collapsed' : ''}`} aria-hidden="true">
                          <path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z"/>
                        </svg>
                        History
                      </button>
                      {!isCollapsed && history.map(h => (
                        <button key={h.id} className="bob-history-item" onClick={() => {}}>
                          <div className="bob-history-item-title">{h.title}</div>
                          <div className="bob-history-item-ago">{h.ago}</div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Chat area */}
          <div className="bob-ask-chat">
            <div className="bob-chat-messages">
              {messages.map(msg => {
                const hasContext = msg.evidence && msg.evidence.length > 0;
                const contextOpen = openContext.has(msg.id);
                return (
                <div key={msg.id} className={`bob-msg bob-msg-${msg.role}`}>
                  {/* Agent name block — replaced old generic avatar+label row */}
                  {msg.role === 'agent' && (
                    <AgentNameBlock agentLabel={msg.agentLabel} isThinking={!!msg.progressSteps} />
                  )}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="bob-tool-chips">
                      {msg.toolCalls.map(tc => (
                        <span key={tc.id} className="bob-tool-chip">⚙ {tlabel(tc.name)}</span>
                      ))}
                    </div>
                  )}
                  {msg.statCard && (
                    <div className="bob-stat-card">
                      <div className="bob-stat-card-label">{msg.statCard.label}</div>
                      <div className="bob-stat-card-value">{msg.statCard.value}</div>
                      {msg.statCard.delta && (
                        <div className={`bob-stat-card-delta ${msg.statCard.deltaPositive ? 'pos' : 'neg'}`}>{msg.statCard.delta}</div>
                      )}
                      {msg.statCard.context && <div className="bob-stat-card-context">{msg.statCard.context}</div>}
                    </div>
                  )}
                  {/* Progress tracker replaces the plain typing indicator */}
                  {msg.progressSteps ? (
                    <AgentProgressTracker steps={msg.progressSteps} agentLabel={msg.agentLabel} />
                  ) : msg.text === '…' ? (
                    <div className="bob-msg-bubble"><div className="tsci-typing-dots"><span /><span /><span /></div></div>
                  ) : (
                    <>
                      {/* Answer bubble — clean text only, no inline evidence */}
                      <div className="bob-msg-bubble">
                        {msg.role === 'agent'
                          ? <RichAnswer text={msg.text} />
                          : <div className="tsci-prewrap">{msg.text}</div>}
                        {msg.grounded === false && <div className="bob-grounding-tag neg">NOT GROUNDED — insufficient evidence</div>}
                        {msg.grounded === true && msg.confidence != null && (
                          <div className="bob-grounding-tag pos">Grounded · {Math.round(msg.confidence * 100)}% confidence</div>
                        )}
                      </div>

                      {/* Collapsible context pane — rendered outside the bubble */}
                      {(hasContext || extractSources(msg.text).length > 0) && (() => {
                        const sources = extractSources(msg.text);
                        const totalSources = (msg.evidence?.length ?? 0) + sources.length;
                        return (
                          <div className="bob-context-pane">
                            <button
                              className="bob-context-toggle"
                              onClick={() => setOpenContext(prev => {
                                const n = new Set(prev);
                                n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id);
                                return n;
                              })}
                              aria-expanded={contextOpen}
                            >
                              <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"
                                className={`bob-group-chevron${contextOpen ? '' : ' collapsed'}`} aria-hidden="true">
                                <path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z"/>
                              </svg>
                              Evidence Sources
                              {totalSources > 0 && <span className="bob-context-count">{totalSources} source{totalSources !== 1 ? 's' : ''}</span>}
                            </button>
                            {contextOpen && (
                              <div className="bob-context-body">
                                {/* Source name chips from preamble */}
                                {sources.length > 0 && (
                                  <div className="bob-context-sources">
                                    {sources.map((s, i) => (
                                      <span key={i} className="rag-source-chip">{s}</span>
                                    ))}
                                  </div>
                                )}
                                {/* Full evidence blocks (when RAG backend returns structured evidence) */}
                                {msg.evidence?.map(ev => <EvidenceBlock key={ev.evidence_id} evidence={ev} />)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {msg.role === 'agent' && msg.text !== '…' && !msg.progressSteps && (
                    <div className="bob-pin-row">
                      <button
                        className={`bob-pin-btn${pinned.has(msg.id) ? ' pinned' : ''}`}
                        onClick={() => setPinned(prev => { const n = new Set(prev); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })}
                      >
                        <PinIcon />
                        {pinned.has(msg.id) ? 'PINNED' : 'PIN TO MY BOARD'}
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {/* Input bar */}
            <div className="bob-ask-input-area">
              <div className="bob-cost-line">
                THIS CHAT
                <span className="bob-cost-sep">·</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" className="tsci-cost-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                {isLive ? 'wxO Live' : '0 TOKENS'}
              </div>
              <div className="bob-input-bar">
                <input ref={inputRef} type="text" className="bob-input"
                  placeholder="Ask about supply resilience, risks, materials, approvals…"
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(input); } }}
                  disabled={loading}
                />
                <button className="bob-send-btn" onClick={() => send(input)}
                  disabled={loading || !input.trim()} aria-label="Send"><SendArrow /></button>
              </div>
              <div className="bob-input-disclaimer">
                Queries never modify data&nbsp;·&nbsp;Results limited to your access
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MY BOARD tab — pinned insights + quick-action cards
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'My Board' && (
        <div className="tsci-agent-tab-panel">
          <div className="tsci-section-title tsci-agent-tab-heading">
            MY BOARD · PINNED INSIGHTS · TA-2026
          </div>

          {/* Pinned agent responses */}
          {pinned.size > 0 ? (
            <div className="tsci-agent-section tsci-agent-section--lg">
              <div className="tsci-section-title">PINNED FROM ASK</div>
              {Array.from(pinned).map(id => {
                const msg = messages.find(m => m.id === id);
                if (!msg) return null;
                return (
                  <div key={id} className="tsci-board-card">
                    <div className="tsci-board-card-label">{msg.agentLabel ?? 'TSCI AGENT'}</div>
                    {msg.statCard && (
                      <div className="bob-stat-card tsci-board-stat">
                        <div className="bob-stat-card-label">{msg.statCard.label}</div>
                        <div className="bob-stat-card-value">{msg.statCard.value}</div>
                        {msg.statCard.delta && <div className={`bob-stat-card-delta ${msg.statCard.deltaPositive ? 'pos' : 'neg'}`}>{msg.statCard.delta}</div>}
                      </div>
                    )}
                    <div className="tsci-board-copy">{msg.text}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="tsci-card tsci-card--strong tsci-card--dashed tsci-board-empty">
              <div className="tsci-body-md">No pinned insights yet.</div>
              <div className="tsci-board-empty-hint">Use PIN TO MY BOARD under any agent response in the Ask tab.</div>
            </div>
          )}

          {/* Quick action cards */}
          <div className="tsci-section-title">DECISION ACTIONS — TW-2047</div>
          <div className="tsci-grid tsci-grid--cards">
            {[
              { title: 'Request Inventory Transfer', sub: 'REGIONAL-WH-DEMO → Pearl GTL', tag: 'REQUIRES APPROVAL', tagColor: 'var(--tsci-yellow)', action: 'TRANSFER_REQUEST' },
              { title: 'Expedite via SUP-205', sub: 'Asia Valve Corp · TERTIARY · Unconstrained', tag: 'PROCUREMENT', tagColor: 'var(--tsci-accent)', action: 'ALTERNATE_SUPPLIER' },
              { title: 'Expedite SHP-90017', sub: 'Air freight surcharge · +72h ETA', tag: 'LOGISTICS', tagColor: 'var(--tsci-teal)', action: 'EXPEDITE' },
              { title: 'Engineering Substitute Review', sub: 'CVA-8842 near-equivalents in spec', tag: 'ENGINEERING', tagColor: 'var(--tsci-orange)', action: 'SUBSTITUTE' },
            ].map(card => (
              <div key={card.title} className="tsci-action-card">
                <div className="tsci-action-card-tag" style={{ color: card.tagColor }}>{card.tag}</div>
                <div className="tsci-action-card-title">{card.title}</div>
                <div className="tsci-action-card-sub">{card.sub}</div>
                <button
                  onClick={() => { setActiveTab('Ask'); send(`Tell me about the ${card.action} option for CVA-8842 / TW-2047`); }}
                  className="tsci-compact-btn"
                >
                  Ask Agent →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'AVL Live' && <AvlLiveTab key="avl-live" />}
    </div>
  );
};
