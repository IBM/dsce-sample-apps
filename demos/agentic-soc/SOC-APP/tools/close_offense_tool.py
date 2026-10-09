"""
SOC — Close Offense Tool
Simulates closing a QRadar offense with a QRadar close reason and close note.
No external API calls — PoC simulation only.
In production: replace with QRadar REST API POST /api/siem/offenses/{id}?status=CLOSED
"""

from datetime import datetime, timezone

from ibm_watsonx_orchestrate.agent_builder.tools import ToolPermission, tool
from pydantic import BaseModel, Field


class CloseOffenseOutput(BaseModel):
    status: str = Field(description="SUCCESS or FAILED")
    offense_id: str = Field(description="QRadar offense ID")
    offense_status: str = Field(description="closed or open")
    close_reason: str = Field(description="QRadar close reason: True Positive / Non-Issue")
    close_note: str = Field(description="QRadar close note: e.g. Normal Behavior / Administrator Behavior / Verified and Notified")
    closed_by: str = Field(description="Agent or analyst who closed the offense")
    closed_at: str = Field(description="ISO 8601 timestamp of closure")
    message: str = Field(description="Status message")


# QRadar close reason vocabulary used by the Classification Agent
VALID_CLOSE_REASONS = {
    "True Positive",
    "Non-Issue",
}

# QRadar close note vocabulary used by the Classification Agent
VALID_CLOSE_NOTES = {
    "Verified and Notified",
    "Normal Behavior",
    "Administrator Behavior",
    "False Positive",
    "Undetermined",
    "",  # empty is also acceptable
}


@tool(
    name="soc_close_offense",
    description=(
        "Simulate closing a QRadar offense after classification. "
        "close_reason must be: 'True Positive' or 'Non-Issue'. "
        "close_note must be: 'Verified and Notified', 'Normal Behavior', or 'Administrator Behavior'. "
        "In production: calls QRadar REST API to set status=CLOSED."
    ),
    permission=ToolPermission.READ_WRITE,
)
def close_offense(
    offense_id: str,
    close_reason: str,
    close_note: str = "",
) -> CloseOffenseOutput:
    """
    Simulate closing a QRadar offense.

    Args:
        offense_id: QRadar offense ID
        close_reason: QRadar close reason — 'True Positive' or 'Non-Issue'
        close_note: QRadar close note — 'Normal Behavior', 'Administrator Behavior',
                    or 'Verified and Notified'
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    if close_reason not in VALID_CLOSE_REASONS:
        return CloseOffenseOutput(
            status="FAILED",
            offense_id=offense_id,
            offense_status="open",
            close_reason=close_reason,
            close_note=close_note,
            closed_by="SOC Agent",
            closed_at=timestamp,
            message=f"Invalid close_reason '{close_reason}'. Must be one of: {sorted(VALID_CLOSE_REASONS)}",
        )
    print(f"[AUDIT] CLOSE_OFFENSE: {offense_id} reason='{close_reason}' note='{close_note}' at {timestamp}")
    return CloseOffenseOutput(
        status="SUCCESS",
        offense_id=offense_id,
        offense_status="closed",
        close_reason=close_reason,
        close_note=close_note,
        closed_by="SOC Agent",
        closed_at=timestamp,
        message=f"Offense {offense_id} closed — reason: {close_reason}, note: {close_note}",
    )
