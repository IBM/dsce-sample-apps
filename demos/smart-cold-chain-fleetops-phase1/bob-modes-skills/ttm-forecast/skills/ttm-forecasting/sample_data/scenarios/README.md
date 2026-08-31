# TTM Forecasting - Try It Out Scenarios

Ready-to-use scenarios for testing the TTM forecasting skill and mode.

## 🎯 Available Scenarios

### 1. **Stock Price Prediction** (`stock_price_scenario.json`)
- **Use Case**: Financial forecasting
- **Frequency**: 1 hour
- **Data Points**: 512 hourly stock prices
- **Try It**: Predict next 96 hours (4 days) of stock movement

### 2. **Website Traffic Forecasting** (`website_traffic_scenario.json`)
- **Use Case**: Capacity planning
- **Frequency**: 1 hour
- **Data Points**: 512 hourly visitor counts
- **Try It**: Predict next 96 hours of traffic for server scaling

### 3. **Sales Forecasting** (`sales_scenario.json`)
- **Use Case**: Inventory management
- **Frequency**: 1 day
- **Data Points**: 512 daily sales records
- **Try It**: Predict next 96 days of product sales

### 4. **IoT Sensor Monitoring** (`iot_sensor_scenario.json`)
- **Use Case**: Predictive maintenance
- **Frequency**: 5 minutes
- **Data Points**: 512 sensor readings
- **Try It**: Predict next 96 readings (8 hours) for anomaly detection

### 5. **Custom Template** (`custom_template.json`)
- **Use Case**: Your own data
- **Frequency**: Configurable
- **Data Points**: Template with 20 points (extend to 512+)
- **Try It**: Replace with your time series data

---

## 🚀 Quick Start

### Using the Skill Directly

```python
import json

# Load a scenario
with open('.bob/skills/ttm-forecasting/sample_data/scenarios/stock_price_scenario.json') as f:
    scenario = json.load(f)

# Run forecast
forecast = use_skill("ttm-forecasting", {
    "historical_data": scenario["data"],
    "frequency": scenario["frequency"]
})

# View results
print(f"Predicted next {len(forecast['predictions'])} values")
print(f"Risk Score: {forecast['risk_assessment']['risk_score']}")
```

### Using TTM Mode

```bash
# 1. Switch to TTM mode
/mode ttm-forecast

# 2. Ask Bob to use a scenario
"Use the stock price scenario to create a forecasting service"

# 3. Bob will:
#    - Load the scenario data
#    - Create FastAPI service
#    - Add endpoints
#    - Configure deployment
```

---

## 📊 Scenario Details

### Stock Price Prediction

**File**: `stock_price_scenario.json`

```json
{
  "scenario_name": "Stock Price Forecasting",
  "description": "Predict stock prices for next 4 days",
  "use_case": "Financial trading and risk management",
  "frequency": "1h",
  "data_points": 512,
  "prediction_horizon": 96,
  "threshold": null,
  "data": [...]
}
```

**Try This**:
```bash
# Create a stock prediction API
/mode ttm-forecast
"Create a stock price forecasting service using stock_price_scenario.json"
```

### Website Traffic Forecasting

**File**: `website_traffic_scenario.json`

```json
{
  "scenario_name": "Website Traffic Prediction",
  "description": "Forecast visitor counts for capacity planning",
  "use_case": "Auto-scaling and resource optimization",
  "frequency": "1h",
  "data_points": 512,
  "prediction_horizon": 96,
  "threshold": 10000,
  "data": [...]
}
```

**Try This**:
```bash
# Create traffic prediction with alerts
/mode ttm-forecast
"Build a traffic forecasting service with threshold alerts at 10,000 visitors"
```

### Sales Forecasting

**File**: `sales_scenario.json`

```json
{
  "scenario_name": "Daily Sales Forecasting",
  "description": "Predict product sales for inventory planning",
  "use_case": "Inventory optimization and demand planning",
  "frequency": "1d",
  "data_points": 512,
  "prediction_horizon": 96,
  "threshold": 500,
  "data": [...]
}
```

**Try This**:
```bash
# Create sales prediction service
/mode ttm-forecast
"Create a sales forecasting API with inventory recommendations"
```

### IoT Sensor Monitoring

**File**: `iot_sensor_scenario.json`

```json
{
  "scenario_name": "IoT Sensor Prediction",
  "description": "Predict sensor values for predictive maintenance",
  "use_case": "Equipment monitoring and failure prevention",
  "frequency": "5min",
  "data_points": 512,
  "prediction_horizon": 96,
  "threshold": 85.0,
  "data": [...]
}
```

**Try This**:
```bash
# Create IoT monitoring service
/mode ttm-forecast
"Build an IoT sensor forecasting service with anomaly detection"
```

---

## 🎨 Customization Guide

### Create Your Own Scenario

1. **Copy the template**:
```bash
cp custom_template.json my_scenario.json
```

2. **Update metadata**:
```json
{
  "scenario_name": "My Custom Forecast",
  "description": "What you're predicting",
  "use_case": "Your business use case",
  "frequency": "1h",  // Your data frequency
  "threshold": 100    // Optional alert threshold
}
```

3. **Add your data** (minimum 512 points):
```json
{
  "data": [
    {"timestamp": "2024-01-01T00:00:00Z", "value": 123.45},
    {"timestamp": "2024-01-01T01:00:00Z", "value": 125.67},
    // ... 510 more points
  ]
}
```

4. **Test it**:
```python
forecast = use_skill("ttm-forecasting", {
    "historical_data": my_data,
    "frequency": "1h"
})
```

---

## 🧪 Testing Workflows

### Workflow 1: Quick Validation

```bash
# Test a scenario quickly
python -c "
import json
with open('stock_price_scenario.json') as f:
    data = json.load(f)
print(f'Loaded {len(data[\"data\"])} points')
print(f'Frequency: {data[\"frequency\"]}')
"
```

### Workflow 2: Build Complete Service

```bash
# 1. Switch to TTM mode
/mode ttm-forecast

# 2. Generate service
"Create a forecasting service using website_traffic_scenario.json"

# 3. Test locally
cd forecast-backend
python main.py

# 4. Test endpoint
curl http://localhost:5001/api/forecast/traffic
```

### Workflow 3: Compare Scenarios

```python
# Compare different scenarios
scenarios = [
    "stock_price_scenario.json",
    "website_traffic_scenario.json",
    "sales_scenario.json"
]

for scenario_file in scenarios:
    with open(scenario_file) as f:
        scenario = json.load(f)
    
    forecast = use_skill("ttm-forecasting", {
        "historical_data": scenario["data"],
        "frequency": scenario["frequency"]
    })
    
    print(f"{scenario['scenario_name']}: Risk={forecast['risk_assessment']['risk_score']}")
```

---

## 📈 Expected Results

### Accuracy Metrics

Each scenario includes expected performance:

| Scenario | MAPE | RMSE | Inference Time |
|----------|------|------|----------------|
| Stock Price | <5% | <2.5 | ~2.3s |
| Website Traffic | <8% | <150 | ~2.1s |
| Sales | <6% | <45 | ~2.2s |
| IoT Sensor | <4% | <1.8 | ~2.0s |

### Sample Output

```json
{
  "predictions": [
    {"timestamp": "2024-01-01T00:00:00Z", "value": 125.67},
    {"timestamp": "2024-01-01T01:00:00Z", "value": 126.34}
  ],
  "risk_assessment": {
    "risk_score": 35,
    "action": "MONITOR"
  },
  "metadata": {
    "inference_time_ms": 2340,
    "data_quality_score": 0.95
  }
}
```

---

## 🔧 Troubleshooting

### Issue: "Insufficient data points"
**Solution**: Ensure scenario has 512+ data points

### Issue: "Frequency mismatch"
**Solution**: Check all timestamps have consistent intervals

### Issue: "Model not loaded"
**Solution**: Verify TTM model installation:
```bash
python -c "from tsfm_public import TimeSeriesForecastingPipeline"
```

---

## 📚 Next Steps

1. **Try all scenarios** to understand different use cases
2. **Create custom scenario** with your own data
3. **Build production service** using TTM mode
4. **Deploy to cloud** using provided Docker/K8s configs
5. **Monitor performance** and tune parameters

---

## 🤝 Contributing

Add new scenarios:
1. Create JSON file following template
2. Add documentation here
3. Test with skill and mode
4. Submit PR with example usage

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Scenarios**: 5 ready-to-use + 1 template