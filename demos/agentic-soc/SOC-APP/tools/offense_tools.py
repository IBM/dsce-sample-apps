"""
SOC — QRadar Offense Data Tools (COS-backed)
Fetches offense metadata, raw events, and RCA-relevant events from IBM COS.
Uses plain requests — no ibm-cos-sdk needed in WxO runtime.
"""

import csv
import io
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import requests
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType, ExpectedCredentials
from ibm_watsonx_orchestrate.agent_builder.tools import ToolPermission, tool
from ibm_watsonx_orchestrate.run import connections
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

COS_APP_ID = "soc-cos-data"
IBM_IAM_URL = "https://iam.cloud.ibm.com/identity/token"

_TOKEN_CACHE: Dict[str, Any] = {}

# Key customProps fields the agents care about — keeps context window manageable
_CUSTOM_PROPS_KEYS = [
    # Process chain fields (M2, M3, M4, M7)
    "Parent Command",
    "Parent Process Name",
    "Process Name",
    "CommandLine",
    "Image",
    "TargetFilename",
    "sysmon-image",
    "Process Path",
    "Process ID",
    "sysmon-processid",
    # Service installation fields (M3)
    "Service Name",
    "Service Filename",
    "ProgramName",
    # Network connection fields (M4)
    "Initiated",
    "sysmon-destinationip",
    "sysmon-destinationport",
    "sysmon-sourceip",
    "sysmon-sourceport",
    "Destination Hostname",
    # Web / HTTP fields (M1, N1, N2)
    "HTTP_Uri",
    "http_request",
    "alert_status",
    "uri_query",
    "uri_path",
    "Bytes Received",
    "status",
    "usrName",
    "src",
    "http_x_forwarded_for",
    "http_true_client_ip",
    # Auth fields (M5, M6)
    "Auth_Response",
    "acct",
    "terminal",
    "audit_type",
    # Sysmon / endpoint fields (M7)
    "sysmon-eventid",
    "EventIDCode",
    "channel",
    "Pipe Name",
    "grantedaccess",
    "HostApplication",
    # Machine identifier
    "Machine Identifier",
    "Device Name",
]

# Core event fields returned to agents
_EVENT_KEY_FIELDS = [
    "eventName",
    "eventDescription",
    "srcIp",
    "destIp",
    "severity",
    "category",
    "categoryDescription",
    "startDateTime",
    "deviceName",
    "userName",
    "protocol",
    "sourcePort",
    "destinationPort",
    "payloadAsUTF",
    "rawEvent",
    "customProps",
]


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_cos_creds() -> Dict[str, str]:
    creds = connections.key_value(COS_APP_ID)
    return {
        "api_key": str(creds.get("cos_api_key") or ""),
        "endpoint": str(creds.get("cos_endpoint") or "").rstrip("/"),
        "bucket": str(creds.get("cos_bucket") or ""),
    }


def _get_iam_token(api_key: str) -> str:
    """Exchange IBM Cloud API key for IAM bearer token. Cached with auto-refresh."""
    global _TOKEN_CACHE
    now = time.time()
    if (
        _TOKEN_CACHE.get("api_key") == api_key
        and _TOKEN_CACHE.get("token")
        and _TOKEN_CACHE.get("expires_at", 0) > now + 60
    ):
        return _TOKEN_CACHE["token"]

    resp = requests.post(
        IBM_IAM_URL,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": api_key,
        },
        timeout=15,
    )
    resp.raise_for_status()
    body = resp.json()
    token = body["access_token"]
    expires_in = int(body.get("expires_in", 3600))
    _TOKEN_CACHE = {"api_key": api_key, "token": token, "expires_at": now + expires_in}
    return token


def _fetch_csv(object_key: str) -> List[Dict[str, str]]:
    """Download a CSV from COS and return rows as list-of-dicts. Returns [] on 404."""
    try:
        creds = _get_cos_creds()
        token = _get_iam_token(creds["api_key"])
        url = f"{creds['endpoint']}/{creds['bucket']}/{object_key}"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return list(csv.DictReader(io.StringIO(resp.text)))
    except Exception as exc:
        print(f"[COS] fetch failed for '{object_key}': {exc}")
        return []


def _parse_custom_props(raw: str) -> Dict[str, str]:
    """Extract analytically important keys from the QRadar customProps blob."""
    result: Dict[str, str] = {}
    if not raw:
        return result
    clean = raw.strip().lstrip("{").rstrip("}")
    key_positions: List[tuple] = []
    for k in _CUSTOM_PROPS_KEYS:
        idx = 0
        while True:
            pos = clean.find(f"{k}=", idx)
            if pos == -1:
                break
            key_positions.append((pos, k))
            idx = pos + 1
    key_positions.sort()
    for i, (pos, key) in enumerate(key_positions):
        val_start = pos + len(key) + 1
        if i + 1 < len(key_positions):
            next_pos = key_positions[i + 1][0]
            val_end = clean.rfind(", ", val_start, next_pos)
            if val_end == -1 or val_end < val_start:
                val_end = next_pos
        else:
            val_end = len(clean)
        value = clean[val_start:val_end].strip().rstrip(",").strip()
        if value and value.upper() != "N/A":
            result[key] = value
    return result


def _extract_event_fields(rows: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    result = []
    for row in rows:
        event: Dict[str, Any] = {k: row.get(k, "") for k in _EVENT_KEY_FIELDS if k in row}
        parsed = _parse_custom_props(row.get("customProps", ""))
        if parsed:
            event["parsed_props"] = parsed
        result.append(event)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Output schemas
# ─────────────────────────────────────────────────────────────────────────────

class OffenseOutput(BaseModel):
    found: bool = Field(description="True if offense CSV exists in COS")
    offense_id: str = Field(description="QRadar offense ID")
    description: str = Field(description="Offense description / rule name")
    magnitude: str = Field(description="QRadar magnitude (1-10) — composite threat score")
    severity: str = Field(description="QRadar severity (1-10) — damage potential of attack type")
    relevance: str = Field(description="QRadar relevance (0-10) — 0 means no confirmed impact")
    credibility: str = Field(description="QRadar credibility (1-10) — data source trust score")
    event_count: str = Field(description="Total event count in offense")
    attacker: str = Field(description="Attacker / source IP address or hostname")
    target: str = Field(description="Target / destination IP address")
    start_time: str = Field(description="Offense start time")
    end_time: str = Field(description="Offense end time")
    duration: str = Field(description="Formatted offense duration")
    categories: str = Field(description="Event categories / description summary")
    formatted_offense_type: str = Field(description="Source IP | Destination IP | Device Name (custom) — determines attacker/target semantics")
    offense_source: str = Field(description="Raw offenseSource value — IP for Source/Dest types, hostname for Device Name type")
    localized_close_reason: str = Field(description="Close reason if already closed (null = open)")
    close_user: str = Field(description="Username who closed the offense, if closed")
    status: str = Field(description="OPEN or CLOSED — derived from localizedCloseReason")
    assigned_to_user: str = Field(description="Assigned analyst username")
    domain_name: str = Field(description="Network domain name")
    all_fields: dict = Field(description="Complete raw offense record for agent inspection")


class EventsOutput(BaseModel):
    found: bool = Field(description="True if events CSV exists in COS")
    offense_id: str = Field(description="QRadar offense ID")
    event_type: str = Field(description="'all_events' or 'rca_relevant_events'")
    total_rows: int = Field(description="Total rows in the CSV")
    returned_rows: int = Field(description="Rows returned (may be capped by max_events)")
    events: list[dict] = Field(description="Event records with key fields and parsed customProps")


# ─────────────────────────────────────────────────────────────────────────────
# Tool 1 — Fetch offense metadata
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_fetch_offense",
    description=(
        "Fetch QRadar offense metadata by offense ID from COS. "
        "Returns severity, magnitude, relevance, credibility, attacker IP, target IP, "
        "event count, duration, description, and all raw fields. "
        "Returns found=false if no CSV exists for this offense ID."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def fetch_offense(offense_id: str) -> OffenseOutput:
    """
    Fetch offense metadata from Offense_{id}.csv in IBM COS.

    Args:
        offense_id: QRadar offense ID (e.g. "167657")
    """
    rows = _fetch_csv(f"Offense_{offense_id}.csv")
    if not rows:
        return OffenseOutput(
            found=False, offense_id=offense_id, description="NOT FOUND",
            magnitude="", severity="", relevance="", credibility="",
            event_count="", attacker="", target="", start_time="", end_time="",
            duration="", categories="",
            formatted_offense_type="", offense_source="",
            localized_close_reason="null", close_user="", status="OPEN",
            assigned_to_user="", domain_name="", all_fields={},
        )
    r = rows[0]
    close_reason = r.get("localizedCloseReason", "null") or "null"
    status = "CLOSED" if close_reason.lower() not in ("null", "", "none") else "OPEN"
    return OffenseOutput(
        found=True,
        offense_id=r.get("id", offense_id),
        description=r.get("description", "").strip(),
        magnitude=r.get("magnitude", ""),
        severity=r.get("severity", ""),
        relevance=r.get("relevance", ""),
        credibility=r.get("credibility", ""),
        event_count=r.get("eventCount", ""),
        attacker=r.get("attacker", ""),
        target=r.get("target", ""),
        start_time=r.get("startTime", ""),
        end_time=r.get("endTime", ""),
        duration=r.get("formattedDuration", ""),
        categories=r.get("eventDescription", ""),
        formatted_offense_type=r.get("formattedOffenseType", "").strip(),
        offense_source=r.get("offenseSource", "").strip(),
        localized_close_reason=close_reason,
        close_user=r.get("closeUser", ""),
        status=status,
        assigned_to_user=r.get("assignedToUser", ""),
        domain_name=r.get("domainName", ""),
        all_fields=dict(r),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 2 — Fetch all offense events
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_fetch_offense_events",
    description=(
        "Fetch raw events for a QRadar offense from COS. "
        "Returns eventName, srcIp, destIp, severity, category, startDateTime, "
        "deviceName, and parsed customProps (process chains, HTTP URIs, alert_status, "
        "sysmon event IDs). Use max_events to limit context window size."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def fetch_offense_events(offense_id: str, max_events: int = 20) -> EventsOutput:
    """
    Fetch events from Offense_{id}_Events.csv in IBM COS.

    Args:
        offense_id: QRadar offense ID
        max_events: Maximum rows to return (default 20; increase for dense offenses)
    """
    rows = _fetch_csv(f"Offense_{offense_id}_Events.csv")
    if not rows:
        return EventsOutput(
            found=False, offense_id=offense_id, event_type="all_events",
            total_rows=0, returned_rows=0, events=[],
        )
    sliced = rows[:max_events]
    return EventsOutput(
        found=True, offense_id=offense_id, event_type="all_events",
        total_rows=len(rows), returned_rows=len(sliced),
        events=_extract_event_fields(sliced),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 3 — Fetch analyst-curated RCA events
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_fetch_rca_events",
    description=(
        "Fetch analyst-curated RCA-relevant events for a QRadar offense from COS. "
        "These are pre-selected events most useful for root cause determination. "
        "Returns found=false when no RCA file exists — this is normal for many offenses; "
        "in that case rely on fetch_offense_events for evidence."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def fetch_rca_events(offense_id: str, max_events: int = 25) -> EventsOutput:
    """
    Fetch analyst-curated events from Offense_{id}_RCA_Relevant_Events.csv in IBM COS.

    Args:
        offense_id: QRadar offense ID
        max_events: Maximum rows to return (default 25)
    """
    rows = _fetch_csv(f"Offense_{offense_id}_RCA_Relevant_Events.csv")
    if not rows:
        return EventsOutput(
            found=False, offense_id=offense_id, event_type="rca_relevant_events",
            total_rows=0, returned_rows=0, events=[],
        )
    sliced = rows[:max_events]
    return EventsOutput(
        found=True, offense_id=offense_id, event_type="rca_relevant_events",
        total_rows=len(rows), returned_rows=len(sliced),
        events=_extract_event_fields(sliced),
    )
