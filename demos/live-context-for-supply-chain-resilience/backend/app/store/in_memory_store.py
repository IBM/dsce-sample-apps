# backend/app/store/in_memory_store.py
# In-memory store for demo/dev – seeded from synthetic data (spec/12).
# Replace with PostgreSQL / Redis in production.

from __future__ import annotations
import uuid
from copy import deepcopy

from app.data.seed import (
    AVL_ENTRIES,
    INVENTORY,
    MATERIAL_REQUIREMENTS,
    MATERIALS,
    PORT_STATUSES,
    PURCHASE_ORDER_LINES,
    PURCHASE_ORDERS,
    SHIPMENTS,
    SUPPLIER_CONSTRAINTS,
    SUPPLIERS,
    WORK_PACKAGES,
)
from app.domain.models import (
    ApprovalRequest,
    ApprovedVendorEntry,
    InventoryPosition,
    Material,
    MaterialRequirement,
    MitigationOption,
    PortStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    RiskEvent,
    Shipment,
    Supplier,
    SupplierConstraint,
    SupplyChainResilienceProfile,
    WorkPackage,
)


class InMemoryStore:
    """Single-process in-memory store for the demo backend."""

    def __init__(self) -> None:
        self._reset()

    def _reset(self) -> None:
        self._materials: dict[str, Material] = {m.material_id: m for m in MATERIALS}
        self._pos: dict[str, PurchaseOrder] = {p.po_id: p for p in PURCHASE_ORDERS}
        self._po_lines: dict[str, PurchaseOrderLine] = {
            f"{l.po_id}:{l.line_id}": l for l in PURCHASE_ORDER_LINES
        }
        self._shipments: dict[str, Shipment] = {s.shipment_id: s for s in SHIPMENTS}
        self._inventory: dict[str, InventoryPosition] = {
            f"{i.location_id}:{i.material_id}": i for i in INVENTORY
        }
        self._work_packages: dict[str, WorkPackage] = {
            w.work_package_id: w for w in WORK_PACKAGES
        }
        self._requirements: dict[str, MaterialRequirement] = {
            r.requirement_id: r for r in MATERIAL_REQUIREMENTS
        }
        self._suppliers: dict[str, Supplier] = {s.supplier_id: s for s in SUPPLIERS}
        self._risks: dict[str, RiskEvent] = {}
        self._options: dict[str, MitigationOption] = {}
        self._approvals: dict[str, ApprovalRequest] = {}
        # ── Supply chain resilience state (spec/13) ──────────────────────────
        self._constraints: dict[str, SupplierConstraint] = {
            f"{c.supplier_id}:{c.material_id or '*'}": c
            for c in SUPPLIER_CONSTRAINTS
        }
        self._port_statuses: dict[str, PortStatus] = {
            p.port_code: p for p in PORT_STATUSES
        }
        self._avl_entries: dict[str, ApprovedVendorEntry] = {
            f"{e.supplier_id}:{e.material_id}": e for e in AVL_ENTRIES
        }
        self._resilience_profiles: dict[str, SupplyChainResilienceProfile] = {}

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------
    def get_material(self, material_id: str) -> Material | None:
        return self._materials.get(material_id)

    def get_po(self, po_id: str) -> PurchaseOrder | None:
        return self._pos.get(po_id)

    def get_po_line(self, po_id: str, line_id: str) -> PurchaseOrderLine | None:
        return self._po_lines.get(f"{po_id}:{line_id}")

    def get_shipment(self, shipment_id: str) -> Shipment | None:
        return self._shipments.get(shipment_id)

    def get_inventory(self, location_id: str, material_id: str) -> InventoryPosition | None:
        return self._inventory.get(f"{location_id}:{material_id}")

    def get_all_inventory_for_material(self, material_id: str) -> list[InventoryPosition]:
        return [i for i in self._inventory.values() if i.material_id == material_id]

    def get_work_package(self, work_package_id: str) -> WorkPackage | None:
        return self._work_packages.get(work_package_id)

    def get_requirements_by_work_package(self, work_package_id: str) -> list[MaterialRequirement]:
        return [r for r in self._requirements.values() if r.work_package_id == work_package_id]

    def get_requirement(self, requirement_id: str) -> MaterialRequirement | None:
        return self._requirements.get(requirement_id)

    def get_supplier(self, supplier_id: str) -> Supplier | None:
        return self._suppliers.get(supplier_id)

    def get_approved_suppliers_for_material(self, material_id: str) -> list[Supplier]:
        return [
            s for s in self._suppliers.values()
            if s.approved and material_id in s.supported_materials
        ]

    # ── Resilience reads ──────────────────────────────────────────────────────
    def get_supplier_constraint(
        self, supplier_id: str, material_id: str | None = None
    ) -> SupplierConstraint | None:
        # Try specific material first, then wildcard
        key = f"{supplier_id}:{material_id or '*'}"
        result = self._constraints.get(key)
        if result is None and material_id is not None:
            result = self._constraints.get(f"{supplier_id}:*")
        return result

    def get_all_constraints_for_material(self, material_id: str) -> list[SupplierConstraint]:
        return [
            c for c in self._constraints.values()
            if c.material_id is None or c.material_id == material_id
        ]

    def get_port_status(self, port_code: str) -> PortStatus | None:
        return self._port_statuses.get(port_code)

    def get_all_port_statuses(self) -> list[PortStatus]:
        return list(self._port_statuses.values())

    def get_avl_entry(self, supplier_id: str, material_id: str) -> ApprovedVendorEntry | None:
        return self._avl_entries.get(f"{supplier_id}:{material_id}")

    def get_avl_entries_for_material(self, material_id: str) -> list[ApprovedVendorEntry]:
        return [e for e in self._avl_entries.values() if e.material_id == material_id]

    def get_resilience_profile(
        self, work_package_id: str, material_id: str
    ) -> SupplyChainResilienceProfile | None:
        return self._resilience_profiles.get(f"{work_package_id}:{material_id}")

    def get_risk(self, risk_id: str) -> RiskEvent | None:
        return self._risks.get(risk_id)

    def get_all_risks(self) -> list[RiskEvent]:
        return list(self._risks.values())

    def get_options_for_risk(self, risk_id: str) -> list[MitigationOption]:
        return [o for o in self._options.values() if o.risk_id == risk_id]

    def get_option(self, option_id: str) -> MitigationOption | None:
        return self._options.get(option_id)

    def get_approval(self, approval_request_id: str) -> ApprovalRequest | None:
        return self._approvals.get(approval_request_id)

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------
    def upsert_shipment(self, shipment: Shipment) -> None:
        self._shipments[shipment.shipment_id] = shipment

    def upsert_inventory(self, position: InventoryPosition) -> None:
        # Re-enforce invariant on write
        corrected = position.model_copy(
            update={"available": max(position.on_hand - position.reserved, 0)}
        )
        self._inventory[f"{position.location_id}:{position.material_id}"] = corrected

    def upsert_risk(self, risk: RiskEvent) -> None:
        self._risks[risk.risk_id] = risk

    def upsert_option(self, option: MitigationOption) -> None:
        self._options[option.option_id] = option

    def upsert_approval(self, approval: ApprovalRequest) -> None:
        self._approvals[approval.approval_request_id] = approval

    def update_work_package_status(
        self, work_package_id: str, status: WorkPackage["status"]  # type: ignore[type-arg]
    ) -> None:
        wp = self._work_packages.get(work_package_id)
        if wp:
            self._work_packages[work_package_id] = wp.model_copy(update={"status": status})

    # ── Resilience writes ─────────────────────────────────────────────────────
    def upsert_supplier_constraint(self, constraint: SupplierConstraint) -> None:
        self._constraints[f"{constraint.supplier_id}:{constraint.material_id or '*'}"] = constraint

    def upsert_port_status(self, status: PortStatus) -> None:
        self._port_statuses[status.port_code] = status

    def upsert_avl_entry(self, entry: ApprovedVendorEntry) -> None:
        self._avl_entries[f"{entry.supplier_id}:{entry.material_id}"] = entry

    def upsert_resilience_profile(self, profile: SupplyChainResilienceProfile) -> None:
        self._resilience_profiles[f"{profile.work_package_id}:{profile.material_id}"] = profile

    # ------------------------------------------------------------------
    # Demo helpers
    # ------------------------------------------------------------------
    def reset_to_seed(self) -> None:
        """Restore all mutable state to initial seed values."""
        self._reset()

    @staticmethod
    def generate_id() -> str:
        return str(uuid.uuid4())


# Singleton store used across the application
store = InMemoryStore()
