# Workshop Guide

## Duration

60 to 90 minutes.

## Audience

Partner solution engineers, client architects, supply chain leaders, data engineers, and AI builders.

## Learning objectives

By the end of the workshop, participants should be able to:

- Explain why supply chain risk is an event-streaming problem.
- Describe the Confluent Cloud topic model.
- Run a synthetic supply chain risk scenario.
- Understand how risk scoring works.
- Extend the building block to a real source system or AI layer.

## Agenda

| Time | Activity |
|---:|---|
| 0-10 min | Business problem and use case story |
| 10-20 min | Architecture walkthrough |
| 20-35 min | Run the dry-run demo |
| 35-50 min | Run against Confluent Cloud topics |
| 50-65 min | Review Flink SQL and scoring logic |
| 65-80 min | Add AI recommendation prompt |
| 80-90 min | Partner/customer adaptation discussion |

## Hands-on tasks

1. Change the `safety_stock_qty` and observe the risk band.
2. Increase `delay_hours` and observe the recommendation.
3. Add a new external risk event type.
4. Change the customer order priority to `STRATEGIC`.
5. Add an alternate supplier and observe mitigation effect.

## Discussion prompts

- Which source systems would a real customer use for these events?
- Which supply chain risks are most important for the customer industry?
- Should the recommendation trigger an automatic workflow or only an alert?
- What data quality rules would be mandatory before production use?
- Which IBM products should be attached to the demo story?
