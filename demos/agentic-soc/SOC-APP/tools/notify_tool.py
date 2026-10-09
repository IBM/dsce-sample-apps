"""
SOC — Notify Tool
Generates HTML incident reports and delivers them via Mailjet transactional email.
Credentials injected from connection: soc-mailjet (key_value).
Required keys: mailjet_api_key, mailjet_secret_key
Optional key:  mailjet_sender_email
"""

from datetime import datetime, timezone

from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType, ExpectedCredentials
from ibm_watsonx_orchestrate.agent_builder.tools import ToolPermission, tool
from ibm_watsonx_orchestrate.run import connections
from mailjet_rest import Client
from pydantic import BaseModel, Field

MAILJET_APP_ID = "soc-mailjet"
DEFAULT_SENDER = "soc-demo@example.com"
DEFAULT_RECIPIENTS = ["soc-team@example.com"]


class NotifyOutput(BaseModel):
    status: str = Field(description="SUCCESS or FAILED")
    message: str = Field(description="Status message")
    incident_id: str = Field(description="QRadar offense ID")
    recipients: list[str] = Field(description="Email recipients")
    subject: str = Field(description="Email subject line")
    timestamp: str = Field(description="ISO 8601 delivery timestamp")
    mailjet_message_id: str | None = Field(default=None, description="Mailjet message ID from API response")
    email_size_kb: float = Field(description="Approximate email size in KB")


@tool(
    name="soc_notify",
    description=(
        "Send an HTML incident report notification for a QRadar offense via Mailjet. "
        "Credentials are pulled from the soc-mailjet connection (mailjet_api_key, mailjet_secret_key). "
        "Defaults to sending to soc-team@example.com when no recipients are specified."
    ),
    permission=ToolPermission.READ_WRITE,
    expected_credentials=[ExpectedCredentials(app_id=MAILJET_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def notify_tool(
    html_content: str,
    incident_id: str,
    subject: str | None = None,
    recipients: list[str] | None = None,
) -> NotifyOutput:
    """
    Deliver HTML notification for a QRadar security offense via Mailjet.

    Args:
        html_content: Full HTML report string
        incident_id: QRadar offense ID
        subject: Email subject (auto-generated if omitted)
        recipients: Email list (defaults to soc-team@example.com)
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    if not html_content or not html_content.strip():
        return NotifyOutput(
            status="FAILED",
            message="Empty HTML content provided",
            incident_id=incident_id,
            recipients=[],
            subject="",
            timestamp=timestamp,
            email_size_kb=0.0,
        )

    if not recipients:
        recipients = DEFAULT_RECIPIENTS
    if not subject:
        subject = f"[SOC] QRadar Offense {incident_id} — Incident Report"

    size_kb = round(len(html_content) / 1024, 2)

    # Pull credentials from the watsonx Orchestrate connection
    creds = connections.key_value(MAILJET_APP_ID)
    api_key = creds.get("mailjet_api_key")
    secret_key = creds.get("mailjet_secret_key")
    sender_email = creds.get("mailjet_sender_email", DEFAULT_SENDER)

    mailjet = Client(auth=(api_key, secret_key), version="v3.1")

    data = {
        "Messages": [
            {
                "From": {"Email": sender_email, "Name": "SOC"},
                "To": [{"Email": r} for r in recipients],
                "Subject": subject,
                "HTMLPart": html_content,
            }
        ]
    }

    result = mailjet.send.create(data=data)
    body = result.json()

    if result.status_code == 200:
        msg_id = str(body.get("Messages", [{}])[0].get("To", [{}])[0].get("MessageID", ""))
        print(f"[NOTIFY] Email sent for offense {incident_id} via Mailjet (MessageID={msg_id})")
        return NotifyOutput(
            status="SUCCESS",
            message=f"Report sent for offense {incident_id} to {len(recipients)} recipient(s)",
            incident_id=incident_id,
            recipients=recipients,
            subject=subject,
            timestamp=timestamp,
            mailjet_message_id=msg_id,
            email_size_kb=size_kb,
        )

    error_msg = body.get("ErrorMessage") or str(body)
    print(f"[NOTIFY] Mailjet send failed for offense {incident_id}: {error_msg}")
    return NotifyOutput(
        status="FAILED",
        message=f"Mailjet error: {error_msg}",
        incident_id=incident_id,
        recipients=recipients,
        subject=subject,
        timestamp=timestamp,
        email_size_kb=size_kb,
    )
