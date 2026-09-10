-- Reference Flink SQL: enrich shipment events with purchase order, supplier, inventory, and customer demand context.
-- Adjust catalog/database names as needed in Confluent Cloud for Apache Flink.

CREATE VIEW enriched_supply_risk_context AS
SELECT
  s.component_id,
  s.supplier_id,
  sp.supplier_name,
  sp.reliability_score,
  s.shipment_id,
  s.po_id,
  s.status AS shipment_status,
  s.delay_hours,
  s.route_id,
  i.site_id,
  i.on_hand_qty,
  i.reserved_qty,
  i.daily_usage_qty,
  CASE
    WHEN i.daily_usage_qty <= 0 THEN 999
    ELSE (CAST(i.on_hand_qty - i.reserved_qty AS DOUBLE) / i.daily_usage_qty)
  END AS days_of_supply,
  c.customer_order_id,
  c.customer_name,
  c.priority,
  c.revenue_at_risk,
  cm.criticality,
  cm.safety_stock_qty
FROM shipments s
LEFT JOIN purchase_orders po ON s.po_id = po.po_id
LEFT JOIN supplier_profiles sp ON s.supplier_id = sp.supplier_id
LEFT JOIN inventory_levels i ON s.component_id = i.component_id
LEFT JOIN customer_orders c ON s.component_id = c.component_id
LEFT JOIN component_master cm ON s.component_id = cm.component_id;
