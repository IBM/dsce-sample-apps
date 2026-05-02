# Smart Supplier Selection Demo

An enterprise-grade AI-powered supplier intelligence platform combining IBM Watsonx Orchestrate agents, governance guardrails, RAG-based document analysis, and an interactive React dashboard for intelligent supplier selection and risk assessment.

## 🎯 Overview

This comprehensive solution enables procurement teams to make data-driven supplier decisions using natural language queries, with built-in AI safety guardrails and real-time governance monitoring. The system integrates multiple data sources including supplier performance metrics, country risk assessments, market intelligence reports, and item catalogs.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│                    (React Dashboard App)                         │
│  • Natural Language Queries  • Trusted AI Dashboard             │
│  • Real-time Data Display    • Governance Metrics               │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                     │
             ▼                                     ▼
┌────────────────────────────┐      ┌─────────────────────────────┐
│  Watson Orchestrate Agents │      │   AI Guardrails API         │
│  (intelligent-supplier-    │      │   (ai-trust)                │
│   agent)                   │      │                             │
│  • Supplier Performance    │      │  • Safety Metrics (HAP,PII) │
│  • Product Info            │      │  • Quality Evaluation       │
│  • Country Risk            │      │  • RAG Metrics              │
│  • Item Catalog            │      │  • Batch Processing         │
│  • Main Planner            │      │                             │
└────────────────────────────┘      └─────────────────────────────┘
             │
             ▼
┌────────────────────────────┐
│    RAG Service             │
│    (rag-service)           │
│                            │
│  • Document Q&A            │
│  • Market Intelligence     │
│  • Coffee Reports          │
│  • LangGraph Agent         │
└────────────────────────────┘
```

## 📦 Components

### 1. Frontend Application (`app/`)

**React-based user interface with Material-UI components**

#### Features
- **Natural Language Query Interface**: Ask questions about suppliers in plain English
- **Real-time Data Display**: Dynamic tables showing supplier information
- **AI-Generated Insights**: Contextual analysis and recommendations
- **Autocomplete Suggestions**: Pre-configured query templates
- **Trusted AI Dashboard**: 
  - Aggregate safety and quality metrics
  - Transaction history (last 100 stored in localStorage)
  - Input/Output pass/block statistics
  - Color-coded metric thresholds
  - Separate RAG and non-RAG tracking

#### Tech Stack
- React 19.2.1
- Material-UI 7.3.6
- Chart.js 4.5.1
- Axios for API communication
- React Router for navigation

#### Quick Start
```bash
cd app
npm install
npm start
```
Application runs on http://localhost:3000

#### Docker Deployment
```bash
cd app
docker build -t smart-supplier-frontend .
docker run -p 8000:80 \
  -e REACT_APP_HOST_URL="https://your-watson-host.com" \
  -e REACT_APP_ORCHESTRATION_ID="your-orchestration-id" \
  -e REACT_APP_AGENT_ID="your-agent-id" \
  -e REACT_APP_GOV_BASE_URL="https://your-governance-api.com" \
  smart-supplier-frontend
```

---

### 2. Watson Orchestrate Agents (`intelligent-supplier-agent/`)

**Backend orchestration using IBM Watsonx Orchestrate planner-style agents**

#### Agent Architecture
- **Supplier_Performance_Agent**: Reliability metrics and trade statistics
- **Product_Supplier_Info_Agent**: Supplier names, countries, delivery days
- **Country_Risk_Agent**: Country risk levels and contributing factors
- **Item_Code_Catalog_Agent**: Item codes and descriptions
- **Planner_Supply_Insights**: Main orchestrator with filtering logic

#### Data Sources
- `dataset1_product_supplier.json` - Product and supplier information
- `dataset2_country_risk.json` - Country risk assessments
- `dataset3_supplier_performance.json` - Supplier reliability metrics
- `dataset4_item_code.json` - Item catalog

#### Python Tools
- `filter_data.py` - Advanced filtering (below, above, equals, contains, etc.)
- `get_supplier_*.py` - Various supplier data retrieval functions
- `get_country_risk_levels.py` - Country risk data
- `get_item_code_catalog.py` - Item catalog access

#### Quick Start
```bash
cd intelligent-supplier-agent

# Import all tools and agents
./planner_import.sh

# Or manually:
orchestrate tools import -k python -f tools/filter_data.py -r tools/requirements.txt -p tools/
orchestrate agents import -f agents/Supplier_Performance_Agent.yaml
orchestrate agents import -f agents/Product_Supplier_Info_Agent.yaml
orchestrate agents import -f agents/Item_Code_Catalog_Agent.yaml
orchestrate agents import -f agents/Country_Risk_Agent.yaml
orchestrate agents import -f agents/Planner_Supply_Insights.yaml
```

#### Demo Narrative
**Goal**: Find the best coffee supplier across India and Brazil

**Prompt Sequence**:
1. `Give me Coffee suppliers in India`
2. `Can you add brazil to the current table along with the delivery days`
3. `For the current suppliers, along with delivery days I want suppliers stats as new columns`
4. `From the current list can you please pick best suppliers one from each country`
5. `For this suppliers data can you please add country risk level and risk factors as new column`

#### Dashboards
- `supply_insights_dashboard_v4.html` - Latest version with Chart.js visualizations
- Embedded Watson chat interface
- Dynamic table rendering from JSON responses
- Automatic chart generation for numeric data

---

### 3. AI Guardrails API (`ai-trust/`)

**REST API for IBM watsonx.governance metrics evaluation**

#### Features
- **19 Evaluation Metrics** across 3 categories:
  - **Safety (10 metrics)**: HAP, PII, Jailbreak, Violence, Social Bias, Profanity, Harm, Unethical Behavior, Sexual Content, Evasiveness
  - **RAG (3 metrics)**: Answer Relevance, Context Relevance, Faithfulness
  - **Quality (6 metrics)**: Answer Completeness, Conciseness, Helpfulness, Narrative Quality, Action Oriented, Unsuccessful Requests

#### API Endpoints
```bash
GET  /api/health              # Health check
GET  /api/metrics             # List all available metrics
POST /api/evaluate            # Single text evaluation
POST /api/evaluate/batch      # Batch evaluation
```

#### Quick Start
```bash
cd ai-trust

# Local development
python3.11 -m venv venv
source venv/bin/activate
pip install --no-deps -r requirements.txt

# Configure environment
cp .env.template .env
# Edit .env with your credentials

# Run API
python api_server.py
```
API runs on http://localhost:8090

#### Docker Deployment
```bash
cd ai-trust
docker build -t ai-guardrails-api .
docker run -p 8080:8080 \
  -e WATSONX_APIKEY="your_key" \
  -e WXG_SERVICE_INSTANCE_ID="your_id" \
  -e WXG_PROJECT_ID="your_project" \
  ai-guardrails-api
```

#### IBM Code Engine Deployment
```bash
cd ai-trust
export WATSONX_APIKEY="your_key"
export WXG_SERVICE_INSTANCE_ID="your_id"
export WXG_PROJECT_ID="your_project"
./deploy-code-engine.sh
```

#### Example Request
```bash
curl -X POST http://localhost:8090/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "generated_text": "Based on the data, I recommend Supplier A",
    "input_text": "Which supplier should I choose?",
    "metrics": ["PII Detection", "Harm Detection", "Helpfulness"]
  }'
```

---

### 4. RAG Service (`rag-service/`)

**LangGraph-based conversational agent for document Q&A**

#### Features
- **Conversational Memory**: Multi-turn conversations with context retention
- **Document Processing**: Automatic PDF loading and chunking
- **Vector Search**: FAISS-based semantic search
- **IBM watsonx.ai Integration**:
  - LLM: meta-llama/llama-3-1-70b-instruct
  - Embeddings: ibm/slate.125m.english.rtrvr
- **Customer Service Persona**: Friendly, helpful responses
- **Source Attribution**: Answers reference source documents

#### Documents
- Coffee market reports (Brazil focus)
- `Coffee-Semi-Annual-Brasilia-Brazil-BR2025-0048.pdf`

#### Quick Start
```bash
cd rag-service

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with watsonx.ai credentials

# Interactive mode
python main.py

# Single query mode
python main.py "What are the coffee market trends in Brazil?"
```

#### Example Conversation
```
You: I'm trying to understand the Brazil coffee market

Agent: I'd be happy to help you understand the Brazilian coffee market!
Brazil is the world's largest coffee producer and exporter...

You: What are the main challenges?

Agent: Based on the report, there are several key challenges facing
Brazilian coffee producers...
```

#### Configuration
```bash
# .env file
WATSONX_APIKEY=your-watsonx-api-key
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your-project-id
WATSONX_LLM_MODEL=meta-llama/llama-3-1-70b-instruct
WATSONX_EMBEDDING_MODEL=ibm/slate.125m.english.rtrvr
REPORT_DOC=docs/Coffee-Semi-Annual-Brasilia-Brazil-BR2025-0048.pdf
```

---

## 🔐 Environment Variables

### Frontend (`app/`)
```bash
REACT_APP_HOST_URL=https://your-watson-orchestrate-host.com
REACT_APP_ORCHESTRATION_ID=your-orchestration-id
REACT_APP_AGENT_ID=your-agent-id
REACT_APP_GOV_BASE_URL=https://your-governance-api-url.com
```

### Guardrails API (`ai-trust/`)
```bash
WATSONX_APIKEY=your-ibm-cloud-api-key
WXG_SERVICE_INSTANCE_ID=your-governance-service-id
WXG_PROJECT_ID=your-governance-project-id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
SERVICE_PORT=8090
DEBUG_MODE=False
```

### RAG Service (`rag-service/`)
```bash
WATSONX_APIKEY=your-watsonx-api-key
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your-project-id
WATSONX_LLM_MODEL=meta-llama/llama-3-1-70b-instruct
WATSONX_EMBEDDING_MODEL=ibm/slate.125m.english.rtrvr
REPORT_DOC=docs/Coffee-Semi-Annual-Brasilia-Brazil-BR2025-0048.pdf
```

---

## 📊 Governance Metrics & Thresholds

### Safety Guardrails (Lower scores = safer)
| Metric | Description | Green | Orange | Red |
|--------|-------------|-------|--------|-----|
| HAP | Hate, Abuse, Profanity | < 0.3 | 0.3-0.6 | ≥ 0.6 |
| PII | Personal Identifiable Information | < 0.3 | 0.3-0.6 | ≥ 0.6 |
| Jailbreak | Prompt manipulation attempts | < 0.3 | 0.3-0.6 | ≥ 0.6 |
| Social Bias | Bias detection | < 0.3 | 0.3-0.6 | ≥ 0.6 |

### Response Quality (Higher scores = better)
| Metric | Description | Green | Orange | Red |
|--------|-------------|-------|--------|-----|
| Narrative Quality | Quality of response narrative | ≥ 0.7 | 0.4-0.7 | < 0.4 |
| Conciseness | Response brevity and clarity | ≥ 0.7 | 0.4-0.7 | < 0.4 |
| Helpfulness | How helpful the response is | ≥ 0.7 | 0.4-0.7 | < 0.4 |

### RAG Quality (Higher scores = better)
| Metric | Description |
|--------|-------------|
| Answer Relevance | How relevant the answer is to the question |
| Faithfulness | How faithful the response is to source context |
| Context Relevance | How relevant the retrieved context is |

---

## 🚀 Complete Deployment Guide

### Local Development (All Components)

```bash
# Terminal 1: Frontend
cd app
npm install
npm start
# Runs on http://localhost:3000

# Terminal 2: Guardrails API
cd ai-trust
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python api_server.py
# Runs on http://localhost:8090

# Terminal 3: RAG Service
cd rag-service
pip install -r requirements.txt
python main.py
# Interactive mode

# Terminal 4: Import Watson Agents
cd intelligent-supplier-agent
./planner_import.sh
```

### Docker Deployment (All Components)

```bash
# Build all images
docker build -t supplier-frontend ./app
docker build -t guardrails-api ./ai-trust

# Run with docker-compose (create docker-compose.yml)
docker-compose up -d
```

### IBM Code Engine Deployment

Each component has its own deployment script:
- `app/`: Use Dockerfile with nginx
- `ai-trust/deploy-code-engine.sh`: Automated deployment
- `rag-service/deploy.sh`: RAG service deployment

---

## 📁 Project Structure

```
smart-supplier-selection-demo/
├── README.md                          # This file
├── app/                               # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── home.jsx              # Main query interface
│   │   │   ├── dashboard.jsx         # Trusted AI Dashboard
│   │   │   └── transactions.json     # Sample data
│   │   ├── styles/
│   │   └── static/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
├── intelligent-supplier-agent/        # Watson Orchestrate Agents
│   ├── agents/                        # Agent YAML definitions
│   │   ├── Planner_Supply_Insights.yaml
│   │   ├── Supplier_Performance_Agent.yaml
│   │   ├── Product_Supplier_Info_Agent.yaml
│   │   ├── Country_Risk_Agent.yaml
│   │   └── Item_Code_Catalog_Agent.yaml
│   ├── tools/                         # Python tools
│   │   ├── filter_data.py
│   │   ├── get_*.py                   # Various data retrieval tools
│   │   └── data/                      # JSON datasets
│   ├── supply_insights_dashboard_v4.html
│   ├── planner_import.sh
│   └── Planner_README.md
├── ai-trust/                          # AI Guardrails API
│   ├── api_server.py                  # Flask REST API
│   ├── app.py                         # Metrics definitions
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── deploy-code-engine.sh
│   ├── .env.template
│   ├── DEPLOYMENT.md
│   ├── API_TESTING.md
│   └── README.md
└── rag-service/                       # RAG Document Q&A
    ├── agent.py                       # LangGraph agent
    ├── document_loader.py             # Document processing
    ├── main.py                        # CLI interface
    ├── requirements.txt
    ├── Dockerfile
    ├── docs/                          # PDF documents
    │   └── Coffee-Semi-Annual-Brasilia-Brazil-BR2025-0048.pdf
    └── README.md
```

---

## 🎓 Use Cases

### 1. Supplier Risk Assessment
Query suppliers by country, evaluate risk levels, and get recommendations based on reliability scores and delivery performance.

### 2. Market Intelligence
Use the RAG service to query coffee market reports and get insights on trends, challenges, and opportunities.

### 3. Compliance & Governance
Monitor all AI interactions through the Trusted AI Dashboard, ensuring responses meet safety and quality standards.

### 4. Multi-criteria Decision Making
Combine supplier performance, country risk, delivery times, and market intelligence to make informed procurement decisions.

---

## 🔧 Troubleshooting

### Frontend Issues
```bash
# Clear cache and reinstall
cd app
rm -rf node_modules package-lock.json
npm install
npm start
```

### API Connection Issues
- Verify environment variables are set correctly
- Check API endpoints are accessible
- Review CORS settings if running locally

### Watson Orchestrate Issues
```bash
# Re-authenticate
orchestrate login

# Verify agents are imported
orchestrate agents list

# Check tool status
orchestrate tools list
```

### RAG Service Issues
- Ensure PDF documents are in `docs/` directory
- Verify watsonx.ai credentials
- Check model availability in your region

---

## 📚 Additional Documentation

- **[intelligent-supplier-agent/Planner_README.md](intelligent-supplier-agent/Planner_README.md)** - Watson Orchestrate agent details
- **[ai-trust/README.md](ai-trust/README.md)** - Guardrails API documentation
- **[ai-trust/DEPLOYMENT.md](ai-trust/DEPLOYMENT.md)** - Complete deployment guide
- **[ai-trust/API_TESTING.md](ai-trust/API_TESTING.md)** - API testing examples
- **[rag-service/README.md](rag-service/README.md)** - RAG service documentation

---

## 🤝 Contributing

Each component can be developed and deployed independently. Follow the README in each subdirectory for component-specific development guidelines.

---

## 📄 License

IBM Internal Use - Build Labs DSCE

---

## 🆘 Support

For issues or questions:
1. Check component-specific README files
2. Review troubleshooting sections
3. Verify environment variables and credentials
4. Check IBM Cloud service status

---

**Built with IBM watsonx.ai, watsonx.governance, and watsonx Orchestrate**
