# Real-Time AI Guardrails — Seller Demo Script

> **Before you start:** Open the demo URL. The left column (Select Guardrails) lists metrics in three groups, each with a checkbox and a Threshold field. Above the query are four scenario buttons. The query, context and response fields are read-only. Scenario buttons fill the text — you tick the metrics yourself.

## 1. Set the scene
**Key message:** A user may share sensitive data or try to bypass controls, and the model may answer convincingly but wrongly. Real-Time AI Guardrails, powered by watsonx.governance, catches this as it happens.

- As AI agents join everyday operations, the question is how to keep them safe, reliable and correct.

## 2. Tour the catalog
**Key message:** A single safety check is not enough — each risk gets its own metric, and each metric has its own threshold.

- Point at the three groups on the left: **Content Safety**, **RAG**, and **Response Quality** — 18 metrics in all.

## 3. Scenario 1 — Unsafe input
**Key message:** The request is blocked before it reaches the model. A customer service agent that needs to collect personal data can tune the PII threshold differently.

- Click **Content Safety**.
- Tick **PII Detection**, **Harm Detection**, and **Jailbreak Detection**.
- Click **Run Guardrails**.
- Show the High Risk tile and the flagged rows in the table.

## 4. Tune a threshold
**Key message:** For different use cases, you will need different thresholds.

- Change a Threshold field — e.g. raise PII Detection from 0.65 to 0.95.
- Click **Run Guardrails** again and show the result flip.

## 5. Scenario 2 — Unsupported answer (hallucination)
**Key message:** The answer claims facts the reference documents never mention. This stops a hallucination before it reaches a customer.

- Click **RAG: Unsupported Answer**.
- Keep Jailbreak Detection ticked; add **Answer Relevance**, **Context Relevance**, and **Faithfulness**.
- The context and generated response fields open.
- Click **Run Guardrails**: Faithfulness blocks while the two relevance metrics pass.

## 6. Scenario 3 — Safe but incomplete
**Key message:** These use an LLM as a judge — you enforce the quality of the experience, not only safety and accuracy.

- Click **Response Quality: Long & Incomplete**.
- Add **Answer Completeness** and **Conciseness**.
- Click **Run Guardrails**: both block.

## 7. Scenario 4 — A rule of your own
**Key message:** You can encode your own requirements using the same SDK — no custom infrastructure required.

- Click **Response Quality: No Next Steps**.
- Keep Helpfulness and add **Action Oriented Validator**.
- Click **Run Guardrails**: the custom validator blocks.
- Explain: the policy requires actionable next steps in every troubleshooting answer, and this validator was written with the same watsonx.governance SDK.

## 8. Close
**Key message:** Built-in and custom guardrails, configurable thresholds, policies enforced in real time. The same SDK calls run inside your own agents, applications and workflows, with audit logging.

- Mention the source code is in the repository for reference.
