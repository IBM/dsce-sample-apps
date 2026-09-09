-- Reference Flink SQL: convert score into risk band and recommendation.

CREATE VIEW calculated_supply_chain_recommendations AS
SELECT
  CONCAT('REC-', risk_id) AS recommendation_id,
  risk_id,
  component_id,
  customer_order_id,
  CASE
    WHEN risk_score >= 85 THEN 'CRITICAL'
    WHEN risk_score >= 70 THEN 'HIGH'
    WHEN risk_score >= 40 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS risk_band,
  CASE
    WHEN customer_order_id IS NOT NULL THEN CONCAT('Customer order ', customer_order_id, ' may be impacted by supply risk.')
    ELSE 'No high-priority customer order is currently linked.'
  END AS business_impact,
  CASE
    WHEN risk_score >= 85 THEN 'Escalate to procurement and planning, allocate current stock to strategic demand, source alternate supplier capacity, and expedite shipment.'
    WHEN risk_score >= 70 THEN 'Recommend mitigation: confirm supplier recovery ETA, evaluate alternate source, and notify planner.'
    WHEN risk_score >= 40 THEN 'Notify planner and monitor ETA changes.'
    ELSE 'Continue monitoring.'
  END AS recommended_action,
  CASE
    WHEN risk_score >= 70 THEN 0.86
    ELSE 0.72
  END AS confidence,
  event_time
FROM calculated_supply_chain_risk_scores;
