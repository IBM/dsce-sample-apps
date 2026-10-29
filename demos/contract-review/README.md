# Contract Reviewer v2

AI-powered contract review solution built on **IBM watsonx Orchestrate**. Allows a contract reviewer to upload a vendor PDF, compare clauses against a standard template using vector search, view deviations with recommendations, and regenerate a corrected PDF — all through a single web interface.

---

## Architecture

```
Browser (index.html)
    │
    ├─ POST /upload          → UI Proxy → PyMuPDF → AstraDB (vendor_contract) + IBM COS
    ├─ POST /chat            → UI Proxy → injects context → WXO Agent
    ├─ GET  /template_clauses → UI Proxy → AstraDB (standard_template)
    └─ GET/POST /governance/* → UI Proxy → WXO Evaluation API (v2)

WXO Agent (contract_reviewer · react_core · groq/openai/gpt-oss-120b)
    ├─ searchClause tool  → Code Engine FastAPI → AstraDB (both doc types)
    └─ rectifyPdf tool    → Code Engine FastAPI → IBM COS (download + re-upload)
```

---

## Repository Structure

```
contract_review_v2/
├── agent/
│   ├── agent.yaml                  # WXO native agent definition + all instructions
│   ├── test_cases.json             # ADK CLI benchmark scenarios
│   └── test_cases_wxo.json         # WXO v2 evaluation test cases (5 scenarios)
│
├── scripts/
│   ├── ingest_standard_templates.py  # Ingest standard template PDF into AstraDB
│   ├── query_template.py             # Query AstraDB for template clauses
│   ├── fix_pdf_text_mismatches.py    # Fix text extraction issues in template PDF
│   ├── clause_types.yaml             # Clause type taxonomy
│   ├── requirements.txt
│   ├── .env.example
│   └── templates/
│       └── GTA.Standard-Template.pdf  # Standard contract template PDF
│
├── services/
│   ├── ui_proxy/                   # Main web application + API gateway
│   │   ├── main.py                 # FastAPI app — all endpoints
│   │   ├── index.html              # Single-page UI (contract review + governance)
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── requirements.txt
│   │   ├── .env.example
│   │   └── k8s/deployment.yaml
│   │
│   ├── search_contract_clause/     # searchClause tool — deployed to Code Engine
│   │   ├── main.py
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── requirements.txt
│   │   ├── .env.example
│   │   └── k8s/deployment.yaml
│   │
│   ├── regenerate_pdf/             # rectifyPdf tool — deployed to Code Engine
│   │   ├── main.py
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── requirements.txt
│   │   ├── .env.example
│   │   └── k8s/deployment.yaml
│   │
│   └── ingest_vendor_contract/     # Legacy ingestion tool (replaced by ui_proxy)
│       ├── tool.py
│       ├── requirements.txt
│       └── .env.example
│
├── docs/
│   ├── GTA.AGON-Contract.pdf       # Sample vendor contracts for demo
│   ├── GTA.Ebikes-Contract.pdf
│   ├── GTA.Everton-Contract.pdf
│   └── GTA.HELY-Contract.pdf
│
├── DESIGN.md                       # Full architecture and design decisions
├── .gitignore
└── README.md
```

---

## Prerequisites

| Service | Purpose |
|---|---|
| IBM watsonx Orchestrate (SaaS) | Agent orchestration + Evaluation API |
| DataStax AstraDB | Vector store — standard template + vendor contract chunks |
| IBM Cloud Object Storage | PDF storage (original + rectified) |
| IBM Code Engine | Hosts `searchClause` and `rectifyPdf` microservices |
| OpenShift | Hosts the UI Proxy container |

---

## Quick Start

### 1 — Ingest the standard template into AstraDB

```bash
cd scripts
cp .env.example .env          # fill in ASTRA_DB_* values
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ingest_standard_templates.py
```

### 2 — Deploy microservices to Code Engine

Both tool services need a `SERVICE_API_KEY` (min 24 chars) in their `.env`. Use the same value in the WXO connection that calls them (header `X-API-Key`). Generate one with `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`.

**searchClause:**
```bash
cd services/search_contract_clause
cp .env.example .env          # fill in ASTRA_DB_* and SERVICE_API_KEY
# Build and push image, then deploy to Code Engine
docker build -t icr.io/<namespace>/search-contract-clause:latest .
docker push icr.io/<namespace>/search-contract-clause:latest
ibmcloud ce application create --name search-contract-clause \
  --image icr.io/<namespace>/search-contract-clause:latest --port 8080
```

**rectifyPdf:**
```bash
cd services/regenerate_pdf
cp .env.example .env          # fill in COS_* and SERVICE_API_KEY
docker build -t icr.io/<namespace>/regenerate-pdf:latest .
docker push icr.io/<namespace>/regenerate-pdf:latest
ibmcloud ce application create --name regenerate-pdf \
  --image icr.io/<namespace>/regenerate-pdf:latest --port 8080
```

### 3 — Import the agent into WXO

```bash
cd scripts
orchestrate env activate <your-env>
.venv/bin/orchestrate agents import -f ../agent/agent.yaml
```

### 4 — Deploy the UI Proxy

```bash
cd services/ui_proxy
cp .env.example .env          # fill in WXO_*, ASTRA_DB_*, COS_*, UI_USERNAME, UI_PASSWORD
docker build -t icr.io/<namespace>/ui-proxy:latest .
docker push icr.io/<namespace>/ui-proxy:latest
ibmcloud ce application create --name ui-proxy \
  --image icr.io/<namespace>/ui-proxy:latest --port 8080
```

Open the app URL and sign in with `UI_USERNAME` / `UI_PASSWORD`. `UI_PASSWORD` is required (min 12 characters).

---

## Environment Variables

### UI Proxy (`services/ui_proxy/.env`)

| Variable | Description |
|---|---|
| `WXO_BASE_URL` | WXO instance base URL |
| `WXO_API_KEY` | IAM API key for WXO |
| `WXO_AGENT_ID` | UUID of the `contract_reviewer` native agent |
| `UI_USERNAME` | Sign-in user (default: `reviewer`) |
| `UI_PASSWORD` | Sign-in password — **required**, min 12 characters |
| `ASTRA_DB_API_ENDPOINT` | AstraDB endpoint URL |
| `ASTRA_DB_APPLICATION_TOKEN` | AstraDB application token |
| `ASTRA_DB_COLLECTION` | Collection name (default: `contract_collection`) |
| `COS_API_KEY` | IBM COS IAM API key |
| `COS_SERVICE_INSTANCE_ID` | IBM COS service instance ID |
| `COS_ENDPOINT` | IBM COS endpoint URL |
| `COS_BUCKET` | IBM COS bucket name |
| `DEFAULT_TEMPLATE_ID` | Default template (default: `GTA-STANDARD-v1.0`) |

### Tool services (`search_contract_clause`, `regenerate_pdf`)

| Variable | Description |
|---|---|
| `SERVICE_API_KEY` | Shared secret callers send in `X-API-Key` — **required**, min 24 characters |

See each service's `.env.example` for the full variable list.

---

## Security

- **UI Proxy:** every route except `/health` requires signing in at `/login` (session cookie, 8 hours). HTTP Basic auth is no longer accepted.
- **Tool services** (`search_contract_clause`, `regenerate_pdf`): every route except `/health` requires the `X-API-Key` header.
- Sessions are held in memory, so run the UI Proxy as a **single replica**; a restart signs everyone out.
- There is one shared login and no roles. Personas only change what the UI shows, not what a signed-in user can do.
- Use a long random `UI_PASSWORD` when deployed, and set HSTS on the OpenShift route.

Full details are in [`DESIGN.md`](DESIGN.md#security-model).

---

## Personas

| Persona | Role | Access |
|---|---|---|
| **David Kim** | Contract Reviewer | Contract Review tab only |
| **Kate Ross** | Data Scientist | Contract Review + Governance & Evaluation tabs |

Switch personas using the selector in the top-right corner of the UI.

---

## Governance & Evaluation

The Governance tab (visible to Kate Ross) connects to the **WXO Evaluation API v2** and provides:

- Evaluation run history with Journey Success, Tool Call Recall, Tool Call Precision, Agent Routing F1
- Per-test-case breakdown with metrics and reasoning
- Test case management (upload, create from thread, bulk delete)
- Agent runtime analytics (token usage, response time, sparkline trends)
- Trigger new evaluation runs from the UI

### Running Evaluations

Upload `agent/test_cases_wxo.json` via the **Upload Test Cases** button in the Governance tab, then click **Run Evaluation**.

### Regression Detection

The 5 test cases validate that the agent correctly calls `searchClause` with the right parameters for each clause type. A change to agent instructions that breaks tool call behaviour will surface as a failed test case — showing `tool inputs incorrect` or `missed tool calls` in the reasoning field.

---

## AstraDB Collection

- **Database:** `contract_review`
- **Collection:** `contract_collection`
- **Vectorize model:** `nvidia/nv-embedqa-e5-v5` · 1024 dims · Cosine similarity
- **Doc types:** `standard_template` (permanent) · `vendor_contract` (per session, scoped by `session_id`)

---

## Key Design Decisions

See [`DESIGN.md`](DESIGN.md) for the full architecture rationale. Key points:

- PDF ingestion happens entirely in the UI Proxy (PyMuPDF) — the WXO upload-to-S3 endpoint is not available on this SaaS instance
- All agent instructions live in `agent.yaml` under the `instructions:` key — `system_prompt.txt` is not used
- Context injection (session_id, cos_pdf_url, clause_index) is prepended as plain text to the first chat message
- The Governance tab uses undocumented WXO internal REST routes reverse-engineered from the SaaS API

---

## License

Internal IBM BuildLab asset. Not for external distribution.
