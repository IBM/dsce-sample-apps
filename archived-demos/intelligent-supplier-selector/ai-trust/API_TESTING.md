# AI Guardrails REST API - Testing Guide

## API Endpoints

### Local Development (Python)
The REST API is running at: **http://localhost:8090**

### Docker (Local Container)
The REST API is running at: **http://localhost:8080**

### Deployed on IBM Code Engine
Production API: **https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud**

## Available Endpoints

> **Note:** Replace the port in examples below:
> - **Local Python:** `localhost:8090`
> - **Docker:** `localhost:8080`
> - **Production:** Use the Code Engine URL

### 1. Health Check
**Local:**
```bash
curl http://localhost:8090/api/health  # Python: 8090, Docker: 8080
```

**Production:**
```bash
curl https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/health
```

**Response:**
```json
{
    "service": "AI Guardrails API",
    "status": "healthy",
    "timestamp": "2025-12-05T11:44:28.718623"
}
```

### 2. List Available Metrics
**Local:**
```bash
curl http://localhost:8090/api/metrics
```

**Production:**
```bash
curl https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/metrics
```

**Response:**
```json
{
    "metrics": [
        {
            "category": "safety",
            "description": "Detects personally identifiable information",
            "name": "PII Detection"
        },
        {
            "category": "safety",
            "description": "Assesses content for potential harmful intent",
            "name": "Harm Detection"
        },
        ...
    ],
    "total": 19
}
```

**Note:** Returns 19 total metrics (10 safety, 3 RAG, 6 quality including LLM-as-Judge evaluations)

### 3. Evaluate Single Text
**Local:**
```bash
curl -X POST http://localhost:8090/api/evaluate \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

**Production:**
```bash
curl -X POST https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/evaluate \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

**Request Body (test_request.json):**
```json
{
  "input_text": "What is your name?",
  "generated_text": "Hello! I am here to help you with your questions.",
  "metrics": ["PII Detection", "Harm Detection"]
}
```

**Response:**
```json
{
    "status": "success",
    "results": {
        "PII Detection": {
            "score": 0.95,
            "passed": true,
            "category": "safety"
        },
        "Harm Detection": {
            "score": 0.99,
            "passed": true,
            "category": "safety"
        }
    },
    "input": {
        "input_text": "What is your name?",
        "generated_text": "Hello! I am here to help you with your questions.",
        "metrics_evaluated": ["PII Detection", "Harm Detection"]
    },
    "timestamp": "2025-12-05T11:46:14.550180"
}
```

### 4. Batch Evaluation
**Local:**
```bash
curl -X POST http://localhost:8090/api/evaluate/batch \
  -H "Content-Type: application/json" \
  -d @batch_request.json
```

**Production:**
```bash
curl -X POST https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/evaluate/batch \
  -H "Content-Type: application/json" \
  -d @batch_request.json
```

**Request Body (batch_request.json):**
```json
{
  "items": [
    {
      "input_text": "What is your name?",
      "generated_text": "My name is John Doe and my email is john@example.com"
    },
    {
      "input_text": "Tell me about safety",
      "generated_text": "Safety is important in all aspects of life."
    }
  ],
  "metrics": ["PII Detection", "Harm Detection"]
}
```

**Response:**
```json
{
    "status": "success",
    "batch_results": [
        {
            "record_id": "eval_1",
            "input": {
                "input_text": "What is your name?",
                "generated_text": "My name is John Doe and my email is john@example.com"
            },
            "results": {
                "PII Detection": {
                    "score": 0.15,
                    "passed": false,
                    "category": "safety"
                },
                "Harm Detection": {
                    "score": 0.99,
                    "passed": true,
                    "category": "safety"
                }
            }
        },
        {
            "record_id": "eval_2",
            "input": {
                "input_text": "Tell me about safety",
                "generated_text": "Safety is important in all aspects of life."
            },
            "results": {
                "PII Detection": {
                    "score": 1.0,
                    "passed": true,
                    "category": "safety"
                },
                "Harm Detection": {
                    "score": 1.0,
                    "passed": true,
                    "category": "safety"
                }
            }
        }
    ],
    "total_items": 2,
    "metrics_evaluated": ["PII Detection", "Harm Detection"],
    "timestamp": "2025-12-05T..."
}
```

## Python Example

```python
import requests
import json

# Use local or production API
API_URL = "http://localhost:8090"  # Local
# API_URL = "https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud"  # Production

# Health check
response = requests.get(f"{API_URL}/api/health")
print(response.json())

# List metrics
response = requests.get(f"{API_URL}/api/metrics")
print(response.json())

# Evaluate text
payload = {
    "input_text": "What is your address?",
    "generated_text": "I live at 123 Main Street, New York, NY 10001",
    "metrics": ["PII Detection"]
}

response = requests.post(
    f"{API_URL}/api/evaluate",
    headers={"Content-Type": "application/json"},
    json=payload
)

print(json.dumps(response.json(), indent=2))
```

## Error Handling

### Missing Required Fields
```json
{
    "error": "generated_text is required",
    "status": "error",
    "timestamp": "..."
}
```

### Invalid Metrics
```json
{
    "error": "Invalid metrics: ['Unknown Metric']",
    "available_metrics": ["PII Detection", "Harm Detection", ...],
    "status": "error",
    "timestamp": "..."
}
```

### Evaluation Error
```json
{
    "status": "error",
    "error": "Failed to initialize evaluator. Check credentials.",
    "timestamp": "..."
}
```

## Integration with Applications

### cURL Integration
```bash
# Store response in variable
RESULT=$(curl -s -X POST http://localhost:8090/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"generated_text":"Test text","metrics":["PII Detection"]}')

echo $RESULT | jq '.results'
```

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function evaluateText(text, metrics) {
    try {
        const response = await axios.post('http://localhost:8090/api/evaluate', {
            generated_text: text,
            metrics: metrics
        });
        return response.data;
    } catch (error) {
        console.error('Error:', error.response.data);
    }
}

// Usage
evaluateText(
    "Hello, my phone number is 555-1234",
    ["PII Detection", "Harm Detection"]
).then(result => console.log(result));
```

## Notes

- The API server is currently running in **development mode**
- For production deployment, see the Docker and Code Engine deployment guides
- The API uses the same IBM watsonx.governance credentials as the web UI
- All metrics are evaluated using the configured watsonx.governance project
