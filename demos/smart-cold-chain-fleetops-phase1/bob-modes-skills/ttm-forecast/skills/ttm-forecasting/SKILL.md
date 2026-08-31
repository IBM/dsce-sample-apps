---
name: ttm-time-series-forecasting
description: Provides IBM Granite TTM forecasting guidance with TSFM-first loading, fallback behavior, and production usage patterns for time-series services.
---

# Skill: TTM Time-Series Forecasting

## Description

Provides time-series forecasting capabilities using IBM Granite TTM (Tiny Time Mixer) model for 96-step ahead predictions. This skill enables accurate forecasting for temperature monitoring, demand prediction, energy consumption, and other time-series scenarios.

## When to Use

Use this skill when you need to:

- **Predict future values** in time series data
- **Temperature forecasting** for cold chain logistics
- **Demand forecasting** for retail and supply chain
- **Energy consumption prediction** for utilities
- **Financial forecasting** for trading and risk management
- **Anomaly detection** through prediction deviation analysis
- **Risk assessment** based on predicted threshold breaches

This skill is ideal for any scenario requiring 96-step ahead predictions with high accuracy.

## Key Features

- 🎯 **Generic & Flexible**: Works with any time series data
- 🔄 **Multi-Model Support**: TTM-R2, TTM-512, TTM-1024, statistical fallbacks
- 📊 **Multiple Frequencies**: 1min, 5min, 15min, 1h, 1d
- 🎨 **Industry Agnostic**: Retail, energy, finance, logistics, healthcare
- 🚀 **Production Ready**: Error handling, monitoring, optimization
- 📈 **Accuracy Tracking**: Built-in performance metrics
- 🍎 **Apple Silicon Friendly**: Prefer `tsfm_public.toolkit.time_series_forecasting_pipeline.TimeSeriesForecastingPipeline` before alternate generic loading approaches when using Granite TTM on macOS
- 🧭 **Preserved Inference Path**: Keep `AutoConfig.from_pretrained()`, `TinyTimeMixerForPrediction.from_pretrained()`, and direct pipeline invocation together

## Capabilities

- ✅ Accepts historical time series data (minimum 512 points)
- ✅ Generates 96-step ahead predictions using IBM Granite TTM model
- ✅ Supports multiple time frequencies (1min, 5min, 15min, 1h, 1d)
- ✅ Returns predictions with timestamps
- ✅ Includes risk scoring for threshold breaches
- ✅ Provides confidence intervals (optional)
- ✅ Handles missing data and outliers
- ✅ Automatic fallback to statistical methods if model unavailable
- ✅ Batch prediction support for multiple series
- ✅ Performance monitoring and accuracy tracking
- ✅ Customizable model selection (TTM variants)
- ✅ Data quality validation and preprocessing
- ✅ Supports `tsfm_public.toolkit.time_series_forecasting_pipeline.TimeSeriesForecastingPipeline` as the preferred runtime path for Granite TTM

## Input Parameters

### Required Parameters

- **historical_data**: Array of historical data points with timestamps and values
  - Format: `[{"timestamp": "ISO8601", "value": number}, ...]`
  - Minimum: 512 data points
  - Maximum: Unlimited (uses last 512 for context)

### Optional Parameters

- **context_length**: Number of historical points to use (default: 512)
  - Range: 96-1024
  - Recommended: 512 for optimal accuracy

- **prediction_length**: Number of future points to predict (default: 96)
  - Fixed: 96 (TTM model constraint)

- **frequency**: Time series frequency (default: "1min")
  - Supported: "1min", "5min", "15min", "1h", "1d"
  - Must match historical data frequency

- **threshold**: Critical threshold for risk assessment (optional)
  - Used to calculate breach probability
  - Example: -20.0 for frozen cargo, 8.0 for fresh produce

- **model_variant**: TTM model variant to use (optional)
  - Options: "ttm-r2" (default), "ttm-512", "ttm-1024"
  - Auto-selected based on context_length if not specified

- **include_confidence**: Include confidence intervals (optional)
  - Default: false
  - Set to true for uncertainty quantification

- **validate_data**: Perform data quality checks (optional)
  - Default: true
  - Checks for gaps, outliers, frequency consistency

## Output Format

```json
{
  "predictions": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "value": 2.5,
      "confidence_lower": 2.3,
      "confidence_upper": 2.7
    },
    {
      "timestamp": "2024-01-01T00:01:00Z",
      "value": 2.6,
      "confidence_lower": 2.4,
      "confidence_upper": 2.8
    }
  ],
  "model": "ibm-granite/granite-timeseries-ttm-r2",
  "context_length": 512,
  "prediction_length": 96,
  "frequency": "1min",
  "risk_assessment": {
    "risk_score": 45,
    "time_to_breach": 72,
    "breach_probability": 0.35,
    "action": "MONITOR"
  },
  "metadata": {
    "data_quality_score": 0.95,
    "inference_time_ms": 2340,
    "model_variant": "ttm-r2"
  }
}
```

## Data Setup

### Before Using the Skill

You have 3 options for data:

#### Option 1: Use Sample Scenarios (Fastest)
```python
# Available scenarios in .bob/skills/ttm-forecasting/sample_data/scenarios/
# - stock_price_scenario.json
# - website_traffic_scenario.json
# - sales_scenario.json
# - iot_sensor_scenario.json
# - custom_template.json

import json

# Load a scenario
with open('.bob/skills/ttm-forecasting/sample_data/scenarios/stock_price_scenario.json') as f:
    scenario = json.load(f)

# Use it
forecast = use_skill("ttm-forecasting", {
    "historical_data": scenario["data"],
    "frequency": scenario["frequency"]
})
```

#### Option 2: Use Your Own Data
```python
# Prepare your time series data
my_data = [
    {"timestamp": "2024-01-01T00:00:00Z", "value": 100},
    {"timestamp": "2024-01-01T01:00:00Z", "value": 105},
    # ... minimum 512 data points for production
]

# Generate forecast
forecast = use_skill("ttm-forecasting", {
    "historical_data": my_data,
    "frequency": "1h"  # Match your data frequency
})
```

#### Option 3: Start with Template and Customize
```python
# Copy custom template
import json
import shutil

shutil.copy(
    '.bob/skills/ttm-forecasting/sample_data/scenarios/custom_template.json',
    'my_data.json'
)

# Edit my_data.json with your data
# Then use it
with open('my_data.json') as f:
    my_scenario = json.load(f)

forecast = use_skill("ttm-forecasting", {
    "historical_data": my_scenario["data"],
    "frequency": my_scenario["frequency"]
})
```

## Example Usage

### Quick Start Examples

#### Example 0: Minimal Usage (Any Time Series)

```python
# Works with ANY time series data
my_data = [
    {"timestamp": "2024-01-01T00:00:00Z", "value": 100},
    {"timestamp": "2024-01-01T01:00:00Z", "value": 105},
    # ... at least 512 data points
]

# Simple forecast
forecast = use_skill("ttm-forecasting", {
    "historical_data": my_data,
    "frequency": "1h"
})

print(f"Next 96 predictions: {len(forecast['predictions'])}")
```

### Example 1: Basic Temperature Forecast

```python
# Prepare historical temperature data (512 points)
historical_data = [
    {"timestamp": "2024-01-01T00:00:00Z", "value": 2.5},
    {"timestamp": "2024-01-01T00:01:00Z", "value": 2.6},
    {"timestamp": "2024-01-01T00:02:00Z", "value": 2.4},
    # ... 509 more data points
]

# Request forecast using the skill
result = use_skill("ttm-forecasting", {
    "historical_data": historical_data,
    "prediction_length": 96,
    "frequency": "1min"
})

# Access predictions
for prediction in result["predictions"]:
    print(f"{prediction['timestamp']}: {prediction['value']}°C")
```

### Example 2: Temperature Breach Prediction

```python
# Get truck temperature history from FleetOps API
truck_id = "TRUCK-001"
truck_temps = fetch_temperature_history(truck_id, hours=8)

# Forecast next 96 minutes with breach detection
forecast = use_skill("ttm-forecasting", {
    "historical_data": truck_temps,
    "prediction_length": 96,
    "frequency": "1min",
    "threshold": -20.0  # Critical threshold for frozen cargo
})

# Check for predicted breaches
risk = forecast["risk_assessment"]
if risk["risk_score"] > 70:
    print(f"⚠️ CRITICAL: Breach predicted in {risk['time_to_breach']} minutes")
    print(f"Action: {risk['action']}")
elif risk["risk_score"] > 40:
    print(f"⚠️ WARNING: Monitor closely")
else:
    print(f"✅ Normal operations")
```

### Example 3: Demand Forecasting

```python
# Historical sales data (hourly)
sales_data = [
    {"timestamp": "2024-01-01T00:00:00Z", "value": 145},
    {"timestamp": "2024-01-01T01:00:00Z", "value": 132},
    {"timestamp": "2024-01-01T02:00:00Z", "value": 128},
    # ... 509 more hourly data points
]

# Forecast next 96 hours of demand
demand_forecast = use_skill("ttm-forecasting", {
    "historical_data": sales_data,
    "frequency": "1h"
})

# Calculate inventory requirements
total_predicted_demand = sum(p["value"] for p in demand_forecast["predictions"])
print(f"Predicted demand for next 96 hours: {total_predicted_demand} units")
```

### Example 4: Energy Consumption Prediction

```python
# Historical energy consumption (15-minute intervals)
energy_data = load_energy_history(meter_id="METER-001", days=5)

# Forecast next 24 hours (96 x 15-min intervals)
energy_forecast = use_skill("ttm-forecasting", {
    "historical_data": energy_data,
    "frequency": "15min"
})

# Identify peak consumption periods
peaks = [p for p in energy_forecast["predictions"] if p["value"] > 50]
print(f"Peak consumption periods: {len(peaks)}")
```

## Sample Data

### Temperature Series (Cold Chain)

```json
[
  {"timestamp": "2024-01-01T00:00:00Z", "value": 2.5},
  {"timestamp": "2024-01-01T00:01:00Z", "value": 2.6},
  {"timestamp": "2024-01-01T00:02:00Z", "value": 2.4},
  {"timestamp": "2024-01-01T00:03:00Z", "value": 2.7},
  {"timestamp": "2024-01-01T00:04:00Z", "value": 2.5}
]
```

### Demand Series (Retail)

```json
[
  {"timestamp": "2024-01-01T00:00:00Z", "value": 145},
  {"timestamp": "2024-01-01T01:00:00Z", "value": 132},
  {"timestamp": "2024-01-01T02:00:00Z", "value": 128},
  {"timestamp": "2024-01-01T03:00:00Z", "value": 115},
  {"timestamp": "2024-01-01T04:00:00Z", "value": 98}
]
```

### Energy Series (Utilities)

```json
[
  {"timestamp": "2024-01-01T00:00:00Z", "value": 45.2},
  {"timestamp": "2024-01-01T00:15:00Z", "value": 43.8},
  {"timestamp": "2024-01-01T00:30:00Z", "value": 44.1},
  {"timestamp": "2024-01-01T00:45:00Z", "value": 46.3},
  {"timestamp": "2024-01-01T01:00:00Z", "value": 47.8}
]
```

## Technical Details

### Model Information

- **Model**: IBM Granite TTM (Tiny Time Mixer) - `ibm-granite/granite-timeseries-ttm-r2`
- **Architecture**: Transformer-based time series foundation model
- **Context Window**: 512 time steps (fixed)
- **Prediction Horizon**: 96 time steps (fixed)
- **Training Data**: Diverse time series datasets across multiple domains
- **Inference Time**: ~2-3 seconds per prediction
- **Device Support**: CPU and CUDA (GPU)

### Preferred Model Loading Path

Preserve this loading sequence in future implementations:

1. Import `AutoConfig`, `TinyTimeMixerForPrediction`, and `TimeSeriesForecastingPipeline`
2. Load config with `AutoConfig.from_pretrained()` using `trust_remote_code=True`
3. Load the model with `TinyTimeMixerForPrediction.from_pretrained()`
4. Build `TimeSeriesForecastingPipeline` with explicit `timestamp_column`, `target_columns`, and `freq`
5. Run inference by calling the pipeline directly on a normalized pandas DataFrame

This path is the baseline because it avoids the model-loading issues seen with more generic loading shortcuts and preserves compatibility with Granite TTM runtime expectations.

### Preferred Inference Output Handling

TTM pipeline outputs may vary by environment and library version. Preserve this normalization strategy:

- First inspect DataFrame outputs for columns such as `value_prediction`, `prediction`, `forecast`, or `value`
- If needed, fall back to the first numeric DataFrame column
- If the pipeline returns a dict, inspect keys such as `forecast`, `predictions`, or `value`
- If values are nested lists, tuples, or arrays, flatten recursively until a strict 1-D sequence is produced
- As a final fallback, coerce the raw output into a flat numpy array with float dtype
- Remove or sanitize `NaN` and `Inf` values and truncate to the requested horizon
- Validate that the final prediction array length matches the requested horizon before downstream calculations

This keeps inference resilient across TSFM and Granite TTM output-shape differences.

### Data Requirements

1. **Minimum Data Points**: 512 historical observations
2. **Data Quality**: 
   - No more than 10% missing values
   - Consistent time intervals
   - Numeric values only
3. **Frequency Consistency**: All data points must have same frequency
4. **Timestamp Format**: ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)

### Risk Assessment Algorithm

The skill calculates risk scores using multiple factors:

```python
risk_score = (
    0.5 * time_factor +      # Urgency (time until breach)
    0.3 * severity_factor +  # Magnitude of breach
    0.2 * value_factor       # Business impact
)
```

**Risk Levels:**
- **CRITICAL** (>70): Immediate action required
- **WARNING** (40-70): Enhanced monitoring needed
- **MONITOR** (20-40): Increased attention
- **NORMAL** (<20): Standard operations

## Dependencies

### Python Packages

```txt
torch>=2.4.0              # PyTorch for model inference
transformers>=4.41.0      # HuggingFace transformers
granite-tsfm>=0.2.0       # IBM Granite TSFM library
pandas>=2.1.0             # Data manipulation
numpy>=1.26.0,<2.0.0      # Numerical operations
```

### System Requirements

- **Python**: 3.9 or higher
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: 2GB for model cache
- **CPU**: Multi-core processor recommended
- **GPU**: Optional (CUDA-compatible for faster inference)

## Implementation Notes

### Performance Optimization

1. **Model Caching**: TTM model is loaded once and reused (singleton pattern)
2. **Batch Processing**: Multiple forecasts can be processed in parallel
3. **Memory Management**: Automatic cleanup of large data structures
4. **Fallback Mechanism**: Statistical methods used if model unavailable

### Error Handling

The skill handles various error scenarios:

- **Insufficient Data**: Returns error if less than 512 points
- **Invalid Frequency**: Validates and suggests correct format
- **Model Load Failure**: Falls back to statistical forecasting
- **API Timeout**: Implements retry logic with exponential backoff
- **Data Quality Issues**: Provides detailed validation messages
- **Nested Prediction Outputs**: Flattens and normalizes nested sequences before arithmetic
- **NaN/Inf Values**: Sanitizes non-finite values before risk scoring and response serialization
- **Division Edge Cases**: Guards zero or near-zero denominators in utilization, volatility, and trend calculations

### Thread Safety

The skill is thread-safe and can handle concurrent requests:
- Singleton model instance with locking
- Stateless prediction functions
- No shared mutable state

## Integration Examples

### With FleetOps Backend

```python
# In FleetOps forecasting service
from ttm_forecasting_skill import forecast_timeseries

def forecast_temperature_breach(truck_id: str):
    # Fetch historical data
    historical_data = get_truck_temperature_history(truck_id)
    
    # Use TTM skill for prediction
    forecast = forecast_timeseries(
        historical_data=historical_data,
        threshold=truck.cargo.critical_threshold
    )
    
    return forecast
```

### With Watson Orchestrate Agents

```python
# In Decision Agent
def analyze_truck_risk(truck_id: str):
    # Get temperature forecast using skill
    temp_forecast = use_skill("ttm-forecasting", {
        "historical_data": get_temperature_data(truck_id),
        "threshold": get_critical_threshold(truck_id)
    })
    
    # Make decision based on forecast
    if temp_forecast["risk_assessment"]["risk_score"] > 70:
        return "REROUTE_TO_NEAREST_STATION"
    else:
        return "CONTINUE_ROUTE"
```

## Related Skills

- **weather-forecasting**: Weather prediction for route planning
- **risk-assessment**: Multi-factor risk analysis
- **anomaly-detection**: Outlier detection in time series
- **route-optimization**: Optimal routing based on predictions

## Troubleshooting

### Common Issues

**Issue**: "Insufficient historical data"
- **Solution**: Ensure at least 512 data points are provided

**Issue**: "Frequency mismatch"
- **Solution**: Verify all timestamps have consistent intervals

**Issue**: "Model not loaded"
- **Solution**: Check TTM model installation and environment variables

**Issue**: "Prediction timeout"
- **Solution**: Reduce context length or check system resources

### Model Loading and Inference Debug Notes

**Issue**: Granite TTM loads inconsistently with generic Hugging Face shortcuts
- **Solution**: Preserve the TSFM-first path using `TimeSeriesForecastingPipeline` with `TinyTimeMixerForPrediction.from_pretrained()`

**Issue**: Config loads but pipeline creation fails
- **Solution**: Ensure `AutoConfig.from_pretrained()` uses `trust_remote_code=True` and that `timestamp_column`, `target_columns`, and `freq` are passed explicitly into `TimeSeriesForecastingPipeline`

**Issue**: Inference returns an unexpected shape or object type
- **Solution**: Normalize outputs consistently, handling DataFrame, dict, nested list, tuple, and ndarray-like responses

**Issue**: Arithmetic fails with sequence types
- **Solution**: Enforce a strict 1-D float numpy array contract before confidence bounds, risk scoring, or any multiplication/division

**Issue**: JSON serialization fails because of `NaN`
- **Solution**: Sanitize all response floats with a `safe_float`-style helper and ensure only finite values are returned

**Issue**: TTM loads but runtime forecast still fails
- **Solution**: Capture the exception, expose it through `last_error`, and fall back to a statistical forecaster instead of failing the whole service

**Issue**: macOS or Apple Silicon behaves differently from Linux
- **Solution**: Keep the TSFM-first loading path as the default on macOS and avoid replacing it with less specific inference helpers unless they are validated in the target environment

## Version History

- **1.0.0** (2024-01-15): Initial release
  - IBM Granite TTM-R2 integration
  - 96-step ahead forecasting
  - Risk assessment capabilities
  - Multi-frequency support

## Author

**IBM Bob** - Smart Cold Chain Solution Team

Built with IBM Granite TTM foundation model for production-grade time series forecasting.

## License

This skill uses IBM Granite TTM model which is available under Apache 2.0 license.

## Support

For issues or questions:
- Check the troubleshooting section above
- Review sample data and examples
- Consult the TTM Forecasting Mode documentation
- Contact the IBM Bob development team