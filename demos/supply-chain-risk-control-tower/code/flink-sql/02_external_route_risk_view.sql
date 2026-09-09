-- Reference Flink SQL: aggregate external risk by route.

CREATE VIEW route_risk_latest AS
SELECT
  route_id,
  MAX(severity) AS max_external_severity,
  MAX(expected_delay_hours) AS external_delay_hours,
  MAX(event_time) AS latest_event_time
FROM external_risk_events
GROUP BY route_id;
