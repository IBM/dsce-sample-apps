# SPEC-01: watsonx.ai Live API Integration

Back to [specs index](README.md) | [main README](../../README.md)

---

## Spec Classification

| Field | Value |
|---|---|
| Spec type | SDD implementation spec |
| Status | Ready for Bob implementation after credential placeholders and model choice are confirmed |
| Primary actor | Bob / developer implementing with Bob |
| Target asset | Supply Chain Risk Control Tower |
| Architecture layer | Layer 5 — Downstream applications and AI enrichment |

---

## 1. Business Goal

The current prompt templates in `docs/agents/` require a human to copy JSON from the terminal into Prompt Lab. This spec adds an optional live watsonx.ai enrichment path so that every CRITICAL control tower alert can automatically produce a plain-language executive summary and a supplier escalation email draft.

The business outcome is to close the loop between the Kafka risk pipeline and the AI layer without making the core event pipeline dependent on the LLM call.

---

## 2. Scope

Implement only the runtime API integration from CRITICAL alerts to watsonx.ai-generated text. The output remains terminal-rendered strings for this spec, with the design kept reusable for Teams, email, or ServiceNow routing in later specs.

---

## 3. Non-Goals

- Do not replace the existing manual prompt templates in `docs/agents/`.
- Do not send generated emails automatically.
- Do not block Kafka publishing, Slack, Teams, or other downstream processing when watsonx.ai is unavailable.
- Do not hardcode a single model or tenant-specific project configuration.

---

## 4. Files to Create or Modify

- `pyproject.toml`
- `code/scrc/watsonx_client.py`
- `code/scrc/settings.py`
- `code/scrc/risk_engine.py`
- `.env.example`
- `tests/` or the existing test location for `scrc` modules

---

## 5. Input Contract

| Item | Requirement |
|---|---|
| Trigger | `Alert.severity == "CRITICAL"` inside `RiskPublisher.publish()` after the core alert object is created |
| Risk event | `RiskResult` dataclass from `code/scrc/models.py` |
| Recommendation | `Recommendation` dataclass from `code/scrc/models.py` |
| Alert | `Alert` dataclass from `code/scrc/models.py` |
| Sample payload | `docs/assets/sample_risk_event.json` |

---

## 6. Output Contract

| Item | Requirement |
|---|---|
| Executive summary | Plain-language summary suitable for procurement or operations leadership |
| Supplier email draft | Professional escalation email body; generated as a draft only |
| Rendering | Printed using existing rich terminal output patterns |
| Downstream reuse | Both generated strings are returned or available for later routing |

---

## 7. Functional Requirements

- Add an isolated `watsonx_client` module that exposes summary and supplier-email generation functions.
- Use a configurable model ID, project ID, service URL, and API key from settings.
- Use structured system/user prompts based on the existing risk, recommendation, and alert objects.
- Call watsonx.ai only for CRITICAL alerts and only when the required configuration is present.
- Keep deterministic fallback text available when the model call fails or is disabled.
- Do not mutate the source Kafka event payloads.

---

## 8. Configuration and Secrets

Add placeholders to `.env.example`. Add real values only to local `.env`, CI/CD secret stores, or the relevant managed connector configuration.

```dotenv
# IBM watsonx.ai — live API integration (SPEC-01)
WATSONX_API_KEY=your-ibm-cloud-api-key
WATSONX_PROJECT_ID=your-watsonx-project-id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct
```

---

## 9. Runtime Behavior

- Risk publishing must continue even if watsonx.ai is not configured.
- When all watsonx settings are present and severity is CRITICAL, the publisher generates and prints both outputs.
- For HIGH, MEDIUM, LOW, or malformed severity values, watsonx.ai is not called.
- The model ID and generation parameters are configuration-driven or isolated as constants in `watsonx_client.py`.
- The prompt should include only the fields needed to explain the risk and draft the escalation.

---

## 10. Failure Handling and Idempotency

- Wrap watsonx.ai calls in exception handling and log a concise warning on failure.
- Use timeouts or SDK-level request configuration where available.
- Return fallback text rather than raising into the Kafka publishing flow.
- Avoid duplicate prints for the same alert ID in a single publish call.
- Missing credentials should disable the enrichment path, not crash the application.

---

## 11. Security, Privacy, and Governance

- Never log `WATSONX_API_KEY` or raw credentials.
- Do not include secrets, internal tokens, or unnecessary PII in the prompt.
- Generated supplier email is a draft; a human or downstream workflow must approve before sending.
- Keep prompt content auditable by building it from explicit event fields.
- Use guardrails/content filtering when supported by the configured watsonx.ai deployment.

---

## 12. Testing Requirements

- Unit test the client prompt builder without calling watsonx.ai.
- Unit test successful generation with the watsonx SDK/API mocked.
- Unit test API failure, timeout, and missing-credential behavior.
- Unit test that non-CRITICAL alerts do not call the client.
- Regression test that Kafka publish logic still runs when the LLM path fails.

---

## 13. Acceptance Criteria

- [ ] `ibm-watsonx-ai` is added to dependencies only if the implementation uses the SDK.
- [ ] `.env.example` contains placeholders for all watsonx settings, including model ID.
- [ ] No credentials or real project IDs are committed.
- [ ] CRITICAL dry-run alerts print both a summary and supplier email draft when credentials are configured.
- [ ] Non-CRITICAL alerts do not invoke watsonx.ai.
- [ ] watsonx failure does not stop Kafka publishing or dry-run output.
- [ ] Automated tests mock watsonx.ai and pass locally.

---

## 14. Implementation Notes for Bob

- Prefer a small adapter module over embedding SDK logic in `risk_engine.py`.
- Keep prompt construction deterministic and separately testable.
- Preserve existing Slack behavior and add watsonx.ai as an optional enrichment block.
- Use the existing settings loading style in `code/scrc/settings.py`.
- Do not paste full generated code into this spec; Bob should implement from these contracts.

---

## 15. Verification

1. Run `python -m scrc.risk_engine --dry-run --scenario supplier_delay --count 10`.
2. If no CRITICAL event appears, run `python -m scrc.risk_engine --dry-run --scenario inventory_drop --count 6`.
3. Confirm the normal Control Tower Alert panel still appears.
4. With watsonx credentials configured, confirm `watsonx.ai — Executive Summary` and `watsonx.ai — Supplier Escalation Email` panels appear after a CRITICAL alert.
5. Temporarily unset `WATSONX_API_KEY` and confirm the pipeline still runs without watsonx output.

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
