# SPEC-06: watsonx.data and Confluent Tableflow

Back to [specs index](README.md) | [main README](../../README.md)

---

## Spec Classification

| Field | Value |
|---|---|
| Spec type | SDD implementation spec |
| Status | Ready for configuration implementation after Stream Governance entitlement is confirmed |
| Primary actor | Bob / developer implementing with Bob |
| Target asset | Supply Chain Risk Control Tower |
| Architecture layer | Layer 5 — Governed analytics |

---

## 1. Business Goal

Analytics teams need governed SQL access to historical risk events. This spec uses Confluent Tableflow to materialize output topics into Apache Iceberg tables and registers those tables in IBM watsonx.data for Presto/Trino querying.

---

## 2. Scope

Configure Tableflow for the three output topics, connect the Iceberg storage to watsonx.data, register/query the tables, and provide reference analytics SQL.

---

## 3. Non-Goals

- Do not add Python runtime changes.
- Do not replace SPEC-05; this spec is the governed analytics path, not the raw archive path.
- Do not change Kafka topic schemas.
- Do not promise sub-second analytics latency; this is near-real-time analytical storage.

---

## 4. Files to Create or Modify

- `code/flink-sql/watsonxdata_queries.sql`
- `docs/specs/SPEC-06-watsonxdata-tableflow.md`
- `optional IaC files if Tableflow/catalog setup is automated later`

---

## 5. Input Contract

| Item | Requirement |
|---|---|
| Topics | `supply_chain_risk_scores`, `supply_chain_recommendations`, `control_tower_alerts` |
| Schema source | Confluent Schema Registry JSON Schema subjects |
| Sync mechanism | Confluent Tableflow |
| Storage | S3-compatible object storage, preferably IBM COS for this asset |
| Catalog | watsonx.data Iceberg catalog |

---

## 6. Output Contract

| Item | Requirement |
|---|---|
| Iceberg tables | One governed table per output topic |
| Table names | `supply_chain_risk_scores`, `supply_chain_recommendations`, `control_tower_alerts` |
| Query engine | watsonx.data Presto/Trino |
| Expected latency | Approximately 1–5 minutes after Kafka messages are produced |

---

## 7. Functional Requirements

- Verify Schema Registry subjects exist before enabling Tableflow.
- Enable Tableflow for each output topic.
- Use IBM COS or another supported S3-compatible store for Iceberg data.
- Register the resulting Iceberg tables in watsonx.data.
- Provide reference SQL for counts, CRITICAL trends, supplier/component risk, and recommendation analysis.
- Document troubleshooting steps for missing schemas, Tableflow errors, and catalog registration issues.

---

## 8. Configuration and Secrets

Add placeholders to `.env.example`. Add real values only to local `.env`, CI/CD secret stores, or the relevant managed connector configuration.

```dotenv
# watsonx.data / Tableflow (SPEC-06)
# No new Python application environment variables are required.
# Store COS/Tableflow credentials in Confluent Cloud, watsonx.data, Terraform variables, or a secret manager.
```

---

## 9. Runtime Behavior

- The Python application continues producing Kafka events as-is.
- Tableflow asynchronously materializes each topic into Iceberg files/tables.
- watsonx.data queries the tables after registration.
- New records should appear in analytic tables within the expected near-real-time latency window.
- Reference SQL should not rely on environment-specific table paths unless clearly parameterized.

---

## 10. Failure Handling and Idempotency

- If schemas are missing, Tableflow should not be enabled until Schema Registry registration is fixed.
- If no data appears, inspect Tableflow status and storage permissions before changing application code.
- Treat Tableflow as at-least-once ingestion from Kafka into analytical storage.
- Catalog registration failures should be resolved in watsonx.data/COS configuration, not by changing event producers.
- Document any manual UI steps that cannot yet be automated.

---

## 11. Security, Privacy, and Governance

- Store object storage credentials in managed configuration or secret stores.
- Use governed catalog permissions in watsonx.data.
- Do not expose raw supplier/customer data to users without appropriate data access controls.
- Define retention and table access policy before production use.
- Avoid copying credentials into SQL files or Markdown examples.

---

## 12. Testing Requirements

- Validate reference SQL syntax where possible.
- Manual integration test confirms table counts increase after events are produced.
- Confirm each topic has a registered schema subject before Tableflow is enabled.
- Confirm watsonx.data queries can filter CRITICAL events and aggregate by supplier/component.
- No Python unit tests are required unless automation scripts are added.

---

## 13. Acceptance Criteria

- [ ] Schema Registry subjects exist for all three output topics.
- [ ] Tableflow is enabled and running for all three topics.
- [ ] Iceberg metadata/data appears in the configured object storage location.
- [ ] watsonx.data catalog contains the three expected tables.
- [ ] Reference SQL returns counts and trend results.
- [ ] No Python runtime changes were made unnecessarily.
- [ ] Credentials are not committed to source control.

---

## 14. Implementation Notes for Bob

- Keep this spec configuration-driven.
- Save only reusable, non-secret SQL in `code/flink-sql/watsonxdata_queries.sql` or another agreed docs/code location.
- Make it clear when a step is manual UI configuration versus automatable IaC.
- Preserve compatibility with SPEC-05 bucket/credential decisions where possible.

---

## 15. Verification

1. Run the schema registration script and confirm all output-topic subjects exist.
2. Enable Tableflow on each output topic.
3. Produce events from the risk engine.
4. Wait 2–5 minutes and verify Iceberg files/metadata appear in object storage.
5. Register tables in watsonx.data.
6. Run `SELECT COUNT(*) FROM supply_chain_risk_scores;` and confirm rows appear.
7. Run a CRITICAL-risk trend query from the reference SQL.

---

## 16. Open Questions

Confirm exact Confluent Tableflow entitlement and whether Tableflow setup will be manual UI, CLI, or Terraform-driven in the target environment.

---

## Definition of Ready

Bob may start implementation only when all of the following are known:

- The integration target and trigger are clear.
- Input topic, payload contract, filtering rules, and expected output are defined.
- Required files to create or modify are listed.
- Required environment variables are named and have placeholder-safe examples.
- Failure behavior is defined for missing credentials, API errors, timeouts, malformed messages, and retry/idempotency concerns.
- Acceptance criteria are testable without relying only on a manual UI check.

---

## Bob / SDD Execution Guardrails

- Treat this document as the implementation contract, not as a tutorial. Use the existing application patterns and shared utilities where they already exist.
- Keep changes limited to the files listed in **Files to create or modify** unless the implementation cannot compile or pass tests without a clearly justified additional change.
- Do not commit secrets, tokens, webhook URLs, passwords, API keys, generated credentials, or tenant-specific endpoints.
- Prefer small, reviewable changes. Keep connector/API-specific logic isolated behind a dedicated module or consumer.
- External systems must be optional at runtime. If credentials are missing, the core Kafka demo must still run unless this spec explicitly requires the integration process to be started.
- Add or update tests before marking the spec complete. Mock external APIs, webhooks, and cloud services in automated tests.
- Log enough metadata for troubleshooting, but never log secret values or full credentials.
