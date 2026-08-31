# Sample PDF Runbooks and Incidents

This directory contains sample PDF files for the unstructured data demo. These PDFs simulate real-world operational documentation that would be loaded into Astra DB for semantic search.

## Files

### Runbooks (Operational Procedures)
- **rb-1_runbook_PLATINUM_delay_handling.pdf** - Procedures for handling PLATINUM customer delays
- **rb-2_runbook_SKU-881_known_issues.pdf** - Known issues and solutions for SKU-881
- **rb-3_runbook_PREMIUM_SLA_summary.pdf** - PREMIUM SLA policies and compensation rules
- **rb-4_runbook_Warehouse_reroute.pdf** - Procedures for warehouse rerouting

### Incidents (Historical Cases)
- **inc-1_incident_Past_incident_SKU-881_WH-BER.pdf** - Past incident: SKU-881 backorder at WH-BER
- **inc-2_incident_Past_incident_SKU-881_shortage.pdf** - Past incident: SKU-881 shortage resolution

## How These PDFs Were Created

The PDFs were generated from the YAML source using the `create_sample_pdfs.py` script:

```bash
cd demo/scripts
python3 create_sample_pdfs.py
```

This script:
1. Reads the runbook content from `demo/runbooks/runbooks.yaml`
2. Creates professionally formatted PDF documents
3. Saves them to this directory

## Loading PDFs into Astra DB

To load these PDFs into Astra DB for vector search:

```bash
cd demo/scripts
python3 load_pdfs_to_astra.py
```

This script:
1. Extracts text from each PDF using PyPDF2
2. Generates embeddings using sentence-transformers
3. Stores documents in Astra DB with vector embeddings
4. Enables semantic search via the MCP server

## File Naming Convention

PDFs follow this naming pattern:
```
{id}_{source}_{title}.pdf
```

Where:
- **id**: Unique identifier (e.g., rb-1, inc-1)
- **source**: Document type (runbook or incident)
- **title**: Descriptive title with underscores

## Why PDFs Instead of YAML?

Using PDFs provides a more realistic demo scenario:

1. **Real-world Format**: PDFs are commonly used for operational documentation
2. **Text Extraction**: Demonstrates PDF parsing capabilities
3. **Unstructured Data**: Shows handling of document-based content
4. **Production-Ready**: Mirrors actual enterprise workflows

## Vector Search

Once loaded into Astra DB, these documents can be searched semantically:

```python
# Example query via MCP server
query = "PLATINUM customer delay handling"
results = vector_search(query, top_k=3)
```

The MCP server's `vector_search` tool will:
1. Generate embedding for the query
2. Find similar documents using cosine similarity
3. Return relevant runbooks and incidents
4. Combine with structured data (Iceberg) for comprehensive answers

## Demo Scenario

**User Question**: "Why is order O-10452 delayed, and what should we do?"

**Bob's Response** (combining structured + unstructured data):
1. **From Iceberg**: Order O-10452, Customer C-9001 (PLATINUM), SKU-881 stockout at WH-BER
2. **From Astra DB PDFs**: 
   - rb-1: Escalate within 2h, proactive call
   - rb-3: 10% credit for 24-72h delay
   - inc-2: Past case - rerouted from WH-FRA
3. **Recommendation**: Reroute from WH-FRA (15 units available), apply 10% credit

## Maintenance

To update the PDFs:
1. Edit `demo/runbooks/runbooks.yaml`
2. Run `python3 create_sample_pdfs.py`
3. Run `python3 load_pdfs_to_astra.py`

## Dependencies

Required Python packages (in `demo/scripts/requirements.txt`):
- `reportlab>=4.0.0` - PDF generation
- `PyPDF2>=3.0.0` - PDF text extraction
- `sentence-transformers>=2.2.0` - Embedding generation
- `astrapy>=2.0.1` - Astra DB client