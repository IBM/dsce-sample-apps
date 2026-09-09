# OpenSearch + RAG Specification

**Spec:** 05_OPENSEARCH_RAG_SPEC.md  
**Version:** 2.0  
**Status:** Approved  
**Classification:** SYNTHETIC DEMO — not real Shell or Pearl GTL operational data

---

## 1. Purpose

This specification defines the Retrieval-Augmented Generation (RAG) capability for the Turnaround Supply Chain Intelligence (TSCI) solution. The RAG service provides **grounded enterprise knowledge** to the `EngineeringKnowledgeAgent` and the primary agent at investigation time.

The RAG service is a **standalone backend capability** and MUST NOT be embedded as ad-hoc search logic inside agent instructions. Every knowledge-grounded claim made by the agent MUST cite at least one retrieved evidence item. Claims made without evidence MUST be rejected with `grounded: false`.

---

## 2. RAG Architecture Overview

```
User Query (via agent tool call)
        │
        ▼
 ┌─────────────────────┐
 │  Intent & Entity    │  Parse query intent, extract material IDs,
 │  Parser             │  document types, facility filters
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │  Metadata           │  Pre-filter by: facility, documentType,
 │  Pre-Filter         │  approvedStatus, effectiveDate, materialIds[]
 └────────┬────────────┘
          │
          ┌──────────────────────┐
          │                      │
          ▼                      ▼
 ┌─────────────────┐   ┌─────────────────┐
 │   BM25 Lexical  │   │  Semantic Vector │
 │   Search        │   │  Search (kNN)    │
 └────────┬────────┘   └────────┬────────┘
          └──────────┬──────────┘
                     ▼
          ┌─────────────────────┐
          │  Rank Fusion &      │  Reciprocal rank fusion;
          │  Normalization      │  optional reranker (feature flag)
          └────────┬────────────┘
                   │
                   ▼
          ┌─────────────────────┐
          │  Grounding          │  Apply grounding rules; validate
          │  Validation         │  evidence meets requirement
          └────────┬────────────┘
                   │
                   ▼
          ┌─────────────────────┐
          │  RAGResponse        │  Return answer + evidence[] + grounded
          └─────────────────────┘
```

**Fallback:** If OpenSearch is unavailable, an in-memory fallback index loads the same 8 synthetic documents at startup. Fallback mode is logged and surfaced in the RAGResponse `applied_filters.fallback_mode = true`.

---

## 3. Corpus Catalogue

The corpus consists of exactly **8 synthetic APPROVED documents** covering all evidence domains required by the TSCI agent. All documents are synthetic demo data; none represent real Shell, Pearl GTL, or supplier proprietary information.

### 3.1 Document Catalogue

| # | Document ID | Title | Type | Purpose | Key Claims |
|---|---|---|---|---|---|
| 1 | `DOC-ENG-001` | Catalytic Charge Valve CVA-8842 Engineering Specification | ENGINEERING_SPEC | Primary authority for CVA-8842 materials, pressure ratings, and fit/form/function requirements | ANSI 150 Class flanges; Max 450°C / 120 bar; approved materials 316L SS and Hastelloy C276; any substitution requires RE-400 approval |
| 2 | `DOC-ENG-002` | General Actuator and Instrumentation Specification GA-2200 Series | VALVE_ACTUATOR_SPEC | Defines the actuator/control specification for the CVA-8842 assembly | Fail-safe open/close requirements; pneumatic actuator; dimensional envelope for GA-2200 series |
| 3 | `DOC-AVL-001` | Approved Vendor List — Process Valves (Rev 14) | APPROVED_VENDOR_LIST | Authoritative list of approved manufacturers and part numbers for CVA-8842 class | SupplierCo A (Tier 1), SupplierCo B (Tier 2), ValveTech Ltd (Tier 3) are APPROVED for CVA-8842; MechParts Inc is APPROVED pending (requires additional QA sign-off) |
| 4 | `DOC-SUB-001` | Material Substitution Procedure MSP-220 | SUBSTITUTION_PROCEDURE | Defines the process and authority required before an alternate material or part can be substituted | Substitutions require written approval from Reliability Engineering (RE-400 form); expedited substitution path available only for Tier 2 approved items; Tier 3 and spot-market items require full qualification cycle |
| 5 | `DOC-MRP-001` | Turnaround Material Readiness Procedure TRP-450 | READINESS_PROCEDURE | Defines the readiness criteria and milestone gates for turnaround critical materials | Material must arrive at site warehouse 14 days before planned start; critical materials require two independent supply paths confirmed; shortage declaration triggers Contingency Supply Protocol (CSP) |
| 6 | `DOC-POL-001` | Procurement Policy — Emergency and Expedite Orders PP-110 | PROCUREMENT_POLICY | Authorises expediting procedures and spend limits for emergency procurement | Expedite orders up to USD 150,000 can be approved by Supply Chain Manager; above USD 150,000 requires VP Operations approval; expedite fees limited to 25% of base unit cost |
| 7 | `DOC-LOG-001` | Logistics Escalation Procedure LEP-305 | LOGISTICS_PROCEDURE | Defines escalation steps when shipment ETA threatens turnaround start date | Air freight authorised for critical materials when sea freight delay exceeds 10 days; air freight route must avoid congested ports; decision requires documented risk assessment |
| 8 | `DOC-SLA-001` | Supplier Framework Agreement — SupplierCo A (Excerpt) | SUPPLIER_AGREEMENT | Key SLA obligations for primary approved supplier | Guaranteed delivery within 6 weeks from PO confirmation; 72-hour expedite response commitment; quality hold notification within 24 hours of issue identification |

---

## 4. Document Data Model

Every source document stored in the `enterprise-knowledge-v1` index MUST conform to the following schema.

### 4.1 Document Record

| Field | Type | Required | Description |
|---|---|---|---|
| `documentId` | string | ✓ | Globally unique document identifier (e.g. `DOC-ENG-001`) |
| `title` | string | ✓ | Full document title |
| `documentType` | enum | ✓ | One of: `ENGINEERING_SPEC`, `VALVE_ACTUATOR_SPEC`, `APPROVED_VENDOR_LIST`, `SUBSTITUTION_PROCEDURE`, `READINESS_PROCEDURE`, `PROCUREMENT_POLICY`, `LOGISTICS_PROCEDURE`, `SUPPLIER_AGREEMENT` |
| `revision` | string | ✓ | Document revision identifier (e.g. `Rev 14`, `v3.2`) |
| `effectiveDate` | ISO-8601 date | ✓ | Date from which this revision is authoritative |
| `supersededDate` | ISO-8601 date | — | Date when this revision was superseded; absent if current |
| `sourceSystem` | string | ✓ | Origin system identifier (e.g. `EDMS`, `SAP-MM`, `SYNTHETIC-DEMO`) |
| `classification` | enum | ✓ | `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED` (synthetic demo uses `INTERNAL`) |
| `facility` | string | ✓ | Facility or asset scope (e.g. `PEARL-GTL`, `ALL`) |
| `equipmentClass` | string | — | Equipment classification code relevant to this document |
| `materialIds` | string[] | — | SAP material numbers this document governs |
| `manufacturer` | string | — | Manufacturer name where document is manufacturer-specific |
| `approvedStatus` | enum | ✓ | `APPROVED`, `SUPERSEDED`, `DRAFT`, `WITHDRAWN` |
| `content` | string | ✓ | Full text content of the document (pre-chunked before indexing) |
| `checksum` | string | ✓ | SHA-256 of content at indexing time; used to detect accidental modification |

### 4.2 Chunk Record

Each document is split into overlapping chunks before indexing. Every chunk MUST carry:

| Field | Type | Description |
|---|---|---|
| `chunkId` | string | Unique chunk identifier: `{documentId}:chunk:{n}` |
| `documentId` | string | Parent document reference |
| `sectionHeading` | string | Heading of the section this chunk was drawn from |
| `pageOrSection` | string | Page number or section reference for citation |
| `text` | string | Chunk text (250–512 tokens) |
| `embedding` | float[] | Dense vector from embedding model (1536 dimensions) |
| `revision` | string | Inherited from parent document |
| `effectiveDate` | ISO-8601 date | Inherited from parent document |
| `approvedStatus` | string | Inherited from parent document |
| `documentType` | string | Inherited from parent document |
| `facility` | string | Inherited from parent document |
| `materialIds` | string[] | Inherited from parent document |

---

## 5. Index Definitions

### 5.1 `enterprise-knowledge-v1`

Primary retrieval index. Contains all chunk records with both dense vector and BM25 fields.

```json
{
  "mappings": {
    "properties": {
      "chunkId":        { "type": "keyword" },
      "documentId":     { "type": "keyword" },
      "sectionHeading": { "type": "text" },
      "pageOrSection":  { "type": "keyword" },
      "text":           { "type": "text", "analyzer": "english" },
      "embedding":      { "type": "knn_vector", "dimension": 1536 },
      "revision":       { "type": "keyword" },
      "effectiveDate":  { "type": "date" },
      "approvedStatus": { "type": "keyword" },
      "documentType":   { "type": "keyword" },
      "facility":       { "type": "keyword" },
      "materialIds":    { "type": "keyword" }
    }
  },
  "settings": {
    "index.knn": true,
    "default_pipeline": "embedding-ingest-v1"
  }
}
```

### 5.2 `rag-query-audit-v1`

Append-only audit index. Every RAG query is logged here for evaluation and compliance.

| Field | Type | Description |
|---|---|---|
| `queryId` | keyword | Unique query identifier (UUID) |
| `correlationId` | keyword | Propagated from agent tool call |
| `riskId` | keyword | Risk context if called during investigation |
| `queryText` | text | Original query string |
| `appliedFilters` | object | Metadata filters applied to retrieval |
| `retrievedChunkIds` | keyword[] | Top-k chunks returned |
| `grounded` | boolean | Final grounding determination |
| `confidence` | float | Confidence score 0.0–1.0 |
| `timestamp` | date | Query execution timestamp |
| `fallbackMode` | boolean | `true` if in-memory fallback was used |

---

## 6. Retrieval Pipeline

The retrieval pipeline executes exactly 7 steps for every query:

| Step | Name | Description |
|---|---|---|
| 1 | **Intent Parsing** | Extract query intent class (identifier lookup / policy query / substitution check / compatibility check) and named entities (material IDs, document types, facility) |
| 2 | **Mandatory Filter Resolution** | Build the OpenSearch `filter` clause: `approvedStatus = APPROVED`, `effectiveDate <= today`, `supersededDate` absent or in future |
| 3 | **Exact Identifier Search** | If material ID, document ID, or part number is present in the query, execute a `term` / `match_phrase` search first; if exact match found with high score, skip hybrid step |
| 4 | **BM25 Lexical Retrieval** | Execute `multi_match` query on `text` and `sectionHeading` fields; retrieve top-20 candidates |
| 5 | **Semantic Vector Retrieval** | Embed query using the same embedding model used at index time; execute `knn` search; retrieve top-20 candidates |
| 6 | **Rank Fusion** | Merge BM25 and kNN result lists using Reciprocal Rank Fusion (RRF); normalize scores to 0–1; apply optional cross-encoder reranker if `RERANKER_ENABLED=true` |
| 7 | **Result Ranking & Curation** | Sort by fused score; prefer current revisions over superseded; prefer documents with higher specificity (materialIds match > facility match > general); return top-k (default 5) |

---

## 7. Hybrid Search Implementation

### 7.1 BM25 Configuration

```json
{
  "query": {
    "bool": {
      "must": {
        "multi_match": {
          "query": "{queryText}",
          "fields": ["text^2", "sectionHeading^3"],
          "type": "best_fields"
        }
      },
      "filter": [
        { "term": { "approvedStatus": "APPROVED" } },
        { "range": { "effectiveDate": { "lte": "now" } } }
      ]
    }
  }
}
```

### 7.2 Semantic (kNN) Configuration

```json
{
  "query": {
    "knn": {
      "embedding": {
        "vector": [/* query embedding */],
        "k": 20,
        "filter": {
          "bool": {
            "must": [
              { "term": { "approvedStatus": "APPROVED" } }
            ]
          }
        }
      }
    }
  }
}
```

### 7.3 Metadata Pre-Filtering

Before executing hybrid search, the pipeline builds a mandatory filter from query entities:

| Entity Present | Filter Applied |
|---|---|
| `materialId` in query | `materialIds` contains that ID |
| `documentType` inferred | `documentType` equals inferred type |
| `facility` mentioned | `facility` equals mentioned facility or `ALL` |
| Substitution query | Include `SUBSTITUTION_PROCEDURE`, `ENGINEERING_SPEC`, `APPROVED_VENDOR_LIST` |
| Policy query | Include `PROCUREMENT_POLICY`, `READINESS_PROCEDURE`, `LOGISTICS_PROCEDURE` |

---

## 8. Grounding Rules

The following rules are applied in order after retrieval. If any rule produces `grounded: false`, the answer MUST reflect that evidence is insufficient.

| Rule | Condition | Outcome |
|---|---|---|
| **GR-01 Substitution Evidence** | Query involves material substitution or alternate part compatibility | MUST return at least one chunk from an `APPROVED` `SUBSTITUTION_PROCEDURE` or `ENGINEERING_SPEC`; if absent → `grounded: false`, answer must state "Insufficient evidence — engineering approval required" |
| **GR-02 Supplier Approval Claim** | Query involves whether a supplier is approved | MUST return at least one chunk from an `APPROVED` `APPROVED_VENDOR_LIST`; if absent → `grounded: false` |
| **GR-03 Conflict Detection** | Two retrieved chunks from APPROVED sources make contradictory claims | Do not resolve silently; return `grounded: false`, include both conflicting evidence items, recommend engineering/procurement review |
| **GR-04 Superseded Content** | Any retrieved chunk has `approvedStatus = SUPERSEDED` | Exclude from primary evidence set; may include with `superseded: true` flag if no current source exists; flag answer as `grounded: false` if only superseded evidence found |
| **GR-05 Structured vs Retrieved Distinction** | Answer combines structured data (inventory counts, ETA) with retrieved policy/engineering evidence | Answer MUST clearly distinguish structured facts (from tool data) from retrieved evidence (from documents); different evidence types MUST be separately cited |

---

## 9. RAG Response Contract

Every call to `retrieve_enterprise_knowledge` returns the following structure:

```json
{
  "answer": "string — synthesised answer text",
  "grounded": true,
  "confidence": 0.87,
  "evidence": [
    {
      "evidenceId": "DOC-ENG-001:chunk:3",
      "documentId": "DOC-ENG-001",
      "title": "Catalytic Charge Valve CVA-8842 Engineering Specification",
      "revision": "Rev 7",
      "section": "Section 4.2 — Material Specification",
      "excerpt": "Approved substitution materials limited to 316L SS and Hastelloy C276...",
      "relevanceScore": 0.91,
      "retrievalMethod": "hybrid"
    }
  ],
  "appliedFilters": {
    "approvedStatus": "APPROVED",
    "materialIds": ["CVA-8842"],
    "fallback_mode": false
  },
  "queryId": "q-3f8a2b1c-9d4e-4f2b-a1c3-..."
}
```

| Field | Type | Description |
|---|---|---|
| `answer` | string | Natural-language synthesis of retrieved evidence |
| `grounded` | boolean | `true` if at least one approved evidence item supports every claim |
| `confidence` | float 0–1 | Aggregate relevance confidence; driven by top-chunk scores |
| `evidence[]` | array | All evidence items returned (ordered by relevance score descending) |
| `evidence[].evidenceId` | string | Unique chunk reference |
| `evidence[].documentId` | string | Parent document ID |
| `evidence[].title` | string | Document title |
| `evidence[].revision` | string | Document revision at time of retrieval |
| `evidence[].section` | string | Section or page reference for citation |
| `evidence[].excerpt` | string | Verbatim text excerpt from the chunk |
| `evidence[].relevanceScore` | float | Fused relevance score for this chunk |
| `evidence[].retrievalMethod` | string | `bm25`, `semantic`, or `hybrid` |
| `appliedFilters` | object | All filters applied during retrieval |
| `queryId` | string | UUID for audit trail linkage |

---

## 10. Evaluation Dataset

A minimum of **30 test questions** MUST be maintained in `backend/rag/tests/eval_dataset.json` to validate retrieval quality after any corpus or pipeline change.

### 10.1 Question Categories

| Category | Count | Description | Example |
|---|---|---|---|
| Exact Identifier | 10 | Query contains a known material ID, document ID, or part number | "What materials are approved for CVA-8842?" |
| Semantic Policy | 10 | Query is natural-language; no identifier; tests policy/procedure retrieval | "What approval is needed before substituting a valve?" |
| Mixed | 5 | Combines an identifier with a policy or procedure question | "Can CVA-8842 be substituted under emergency procedure?" |
| Negative / No-Answer | 5 | Query for which no approved evidence exists in corpus | "What is the approved substitute for part ZZ-9999?" |

### 10.2 Test Record Structure

```json
{
  "questionId": "Q-001",
  "category": "EXACT_IDENTIFIER",
  "question": "What materials are approved for the CVA-8842 valve?",
  "expected_documents": ["DOC-ENG-001", "DOC-AVL-001"],
  "expected_grounded": true,
  "expected_no_answer": false,
  "notes": "Should cite Section 4.2 of DOC-ENG-001"
}
```

---

## 11. Evaluation Metrics

| Metric | Definition | Target |
|---|---|---|
| **Hit Rate @5** | Proportion of test questions where at least one expected document appears in the top-5 results | ≥ 0.90 |
| **Grounded Accuracy** | For grounded=true test cases: proportion where all claims in the answer are traceable to returned evidence | ≥ 0.95 |
| **Citation Correctness** | Proportion of evidence items returned where `documentId`, `revision`, and `section` are accurate | ≥ 0.98 |
| **No-Answer Precision** | Proportion of negative-category questions correctly returning `grounded: false` without a fabricated answer | = 1.00 |
| **Superseded Rejection Rate** | Proportion of queries where superseded documents are excluded from primary evidence | = 1.00 |

---

## 12. Failure Modes and Fallback Behavior

| Failure Mode | Detection | Behavior |
|---|---|---|
| **OpenSearch unavailable** | Connection timeout or 5xx on startup | Load in-memory fallback index; set `fallback_mode: true` in all responses; log `WARNING: RAG_FALLBACK_ACTIVE` |
| **Embedding model unavailable** | HTTP error calling embedding service | Disable semantic step; run BM25-only retrieval; append `retrieval_mode: "bm25_only"` to `appliedFilters` |
| **No chunks pass filters** | Result set empty after mandatory filter | Return `grounded: false`, `answer: "No approved documentation found for this query"`, `evidence: []` |
| **All results superseded** | Every chunk in result set has `approvedStatus = SUPERSEDED` | Return `grounded: false` with superseded evidence flagged; recommend document refresh |
| **Conflict detected** | Two APPROVED chunks make contradictory claims on same topic | Return `grounded: false`, include both conflicting chunks, `answer` instructs user to seek engineering review |
| **Query timeout** | Retrieval exceeds 3000ms | Return partial results if available; flag `timeout: true` in `appliedFilters`; never return a fabricated answer |

---

## 13. Business Requirements Traceability

| Requirement | Source Spec | Satisfied By |
|---|---|---|
| FR-007 Retrieve engineering/procurement/turnaround knowledge through RAG | 01_PRODUCT_REQUIREMENTS | 8-document corpus + retrieval pipeline |
| FR-008 Return evidence with each knowledge-grounded conclusion | 01_PRODUCT_REQUIREMENTS | RAGResponse `evidence[]` array |
| NFR-005 Grounding: substitution/engineering claims require retrieved evidence | 01_PRODUCT_REQUIREMENTS | Grounding Rule GR-01 |
| NFR-006 Safe failure: if evidence missing/conflicting, escalate | 01_PRODUCT_REQUIREMENTS | Grounding Rules GR-03, GR-04 + fallback behavior |
| SC-004 Engineering substitute not recommended without evidence | 01_PRODUCT_REQUIREMENTS | GR-01 forces `grounded: false` when substitution evidence absent |

---

## 14. Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-RAG-01 | All 8 synthetic documents are indexed and retrievable by document ID | Unit test: exact ID lookup for each `DOC-*` returns matching chunk |
| AC-RAG-02 | Query "substitute CVA-8842" returns `grounded: true` with evidence from `DOC-SUB-001` or `DOC-ENG-001` | Eval dataset Q-category: EXACT_IDENTIFIER |
| AC-RAG-03 | Query for non-existent part returns `grounded: false` and no fabricated answer | Eval dataset Q-category: NEGATIVE |
| AC-RAG-04 | Superseded documents are not returned as primary evidence | Eval dataset: superseded rejection rate = 1.00 |
| AC-RAG-05 | In-memory fallback activates when OpenSearch is unreachable and responses still return valid structure | Integration test: kill OpenSearch, verify `fallback_mode: true` |
| AC-RAG-06 | Audit log entry is written to `rag-query-audit-v1` for every retrieval call | Integration test: verify audit entry count matches request count |
| AC-RAG-07 | Hit rate @5 ≥ 0.90 on 30-question eval dataset | CI evaluation step |
