# SRE Copilot — Demo

A full-stack demo showcasing the **watsonx Orchestrate** AI agent analyzing IT Operations incidents in real time.

Built with React + IBM Carbon Design System, Python FastAPI, and watsonx Orchestrate ADK.

---

## Architecture

```
Browser (http://localhost)
  └── Nginx (Podman) ──┬── /api/* → FastAPI (Podman) → watsonx Orchestrate Agent
                       └── /* → React SPA (static)
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Podman | 5.x+ | [podman.io](https://podman.io) |
| Podman Compose | built-in (`podman compose`) | included with Podman 5+ |
| Node.js | 20+ | local dev only |
| Python | 3.11+ | agent deployment only |
| ibm-watsonx-orchestrate ADK | 2.16+ | `pip install ibm-watsonx-orchestrate` |

---

## Quick Start

### Step 1 — Configure Environment

```bash
cp .env.example .env
# Edit .env — fill in WXO_API_KEY, WXO_INSTANCE_URL
```

### Step 2 — Deploy the Agent (run once)

```bash
pip install ibm-watsonx-orchestrate

# Register your WXO environment (first time only)
orchestrate env add --name incident_demo_env --url <WXO_INSTANCE_URL>

# Deploy agent + tools to watsonx Orchestrate
cd agent
chmod +x deploy.sh teardown.sh
./deploy.sh
cd ..
```

Verify: `orchestrate agents list` — you should see `incident_resolution_agent`.

### Step 3 — Start the Demo Stack

```bash
# From project root — builds and starts frontend + backend containers
/opt/homebrew/bin/podman compose up --build
```

Open **http://localhost:3000** in your browser.

> **Tip:** If `podman` is on your PATH, you can use `podman compose up --build` directly.

---

## Local Development (no containers)

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate        # Python 3.11 venv (created during setup)
uvicorn main:app --reload --port 8765

# Terminal 2 — Frontend
cd frontend
npm run dev                       # Vite dev server → http://localhost:3131
```

---

## Stopping the Stack

```bash
# Stop and remove containers
/opt/homebrew/bin/podman compose down

# Stop + remove images (full cleanup)
/opt/homebrew/bin/podman compose down --rmi all
```

---

## Teardown Agent

```bash
cd agent && ./teardown.sh
```

---

## Project Structure

```
├── frontend/          # React + IBM Carbon UI
│   ├── src/
│   ├── nginx.conf     # Nginx reverse proxy config
│   └── Dockerfile
├── backend/           # FastAPI + WXO SDK
│   ├── data/          # Incident seed data + templates
│   ├── services/      # WXO agent client
│   └── Dockerfile
├── agent/             # WXO agent YAML + Python tools
│   ├── tools/
│   ├── agent.yaml
│   ├── deploy.sh
│   └── teardown.sh
├── docker-compose.yml # Podman Compose deployment
├── .env.example       # Environment variable template
└── README.md
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `WXO_API_KEY` | watsonx Orchestrate API key | `FPZX...` |
| `WXO_INSTANCE_URL` | WXO instance URL | `https://api.us-south...` |
| `WXO_ENV_NAME` | ADK environment name | `incident_demo_env` |
| `AGENT_NAME` | Deployed agent name | `incident_resolution_agent` |
