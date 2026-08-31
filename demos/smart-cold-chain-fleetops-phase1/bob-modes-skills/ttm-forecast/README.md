# Bob Configuration - TTM Forecasting

This directory contains custom Bob configurations for TTM time-series forecasting, including a specialized mode and reusable skill that work with **any time series data**.

## 📁 Directory Structure

```
.bob/
├── README.md                           # This file (master index)
├── custom_modes.yaml                   # TTM Forecasting Mode definition
└── skills/                             # Reusable skills
    └── ttm-forecasting/               # TTM forecasting skill
        ├── SKILL.md                   # Technical specification
        ├── README.md                  # Skill overview & quick start
        └── sample_data/               # Sample datasets
            ├── README.md              # Navigator to scenarios
            ├── scenarios/             # Ready-to-use scenarios
            │   ├── README.md          # Detailed try-out guide
            │   ├── stock_price_scenario.json
            │   ├── website_traffic_scenario.json
            │   ├── sales_scenario.json
            │   ├── iot_sensor_scenario.json
            │   └── custom_template.json
            ├── temperature_series.json (legacy)
            ├── demand_series.json     (legacy)
            └── energy_series.json     (legacy)
```

## 🎯 What's Included

### 1. TTM Forecasting Mode (`custom_modes.yaml`)

**Purpose**: Generic development environment for building TTM-based forecasting services for **any domain**

**Activation**: `/mode ttm-forecast`

**Capabilities**:
- ✅ Works with any time series data (finance, IoT, retail, energy, etc.)
- ✅ Time series data preparation and validation
- ✅ IBM Granite TTM model integration (TTM-R2, TTM-512, TTM-1024)
- ✅ FastAPI service architecture
- ✅ Risk scoring algorithms
- ✅ Docker containerization
- ✅ Kubernetes/OpenShift deployment
- ✅ Multi-model support with fallbacks
- ✅ Performance optimization

**When to Use**:
- Building new forecasting services from scratch
- Any domain: finance, retail, energy, IoT, healthcare, logistics
- Need guided workflow for TTM integration
- Creating production-ready microservices

**File Restrictions**:
- Can edit: `.py`, `.yaml`, `.yml`, `.md`, `.txt`, `.json`, `.env`, `Dockerfile`

---

### 2. TTM Forecasting Skill (`skills/ttm-forecasting/`)

**Purpose**: Generic, reusable forecasting capability for **any time series data**

**Activation**: `use_skill("ttm-forecasting", {...})`

**Capabilities**:
- ✅ 96-step ahead predictions for any time series
- ✅ Risk assessment and breach detection
- ✅ Multiple frequencies (1min, 5min, 15min, 1h, 1d)
- ✅ Multi-model support (TTM-R2, TTM-512, TTM-1024)
- ✅ Confidence intervals
- ✅ Automatic fallback mechanisms
- ✅ Data quality validation

**When to Use**:
- Quick forecasting in any mode
- Any domain (finance, retail, IoT, energy, etc.)
- Building multi-agent systems
- Integrating forecasting into workflows
- Testing forecasting scenarios

**Ready-to-Try Scenarios**:
- 📈 Stock Price Forecasting (financial)
- 🌐 Website Traffic Prediction (digital)
- 🛒 Sales Forecasting (retail)
- 🔧 IoT Sensor Monitoring (industrial)
- ✏️ Custom Template (your data)

---

## 🚀 Quick Start

### Option 1: Try Pre-Built Scenarios (Fastest - 2 minutes)

```bash
# Use any ready-made scenario
/mode ttm-forecast
"Use stock_price_scenario.json to create a forecasting service"

# Or try others:
# "Use website_traffic_scenario.json..."
# "Use sales_scenario.json..."
# "Use iot_sensor_scenario.json..."
```

**All scenarios**: `.bob/skills/ttm-forecasting/sample_data/scenarios/`

### Option 2: Use TTM Mode for Custom Service

```bash
# Switch to TTM Forecasting Mode
/mode ttm-forecast

# Bob will guide you through:
# 1. Project structure setup
# 2. Data preparation
# 3. Model integration
# 4. API endpoint creation
# 5. Deployment configuration
```

### Option 3: Use TTM Skill Directly

```python
# From any mode, invoke the skill
import json

# Load any scenario
with open('.bob/skills/ttm-forecasting/sample_data/scenarios/stock_price_scenario.json') as f:
    scenario = json.load(f)

# Generate forecast
forecast = use_skill("ttm-forecasting", {
    "historical_data": scenario["data"],
    "frequency": scenario["frequency"]
})

# Check results
print(f"Risk Score: {forecast['risk_assessment']['risk_score']}")
```

---

## 📊 Mode vs Skill Comparison

| Aspect | TTM Mode | TTM Skill |
|--------|----------|-----------|
| **Purpose** | Build complete services | Quick forecasting function |
| **Activation** | `/mode ttm-forecast` | `use_skill("ttm-forecasting")` |
| **Scope** | Full development workflow | Single forecasting operation |
| **Output** | FastAPI service + deployment | Predictions + risk assessment |
| **Time** | Hours (complete implementation) | Seconds (single forecast) |
| **Use Case** | Building new services | Using existing capability |
| **File Access** | Restricted to specific types | No file restrictions |

---

## 🔗 Reference Implementation

The mode and skill are based on a production implementation:

```
forecast-backend/
├── main.py                          # FastAPI application
├── services/
│   ├── forecasting_service.py      # Core forecasting logic
│   └── ttm_model.py                # TTM model wrapper
├── requirements.txt                # Dependencies
└── sample_energy_demand.json       # Production sample data (512 points)
```

**The skill provides reusable forecasting capability**
**The mode guides you through building similar services**

---

## 📖 Documentation Map

### Start Here
1. **This File** (`.bob/README.md`) - Master index
2. **Skill Overview** (`.bob/skills/ttm-forecasting/README.md`) - Quick start
3. **Try-Out Guide** (`.bob/skills/ttm-forecasting/sample_data/scenarios/README.md`) - Detailed examples

### Technical Details
- **Mode Spec**: `.bob/custom_modes.yaml` - Complete mode definition
- **Skill Spec**: `.bob/skills/ttm-forecasting/SKILL.md` - Technical specification
- **Sample Navigator**: `.bob/skills/ttm-forecasting/sample_data/README.md` - Data directory guide

---

## 🎓 Learning Path

### For New Users

1. **Start with the Skill** - Understand what TTM forecasting can do
   - Read `skills/ttm-forecasting/SKILL.md`
   - Try sample data examples
   - Experiment with different parameters

2. **Explore the Mode** - Learn how to build forecasting services
   - Switch to TTM mode: `/mode ttm-forecast`
   - Follow the guided workflow
   - Study the production implementation in `forecast-backend/`

3. **Build Your Own** - Create custom forecasting services
   - Use the mode for guidance
   - Leverage the skill for quick testing
   - Adapt patterns to your use case

### For Experienced Users

1. **Use the Skill** - Quick forecasting in any workflow
2. **Reference the Mode** - Best practices and patterns
3. **Extend Both** - Add new capabilities as needed

---

## 🔧 Customization

### Adding New Modes

Edit `.bob/custom_modes.yaml`:

```yaml
customModes:
  - slug: your-mode
    name: Your Mode Name
    description: Short description
    roleDefinition: >-
      Detailed role definition...
    whenToUse: >-
      When to use this mode...
    groups:
      - read
      - edit
      - command
```

### Adding New Skills

Create new directory in `.bob/skills/`:

```
.bob/skills/your-skill/
├── SKILL.md          # Required: Skill documentation
├── README.md         # Optional: Overview
└── sample_data/      # Optional: Sample datasets
```

---

## 🌟 Generic Use Cases

### Finance & Trading
- **Mode**: Build stock price prediction service
- **Skill**: Forecast prices, volumes, forex rates
- **Scenario**: `stock_price_scenario.json`

### Digital & Web
- **Mode**: Build traffic forecasting service
- **Skill**: Predict visitors, API calls, user activity
- **Scenario**: `website_traffic_scenario.json`

### Retail & E-commerce
- **Mode**: Build demand forecasting service
- **Skill**: Predict sales, inventory needs
- **Scenario**: `sales_scenario.json`

### IoT & Industrial
- **Mode**: Build sensor monitoring service
- **Skill**: Predict equipment metrics, failures
- **Scenario**: `iot_sensor_scenario.json`

### Energy & Utilities
- **Mode**: Build consumption prediction service
- **Skill**: Forecast energy usage, peak loads
- **Scenario**: Use `custom_template.json`

### Healthcare & Science
- **Mode**: Build patient monitoring service
- **Skill**: Predict vitals, occupancy, measurements
- **Scenario**: Use `custom_template.json`

**Works with ANY time series data!**

---

## 📦 Reusability

### Project-Level (Current)
- **Location**: `.bob/` in workspace root
- **Scope**: Available only in this project
- **Best For**: Project-specific configurations

### Global Level
- **Location**: `~/.bob/`
- **Scope**: Available in all projects
- **Best For**: Reusable across multiple projects

**To make global**: Copy `.bob/` contents to `~/.bob/`

---

## 🔍 What's Next?

### Immediate Actions
1. ✅ Try the TTM skill with sample data
2. ✅ Switch to TTM mode and explore
3. ✅ Review production implementation in `forecast-backend/`

### Future Enhancements
- [ ] Add more sample datasets (512+ points)
- [ ] Create additional skills (weather, risk-assessment, etc.)
- [ ] Add more specialized modes (carbon-react, agentic-workflow, etc.)
- [ ] Document integration patterns with Watson Orchestrate

---

## 📞 Support

### Documentation
- **Skill Docs**: `.bob/skills/ttm-forecasting/SKILL.md`
- **Mode Docs**: `.bob/custom_modes.yaml`
- **Production Code**: `forecast-backend/README.md`

### Resources
- [Bob Documentation](https://bob.ibm.com/docs)
- [IBM Granite TTM](https://huggingface.co/ibm-granite/granite-timeseries-ttm-r2)
- [Smart Cold Chain Architecture](./BOB_ARCHITECTURE_FLOW.md)

---

**Version**: 1.0.0  
**Created**: 2024-01-15  
**Status**: Production Ready ✅

---

## 📝 Change Log

### v1.0.0 (2024-01-15)
- ✅ Created TTM Forecasting Mode
- ✅ Created TTM Forecasting Skill
- ✅ Added sample datasets (temperature, demand, energy)
- ✅ Comprehensive documentation
- ✅ Integration with production code
