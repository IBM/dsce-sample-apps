# Specification 2: Vector Search with AstraDB `$vectorize`
The following specification defines the vector store that powers clause lookup for both the standard template and uploaded vendor contracts.

## Prerequisites
Load any skills that seem relevant — new ones may be added over time.

## Requirements to follow
* Use **DataStax AstraDB** (Data API) with the `astrapy` Python client.
* Use AstraDB **server-side embedding** (`$vectorize`). No embedding model runs in our code and no NVIDIA/watsonx.ai key is needed.
* All credentials come from `.env` (`ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`, `ASTRA_DB_COLLECTION`).
* Document shape and query patterns: [`data/clause_schema.md`](data/clause_schema.md).

## Step 1: Create the database and collection
If the collection does not exist, create it once (idempotent script or manual step documented in `scripts/docs/`):

| Setting | Value |
|---|---|
| Database | `contract_review` |
| Collection | `contract_collection` (override with `ASTRA_DB_COLLECTION`) |
| Vector dimension | 1024 |
| Similarity metric | cosine |
| Embedding provider / model | NVIDIA / `nvidia/nv-embedqa-e5-v5` (service-managed, no API key) |

## Step 2: Query behaviour
Every query MUST include a `doc_type` filter, plus either `template_id` (standard) or `session_id` (vendor):

| Query | Filter | Sort | Limit |
|---|---|---|---|
| Standard clause search | `doc_type=standard_template`, `template_id` | `$vectorize: <clause_query>` | `top_k` (1–5) |
| Vendor clause search | `doc_type=vendor_contract`, `session_id` | `$vectorize: <clause_query>` | `top_k` (1–5) |
| List template clauses | `doc_type=standard_template`, `template_id` | none | 200 |

Always request `include_similarity=True` for ranked queries and project only `section_id, heading, text, clause_type`.

## Step 3: Ranking is advisory, not authoritative
Vector rank does **not** always equal intent match (for example "payment" can rank a general clause above the fee-calculation clause). Therefore:
* Search services return the top **3** hits per side (`top_k=3`), never just one.
* The agent (Spec 6) reads **all** returned headings and selects the entry whose heading best matches the clause topic.
* Services must never merge text across entries.

## Step 4: Data lifecycle
| Data | Lifetime |
|---|---|
| `standard_template` chunks | Permanent; inserted by Spec 1. |
| `vendor_contract` chunks | One set per upload, keyed by `session_id`. Not deleted by the application (document a manual cleanup query in `scripts/docs/`). |

## Validation
* Query `payment` against `GTA-STANDARD-v1.0` with `top_k=3` and confirm a fee/payment clause is among the three results.
* Query a vendor `session_id` that does not exist and confirm an empty result (not an error).

## Cleanup
Documentation: keep it super simple and non-verbose (max 3–4 pages). Place into `scripts/docs/`.
