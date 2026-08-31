# Data Model: Structured + Unstructured Integration

This document describes the complete data model for the demo, showing how structured data (Iceberg) connects with unstructured data (Astra DB).

## 📊 Structured Data Model (Iceberg)

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONAL DATA                                │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  warehouses  │
    │──────────────│
    │ warehouse_id │◄─────┐
    │ name         │      │
    │ region       │      │
    └──────────────┘      │
                          │
                          │ FK
    ┌──────────────┐      │         ┌──────────────┐
    │  customers   │      │         │   orders     │
    │──────────────│      │         │──────────────│
    │ customer_id  │◄─────┼─────────│ order_id     │
    │ customer_name│      │         │ customer_id  │──┐ FK
    │ email        │      │         │ order_ts     │  │
    │ created_ts   │      │         │ promised_ts  │  │
    └──────────────┘      │         │ status       │  │
           │              └─────────│ warehouse_id │  │
           │ FK                     │ total_amount │  │
           │                        └──────────────┘  │
           │                               │          │
           │                               │ FK       │
           │                               ▼          │
           │                        ┌──────────────┐  │
           │                        │ order_items  │  │
           │                        │──────────────│  │
           │                        │ order_id     │◄─┘
           │                        │ sku          │
           │                        │ qty          │
           │                        │ unit_price   │
           │                        └──────────────┘
           │
           │
┌──────────┴───────────────────────────────────────────────────────────────┐
│                         ANALYTICS DATA                                   │
└──────────────────────────────────────────────────────────────────────────┘
           │
           │ FK                     FK
           ├──────────────┬──────────────┐
           │              │              │
           ▼              ▼              ▼
    ┌──────────────┐  ┌──────────────┐
    │customer_tier │  │customer_region│
    │    _ltv      │  │   _segment    │
    │──────────────│  │──────────────│
    │ customer_id  │  │ customer_id  │
    │ tier         │  │ region       │
    │ lifetime_val │  │ segment      │
    │ sla_class    │  └──────────────┘
    └──────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         LAKEHOUSE DATA                                  │
│  (Connected to Operational & Analytics via business keys)               │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐         ┌──────────────┐
    │ shipment_    │         │ inventory_   │
    │   events     │         │   daily      │
    │──────────────│         │──────────────│
    │ order_id     │◄────┐   │ warehouse_id │◄───┐
    │ warehouse_id │◄───┐│   │ sku          │    │
    │ carrier      │    ││   │ snapshot_date│    │
    │ tracking_id  │    ││   │ on_hand_qty  │    │
    │ event_type   │    ││   │ reserved_qty │    │
    │ event_ts     │    ││   │ inbound_qty  │    │
    │ location     │    ││   └──────────────┘    │
    └──────────────┘    ││          │            │
            │           ││          │ Joins via  │
            │           ││          │ warehouse_ │
            │           ││          │ id & sku   │
            │           ││          │            │
            │ Joins via ││          └────────────┼─────────┐
            │ order_id  ││                       │         │
            │           ││                       │         │
            └───────────┼┼───────────────────────┘         │
                        ││                                 │
                        ││   ┌──────────────┐              │
                        ││   │compensation_ │              │
                        ││   │   policy     │              │
                        ││   │──────────────│              │
                        │└───│ customer_tier│◄─────────────┤
                        │    │ delay_hrs_min│              │
                        │    │ delay_hrs_max│              │
                        │    │ credit_pct   │              │
                        │    │ action_text  │              │
                        │    └──────────────┘              │
                        │           │                      │
                        │           │ Joins via            │
                        │           │ customer_tier        │
                        │           │                      │
                        └───────────┴──────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        │                       │
                Links to OPERATIONAL      Links to ANALYTICS
                (orders.order_id)         (customer_tier_ltv.tier)
                (warehouses.warehouse_id)
```

---

## 🔗 Relationships

### Primary Keys
- `warehouses.warehouse_id`
- `customers.customer_id`
- `orders.order_id`
- `order_items.(order_id, sku)` - Composite key
- `customer_tier_ltv.customer_id`
- `customer_region_segment.customer_id`
- `shipment_events.(order_id, event_ts)` - Composite key
- `inventory_daily.(warehouse_id, sku, snapshot_date)` - Composite key
- `compensation_policy.(customer_tier, delay_hours_min)` - Composite key

### Foreign Keys
- `orders.customer_id` → `customers.customer_id`
- `orders.warehouse_id` → `warehouses.warehouse_id`
- `order_items.order_id` → `orders.order_id`
- `customer_tier_ltv.customer_id` → `customers.customer_id`
- `customer_region_segment.customer_id` → `customers.customer_id`
- `shipment_events.order_id` → `orders.order_id`
- `compensation_policy.customer_tier` → `customer_tier_ltv.tier`

---

## 🌐 Structured + Unstructured Integration

### Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER QUERY (via Bob)                            │
│  "Why is order O-10452 delayed and what should we do about it?"        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MCP SERVER (server.py)                          │
│                    Query Orchestration & Federation                     │
└─────────────────────────────────────────────────────────────────────────┘
                    │                               │
                    │                               │
        ┌───────────▼──────────┐       ┌───────────▼──────────┐
        │  STRUCTURED DATA     │       │  UNSTRUCTURED DATA   │
        │  (Iceberg Tables)    │       │  (Astra DB Vectors)  │
        └──────────────────────┘       └──────────────────────┘
                    │                               │
                    │                               │
        ┌───────────▼──────────┐       ┌───────────▼──────────┐
        │   Presto Query       │       │   Vector Search      │
        │   Engine             │       │   (Semantic)         │
        └──────────────────────┘       └──────────────────────┘
                    │                               │
                    │                               │
        ┌───────────▼──────────────────────────────▼──────────┐
        │              FEDERATED RESULT                        │
        │  Structured Facts + Unstructured Guidance            │
        └──────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RESPONSE TO USER                                │
│  "Order O-10452 delayed due to SKU-881 stockout (0 on-hand).          │
│   Customer C-9001 is PLATINUM (€250K LTV).                             │
│   Per runbook rb-1: Reroute from WH-FRA (188 units), apply 10% credit.│
│   Proactive notification required within 24h."                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Query Flow Example: Order O-10452 Analysis

### Step 1: Structured Data Queries (Iceberg)

```sql
-- Query 1: Get order details
SELECT * FROM icebergdefault.demo_data.orders 
WHERE order_id = 'O-10452';

-- Query 2: Get order items
SELECT * FROM icebergdefault.demo_data.order_items 
WHERE order_id = 'O-10452';

-- Query 3: Get customer profile
SELECT t.*, r.region, r.segment
FROM icebergdefault.demo_data.customer_tier_ltv t
JOIN icebergdefault.demo_data.customer_region_segment r 
  ON t.customer_id = r.customer_id
WHERE t.customer_id = 'C-9001';

-- Query 4: Get shipment timeline
SELECT * FROM icebergdefault.demo_data.shipment_events 
WHERE order_id = 'O-10452' 
ORDER BY event_ts;

-- Query 5: Get inventory status
SELECT * FROM icebergdefault.demo_data.inventory_daily 
WHERE warehouse_id = 'WH-BER' 
  AND sku IN ('SKU-100', 'SKU-881');

-- Query 6: Get compensation policy
SELECT * FROM icebergdefault.demo_data.compensation_policy 
WHERE customer_tier = 'PLATINUM' 
ORDER BY delay_hours_min;
```

**Results:**
- Order: DELAYED at WH-BER, €1,250
- Items: SKU-100 (1 unit), SKU-881 (2 units)
- Customer: PLATINUM, €250K LTV, BERLIN, ENTERPRISE
- Shipment: 5 events, last = DELAY_REASON
- Inventory: SKU-100 OK (79 on-hand), SKU-881 PROBLEM (0 on-hand)
- Policy: 24-72h delay = 10% credit

---

### Step 2: Unstructured Data Query (Astra DB)

```python
# Vector search in Astra DB
query = "PLATINUM customer delay handling stockout reroute"
results = vector_search(query, top_k=3)
```

**Results:**
```
[rb-1] PLATINUM Customer Delay Protocol
- Immediate notification required (within 24h)
- Proactive outreach by account manager
- Expedite resolution with alternate warehouse
- Apply compensation per policy
- Follow-up satisfaction check within 48h

[rb-2] Inventory Reroute Procedures
- Check alternate warehouses for stock availability
- Coordinate with warehouse managers
- Update order routing in system
- Notify carrier of new pickup location
- Update customer with new delivery timeline

[rb-3] SKU-881 Historical Context
- Past incidents: 3 similar stockouts at WH-BER
- Root cause: Demand forecasting gap
- Resolution: Increased safety stock to 50 units
- Prevention: Weekly inventory reviews
```

---

### Step 3: Federated Response

**Combining Structured + Unstructured:**

```
ROOT CAUSE (from structured data):
- Order O-10452 is DELAYED at WH-BER
- SKU-881 has 0 on-hand inventory (stockout)
- Customer C-9001 is PLATINUM tier (€250K LTV)

RECOMMENDED ACTIONS (from unstructured data + policy):
1. Immediate Actions (from rb-1):
   - Reroute SKU-881 from WH-FRA (188 units available)
   - Apply 10% compensation (€125 credit)
   - Proactive notification within 24h

2. Operational Steps (from rb-2):
   - Contact WH-FRA warehouse manager
   - Update order routing in system
   - Notify DHL carrier of new pickup
   - Update customer with new timeline

3. Prevention (from rb-3):
   - Review WH-BER inventory forecasting
   - Increase SKU-881 safety stock
   - Implement weekly inventory reviews

BUSINESS IMPACT:
- Immediate revenue: €1,250 (current order)
- Customer LTV at risk: €250,000
- Churn probability: HIGH (PLATINUM + delay >48h)
```

---

## 📋 Data Connections Map

### How Structured and Unstructured Data Connect

| Structured Data Point | Unstructured Data Source | Connection Type |
|----------------------|-------------------------|-----------------|
| `customer_tier_ltv.tier = 'PLATINUM'` | Runbook: "PLATINUM Customer Delay Protocol" | **Tier-based lookup** |
| `orders.status = 'DELAYED'` | Runbook: "Delay Handling Procedures" | **Status-based lookup** |
| `inventory_daily.on_hand_qty = 0` | Runbook: "Stockout Resolution" | **Condition-based lookup** |
| `order_items.sku = 'SKU-881'` | Incident Notes: "SKU-881 Historical Context" | **SKU-based lookup** |
| `compensation_policy.delay_hours` | Runbook: "Compensation Guidelines" | **Policy-based lookup** |
| `warehouses.warehouse_id = 'WH-BER'` | Runbook: "Warehouse Reroute Procedures" | **Location-based lookup** |
| `shipment_events.event_type = 'DELAY_REASON'` | Runbook: "Delay Investigation Checklist" | **Event-based lookup** |

---

## 🎯 Query Patterns

### Pattern 1: Root Cause Analysis
**Structured:** Orders + Items + Inventory + Events  
**Unstructured:** Delay investigation runbooks  
**Result:** Evidence-based root cause with numbers

### Pattern 2: Customer Risk Assessment
**Structured:** Customer tier + LTV + Order history  
**Unstructured:** Churn prevention playbooks + Past incidents  
**Result:** Risk score with retention strategies

### Pattern 3: Operational Guidance
**Structured:** Inventory + Warehouses + Policy  
**Unstructured:** Reroute procedures + Communication templates  
**Result:** Step-by-step action plan

### Pattern 4: Preventive Measures
**Structured:** Historical patterns + Metrics  
**Unstructured:** Best practices + Lessons learned  
**Result:** Long-term improvement recommendations

---

## 🔄 Data Flow Summary

```
┌─────────────┐
│ User Query  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ MCP Server Analyzes Query Intent        │
│ - Identifies entities (order, customer) │
│ - Determines data needs                 │
└──────┬──────────────────────┬───────────┘
       │                      │
       ▼                      ▼
┌─────────────┐      ┌─────────────────┐
│ Structured  │      │  Unstructured   │
│ Data Query  │      │  Vector Search  │
│ (SQL)       │      │  (Semantic)     │
└──────┬──────┘      └────────┬────────┘
       │                      │
       │  ┌───────────────────┘
       │  │
       ▼  ▼
┌─────────────────────────────┐
│ Federate Results            │
│ - Merge facts + guidance    │
│ - Apply business logic      │
│ - Format response           │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────┐
│ User Answer │
└─────────────┘
```

---

## 💡 Key Insights

1. **Structured data provides FACTS** (what happened, when, where, how much)
2. **Unstructured data provides GUIDANCE** (what to do, how to do it, why)
3. **Federation provides INTELLIGENCE** (facts + guidance = actionable insights)
4. **Vector search enables SEMANTIC matching** (find relevant guidance without exact keywords)
5. **Combined approach delivers COMPLETE SOLUTIONS** (not just data, but decisions)

This is the power of **Structured + Unstructured Data Integration**! 🚀