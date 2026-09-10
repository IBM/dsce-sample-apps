# SPEC-05: IBM Cloud Object Storage Data Lake

Back to [specs index](README.md) | [main README](../../README.md)

---

## Spec Classification

| Field | Value |
|---|---|
| Spec type | SDD implementation spec |
| Status | Ready for implementation as managed connector configuration |
| Primary actor | Bob / developer implementing with Bob |
| Target asset | Supply Chain Risk Control Tower |
| Architecture layer | Layer 5 — Data persistence and archival |

---

## 1. Business Goal

The risk engine publishes useful operational events but does not persist them long term. This spec adds a durable data lake by configuring a Confluent Cloud S3-compatible sink connector to archive output topic events into IBM Cloud Object Storage in newline-delimited JSON.

---

## 2. Scope

Configure a managed connector/IaC path for archiving `supply_chain_risk_scores`, `supply_chain_recommendations`, and `control_tower_alerts` to IBM COS.

---

## 3. Non-Goals

- Do not add Python code for this integration.
- Do not transform event schemas during archival.
- Do not make COS archival required for the live demo.
- Do not commit HMAC access keys or secret keys.

---

## 4. Files to Create or Modify

- `code/terraform/cos-sink-connector.json or equivalent connector config`
- `code/terraform/main.tf if managed through Terraform`
- `code/terraform/variables.tf if managed through Terraform`
- `.env.example or connector variable documentation`
- `docs/specs/SPEC-05-ibm-cos-data-lake.md`

---

## 5. Input Contract

| Item | Requirement |
|---|---|
| Topics | `supply_chain_risk_scores`, `supply_chain_recommendations`, `control_tower_alerts` |
| Format | Newline-delimited JSON, one Kafka message per line |
| Partitioning | Time-based partitioning by `yyyy/MM/dd/HH` |
| Rotation | Every 1,000 records or 10 minutes, whichever occurs first |
| Connector | Confluent Cloud S3-compatible sink connector targeting IBM COS |

---

## 6. Output Contract

| Item | Requirement |
|---|---|
| COS path | `s3://<bucket>/<topic>/yyyy/MM/dd/HH/*.json` |
| File format | NDJSON |
| Compression | gzip unless environment chooses otherwise |
| Consumers | Historical analytics, compliance/audit review, model training, and SPEC-06 |

---

## 7. Functional Requirements

- Create a connector configuration that archives all three output topics.
- Use IBM COS HMAC credentials with the S3-compatible endpoint.
- Keep bucket name, endpoint, credentials, and rotation settings configurable.
- Preserve event payloads without schema-altering transformation.
- Provide Terraform-compatible variables if the project manages Confluent resources as IaC.
- Document the expected bucket layout for downstream analytics.

---

## 8. Configuration and Secrets

Add placeholders to `.env.example`. Add real values only to local `.env`, CI/CD secret stores, or the relevant managed connector configuration.

```dotenv
# IBM Cloud Object Storage — S3 sink connector (SPEC-05)
IBM_COS_HMAC_ACCESS_KEY_ID=your-cos-hmac-access-key-id
IBM_COS_HMAC_SECRET_ACCESS_KEY=your-cos-hmac-secret-access-key
IBM_COS_BUCKET_NAME=scrc-data-lake
IBM_COS_ENDPOINT=https://s3.us-east.cloud-object-storage.appdomain.cloud
```

---

## 9. Runtime Behavior

- The connector runs outside the Python application.
- The connector consumes all configured output topics continuously.
- Data lands in topic-specific, time-partitioned COS prefixes.
- Connector configuration should support local documentation and Terraform-based deployment.
- The Python application should not read these environment variables at runtime unless future specs require it.

---

## 10. Failure Handling and Idempotency

- Connector retries and error handling should use managed connector defaults unless overridden deliberately.
- Authentication failures must be visible in connector logs.
- Duplicate files may occur after connector restarts; downstream queries should tolerate replay/at-least-once semantics.
- Changing rotation or partition settings after launch must be treated as a migration decision.
- If the connector is down, Kafka producers must continue unaffected.

---

## 11. Security, Privacy, and Governance

- Never commit HMAC secret keys.
- Use least-privilege COS service credentials scoped to the target bucket where possible.
- Enable bucket encryption and lifecycle policies according to environment governance.
- Do not archive secrets if upstream payloads accidentally include them; validate payload contracts before production.
- Document retention expectations for audit and cost control.

---

## 12. Testing Requirements

- Validate connector config JSON structure if a config file is generated.
- Validate Terraform formatting if Terraform resources are modified.
- Manual integration test confirms files appear in COS after events are produced.
- Verify downloaded objects contain valid NDJSON and expected topic payload fields.
- No Python unit tests are required unless helper scripts are added.

---

## 13. Acceptance Criteria

- [ ] Connector configuration exists and contains placeholders, not real secrets.
- [ ] All three output topics are configured.
- [ ] COS endpoint includes the correct `https://` regional endpoint.
- [ ] Files appear under topic-specific time partitions.
- [ ] A downloaded file contains one valid JSON object per line.
- [ ] Connector logs show successful consumption without authentication errors.
- [ ] No application code was unnecessarily changed.

---

## 14. Implementation Notes for Bob

- Treat this as a configuration/IaC spec, not an application-code spec.
- If adding Terraform, keep variables clearly named and sensitive values marked sensitive where supported.
- Keep connector config placeholders obvious with `YOUR_*` or variable references.
- Preserve compatibility with SPEC-06, which expects durable Iceberg/Tableflow storage patterns.

---

## 15. Verification

1. Produce events using the existing risk engine scenario.
2. Confirm the Confluent connector status is Running.
3. After the flush interval, browse the IBM COS bucket.
4. Confirm paths follow `<topic>/yyyy/MM/dd/HH/`.
5. Download a file, decompress if needed, and confirm each line is valid JSON matching the topic payload.
6. If no files appear after 10 minutes, check connector authentication and `store.url` endpoint configuration.

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
