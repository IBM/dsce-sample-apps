# SPEC-08: Instana Observability and Custom Dashboards

Back to [specs index](README.md) | [main README](../../README.md)

---

## Spec Classification

| Field | Value |
|---|---|
| Spec type | SDD implementation spec |
| Status | Ready for Bob implementation after Instana tenant details are confirmed |
| Primary actor | Bob / developer implementing with Bob |
| Target asset | Supply Chain Risk Control Tower |
| Architecture layer | Layer 5 — Observability and operational monitoring |

---

## 1. Business Goal

The Supply Chain Risk Control Tower has a browser UI, a Python bridge, Kafka consumers/producers, scoring logic, and external integrations. This spec adds Instana observability so teams can see frontend experience, backend request behavior, risk scoring latency, Kafka-related processing, and external integration latency in one place.

---

## 2. Scope

Instrument the browser UI and Python backend so Instana can capture EUM, traces, custom spans, and dashboard metrics relevant to the demo.

---

## 3. Non-Goals

- Do not make Instana required for the core demo to run.
- Do not hardcode EUM keys, agent keys, or tenant URLs.
- Do not build a full enterprise observability rollout.
- Do not change the business behavior of the risk engine.

---

## 4. Files to Create or Modify

- `pyproject.toml`
- `code/ui/index.html`
- `code/ui/kafka_bridge.py`
- `code/scrc/risk_engine.py`
- `.env.example`
- `tests/` or the existing test location for UI/backend modules
- `optional dashboard export JSON if supported`

---

## 5. Input Contract

| Item | Requirement |
|---|---|
| Frontend | `code/ui/index.html` and browser interactions with `/start`, `/stop`, `/status`, `/events` |
| Backend bridge | `code/ui/kafka_bridge.py` |
| Risk engine | `code/scrc/risk_engine.py` scoring and external integration calls |
| External calls | Slack, Teams, watsonx.ai, and future adapters where present |

---

## 6. Output Contract

| Item | Requirement |
|---|---|
| EUM telemetry | Page load, sessions, browser API calls, SSE connection behavior |
| Backend traces | HTTP bridge requests and selected risk engine operations |
| Custom spans | Risk scoring and external integration latency |
| Dashboard | KPIs and charts for latency, throughput, errors, and integration health |

---

## 7. Functional Requirements

- Add Instana dependency only if required by the chosen instrumentation approach.
- Make frontend EUM configuration placeholder-driven, not hardcoded.
- Initialize backend instrumentation safely so missing package/config does not crash local demo runs.
- Wrap critical scoring and external integration calls with custom spans when the Instana SDK is available.
- Add custom tags such as component ID, risk band, scenario, and integration name without leaking secrets.
- Document dashboard widgets needed for demo validation.

---

## 8. Configuration and Secrets

Add placeholders to `.env.example`. Add real values only to local `.env`, CI/CD secret stores, or the relevant managed connector configuration.

```dotenv
# Instana Observability (SPEC-08)
INSTANA_AGENT_KEY=your_instana_agent_key_here
INSTANA_ENDPOINT_URL=https://your-instana-endpoint-here.instana.io
INSTANA_EUM_KEY=your_eum_website_key_here
INSTANA_EUM_REPORTING_URL=https://eum-your-region.instana.io
```

---

## 9. Runtime Behavior

- The application must run normally when Instana configuration is absent.
- Frontend EUM script should be included only in a safe/configurable way suitable for the demo environment.
- Backend instrumentation should initialize early but fail open if Instana is not installed/configured.
- Custom spans should measure risk scoring and external calls without changing return values.
- Dashboard widgets should use stable span names and tag names.

---

## 10. Failure Handling and Idempotency

- Instrumentation failures must not break HTTP bridge, SSE, risk scoring, or external notifications.
- If Instana agent is unavailable, log at debug/info level and continue.
- Avoid creating high-cardinality tags such as full message bodies or unique secrets.
- Do not wrap code in a way that swallows business exceptions silently.
- Keep span names stable for dashboard reuse.

---

## 11. Security, Privacy, and Governance

- Never expose Instana agent keys or EUM keys in committed code.
- Do not send full payloads, supplier contracts, credentials, or sensitive customer data as span tags.
- Use environment-specific configuration for tenant URLs.
- Make observability additive and non-invasive.
- Follow least-privilege access for dashboard viewers in shared environments.

---

## 12. Testing Requirements

- Unit test that instrumentation wrappers call the wrapped function and preserve return values.
- Unit test behavior when Instana package/import is unavailable.
- Unit test custom tag construction without leaking sensitive fields.
- Manual verification confirms EUM and traces appear in Instana.
- Regression test confirms risk engine dry-run still works without Instana configuration.

---

## 13. Acceptance Criteria

- [ ] `.env.example` contains Instana placeholders only.
- [ ] The app runs without Instana installed/configured or fails open where dependency is optional.
- [ ] Frontend EUM can be enabled for the demo environment.
- [ ] Risk scoring and watsonx/external integration spans use stable names.
- [ ] Dashboard design includes frontend latency, API call volume, risk scoring latency, external integration latency, and error list.
- [ ] No sensitive payloads or secrets are emitted as telemetry tags.
- [ ] Automated tests pass without a real Instana tenant.

---

## 14. Implementation Notes for Bob

- Keep Instana imports guarded where local demo usability requires it.
- Prefer small helper functions/decorators for custom spans instead of scattering instrumentation code everywhere.
- Use stable names such as `scrc-risk-scoring` and `watsonx-ai-generation` for dashboard filters.
- Make dashboard setup declarative/exportable if the project supports Instana dashboard export; otherwise document manual setup.

---

## 15. Verification

1. Configure Instana agent and EUM values in local environment only.
2. Start `python code/ui/kafka_bridge.py`.
3. Open the UI, switch to Live Kafka mode, and run a scenario.
4. In Instana Websites, confirm page-load and browser request telemetry.
5. In Instana Applications/Traces, confirm bridge requests and custom spans such as `scrc-risk-scoring`.
6. Build or import the dashboard and confirm the expected KPIs/charts show data.

---

## 16. Open Questions

Confirm whether the project should store an Instana dashboard export file or keep dashboard creation as manual demo setup.

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
