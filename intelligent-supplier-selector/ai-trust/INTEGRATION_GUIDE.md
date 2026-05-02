# AI Guardrails API - Integration Guide

## Overview
This API evaluates AI-generated text using IBM watsonx.governance guardrail metrics across Safety, RAG (Retrieval-Augmented Generation), and Quality categories.

**Base URL:** `https://guardrails-api.23jw6l1ualch.us-south.codeengine.appdomain.cloud`

---

## Quick Start

### 1. Health Check
```bash
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "AI Guardrails API",
  "timestamp": "2025-12-05T23:07:54.917995"
}
```

### 2. List Available Metrics
```bash
GET /api/metrics
```

**Response:**
```json
{
  "metrics": [...],
  "by_category": {
    "safety": [...],
    "rag": [...],
    "quality": [...]
  },
  "total": 19
}
```

---

## Main Endpoint: Evaluate Text

### Endpoint
```
POST /api/evaluate
```

### Request Body
```json
{
  "input_text": "What is the weather like today?",
  "generated_text": "Hello! How can I help you today?",
  "context": "Optional context for RAG metrics",
  "table_data": "Optional JSON table data for Narrative Quality metric",
  "interaction_id": "optional-unique-id-for-tracking",
  "metrics": ["PII Detection", "Harm Detection"]
}
```

**Parameters:**
- `input_text` (required): The original user question/prompt
- `generated_text` (optional): The AI-generated text to evaluate
- `context` (optional): Context used for generation (needed for RAG metrics)
- `table_data` (optional): JSON table data as a string (needed for Narrative Quality metric)
- `interaction_id` (optional): Unique identifier for tracking this evaluation
- `metrics` (optional): Array of metric names. If omitted, all 19 metrics are evaluated

### Response
```json
{
  "status": "success",
  "interaction_id": "optional-unique-id-for-tracking",
  "results": {
    "PII Detection": {
      "score": 0.0,
      "passed": true,
      "category": "safety",
      "column": "pii",
      "guardrail_action": "Pass"
    },
    "Harm Detection": {
      "score": 0.0,
      "passed": true,
      "category": "safety",
      "column": "harm.granite_guardian",
      "guardrail_action": "Pass"
    }
  },
  "input": {
    "input_text": "What is the weather like today?",
    "generated_text": "Hello! How can I help you today?",
    "context": null,
    "table_data": null,
    "interaction_id": "optional-unique-id-for-tracking",
    "metrics_evaluated": ["PII Detection", "Harm Detection"]
  },
  "timestamp": "2025-12-05T23:07:54.917995"
}
```

**Response Fields:**
- `status`: "success" or "error"
- `interaction_id`: Echo of the interaction ID from the request (empty string if not provided)
- `results`: Object containing evaluation results for each metric
  - `score`: Float from 0.0 to 1.0
  - `passed`: Boolean indicating if the score passes the threshold
  - `category`: "safety", "rag", or "quality"
  - `column`: Internal column name
  - `guardrail_action`: **"Pass"** or **"Block"** based on score and threshold
- `input`: Echo of the request parameters
- `timestamp`: ISO format timestamp

**Score Interpretation:**
- Scores range from 0.0 to 1.0
- For safety metrics: **High scores = Block** (score >= 0.65 triggers Block)
- For RAG metrics: **Low scores = Block** (score <= 0.1 triggers Block)
- For quality metrics: **Low scores = Block** (score <= 0.5 triggers Block, except Unsuccessful Requests which always returns Pass)

**Guardrail Action:**
- **"Pass"**: Content is safe/acceptable, can be shown to user
- **"Block"**: Content failed guardrails, should be filtered or rejected

---

## Available Metrics

### Safety Metrics (10)
1. **PII Detection** - Detects personally identifiable information
2. **Harm Detection** - Detects harmful language and offensive content
3. **HAP** - Hate, Abuse, and Profanity detection
4. **Social Bias** - Identifies social biases in text
5. **Jailbreak Detection** - Detects attempts to bypass AI safety
6. **Violence Detection** - Identifies violent content
7. **Profanity Detection** - Detects profane language
8. **Unethical Behavior** - Identifies unethical content
9. **Sexual Content** - Detects sexual content
10. **Evasiveness** - Detects evasive or non-responsive answers

### RAG Metrics (3)
11. **Answer Relevance** - How well response addresses the question
12. **Context Relevance** - Relevance of provided context
13. **Faithfulness** - Consistency between response and source context

### Quality Metrics (6)
14. **Answer Completeness (LLM Judge)** - Response completeness
15. **Conciseness (LLM Judge)** - Response brevity
16. **Helpfulness (LLM Judge)** - Response helpfulness
17. **Narrative Quality (LLM Judge)** - Evaluates if narrative accurately summarizes JSON table data
18. **Action Oriented Validator** - Checks for actionable guidance
19. **Unsuccessful Requests** - Detects failed responses

---

## Narrative Quality Metric Example

The **Narrative Quality (LLM Judge)** metric evaluates whether a generated narrative accurately summarizes JSON table data given a question.

### Example Usage

```bash
curl -X POST https://guardrails-api.23jw6l1ualch.us-south.codeengine.appdomain.cloud/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "input_text": "give me coffee suppliers in India",
    "table_data": "[{\"supplier_name\": \"Assam Tea Company\", \"country\": \"India\"}, {\"supplier_name\": \"Brazil Coffee Co\", \"country\": \"Brazil\"}]",
    "generated_text": "Based on the data, there are no coffee suppliers in India. The Indian supplier is a tea company.",
    "interaction_id": "test-001",
    "metrics": ["Narrative Quality (LLM Judge)"]
  }'
```

**Response:**
```json
{
  "status": "success",
  "interaction_id": "test-001",
  "results": {
    "Narrative Quality (LLM Judge)": {
      "score": 1.0,
      "passed": true,
      "category": "quality",
      "guardrail_action": "Pass"
    }
  }
}
```

The metric gave a score of 1.0 (excellent) because the narrative correctly identified that there are no coffee suppliers in India based on the table data.

---

## Integration Examples

### JavaScript (Fetch API)
```javascript
async function evaluateText(inputText, generatedText, options = {}) {
  const response = await fetch(
    'https://guardrails-api.23jw6l1ualch.us-south.codeengine.appdomain.cloud/api/evaluate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_text: inputText,
        generated_text: generatedText,
        table_data: options.tableData,
        interaction_id: options.interactionId,
        context: options.context,
        metrics: options.metrics || ['PII Detection', 'Harm Detection']
      })
    }
  );

  const result = await response.json();
  return result;
}

// Usage Example 1: Basic safety check
const result1 = await evaluateText(
  "What is the weather?",
  "It's sunny today!",
  {
    interactionId: "interaction-123",
    metrics: ["PII Detection", "Harm Detection"]
  }
);

console.log(result1.results);
console.log(result1.interaction_id);

// Usage Example 2: Narrative Quality check
const result2 = await evaluateText(
  "What are the sales for Q4?",
  "Q4 sales were $250,000",
  {
    tableData: '{"Q1": 100000, "Q2": 150000, "Q3": 200000, "Q4": 250000}',
    interactionId: "interaction-124",
    metrics: ["Narrative Quality (LLM Judge)"]
  }
);

// Check guardrail action
if (result2.results["Narrative Quality (LLM Judge)"].guardrail_action === "Block") {
  console.log("Narrative quality failed - regenerate response");
}
```

### Python (requests)
```python
import requests

def evaluate_text(input_text, generated_text, table_data=None, interaction_id=None,
                  context=None, metrics=None):
    url = "https://guardrails-api.23jw6l1ualch.us-south.codeengine.appdomain.cloud/api/evaluate"

    payload = {
        "input_text": input_text,
        "generated_text": generated_text,
        "metrics": metrics or ["PII Detection", "Harm Detection"]
    }

    if table_data:
        payload["table_data"] = table_data
    if interaction_id:
        payload["interaction_id"] = interaction_id
    if context:
        payload["context"] = context

    response = requests.post(url, json=payload)
    return response.json()

# Usage Example 1: Basic safety check
result1 = evaluate_text(
    input_text="What is the weather?",
    generated_text="It's sunny today!",
    interaction_id="interaction-123",
    metrics=["PII Detection", "Harm Detection"]
)

print(result1["results"])
print(result1["interaction_id"])

# Usage Example 2: Narrative Quality check
result2 = evaluate_text(
    input_text="What are the sales for Q4?",
    generated_text="Q4 sales were $250,000",
    table_data='{"Q1": 100000, "Q2": 150000, "Q3": 200000, "Q4": 250000}',
    interaction_id="interaction-124",
    metrics=["Narrative Quality (LLM Judge)"]
)

# Check guardrail action
if result2["results"]["Narrative Quality (LLM Judge)"]["guardrail_action"] == "Block":
    print("Narrative quality failed - regenerate response")
```

### cURL
```bash
curl -X POST https://guardrails-api.23jw6l1ualch.us-south.codeengine.appdomain.cloud/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "input_text": "What is the weather?",
    "generated_text": "It is sunny today!",
    "metrics": ["PII Detection", "Harm Detection"]
  }'
```

---

## Batch Evaluation

For evaluating multiple texts at once:

### Endpoint
```
POST /api/evaluate/batch
```

### Request Body
```json
{
  "items": [
    {
      "input_text": "Question 1",
      "generated_text": "Response 1",
      "table_data": "optional JSON table",
      "interaction_id": "interaction-001"
    },
    {
      "input_text": "Question 2",
      "generated_text": "Response 2",
      "interaction_id": "interaction-002"
    }
  ],
  "metrics": ["PII Detection", "Harm Detection"]
}
```

### Response
```json
{
  "status": "success",
  "batch_results": [
    {
      "record_id": "eval_1",
      "interaction_id": "interaction-001",
      "input": {...},
      "results": {
        "PII Detection": {
          "score": 0.0,
          "passed": true,
          "category": "safety",
          "guardrail_action": "Pass"
        }
      }
    },
    {
      "record_id": "eval_2",
      "interaction_id": "interaction-002",
      "input": {...},
      "results": {...}
    }
  ],
  "total_items": 2,
  "metrics_evaluated": ["PII Detection", "Harm Detection"],
  "timestamp": "2025-12-05T23:07:54.917995"
}
```

---

## Typical Integration Workflow

1. **User submits question** in your web portal
2. **Your AI generates response** (optionally with table data)
3. **Call guardrails API** with question, response, and interaction ID:
   ```javascript
   const evaluation = await evaluateText(userQuestion, aiResponse, {
     tableData: tableJson, // if using Narrative Quality
     interactionId: generateUniqueId(),
     metrics: [
       "PII Detection",
       "Harm Detection",
       "Helpfulness (LLM Judge)",
       "Narrative Quality (LLM Judge)"
     ]
   });
   ```
4. **Check guardrail_action** before showing response to user:
   ```javascript
   // Simple approach - check any metric
   for (const [metricName, result] of Object.entries(evaluation.results)) {
     if (result.guardrail_action === "Block") {
       return {
         blocked: true,
         reason: `${metricName} failed (score: ${result.score})`,
         interactionId: evaluation.interaction_id
       };
     }
   }
   ```
5. **Display response** to user (if all guardrails passed)

---

## Error Handling

### Error Response Format
```json
{
  "status": "error",
  "error": "Error message",
  "timestamp": "2025-12-05T23:07:54.917995"
}
```

### Common Errors
- **400 Bad Request**: Missing required fields or invalid metric names
- **500 Internal Server Error**: Evaluation failed or credentials issue

### Example Error Handling (JavaScript)
```javascript
try {
  const result = await evaluateText(inputText, generatedText);

  if (result.status === "error") {
    console.error("Evaluation failed:", result.error);
    // Handle error
  } else {
    // Process results
  }
} catch (error) {
  console.error("API request failed:", error);
  // Handle network error
}
```

---

## Example: Complete Integration

```javascript
// Example: Integrate into a chatbot with table data support
async function sendMessageWithGuardrails(userMessage, tableData, generateResponse) {
  // 1. Generate AI response
  const aiResponse = await generateResponse(userMessage, tableData);
  const interactionId = `chat-${Date.now()}-${Math.random()}`;

  // 2. Evaluate response for safety and quality
  const evaluation = await fetch(
    'https://guardrails-api.23jw6l1ualch.us-south.codeengine.appdomain.cloud/api/evaluate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_text: userMessage,
        generated_text: aiResponse,
        table_data: tableData ? JSON.stringify(tableData) : null,
        interaction_id: interactionId,
        metrics: [
          "PII Detection",
          "Harm Detection",
          "Helpfulness (LLM Judge)",
          "Narrative Quality (LLM Judge)"
        ]
      })
    }
  ).then(r => r.json());

  // 3. Check guardrail actions (simple approach)
  for (const [metricName, result] of Object.entries(evaluation.results)) {
    if (result.guardrail_action === "Block") {
      console.log(`Blocked by ${metricName}: score ${result.score}`);

      // Return appropriate error message based on metric
      if (metricName.includes("PII")) {
        return "I apologize, but I cannot share that information as it may contain personal data.";
      }
      if (metricName.includes("Harm")) {
        return "I apologize, but I cannot provide that response.";
      }
      if (metricName.includes("Narrative Quality")) {
        return "I apologize, but my response may not accurately reflect the data. Let me try again.";
      }

      // Generic block message
      return "I apologize, but I cannot provide that response at this time.";
    }
  }

  // 4. All guardrails passed - log and return
  console.log(`✓ All guardrails passed for interaction ${evaluation.interaction_id}`);
  return aiResponse;
}

// Usage
const response = await sendMessageWithGuardrails(
  "What are the coffee suppliers in India?",
  [{supplier_name: "Assam Tea Co", country: "India"}],
  myAIGenerateFunction
);
```
