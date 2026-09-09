-- Reference Flink SQL: calculate risk score.
-- This can be converted into INSERT INTO supply_chain_risk_scores SELECT ...

CREATE VIEW calculated_supply_chain_risk_scores AS
SELECT
  CONCAT('RISK-', component_id, '-', CAST(UNIX_TIMESTAMP() AS STRING)) AS risk_id,
  ctx.component_id,
  ctx.supplier_id,
  ctx.customer_order_id,
  LEAST(100,
    GREATEST(0,
      CASE
        WHEN ctx.days_of_supply <= 0 THEN 35
        WHEN ctx.days_of_supply < GREATEST(CAST(ctx.delay_hours AS DOUBLE) / 24, 1) THEN 35
        WHEN ctx.days_of_supply < 3 THEN 25
        WHEN ctx.days_of_supply < 7 THEN 15
        ELSE 0
      END
      + LEAST(30, CAST(ctx.delay_hours / 3 AS INT))
      + CASE
          WHEN ctx.reliability_score < 70 THEN 20
          WHEN ctx.reliability_score < 80 THEN 15
          WHEN ctx.reliability_score < 90 THEN 8
          ELSE 0
        END
      + CASE
          WHEN ctx.priority = 'STRATEGIC' THEN 20
          WHEN ctx.priority = 'HIGH' THEN 15
          WHEN ctx.revenue_at_risk >= 250000 THEN 10
          ELSE 0
        END
      + LEAST(20, COALESCE(route.max_external_severity, 0) * 4 + CAST(COALESCE(route.external_delay_hours, 0) / 12 AS INT))
    )
  ) AS risk_score,
  ctx.days_of_supply,
  ctx.delay_hours AS max_delay_hours,
  CURRENT_TIMESTAMP AS event_time
FROM enriched_supply_risk_context ctx
LEFT JOIN route_risk_latest route ON ctx.route_id = route.route_id;
