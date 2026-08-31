# Instana Custom Modes for Bob

This repository contains custom Bob modes specialized for working with IBM Instana Application Performance Monitoring (APM). These modes provide expert guidance for API integration, dashboard development, and application observability.

## 📋 Table of Contents

- [Available Modes](#available-modes)
- [Quick Start](#quick-start)
- [Mode Details](#mode-details)
- [Common Use Cases](#common-use-cases)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Available Modes

### 1. 🔌 Instana API Mode (`instana-api`)

**Specialized for:** Instana REST API integration and client development

**Key Capabilities:**
- Designing robust API client classes
- Implementing efficient data retrieval patterns
- Handling API errors gracefully with informative messages
- Creating reusable API wrapper functions
- Building interactive trace visualization dashboards
- Implementing comprehensive trace detail modals

**When to Use:**
- Creating or modifying API client implementations
- Adding new Instana API endpoints to existing clients
- Debugging API authentication or connection issues
- Implementing data fetching logic for applications, services, traces, or events
- Building interactive trace visualization dashboards with clickable trace IDs
- Implementing trace detail modals with comprehensive call information

**File Restrictions:**
Can only edit files matching: `(instana.*\.py|.*_client\.py|.*api.*\.py|dashboard\.py|app.*\.py|\.env.*|config\..*|requirements\.txt)$`

### 2. 🔍 Application Observability Mode (`application-observability`)

**Specialized for:** Application monitoring, performance analysis, and dashboard creation

**Key Capabilities:**
- Creating interactive monitoring dashboards with Dash and Plotly
- Analyzing service error rates, latency, and call patterns
- Building custom monitoring solutions with Python
- Investigating performance bottlenecks and service health
- Setting up trace data analysis and visualization
- Developing cross-platform setup and deployment scripts

**When to Use:**
- Creating or enhancing Instana monitoring dashboards
- Analyzing application performance metrics for specific applications
- Troubleshooting API integration issues with Instana
- Building custom monitoring solutions
- Implementing observability best practices
- Creating API test and inspection scripts

**MCP Server Integration:**
Includes access to the "Application Observability" MCP server with tools for:
- Event retrieval and analysis
- Kubernetes event monitoring
- Agent monitoring events
- Issue and incident tracking
- Change event tracking

## 🚀 Quick Start

### Activating a Mode

1. **In Bob Chat:**
   - Type `/mode` to see available modes
   - Select either "🔌 Instana API" or "🔍 Application Observability"
   - Or use the mode switcher in the Bob interface

2. **Via Command:**
   ```
   /mode instana-api
   ```
   or
   ```
   /mode application-observability
   ```

### Example Tasks

**Instana API Mode:**
```
Create an Instana API client that fetches application metrics for the last 24 hours
```

**Application Observability Mode:**
```
Build a dashboard showing error rates and latency for the "payment-service" application
```

## 📖 Mode Details

### Instana API Mode - Deep Dive

#### Core Expertise

1. **API Client Architecture**
   - Authentication with API tokens
   - Request/response handling
   - Pagination management
   - Rate limiting and retry logic

2. **Data Extraction Patterns**
   ```python
   # CRITICAL: Metrics return as [[timestamp, value]] arrays
   metrics["calls.sum"][0][1]  # Extract actual value
   
   # Applications API returns paginated dict
   if isinstance(response, dict) and 'items' in response:
       data = response['items']
   ```

3. **Trace Visualization Features**
   - Clickable trace ID hyperlinks
   - Enhanced basic information (11 data points)
   - Technology badges display
   - Visual metric cards (Calls, Errors, Duration)
   - Call details with error messages
   - IBM Carbon UI color scheme

#### Key API Endpoints

- `/api/application-monitoring/applications` - List all applications
- `/api/application-monitoring/applications;id={id}/services` - Get services
- `/api/application-monitoring/metrics/services` - Service metrics
- `/api/application-monitoring/analyze/call-groups` - Trace data analysis
- `/api/application-monitoring/catalog/metrics` - Available metrics

#### Rule Files

The mode uses 7 sequential rule files in `.bob/rules-instana-api/`:
1. `1_api_workflow.xml` - API integration workflow
2. `2_best_practices.xml` - Best practices and patterns
3. `3_common_patterns.xml` - Common implementation patterns
4. `4_fixes_and_enhancements.xml` - Known issues and fixes
5. `5_observability_charts_enhancement.xml` - Chart creation
6. `6_dash_callback_best_practices.xml` - Dash callback patterns
7. `7_trace_filtering_implementation.xml` - Trace filtering logic

### Application Observability Mode - Deep Dive

#### Core Expertise

1. **Dashboard Components**
   - Service Error Rate Dashboard
   - Application Services Dashboard
   - Services with Trace Data Dashboard (7 charts)

2. **Visualization Types**
   - Call Count Bar Chart
   - Error Rate Bar Chart
   - Latency Bar Chart
   - Call Distribution Pie Chart
   - Combined Metrics Comparison
   - Error vs Latency Scatter Plot
   - Service Health Score

3. **Health Score Calculation**
   ```python
   health_score = (error_score × 40%) + (latency_score × 30%) + (throughput_score × 30%)
   error_score = 100 - error_rate  # Capped at 100
   ```

#### Data Processing Best Practices

```python
# Safe metric extraction
def extract_metric_value(metrics_dict, metric_key):
    if not isinstance(metrics_dict, dict):
        return 0
    metric_data = metrics_dict.get(metric_key, [])
    if isinstance(metric_data, list) and len(metric_data) > 0:
        if isinstance(metric_data[0], list) and len(metric_data[0]) >= 2:
            return float(metric_data[0][1])
    return 0

# Safe normalization
data_range = df['metric'].max() - df['metric'].min()
if data_range == 0 or pd.isna(data_range):
    df['normalized'] = 50  # Use middle value
else:
    df['normalized'] = ((df['metric'] - df['metric'].min()) / data_range * 100).fillna(0)
```

#### MCP Server Tools

- `get_event` - Retrieve specific event by ID
- `get_kubernetes_info_events` - Kubernetes events with fix suggestions
- `get_agent_monitoring_events` - Agent monitoring events
- `get_issues` - Non-critical problems
- `get_incidents` - Critical issues requiring immediate attention
- `get_changes` - Deployment and configuration changes
- `get_events_by_ids` - Batch retrieve multiple events

All tools support natural language time ranges (e.g., "last 24 hours", "last week").

## 💡 Common Use Cases

### Use Case 1: Create API Client for New Endpoint

**Mode:** Instana API (`instana-api`)

**Task:**
```
Add support for fetching infrastructure metrics from the Instana API
```

**What the mode will do:**
- Create or update API client class
- Implement authentication
- Add error handling and retry logic
- Create helper methods for data extraction
- Add documentation and examples

### Use Case 2: Build Performance Dashboard

**Mode:** Application Observability (`application-observability`)

**Task:**
```
Create a dashboard showing error rates, latency, and throughput for the "checkout-service" application over the last 7 days
```

**What the mode will do:**
- Validate application exists in Instana
- Fetch relevant metrics using appropriate API endpoints
- Create multiple visualization types
- Implement health score calculation
- Add interactive filtering and drill-down
- Create cross-platform run scripts

### Use Case 3: Debug API Integration Issue

**Mode:** Instana API (`instana-api`)

**Task:**
```
The trace detail modal is not showing call information. Debug and fix the issue.
```

**What the mode will do:**
- Analyze API response structure
- Check data extraction patterns
- Verify trace detail API endpoint usage
- Fix data parsing logic
- Add debug logging
- Test with sample data

### Use Case 4: Analyze Application Events

**Mode:** Application Observability (`application-observability`)

**Task:**
```
Show me all incidents and issues for the "payment-gateway" application in the last 24 hours
```

**What the mode will do:**
- Use MCP server tools to fetch events
- Filter by application name
- Analyze event patterns
- Provide fix suggestions for Kubernetes events
- Create summary report with actionable insights

## ✅ Best Practices

### General Guidelines

1. **Always specify application name** when working with Application Observability mode
2. **Validate API responses** before processing data
3. **Handle pagination** for endpoints that return paginated results
4. **Use safe data extraction** patterns to avoid errors
5. **Add comprehensive error handling** with clear messages

### Critical Data Patterns

#### Metric Extraction
```python
# ✅ CORRECT - Metrics are [[timestamp, value]] arrays
value = metrics["calls.sum"][0][1]

# ❌ WRONG - Don't assume simple object structure
value = metrics.calls.sum  # This will fail!
```

#### Paginated Responses
```python
# ✅ CORRECT - Handle both formats
if isinstance(response, dict) and 'items' in response:
    data = response['items']
elif isinstance(response, list):
    data = response
else:
    data = []
```

#### Safe Data Processing
```python
# ✅ CORRECT - Always use fillna()
df['calls'] = df['metrics'].apply(
    lambda x: extract_metric_value(x, 'calls.sum')
).fillna(0)

# ✅ CORRECT - Check for zero/NaN before division
if data_range == 0 or pd.isna(data_range):
    normalized = 50  # Safe default
else:
    normalized = (value - min_val) / data_range * 100
```

### Dashboard Development

1. **CSS Styling:** Create `src/assets/custom.css` (Dash auto-loads from assets/)
2. **Tab Isolation:** Each tab needs its own `dcc.Store` component
3. **Callbacks:** Use `prevent_initial_call=True` for dynamic components
4. **Data Validation:** Always validate before normalization or division

### Time Windows

```python
# Time in milliseconds
current_time = int(time.time() * 1000)
one_hour_ago = current_time - 3600000
one_day_ago = current_time - 86400000

# Rollup for aggregation (default: 1 minute)
rollup = 60000
```

## 🔧 Troubleshooting

### Common Issues

#### Issue: "Metrics not displaying correctly"
**Solution:** Check metric extraction pattern
```python
# Verify you're using the correct pattern
value = metrics["metric.aggregation"][0][1]
```

#### Issue: "Application not found"
**Solution:** Verify application name and check API response
```python
# Applications API returns paginated dict
apps = response.get('items', [])
app_names = [app.get('label') or app.get('name') for app in apps]
```

#### Issue: "Dashboard shows NaN or errors"
**Solution:** Add safe data processing
```python
# Always use fillna() and check for zero/NaN
df = df.fillna(0)
if max_value == 0 or pd.isna(max_value):
    use_default_value()
```

#### Issue: "Trace modal not opening"
**Solution:** Check pattern-matching callback and data store
```python
# Use pattern-matching for dynamic trace links
@app.callback(
    Output('trace-modal', 'is_open'),
    Input({'type': 'trace-link', 'index': ALL}, 'n_clicks'),
    prevent_initial_call=True
)
```

#### Issue: "CSS styles not applying"
**Solution:** Create CSS file in assets directory
```bash
# Create assets directory and CSS file
mkdir -p src/assets
touch src/assets/custom.css
```

### Getting Help

1. **Check rule files** in `.bob/rules-instana-api/` for detailed patterns
2. **Review AGENTS.md** for critical non-obvious patterns
3. **Use debug mode** to see API response structures
4. **Ask mode-specific questions** for targeted assistance

## 📚 Additional Resources

### File Structure
```
.bob/
├── custom_modes.yaml           # Mode definitions
├── rules-instana-api/          # Instana API mode rules
│   ├── 1_api_workflow.xml
│   ├── 2_best_practices.xml
│   ├── 3_common_patterns.xml
│   ├── 4_fixes_and_enhancements.xml
│   ├── 5_observability_charts_enhancement.xml
│   ├── 6_dash_callback_best_practices.xml
│   └── 7_trace_filtering_implementation.xml
└── rules-advanced/             # Advanced mode rules
    └── AGENTS.md
```

### Key Configuration Files

- **`.bob/custom_modes.yaml`** - Mode definitions and capabilities
- **`AGENTS.md`** - Critical patterns and best practices
- **`.bob/rules-instana-api/*.xml`** - Sequential rule files for API mode

## 🎓 Learning Path

1. **Start with Application Observability mode** for dashboard creation
2. **Move to Instana API mode** when you need custom API integrations
3. **Review rule files** to understand advanced patterns
4. **Study AGENTS.md** for critical non-obvious patterns
5. **Experiment with MCP tools** for event-based insights

## 📝 Contributing

When adding new capabilities:
1. Update mode definitions in `.bob/custom_modes.yaml`
2. Add rule files in appropriate `.bob/rules-*/` directory
3. Update `AGENTS.md` with critical patterns
4. Test with real Instana API endpoints
5. Document common issues and solutions

---

**Version:** 1.0  
**Last Updated:** 2026-06-10  
**Maintained by:** IBM Instana Team