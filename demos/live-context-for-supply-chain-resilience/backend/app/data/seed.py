# backend/app/data/seed.py
# Synthetic demonstration seed data – spec/12_DEMO_DATA_AND_SCENARIO.md
# IMPORTANT: All identifiers, transactions, and values are synthetic and
# must NOT be represented as real Shell or Pearl GTL operational data.

from __future__ import annotations
from datetime import date, datetime, timezone

from app.domain.models import (
    ApprovedVendorEntry,
    InventoryPosition,
    Material,
    MaterialRequirement,
    PortStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    Shipment,
    Supplier,
    SupplierConstraint,
    WorkPackage,
)

DEMO_WARNING = "SYNTHETIC_DATA_ONLY – NOT real Shell operational data"
DEMO_FACILITY = "Pearl GTL Turnaround Demo (Qatar)"


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
MATERIALS: list[Material] = [
    Material(
        material_id="CVA-8842",
        description="Control-valve actuator assembly",
        material_class="ROTARY_ACTUATOR",
        manufacturer="DEMO-MFGR-A",
        manufacturer_part_number="DEMO-PN-CVA8842-01",
        criticality="CRITICAL",
        unit_of_measure="EA",
    ),
    Material(
        material_id="CVA-8843",
        description="Control-valve actuator assembly – alternate model",
        material_class="ROTARY_ACTUATOR",
        manufacturer="DEMO-MFGR-B",
        manufacturer_part_number="DEMO-PN-CVA8843-ALT",
        criticality="HIGH",
        unit_of_measure="EA",
    ),
]

# ---------------------------------------------------------------------------
# Purchase orders
# ---------------------------------------------------------------------------
PURCHASE_ORDERS: list[PurchaseOrder] = [
    PurchaseOrder(
        po_id="PO-DEMO-45008723",
        supplier_id="SUP-101",
        order_date=date(2026, 8, 15),
        status="CONFIRMED",
        currency="USD",
    ),
]

PURCHASE_ORDER_LINES: list[PurchaseOrderLine] = [
    PurchaseOrderLine(
        po_id="PO-DEMO-45008723",
        line_id="10",
        material_id="CVA-8842",
        quantity=1,
        required_delivery_date=date(2026, 10, 9),
        agreed_delivery_date=date(2026, 10, 7),
    ),
]

# ---------------------------------------------------------------------------
# Shipments
# ---------------------------------------------------------------------------
SHIPMENTS: list[Shipment] = [
    Shipment(
        shipment_id="SHP-90017",
        po_id="PO-DEMO-45008723",
        po_line_id="10",
        material_id="CVA-8842",
        quantity=1,
        status="DELAYED",
        original_eta=_dt("2026-10-07T10:00:00"),
        current_eta=_dt("2026-10-14T10:00:00"),
        logistics_provider="DEMO-LOGISTICS",
        destination_location_id="PEARL-DEMO",
        delay_reason_code="TRANSPORT_DISRUPTION",
        port_of_departure="SGSIN",
        port_of_entry="IQUMQ",
    ),
    # ── Additional demo shipments for richer UI display ──────────────────
    Shipment(
        shipment_id="SHP-90023",
        po_id="PO-DEMO-45008724",
        po_line_id="10",
        material_id="GS-7701",
        quantity=24,
        status="IN_TRANSIT",
        original_eta=_dt("2026-10-20T10:00:00"),
        current_eta=_dt("2026-10-20T10:00:00"),
        logistics_provider="DEMO-FREIGHT-B",
        destination_location_id="PEARL-DEMO",
        port_of_departure="NLRTM",
        port_of_entry="IQUMQ",
    ),
    Shipment(
        shipment_id="SHP-90031",
        po_id="PO-DEMO-45008725",
        po_line_id="10",
        material_id="BP-4410",
        quantity=4,
        status="CUSTOMS",
        original_eta=_dt("2026-10-18T10:00:00"),
        current_eta=_dt("2026-10-22T10:00:00"),
        logistics_provider="DEMO-FREIGHT-C",
        destination_location_id="PEARL-DEMO",
        delay_reason_code="CUSTOMS_INSPECTION",
        port_of_departure="DEHAM",
        port_of_entry="IQUMQ",
    ),
    Shipment(
        shipment_id="SHP-90044",
        po_id="PO-DEMO-45008726",
        po_line_id="10",
        material_id="SV-3320",
        quantity=2,
        status="IN_TRANSIT",
        original_eta=_dt("2026-10-15T10:00:00"),
        current_eta=_dt("2026-10-15T10:00:00"),
        logistics_provider="DEMO-FREIGHT-D",
        destination_location_id="PEARL-DEMO",
        port_of_departure="USLAX",
        port_of_entry="IQUMQ",
    ),
    Shipment(
        shipment_id="SHP-90058",
        po_id="PO-DEMO-45008727",
        po_line_id="10",
        material_id="TC-8800",
        quantity=12,
        status="DELIVERED",
        original_eta=_dt("2026-09-28T10:00:00"),
        current_eta=_dt("2026-09-28T10:00:00"),
        logistics_provider="DEMO-FREIGHT-E",
        destination_location_id="PEARL-DEMO",
        port_of_departure="JPOSA",
        port_of_entry="IQUMQ",
    ),
    Shipment(
        shipment_id="SHP-90062",
        po_id="PO-DEMO-45008728",
        po_line_id="10",
        material_id="CVA-8843",
        quantity=1,
        status="DELAYED",
        original_eta=_dt("2026-10-09T10:00:00"),
        current_eta=_dt("2026-10-19T10:00:00"),
        logistics_provider="DEMO-LOGISTICS",
        destination_location_id="PEARL-DEMO",
        delay_reason_code="SUPPLIER_QUALITY_HOLD",
        port_of_departure="SGSIN",
        port_of_entry="IQUMQ",
    ),
    Shipment(
        shipment_id="SHP-90071",
        po_id="PO-DEMO-45008729",
        po_line_id="10",
        material_id="GS-7701",
        quantity=6,
        status="PLANNED",
        original_eta=_dt("2026-11-01T10:00:00"),
        current_eta=_dt("2026-11-01T10:00:00"),
        logistics_provider="DEMO-FREIGHT-F",
        destination_location_id="PEARL-DEMO",
        port_of_departure="CNSHA",
        port_of_entry="IQUMQ",
    ),
]

# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
INVENTORY: list[InventoryPosition] = [
    InventoryPosition(
        location_id="PEARL-DEMO",
        material_id="CVA-8842",
        on_hand=0,
        reserved=0,
        available=0,
    ),
    InventoryPosition(
        location_id="REGIONAL-WH-DEMO",
        material_id="CVA-8842",
        on_hand=2,
        reserved=1,
        available=1,
        next_known_requirement_date=date(2026, 11, 25),
    ),
]

# ---------------------------------------------------------------------------
# Work packages
# ---------------------------------------------------------------------------
WORK_PACKAGES: list[WorkPackage] = [
    WorkPackage(
        work_package_id="TW-2047",
        turnaround_id="TA-DEMO-2026",
        location_id="PEARL-DEMO",
        asset_id="DEMO-UNIT-14",
        planned_start=_dt("2026-10-10T06:00:00"),
        planned_end=_dt("2026-10-17T18:00:00"),
        status="AT_RISK",
    ),
]

# ---------------------------------------------------------------------------
# Material requirements
# ---------------------------------------------------------------------------
MATERIAL_REQUIREMENTS: list[MaterialRequirement] = [
    MaterialRequirement(
        requirement_id="MR-7781",
        work_package_id="TW-2047",
        material_id="CVA-8842",
        quantity_required=1,
        required_by=_dt("2026-10-10T00:00:00"),
        mandatory=True,
    ),
]

# ---------------------------------------------------------------------------
# Suppliers  (resilience fields added: tier, quality_rating, on_time_delivery_rate)
# Demo scenario: SUP-101=PRIMARY/QUALITY_HOLD, SUP-203=SECONDARY/PORT_CONGESTION,
#                SUP-205=TERTIARY/unconstrained  (spec/12 §resilience-scenario)
# ---------------------------------------------------------------------------
SUPPLIERS: list[Supplier] = [
    Supplier(
        supplier_id="SUP-101",
        name="Demo Primary Supplier Ltd",
        approved=True,
        supported_materials=["CVA-8842"],
        standard_lead_time_days=21,
        tier="PRIMARY",
        quality_rating=72.0,
        on_time_delivery_rate=0.81,
    ),
    Supplier(
        supplier_id="SUP-203",
        name="Demo Secondary Supplier GmbH",
        approved=True,
        supported_materials=["CVA-8842"],
        standard_lead_time_days=14,
        tier="SECONDARY",
        quality_rating=89.0,
        on_time_delivery_rate=0.90,
    ),
    Supplier(
        supplier_id="SUP-205",
        name="Demo Tertiary Supplier Corp",
        approved=True,
        supported_materials=["CVA-8842", "CVA-8843"],
        standard_lead_time_days=7,
        tier="TERTIARY",
        quality_rating=95.0,
        on_time_delivery_rate=0.96,
    ),
    Supplier(
        supplier_id="SUP-301",
        name="Demo Unapproved Supplier Inc",
        approved=False,
        supported_materials=["CVA-8842"],
        standard_lead_time_days=5,
        tier="SPOT",
        quality_rating=None,
        on_time_delivery_rate=None,
    ),
]

# ---------------------------------------------------------------------------
# Supplier constraints  (spec/13 §8 demo playback T+3)
# SUP-101: QUALITY_HOLD/CRITICAL   → primary supplier blocked
# SUP-203: PORT_CONGESTION/HIGH    → secondary blocked via SGSIN routing
# SUP-205: no constraint           → only unconstrained approved source
# ---------------------------------------------------------------------------
SUPPLIER_CONSTRAINTS: list[SupplierConstraint] = [
    SupplierConstraint(
        supplier_id="SUP-101",
        material_id="CVA-8842",
        constraint_type="QUALITY_HOLD",
        constraint_severity="CRITICAL",
        affected_from_date=_dt("2026-09-18T08:00:00"),
        estimated_resolution_date=_dt("2026-10-25T00:00:00"),
        source_event_id="EVT-SC-0001",
    ),
    SupplierConstraint(
        supplier_id="SUP-203",
        material_id="CVA-8842",
        constraint_type="PORT_CONGESTION",
        constraint_severity="HIGH",
        affected_from_date=_dt("2026-09-20T14:30:00"),
        estimated_resolution_date=_dt("2026-10-18T00:00:00"),
        source_event_id="EVT-SC-0002",
    ),
]

# ---------------------------------------------------------------------------
# Port status  (spec/13 §8 demo playback T+4)
# SGSIN (Singapore) congestion affects SUP-203 routing
# ---------------------------------------------------------------------------
PORT_STATUSES: list[PortStatus] = [
    PortStatus(
        port_code="SGSIN",
        port_name="Port of Singapore",
        disruption_type="CONGESTION",
        severity="HIGH",
        affected_from_date=_dt("2026-09-20T00:00:00"),
        estimated_clear_date=_dt("2026-10-18T00:00:00"),
        source_event_id="EVT-PT-0001",
    ),
]

# ---------------------------------------------------------------------------
# Approved Vendor List entries  (spec/13 §8 demo playback T+0–T+2)
# ---------------------------------------------------------------------------
AVL_ENTRIES: list[ApprovedVendorEntry] = [
    ApprovedVendorEntry(
        supplier_id="SUP-101",
        material_id="CVA-8842",
        avl_status="APPROVED",
        effective_date=date(2025, 1, 15),
        reason="Original approved supplier",
    ),
    ApprovedVendorEntry(
        supplier_id="SUP-203",
        material_id="CVA-8842",
        avl_status="APPROVED",
        effective_date=date(2025, 6, 1),
        reason="Secondary source qualification completed",
    ),
    ApprovedVendorEntry(
        supplier_id="SUP-205",
        material_id="CVA-8842",
        avl_status="APPROVED",
        effective_date=date(2026, 3, 10),
        reason="Tertiary source qualification – fast-track emergency approval",
    ),
    ApprovedVendorEntry(
        supplier_id="SUP-205",
        material_id="CVA-8843",
        avl_status="APPROVED",
        effective_date=date(2026, 3, 10),
        reason="Alternate model approved by engineering",
    ),
]
