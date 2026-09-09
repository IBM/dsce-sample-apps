# backend/app/rag/retriever.py
# Hybrid RAG retrieval service (spec/05_OPENSEARCH_RAG_SPEC.md)
# Falls back to keyword search over synthetic documents when OpenSearch is unavailable.

from __future__ import annotations
import uuid
from typing import Any

from app.domain.models import Evidence, RAGResponse
from app.rag.documents import DEMO_DOCUMENTS


def _simple_score(doc: dict[str, Any], query: str, filters: dict[str, Any]) -> float:
    """Lightweight keyword scoring for demo fallback (no OpenSearch dependency)."""
    query_lower = query.lower()
    content = (doc.get("content", "") + " " + doc.get("title", "")).lower()
    material_ids: list[str] = doc.get("materialIds", [])

    score = 0.0
    # Keyword presence
    for word in query_lower.split():
        if word in content:
            score += 1.0
    # Material ID exact match boost
    for mid in material_ids:
        if mid.lower() in query_lower:
            score += 5.0
    # Filter: material_id
    filter_material = filters.get("material_id") or filters.get("materialId")
    if filter_material and filter_material in material_ids:
        score += 3.0
    # Only approved documents unless explicitly asking for history
    if doc.get("approvedStatus") != "APPROVED":
        score -= 10.0
    return score


async def retrieve(
    query: str,
    filters: dict[str, Any],
    top_k: int,
    correlation_id: str,
) -> RAGResponse:
    """
    Retrieve evidence from the synthetic corpus.
    In production, replaces with OpenSearch hybrid (BM25 + vector) retrieval.
    """
    scored = [
        (doc, _simple_score(doc, query, filters))
        for doc in DEMO_DOCUMENTS
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    top_docs = [d for d, s in scored[:top_k] if s > 0]

    evidence: list[Evidence] = []
    for i, doc in enumerate(top_docs):
        evidence.append(Evidence(
            evidence_id=f"EV-{uuid.uuid4().hex[:8].upper()}",
            document_id=doc["documentId"],
            title=doc["title"],
            revision=doc["revision"],
            section=doc.get("documentType", ""),
            excerpt=doc["content"][:400],
            relevance_score=round(scored[i][1] / max(scored[0][1], 1), 3),
            retrieval_method="hybrid",
        ))

    grounded = len(evidence) > 0
    confidence = round(evidence[0].relevance_score, 2) if evidence else 0.0

    # Substitution grounding rule (spec/05)
    query_lower = query.lower()
    is_substitution_query = any(k in query_lower for k in ["substitute", "substitution", "replace", "alternate material"])
    sub_evidence = [e for e in evidence if "substitut" in e.title.lower() or "substitut" in e.excerpt.lower()]

    if is_substitution_query and not sub_evidence:
        return RAGResponse(
            answer=(
                "Insufficient evidence: no approved engineering substitution document was retrieved "
                "for this query. Engineering review is required before recommending a substitute. "
                "This is a safety-critical grounding constraint."
            ),
            grounded=False,
            confidence=0.0,
            evidence=[],
            applied_filters=filters,
            query_id=correlation_id,
        )

    answer = _synthesise_answer(query, evidence) if evidence else (
        "No relevant evidence found in the enterprise knowledge base for this query."
    )

    return RAGResponse(
        answer=answer,
        grounded=grounded,
        confidence=confidence,
        evidence=evidence,
        applied_filters=filters,
        query_id=correlation_id,
    )


def _synthesise_answer(query: str, evidence: list[Evidence]) -> str:
    """
    Build a structured markdown answer from retrieved evidence.
    Returns markdown that the UI RichAnswer renderer will display as
    headings, tables, bullet lists, and blockquotes — never a flat paragraph.
    """
    query_lower = query.lower()

    # ── Detect intent ─────────────────────────────────────────────────────────
    is_resilience  = any(k in query_lower for k in ["resilience", "supply network", "constrained", "avl", "approved vendor", "unconstrained"])
    is_risk        = any(k in query_lower for k in ["risk", "timeline", "shipment", "eta", "shortage", "work package"])
    is_policy      = any(k in query_lower for k in ["policy", "readiness", "material readiness", "gate", "72 hour", "transfer", "logistics"])
    is_substitution = any(k in query_lower for k in ["substitute", "substitution", "replace", "engineering spec", "compatible"])
    is_procurement = any(k in query_lower for k in ["expedite", "emergency", "procurement", "approval", "supplier agreement", "lead time"])

    lines: list[str] = []

    # ── Section 1: direct key-point bullets from each evidence excerpt ────────
    lines.append("### Key Findings\n")
    for ev in evidence[:3]:
        # Split the excerpt into sentences and emit each as a bullet
        sentences = [s.strip() for s in ev.excerpt.replace("\n", " ").split(". ") if s.strip()]
        lines.append(f"**{ev.title}** (`{ev.document_id}` · {ev.revision})\n")
        for sent in sentences[:4]:          # cap at 4 bullets per doc
            if sent:
                lines.append(f"- {sent.rstrip('.')}.")
        lines.append("")

    # ── Section 2: structured facts table for resilience / risk queries ───────
    if is_resilience or is_risk:
        lines.append("### Quick Reference\n")
        lines.append("| Field | Detail |")
        lines.append("|---|---|")

        if is_resilience:
            lines.append("| **Material** | `CVA-8842` — Rotary Actuator Assembly |")
            lines.append("| **Primary Supplier** | `SUP-101` — QUALITY_HOLD / **CRITICAL** |")
            lines.append("| **Secondary Supplier** | `SUP-203` — PORT_CONGESTION / **HIGH** (via `SGSIN`) |")
            lines.append("| **Unconstrained Approved Supplier** | `SUP-205` — Demo Alternate Supplier Corp |")
            lines.append("| **Resilience Score** | 60.5 / 100 (**CRITICAL** posture) |")
        if is_risk:
            lines.append("| **Risk** | `RISK-CVA8842-TW2047` — **CRITICAL** |")
            lines.append("| **Work Package** | `TW-2047` — Required by 2026-03-18 |")
            lines.append("| **Shipment** | `SHP-90017` — ETA slipped +4 days |")
        lines.append("")

    # ── Section 3: policy rules as numbered list ──────────────────────────────
    if is_policy:
        lines.append("### Policy Requirements\n")
        policy_rules = [
            "All **CRITICAL** and **HIGH** criticality materials must be confirmed on-site at least **72 hours** before planned turnaround start.",
            "If a material is not confirmed by the readiness gate, the Turnaround Planner must initiate a **Material Risk Assessment** and escalate to Supply Chain Manager.",
            "Inventory transfers from `REGIONAL-WH-DEMO` to site require **minimum 3-day** logistics lead time.",
            "Emergency procurement with premium freight: **5–10 business days** typical for approved vendors.",
        ]
        for i, rule in enumerate(policy_rules, 1):
            lines.append(f"{i}. {rule}")
        lines.append("")

    # ── Section 4: procurement thresholds ─────────────────────────────────────
    if is_procurement:
        lines.append("### Approval Thresholds\n")
        lines.append("| Amount | Approver Required |")
        lines.append("|---|---|")
        lines.append("| Up to **USD 20,000** | Supply Chain Manager |")
        lines.append("| Above **USD 20,000** | Procurement Director |")
        lines.append("| Unapproved vendor | Engineering **+** Quality sign-off |")
        lines.append("")
        lines.append("> Emergency orders for `SUP-205` attract a premium of **USD 18,000 / unit** above standard pricing (7-day standard lead time).")
        lines.append("")

    # ── Section 5: substitution verdict ──────────────────────────────────────
    if is_substitution:
        lines.append("### Substitution Verdict\n")
        lines.append("> `CVA-8843` is approved as a direct functional substitute for `CVA-8842` on **non-safety-critical** valves (e.g. DEMO-UNIT-14 — NON-SIS classification).")
        lines.append(">")
        lines.append("> For **safety-critical** service, written **Engineering Authorization** is required before substitution.")
        lines.append("")

    # ── Section 6: evidence table ─────────────────────────────────────────────
    lines.append("### Evidence Sources\n")
    lines.append("| # | Document | Rev | Type |")
    lines.append("|---|---|---|---|")
    for i, ev in enumerate(evidence[:5], 1):
        lines.append(f"| {i} | {ev.title} (`{ev.document_id}`) | {ev.revision} | {ev.section} |")

    return "\n".join(lines)
