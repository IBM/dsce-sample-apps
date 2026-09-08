# Demo Script — Live Context with Bob, Confluent & watsonx Orchestrate for Turnaround Resilience

---

**Step 1 — Set the Business Context**

1. Start with the business problem: supply-chain decisions are often made using information distributed across multiple systems, and the context can become stale very quickly.
2. Explain the concept of Live Context: the user should be able to ask a business question and receive an answer based on the latest relevant supply event or state, not only a previously indexed snapshot.

**Step 2 — Introduce the Turnaround Scenario**

1. Introduce the Oil & Gas turnaround scenario and material CVA-8842, which is required for a critical turnaround activity.
2. Explain why material readiness is time-critical and the consequences of acting on outdated supplier or sourcing information.

**Step 3 — Query the watsonx Orchestrate Agent**

1. Ask the watsonx Orchestrate supply-chain agent for the latest approved-vendor or sourcing context for CVA-8842.
2. Show that the answer is based on the current Confluent real-time context rather than a stale indexed snapshot.

**Step 4 — Publish a Live Supplier Change in Confluent**

1. Publish or replay a supplier, approved-vendor, or sourcing change event in Confluent.
2. Briefly explain what the event represents and how it would affect turnaround readiness decisions.

**Step 5 — Show the Agent Reflecting Updated Context**

1. Ask the same or a related question again and show that the agent reflects the updated context at query time.
2. Highlight the contrast with a static RAG approach where the answer would still be based on the previous snapshot.

**Step 6 — Explain the Business Value**

1. Explain the business value: planners and procurement teams can identify sourcing exposure earlier and make better readiness decisions before a material issue affects the turnaround schedule.

**Step 7 — Show How Bob Brings the Solution Together**

1. Show how IBM Bob is used to assemble the end-to-end solution — Confluent for events and live context, watsonx Orchestrate for the agent and workflow experience.
2. Walk through the Bob skills, modes, MCP servers, APIs, and integrations used to build the solution pattern.

**Step 8 — Close with Broader Applicability**

1. Close by explaining that this is only one example. The same Live Context pattern can be applied to logistics disruption, supplier risk, inventory shortages, maintenance readiness, pressure/leak response, and other industry use cases where decisions depend on rapidly changing information.
