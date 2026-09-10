# Flink SQL Reference

These scripts show how the Python risk engine logic can be moved into Confluent Cloud for Apache Flink.

In many Confluent Cloud workspaces, Kafka topics registered with schemas are automatically available as tables. Treat these scripts as reference logic and adapt syntax to your Confluent Cloud Flink workspace, catalog, and schema names.

Recommended implementation path:

1. Register schemas for input topics.
2. Verify the topics appear as Flink tables.
3. Run enrichment views.
4. Create output tables/topics for risk scores and recommendations.
5. Replace the Python risk engine with Flink SQL statements.
