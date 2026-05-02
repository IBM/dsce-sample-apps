# AI Guardrails API - Demo 101

REST API for IBM watsonx.governance guardrail metrics evaluation.

## 🚀 Quick Start

### Local Development
```bash
# 1. Install dependencies
python3.11 -m venv venv
source venv/bin/activate
pip install --no-deps -r requirements.txt

# 2. Configure environment
cp .env.template .env
# Edit .env with your credentials

# 3. Run the API
python api_server.py
```

API will be available at http://localhost:8090

### Docker
```bash
# Build
docker build -t ai-guardrails-api .

# Run
docker run -p 8080:8080 \
  -e WATSONX_APIKEY="your_key" \
  -e WXG_SERVICE_INSTANCE_ID="your_id" \
  -e WXG_PROJECT_ID="your_project" \
  ai-guardrails-api
```

### IBM Code Engine
```bash
# Update namespace in deploy-code-engine.sh, then:
export WATSONX_APIKEY="your_key"
export WXG_SERVICE_INSTANCE_ID="your_id"
export WXG_PROJECT_ID="your_project"

./deploy-code-engine.sh
```

## 📁 Files

| File | Description |
|------|-------------|
| `api_server.py` | REST API server (Flask) |
| `app.py` | Dash application with metrics UI |
| `requirements.txt` | Python dependencies (211 packages) |
| `Dockerfile` | Container image definition |
| `.dockerignore` | Files to exclude from Docker image |
| `.env` | Environment variables (not in git) |
| `.env.template` | Environment variable template |
| `deploy-code-engine.sh` | Automated deployment script |
| `DEPLOYMENT_SUMMARY.md` | Current deployment details |
| `DEPLOYMENT.md` | Complete deployment guide |
| `API_TESTING.md` | API testing examples |
| `data-flow-diagram.md` | Architecture flow diagram (Mermaid) |
| `data-flow-diagram.png` | Architecture flow diagram (image) |

## 🔌 API Endpoints

### Health Check
```bash
GET /api/health
```

### List Metrics
```bash
GET /api/metrics
```

Returns all 19 available metrics across 3 categories:
- **Safety** (10 metrics): PII, Harm, Jailbreak, Violence, etc.
- **RAG** (3 metrics): Answer Relevance, Context Relevance, Faithfulness
- **Quality** (6 metrics): Answer Completeness, Conciseness, Helpfulness, Narrative Quality, etc.

### Evaluate Text
```bash
POST /api/evaluate
Content-Type: application/json

{
  "generated_text": "Text to evaluate",
  "input_text": "Optional question/prompt",
  "context": "Optional context",
  "metrics": ["PII Detection", "Harm Detection"]
}
```

### Batch Evaluation
```bash
POST /api/evaluate/batch
Content-Type: application/json

{
  "items": [
    {"generated_text": "Text 1"},
    {"generated_text": "Text 2"}
  ],
  "metrics": ["PII Detection"]
}
```

## 🧪 Testing

### Local Development (Port 8090)
```bash
# Health check
curl http://localhost:8090/api/health

# List metrics
curl http://localhost:8090/api/metrics | python3 -m json.tool

# Evaluate (using example file)
curl -X POST http://localhost:8090/api/evaluate \
  -H "Content-Type: application/json" \
  -d @example_request.json | python3 -m json.tool
```

### Docker (Port 8080)
```bash
# Health check
curl http://localhost:8080/api/health

# List metrics
curl http://localhost:8080/api/metrics | python3 -m json.tool

# Evaluate (using example file)
curl -X POST http://localhost:8080/api/evaluate \
  -H "Content-Type: application/json" \
  -d @example_request.json | python3 -m json.tool
```

## 📊 Available Metrics

### Safety Metrics
- HAP (Hate, Abuse, Profanity)
- PII Detection
- Harm Detection
- Social Bias
- Jailbreak Detection
- Violence Detection
- Profanity Detection
- Unethical Behavior
- Sexual Content
- Evasiveness

### RAG Metrics
- Answer Relevance
- Context Relevance
- Faithfulness

### Quality Metrics
- Answer Completeness (LLM Judge)
- Conciseness (LLM Judge)
- Helpfulness (LLM Judge)
- Narrative Quality (LLM Judge)
- Action Oriented Validator
- Unsuccessful Requests

## 🔧 Configuration

### Environment Variables
```bash
WATSONX_APIKEY=           # IBM Cloud API Key
WXG_SERVICE_INSTANCE_ID=  # watsonx.governance Service Instance ID
WXG_PROJECT_ID=           # watsonx.governance Project ID
WATSONX_URL=              # Default: https://us-south.ml.cloud.ibm.com
SERVICE_PORT=             # Default: 8090 (local), 8080 (container)
DEBUG_MODE=               # Default: False
```

## 📖 Documentation

- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - Current production deployment details
  - Live API URLs
  - Resource configuration
  - Environment variables
  - Quick commands

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
  - Prerequisites
  - Local development
  - Docker containerization
  - IBM Code Engine deployment
  - Troubleshooting

- **[API_TESTING.md](API_TESTING.md)** - API testing examples
  - cURL examples (local and production)
  - Python examples
  - JavaScript examples
  - Response formats

## 🏗️ Architecture

```
┌─────────────────┐
│   Client App    │
│  (Your System)  │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│  api_server.py  │
│   (Flask API)   │
└────────┬────────┘
         │ Imports
         ▼
┌──────────────────────┐
│ app.py │
│   (Metrics Defs)     │
└────────┬─────────────┘
         │ Uses
         ▼
┌───────────────────────┐
│ ibm_watsonx_gov SDK   │
│  (Metric Evaluation)  │
└───────────────────────┘
```

## 🐳 Docker Image Details

- **Base**: python:3.11-slim
- **Size**: ~2GB (with all dependencies)
- **Port**: 8080
- **Entrypoint**: `python api_server.py`

## ☁️ Code Engine Configuration

- **Min Scale**: 1 (always 1 instance running)
- **Max Scale**: 5 (auto-scale up to 5 instances)
- **CPU**: 1 vCPU per instance
- **Memory**: 2GB per instance
- **Port**: 8080

## 🔒 Security Notes

- Never commit `.env` file
- Use environment variables for credentials
- Rotate API keys regularly
- Use HTTPS in production (Code Engine provides this)
- Monitor API access logs

## 🆘 Troubleshooting

### API Returns Empty Results
- Check that metric names match exactly (case-sensitive)
- Verify credentials are correct
- Check logs for evaluation errors

### Docker Build Fails
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t ai-guardrails-api .
```

### Code Engine Deployment Fails
```bash
# Check logs
ibmcloud ce app logs --name guardrails-api

# Verify image exists
ibmcloud cr images --restrict your-namespace

# Check environment variables
ibmcloud ce app get --name guardrails-api
```
