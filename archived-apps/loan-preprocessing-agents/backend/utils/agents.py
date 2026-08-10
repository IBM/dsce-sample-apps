from typing import Optional, List
import os
import json
import requests
from tinydb import TinyDB, Query
from langchain_core.output_parsers import JsonOutputParser
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv(override=True)

WXO_API_KEY = os.getenv("WXO_API_KEY")
WXO_INSTANCE_ID = os.getenv("WXO_INSTANCE_ID")
DOC_PROCESSOR_AGENT_ID = os.getenv("DOC_PROCESSOR_AGENT_ID")
DOCUMENT_VALIDATION_AGENT_ID = os.getenv("DOCUMENT_VALIDATION_AGENT_ID")
FINAL_DECISION_AGENT_ID = os.getenv("FINAL_DECISION_AGENT_ID")
WXO_INSTANCE_CLOUD = os.getenv("WXO_INSTANCE_CLOUD", "ibmcloud")
WXO_INSTANCE_CLOUD_REGION = os.getenv("WXO_INSTANCE_CLOUD_REGION", "us-south")

if WXO_INSTANCE_CLOUD == "ibmcloud":
    base_url = f"https://api.{WXO_INSTANCE_CLOUD_REGION}.watson-orchestrate.cloud.ibm.com/instances/{WXO_INSTANCE_ID}/v1/orchestrate"
else:
    base_url = f"https://api.dl.watson-orchestrate.ibm.com/instances/{WXO_INSTANCE_ID}/v1/orchestrate"

# Initialize TinyDB
db = TinyDB("logs.json")
Logs = Query()

def log_to_db(application_id: str, stage: str, data: dict):
    """Store log data in TinyDB under the application_id with a timestamp"""
    db.insert({
        "application_id": application_id,
        "stage": stage,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "data": data
    })

def get_bearer_token(API_KEY) -> str:
    """Obtain bearer token from API key"""
    if WXO_INSTANCE_CLOUD == "aws":
        url = "https://iam.platform.saas.ibm.com/siusermgr/api/1.0/apikeys/token"

        headers = {
            "accept": "application/json",
            "content-type": "application/json"
        }
        data = {
            "apikey": API_KEY
        }
        response = requests.post(url, headers=headers, data=json.dumps(data))
        token = response.json().get("token")
    elif WXO_INSTANCE_CLOUD =="ibmcloud":
        api_url_token = 'https://iam.cloud.ibm.com/identity/token'
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        payload = f"grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={API_KEY}"
        response = requests.post(url=api_url_token, headers=headers, data=payload)
        if response.status_code != 200:
            raise Exception("Non-200 response: " + str(response.text))
        token = response.json()["access_token"]
    return token


def create_thread(agent_id: str, message: str, token: Optional[str] = None) -> str:
    payload = {
        "title": message,
        "agent_id": agent_id
    }

    if token is None:
        token = get_bearer_token(WXO_API_KEY)
    headers = {
        'Authorization': f"Bearer {token}",
        'Content-Type': 'application/json'
    }

    url = f"{base_url}/threads"
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    if response.status_code != 201:
        raise Exception(response.content.decode("utf-8"))
    
    data = response.json()
    return data["thread_id"]

def get_response(message:str, agent_id: str, thread_id: Optional[str] = None, application_id: Optional[str] = None):
    token = get_bearer_token(WXO_API_KEY)

    if not thread_id:
        thread_id = create_thread(agent_id, message, token)

    payload = {
        "message": {
            "role": "user",
            "content": message
        },
        "additional_properties": {},
        "context": {},
        "agent_id": agent_id,
        "thread_id": thread_id
    }

    headers = {
        'Authorization': f"Bearer {token}",
        'Content-Type': 'application/json'
    }

    url = f"{base_url}/runs/stream"

    response = requests.post(url, headers=headers, data=json.dumps(payload), stream=True)
    if response.status_code != 200:
        raise Exception(response.content.decode("utf-8"))
    answer = ""
    for line in response.iter_lines():
        if line:
            try:
                decoded = line.decode("utf-8")
                event_data = json.loads(decoded)

                if event_data.get("event") == "run.step.delta":
                    step_delta = event_data.get("data", {}).get("delta", {})
                    print(step_delta)
                    if application_id:
                        step_details = step_delta.get("step_details", [])
                        if step_details:
                            step_detail_dict = step_details[0]
                            step_type = step_detail_dict.get("type")
                            if step_type in ["tool_call", "tool_calls"]:
                                log_to_db(application_id, "tool_call", json.dumps(step_detail_dict.get("tool_calls", []), indent=4))
                            elif step_type == "tool_response":
                                log_to_db(application_id, "tool_response", json.dumps(step_detail_dict.get("content", []), indent=4))
                            else:
                                log_to_db(application_id, "delta", json.dumps(step_detail_dict, indent=4))
                if event_data.get("event") == "message.created":
                    answer = event_data["data"]["message"]["content"][0]["text"]
                    thread_id = event_data["data"].get("thread_id", "")
                    break  
            except json.JSONDecodeError:
                continue
    if application_id:
        log_to_db(application_id, "agent_response", answer)
    return {"response": answer, "thread_id": thread_id}


def invoke_agents(document_names, loan_application_file, application_id=None):
    if application_id:
        log_to_db(application_id, "invoke_agent", "Invoking Document Processor Agent")
    doc_processor_message = f"Classify and extract information from these documents - {document_names}"
    doc_processor_response = get_response(doc_processor_message, DOC_PROCESSOR_AGENT_ID, application_id=application_id)
    if application_id:
        log_to_db(application_id, "invoke_agent", "Invoking Document Validator Agent")
    doc_validation_message = f"Validate these documents - {document_names}"
    doc_validation_response = get_response(doc_validation_message, DOCUMENT_VALIDATION_AGENT_ID, application_id=application_id)
    if application_id:
        log_to_db(application_id, "invoke_agent", "Invoking Final Decision Agent")
    final_agent_message = f"""Loan Application Form - {loan_application_file}

Submitted Document details:
{doc_processor_response['response']}

Document Validation Result:
{doc_validation_response['response']}
"""
    final_agent_response = get_response(final_agent_message, FINAL_DECISION_AGENT_ID, application_id=application_id)

    loan_application_status = JsonOutputParser().parse(final_agent_response["response"])
    return loan_application_status

def get_logs(application_id: str) -> List[dict]:
    """Retrieve all logs for a given application_id"""
    return db.search(Logs.application_id == application_id)
