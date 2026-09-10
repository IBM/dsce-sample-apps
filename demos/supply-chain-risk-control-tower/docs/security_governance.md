# Security and Governance Considerations

## Minimum demo security

- Use a dedicated Confluent Cloud environment for demos.
- Use a dedicated service account for the app.
- Store credentials in `.env` locally and in a secrets manager for shared environments.
- Do not commit `.env` or Terraform state files.
- Restrict API keys to the required cluster and environment.

## Production considerations

- Use least-privilege ACLs instead of broad admin permissions.
- Configure private networking if customer policy requires it.
- Use secrets management for API keys and sink credentials.
- Add DLQ topics for malformed records.
- Add observability for producer, consumer, connector, and Flink job health.
- Add audit and lineage for recommendation events.
- Avoid sending sensitive contract, pricing, or customer data to AI models unless approved.

## AI governance

The AI layer should explain and recommend. For high-impact decisions such as supplier switching, expedited freight, or customer communication, require human approval unless business policy explicitly allows automation.
