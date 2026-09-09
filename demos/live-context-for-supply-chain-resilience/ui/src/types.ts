// ui/src/types.ts – shared domain types for the UI layer
// Mirrors backend Pydantic models (spec/02_DOMAIN_MODEL.yaml)

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskStatus =
  | 'OPEN' | 'INVESTIGATING' | 'MITIGATION_PROPOSED' | 'APPROVED' | 'MITIGATED' | 'CLOSED';
export type MitigationType = 'WAIT' | 'EXPEDITE' | 'TRANSFER' | 'ALTERNATE_SUPPLIER' | 'SUBSTITUTE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type ReadinessStatus = 'CONFIRMED' | 'AT_RISK' | 'CRITICAL' | 'UNKNOWN';
export type ConstraintType =
  | 'QUALITY_HOLD' | 'CAPACITY_CONSTRAINT' | 'PORT_CONGESTION'
  | 'FORCE_MAJEURE' | 'LEAD_TIME_EXTENSION' | 'CLEARED';
export type ConstraintSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskEvent {
  risk_id: string;
  correlation_id: string;
  event_time: string;
  material_id: string;
  shipment_id: string;
  requirement_id: string;
  work_package_id: string;
  risk_type: string;
  severity: RiskSeverity;
  status: RiskStatus;
  facts: Record<string, unknown>;
  resilience_flags?: ResilienceFlags;
}

/** Populated from SupplyChainResilienceProfile at risk-detection time */
export interface ResilienceFlags {
  primary_supplier_constrained: boolean;
  secondary_supplier_constrained: boolean;
  alternate_inventory_available: boolean;
  approved_substitute_document_exists: boolean;
  constrained_supplier_count: number;
  active_sourcing_tiers: number;
}

export interface MitigationOption {
  option_id: string;
  risk_id: string;
  type: MitigationType;
  feasible: boolean;
  estimated_ready_date?: string | null;
  incremental_cost?: number | null;
  schedule_risk_score: number;
  technical_risk_score: number;
  supply_risk_score: number;
  total_score: number;
  requires_engineering_approval: boolean;
  requires_procurement_approval: boolean;
  evidence_ids: string[];
  constraints: string[];
  /** Set when infeasible due to supplier constraint */
  constraint_type?: ConstraintType | null;
  constraint_severity?: ConstraintSeverity | null;
}

export interface Evidence {
  evidence_id: string;
  document_id: string;
  title: string;
  revision: string;
  section: string;
  excerpt: string;
  relevance_score: number;
  retrieval_method: string;
}

export interface RAGResponse {
  answer: string;
  grounded: boolean;
  confidence: number;
  evidence: Evidence[];
  applied_filters: Record<string, unknown>;
  query_id: string;
}

export interface WorkPackage {
  work_package_id: string;
  turnaround_id: string;
  location_id: string;
  asset_id: string;
  planned_start: string;
  planned_end: string;
  status: string;
}

export interface MaterialRequirement {
  requirement_id: string;
  work_package_id: string;
  material_id: string;
  quantity_required: number;
  required_by: string;
  mandatory: boolean;
}

export interface Shipment {
  shipment_id: string;
  po_id: string;
  material_id: string;
  status: string;
  original_eta: string;
  current_eta: string;
  logistics_provider: string;
  destination_location_id: string;
  delay_reason_code?: string | null;
  port_of_departure?: string | null;
  port_of_entry?: string | null;
}

export interface ApprovalRequest {
  approval_request_id: string;
  risk_id: string;
  option_id: string;
  recommendation_summary: string;
  approver?: string | null;
  approved_at?: string | null;
  expiry: string;
  status: ApprovalStatus;
  created_at: string;
}

// ── Supply Chain Resilience types ────────────────────────────────────────────

/** Live resilience posture for a material/work-package combination */
export interface SupplyChainResilienceProfile {
  work_package_id: string;
  material_id: string;
  requirement_id: string;
  assessed_at: string;
  readiness_status: ReadinessStatus;
  days_to_required: number;
  available_at_destination: number;
  shortfall: number;
  unconstrained_approved_supplier_count: number;
  feasible_transfer_location_count: number;
  feasible_alternate_supplier_count: number;
  resilience_score: number;
  primary_supplier_status: string;
  secondary_supplier_status?: string | null;
  last_contributing_event_id: string;
}

export interface ResilienceProfileResponse {
  profile: SupplyChainResilienceProfile;
  profile_age_secs: number;
  evaluated_at: string;
}

/** AVL entry for a single supplier/material combination */
export interface AvlEntry {
  supplier_id: string;
  tier: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'SPOT';
  avl_status: 'APPROVED' | 'SUSPENDED' | 'REVOKED';
  constraint_type?: ConstraintType | null;
  constraint_severity?: ConstraintSeverity | null;
  estimated_resolution_date?: string | null;
}

export interface AvlStatusResponse {
  material_id: string;
  entries: AvlEntry[];
  unconstrained_approved_count: number;
  evaluated_at: string;
}

/** Live port disruption status */
export interface PortStatusResponse {
  port_code: string;
  port_name: string;
  disruption_type?: string | null;
  severity?: ConstraintSeverity | null;
  estimated_clear_date?: string | null;
  impacted_shipment_count: number;
  evaluated_at: string;
  status?: 'NO_DISRUPTION';
}

/** Individual supplier constraint status */
export interface SupplierResilienceStatus {
  supplier_id: string;
  material_id?: string | null;
  status: 'ACTIVE' | 'CLEARED';
  constraint_type?: ConstraintType | null;
  constraint_severity?: ConstraintSeverity | null;
  affected_from_date?: string | null;
  estimated_resolution_date?: string | null;
  source_event_id?: string | null;
  evaluated_at: string;
}
