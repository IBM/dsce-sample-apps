# FleetOps Cold-Chain Simulation Backend

A Python 3.12+ based stateful simulation backend for FleetOps cold-chain logistics with real-time monitoring, incident management, WatsonX Orchestrate integration, and configurable data persistence.

**Version:** v1.0.5  
**Last Updated:** May 11, 2026

---

## 🚀 Quick Start

```bash
# 1. Setup
cd fleetops-backend
python3.12 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Run
uvicorn app.main:app --reload --host 0.0.0.0 --port 8085

# 3. Test
curl http://localhost:8085/health
```

**API Documentation**: http://localhost:8085/docs

---

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide (Local, Docker, OpenShift, WatsonX)
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and feature changes
- **API Docs**: http://localhost:8085/docs (when running)

---

## ✨ Key Features

### Core Capabilities
- ✅ **Real-time Fleet Simulation** - 10 trucks with 10x accelerated speed
- ✅ **WatsonX Orchestrate Integration** - AI-powered decision making with 4 agents
- ✅ **Data Persistence** - JSON/Astra DB/IBM Db2 support with state restoration
- ✅ **Dynamic Weather System** - Real-time conditions affecting routes
- ✅ **Cargo Monitoring** - Temperature tracking with spoilage detection
- ✅ **Incident Management** - Automated generation and handling
- ✅ **Station Network** - 120km spacing with emergency services
- ✅ **Route Planning** - Dynamic generation with alternatives
- ✅ **REST API** - 20+ endpoints with interactive documentation

### Latest Features (v1.0.5)
- ✅ **WatsonX Orchestrate Integration** - Secure credential management via Kubernetes Secrets
- ✅ **Environment Variable Configuration** - Flexible deployment configuration
- ✅ **Enhanced Security** - Sensitive data managed through secrets

---

## 🏗️ Architecture

```
fleetops-backend/
├── app/
│   ├── main.py                    # FastAPI application
│   ├── models/                    # Pydantic data models
│   ├── services/                  # Business logic
│   │   ├── simulation_engine.py  # Core simulation (10x speed)
│   │   ├── truck_service.py      # Truck management
│   │   ├── agent_service.py      # WatsonX agent integration
│   │   └── persistence_service.py # Data persistence
│   ├── persistence/               # Persistence adapters
│   │   ├── base.py               # Abstract interface
│   │   ├── json_adapter.py       # JSON implementation
│   │   ├── astra_adapter.py      # Astra DB plugin
│   │   └── db2_adapter.py        # IBM Db2 plugin
│   ├── api/                       # API endpoints
│   │   ├── trucks.py             # Truck operations
│   │   ├── agents.py             # Agent operations
│   │   ├── persistence.py        # Data retrieval
│   │   └── admin.py              # Admin operations
│   ├── config/                    # Configuration
│   │   └── settings.py           # YAML loader
│   └── utils/                     # Utilities
├── k8s/                           # Kubernetes manifests
│   ├── deployment.yaml           # Main deployment
│   ├── configmap.yaml            # Configuration
│   ├── service.yaml              # Service definition
│   ├── route.yaml                # OpenShift route
│   ├── pvc.yaml                  # Persistent volume claim
│   └── watsonx-secret.yaml       # WatsonX credentials template
├── config.yaml                    # Configuration file
├── data/                          # Persistence storage
├── Dockerfile                     # Multi-stage Docker build
├── build-and-push.sh             # Build automation script
└── requirements.txt              # Python dependencies
```

---

## ⚙️ Configuration

### Basic Configuration (config.yaml)

```yaml
persistence:
  enabled: true
  type: json  # json | astra | db2
  levels:
    initial_data: true
    on_events: true
    interval_seconds: 30

simulation:
  speed_multiplier: 10    # 10x faster
  update_interval: 5      # Update every 5 seconds
  num_trucks: 10
  incident_trucks: 4
  station_spacing_km: 120

watsonx_orchestrate:
  enabled: true
  url: ""  # Set via WATSONX_ORCHESTRATE_URL env var
  api_key: ""  # Set via WATSONX_ORCHESTRATE_API_KEY env var
  agent_weather: ""  # Set via env var
  agent_station: ""  # Set via env var
  agent_route: ""  # Set via env var
  agent_decision: ""  # Set via env var
  timeout: 120
```

### Environment Variables

For production deployments, sensitive configuration is managed via environment variables:

```bash
# WatsonX Orchestrate Configuration
WATSONX_ORCHESTRATE_URL=https://api.eu-gb.watson-orchestrate.cloud.ibm.com/instances/YOUR_INSTANCE
WATSONX_ORCHESTRATE_API_KEY=your_api_key
WATSONX_ORCHESTRATE_AGENT_WEATHER=weather_agent_id
WATSONX_ORCHESTRATE_AGENT_STATION=station_agent_id
WATSONX_ORCHESTRATE_AGENT_ROUTE=route_agent_id
WATSONX_ORCHESTRATE_AGENT_DECISION=decision_agent_id
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete configuration details.

---

## 🔌 API Endpoints

### Core Operations
- `GET /health` - Health check and simulation status
- `GET /api/trucks` - Get all trucks
- `GET /api/trucks/{truckId}` - Get specific truck
- `POST /api/trucks/update` - Update truck state
- `GET /api/routes/waypoints/{truckId}` - Get routes + alternatives
- `POST /api/stations/search` - Search stations with radius

### Agent Operations
- `GET /api/agents` - Get all WatsonX agents
- `GET /api/agents/{agentId}` - Get specific agent
- `POST /api/agents/{agentId}/invoke` - Invoke agent

### Persistence & Admin
- `GET /api/persistence/data` - Get all persisted data
- `GET /api/persistence/data/trucks` - Get persisted trucks
- `GET /api/admin/persistence-status` - Check persistence status
- `POST /api/admin/reset-persistence` - Reset persisted data

**Full API Documentation**: http://localhost:8085/docs

---

## 🚢 Deployment

### Local Development
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8085
```

### Docker
```bash
docker build -t fleetops-backend:v1.0.5 .
docker run -p 8085:8085 fleetops-backend:v1.0.5
```

### OpenShift
```bash
# Build and push
./build-and-push.sh v1.0.5

# Deploy
oc apply -f k8s/
```

**Complete deployment instructions**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🧪 Testing

```bash
# Health check
curl http://localhost:8085/health

# Get all trucks
curl http://localhost:8085/api/trucks | jq '.'

# Get specific truck
curl http://localhost:8085/api/trucks/TRUCK-001 | jq '.'

# Check WatsonX agents
curl http://localhost:8085/api/agents | jq '.'
```

---

## 📦 Dependencies

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
python-dateutil==2.8.2
APScheduler==3.10.4
geopy==2.4.1
httpx==0.27.0
pyyaml>=6.0
```

---

## 🔧 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
lsof -i :8085
kill -9 <PID>
```

**Persistence Not Working**
1. Check `config.yaml` - ensure `persistence.enabled: true`
2. Check file permissions on `./data` directory
3. Check logs for persistence errors

**WatsonX Connection Failed**
1. Verify credentials in Kubernetes Secret
2. Check environment variables are set
3. Verify URL is accessible from pod

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting.

---

## 📖 Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### Recent Versions
- **v1.0.5** (2026-05-11) - WatsonX Orchestrate integration with Kubernetes Secrets
- **v1.0.4** (2026-05-07) - Temperature bounds fix, route completion fix, trip restart feature
- **v1.0.3** (2026-05-04) - Path resolution fix for OpenShift
- **v1.0.2** (2026-05-03) - OpenShift deployment support
- **v1.0.1** (2026-05-02) - Data persistence system
- **v1.0.0** (2026-05-01) - Initial release

---

## ✅ Production Ready

- ✅ WatsonX Orchestrate integration
- ✅ Kubernetes Secret management
- ✅ Persistence system architecture
- ✅ OpenShift deployment support
- ✅ Multi-stage Docker build
- ✅ Health checks and probes
- ✅ Resource limits configured
- ✅ API documentation
- ✅ Comprehensive testing

---

## 🤝 Support

For deployment issues, see [DEPLOYMENT.md](DEPLOYMENT.md)  
For version history, see [CHANGELOG.md](CHANGELOG.md)  
For API documentation, visit http://localhost:8085/docs

---

## 📝 License

MIT License

---

**Made with ❤️ for FleetOps Cold-Chain Logistics**