# SPEC-07: IBM Maximo Work Order Automation

Back to [specs index](README.md) | [main README](../../README.md)

---

## Spec Classification

| Field | Value |
|---|---|
| Spec type | SDD implementation spec |
| Status | Ready for Bob implementation after Maximo auth mode, site ID, and org ID are confirmed |
| Primary actor | Bob / developer implementing with Bob |
| Target asset | Supply Chain Risk Control Tower |
| Architecture layer | Layer 5 — Downstream applications and asset/work management |

---

## 1. Business Goal

Some CRITICAL supply-chain alerts require a physical response such as logistics expediting, emergency maintenance inspection, or parts reallocation. This spec adds a Maximo consumer that creates a work order for CRITICAL alerts so operational response can be tracked in IBM Maximo.

---

## 2. Scope

Create a standalone consumer for `control_tower_alerts`. It filters CRITICAL events and creates Maximo work orders with priority 1 and waiting-for-approval status.

---

## 3. Non-Goals

- Do not synchronously create Maximo work orders from the risk engine publish path.
- Do not create work orders for HIGH, MEDIUM, or LOW alerts.
- Do not model the full Maximo asset/location hierarchy in this spec.
- Do not require Maximo for the base Kafka demo to run.

---

## 4. Files to Create or Modify

- `code/scrc/maximo_consumer.py`
- `.env.example`
- `tests/` or the existing test location for `scrc` modules

---

## 5. Input Contract

| Item | Requirement |
|---|---|
| Topic | `control_tower_alerts` |
| Consumer group | `scrc-maximo-consumer` |
| Filter | `alert["severity"] == "CRITICAL"` |
| Alert fields | `alert_id`, `risk_id`, `severity`, `title`, `message`, `recommended_action`, `event_time` |
| Optional enrichment | Risk score joined by `risk_id` if available |

---

## 6. Output Contract

| Item | Requirement |
|---|---|
| Maximo Work Order | Created via Maximo REST/OSLC API `POST /maximo/oslc/os/mxwo` or environment-specific equivalent |
| Work Order fields | `description`, long description, `wopriority=1`, `siteid`, `orgid`, `status=WAPPR`, `worktype=CM` unless configured otherwise |
| Runtime output | Log created work order number/location and source alert ID |

---

## 7. Functional Requirements

- Create `maximo_consumer.py` as a standalone process.
- Support API key authentication as preferred production mode and basic auth as optional dev mode.
- Map CRITICAL alert fields to a Maximo work order payload.
- Use configured site ID and org ID.
- Include alert ID, risk ID, recommended action, and event time in the long description.
- Skip non-CRITICAL alerts without calling Maximo.

---

## 8. Configuration and Secrets

Add placeholders to `.env.example`. Add real values only to local `.env`, CI/CD secret stores, or the relevant managed connector configuration.

```dotenv
# IBM Maximo — work order automation (SPEC-07)
MAXIMO_BASE_URL=https://YOUR_MAXIMO_HOST
MAXIMO_API_KEY=
MAXIMO_USERNAME=
MAXIMO_PASSWORD=
MAXIMO_SITE_ID=BEDFORD
MAXIMO_ORG_ID=EAGLENA
```

---

## 9. Runtime Behavior

- The consumer runs independently of the core risk engine.
- If `MAXIMO_API_KEY` is present, use API-key auth; otherwise use basic auth only when username/password are present.
- The consumer should validate required configuration at startup.
- For each CRITICAL alert, create a work order and log the resulting work order number if returned.
- Commit Kafka offsets only after a successful create, intentional skip, or explicitly handled non-retryable error.

---

## 10. Failure Handling and Idempotency

- Use idempotency when possible by checking for an existing work order with the same alert ID before creating a new one.
- Retry network/5xx failures with bounded backoff.
- Treat 401/403 as configuration/permission failures and surface clearly.
- Treat 404 path errors as Maximo API path/configuration issues.
- Malformed alert messages should be skipped with clear warning logs to avoid poison-message loops.

---

## 11. Security, Privacy, and Governance

- Never log API keys or passwords.
- Use HTTPS only.
- Use a dedicated Maximo integration user with least-privilege work-order create access.
- Avoid sending unnecessary sensitive customer/supplier data to Maximo.
- Prefer API key auth for production.

---

## 12. Testing Requirements

- Unit test alert-to-work-order payload mapping.
- Unit test auth header selection for API key and basic auth modes.
- Unit test CRITICAL filtering and non-CRITICAL skips.
- Unit test 401/403/404/422/5xx/timeout handling with requests mocked.
- Unit test idempotency behavior if lookup is implemented.

---

## 13. Acceptance Criteria

- [ ] `.env.example` includes Maximo placeholders with no real credentials.
- [ ] Consumer subscribes to `control_tower_alerts` with `scrc-maximo-consumer`.
- [ ] Only CRITICAL alerts result in Maximo API calls.
- [ ] Work orders contain priority 1, WAPPR status, site ID, org ID, alert ID, risk ID, and recommended action.
- [ ] Maximo API failures are logged clearly and do not impact the core risk engine.
- [ ] Automated tests pass without a real Maximo instance.

---

## 14. Implementation Notes for Bob

- Keep Maximo-specific API logic isolated behind small client/helper functions.
- Do not assume the OSLC path case; make it configurable if needed.
- Keep Maximo field names centralized as constants to support customer-specific configuration.
- Preserve the consumer pattern used by the ServiceNow spec where possible.

---

## 15. Verification

1. Verify `GET <MAXIMO_BASE_URL>/maximo/oslc/` or the configured Maximo API base path is reachable.
2. Start `python -m scrc.maximo_consumer`.
3. Produce CRITICAL alerts from the risk engine.
4. Confirm the consumer logs a created work order.
5. In Maximo Work Order Tracking, filter descriptions containing `Supply Chain` and verify priority, status, site, org, and long description.

---

## 16. Open Questions

Confirm whether the target Maximo environment requires API key auth, basic auth, or another enterprise SSO/OAuth flow.

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
