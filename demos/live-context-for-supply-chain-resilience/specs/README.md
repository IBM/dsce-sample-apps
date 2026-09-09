# Specification Pack — Oil & Gas Turnaround Supply Chain Intelligence

**Project:** Oil & Gas Turnaround Supply Chain Intelligence (TSCI)  
**Last Updated:** 2025-07  
**Spec Authority:** All implementation code must conform to approved specifications in this directory. If a change is required, update the relevant specification first, identify downstream impacts, then change implementation and tests.  
**Classification:** SYNTHETIC DEMO — not real Shell or Pearl GTL operational data

---

## Quick Start: What Order to Read the Specs

| Goal | Read in this order |
|---|---|
| **Understand the project** | `CTO_BRIEF.md` → `01_PRODUCT_REQUIREMENTS.md` |
| **Build the backend** | 02 → 03 → 04 → 05 → 06 → 08 → 09 → 13 |
| **Build the UI** | 07 → 04 → 06 |
| **Set up Kafka / events** | 03 → 14 → `SPEC-WXO-DIRECT-CONFLUENT-EVENT-ACCESS.md` |
| **Deploy the demo** | 12 → 11 → 14 |
| **Understand agent orchestration** | 06 → 05 → 09 → 14 |
| **Run tests** | 10 → 04 → 12 |

---

## Spec Catalogue

| # | File | Version | Status | Description |
|---|---|---|---|---|
| — | `CTO_BRIEF.md` | 1.0 | Active | Executive one-pager: business case, value proposition, key risks, and success metrics for leadership |
| — | `00_BOB_MASTER_INSTRUCTION.md` | 1.0 | Active | Master instructions for the Bob AI engineering agent — spec-driven workflow rules, tool permissions, change process |
| 01 | `01_PRODUCT_REQUIREMENTS.md` | 1.1 | Implemented | Full product requirements, user stories, acceptance criteria, definition of done, and phase milestones |
| 02 | `02_DOMAIN_MODEL.md` | 1.0 | Implemented | Domain entity definitions, enumerations, relationships, and invariants (narrative form) |
| 02 | `02_DOMAIN_MODEL.yaml` | 1.0 | Implemented | Machine-readable domain model: entities, fields, types, enums, relationships |
| 03 | `03_EVENT_CONTRACTS.md` | 1.1 | Implemented | Kafka topic contracts: topic catalogue, schema definitions, header rules, ordering guarantees (narrative) |
| 03 | `03_EVENT_CONTRACTS.yaml` | 1.1 | Implemented | Machine-readable event contracts: all production topic schemas with field types and validation rules |
| 04 | `04_API_AND_TOOL_CONTRACTS.md` | 1.2 | Implemented | REST API contracts, WXO tool interface definitions, error model, resilience patterns, approval lifecycle |
| 04 | `04_API_AND_TOOL_CONTRACTS.yaml` | 1.2 | Implemented | OpenAPI-aligned machine-readable tool contracts for all 22 WXO tools (read, write, resilience, Confluent) |
| 05 | `05_OPENSEARCH_RAG_SPEC.md` | 1.0 | Implemented | OpenSearch index structure, hybrid retrieval pipeline, grounding rules, evidence formatting, corpus scope |
| 06 | `06_WXO_AGENT_AND_WORKFLOW_SPEC.md` | 1.1 | Implemented | WXO agent pool design: all 8 agents, routing logic, deterministic workflow steps, collaboration patterns |
| 06 | `06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` | 1.1 | Implemented | Machine-readable agent and workflow spec: agent definitions, tool assignments, workflow state machines |
| 07 | `07_APPLICATION_AND_UI_SPEC.md` | 2.0 | Implemented | UI control tower spec: all 7 pages, shared components, API client, WXO integration, domain types, build config |
| 08 | `08_SECURITY_OBSERVABILITY_NFR.md` | 1.0 | Implemented | Security requirements, authentication, authorisation, observability instrumentation, and non-functional requirements |
| 09 | `09_SCORING_AND_DECISION_SPEC.md` | 1.0 | Implemented | Mitigation option scoring model: weighted composite algorithm, near-equivalent detection, confidence thresholds |
| 09 | `09_SCORING_AND_DECISION_SPEC.yaml` | 1.0 | Implemented | Machine-readable scoring rules: weight tables, threshold values, tie-breaking rules |
| 10 | `10_TEST_AND_EVALUATION_SPEC.md` | 1.0 | Implemented | Test strategy: unit, integration, contract, end-to-end, and agent evaluation test definitions |
| 10 | `10_TEST_AND_EVALUATION_SPEC.yaml` | 1.0 | Implemented | Machine-readable test dataset: evaluation prompts, expected agent behaviours, pass/fail criteria |
| 11 | `11_PHASE_DELIVERY_PLAN.md` | 1.0 | Active | Phased delivery plan: milestones, dependencies, exit criteria per phase, and risk-adjusted timeline |
| 12 | `12_DEMO_DATA_AND_SCENARIO.md` | 1.1 | Implemented | Synthetic demo data: CVA-8842 scenario narrative, seed event sequences, persona descriptions, demo flow |
| 13 | `13_SUPPLY_CHAIN_RESILIENCE_SPEC.md` | 1.0 | Implemented | Supply chain resilience framework: resilience profiles, scoring algorithm, constraint rules, staleness policy |
| 14 | `14_CONTINUOUS_RAG_AGENT_SPEC.md` | 1.0 | Implemented | Continuous RAG agent (`crag_rag_agent_v1`): 7 `crag.*` topics, RTCE toolkit, seeding, operations, AC-001–AC-010 |
| — | `SPEC-WXO-DIRECT-CONFLUENT-EVENT-ACCESS.md` | 1.0 | Active | Design spec: WXO direct Confluent event access via RTCE MCP — authentication, toolkit configuration, query patterns |
| — | `WXO_AGENT_UI_INTEGRATION_SPEC_UPDATED.md` | 1.1 | Active | Updated WXO agent–UI integration patterns: session management, streaming, error handling, environment variable conventions |
| — | `design/continuous-supply-chain-rag.design.md` | 1.0 | Superseded | Technical design for the Continuous RAG subsystem (superseded by `14_CONTINUOUS_RAG_AGENT_SPEC.md` for operational details) |

---

## Key Sections by Spec

| File | Must-Read Sections |
|---|---|
| `01_PRODUCT_REQUIREMENTS.md` | Business requirements, user stories, acceptance criteria, definition of done |
| `02_DOMAIN_MODEL.yaml` | Entity definitions (`Material`, `WorkPackage`, `Shipment`, `Supplier`, `Risk`), enumerations |
| `03_EVENT_CONTRACTS.yaml` | Topic catalogue, schema per topic, header contract, ordering guarantees |
| `04_API_AND_TOOL_CONTRACTS.yaml` | Read tools, write tools, resilience tools, error model, approval lifecycle |
| `05_OPENSEARCH_RAG_SPEC.md` | Corpus scope, index mapping, hybrid retrieval pipeline, grounding rules |
| `06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` | Agent pool, tool assignments, deterministic workflow steps, collaboration routing |
| `07_APPLICATION_AND_UI_SPEC.md` | Page inventory (7 pages), component library, `VITE_*` env vars, WXO chat integration |
| `08_SECURITY_OBSERVABILITY_NFR.md` | Auth model, secret handling, OpenTelemetry setup, NFRs |
| `09_SCORING_AND_DECISION_SPEC.yaml` | Scoring weights, tie-breaking, near-equivalence threshold |
| `13_SUPPLY_CHAIN_RESILIENCE_SPEC.md` | Resilience profiles, scoring dimensions, constraint rules, staleness thresholds |
| `14_CONTINUOUS_RAG_AGENT_SPEC.md` | crag agent vs. primary agent, 7 topic catalogue, 9 seeded events, deployment steps, AC-001–AC-010 |

---

## Reading Guide by Role

### Turnaround Planner / Business Stakeholder
Focus on what the system does and how it supports decisions:
1. `CTO_BRIEF.md` — business context and value
2. `01_PRODUCT_REQUIREMENTS.md` — what the system must do
3. `12_DEMO_DATA_AND_SCENARIO.md` — understand the CVA-8842 demo scenario

### Developer (Full-Stack / Backend)
Build order — read each spec before implementing:
1. `02_DOMAIN_MODEL.yaml` — entities and types
2. `03_EVENT_CONTRACTS.yaml` — Kafka topic schemas
3. `04_API_AND_TOOL_CONTRACTS.yaml` — API and tool interfaces
4. `05_OPENSEARCH_RAG_SPEC.md` — RAG pipeline
5. `06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` — agent design
6. `07_APPLICATION_AND_UI_SPEC.md` — UI pages and components
7. `08_SECURITY_OBSERVABILITY_NFR.md` — security and observability
8. `09_SCORING_AND_DECISION_SPEC.yaml` — scoring engine
9. `10_TEST_AND_EVALUATION_SPEC.yaml` — test expectations
10. `13_SUPPLY_CHAIN_RESILIENCE_SPEC.md` — resilience engine
11. `14_CONTINUOUS_RAG_AGENT_SPEC.md` — Confluent RAG agent

### Solution Architect
Focus on system design and integration boundaries:
1. `02_DOMAIN_MODEL.yaml` — canonical data model
2. `03_EVENT_CONTRACTS.yaml` — event topology
3. `04_API_AND_TOOL_CONTRACTS.yaml` — service interface contracts
4. `06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` — orchestration design
5. `08_SECURITY_OBSERVABILITY_NFR.md` — non-functional requirements
6. `09_SCORING_AND_DECISION_SPEC.yaml` — decision engine design
7. `13_SUPPLY_CHAIN_RESILIENCE_SPEC.md` — resilience framework
8. `14_CONTINUOUS_RAG_AGENT_SPEC.md` — RTCE/MCP integration pattern
9. `SPEC-WXO-DIRECT-CONFLUENT-EVENT-ACCESS.md` — direct event access design

### Data / Kafka Engineer
Focus on events, schemas, and streaming infrastructure:
1. `03_EVENT_CONTRACTS.yaml` — all production topic schemas
2. `14_CONTINUOUS_RAG_AGENT_SPEC.md` — `crag.*` topics, RTCE registration, seeding scripts
3. `SPEC-WXO-DIRECT-CONFLUENT-EVENT-ACCESS.md` — RTCE authentication and query patterns
4. `05_OPENSEARCH_RAG_SPEC.md` — how events feed the RAG corpus

### Executive / Leadership
High-level context only:
1. `CTO_BRIEF.md` — full executive summary
2. `01_PRODUCT_REQUIREMENTS.md` — sections 1 (overview) and 6 (acceptance criteria)

---

## Cross-Reference Index

| Topic | Primary Spec | Also Covered In |
|---|---|---|
| Kafka topic schemas and event contracts | `03_EVENT_CONTRACTS.yaml` | `14_CONTINUOUS_RAG_AGENT_SPEC.md` (crag.* topics) |
| Domain entities and enumerations | `02_DOMAIN_MODEL.yaml` | `04_API_AND_TOOL_CONTRACTS.yaml` (request/response types) |
| REST API and WXO tool contracts | `04_API_AND_TOOL_CONTRACTS.yaml` | `06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` (tool assignments) |
| OpenSearch RAG pipeline | `05_OPENSEARCH_RAG_SPEC.md` | `06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` (evidence retrieval step) |
| WXO agent design and orchestration | `06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` | `14_CONTINUOUS_RAG_AGENT_SPEC.md` (crag agent isolation) |
| UI pages and components | `07_APPLICATION_AND_UI_SPEC.md` | `WXO_AGENT_UI_INTEGRATION_SPEC_UPDATED.md` |
| Security, auth, and secrets | `08_SECURITY_OBSERVABILITY_NFR.md` | `14_CONTINUOUS_RAG_AGENT_SPEC.md` (RTCE credentials) |
| Scoring and decision logic | `09_SCORING_AND_DECISION_SPEC.yaml` | `01_PRODUCT_REQUIREMENTS.md` (AC for scoring) |
| Test strategy and evaluation | `10_TEST_AND_EVALUATION_SPEC.yaml` | `12_DEMO_DATA_AND_SCENARIO.md` (test data) |
| Delivery milestones and phases | `11_PHASE_DELIVERY_PLAN.md` | `01_PRODUCT_REQUIREMENTS.md` (phase outcomes) |
| Demo scenario and synthetic data | `12_DEMO_DATA_AND_SCENARIO.md` | `14_CONTINUOUS_RAG_AGENT_SPEC.md` (DEMO-TW2047-001) |
| Supply chain resilience framework | `13_SUPPLY_CHAIN_RESILIENCE_SPEC.md` | `04_API_AND_TOOL_CONTRACTS.yaml` (resilience tools) |
| Continuous RAG / RTCE / crag.* topics | `14_CONTINUOUS_RAG_AGENT_SPEC.md` | `SPEC-WXO-DIRECT-CONFLUENT-EVENT-ACCESS.md` |
| WXO–UI integration patterns | `WXO_AGENT_UI_INTEGRATION_SPEC_UPDATED.md` | `07_APPLICATION_AND_UI_SPEC.md` |

---

## Spec Change Process

Changes to any spec must follow this process:

1. **Propose** — open a spec change proposal (or update the spec directly with a clear change log entry) describing what is changing and why
2. **Impact analysis** — identify all downstream specs, implementation files, and tests that reference the changed contract (use the cross-reference index above)
3. **Update** — apply the change to the spec file; update all downstream specs if contracts are affected
4. **Implement** — update implementation code and tests to match the new spec; do not change implementation before updating the spec
5. **Verify** — ensure all automated tests pass and all acceptance criteria in the changed spec are met

A phase is not complete until: its specification is implemented, automated tests pass, contract tests pass where applicable, failure behaviour is implemented, observability is present, and no downstream contract has been silently changed.

---

## Mandatory Technology Stack

| Component | Technology | Spec |
|---|---|---|
| Event backbone | Confluent Cloud (Kafka + Flink + Schema Registry) | 03, 14 |
| Knowledge retrieval | OpenSearch (hybrid BM25 + semantic) | 05 |
| Agent orchestration | IBM watsonx Orchestrate (wxO) | 06, 14 |
| Backend API | Python (FastAPI) | 04 |
| Control tower UI | React + TypeScript (Vite) | 07 |
| Scoring engine | Python (deterministic weighted composite) | 09 |
| Resilience framework | Python (integrated with backend) | 13 |
| Continuous RAG | wxO native agent + Confluent RTCE MCP toolkit | 14 |

---

> **Disclaimer:** All purchase orders, material identifiers, inventory positions, dates, costs, risk scores, supplier names, and operational outcomes in this specification pack and its associated demo data are entirely synthetic. Nothing in this pack represents Shell internal data, Shell operational decisions, or Shell system architecture.
