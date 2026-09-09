# backend/app/rag/documents.py
# Synthetic knowledge documents for the RAG corpus (spec/05_OPENSEARCH_RAG_SPEC.md)
# SYNTHETIC DEMO DATA ONLY

from __future__ import annotations
from typing import Any

DEMO_DOCUMENTS: list[dict[str, Any]] = [
    {
        "documentId": "DOC-ENG-001",
        "title": "Control Valve Actuator Engineering Specification – CVA Series",
        "documentType": "ENGINEERING_SPEC",
        "revision": "Rev-C",
        "effectiveDate": "2025-01-15",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "ROTARY_ACTUATOR",
        "materialIds": ["CVA-8842", "CVA-8843"],
        "manufacturer": "DEMO-MFGR-A",
        "approvedStatus": "APPROVED",
        "content": (
            "This specification covers the CVA-8842 and CVA-8843 rotary actuator assemblies "
            "for use on control valves in the Pearl GTL demo facility. "
            "CVA-8843 is a direct functional substitute for CVA-8842 provided the torque rating "
            "of the application is within CVA-8843 operating envelope (±10% of CVA-8842 nominal). "
            "Engineering review is mandatory before substitution is approved for any safety-critical "
            "valve service. Required By: Section 4.2 – Material Substitution Procedure."
        ),
    },
    {
        "documentId": "DOC-PROC-002",
        "title": "Material Substitution Procedure – Valve Actuators",
        "documentType": "SUBSTITUTION_PROCEDURE",
        "revision": "Rev-B",
        "effectiveDate": "2024-06-01",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "ROTARY_ACTUATOR",
        "materialIds": ["CVA-8842", "CVA-8843"],
        "manufacturer": "DEMO-MFGR-A",
        "approvedStatus": "APPROVED",
        "content": (
            "Substitution of valve actuator assemblies requires: "
            "(1) Review of approved manufacturer/vendor list (AML/AVL). "
            "(2) Torque and mounting compatibility verification by Discipline Engineer. "
            "(3) Turnaround Planner notification for critical-path items. "
            "CVA-8843 is listed as approved substitute for CVA-8842 on non-safety-critical valves. "
            "For safety-critical service, written Engineering Authorization is required."
        ),
    },
    {
        "documentId": "DOC-AVL-003",
        "title": "Approved Vendor/Manufacturer List – Rotating Actuators",
        "documentType": "AVL",
        "revision": "Rev-D",
        "effectiveDate": "2026-01-01",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "ROTARY_ACTUATOR",
        "materialIds": ["CVA-8842", "CVA-8843"],
        "manufacturer": "DEMO-MFGR-A",
        "approvedStatus": "APPROVED",
        "content": (
            "Approved vendors for CVA series actuators: "
            "DEMO-MFGR-A (preferred), DEMO-MFGR-B (approved alternate). "
            "SUP-205 (Demo Alternate Supplier Corp) is listed as an approved distributor "
            "for both DEMO-MFGR-A and DEMO-MFGR-B products. "
            "SUP-301 is NOT on the approved vendor list as of this revision."
        ),
    },
    {
        "documentId": "DOC-PROC-004",
        "title": "Turnaround Material Readiness Procedure",
        "documentType": "TURNAROUND_PROCEDURE",
        "revision": "Rev-A",
        "effectiveDate": "2025-03-01",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "GENERAL",
        "materialIds": [],
        "manufacturer": "",
        "approvedStatus": "APPROVED",
        "content": (
            "Material readiness gate: All CRITICAL and HIGH criticality materials must be "
            "confirmed on-site at least 72 hours before planned turnaround start. "
            "If a material is not confirmed by the readiness gate, the Turnaround Planner "
            "must initiate a Material Risk Assessment and escalate to Supply Chain Manager. "
            "Inventory transfers from Regional Warehouse (REGIONAL-WH-DEMO) to site require "
            "minimum 3-day logistics lead time. "
            "Emergency procurement with premium freight: 5–10 business days typical for approved vendors."
        ),
    },
    {
        "documentId": "DOC-PROC-005",
        "title": "Procurement Policy – Emergency and Expedite Orders",
        "documentType": "PROCUREMENT_POLICY",
        "revision": "Rev-C",
        "effectiveDate": "2025-07-01",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "GENERAL",
        "materialIds": [],
        "manufacturer": "",
        "approvedStatus": "APPROVED",
        "content": (
            "Emergency procurement orders require Supply Chain Manager approval. "
            "Expedite fees up to USD 20,000 per item may be approved by Supply Chain Manager. "
            "Amounts above USD 20,000 require Procurement Director approval. "
            "Alternate suppliers must be on the Approved Vendor/Manufacturer List. "
            "Unapproved vendors require Engineering and Quality sign-off before order placement."
        ),
    },
    {
        "documentId": "DOC-LOG-006",
        "title": "Logistics Escalation Procedure – Critical Material Delays",
        "documentType": "LOGISTICS_PROCEDURE",
        "revision": "Rev-A",
        "effectiveDate": "2024-11-01",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "GENERAL",
        "materialIds": [],
        "manufacturer": "",
        "approvedStatus": "APPROVED",
        "content": (
            "Step 1: Logistics provider notified within 4 hours of delay detection. "
            "Step 2: Alternative routing options evaluated within 8 hours. "
            "Step 3: If delay exceeds 48 hours, expedite and alternate procurement activated. "
            "Air freight option available for items under 50 kg – typical 2-day door-to-door. "
            "Regional Warehouse transfer is lowest-risk option if stock is available and "
            "transfer does not jeopardise other planned maintenance activities."
        ),
    },
    {
        "documentId": "DOC-SUP-007",
        "title": "Supplier Agreement Excerpt – Demo Alternate Supplier Corp (SUP-205)",
        "documentType": "SUPPLIER_AGREEMENT",
        "revision": "Rev-B",
        "effectiveDate": "2025-05-01",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "ROTARY_ACTUATOR",
        "materialIds": ["CVA-8842", "CVA-8843"],
        "manufacturer": "DEMO-MFGR-B",
        "approvedStatus": "APPROVED",
        "content": (
            "SUP-205 (Demo Alternate Supplier Corp) is contracted to supply CVA-8842 and "
            "CVA-8843 actuator assemblies with a standard lead time of 7 calendar days. "
            "Emergency orders (confirmed within 2 business days of request) attract a "
            "premium charge of USD 18,000 per unit above standard pricing. "
            "Quality certificate and traceability documentation supplied with every unit."
        ),
    },
    {
        "documentId": "DOC-ENG-008",
        "title": "Safety Valve Service Classification – DEMO-UNIT-14",
        "documentType": "ENGINEERING_SPEC",
        "revision": "Rev-A",
        "effectiveDate": "2025-09-01",
        "sourceSystem": "DEMO-DMS",
        "classification": "INTERNAL",
        "facility": "PEARL-DEMO",
        "equipmentClass": "ROTARY_ACTUATOR",
        "materialIds": ["CVA-8842"],
        "manufacturer": "DEMO-MFGR-A",
        "approvedStatus": "APPROVED",
        "content": (
            "DEMO-UNIT-14 contains control valves in General Process Service (non-safety-critical). "
            "CVA-8842 actuator assemblies on this unit are classified as NON-SIS. "
            "Engineering Authorization is NOT required for substitution with CVA-8843, "
            "provided the substitution procedure DOC-PROC-002 is followed and Discipline "
            "Engineer signs the Materials Deviation Form prior to installation."
        ),
    },
]
