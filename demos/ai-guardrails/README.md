# Real-Time AI Guardrails

This demo shows how to use the IBM watsonx.governance SDK to implement real-time guardrails for generative AI applications and agents. Guardrails detect undesired behavior as it happens, so you can block a request before it reaches the model, or block a response before it reaches the user. **They can be applied to both AI inputs** (evaluating user queries before they reach the model) **and AI outputs** (checking generated responses before they are returned to end users).

The demo is a Dash web application that evaluates built-in sample scenarios against content safety, retrieval-augmented generation (RAG) and response quality metrics.

## Features

- **Content Safety Metrics:** HAP, PII Detection, Harm Detection, Violence, Profanity, Social Bias, Jailbreak Detection, Unethical Behavior, Sexual Content, Evasiveness

- **RAG Evaluation Metrics:** Answer Relevance, Context Relevance, Faithfulness

- **Response Quality Metrics (LLM as Judge and Custom Metrics):** Answer Completeness, Conciseness, Helpfulness, Unsuccessful Requests, Action Oriented Validator

- **Configurable thresholds:** every metric has its own threshold between 0 and 1

- **Export Results:** download evaluation results as CSV files

<img src="images/demo-landing-page.png"
     alt="demo-landing-page"
     style="width: 90%;"/>

## Sample Scenarios

The demo evaluates four built-in scenarios. Select one with the buttons above the query, choose the metrics on the left, and click **Run Guardrails**.

| Scenario | What it shows |
|---|---|
| Content Safety: PII & Jailbreak | A message that shares personal data and tries to switch the assistant into an unrestricted mode. Several content safety metrics block the input. |
| RAG: Unsupported Answer | The assistant claims a bank decline and a credit that the supplied context never mentions. Faithfulness blocks the output while answer and context relevance pass. |
| Response Quality: Long & Incomplete | A friendly but padded answer that stops before the final steps. Completeness and conciseness block, while helpfulness passes. |
| Response Quality: No Next Steps | The assistant explains a problem but gives no steps to fix it. The custom Action Oriented Validator blocks it. |

The query, context and response fields are read-only, and the server evaluates only these built-in scenarios.

### How to Use These Metrics to Block Undesired AI Behavior

You can block undesired AI behavior by configuring a threshold for each metric. Thresholds range from 0 to 1, in steps of 0.05. After changing a threshold, click **Run Guardrails** again to apply it.

For content safety metrics, a high score means risk: content is blocked when its score is at or above the threshold. Each metric can have its own threshold. For example, if your use case is more sensitive to **Jailbreak** attempts than **HAP**, you can set a lower threshold for Jailbreak to make that guardrail stricter.

For RAG evaluation metrics (Answer Relevance, Context Relevance, Faithfulness), a low score means risk: the output is blocked when its score is at or below the threshold. If a generated answer falls below the required score, you can block the output or trigger an alternative workflow (for example regeneration or human review).

For response quality metrics, you can use an LLM as judge or write your own rule-based or code-based custom metric. For example, **Conciseness** uses an LLM as judge to evaluate whether the agent's response is concise. **Action Oriented Validator**, on the other hand, is a rule-based custom metric written for this demo that checks whether the agent's response gives the user concrete next steps. These metrics can be used to block the agent's response or trigger an alternative workflow.

## Prerequisites

- Python 3.11 or 3.12
- An IBM watsonx.governance service instance
- A watsonx.ai project with a watsonx.ai Runtime associated (used by the three LLM-as-judge metrics)
- An IBM Cloud API key with access to both

## Setup Instructions

Run these commands from the `demos/ai-guardrails` folder.

### 1. Create Virtual Environment

```bash
python3.11 -m venv venv
```

### 2. Activate Virtual Environment

**MacOS/Linux:**

```bash
source venv/bin/activate
```

**Windows (CMD):**

```cmd
venv\Scripts\activate.bat
```

**Windows (PowerShell):**

```powershell
venv\Scripts\Activate.ps1
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in this folder containing:

```env
## IBM Cloud API key
WATSONX_APIKEY=your_watsonx_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com

## watsonx.governance service instance ID
WXG_SERVICE_INSTANCE_ID=your_service_instance_id_here

## watsonx.ai project ID (used by the LLM-as-judge metrics)
WXG_PROJECT_ID=your_project_id_here
```

To get your credentials:

- **API Key**: [IBM Cloud Console](https://cloud.ibm.com/) > Manage > Access (IAM) > API keys
- **Service Instance ID**: the GUID in your watsonx.governance service instance details
- **Project ID**: in your watsonx.ai project, under Manage > General

The `.env` file is excluded from git by this folder's `.gitignore`. Never commit it.

### 5. Run the Application

```bash
python app.py
```

The app will start on `http://127.0.0.1:8050` (loopback only by default).

Optional environment variables:

- `SERVICE_PORT` — port to bind (default `8050`)
- `SERVICE_HOST` — interface to bind. Defaults to `127.0.0.1`. Set to `0.0.0.0` only when you intentionally want to expose the app on all interfaces (e.g. inside a container).
- `DEBUG_MODE` — set to `true` to enable Flask/Dash debug mode. Defaults to `false`. **Do not enable debug mode in any environment reachable from outside your machine** — it exposes an interactive Python console.

## Deploying to IBM Cloud Code Engine

The included `Dockerfile` serves the app with gunicorn rather than the Flask development server, runs as a non-root user, and sets `DEBUG_MODE=false`, `SERVICE_HOST=0.0.0.0` and `SERVICE_PORT=8080`. Because gunicorn never calls `app.run()`, debug mode cannot be enabled in the container.

```bash
ibmcloud login --sso
ibmcloud target -r <region> -g <resource-group>
ibmcloud ce project select --name <code-engine-project>

# Store the credentials as a Code Engine secret; never bake them into the image
ibmcloud ce secret create --name ai-guardrails-wx \
  --from-literal WATSONX_APIKEY=<api-key> \
  --from-literal WATSONX_URL=https://<region>.ml.cloud.ibm.com \
  --from-literal WXG_SERVICE_INSTANCE_ID=<instance-id> \
  --from-literal WXG_PROJECT_ID=<project-id>

# Build from this folder and deploy
ibmcloud ce application create --name ai-guardrails \
  --build-source . --strategy dockerfile --port 8080 \
  --env-from-secret ai-guardrails-wx \
  --env DEBUG_MODE=false --env SERVICE_HOST=0.0.0.0 --env SERVICE_PORT=8080 \
  --min-scale 1 --max-scale 2 --cpu 1 --memory 4G
```

## Security & Deployment Notes

This application is a demo of the watsonx.governance SDK. It does **not** include the controls you would expect from a production service. Before exposing it beyond a demo environment, you (or your platform team) should add:

- **Authentication and authorization** in front of the app (e.g. via a reverse proxy such as nginx, an identity provider, or IBM Cloud IAM)
- **TLS termination** at the proxy
- **Rate limiting** to protect the IBM watsonx API quotas this app consumes
- **A secrets manager** (e.g. IBM Cloud Secrets Manager) instead of a `.env` file
- **Centralized logging and monitoring**
- **Dependency scanning** as part of your build pipeline (`pip-audit`, Snyk, or similar)

Other notes:

- The evaluation endpoint accepts only the built-in sample scenarios, so the app cannot be used to evaluate arbitrary text with your credentials.
- Text is passed to LLM-as-judge prompts with delimiters and explicit "treat as data" framing to reduce prompt-injection risk. No prompt-side mitigation is bulletproof; if you adapt this code to accept user input, also apply input validation and content filtering.
- CSV exports are sanitized against spreadsheet formula injection (cells starting with `=`, `+`, `-`, `@`, tab, or CR are prefixed with `'`).
- Exception details are logged server-side rather than rendered in the UI; check the server console when investigating evaluation failures.

## Key Components

### Metrics Categories

**Content Safety**

- Detects harmful, biased, or inappropriate content
- Identifies security threats like jailbreak attempts
- Filters PII and sensitive information

**RAG Evaluation**

- Assesses the quality of retrieval-augmented generation
- Measures relevance and faithfulness
- Validates context usage

**Response Quality Metrics**

- Evaluates the completeness of the agent's response
- Evaluates the conciseness of the agent's response
- Evaluates the helpfulness of the agent's response
- Evaluates whether the agent's response is action oriented

## Troubleshooting

**Issue: "Failed to initialize evaluator"**

- Check your `.env` file contains `WATSONX_APIKEY` and `WXG_SERVICE_INSTANCE_ID`
- Verify the API key has access to your watsonx.governance instance
- Ensure the service instance ID is correct

**Issue: Changing a threshold has no effect**

- Enter a value between 0 and 1 in steps of 0.05 (for example 0.65 or 0.9); other values are rejected and the default is used
- Click **Run Guardrails** again after changing a threshold

**Issue: Dependencies installation fails**

- Ensure you're using Python 3.11 or 3.12
- Try upgrading pip: `pip install --upgrade pip`
- Install dependencies one at a time to identify issues
