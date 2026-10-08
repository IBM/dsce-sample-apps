"""
SOC — Action Execution Tools
Handles approval workflow and remediation action execution.
All actions auto-approve in PoC simulation mode.
In production: integrate with SOAR platform, firewall APIs, or AD management.
"""

from datetime import datetime, timezone

from ibm_watsonx_orchestrate.agent_builder.tools import ToolPermission, tool
from pydantic import BaseModel, Field


class ActionApprovalOutput(BaseModel):
    status: str = Field(description="APPROVED or REJECTED")
    action_id: str = Field(description="Unique action identifier")
    action_type: str = Field(description="Type of action requested")
    message: str = Field(description="Status message")
    approval_status: str = Field(description="approved or rejected")
    requested_at: str = Field(description="ISO 8601 request timestamp")
    approver: str | None = Field(default=None, description="Approver name")
    approved_at: str | None = Field(default=None, description="ISO 8601 approval timestamp")


class ActionExecutionOutput(BaseModel):
    status: str = Field(description="SUCCESS or FAILED")
    action_id: str = Field(description="Action identifier executed")
    action_type: str = Field(description="Type of action executed")
    target: str = Field(description="Target entity (IP, user, hash, domain, etc.)")
    message: str = Field(description="Execution result message")
    executed_at: str = Field(description="ISO 8601 execution timestamp")
    execution_details: dict = Field(description="Detailed execution context")


# Mapping from action type to the payload key that holds the target entity.
# Used by execute_approved_action to populate the `target` field in the audit log.
_TARGET_KEY_MAP = {
    # Network containment
    "block_ip_address":                    "ip_address",
    "create_firewall_rule":                "ip_address",
    "block_domain":                        "domain",
    "block_url_pattern":                   "url_pattern",
    "rate_limit_ip":                       "ip_address",
    # Endpoint containment
    "isolate_device":                      "device_name",
    "terminate_process":                   "process_name",
    "collect_forensic_image":              "device_name",
    "run_edr_scan":                        "device_name",
    # Identity & access
    "block_user":                          "user_email",
    "disable_user_account":                "user_email",
    "reset_user_password":                 "user_email",  # vault:ignore - action type key, not a credential
    "revoke_user_session":                 "user_email",
    "enforce_mfa":                         "user_email",
    # Application layer
    "apply_web_application_firewall_rule": "waf_policy",
    "patch_web_application":               "application_name",
    "update_ids_signature":                "signature_name",
    "reconfigure_log_source":              "log_source_id",
    # File & data
    "quarantine_file":                     "file_hash",
    "conduct_file_integrity_check":        "device_name",
    "delete_malicious_file":               "file_path",
    "revoke_data_access":                  "resource_name",
    # Intelligence & audit
    "add_ioc_to_watchlist":                "ioc_value",
    "enable_enhanced_logging":             "device_name",
    "notify_asset_owner":                  "asset_ip",
    "create_threat_intel_report":          "offense_id",
}


@tool(
    name="soc_request_action_approval",
    description=(
        "Request approval for a SOC remediation action derived from RCA findings. "
        "Auto-approves all actions in PoC mode. "
        "In production: routes to SOC Manager approval workflow via SOAR platform."
    ),
    permission=ToolPermission.READ_WRITE,
)
def request_action_approval(
    action_id: str,
    action_type: str,
    action_names: list[str],
    rca_summary: str,
    payload: dict,
    incident_id: str,
    priority: str = "Medium",
) -> ActionApprovalOutput:
    """
    Request approval for a remediation action.

    Args:
        action_id: Unique ID in format ACT-<offense_id>-<seq>, e.g. ACT-167657-001
        action_type: block_ip_address / block_user / isolate_device / quarantine_file / etc.
        action_names: List of action type strings
        rca_summary: RCA summary text (truncated to 100 words max)
        payload: Dict with target details, e.g. {"ip_address": "203.0.0.2", "reason": "..."}
        incident_id: The offense ID
        priority: Critical / High / Medium / Low
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    approver = "SOC-Manager-Auto" if priority in ("Critical", "High") else "SOC-Manager"
    print(f"[APPROVAL] {action_id} ({action_type}) priority={priority}: APPROVED at {timestamp}")
    return ActionApprovalOutput(
        status="APPROVED",
        action_id=action_id,
        action_type=action_type,
        message=f"Action {action_id} approved for {action_type}",
        approval_status="approved",
        requested_at=timestamp,
        approver=approver,
        approved_at=timestamp,
    )


@tool(
    name="soc_execute_approved_action",
    description=(
        "Execute a previously approved SOC remediation action. "
        "Simulated in PoC mode — logs the action with full audit detail. "
        "In production: calls firewall API, AD API, EDR platform, or SOAR playbook."
    ),
    permission=ToolPermission.READ_WRITE,
)
def execute_approved_action(
    action_id: str,
    action_type: str,
    payload: dict,
    incident_id: str,
) -> ActionExecutionOutput:
    """
    Execute an approved remediation action.

    Args:
        action_id: Action identifier from request_action_approval
        action_type: Type of action to execute
        payload: Target details dict
        incident_id: QRadar offense ID
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    target_key = _TARGET_KEY_MAP.get(action_type, "target")
    target = payload.get(target_key, payload.get("target", "unknown"))
    print(f"[ACTION EXECUTED] {action_type} on '{target}' for offense {incident_id} at {timestamp}")
    return ActionExecutionOutput(
        status="SUCCESS",
        action_id=action_id,
        action_type=action_type,
        target=target,
        message=f"Successfully executed {action_type} on {target}",
        executed_at=timestamp,
        execution_details={
            "action_type": action_type,
            "target": target,
            "payload": payload,
            "incident_id": incident_id,
            "executed_by": "SOC Action Agent",
            "execution_method": "simulated",
            "result": "Action executed — audit trail recorded",
        },
    )
