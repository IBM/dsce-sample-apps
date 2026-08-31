-- ============================================================================
-- Complete Iceberg Data Load Script
-- Loads ALL data (operational, analytics, lakehouse) into Iceberg tables
-- Execute this in watsonx.data Query workspace
-- ============================================================================

-- ============================================================================
-- Create Schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS icebergdefault.demo_data;

-- ============================================================================
-- OPERATIONAL TABLES (replaces DB2/PostgreSQL)
-- ============================================================================

-- Warehouses
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.warehouses (
  warehouse_id VARCHAR,
  name VARCHAR,
  region VARCHAR
);

-- Customers
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.customers (
  customer_id VARCHAR,
  customer_name VARCHAR,
  email VARCHAR,
  created_ts TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.orders (
  order_id VARCHAR,
  customer_id VARCHAR,
  order_ts TIMESTAMP,
  promised_delivery_ts TIMESTAMP,
  status VARCHAR,
  warehouse_id VARCHAR,
  total_amount DECIMAL(12,2)
);

-- Order Items
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.order_items (
  order_id VARCHAR,
  sku VARCHAR,
  qty INTEGER,
  unit_price DECIMAL(12,2)
);

-- ============================================================================
-- ANALYTICS TABLES (replaces Snowflake)
-- ============================================================================

-- Customer Tier and LTV
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.customer_tier_ltv (
  customer_id VARCHAR,
  tier VARCHAR,
  lifetime_value DECIMAL(18,2),
  sla_class VARCHAR
);

-- Customer Region and Segment
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.customer_region_segment (
  customer_id VARCHAR,
  region VARCHAR,
  segment VARCHAR
);

-- ============================================================================
-- LAKEHOUSE TABLES (events, inventory, policy)
-- ============================================================================

-- Shipment Events
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.shipment_events (
  order_id VARCHAR,
  warehouse_id VARCHAR,
  carrier VARCHAR,
  tracking_id VARCHAR,
  event_type VARCHAR,
  event_ts TIMESTAMP,
  location VARCHAR
);

-- Inventory Daily
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.inventory_daily (
  warehouse_id VARCHAR,
  sku VARCHAR,
  snapshot_date DATE,
  on_hand_qty INTEGER,
  reserved_qty INTEGER,
  inbound_qty INTEGER
);

-- Compensation Policy
CREATE TABLE IF NOT EXISTS icebergdefault.demo_data.compensation_policy (
  customer_tier VARCHAR,
  delay_hours_min INTEGER,
  delay_hours_max INTEGER,
  credit_pct INTEGER,
  action_text VARCHAR
);

-- ============================================================================
-- INSERT OPERATIONAL DATA
-- ============================================================================

-- Warehouses (5 German locations)
INSERT INTO icebergdefault.demo_data.warehouses VALUES
  ('WH-BER', 'Berlin DC', 'BERLIN'),
  ('WH-MUC', 'München DC', 'BAYERN'),
  ('WH-HAM', 'Hamburg DC', 'HAMBURG'),
  ('WH-FRA', 'Frankfurt DC', 'HESSEN'),
  ('WH-CGN', 'Köln DC', 'NRW');

-- Customers (11 customers including anchor)
INSERT INTO icebergdefault.demo_data.customers VALUES
  ('C-9001', 'Acme Industries', 'masked@example.com', TIMESTAMP '2024-02-15 12:00:00'),
  ('C-1000', 'Customer 1', 'masked@example.com', TIMESTAMP '2023-03-20 10:30:00'),
  ('C-1001', 'Customer 2', 'masked@example.com', TIMESTAMP '2023-05-15 14:20:00'),
  ('C-1002', 'Customer 3', 'masked@example.com', TIMESTAMP '2023-07-10 09:45:00'),
  ('C-1003', 'Customer 4', 'masked@example.com', TIMESTAMP '2023-09-05 16:10:00'),
  ('C-1004', 'Customer 5', 'masked@example.com', TIMESTAMP '2023-11-01 11:25:00'),
  ('C-1005', 'Customer 6', 'masked@example.com', TIMESTAMP '2024-01-15 13:40:00'),
  ('C-1006', 'Customer 7', 'masked@example.com', TIMESTAMP '2024-03-10 08:55:00'),
  ('C-1007', 'Customer 8', 'masked@example.com', TIMESTAMP '2024-05-05 15:30:00'),
  ('C-1008', 'Customer 9', 'masked@example.com', TIMESTAMP '2024-07-01 12:15:00'),
  ('C-1009', 'Customer 10', 'masked@example.com', TIMESTAMP '2024-09-20 10:00:00');

-- Orders (6 orders including anchor O-10452)
INSERT INTO icebergdefault.demo_data.orders VALUES
  ('O-10452', 'C-9001', TIMESTAMP '2026-02-13 07:00:00', TIMESTAMP '2026-02-15 07:00:00', 'DELAYED', 'WH-BER', 1250.00),
  ('O-10001', 'C-1000', TIMESTAMP '2026-02-01 10:00:00', TIMESTAMP '2026-02-03 10:00:00', 'DELIVERED', 'WH-BER', 1299.99),
  ('O-10002', 'C-1001', TIMESTAMP '2026-02-02 11:30:00', TIMESTAMP '2026-02-04 11:30:00', 'SHIPPED', 'WH-MUC', 899.50),
  ('O-10003', 'C-1002', TIMESTAMP '2026-02-03 14:15:00', TIMESTAMP '2026-02-05 14:15:00', 'DELIVERED', 'WH-HAM', 2150.00),
  ('O-10004', 'C-1003', TIMESTAMP '2026-02-04 09:45:00', TIMESTAMP '2026-02-06 09:45:00', 'SHIPPED', 'WH-FRA', 1750.25),
  ('O-10005', 'C-1004', TIMESTAMP '2026-02-05 16:20:00', TIMESTAMP '2026-02-07 16:20:00', 'PROCESSING', 'WH-CGN', 3200.00);

-- Order Items (8 items including O-10452 items)
INSERT INTO icebergdefault.demo_data.order_items VALUES
  ('O-10452', 'SKU-100', 1, 750.00),
  ('O-10452', 'SKU-881', 2, 250.00),
  ('O-10001', 'SKU-100', 1, 1299.99),
  ('O-10002', 'SKU-101', 1, 899.50),
  ('O-10003', 'SKU-102', 2, 1075.00),
  ('O-10004', 'SKU-103', 1, 1750.25),
  ('O-10005', 'SKU-104', 3, 1066.67),
  ('O-10005', 'SKU-105', 1, 1066.66);

-- ============================================================================
-- INSERT ANALYTICS DATA (replaces Snowflake)
-- ============================================================================

-- Customer Tier and LTV
INSERT INTO icebergdefault.demo_data.customer_tier_ltv VALUES
  ('C-9001', 'PLATINUM', 250000.00, 'PREMIUM'),
  ('C-1000', 'GOLD', 115000.00, 'ENHANCED'),
  ('C-1001', 'STANDARD', 45000.00, 'STANDARD'),
  ('C-1002', 'PLATINUM', 180000.00, 'PREMIUM'),
  ('C-1003', 'GOLD', 95000.00, 'ENHANCED'),
  ('C-1004', 'STANDARD', 38000.00, 'STANDARD'),
  ('C-1005', 'GOLD', 125000.00, 'ENHANCED'),
  ('C-1006', 'STANDARD', 52000.00, 'STANDARD'),
  ('C-1007', 'PLATINUM', 220000.00, 'PREMIUM'),
  ('C-1008', 'GOLD', 88000.00, 'ENHANCED'),
  ('C-1009', 'STANDARD', 41000.00, 'STANDARD');

-- Customer Region and Segment
INSERT INTO icebergdefault.demo_data.customer_region_segment VALUES
  ('C-9001', 'BERLIN', 'ENTERPRISE'),
  ('C-1000', 'HESSEN', 'ENTERPRISE'),
  ('C-1001', 'BAYERN', 'SMB'),
  ('C-1002', 'HAMBURG', 'ENTERPRISE'),
  ('C-1003', 'NRW', 'SMB'),
  ('C-1004', 'BERLIN', 'SMB'),
  ('C-1005', 'HESSEN', 'ENTERPRISE'),
  ('C-1006', 'BAYERN', 'SMB'),
  ('C-1007', 'HAMBURG', 'ENTERPRISE'),
  ('C-1008', 'NRW', 'SMB'),
  ('C-1009', 'BERLIN', 'SMB');

-- ============================================================================
-- INSERT LAKEHOUSE DATA (events, inventory, policy)
-- ============================================================================

-- Shipment Events for O-10452
INSERT INTO icebergdefault.demo_data.shipment_events VALUES
  ('O-10452', 'WH-BER', 'DHL', 'TRK-10452-001', 'ORDER_RECEIVED', TIMESTAMP '2026-02-13 07:00:00', 'WH-BER'),
  ('O-10452', 'WH-BER', 'DHL', 'TRK-10452-001', 'PICK_STARTED', TIMESTAMP '2026-02-13 09:00:00', 'WH-BER'),
  ('O-10452', 'WH-BER', 'DHL', 'TRK-10452-001', 'PACKED', TIMESTAMP '2026-02-13 11:00:00', 'WH-BER'),
  ('O-10452', 'WH-BER', 'DHL', 'TRK-10452-001', 'CARRIER_PICKUP', TIMESTAMP '2026-02-13 13:00:00', 'WH-BER'),
  ('O-10452', 'WH-BER', 'DHL', 'TRK-10452-001', 'DELAY_REASON', TIMESTAMP '2026-02-15 08:00:00', 'WH-BER');

-- Inventory Daily (current snapshot for all warehouses and key SKUs)
INSERT INTO icebergdefault.demo_data.inventory_daily VALUES
  ('WH-BER', 'SKU-100', DATE '2026-02-15', 79, 31, 53),
  ('WH-BER', 'SKU-881', DATE '2026-02-15', 0, 35, 40),
  ('WH-FRA', 'SKU-881', DATE '2026-02-15', 188, 24, 56),
  ('WH-HAM', 'SKU-881', DATE '2026-02-15', 181, 40, 70),
  ('WH-MUC', 'SKU-881', DATE '2026-02-15', 179, 31, 28),
  ('WH-CGN', 'SKU-881', DATE '2026-02-15', 76, 14, 11);

-- Compensation Policy
INSERT INTO icebergdefault.demo_data.compensation_policy VALUES
  ('PLATINUM', 0, 24, 5, 'Proactive notification + 5% credit'),
  ('PLATINUM', 24, 72, 10, 'Expedite if possible + 10% credit'),
  ('PLATINUM', 72, 999, 20, 'Case-by-case + possible full refund'),
  ('GOLD', 0, 24, 3, 'Notification + 3% credit'),
  ('GOLD', 24, 72, 7, 'Expedite + 7% credit'),
  ('STANDARD', 0, 48, 2, 'Notification + 2% credit'),
  ('STANDARD', 48, 96, 5, 'Expedite + 5% credit');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check row counts
SELECT 'warehouses' as table_name, COUNT(*) as row_count FROM icebergdefault.demo_data.warehouses
UNION ALL
SELECT 'customers', COUNT(*) FROM icebergdefault.demo_data.customers
UNION ALL
SELECT 'orders', COUNT(*) FROM icebergdefault.demo_data.orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM icebergdefault.demo_data.order_items
UNION ALL
SELECT 'customer_tier_ltv', COUNT(*) FROM icebergdefault.demo_data.customer_tier_ltv
UNION ALL
SELECT 'customer_region_segment', COUNT(*) FROM icebergdefault.demo_data.customer_region_segment
UNION ALL
SELECT 'shipment_events', COUNT(*) FROM icebergdefault.demo_data.shipment_events
UNION ALL
SELECT 'inventory_daily', COUNT(*) FROM icebergdefault.demo_data.inventory_daily
UNION ALL
SELECT 'compensation_policy', COUNT(*) FROM icebergdefault.demo_data.compensation_policy;

-- Expected: 5, 11, 6, 8, 11, 11, 5, 6, 7

-- Verify anchor order O-10452
SELECT * FROM icebergdefault.demo_data.orders WHERE order_id = 'O-10452';

-- Verify anchor customer analytics
SELECT 
    t.customer_id,
    t.tier,
    t.lifetime_value,
    t.sla_class,
    r.region,
    r.segment
FROM icebergdefault.demo_data.customer_tier_ltv t
JOIN icebergdefault.demo_data.customer_region_segment r ON t.customer_id = r.customer_id
WHERE t.customer_id = 'C-9001';

-- Expected: C-9001, PLATINUM, 250000.00, PREMIUM, BERLIN, ENTERPRISE

-- Verify inventory for problem SKU
SELECT * FROM icebergdefault.demo_data.inventory_daily 
WHERE sku = 'SKU-881' AND warehouse_id = 'WH-BER';

-- Expected: 0 on-hand, 35 reserved, 40 inbound

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- All data is now in Iceberg tables under icebergdefault.demo_data schema
-- You can now run the demo questions using only Iceberg + Astra DB
-- ============================================================================

-- Made with Bob
