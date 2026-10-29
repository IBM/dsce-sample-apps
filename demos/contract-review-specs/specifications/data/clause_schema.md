# Clause Document Schema (AstraDB)
Used by Specs 1, 2, 3 and 4. Use exactly as shown.

**Database:** `contract_review` · **Collection:** `contract_collection`
**Vectorize:** `nvidia/nv-embedqa-e5-v5` · 1024 dimensions · Cosine similarity
**Query mode:** `$vectorize` — pass plain text; AstraDB handles embedding on insert and on query.

```json
{
  "_id":           "<auto-uuid>",
  "doc_type":      "standard_template | vendor_contract",
  "template_id":   "GTA-STANDARD-v1.0",
  "template_type": "STANDARD | null",
  "vendor_id":     "everton | null",
  "session_id":    "uuid-per-upload | null",
  "review_date":   "2025-01-19",
  "clause_type":   "fee_payment | term_renewal | termination | confidentiality | liability | security | general | other",
  "section_id":    "§3.2",
  "heading":       "Calculation and Payment of Fee",
  "text":          "The amount of the Fee shall equal three percent (3%) ...",
  "$vectorize":    "Calculation and Payment of Fee The amount of the Fee shall equal three percent (3%) ..."
}
```

| Field | Rules |
|---|---|
| `doc_type` | Isolates standard templates from vendor contracts on every query. |
| `template_id` | Ensures version-correct comparisons never mix. Pattern `^[A-Za-z0-9._-]{1,64}$`. |
| `session_id` | `uuid4` generated per vendor upload; scopes all vendor queries to one upload. `null` for templates. Pattern `^[A-Za-z0-9_-]{1,128}$`. |
| `vendor_id` | Derived from the upload filename (`GTA.Everton-Contract.pdf` → `everton`). Pattern `^[A-Za-z0-9_-]{1,64}$`. |
| `clause_type` | Classified from `data/clause_types.yaml` for templates; `"other"` for vendor uploads. |
| `section_id` | `§` + section number; sub-chunks add a letter (`§3.2a`). Fallback paragraphs: `§P1…`. |
| `$vectorize` | `heading + " " + text` — richer semantic signal than text alone. |

## Core query patterns
```python
# Standard template search
collection.find(
    filter={"doc_type": "standard_template", "template_id": "GTA-STANDARD-v1.0"},
    sort={"$vectorize": "fee payment calculation"},
    limit=3, include_similarity=True)

# Vendor contract search (session-scoped)
collection.find(
    filter={"doc_type": "vendor_contract", "session_id": "abc-123"},
    sort={"$vectorize": "fee payment calculation"},
    limit=3, include_similarity=True)

# List all template clauses (no vector sort), capped at 200
collection.find(
    filter={"doc_type": "standard_template", "template_id": "GTA-STANDARD-v1.0"},
    projection={"section_id": 1, "heading": 1, "text": 1, "clause_type": 1}, limit=200)
```
