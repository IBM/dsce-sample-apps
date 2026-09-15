"""
agent_client.py — watsonx Orchestrate SDK integration for the incident resolution demo.

Invocation flow:
  1. Build a structured prompt from the incident dict
  2. POST to WXO runs endpoint via RunClient.create_run()
  3. Poll for completion via wait_for_run_completion()
  4. Fetch the completed assistant message via ThreadsClient.get_thread_messages()
  5. Parse the agent's plain-text response into a structured AnalysisResult

The agent is expected to format its response with three section headers:
  ROOT CAUSE:
  SEVERITY CLASSIFICATION:
  REMEDIATION STEPS:
"""

import os
import re
import asyncio
import logging
from typing import Optional

from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from ibm_watsonx_orchestrate_clients.agents.agent_client import AgentClient
from ibm_watsonx_orchestrate_clients.chat.run_client import RunClient
from ibm_watsonx_orchestrate_clients.threads.threads_client import ThreadsClient

logger = logging.getLogger(__name__)

# ── Configuration (loaded from environment) ───────────────────────────────────
WXO_INSTANCE_URL = os.getenv("WXO_INSTANCE_URL", "").rstrip("/")
WXO_API_KEY = os.getenv("WXO_API_KEY", "")
AGENT_NAME = os.getenv("AGENT_NAME", "incident_resolution_agent")
RUN_TIMEOUT_SECONDS = int(os.getenv("RUN_TIMEOUT_SECONDS", "120"))

# Cache resolved agent UUID to avoid re-fetching on every request
_agent_id_cache: Optional[str] = None


def _resolve_agent_id(authenticator) -> str:
    """
    Resolve the agent name to its UUID using the AgentClient.
    Result is cached after the first successful lookup.
    """
    global _agent_id_cache
    if _agent_id_cache:
        return _agent_id_cache

    agent_client = AgentClient(base_url=WXO_INSTANCE_URL, authenticator=authenticator)
    results = agent_client.get_draft_by_name(AGENT_NAME)

    # get_draft_by_name returns a list
    agents = results if isinstance(results, list) else [results]
    if not agents:
        raise RuntimeError(f"Agent '{AGENT_NAME}' not found in WXO. Run agent/deploy.sh first.")

    _agent_id_cache = agents[0]["id"]
    logger.info(f"Resolved agent '{AGENT_NAME}' → UUID: {_agent_id_cache}")
    return _agent_id_cache


def _build_prompt(incident: dict) -> str:
    """Format incident data into the structured prompt sent to the agent."""
    log_block = "\n".join(incident.get("logs", []))
    return (
        f"Incident ID: {incident['id']}\n"
        f"Title: {incident['title']}\n"
        f"Reported Severity: {incident['severity']}\n"
        f"Affected Service: {incident['affected_service']}\n"
        f"Detected At: {incident['timestamp']}\n"
        f"\n"
        f"Log Output:\n"
        f"{log_block}\n"
        f"\n"
        f"Please analyze this incident and provide:\n"
        f"1. Root cause analysis\n"
        f"2. Severity classification with justification\n"
        f"3. Step-by-step remediation runbook"
    )


def _extract_text_from_message(message: dict) -> str:
    """
    Extract plain text from a WXO thread message.
    Handles both string content and list-of-content-items format.
    """
    content = message.get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("response_type") == "text":
                    parts.append(item.get("text", ""))
                elif "text" in item:
                    parts.append(item["text"])
        return "\n".join(parts)
    return str(content)


def _parse_agent_response(incident_id: str, raw_text: str) -> dict:
    """
    Parse the agent's structured plain-text response into an AnalysisResult dict.

    Expected format from agent instructions:
        ROOT CAUSE:
        <text>

        SEVERITY CLASSIFICATION:
        <level>: <justification>

        REMEDIATION STEPS:
        1. <step>
        2. <step>
        ...
    """
    # Normalize line endings
    text = raw_text.strip().replace("\r\n", "\n")

    # ── Root Cause ────────────────────────────────────────────────────────────
    root_cause = ""
    rc_match = re.search(
        r"ROOT CAUSE[:\s*]*\n(.+?)(?=\nSEVERITY CLASSIFICATION|\nREMEDIATION STEPS|$)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if rc_match:
        root_cause = rc_match.group(1).strip()

    # ── Severity Classification ───────────────────────────────────────────────
    severity_classification = ""
    sc_match = re.search(
        r"SEVERITY CLASSIFICATION[:\s*]*\n(.+?)(?=\nREMEDIATION STEPS|$)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if sc_match:
        severity_classification = sc_match.group(1).strip()

    # ── Remediation Steps ─────────────────────────────────────────────────────
    remediation_steps = []
    rs_match = re.search(
        r"REMEDIATION STEPS[:\s*]*\n(.+?)$",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if rs_match:
        steps_block = rs_match.group(1).strip()
        # Split on numbered list items: "1. ", "2. ", etc.
        raw_steps = re.split(r"\n\d+\.\s+", "\n" + steps_block)
        remediation_steps = [s.strip() for s in raw_steps if s.strip()]

    # Fallback: if parsing failed, return full text as root cause
    if not root_cause and not remediation_steps:
        logger.warning("Could not parse structured agent response — using raw text as root cause")
        root_cause = text
        severity_classification = "See root cause analysis"
        remediation_steps = ["Review the full analysis above and follow standard runbook procedures."]

    return {
        "incident_id": incident_id,
        "root_cause": root_cause,
        "severity_classification": severity_classification,
        "remediation_steps": remediation_steps,
    }


def _build_chat_prompt(incident: dict, analysis: dict, history: list, message: str) -> str:
    """
    Build a context-rich prompt for a follow-up chat message.
    Includes: incident data, prior analysis, conversation history, new question.
    """
    log_block = "\n".join(incident.get("logs", [])[:8])  # cap logs at 8 lines

    # Format prior analysis compactly — enough context without tempting the model
    # to reproduce the full structured report format
    analysis_context = ""
    if analysis:
        steps = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(analysis.get("remediation_steps", [])))
        analysis_context = (
            f"\n[Prior analysis summary]\n"
            f"Root cause: {analysis.get('root_cause', 'N/A')}\n"
            f"Severity: {analysis.get('severity_classification', 'N/A')}\n"
            f"Remediation steps:\n{steps}\n"
        )

    # Format conversation history (last 10 turns max)
    history_block = ""
    if history:
        recent = history[-10:]
        lines = []
        for msg in recent:
            role_label = "User" if msg["role"] == "user" else "Assistant"
            lines.append(f"{role_label}: {msg['content']}")
        history_block = "\n[Conversation so far]\n" + "\n".join(lines) + "\n"

    return (
        f"You are assisting an on-call engineer with a follow-up question about an incident "
        f"that has already been analyzed. Answer ONLY the question asked. "
        f"Do NOT reproduce the full incident analysis, root cause, severity classification, "
        f"or remediation steps unless the user explicitly asks for them. "
        f"Be direct, specific, and brief — 2 to 5 sentences maximum unless a longer answer "
        f"is clearly needed. No section headers.\n"
        f"\n"
        f"[Incident]\n"
        f"ID: {incident['id']} | Service: {incident['affected_service']} | "
        f"Severity: {incident['severity']}\n"
        f"Title: {incident['title']}\n"
        f"Description: {incident.get('description', 'N/A')}\n"
        f"Key logs:\n{log_block}\n"
        f"{analysis_context}"
        f"{history_block}"
        f"\n[Question from engineer]\n{message}\n"
        f"\n[Your answer — direct, brief, no headers]"
    )


async def invoke_chat(incident: dict, analysis: dict, history: list, message: str) -> str:
    """
    Send a follow-up chat message to the WXO agent with full incident + history context.
    Returns the agent's plain-text reply.
    """
    if not WXO_INSTANCE_URL or not WXO_API_KEY:
        raise ValueError(
            "WXO_INSTANCE_URL and WXO_API_KEY must be set in environment variables."
        )

    prompt = _build_chat_prompt(incident, analysis, history, message)
    incident_id = incident["id"]

    logger.info(f"Invoking WXO chat for incident {incident_id} (history: {len(history)} turns)")

    authenticator = IAMAuthenticator(apikey=WXO_API_KEY)
    run_client = RunClient(base_url=WXO_INSTANCE_URL, authenticator=authenticator)
    threads_client = ThreadsClient(base_url=WXO_INSTANCE_URL, authenticator=authenticator)

    agent_uuid = _resolve_agent_id(authenticator)

    # Create run with chat prompt
    run_response = run_client.create_run(
        message=prompt,
        agent_id=agent_uuid,
    )
    run_id = run_response.get("run_id")
    thread_id = run_response.get("thread_id")

    if not run_id:
        raise RuntimeError(f"WXO did not return a run_id. Response: {run_response}")

    # Poll for completion
    max_retries = RUN_TIMEOUT_SECONDS // 2
    loop = asyncio.get_event_loop()
    final_status = await loop.run_in_executor(
        None,
        lambda: run_client.wait_for_run_completion(
            run_id=run_id,
            poll_interval=2,
            max_retries=max_retries,
        ),
    )

    run_state = final_status.get("status", "").lower()
    if run_state == "failed":
        error = final_status.get("error", "Unknown agent error")
        raise RuntimeError(f"Agent run {run_id} failed: {error}")

    if not thread_id:
        thread_id = final_status.get("thread_id")

    messages_response = threads_client.get_thread_messages(thread_id=thread_id)

    if isinstance(messages_response, list):
        messages = messages_response
    elif isinstance(messages_response, dict):
        messages = messages_response.get("data", messages_response.get("messages", []))
    else:
        messages = []

    assistant_message = None
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "assistant":
            assistant_message = msg
            break

    if not assistant_message:
        raise RuntimeError(f"No assistant message found in thread {thread_id}")

    reply = _extract_text_from_message(assistant_message)
    logger.info(f"Chat reply received ({len(reply)} chars) for incident {incident_id}")
    return reply


async def invoke_agent(incident: dict) -> dict:
    """
    Invoke the WXO incident_resolution_agent for a given incident dict.

    Steps:
      1. Build prompt from incident
      2. Create a run via RunClient
      3. Poll for completion (synchronous wait_for_run_completion run in executor)
      4. Fetch completed message from thread
      5. Parse + return AnalysisResult dict

    Raises:
        ValueError: if WXO_INSTANCE_URL or WXO_API_KEY are not set
        TimeoutError: if the run exceeds RUN_TIMEOUT_SECONDS
        RuntimeError: if the run fails or no assistant message is found
    """
    if not WXO_INSTANCE_URL or not WXO_API_KEY:
        raise ValueError(
            "WXO_INSTANCE_URL and WXO_API_KEY must be set in environment variables. "
            "Copy .env.example to .env and fill in your credentials."
        )

    prompt = _build_prompt(incident)
    incident_id = incident["id"]

    logger.info(f"Invoking WXO agent for incident {incident_id}")

    # Initialise clients — use IAMAuthenticator to exchange API key for Bearer token
    # (WXO cloud requires a proper IAM token, not a raw API key in Authorization header)
    authenticator = IAMAuthenticator(apikey=WXO_API_KEY)
    run_client = RunClient(base_url=WXO_INSTANCE_URL, authenticator=authenticator)
    threads_client = ThreadsClient(base_url=WXO_INSTANCE_URL, authenticator=authenticator)

    # Resolve agent name → UUID (cached after first call)
    agent_uuid = _resolve_agent_id(authenticator)

    # ── Step 1: Create run ────────────────────────────────────────────────────
    run_response = run_client.create_run(
        message=prompt,
        agent_id=agent_uuid,
    )
    run_id = run_response.get("run_id")
    thread_id = run_response.get("thread_id")

    if not run_id:
        raise RuntimeError(f"WXO did not return a run_id. Response: {run_response}")

    logger.info(f"Run created: run_id={run_id}, thread_id={thread_id}")

    # ── Step 2: Poll for completion (blocking call → run in thread executor) ──
    max_retries = RUN_TIMEOUT_SECONDS // 2  # poll every 2 seconds
    loop = asyncio.get_event_loop()
    final_status = await loop.run_in_executor(
        None,
        lambda: run_client.wait_for_run_completion(
            run_id=run_id,
            poll_interval=2,
            max_retries=max_retries,
        ),
    )

    run_state = final_status.get("status", "").lower()
    if run_state == "failed":
        error = final_status.get("error", "Unknown agent error")
        raise RuntimeError(f"Agent run {run_id} failed: {error}")

    logger.info(f"Run {run_id} completed with status: {run_state}")

    # ── Step 3: Fetch completed assistant message from thread ─────────────────
    if not thread_id:
        thread_id = final_status.get("thread_id")

    if not thread_id:
        raise RuntimeError("No thread_id available to fetch agent response message.")

    messages_response = threads_client.get_thread_messages(thread_id=thread_id)

    # Handle both list and {"data": [...]} response shapes
    if isinstance(messages_response, list):
        messages = messages_response
    elif isinstance(messages_response, dict):
        messages = messages_response.get("data", messages_response.get("messages", []))
    else:
        messages = []

    # Find the last assistant message
    assistant_message = None
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "assistant":
            assistant_message = msg
            break

    if not assistant_message:
        raise RuntimeError(f"No assistant message found in thread {thread_id}")

    raw_text = _extract_text_from_message(assistant_message)
    logger.info(f"Received agent response ({len(raw_text)} chars) for incident {incident_id}")

    # ── Step 4: Parse and return ──────────────────────────────────────────────
    return _parse_agent_response(incident_id, raw_text)
