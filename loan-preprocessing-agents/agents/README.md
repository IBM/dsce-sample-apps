# Loan Processing WxO Agents

A modular agent-based system for automating loan application processing, document validation, and decision-making using IBM Watsonx Orchestrate.

---

## 🗂 Overview

This system consists of several agents, each responsible for a specific step in the loan processing workflow:

1. **Document Processor Agent**
   - Classifies uploaded documents (e.g., Driving License, Passport, SSN)
   - Extracts Personally Identifiable Information (PII)

2. **Document Validation Agent**
   - Validates document authenticity
   - Flags fake or inconsistent documents

3. **Cross Validation Agent**
   - Compares user-provided application data with extracted document data
   - Ensures consistency across all fields (case-insensitive)

4. **Final Decision Agent**
   - Reads the loan application form
   - Invokes cross-validation and document validation agents
   - Verifies applicant age (must be ≥ 18 years)
   - Makes the final approval or rejection decision

---

## 📁 Directory Structure

```
connections/         # Connection configs for COS and WatsonX
data_processing/     # Document processing agent YAML, tools, requirements
document_validate/   # Document validation agent YAML, tools, requirements
cross_validation/    # Cross validation agent YAML
final_decision/      # Final decision agent YAML, tools, requirements
```

---

## ⚙️ How It Works

1. **User uploads documents and fills out the loan application form**
2. **Document Processor Agent** classifies and extracts PII
3. **Document Validation Agent** checks authenticity
4. **Cross Validation Agent** compares application and document data
5. **Final Decision Agent** aggregates results, verifies age, and makes the final decision

---

## 🚀 Quickstart

### Prerequisites

- Install [`uv`](https://docs.astral.sh/uv/getting-started/installation/) (a fast Python package manager)

### 1. Clone the Repository

```bash
git clone https://github.ibm.com/Abhijeet-Gorai/loan_processing_adk_agents.git
```

### 2. Install Dependencies

```bash
uv sync
```

### 3. Activate Environment

```bash
source ".venv/bin/activate"
```

---

## 🛠 ADK Command Line Tool

After installation, use the WXO CLI tool via the `orchestrate` command:

```bash
orchestrate --help
```

Explore available commands for managing environments, agents, tools, connections, and more.

---

## 🏗 Agent, Tool, and Connection Setup

### 1. Configure ADK Environment

```bash
orchestrate env add -n <your_env_name> -u <your wxo service instance url>
orchestrate env activate <your_env_name> --api-key <your_wxo_api_key>
```

### 2. Set WxO Connections

- Create an `.env` file in `connections/` (see [.env_example](connections/.env_example))
- Run the connection setup script:

```bash
cd connections
orchestrate connections import --file cos_connection.yaml
orchestrate connections import --file wxai_connection.yaml
bash ./wxo_connections.sh
```

### 3. Import Agents and Tools

#### Data Processing Agent

```bash
orchestrate tools import -k python -f data_processing/tools/data_processing_tools.py --app-id wxai_credential --app-id cos_credential
orchestrate agents import -f data_processing/agents/data_processing_agent.yaml
```

#### Document Validation Agent

```bash
orchestrate tools import -k python -f document_validate/tools/validate_document.py --app-id wxai_credential --app-id cos_credential
orchestrate agents import -f document_validate/agents/document_validate.yaml
```

#### Cross Validation Agent

```bash
orchestrate agents import -f cross_validation/agents/cross_validation.yaml
```

#### Final Decision Agent

```bash
orchestrate tools import -k python -f final_decision/tools/final_decision_tools.py --app-id cos_credential
orchestrate agents import -f final_decision/agents/final_decision.yaml
```

---

## ▶️ Running the Agents

1. **List Deployed Agents**

   ```bash
   orchestrate agents list
   ```
   _Note down the agent IDs for later use._

2. **Create Base `.env` File**

   - Use the provided [.env_example](./.env_example) as a template and fill in all required values.

3. **Execute the Notebook**

   - Run `test_agents.ipynb` to validate the workflow.

---

## 📚 Documentation

- For more details, visit the [Watson Orchestrate Developer Docs](https://developer.watson-orchestrate.ibm.com/)

---
