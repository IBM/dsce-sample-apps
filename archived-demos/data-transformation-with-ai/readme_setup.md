# Setup Guide: Retail SQL Agent FastAPI Service

This guide explains how to set up, configure, and run the **ABC Bank NL2SQL** built with FastAPI and LangChain.

---

## 1. Prerequisites

Ensure the following are installed on your system:

* Python 3.9 or higher
* pip
* Virtual environment tool (optional but recommended)
* [Db2 setup](./setup_db2.md)
* [Presto setup](./setup_presto.md)
* [Datastage setup](./setup_datastage.md)

Verify:

```bash
python --version
pip --version
```

---

## 2. Project Structure

Recommended folder structure:

```
code-engine/
│
├── app.py
├── agents/
│   └── sql_agent.py
├── services/
│   └── presto.py
├── .env
├── presto_data_dictionary.json
├── requirements.txt
└── Dockerfile
```

### Notes:

* `app.py` → contains your FastAPI application
* `agents/sql_agent.py` → should define `create_sql_agent()`
* `.env` → stores environment variables

---

## 3. Create Virtual Environment

```bash
python -m venv venv

# Activate
# macOS / Linux
source venv/bin/activate

# Windows
venv\\Scripts\\activate
```

---

## 4. Install Dependencies

Create `requirements.txt`:

```
fastapi
uvicorn
python-dotenv
langchain
pydantic
```

Install:

```bash
pip install -r requirements.txt
```

If your sql_agent uses databases or LLMs, also add:

```
psycopg2-binary
sqlalchemy
openai
```

(as required by your implementation)

---

## 5. Environment Variables

Create a `.env` file in root directory:

```
WATSONX_ENDPOINT=
WATSONX_URL=
WATSONX_PROJECT_ID=
WATSONX_API_KEY=
IBM_CLOUD_API_KEY=
WATSONX_MODEL_ID=
```
### Presto setting
You will find all the details, when you set up Presto engine , you can find the details [here](./setup_presto.md)
```
PRESTO_HOST= 
PRESTO_PORT=
PRESTO_HTTP_SCHEME=https   # use "http" if not TLS-enabled

PRESTO_CATALOG=iceberg_data
PRESTO_SCHEMA=loandata2
```
### Presto Authentication
These details you can set up in two ways, 
1. Username will be ibmlhapikey__username or ibmlhapikey_serviceid
a). If you're using ibmlhapikey_username, i.e ibmlhapikey_ruhin.shaikh@ibm.com, the user has to create a APIKEY (IAM API KEY) and then that will be the password, ensure that the user has access to the Presto Engine, you can add access as mentioned in [setup_presto.md](./setup_presto.md)
b).  If you're using ibmlhapikey_serviceid, you can find the service id details in the techzone env you have initialized, scroll and you will find the service id and the api key, ensure the service id has access to the Presto Engine, you can add access as mentioned in [setup_presto.md](./setup_presto.md)
  
  <img width="1000" alt="image" src="./assets/ds-24.png">

```
PRESTO_USER=
PRESTO_PASSWORD=
```

These variables will be loaded using:

```python
from dotenv import load_dotenv
load_dotenv()
```

---

## 6. sql_agent Implementation Example

In `agents/sql_agent.py`:

```python
from langchain.agents import initialize_agent
from langchain.llms import OpenAI


def create_sql_agent():
    llm = OpenAI(temperature=0)
    agent = initialize_agent(
        tools=[],
        llm=llm,
        agent="chat-conversational-react-description"
    )
    return agent
```

Modify this to connect to your database or WatsonX SQL agent as needed.

---

## 7. Running the Application

Run locally:

```bash
python app.py
```

OR using uvicorn directly:

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8080
```

You should see:

```
Uvicorn running on http://0.0.0.0:8080
```

---

## 8. API Endpoints

### Health Check

```
GET /
```

### SQL Agent Endpoint

```
POST /v1/sql_agent
```

Request example:

```json
{
  "model": "sql_agent",
  "messages": [
    {"role": "user", "content": "Show total sales for last month"}
  ],
  "stream": false
}
```

Header (optional):

```
X-IBM-THREAD-ID: session-123
```

---

## 9. Test Using cURL

```bash
curl -X POST http://localhost:8080/v1/sql_agent \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sql_agent",
    "messages": [
      {"role": "user", "content": "List top 5 products by revenue"}
    ],
    "stream": false
  }'
```

---

## 10. Streaming Mode Example

```json
{
  "model": "sql_agent",
  "messages": [
    {"role": "user", "content": "Give me sales summary by region"}
  ],
  "stream": true
}
```

Response will be streamed as Server Sent Events (SSE).

---

## 11. Common Issues & Fixes

### Port already in use

```bash
lsof -i :8080
kill -9 <PID>
```

### ModuleNotFoundError

```bash
pip install modulename
```

### Agent not found error

Ensure `agent_executors` contains:

```python
agent_executors = {
    "sql_agent": create_sql_agent()
}
```

---

## 12. Production Deployment (Optional)

Run using gunicorn:

```bash
pip install gunicorn

gunicorn -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:8080
```

---
* Swagger access: [http://localhost:8080/docs](http://localhost:8080/docs)
* ReDoc: [http://localhost:8080/redoc](http://localhost:8080/redoc)

---

## ✅ You are ready!

Your Loan SQL Agent API is now fully set up and ready to accept natural language queries.

