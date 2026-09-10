# Demo Script

## Demo title

**Predict and mitigate supplier delay impact in real time**

## Opening narrative

A U.S. manufacturer is building equipment for a strategic customer. A critical bearing component is coming from a preferred supplier. The shipment is delayed due to port congestion. Inventory can cover only a few days. An alternate supplier has partial availability.

The business wants to know:

- Which component is at risk?
- Which customer order is affected?
- How severe is the risk?
- What should procurement and planning do now?

## Demo flow

### 1. Start the risk engine

```bash
python -m scrc.risk_engine
```

For a local demo without Kafka:

```bash
python -m scrc.risk_engine --dry-run
```

### 2. Produce synthetic events

```bash
python -m scrc.producer --scenario supplier_delay --count 50 --interval 1
```

### 3. Explain the input events

Events are flowing for suppliers, component master data, purchase orders, shipments, inventory, customer orders, and external risk events.

### 4. Show the risk output

The engine calculates a risk score and emits events to:

- `supply_chain_risk_scores`
- `supply_chain_recommendations`
- `control_tower_alerts`

### 5. Show a sample recommendation

```json
{
  "component_id": "BRG-9004",
  "risk_band": "CRITICAL",
  "root_cause": "Shipment delay exceeds available inventory coverage",
  "business_impact": "Strategic customer order CO-10491 may miss committed delivery",
  "recommended_action": "Allocate current stock to strategic order, source 40% from alternate supplier SUP-221, and expedite remaining quantity by air"
}
```

### 6. Show the AI extension

Use `agents/risk_summary_prompt.md` to generate an executive summary from the risk event.

### 7. Close with the value statement

This building block shows how Confluent Cloud can become the real-time nervous system of the supply chain, while IBM AI and automation turn streaming signals into recommended actions.
