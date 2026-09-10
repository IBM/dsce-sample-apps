# backend/app/api/routers/confluent.py
#
# Trace bridge endpoints for the Confluent Intelligence Agent fallback path.
# These endpoints are called by TraceBridgeReader when:
#   - CONFLUENT_READ_MODE=trace  (trace-only mode)
#   - CONFLUENT_READ_MODE=auto AND direct Confluent read is unavailable
#
# The in-memory store holds a synthetic Kafka event log seeded at startup.
# Events are keyed by correlationId and topicName exactly as the
# NormalizedEvent schema expects.
#
# Endpoints:
#   GET /api/confluent/trace?correlation_id=&lookback_minutes=&topics=&max_records_per_topic=
#   GET /api/confluent/records?topic=&correlation_id=&lookback_minutes=&max_records=
#
# SYNTHETIC DEMO — not real Shell or Pearl GTL operational data.

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/confluent", tags=["confluent"])

# ---------------------------------------------------------------------------
# Synthetic Kafka event store (module-level, seeded at import time)
# ---------------------------------------------------------------------------
# Each event matches the NormalizedEvent dict schema expected by
# TraceBridgeReader._normalize_bridge_event().

_CORRELATION_ID = "DEMO-TW2047-001"

def _ts(offset_seconds: int = 0) -> str:
    """ISO-8601 timestamp anchored from a fixed demo baseline."""
    base = datetime(2026, 9, 25, 8, 0, 0, tzinfo=timezone.utc)
    return (base + timedelta(seconds=offset_seconds)).isoformat()


# 9 synthetic events in causal order, one per TSCI topic.
_TRACE_EVENTS: list[dict] = [
    # ── 1. turnaround.material.required ─────────────────────────────────────
    {
        "topic": "turnaround.material.required",
        "partition": 0,
        "offset": 142,
        "timestamp": _ts(0),
        "key": "TW-2047:CVA-8842",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-MR-A1B2C3D4",
        "eventType": "MATERIAL_REQUIREMENT_RAISED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-MR-A1B2C3D4",
            "eventType": "MATERIAL_REQUIREMENT_RAISED",
            "workPackageId": "TW-2047",
            "turnaroundId": "TA-DEMO-2026",
            "materialId": "CVA-8842",
            "quantityRequired": 1,
            "requiredBy": "2026-10-10T00:00:00+00:00",
            "locationId": "PEARL-DEMO",
            "assetId": "DEMO-UNIT-14",
            "criticality": "CRITICAL",
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 2. supply.inventory.changed ─────────────────────────────────────────
    {
        "topic": "supply.inventory.changed",
        "partition": 0,
        "offset": 891,
        "timestamp": _ts(300),
        "key": "PEARL-DEMO:CVA-8842",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-INV-E5F6G7H8",
        "eventType": "INVENTORY_POSITION_UPDATED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-INV-E5F6G7H8",
            "eventType": "INVENTORY_POSITION_UPDATED",
            "locationId": "PEARL-DEMO",
            "materialId": "CVA-8842",
            "previousOnHand": 1,
            "currentOnHand": 0,
            "available": 0,
            "reserved": 0,
            "changeReason": "CONSUMPTION",
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 3. supply.supplier.status.changed (SUP-101 QUALITY_HOLD) ───────────
    {
        "topic": "supply.supplier.status.changed",
        "partition": 0,
        "offset": 214,
        "timestamp": _ts(600),
        "key": "SUP-101:CVA-8842",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-SC-0001",
        "eventType": "SUPPLIER_CONSTRAINT_ACTIVATED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-SC-0001",
            "eventType": "SUPPLIER_CONSTRAINT_ACTIVATED",
            "supplierId": "SUP-101",
            "supplierName": "Demo Primary Supplier Ltd",
            "materialId": "CVA-8842",
            "constraintType": "QUALITY_HOLD",
            "constraintSeverity": "CRITICAL",
            "affectedFromDate": "2026-09-18T08:00:00+00:00",
            "estimatedResolutionDate": "2026-10-25T00:00:00+00:00",
            "reason": "Non-conformance detected in batch inspection",
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 4. supply.supplier.status.changed (SUP-203 PORT_CONGESTION) ─────────
    {
        "topic": "supply.supplier.status.changed",
        "partition": 1,
        "offset": 215,
        "timestamp": _ts(660),
        "key": "SUP-203:CVA-8842",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-SC-0002",
        "eventType": "SUPPLIER_CONSTRAINT_ACTIVATED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-SC-0002",
            "eventType": "SUPPLIER_CONSTRAINT_ACTIVATED",
            "supplierId": "SUP-203",
            "supplierName": "Demo Secondary Supplier GmbH",
            "materialId": "CVA-8842",
            "constraintType": "PORT_CONGESTION",
            "constraintSeverity": "HIGH",
            "affectedFromDate": "2026-09-20T14:30:00+00:00",
            "estimatedResolutionDate": "2026-10-18T00:00:00+00:00",
            "portCode": "SGSIN",
            "reason": "Singapore port congestion — vessel queue extended 18 days",
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 5. supply.port.status.changed ───────────────────────────────────────
    {
        "topic": "supply.port.status.changed",
        "partition": 0,
        "offset": 77,
        "timestamp": _ts(720),
        "key": "SGSIN",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-PT-0001",
        "eventType": "PORT_DISRUPTION_ACTIVATED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-PT-0001",
            "eventType": "PORT_DISRUPTION_ACTIVATED",
            "portCode": "SGSIN",
            "portName": "Port of Singapore",
            "disruptionType": "CONGESTION",
            "severity": "HIGH",
            "affectedFromDate": "2026-09-20T00:00:00+00:00",
            "estimatedClearDate": "2026-10-18T00:00:00+00:00",
            "impactedShipmentCount": 3,
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 6. supply.approved_vendor.changed ───────────────────────────────────
    {
        "topic": "supply.approved_vendor.changed",
        "partition": 0,
        "offset": 33,
        "timestamp": _ts(900),
        "key": "SUP-205:CVA-8842",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-AVL-9I0J1K2L",
        "eventType": "AVL_ENTRY_APPROVED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-AVL-9I0J1K2L",
            "eventType": "AVL_ENTRY_APPROVED",
            "supplierId": "SUP-205",
            "supplierName": "Demo Tertiary Supplier Corp",
            "materialId": "CVA-8842",
            "avlStatus": "APPROVED",
            "tier": "TERTIARY",
            "effectiveDate": "2026-03-10",
            "reason": "Tertiary source qualification — fast-track emergency approval",
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 7. supply.shipment.updated ───────────────────────────────────────────
    {
        "topic": "supply.shipment.updated",
        "partition": 0,
        "offset": 556,
        "timestamp": _ts(1200),
        "key": "SHP-90017",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-SHP-3M4N5O6P",
        "eventType": "SHIPMENT_ETA_UPDATED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-SHP-3M4N5O6P",
            "eventType": "SHIPMENT_ETA_UPDATED",
            "shipmentId": "SHP-90017",
            "poId": "PO-DEMO-45008723",
            "materialId": "CVA-8842",
            "quantity": 1,
            "status": "DELAYED",
            "originalEta": "2026-10-07T10:00:00+00:00",
            "previousEta": "2026-10-07T10:00:00+00:00",
            "currentEta": "2026-10-14T10:00:00+00:00",
            "delayDays": 7,
            "delayReasonCode": "TRANSPORT_DISRUPTION",
            "logisticsProvider": "DEMO-LOGISTICS",
            "portOfDeparture": "SGSIN",
            "portOfEntry": "IQUAE",
            "destinationLocationId": "PEARL-DEMO",
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 8. supply.risk.detected (Flink-derived) ──────────────────────────────
    {
        "topic": "supply.risk.detected",
        "partition": 0,
        "offset": 19,
        "timestamp": _ts(1800),
        "key": "RISK-001",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-RISK-7Q8R9S0T",
        "eventType": "SUPPLY_RISK_DETECTED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-RISK-7Q8R9S0T",
            "eventType": "SUPPLY_RISK_DETECTED",
            "riskId": "RISK-001",
            "riskType": "LATE_DELIVERY",
            "severity": "CRITICAL",
            "materialId": "CVA-8842",
            "workPackageId": "TW-2047",
            "shipmentId": "SHP-90017",
            "requiredBy": "2026-10-10T00:00:00+00:00",
            "currentEta": "2026-10-14T10:00:00+00:00",
            "shortageQuantity": 1,
            "sourceSystem": "FLINK_PIPELINE",
            "flinkJobId": "supply-risk-detector-v2",
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
    # ── 9. supply.material.readiness.assessed ───────────────────────────────
    {
        "topic": "supply.material.readiness.assessed",
        "partition": 0,
        "offset": 88,
        "timestamp": _ts(2100),
        "key": "TW-2047:CVA-8842",
        "correlationId": _CORRELATION_ID,
        "eventId": "EVT-MRA-U1V2W3X4",
        "eventType": "MATERIAL_READINESS_ASSESSED",
        "value": {
            "correlationId": _CORRELATION_ID,
            "eventId": "EVT-MRA-U1V2W3X4",
            "eventType": "MATERIAL_READINESS_ASSESSED",
            "workPackageId": "TW-2047",
            "materialId": "CVA-8842",
            "readinessStatus": "AT_RISK",
            "resilienceScore": 78,
            "unconstrainedApprovedSupplierCount": 1,
            "feasibleTransferLocationCount": 1,
            "primarySupplierStatus": "QUALITY_HOLD_CRITICAL",
            "secondarySupplierStatus": "PORT_CONGESTION_HIGH",
            "assessedAt": _ts(2100),
            "demoWarning": "SYNTHETIC_DATA_ONLY",
        },
    },
]

# Index by topic for fast lookup
_EVENTS_BY_TOPIC: dict[str, list[dict]] = {}
for _ev in _TRACE_EVENTS:
    _EVENTS_BY_TOPIC.setdefault(_ev["topic"], []).append(_ev)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _filter_events(
    events: list[dict],
    correlation_id: Optional[str],
    lookback_minutes: int,
) -> list[dict]:
    result = events
    if correlation_id:
        result = [e for e in result if e.get("correlationId") == correlation_id]
    # lookback_minutes filter: include all seeded events (fixed timestamps are
    # always "old enough" so the bridge always returns them in demo mode)
    return result


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/trace")
async def get_confluent_trace(
    correlation_id: str = Query(..., description="Correlation ID to trace"),
    lookback_minutes: int = Query(60, ge=1, le=120),
    topics: Optional[str] = Query(None, description="Comma-separated topic filter"),
    max_records_per_topic: int = Query(50, ge=1, le=100),
) -> dict:
    """
    Trace bridge endpoint — returns synthetic Kafka events for a correlationId
    across all (or filtered) TSCI topics.

    Called by TraceBridgeReader.trace_by_correlation() when direct Confluent
    read is unavailable or CONFLUENT_READ_MODE=trace.
    """
    topic_filter: Optional[set[str]] = (
        {t.strip() for t in topics.split(",") if t.strip()} if topics else None
    )

    matched: list[dict] = []
    for topic, topic_events in _EVENTS_BY_TOPIC.items():
        if topic_filter and topic not in topic_filter:
            continue
        filtered = _filter_events(topic_events, correlation_id, lookback_minutes)
        matched.extend(filtered[:max_records_per_topic])

    # Sort: timestamp asc, offset asc within same topic/partition
    matched.sort(key=lambda e: (e.get("timestamp", ""), e.get("topic", ""), e.get("offset", 0)))

    return {
        "correlation_id": correlation_id,
        "source": "TRACE_BRIDGE",
        "events": matched,
        "event_count": len(matched),
        "demo_warning": "SYNTHETIC_DATA_ONLY — not real Shell operational data",
    }


@router.get("/records")
async def get_confluent_records(
    topic: str = Query(..., description="Kafka topic name"),
    correlation_id: Optional[str] = Query(None),
    lookback_minutes: int = Query(30, ge=1, le=120),
    max_records: int = Query(50, ge=1, le=100),
) -> dict:
    """
    Trace bridge single-topic endpoint — returns synthetic records for one topic.

    Called by TraceBridgeReader.recent_records() when direct Confluent read is
    unavailable or CONFLUENT_READ_MODE=trace.
    """
    topic_events = _EVENTS_BY_TOPIC.get(topic, [])
    filtered = _filter_events(topic_events, correlation_id, lookback_minutes)
    filtered.sort(key=lambda e: (e.get("timestamp", ""), e.get("offset", 0)))
    records = filtered[:max_records]

    return {
        "topic": topic,
        "correlation_id": correlation_id,
        "source": "TRACE_BRIDGE",
        "records": records,
        "count": len(records),
        "demo_warning": "SYNTHETIC_DATA_ONLY — not real Shell operational data",
    }
