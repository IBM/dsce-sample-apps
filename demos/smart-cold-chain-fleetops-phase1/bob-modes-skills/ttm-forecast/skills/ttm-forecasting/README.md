# TTM Time-Series Forecasting Skill

A **generic, reusable skill** for time-series forecasting using IBM Granite TTM (Tiny Time Mixer) model. Works with **any time series data** - from stock prices to IoT sensors - providing accurate 96-step ahead predictions while preserving the proven TSFM-first model-loading and inference path.

## 🎯 What Makes This Generic?

- ✅ **Any Domain**: Finance, retail, energy, IoT, healthcare, logistics
- ✅ **Any Frequency**: 1min, 5min, 15min, 1h, 1d - you choose
- ✅ **Any Data**: Just provide timestamps and values
- ✅ **Flexible Models**: TTM-R2, TTM-512, TTM-1024, statistical fallbacks
- ✅ **Production Ready**: Complete service scaffolding included
- ✅ **Preserved Loading Path**: Prefer `TimeSeriesForecastingPipeline` with `TinyTimeMixerForPrediction.from_pretrained()`

## 📁 Directory Structure

```
.bob/skills/ttm-forecasting/
├── SKILL.md                          # Main skill documentation
├── README.md                         # This file
└── sample_data/                      # Sample datasets
    ├── README.md                     # Sample data documentation
    ├── temperature_series.json       # Cold chain temperature data
    ├── demand_series.json           # Retail demand data
    └── energy_series.json           # Energy consumption data
```

## 🚀 Quick Start - Try It Now!

### Option 1: Use Pre-built Scenarios (Fastest)

We've created 5 ready-to-use scenarios for you to try:

```bash
# 1. Stock Price Forecasting
/mode ttm-forecast
"Use stock_price_scenario.json to create a forecasting service"

# 2. Website Traffic Prediction
/mode ttm-forecast
"Build a traffic forecasting API using website_traffic_scenario.json"

# 3. Sales Forecasting
/mode ttm-forecast
"Create sales prediction service with sales_scenario.json"

# 4. IoT Sensor Monitoring
/mode ttm-forecast
"Build IoT sensor forecasting with iot_sensor_scenario.json"

# 5. Your Custom Data
/mode ttm-forecast
"Use custom_template.json and replace with my data"
```

**All scenarios are in**: `.bob/skills/ttm-forecasting/sample_data/scenarios/`

### Option 2: Using the Skill Directly

The skill is automatically available once this directory exists in `.bob/skills/`. Use it with the `use_skill` tool:

```python
# Basic usage
result = use_skill("ttm-forecasting", {
    "historical_data": your_time_series_data,
    "frequency": "1min"
})
```

### 2. With Sample Data

```python
import json

# Load sample temperature data
with open('.bob/skills/ttm-forecasting/sample_data/temperature_series.json') as f:
    data = json.load(f)

# Generate forecast
forecast = use_skill("ttm-forecasting", {
    "historical_data": data,
    "frequency": "1min",
    "threshold": 8.0
})

# Check results
print(f"Risk Score: {forecast['risk_assessment']['risk_score']}")
print(f"Action: {forecast['risk_assessment']['action']}")
```

## 📊 Try-Out Scenarios

### Available Scenarios

| Scenario | File | Use Case | Frequency | Try It |
|----------|------|----------|-----------|--------|
| 📈 Stock Prices | `stock_price_scenario.json` | Financial trading | 1h | [Guide](sample_data/scenarios/README.md#stock-price-prediction) |
| 🌐 Web Traffic | `website_traffic_scenario.json` | Auto-scaling | 1h | [Guide](sample_data/scenarios/README.md#website-traffic-forecasting) |
| 🛒 Sales | `sales_scenario.json` | Inventory planning | 1d | [Guide](sample_data/scenarios/README.md#sales-forecasting) |
| 🔧 IoT Sensors | `iot_sensor_scenario.json` | Predictive maintenance | 5min | [Guide](sample_data/scenarios/README.md#iot-sensor-monitoring) |
| ✏️ Custom | `custom_template.json` | Your data | Any | [Guide](sample_data/scenarios/README.md#create-your-own-scenario) |

### Quick Test Commands

```bash
# Test stock price forecasting
cd .bob/skills/ttm-forecasting/sample_data/scenarios
python -c "
import json
with open('stock_price_scenario.json') as f:
    data = json.load(f)
print(f'Scenario: {data[\"scenario_name\"]}')
print(f'Data points: {len(data[\"data\"])}')
print(f'Frequency: {data[\"frequency\"]}')
"

# Use with TTM mode
/mode ttm-forecast
"Create a forecasting service using stock_price_scenario.json"
```

## 📖 Documentation

- **[SKILL.md](./SKILL.md)** - Complete skill documentation including:
  - Detailed description and capabilities
  - Input/output specifications
  - Usage examples for different scenarios
  - Technical details and requirements
  - Troubleshooting guide

- **[sample_data/README.md](./sample_data/README.md)** - Sample data documentation:
  - Available datasets
  - Data format specifications
  - Usage examples
  - How to extend datasets

## 🎯 Generic Use Cases

This skill works for **any time series forecasting** need:

### Business & Finance
- 📈 Stock prices, forex rates, crypto
- 💰 Revenue, sales, transactions
- 📊 Market trends, trading volumes

### Operations & IoT
- 🔧 Equipment sensors, temperature, pressure
- ⚡ Energy consumption, power demand
- 🏭 Production output, quality metrics

### Digital & Web
- 🌐 Website traffic, API calls
- 👥 User activity, engagement
- 📱 App usage, downloads

### Supply Chain & Logistics
- 🚚 Delivery times, fleet utilization
- 📦 Inventory levels, demand
- 🌡️ Cold chain temperature monitoring

### Healthcare & Science
- 🏥 Patient vitals, bed occupancy
- 🧪 Lab measurements, experiments
- 🌡️ Environmental monitoring

**If you have time series data, this skill can forecast it!**

## 🔧 Integration

### With TTM Forecasting Mode

This skill works seamlessly with the TTM Forecasting Mode (`.bob/custom_modes.yaml`):

```bash
# Switch to TTM mode for building forecasting services
/mode ttm-forecast

# The mode will guide you through:
# 1. Service architecture
# 2. API endpoint creation
# 3. Model integration
# 4. Deployment configuration
```

### With Existing Implementation

The skill leverages your existing TTM implementation in `forecast-backend/`:

```
forecast-backend/
├── services/
│   ├── forecasting_service.py    # Core logic
│   └── ttm_model.py              # TTM wrapper
└── main.py                       # FastAPI endpoints
```

## 📊 Sample Data

Three ready-to-use datasets are included:

| Dataset | Frequency | Use Case | Points |
|---------|-----------|----------|--------|
| `temperature_series.json` | 1min | Cold chain | 20 |
| `demand_series.json` | 1h | Retail | 20 |
| `energy_series.json` | 15min | Utilities | 20 |

**Note**: Sample data contains 20 points for demonstration. Production use requires minimum 512 points.

## 🎨 How to Use Your Own Data

### Step 1: Prepare Your Data

Your data just needs two fields:
```json
[
  {"timestamp": "2024-01-01T00:00:00Z", "value": 123.45},
  {"timestamp": "2024-01-01T01:00:00Z", "value": 125.67}
]
```

### Step 2: Choose Your Approach

**Option A: Use Custom Template**
```bash
# Copy template
cp .bob/skills/ttm-forecasting/sample_data/scenarios/custom_template.json my_data.json

# Edit my_data.json with your data
# Update: scenario_name, frequency, unit, data array

# Use it
/mode ttm-forecast
"Create forecasting service using my_data.json"
```

**Option B: Direct Skill Usage**
```python
my_time_series = [
    {"timestamp": "2024-01-01T00:00:00Z", "value": 100},
    # ... your 512+ data points
]

forecast = use_skill("ttm-forecasting", {
    "historical_data": my_time_series,
    "frequency": "1h"  # or 1min, 5min, 15min, 1d
})
```

### Step 3: Get Predictions

```python
# Access predictions
for pred in forecast["predictions"]:
    print(f"{pred['timestamp']}: {pred['value']}")

# Check risk assessment
risk = forecast["risk_assessment"]
print(f"Risk Score: {risk['risk_score']}")
print(f"Action: {risk['action']}")
```

## 🔍 How It Works

1. **Input**: Historical time series data (minimum 512 points)
2. **Processing**: IBM Granite TTM model analyzes patterns
3. **Output**: 96-step ahead predictions with risk assessment
4. **Fallback**: Statistical methods if model unavailable

### Preferred Loading and Inference Path

Preserve this implementation pattern when building or debugging Granite TTM services:

1. Load config with `AutoConfig.from_pretrained()` using `trust_remote_code=True`
2. Load the model with `TinyTimeMixerForPrediction.from_pretrained()`
3. Build `TimeSeriesForecastingPipeline` with explicit `timestamp_column`, `target_columns`, and `freq`
4. Run inference by calling the pipeline directly
5. Normalize DataFrame, dict, nested list, tuple, or ndarray-like outputs into a strict 1-D float array
6. Sanitize `NaN` and `Inf` values before arithmetic, risk scoring, or JSON serialization
7. Validate that the final prediction length matches the requested horizon

This is the preferred path because it preserves the working Granite TTM integration and avoids repeating prior model-loading and output-shape debugging.

### Model Details

- **Model**: `ibm-granite/granite-timeseries-ttm-r2`
- **Context Window**: 512 time steps
- **Prediction Horizon**: 96 time steps
- **Inference Time**: ~2-3 seconds
- **Device Support**: CPU and CUDA

## 📝 Example Workflows

### Workflow 1: Temperature Breach Detection

```python
# 1. Load historical data
truck_temps = get_temperature_history("TRUCK-001", hours=8)

# 2. Generate forecast
forecast = use_skill("ttm-forecasting", {
    "historical_data": truck_temps,
    "threshold": -20.0,
    "frequency": "1min"
})

# 3. Assess risk
risk = forecast["risk_assessment"]
if risk["risk_score"] > 70:
    alert_driver("CRITICAL: Breach in " + str(risk["time_to_breach"]) + " min")
    reroute_to_nearest_station()
```

### Workflow 2: Demand Planning

```python
# 1. Load sales history
sales_data = get_sales_history(product_id="PROD-001", days=21)

# 2. Forecast demand
forecast = use_skill("ttm-forecasting", {
    "historical_data": sales_data,
    "frequency": "1h"
})

# 3. Calculate inventory needs
predicted_demand = sum(p["value"] for p in forecast["predictions"])
order_quantity = predicted_demand * 1.2  # 20% buffer
place_order(product_id, order_quantity)
```

## 🛠️ Requirements

### Python Dependencies
```txt
torch>=2.4.0
transformers>=4.41.0
granite-tsfm>=0.2.0
pandas>=2.1.0
numpy>=1.26.0
```

### System Requirements
- Python 3.9+
- 4GB RAM minimum (8GB recommended)
- 2GB storage for model cache

## 🩺 Troubleshooting Notes

- If Granite TTM does not load, keep the TSFM-first path instead of switching immediately to a generic shortcut
- If config loads but inference fails, verify `freq`, `timestamp_column`, and `target_columns` passed into `TimeSeriesForecastingPipeline`
- If output shape changes across environments, preserve consistent normalization for DataFrame, dict, nested list, tuple, and ndarray-like outputs
- If arithmetic fails with sequence types, enforce a strict 1-D float array before confidence bounds or risk calculations
- If `NaN` or `Inf` values appear, sanitize them before building response objects or serializing JSON
- If runtime inference still fails, expose the exception through `last_error` and fall back to the statistical forecaster

## 🔗 Related Resources

### In This Repository
- **TTM Mode**: `.bob/custom_modes.yaml` (ttm-forecast)
- **Implementation**: `forecast-backend/` directory
- **API Docs**: `forecast-backend/README.md`

### External Resources
- [IBM Granite TTM Model](https://huggingface.co/ibm-granite/granite-timeseries-ttm-r2)
- [IBM Granite TSFM Library](https://github.com/IBM/granite-tsfm)
- [Bob Documentation](https://bob.ibm.com/docs)

## ✅ Recommended Validation Checklist

Before calling a generated forecasting service production-ready, verify:

1. Forecast output is a flat finite numeric array
2. Prediction length matches the requested horizon
3. Frequency strings are pandas-compatible and lowercase where required
4. Risk calculations guard against zero denominators
5. API responses contain no `NaN` or `Inf` values
6. Statistical fallback still works when TTM loading or inference fails

## 🤝 Contributing

To enhance this skill:

1. **Add New Use Cases**: Update SKILL.md with new examples
2. **Add Sample Data**: Create new datasets in `sample_data/`
3. **Improve Documentation**: Enhance usage examples
4. **Report Issues**: Document any problems or limitations

## 📄 License

This skill uses IBM Granite TTM model (Apache 2.0 license).

## 👥 Authors

**IBM Bob** - Smart Cold Chain Solution Team

Built from the production implementation in `forecast-backend/` for the FleetOps cold chain management system.

## 📞 Support

For questions or issues:
1. Check [SKILL.md](./SKILL.md) for detailed documentation
2. Review [sample_data/README.md](./sample_data/README.md) for data format
3. Consult the TTM Forecasting Mode documentation
4. Review the production implementation in `forecast-backend/`

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Status**: Production Ready ✅