# backend/app/domain/models.py
# Pydantic domain models derived from spec/02_DOMAIN_MODEL.yaml
# SYNTHETIC DEMO DATA ONLY – not real Shell operational data

from __future__ import annotations
from datetime import date, datetime
from typing import Any, Literal
from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------
MaterialCriticality = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
POStatus = Literal["OPEN", "CONFIRMED", "PARTIALLY_SHIPPED", "SHIPPED", "CLOSED", "CANCELLED"]
ShipmentStatus = Literal["PLANNED", "IN_TRANSIT", "DELAYED", "CUSTOMS", "DELIVERED", "CANCELLED"]
WorkPackageStatus = Literal["PLANNED", "READY", "AT_RISK", "RELEASED", "COMPLETE"]
RiskType = Literal["LATE_DELIVERY", "STOCKOUT", "SUPPLIER_FAILURE", "QUALITY_HOLD"]
RiskSeverity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
RiskStatus = Literal[
    "OPEN", "INVESTIGATING", "MITIGATION_PROPOSED", "APPROVED", "MITIGATED", "CLOSED"
]
MitigationType = Literal["WAIT", "EXPEDITE", "TRANSFER", "ALTERNATE_SUPPLIER", "SUBSTITUTE"]
ActorType = Literal["SYSTEM", "AGENT", "HUMAN"]
ApprovalStatus = Literal["PENDING", "APPROVED", "REJECTED", "EXPIRED"]

# Supply chain resilience enumerations
SupplierTier = Literal["PRIMARY", "SECONDARY", "TERTIARY", "SPOT"]
ConstraintType = Literal[
    "QUALITY_HOLD", "CAPACITY_CONSTRAINT", "PORT_CONGESTION",
    "FORCE_MAJEURE", "LEAD_TIME_EXTENSION", "CLEARED",
]
ConstraintSeverity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
PortDisruptionType = Literal["CONGESTION", "STRIKE", "CLOSURE", "WEATHER", "CUSTOMS_DELAY", "CLEARED"]
AvlStatus = Literal["APPROVED", "SUSPENDED", "REVOKED"]
ReadinessStatus = Literal["CONFIRMED", "AT_RISK", "CRITICAL", "UNKNOWN"]

ApiErrorCode = Literal[
    "NOT_FOUND",
    "INVALID_INPUT",
    "STALE_DATA",
    "CONFLICT",
    "APPROVAL_REQUIRED",
    "APPROVAL_MISMATCH",
    "INSUFFICIENT_INVENTORY",
    "NO_ENGINEERING_EVIDENCE",
    "UPSTREAM_UNAVAILABLE",
    # Supply chain resilience error codes
    "SUPPLIER_CONSTRAINED",
    "AVL_STATUS_CHANGED",
    "RESILIENCE_PROFILE_STALE",
]


# ---------------------------------------------------------------------------
# Domain entities
# ---------------------------------------------------------------------------
class Material(BaseModel):
    material_id: str
    description: str
    material_class: str
    manufacturer: str
    manufacturer_part_number: str
    criticality: MaterialCriticality
    unit_of_measure: str


class PurchaseOrder(BaseModel):
    po_id: str
    supplier_id: str
    order_date: date
    status: POStatus
    currency: str


class PurchaseOrderLine(BaseModel):
    po_id: str
    line_id: str
    material_id: str
    quantity: float
    required_delivery_date: date
    agreed_delivery_date: date


class Shipment(BaseModel):
    shipment_id: str
    po_id: str
    po_line_id: str
    material_id: str
    quantity: float
    status: ShipmentStatus
    original_eta: datetime
    current_eta: datetime
    logistics_provider: str
    destination_location_id: str
    delay_reason_code: str | None = None
    port_of_departure: str | None = None
    port_of_entry: str | None = None


class InventoryPosition(BaseModel):
    location_id: str
    material_id: str
    on_hand: float
    reserved: float
    available: float  # invariant: max(on_hand - reserved, 0)
    next_known_requirement_date: date | None = None

    @field_validator("available", mode="before")
    @classmethod
    def enforce_available(cls, v: float, info: Any) -> float:
        data = info.data
        on_hand = data.get("on_hand", 0)
        reserved = data.get("reserved", 0)
        return max(on_hand - reserved, 0)


class WorkPackage(BaseModel):
    work_package_id: str
    turnaround_id: str
    location_id: str
    asset_id: str
    planned_start: datetime
    planned_end: datetime
    status: WorkPackageStatus


class MaterialRequirement(BaseModel):
    requirement_id: str
    work_package_id: str
    material_id: str
    quantity_required: float
    required_by: datetime
    mandatory: bool


class Supplier(BaseModel):
    supplier_id: str
    name: str
    approved: bool
    supported_materials: list[str]
    standard_lead_time_days: int
    # Supply chain resilience fields (spec/02_DOMAIN_MODEL.yaml)
    tier: SupplierTier = "PRIMARY"
    quality_rating: float | None = None        # 0..100
    on_time_delivery_rate: float | None = None  # 0..1


class RiskEvent(BaseModel):
    risk_id: str
    correlation_id: str
    event_time: datetime
    material_id: str
    shipment_id: str
    requirement_id: str
    work_package_id: str
    risk_type: RiskType
    severity: RiskSeverity
    status: RiskStatus
    facts: dict[str, Any] = {}
    resilience_flags: "ResilienceFlags | None" = None


class MitigationOption(BaseModel):
    option_id: str
    risk_id: str
    type: MitigationType
    feasible: bool
    estimated_ready_date: datetime | None = None
    incremental_cost: float | None = None
    schedule_risk_score: float
    technical_risk_score: float
    supply_risk_score: float
    total_score: float
    requires_engineering_approval: bool
    requires_procurement_approval: bool
    evidence_ids: list[str] = []
    constraints: list[str] = []


class ApprovalRequest(BaseModel):
    approval_request_id: str
    risk_id: str
    option_id: str
    option_hash: str  # SHA-256 snapshot hash
    recommendation_summary: str
    approver: str | None = None
    approved_at: datetime | None = None
    expiry: datetime
    status: ApprovalStatus
    created_at: datetime


# ---------------------------------------------------------------------------
# Supply chain resilience entities (spec/02_DOMAIN_MODEL.yaml §SupplierConstraint +)
# ---------------------------------------------------------------------------

class SupplierConstraint(BaseModel):
    """Live constraint signal for a supplier/material pair.
    Source: supply.supplier.status.changed events."""
    supplier_id: str
    material_id: str | None = None   # None = applies to all materials
    constraint_type: ConstraintType
    constraint_severity: ConstraintSeverity
    affected_from_date: datetime
    estimated_resolution_date: datetime | None = None
    source_event_id: str


class PortStatus(BaseModel):
    """Live port disruption signal.
    Source: supply.port.status.changed events."""
    port_code: str
    port_name: str
    disruption_type: PortDisruptionType
    severity: ConstraintSeverity
    affected_from_date: datetime
    estimated_clear_date: datetime | None = None
    source_event_id: str


class ApprovedVendorEntry(BaseModel):
    """Master AVL record per supplier/material.
    Source: supply.approved_vendor.changed events."""
    supplier_id: str
    material_id: str
    avl_status: AvlStatus
    effective_date: date
    reason: str | None = None


class ResilienceFlags(BaseModel):
    """Resilience context embedded in RiskEvent (spec/02 resilienceFlags)."""
    primary_supplier_constrained: bool = False
    secondary_supplier_constrained: bool = False
    alternate_inventory_available: bool = False
    approved_substitute_document_exists: bool = False
    constrained_supplier_count: int = 0
    active_sourcing_tiers: int = 0


class SupplyChainResilienceProfile(BaseModel):
    """Computed resilience posture for (workPackageId, materialId).
    Recomputed on each contributing event per spec/13 §3.2."""
    work_package_id: str
    material_id: str
    requirement_id: str
    assessed_at: datetime
    readiness_status: ReadinessStatus
    days_to_required: int
    available_at_destination: float
    shortfall: float
    unconstrained_approved_supplier_count: int
    feasible_transfer_location_count: int
    feasible_alternate_supplier_count: int
    resilience_score: float   # 0..100, lower = better (spec/09)
    primary_supplier_status: str
    secondary_supplier_status: str | None = None
    last_contributing_event_id: str
    # Dimension scores for explainability (spec/13 §5 – explainable posture)
    supplier_coverage_score: float = 0.0
    inventory_buffer_score: float = 0.0
    shipment_exposure_score: float = 0.0
    port_disruption_score: float = 0.0


# ---------------------------------------------------------------------------
# Event headers (spec/03_EVENT_CONTRACTS.yaml)
# ---------------------------------------------------------------------------
class EventHeader(BaseModel):
    event_id: str
    event_type: str
    event_version: str
    occurred_at: datetime
    correlation_id: str
    source_system: str
    producer: str


# ---------------------------------------------------------------------------
# RAG response contract (spec/05_OPENSEARCH_RAG_SPEC.md)
# ---------------------------------------------------------------------------
class Evidence(BaseModel):
    evidence_id: str
    document_id: str
    title: str
    revision: str
    section: str
    excerpt: str
    relevance_score: float
    retrieval_method: Literal["lexical", "semantic", "hybrid"]


class RAGResponse(BaseModel):
    answer: str
    grounded: bool
    confidence: float
    evidence: list[Evidence] = []
    applied_filters: dict[str, Any] = {}
    query_id: str


# ---------------------------------------------------------------------------
# API error model (spec/04_API_AND_TOOL_CONTRACTS.yaml)
# ---------------------------------------------------------------------------
class ApiError(BaseModel):
    code: ApiErrorCode
    message: str
    retriable: bool
    correlation_id: str
    details: dict[str, Any] | None = None
