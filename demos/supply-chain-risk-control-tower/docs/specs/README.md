# Extension Specifications

Back to [main README](../../README.md).

This folder contains SDD-ready specifications for future integrations in the Supply Chain Risk Control Tower. Each spec is written as an implementation contract for Bob and a developer, not as a long copy-paste tutorial.

The goal is to give Bob enough intent, boundaries, contracts, and validation criteria to implement safely while avoiding over-prescribing every line of code.

---

## What is Already Built

| Component | Location |
|---|---|
| Python risk engine — consumes 7 input topics, scores risk, publishes 3 output topics | `code/scrc/` |
| IBM Carbon Design browser dashboard — simulation and live Kafka modes | `code/ui/` |
| JSON Schema data contracts for all 10 Kafka topics | `code/schemas/` |
| Schema Registry registration script | `code/scrc/register_schemas.py` |
| Flink SQL reference implementation of the risk engine | `code/flink-sql/` |
| Slack alerts for HIGH and CRITICAL severity events | `code/scrc/slack_alerts.py` |
| watsonx.ai prompt templates for manual use in Prompt Lab | `docs/agents/` |
| Confluent Cloud Terraform infrastructure | `code/terraform/` |

---

## SDD Authoring Principles Used in This Folder

1. **Intent before implementation** — every spec starts with the business goal, scope, non-goals, and contracts.
2. **Minimal but sufficient guidance** — Bob should use existing code patterns instead of blindly copying large code blocks from the spec.
3. **Explicit context boundary** — each spec lists files Bob may create or modify.
4. **Contracts over snippets** — input/output schemas, runtime behavior, and acceptance criteria are treated as the source of truth.
5. **Testable acceptance criteria** — each spec defines automated tests and manual verification.
6. **Safe-by-default integrations** — missing credentials or external API failures should not break the core Kafka pipeline unless the integration process itself is being tested.
7. **Secrets stay out of source control** — `.env.example` gets placeholders only.
8. **External systems are mocked in tests** — APIs, webhooks, cloud connectors, and observability tools must not be required for unit tests.

---

## What These Specs Cover

| Spec | Integration | Effort | Primary Pattern |
|---|---|---:|---|
| [SPEC-01](SPEC-01-watsonx-ai-live.md) | watsonx.ai live API for executive summaries and supplier emails on CRITICAL events | Low | Optional AI enrichment |
| [SPEC-02](SPEC-02-opensearch-consumer.md) | OpenSearch consumer for live operational search and dashboards | Low | Kafka consumer + index writer |
| [SPEC-03](SPEC-03-teams-alerts.md) | Microsoft Teams webhook alerts for HIGH and CRITICAL events | Low | Notification adapter |
| [SPEC-04](SPEC-04-servicenow-itsm.md) | ServiceNow incident workflow from `control_tower_alerts` | Medium | Kafka consumer + ticket creation |
| [SPEC-05](SPEC-05-ibm-cos-data-lake.md) | IBM COS archive through Confluent S3-compatible sink connector | Medium | Managed connector / IaC |
| [SPEC-06](SPEC-06-watsonxdata-tableflow.md) | watsonx.data / Confluent Tableflow governed Iceberg tables | Medium | Governed analytics configuration |
| [SPEC-07](SPEC-07-ibm-maximo.md) | IBM Maximo work order automation from CRITICAL alerts | High | Kafka consumer + work order creation |
| [SPEC-08](SPEC-08-instana-dashboard.md) | IBM Instana observability with EUM, tracing, and custom dashboard | Low | Observability instrumentation |

---

## Standard Spec Structure

Each spec follows this SDD structure:

1. Spec Classification
2. Business Goal
3. Scope
4. Non-Goals
5. Files to Create or Modify
6. Input Contract
7. Output Contract
8. Functional Requirements
9. Configuration and Secrets
10. Runtime Behavior
11. Failure Handling and Idempotency
12. Security, Privacy, and Governance
13. Testing Requirements
14. Acceptance Criteria
15. Implementation Notes for Bob
16. Verification
17. Open Questions
18. Definition of Ready
19. Bob / SDD Execution Guardrails

---

## How Bob Should Use These Specs

1. Parse the spec and restate the intended change in 3–5 bullets.
2. Ask clarifying questions only when a required contract is missing or contradictory.
3. Create the smallest implementation that satisfies the acceptance criteria.
4. Keep common integration behavior in reusable helpers when appropriate.
5. Add tests with mocked external dependencies.
6. Run focused tests first, then the relevant dry-run or integration verification.
7. Summarize changed files, tests run, and any open risks before PR creation.

---

## Combining Specs

Specs are independent, but these combinations work well for demos:

- **SPEC-01 + SPEC-03**: watsonx.ai generates the summary, and Teams posts it as a card.
- **SPEC-02 + SPEC-05**: OpenSearch provides hot operational analytics, while COS provides a cold historical archive.
- **SPEC-04 + SPEC-07**: ServiceNow handles procurement escalation, and Maximo handles physical response work orders.
- **SPEC-05 + SPEC-06**: COS stores durable event history, and Tableflow/watsonx.data exposes governed Iceberg tables.
