"""
controls_client.py — WXO Agent Controls enable/disable via REST API.

WXO Control artifact types (exact names used in API):
  pii_filter        — PII Filter (masks IPs, emails, phone numbers)
  Guardrails        — Content Guardrails (blocks jailbreaks, harmful content)
  SecretsDetection  — Secrets Detector (redacts API keys, JWT tokens)

Each control is attached to the agent as a control artifact.
We use direct HTTP calls to the WXO REST API since the SDK doesn't yet
expose a high-level controls client.
"""

import os
import logging
import httpx

from ibm_cloud_sdk_core.authenticators import IAMAuthenticator

logger = logging.getLogger(__name__)

WXO_INSTANCE_URL = os.getenv("WXO_INSTANCE_URL", "").rstrip("/")
WXO_API_KEY = os.getenv("WXO_API_KEY", "")

# Mapping from our internal config keys → WXO artifact type names
CONTROL_TYPE_MAP = {
    "pii_filter":         "pii_filter",
    "guardrails":         "Guardrails",
    "secrets_detection":  "SecretsDetection",
}

# Human-readable labels for logging/UI
CONTROL_LABELS = {
    "pii_filter":        "PII Filter",
    "guardrails":        "Content Guardrails",
    "secrets_detection": "Secrets Detector",
}


def _get_iam_token() -> str:
    """Exchange WXO_API_KEY for an IAM Bearer token."""
    authenticator = IAMAuthenticator(apikey=WXO_API_KEY)
    # Force token retrieval
    token_manager = authenticator.token_manager
    token_manager.paced_request_token()
    return token_manager.get_token()


def _headers() -> dict:
    token = _get_iam_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _list_controls(agent_id: str) -> list:
    """List all control artifacts attached to the agent."""
    url = f"{WXO_INSTANCE_URL}/v1/agents/{agent_id}/controls"
    resp = httpx.get(url, headers=_headers(), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("controls", data) if isinstance(data, dict) else data


def _find_control(controls: list, artifact_type: str) -> dict | None:
    """Find a control artifact by type name."""
    for c in controls:
        if c.get("artifact_type") == artifact_type or c.get("type") == artifact_type:
            return c
    return None


def enable_control(agent_id: str, control_key: str) -> dict:
    """
    Enable a control artifact on the agent.
    Creates it if it doesn't exist; enables it if already present.
    """
    artifact_type = CONTROL_TYPE_MAP[control_key]
    label = CONTROL_LABELS[control_key]
    logger.info(f"Enabling control '{label}' (type={artifact_type}) on agent {agent_id}")

    controls = _list_controls(agent_id)
    existing = _find_control(controls, artifact_type)

    if existing:
        # PATCH to enable if it's disabled
        ctrl_id = existing.get("id")
        url = f"{WXO_INSTANCE_URL}/v1/agents/{agent_id}/controls/{ctrl_id}"
        resp = httpx.patch(url, headers=_headers(), json={"enabled": True}, timeout=30)
        resp.raise_for_status()
        logger.info(f"Control '{label}' re-enabled (id={ctrl_id})")
        return resp.json()
    else:
        # POST to create
        url = f"{WXO_INSTANCE_URL}/v1/agents/{agent_id}/controls"
        resp = httpx.post(url, headers=_headers(), json={
            "artifact_type": artifact_type,
            "enabled": True,
        }, timeout=30)
        resp.raise_for_status()
        logger.info(f"Control '{label}' created and enabled")
        return resp.json()


def disable_control(agent_id: str, control_key: str) -> dict:
    """Disable a control artifact on the agent."""
    artifact_type = CONTROL_TYPE_MAP[control_key]
    label = CONTROL_LABELS[control_key]
    logger.info(f"Disabling control '{label}' (type={artifact_type}) on agent {agent_id}")

    controls = _list_controls(agent_id)
    existing = _find_control(controls, artifact_type)

    if not existing:
        logger.info(f"Control '{label}' not found — nothing to disable")
        return {"status": "not_found"}

    ctrl_id = existing.get("id")
    url = f"{WXO_INSTANCE_URL}/v1/agents/{agent_id}/controls/{ctrl_id}"
    resp = httpx.patch(url, headers=_headers(), json={"enabled": False}, timeout=30)
    resp.raise_for_status()
    logger.info(f"Control '{label}' disabled (id={ctrl_id})")
    return resp.json()
