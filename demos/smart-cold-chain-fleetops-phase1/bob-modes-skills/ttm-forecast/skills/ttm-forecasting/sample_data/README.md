# TTM Forecasting - Sample Data

This directory contains sample time series datasets for testing the TTM Forecasting skill.

## 📁 Directory Structure

```
sample_data/
├── README.md (this file)
├── scenarios/                          # Ready-to-use forecasting scenarios
│   ├── README.md                       # Detailed scenario guide
│   ├── stock_price_scenario.json       # Financial forecasting
│   ├── website_traffic_scenario.json   # Web traffic prediction
│   ├── sales_scenario.json            # Retail demand forecasting
│   ├── iot_sensor_scenario.json       # IoT sensor monitoring
│   └── custom_template.json           # Template for your data
├── temperature_series.json            # Legacy: Cold chain data
├── demand_series.json                 # Legacy: Retail demand data
└── energy_series.json                 # Legacy: Energy consumption data
```

## 🚀 Quick Start

### Use Ready-Made Scenarios (Recommended)

All new scenarios are in the [`scenarios/`](scenarios/) directory with complete documentation:

```bash
# See all available scenarios
cat scenarios/README.md

# Try stock price forecasting
/mode ttm-forecast
"Use scenarios/stock_price_scenario.json to create a forecasting service"
```

**Available Scenarios:**
- 📈 Stock Price Forecasting
- 🌐 Website Traffic Prediction
- 🛒 Sales Forecasting
- 🔧 IoT Sensor Monitoring
- ✏️ Custom Template (for your data)

👉 **See [`scenarios/README.md`](scenarios/README.md) for detailed usage guide**

---

## 📊 Legacy Sample Files

These files are kept for backward compatibility:

### `temperature_series.json`
- **Use Case**: Cold chain monitoring
- **Frequency**: 1min
- **Points**: 20 (demo only)

### `demand_series.json`
- **Use Case**: Retail demand
- **Frequency**: 1h
- **Points**: 20 (demo only)

### `energy_series.json`
- **Use Case**: Energy consumption
- **Frequency**: 15min
- **Points**: 20 (demo only)

**Note**: These legacy files contain only 20 points. For production, use the scenarios in [`scenarios/`](scenarios/) directory or extend to 512+ points.

---

## 📖 Documentation

- **Main Skill README**: [`../README.md`](../README.md)
- **Scenario Guide**: [`scenarios/README.md`](scenarios/README.md)
- **Skill Specification**: [`../SKILL.md`](../SKILL.md)
- **Mode Configuration**: [`../../custom_modes.yaml`](../../custom_modes.yaml)

---

**Recommendation**: Use the new scenarios in [`scenarios/`](scenarios/) directory for better examples and documentation.