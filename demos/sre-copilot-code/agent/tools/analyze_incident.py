"""
analyze_incident — watsonx Orchestrate tool for IT incident analysis.

This tool is called by the incident_resolution_agent when a user submits an
incident for analysis. It receives the structured incident data and returns:
  - root_cause: explanation of what caused the incident
  - severity_classification: severity level with justification
  - remediation_steps: ordered list of actionable remediation steps
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool


@tool
def analyze_incident(
    incident_id: str,
    incident_title: str,
    severity: str,
    affected_service: str,
    timestamp: str,
    logs: str,
) -> dict:
    """
    Analyze an IT Operations incident and produce a structured incident report.

    Given the incident metadata and raw log output, analyze the root cause,
    validate or reclassify the severity, and provide a step-by-step remediation
    runbook that an on-call engineer can follow immediately.

    Args:
        incident_id: Unique identifier for the incident (e.g. INC-001)
        incident_title: Short human-readable title describing the incident
        severity: Reported severity level — one of: Critical, High, Medium, Low
        affected_service: Name of the primary service or infrastructure component affected
        timestamp: ISO 8601 timestamp when the incident was first detected
        logs: Raw log output from the affected service, newline-separated

    Returns:
        A dict with keys:
          - incident_id: the incident ID passed in
          - root_cause: a concise explanation of the root cause
          - severity_classification: the validated/reclassified severity with justification
          - remediation_steps: a list of ordered, actionable remediation steps
    """
    # This function body is intentionally minimal — the agent's LLM reasoning
    # performs the actual analysis using the docstring as its instruction.
    # The tool exists to give the agent a structured schema for input/output.
    return {
        "incident_id": incident_id,
        "root_cause": "",
        "severity_classification": "",
        "remediation_steps": [],
    }
