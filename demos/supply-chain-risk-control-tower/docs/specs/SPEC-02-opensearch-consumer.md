# SPEC-02: OpenSearch Operational Dashboard

Back to [specs index](README.md) | [main README](../../README.md)

---

## Spec Classification

| Field | Value |
|---|---|
| Spec type | SDD implementation spec |
| Status | Ready for Bob implementation |
| Primary actor | Bob / developer implementing with Bob |
| Target asset | Supply Chain Risk Control Tower |
| Architecture layer | Layer 5 — Downstream applications and operational analytics |

---

## 1. Business Goal

The risk engine publishes scored events to three output Kafka topics. This spec adds a dedicated OpenSearch consumer that indexes those events so operations teams can search root causes, inspect recommendations, analyze risk score trends, and build live dashboards.

---

## 2. Scope

Create a standalone consumer process that reads the three output topics and writes date-partitioned documents into OpenSearch. Keep this separate from the risk scoring path so indexing failures do not affect risk generation.

---

## 3. Non-Goals

- Do not change topic schemas.
- Do not modify the risk scoring algorithm.
- Do not require OpenSearch for the base demo to run.
- Do not build the final dashboard visuals in code; only provide enough indexed data and verification guidance.

---

## 4. Files to Create or Modify

- `pyproject.toml`
- `code/scrc/opensearch_consumer.py`
- `.env.example`
- `docs/assets/opensearch-index-template.json if template changes are required`
- `tests/` or the existing test location for `scrc` modules

---

## 5. Input Contract

| Item | Requirement |
|---|---|
| Topics | `supply_chain_risk_scores`, `supply_chain_recommendations`, `control_tower_alerts` |
| Consumer group | `scrc-opensearch-consumer` |
| Message format | JSON from `kafka_utils.json_deserializer` |
| Index pattern | `supply-chain-risk-scores-YYYY-MM`, `supply-chain-recommendations-YYYY-MM`, `control-tower-alerts-YYYY-MM` |
| Index template | `docs/assets/opensearch-index-template.json` |

---

## 6. Output Contract

| Item | Requirement |
|---|---|
| OpenSearch documents | One document per consumed Kafka message |
| Index partitioning | Monthly index names based on event timestamp or processing time fallback |
| Search fields | Severity/risk band, component, supplier, root cause, recommendation, event time |
| Dashboard support | Indexed data supports Discover, visualizations, and alerting rules |

---

## 7. Functional Requirements

- Create `code/scrc/opensearch_consumer.py` as a standalone long-running process.
- Subscribe to all three output topics with the configured consumer group.
- Map topic names to deterministic index prefixes.
- Use stable document IDs where an event ID exists to avoid duplicate documents on reprocessing.
- Apply or document the OpenSearch index template before indexing.
- Log consumed, indexed, skipped, and failed message counts.

---

## 8. Configuration and Secrets

Add placeholders to `.env.example`. Add real values only to local `.env`, CI/CD secret stores, or the relevant managed connector configuration.

```dotenv
# OpenSearch — operational risk dashboard (SPEC-02)
OPENSEARCH_URL=http://localhost:9200
OPENSEARCH_USERNAME=
OPENSEARCH_PASSWORD=
OPENSEARCH_VERIFY_TLS=true
```

---

## 9. Runtime Behavior

- The consumer runs independently of the risk engine.
- Each valid Kafka message is indexed into the topic-specific monthly index.
- If authentication values are blank, support local unauthenticated OpenSearch for development.
- If a message has malformed JSON or missing expected fields, skip it and log the reason without stopping the process.
- Use batching only if it does not hide per-record failures from logs/tests.

---

## 10. Failure Handling and Idempotency

- Use deterministic document IDs such as `alert_id`, `risk_id`, recommendation ID, or a topic/partition/offset fallback.
- On OpenSearch transient errors, retry with bounded backoff.
- On permanent mapping errors, log the failed document metadata and continue.
- Consumer restart should not create duplicate documents when deterministic IDs are available.
- OpenSearch being down should not affect Kafka producers.

---

## 11. Security, Privacy, and Governance

- Do not log OpenSearch passwords.
- Support TLS verification for managed OpenSearch endpoints.
- Avoid indexing secrets or credentials if they appear in upstream payloads.
- Use least-privilege OpenSearch credentials with index write permissions only for the consumer.

---

## 12. Testing Requirements

- Unit test topic-to-index mapping.
- Unit test document ID selection and timestamp fallback.
- Unit test malformed message handling.
- Unit test OpenSearch client calls with the client mocked.
- Integration verification may use local OpenSearch, but unit tests must not require it.

---

## 13. Acceptance Criteria

- [ ] `opensearch-py` is added to dependencies.
- [ ] `.env.example` contains OpenSearch placeholders.
- [ ] The consumer subscribes to all three output topics.
- [ ] Documents are written to the expected monthly index names.
- [ ] Malformed messages are skipped without stopping the consumer.
- [ ] A duplicate event does not create duplicate documents when the same deterministic ID is present.
- [ ] Automated tests pass with OpenSearch mocked.

---

## 14. Implementation Notes for Bob

- Reuse existing Kafka settings and deserializer utilities.
- Keep OpenSearch connection setup isolated from the consume loop.
- Keep index naming and payload transformation pure and testable.
- Do not introduce dashboard-specific assumptions into the event schema.
- Keep local Docker commands as verification notes, not as required implementation logic.

---

## 15. Verification

1. Start local or managed OpenSearch and apply the index template if used.
2. Start the risk engine and producer so output topics receive messages.
3. Start `python -m scrc.opensearch_consumer`.
4. Query `GET /supply-chain-risk-scores-*/_count` and confirm the count increases.
5. Query CRITICAL alerts in `control-tower-alerts-*` and confirm matching documents appear.
6. Open OpenSearch Dashboards and create an index pattern such as `supply-chain-risk-scores-*` with `event_time` as the time field.

---

## 16. Open Questions

None at this time.

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
