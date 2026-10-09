"""
SOC — Update Offense Severity Tool
Simulates updating a QRadar offense severity after triage.
No external API calls — PoC simulation only.
In production: replace with QRadar REST API PATCH /api/siem/offenses/{id}
"""

from datetime import datetime, timezone

from ibm_watsonx_orchestrate.agent_builder.tools import ToolPermission, tool
from pydantic import BaseModel, Field


class UpdateOffenseOutput(BaseModel):
    status: str = Field(description="SUCCESS or FAILED")
    offense_id: str = Field(description="QRadar offense ID")
    old_severity: str = Field(description="Previous severity label")
    new_severity: str = Field(description="New assigned severity (Critical/High/Medium/Low/Informational)")
    updated_at: str = Field(description="ISO 8601 timestamp")
    message: str = Field(description="Status message")


VALID_SEVERITIES = {"Critical", "High", "Medium", "Low", "Informational"}


@tool(
    name="soc_update_offense_severity",
    description=(
        "Simulate updating a QRadar offense severity after triage classification. "
        "Accepts Critical/High/Medium/Low/Informational. "
        "In production this calls QRadar REST API PATCH /api/siem/offenses/{id}."
    ),
    permission=ToolPermission.READ_WRITE,
)
def update_offense_severity(
    offense_id: str,
    offense_title: str,
    new_severity: str,
    old_severity: str = "Unknown",
) -> UpdateOffenseOutput:
    """
    Simulate updating QRadar offense severity.

    Args:
        offense_id: QRadar offense ID
        offense_title: Offense description for audit log
        new_severity: New severity — Critical / High / Medium / Low / Informational
        old_severity: Previous severity label (for audit trail)
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    if new_severity not in VALID_SEVERITIES:
        return UpdateOffenseOutput(
            status="FAILED",
            offense_id=offense_id,
            old_severity=old_severity,
            new_severity=new_severity,
            updated_at=timestamp,
            message=f"Invalid severity '{new_severity}'. Must be one of: {sorted(VALID_SEVERITIES)}",
        )
    print(f"[TRIAGE] Offense {offense_id} '{offense_title}': {old_severity} → {new_severity} at {timestamp}")
    return UpdateOffenseOutput(
        status="SUCCESS",
        offense_id=offense_id,
        old_severity=old_severity,
        new_severity=new_severity,
        updated_at=timestamp,
        message=f"Offense {offense_id} severity updated: {old_severity} → {new_severity}",
    )
