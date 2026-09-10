from scrc.risk_logic import calculate_days_of_supply, risk_band, score_component_risk


def test_risk_band_thresholds():
    assert risk_band(0) == "LOW"
    assert risk_band(40) == "MEDIUM"
    assert risk_band(70) == "HIGH"
    assert risk_band(85) == "CRITICAL"


def test_days_of_supply():
    inventory = {"on_hand_qty": 500, "reserved_qty": 200, "daily_usage_qty": 100}
    assert calculate_days_of_supply(inventory) == 3.0


def test_critical_supplier_delay_scores_high():
    suppliers = {
        "SUP-1007": {"supplier_id": "SUP-1007", "reliability_score": 74, "alternate_for_components": []},
        "SUP-221": {"supplier_id": "SUP-221", "reliability_score": 91, "alternate_for_components": ["BRG-9004"]},
    }
    component_master = {
        "BRG-9004": {"component_id": "BRG-9004", "criticality": "CRITICAL"}
    }
    inventory_levels = {
        "BRG-9004": {"on_hand_qty": 310, "reserved_qty": 180, "daily_usage_qty": 150}
    }
    purchase_orders = {
        "PO-77881": {"po_id": "PO-77881", "component_id": "BRG-9004", "supplier_id": "SUP-1007"}
    }
    shipments = {
        "SHP-33019": {
            "shipment_id": "SHP-33019", "component_id": "BRG-9004", "supplier_id": "SUP-1007",
            "delay_hours": 96, "route_id": "ROUTE-APAC-LAX-CHI", "status": "DELAYED"
        }
    }
    customer_orders_by_component = {
        "BRG-9004": [{"customer_order_id": "CO-10491", "priority": "STRATEGIC", "revenue_at_risk": 750000, "customer_name": "NorthStar"}]
    }
    external_risk_events = [
        {"route_id": "ROUTE-APAC-LAX-CHI", "severity": 5, "expected_delay_hours": 60}
    ]

    risk, recommendation, alert = score_component_risk(
        "BRG-9004",
        suppliers,
        component_master,
        inventory_levels,
        purchase_orders,
        shipments,
        customer_orders_by_component,
        external_risk_events,
    )

    assert risk.risk_score >= 70
    assert risk.risk_band in {"HIGH", "CRITICAL"}
    assert recommendation.recommended_action
    assert alert.severity in {"HIGH", "CRITICAL"}
