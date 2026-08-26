# Orbital Suppliers — Retail Order Fulfillment Demo

A full-stack demo retail website for space-themed accessories, featuring:
- React frontend with product browsing, cart, checkout, and order history
- Node.js/Express backend with JWT authentication
- OpenSearch vector database for semantic product search
- watsonx Orchestrate agentic product recommendations

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker (for OpenSearch)
- Credentials in `.env` (see `.env_template`)

### 1. Start OpenSearch
```bash
docker run -d --name opensearch -p 9200:9200 \
  -e discovery.type=single-node \
  -e DISABLE_SECURITY_PLUGIN=true \
  opensearchproject/opensearch:2.13.0
```

### 2. Start the backend
```bash
cd backend
npm install
node index.js
# Runs on http://localhost:3001
# Swagger docs: http://localhost:3001/api-docs
```

### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 4. Embed products into OpenSearch (first run only)
```bash
cd vector-db
npm install
node embed.js
```

## Architecture

| Component | Technology | Port |
|-----------|-----------|------|
| Frontend | React + Vite | 5173 (dev) / 3000 (container) |
| Backend | Node.js + Express | 3001 |
| Database | IBM Cloud PostgreSQL | Remote |
| Vector DB | OpenSearch | 9200 |
| Agent | watsonx Orchestrate | Remote |

## Running with Docker (Rancher Desktop)
See [`rancher/docs/quickstart.md`](rancher/docs/quickstart.md)

## Test Credentials
- Email: `james.smith@email.com`
- Password: `password`

## Project Structure
```
backend/        Express API server
frontend/       React SPA
vector-db/      OpenSearch embedding script
agent/          watsonx Orchestrate agent YAML
rancher/        Docker Compose for local containers
requirements/   Technical requirements docs
specifications/ Original design specs and mockups
```
