# backend/app/services/risk_detector.py
# Risk detection logic (spec/03_EVENT_CONTRACTS.yaml risk_rule_v1)
# Stateless pure function – emits supply.risk.detected payload

from __future__ import annotations
from datetime import datetime, timezone
import uuid

from app.domain.models import RiskEvent, Shipment, MaterialRequirement, InventoryPosition
from app.domain.scoring import compute_risk_severity


def detect_late_delivery_risk(
    shipment: Shipment,
    requirement: MaterialRequirement,
    destination_inventory: InventoryPosition | None,
    correlation_id: str,
) -> RiskEvent | None:
    """
    Rule: supply.risk.detected when:
      - shipment.currentEta > requirement.requiredBy
      - destination.available < requirement.quantityRequired
      - requirement.mandatory == True
    """
    if not requirement.mandatory:
        return None

    current_eta = shipment.current_eta
    required_by = requirement.required_by

    # Ensure both are timezone-aware for comparison
    if current_eta.tzinfo is None:
        current_eta = current_eta.replace(tzinfo=timezone.utc)
    if required_by.tzinfo is None:
        required_by = required_by.replace(tzinfo=timezone.utc)

    late = current_eta > required_by
    available = destination_inventory.available if destination_inventory else 0.0
    shortage = max(requirement.quantity_required - available, 0.0)
    insufficient = available < requirement.quantity_required

    if not (late and insufficient):
        return None

    hours_until_required = (required_by - datetime.now(timezone.utc)).total_seconds() / 3600
    severity = compute_risk_severity(
        mandatory=requirement.mandatory,
        shortage_qty=shortage,
        hours_until_required=hours_until_required,
    )

    return RiskEvent(
        risk_id=f"RSK-{uuid.uuid4().hex[:8].upper()}",
        correlation_id=correlation_id,
        event_time=datetime.now(timezone.utc),
        material_id=shipment.material_id,
        shipment_id=shipment.shipment_id,
        requirement_id=requirement.requirement_id,
        work_package_id=requirement.work_package_id,
        risk_type="LATE_DELIVERY",
        severity=severity,
        status="OPEN",
        facts={
            "current_eta": current_eta.isoformat(),
            "required_by": required_by.isoformat(),
            "available_at_destination": available,
            "shortage_quantity": shortage,
            "delay_reason_code": shipment.delay_reason_code,
        },
    )
