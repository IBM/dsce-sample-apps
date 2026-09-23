# AI guardrails

This repository demonstrates how to use the Watsonx Governance SDK to implement real-time guardrails for generative AI models. These guardrails help you instantly detect and control undesired behavior. For example, you may choose to block certain responses or guide the model toward a safer or more appropriate completion. **These highly customizable AI guardrails can be applied to both AI inputs** (evaluating and filtering user queries before they reach the model) **and AI outputs** (ensuring generated responses are checked before being returned to end users).

To showcase these capabilities, we provide a Dash-based web application that performs real-time evaluations for content safety, bias detection, RAG quality metrics, and more.

## Features

- **Content Safety Metrics:** HAP, PII Detection, Harm Detection, Violence, Profanity, Social Bias, Jailbreak Detection, Unethical Behavior, Sexual Content, Evasiveness

- **RAG Evaluation Metrics:** Answer Relevance, Context Relevance, Faithfulness

- **Response Quality Metrics (LLM as Judge and Custom Metrics):** Answer Completeness, Conciseness, Helpfulness, Action-Oriented Validator

- **Interactive Dashboard:** Select multiple guardrails, adjust risk thresholds, and view color-coded results

- **Export Results:** Download evaluation results as CSV files

<img src="images/demo-landing-page.png" 
     alt="demo-landing-page" 
     style="width: 90%;"/>

### How to Use These Metrics to Block Undesired AI Behavior

You can block undesired AI behavior by configuring customizable thresholds for each metric.

For content safety metrics, you can set an upper-limit thresholds that determine when content becomes unsafe for your application. Each metric can have its own threshold. For example, if your use case is more sensitive to **Jailbreak** attempts than **HAP**, you can configure a lower upper-limit for the Jailbreak metric to make your guardrail more sensitive to those risks.

For RAG evaluation metrics (Answer Relevance, Context Relevance, Faithfulness), you can set the lower-limit thresholds to enforce quality standards. If a generated answer falls below the required score, you can block the output or trigger an alternative workflow (e.g., regeneration, human review).

For response quality metrics, you can use LLM as judge or define your rule based or code based custom metrica. For example, **Conciseness** uses LLM as judge to evaluate the agent's response in terms of conciseness. **Action-oriented validator**, on the other hand, is a custom rule-based custom metric that evlaute's the agent's response in terms of how action oriented it ia. These metrics can be used to block agent's response (output) or trigger an alternative workflow (e.g., regeneration, human review).

## Prerequisites

- Python 3.11 (not python 3.13)
- IBM watsonx.ai account with API credentials
- IBM watsonx.governance access

## Setup Instructions

### 1. Create Virtual Environment

```bash
python3.11 -m venv my-venv
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

The `.env` file should already be present with your credentials. Verify it contains:

```env
## IBM watsonx.governance API Configuration
WATSONX_APIKEY=your_watsonx_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com

## Service Instance ID (required if you have multiple instances)
WXG_SERVICE_INSTANCE_ID=your_service_instance_id_here

## Project ID for watsonx.governance
WXG_PROJECT_ID=your_project_id_here

## Optional: Region (default is us-south)
# WATSONX_REGION=us-south

## OpenAI API Key (if using OpenAI as LLM judge)
# OPENAI_API_KEY=your_openai_api_key_here
```

To get your credentials:

- **API Key**: [IBM Cloud Console](https://cloud.ibm.com/) > Manage > Access (IAM) > API keys
- **Service Instance ID**: Find in your watsonx.governance service details

### 5. Run the Application

```bash
python app.py
```

The app will start on `http://127.0.0.1:8050` (loopback only by default).

Optional environment variables:

- `SERVICE_PORT` — port to bind (default `8050`)
- `SERVICE_HOST` — interface to bind. Defaults to `127.0.0.1`. Set to `0.0.0.0` only when you intentionally want to expose the app on all interfaces (e.g. inside a container).
- `DEBUG_MODE` — set to `true` to enable Flask/Dash debug mode. Defaults to `false`. **Do not enable debug mode in any environment reachable from outside your machine** — it exposes an interactive Python console.

## Security & Deployment Notes

This application is provided as a **local sample** to demonstrate the Watsonx Governance SDK. It is intentionally scoped for a developer running it on their own machine via `python app.py`.

It does **not** include the controls you would expect from a production service. Before exposing this app to any network beyond your loopback interface, you (or your platform team) should add:

- **Authentication and authorization** in front of the app (e.g. via a reverse proxy such as nginx, an identity provider, or IBM Cloud IAM)
- **TLS termination** at the proxy
- **Rate limiting** to protect the IBM Watsonx API quotas this app consumes
- **A secrets manager** (e.g. IBM Cloud Secrets Manager) instead of a `.env` file
- **Centralized logging and monitoring**
- **Dependency scanning** as part of your build pipeline (`pip-audit`, Snyk, or similar)

Other notes:

- User-entered text is passed to LLM-as-judge prompts. The prompts in this sample use delimiters and explicit "treat as data" framing to reduce prompt-injection risk, but no prompt-side mitigation is bulletproof. If you adapt this code to a higher-trust setting, also apply input validation and content filtering.
- CSV exports are sanitized against spreadsheet formula injection (cells starting with `=`, `+`, `-`, `@`, tab, or CR are prefixed with `'`).
- Exception details are logged server-side rather than rendered in the UI; check the server console when investigating evaluation failures.

## Key Components

### Metrics Categories

**Content Safety**

- Detects harmful, biased, or inappropriate content
- Identifies security threats like jailbreak attempts
- Filters PII and sensitive information

**RAG Evaluation**

- Assesses quality of retrieval-augmented generation
- Measures relevance and faithfulness
- Validates context usage

**Response Quality Metrics**

- Evaluates the completeness of the agent's response
- Evaluates the conciseness of the agent's response
- Evaluates the helpfulness of the agent's response
- Evaluates whether the agent's response is action oriented

## Troubleshooting

**Issue: "Failed to initialize evaluator"**

- Check your `.env` file contains valid credentials
- Verify API key has necessary permissions
- Ensure service instance ID is correct

**Issue: Dependencies installation fails**

- Ensure you're using Python 3.11+
- Try upgrading pip: `pip install --upgrade pip`
- Install dependencies one at a time to identify issues
