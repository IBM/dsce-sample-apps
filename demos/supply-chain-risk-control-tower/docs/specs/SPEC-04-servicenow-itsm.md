# SPEC-04: ServiceNow Procurement Workflow

Back to [specs index](README.md) | [main README](../../README.md)

---

## Spec Classification

| Field | Value |
|---|---|
| Spec type | SDD implementation spec |
| Status | Ready for Bob implementation after assignment group is confirmed |
| Primary actor | Bob / developer implementing with Bob |
| Target asset | Supply Chain Risk Control Tower |
| Architecture layer | Layer 5 — Downstream applications and ITSM/procurement workflow |

---

## 1. Business Goal

When the control tower emits a CRITICAL alert, procurement needs a trackable workflow item. This spec adds a Kafka consumer that creates a ServiceNow incident, or a future procurement escalation record, for every CRITICAL alert.

---

## 2. Scope

Create a standalone ServiceNow consumer for `control_tower_alerts`. It filters for CRITICAL alerts and creates incidents with enough context for procurement triage.

---

## 3. Non-Goals

- Do not modify the risk engine to synchronously create ServiceNow tickets.
- Do not create custom ServiceNow tables in this spec.
- Do not implement OAuth unless the environment requires it; keep the code structured so auth can be swapped later.
- Do not create tickets for LOW, MEDIUM, or HIGH alerts.

---

## 4. Files to Create or Modify

- `code/scrc/servicenow_consumer.py`
- `.env.example`
- `tests/` or the existing test location for `scrc` modules

---

## 5. Input Contract

| Item | Requirement |
|---|---|
| Topic | `control_tower_alerts` |
| Consumer group | `scrc-servicenow-consumer` |
| Filter | `alert["severity"] == "CRITICAL"` |
| Alert fields | `alert_id`, `risk_id`, `severity`, `title`, `message`, `recommended_action`, `event_time` |

---

## 6. Output Contract

| Item | Requirement |
|---|---|
| ServiceNow record | Incident through Table API `POST /api/now/table/incident` |
| Incident fields | Short description, description, urgency, impact, category, assignment group, work notes |
| Assignment | Configured procurement assignment group |

---

## 7. Functional Requirements

- Create a standalone consumer process for CRITICAL alerts.
- Map alert fields to a clear incident payload.
- Set urgency and impact to high for CRITICAL events.
- Use configured assignment group and category `procurement` unless overridden.
- Record the source `alert_id` and `risk_id` in the description or correlation field when available.
- Log created incident number and alert ID.

---

## 8. Configuration and Secrets

Add placeholders to `.env.example`. Add real values only to local `.env`, CI/CD secret stores, or the relevant managed connector configuration.

```dotenv
# ServiceNow — procurement incident automation (SPEC-04)
SERVICENOW_INSTANCE_URL=https://YOUR_INSTANCE.service-now.com
SERVICENOW_USERNAME=integration-user
SERVICENOW_PASSWORD=replace-me
SERVICENOW_ASSIGNMENT_GROUP=Procurement
```

---

## 9. Runtime Behavior

- The consumer skips non-CRITICAL alerts with a debug/info log.
- For CRITICAL alerts, the consumer creates exactly one incident per consumed alert event where possible.
- The consumer should commit offsets only after successful handling or after a consciously skipped non-CRITICAL event.
- The implementation should support basic auth initially and keep auth isolated for future OAuth replacement.
- The process runs independently from the core risk engine.

---

## 10. Failure Handling and Idempotency

- Use idempotency when possible by storing/searching a correlation value such as `alert_id` before creating a new incident.
- On ServiceNow 5xx or network timeout, retry with bounded backoff and do not commit the offset until resolved or dead-lettered/logged.
- On 4xx validation/auth errors, log a clear error and stop or skip according to severity of misconfiguration.
- Malformed alert payloads should be skipped with a warning and offset committed to prevent poison-message loops.

---

## 11. Security, Privacy, and Governance

- Never log ServiceNow passwords.
- Use HTTPS only.
- Use a dedicated least-privilege integration user.
- Prefer OAuth/API token patterns for production even if basic auth is acceptable for a demo.
- Do not include unnecessary sensitive supplier/customer information in the ticket.

---

## 12. Testing Requirements

- Unit test alert-to-incident payload mapping.
- Unit test CRITICAL filter behavior.
- Unit test idempotency lookup/create behavior with ServiceNow calls mocked.
- Unit test 401/403/5xx/timeout handling.
- Unit test malformed alert handling.

---

## 13. Acceptance Criteria

- [ ] `.env.example` contains all ServiceNow placeholders.
- [ ] Consumer subscribes to `control_tower_alerts` using `scrc-servicenow-consumer`.
- [ ] Only CRITICAL alerts create incidents.
- [ ] Created incidents include alert title, recommended action, alert ID, and risk ID.
- [ ] Duplicate alert handling is defined and tested.
- [ ] ServiceNow errors do not crash the core risk engine.
- [ ] Automated tests pass without a real ServiceNow instance.

---

## 14. Implementation Notes for Bob

- Keep ServiceNow API operations in small functions such as payload builder, client create call, and alert handler.
- Use the existing Kafka utilities for configuration and deserialization.
- Keep authentication isolated so production OAuth can replace basic auth later.
- Do not put ServiceNow UI setup steps into code; keep them as verification/preparation guidance.

---

## 15. Verification

1. Verify ServiceNow API reachability with the configured credentials.
2. Start `python -m scrc.servicenow_consumer`.
3. Produce events with `python -m scrc.risk_engine --dry-run --scenario inventory_drop --count 6` or an equivalent live run.
4. Confirm the consumer logs a created incident for CRITICAL alerts.
5. In ServiceNow, verify the incident has high urgency/impact, procurement assignment group, and work notes containing recommended action.

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
