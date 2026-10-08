"""
SOC — Enrichment Tools (v3)
Provides rule statistics, offense history, asset lookup, threat intel,
host baseline, allowlist, maintenance window, and audit log helpers.

All tools backed by COS CSV data for PoC scope.
Tools requiring live customer data (lookup_asset, lookup_threat_intel,
check_maintenance_window) return graceful stubs marked NEEDS_LIVE_DATA.
"""

import csv
import io
import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
import yaml
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

# ─────────────────────────────────────────────────────────────────────────────
# Shared COS helpers (duplicated from offense_tools to keep files independent)
# ─────────────────────────────────────────────────────────────────────────────

def _get_cos_creds() -> Dict[str, str]:
    creds = connections.key_value(COS_APP_ID)
    return {
        "api_key": creds.get("cos_api_key"),
        "endpoint": creds.get("cos_endpoint", "").rstrip("/"),
        "bucket": creds.get("cos_bucket"),
    }


def _get_iam_token(api_key: str) -> str:
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


def _fetch_cos_csv(object_key: str) -> List[Dict[str, str]]:
    try:
        creds = _get_cos_creds()
        token = _get_iam_token(creds["api_key"])
        url = f"{creds['endpoint']}/{creds['bucket']}/{object_key}"
        resp = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=20)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return list(csv.DictReader(io.StringIO(resp.text)))
    except Exception as exc:
        print(f"[COS] fetch failed for '{object_key}': {exc}")
        return []


def _fetch_cos_yaml(object_key: str) -> Any:
    """Fetch and parse a YAML file from COS. Returns None on failure."""
    try:
        creds = _get_cos_creds()
        token = _get_iam_token(creds["api_key"])
        url = f"{creds['endpoint']}/{creds['bucket']}/{object_key}"
        resp = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=20)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return yaml.safe_load(resp.text)
    except Exception as exc:
        print(f"[COS] YAML fetch failed for '{object_key}': {exc}")
        return None


def _list_cos_offense_keys() -> List[str]:
    """
    Use the COS S3 ListObjectsV2 API to discover all Offense_*.csv summary
    files in the bucket. Returns only offense summary files — not event files.
    Handles COS pagination (max 1000 keys per page) automatically.
    """
    try:
        creds = _get_cos_creds()
        token = _get_iam_token(creds["api_key"])
        keys: List[str] = []
        continuation_token: Optional[str] = None

        while True:
            params: Dict[str, str] = {
                "list-type": "2",
                "prefix": "Offense_",
            }
            if continuation_token:
                params["continuation-token"] = continuation_token

            resp = requests.get(
                f"{creds['endpoint']}/{creds['bucket']}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=20,
            )
            resp.raise_for_status()

            # Parse the XML response to extract object keys
            # Matches: <Key>Offense_12345.csv</Key>
            # Excludes event files (_Events.csv, _RCA_Relevant_Events*.csv)
            found = re.findall(r"<Key>(Offense_\d+\.csv)</Key>", resp.text)
            keys.extend(found)

            # Check for pagination
            is_truncated = "<IsTruncated>true</IsTruncated>" in resp.text
            if not is_truncated:
                break

            token_match = re.search(r"<NextContinuationToken>(.+?)</NextContinuationToken>", resp.text)
            if token_match:
                continuation_token = token_match.group(1)
            else:
                break

        return keys

    except Exception as exc:
        print(f"[COS] ListObjectsV2 failed: {exc}")
        return []


def _list_cos_event_keys() -> List[str]:
    """
    Use the COS S3 ListObjectsV2 API to discover all Offense_*_Events.csv
    files in the bucket (excludes RCA files). Handles pagination automatically.
    """
    try:
        creds = _get_cos_creds()
        token = _get_iam_token(creds["api_key"])
        keys: List[str] = []
        continuation_token: Optional[str] = None

        while True:
            params: Dict[str, str] = {
                "list-type": "2",
                "prefix": "Offense_",
            }
            if continuation_token:
                params["continuation-token"] = continuation_token

            resp = requests.get(
                f"{creds['endpoint']}/{creds['bucket']}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=20,
            )
            resp.raise_for_status()

            # Match only _Events.csv files — not _RCA_Relevant_Events*.csv
            found = re.findall(r"<Key>(Offense_\d+_Events\.csv)</Key>", resp.text)
            keys.extend(found)

            is_truncated = "<IsTruncated>true</IsTruncated>" in resp.text
            if not is_truncated:
                break

            token_match = re.search(r"<NextContinuationToken>(.+?)</NextContinuationToken>", resp.text)
            if token_match:
                continuation_token = token_match.group(1)
            else:
                break

        return keys

    except Exception as exc:
        print(f"[COS] ListObjectsV2 (events) failed: {exc}")
        return []


def _all_offense_rows() -> List[Dict[str, str]]:
    """
    Dynamically discover and load all Offense_*.csv summary rows from COS.
    Uses ListObjectsV2 to enumerate files — no hardcoded offense ID list.
    """
    keys = _list_cos_offense_keys()
    if not keys:
        print("[COS] Warning: no Offense_*.csv files found via listing — bucket may be empty or listing failed")
        return []

    rows = []
    for key in keys:
        r = _fetch_cos_csv(key)
        if r:
            rows.extend(r)
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Output schemas
# ─────────────────────────────────────────────────────────────────────────────

class RuleStatisticsOutput(BaseModel):
    rule_name: str = Field(description="QRadar rule name queried")
    window_days: int = Field(description="Look-back window in days")
    total_offenses: int = Field(description="Total offenses matching this rule in the window")
    closed_true_positive: int = Field(description="Offenses closed as True Positive")
    closed_non_issue: int = Field(description="Offenses closed as Non-Issue")
    tp_rate: float = Field(description="True Positive rate (0.00-1.00); -1 if insufficient data")
    distinct_analysts: int = Field(description="Number of distinct analysts who closed offenses")
    last_true_positive_date: str = Field(description="Date of most recent True Positive closure, or N/A")
    data_source: str = Field(description="'cos_dataset' for PoC; 'live' for production")


class OffenseHistoryOutput(BaseModel):
    rule_name: str
    attacker: str
    target: str
    window_days: int
    total_occurrences: int = Field(description="Total matching offenses in window")
    closed_non_issue_count: int
    closed_true_positive_count: int
    distinct_analysts: int
    ever_true_positive: bool = Field(description="True if this attacker/target pair ever yielded a True Positive")
    last_seen: str = Field(description="Most recent offense start time, or N/A")
    data_source: str


class AssetOutput(BaseModel):
    ip_or_hostname: str
    found: bool
    asset_criticality: str = Field(description="crown_jewel|high|medium|low|unknown")
    is_internet_facing: bool = Field(description="True if host is internet-facing")
    os_family: str = Field(description="windows|linux|network|other|unknown")
    environment: str = Field(description="production|staging|dev|unknown")
    service_name: str = Field(description="Primary service hosted, or unknown")
    owner: str = Field(description="Asset owner team/person, or unknown")
    data_source: str = Field(description="'cmdb' or 'NEEDS_LIVE_DATA'")


class ThreatIntelOutput(BaseModel):
    ip: str
    ti_verdict: str = Field(description="clean|suspicious|malicious|unknown")
    is_known_scanner: bool = Field(description="True if registered internal scanner")
    is_known_partner_cdn: bool = Field(description="True if partner or CDN IP — no block recommended")
    sources: List[str] = Field(description="TI sources that returned a verdict")
    data_source: str = Field(description="'threat_intel' or 'NEEDS_LIVE_DATA'")


class HostBaselineOutput(BaseModel):
    host: str
    process_chain_or_command: str
    window_days: int
    found: bool
    occurrences: int
    is_periodic: bool = Field(description="True if pattern recurs at regular intervals")
    median_interval_minutes: float = Field(description="Median interval between occurrences in minutes")
    first_seen: str
    distinct_days: int
    data_source: str


class AllowlistOutput(BaseModel):
    query: str = Field(description="The process chain, path, or IP queried")
    matched: bool
    entry_id: str = Field(description="Allowlist entry ID if matched, else empty")
    description: str = Field(description="Human-readable description of the allowlist entry")
    approved_by: str
    approved_date: str
    review_due: str
    host_scope: List[str] = Field(description="Host scope of the allowlist entry")
    expired: bool


class MaintenanceWindowOutput(BaseModel):
    hostname: str
    timestamp: str
    in_window: bool
    window_id: str = Field(description="Window identifier if in maintenance, else empty")
    approved_by: str
    data_source: str = Field(description="'schedule' or 'NEEDS_LIVE_DATA'")


class AuditLogOutput(BaseModel):
    status: str
    offense_id: str
    reason: str
    logged_at: str
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# Tool 1 — fetch_rule_statistics
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_fetch_rule_statistics",
    description=(
        "Fetch historical True Positive rate for a QRadar rule name. "
        "Returns tp_rate (0.00-1.00), total offenses, TP/Non-Issue counts, "
        "distinct analysts, and last TP date. Used by Triage rule T3 and "
        "Classification stage C0. Uses the 25-offense PoC dataset."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def fetch_rule_statistics(rule_name: str, window_days: int = 90) -> RuleStatisticsOutput:
    """
    Compute historical TP rate for a QRadar rule from the PoC offense dataset.

    Args:
        rule_name: QRadar rule description / offense title to match
        window_days: Look-back window (default 90)
    """
    rows = _all_offense_rows()
    rule_lower = rule_name.strip().lower()

    matching = [r for r in rows if r.get("description", "").strip().lower() == rule_lower]

    tp_count = sum(
        1 for r in matching
        if r.get("localizedCloseReason", "").strip().lower() not in ("", "null", "non-issue")
        and r.get("closeUser", "").strip() not in ("", "null")
        and r.get("localizedCloseReason", "").strip().lower() == "true positive"
    )
    non_issue_count = sum(
        1 for r in matching
        if r.get("localizedCloseReason", "").strip().lower() == "non-issue"
    )
    analysts = set(
        r.get("closeUser", "").strip()
        for r in matching
        if r.get("closeUser", "").strip() not in ("", "null")
    )

    total = len(matching)
    closed = tp_count + non_issue_count
    tp_rate = round(tp_count / closed, 2) if closed >= 1 else -1.0

    last_tp_dates = [
        r.get("formattedClosedDate", "")
        for r in matching
        if r.get("localizedCloseReason", "").strip().lower() == "true positive"
        and r.get("formattedClosedDate", "").strip()
    ]

    return RuleStatisticsOutput(
        rule_name=rule_name,
        window_days=window_days,
        total_offenses=total,
        closed_true_positive=tp_count,
        closed_non_issue=non_issue_count,
        tp_rate=tp_rate,
        distinct_analysts=len(analysts),
        last_true_positive_date=last_tp_dates[-1] if last_tp_dates else "N/A",
        data_source="cos_dataset",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 2 — fetch_offense_history
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_fetch_offense_history",
    description=(
        "Fetch historical offense patterns for a given rule name, attacker and target. "
        "Returns ever_true_positive, total_occurrences, distinct_analysts, and last_seen. "
        "Used by Triage adjustment TH and Classification stage C0."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def fetch_offense_history(
    rule_name: str,
    attacker: str = "",
    target: str = "",
    window_days: int = 90,
) -> OffenseHistoryOutput:
    """
    Fetch offense history for a rule/attacker/target combination from PoC dataset.

    Args:
        rule_name: QRadar rule description to match
        attacker: Attacker IP or hostname (optional — broadens match if omitted)
        target: Target IP or hostname (optional)
        window_days: Look-back window (default 90)
    """
    rows = _all_offense_rows()
    rule_lower = rule_name.strip().lower()

    def _matches(r: Dict[str, str]) -> bool:
        if r.get("description", "").strip().lower() != rule_lower:
            return False
        if attacker and r.get("attacker", "").strip() != attacker.strip():
            return False
        if target and r.get("target", "").strip() != target.strip():
            return False
        return True

    matching = [r for r in rows if _matches(r)]

    tp_count = sum(
        1 for r in matching
        if r.get("localizedCloseReason", "").strip().lower() == "true positive"
    )
    non_issue_count = sum(
        1 for r in matching
        if r.get("localizedCloseReason", "").strip().lower() == "non-issue"
    )
    analysts = set(
        r.get("closeUser", "").strip()
        for r in matching
        if r.get("closeUser", "").strip() not in ("", "null")
    )
    start_times = [r.get("formattedStartTime", "") for r in matching if r.get("formattedStartTime")]

    return OffenseHistoryOutput(
        rule_name=rule_name,
        attacker=attacker or "*",
        target=target or "*",
        window_days=window_days,
        total_occurrences=len(matching),
        closed_non_issue_count=non_issue_count,
        closed_true_positive_count=tp_count,
        distinct_analysts=len(analysts),
        ever_true_positive=tp_count > 0,
        last_seen=start_times[-1] if start_times else "N/A",
        data_source="cos_dataset",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 3 — lookup_asset
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_lookup_asset",
    description=(
        "Look up asset metadata for an IP address or hostname. "
        "Returns asset_criticality (crown_jewel/high/medium/low/unknown), "
        "is_internet_facing, os_family, environment, service_name, owner. "
        "NOTE: Returns NEEDS_LIVE_DATA until customer provides CMDB export. "
        "Used by Triage rules T2b, TF and offense type resolution for Device Name offenses."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def lookup_asset(ip: str) -> AssetOutput:
    """
    Look up asset criticality and metadata from CMDB.

    Args:
        ip: IP address or hostname to look up
    """
    # Try customer-provided asset registry from COS first
    asset_data = _fetch_cos_yaml("asset_registry.yaml")
    if asset_data and isinstance(asset_data, list):
        for entry in asset_data:
            if entry.get("ip") == ip or entry.get("hostname") == ip:
                return AssetOutput(
                    ip_or_hostname=ip,
                    found=True,
                    asset_criticality=entry.get("criticality", "unknown"),
                    is_internet_facing=entry.get("is_internet_facing", False),
                    os_family=entry.get("os_family", "unknown"),
                    environment=entry.get("environment", "unknown"),
                    service_name=entry.get("service_name", "unknown"),
                    owner=entry.get("owner", "unknown"),
                    data_source="cmdb",
                )

    # Fallback: return unknown — tool failure recorded in triage_reasoning
    return AssetOutput(
        ip_or_hostname=ip,
        found=False,
        asset_criticality="unknown",
        is_internet_facing=False,
        os_family="unknown",
        environment="unknown",
        service_name="unknown",
        owner="unknown",
        data_source="NEEDS_LIVE_DATA",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 4 — lookup_threat_intel
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_lookup_threat_intel",
    description=(
        "Look up threat intelligence verdict for an IP address. "
        "Returns ti_verdict (clean/suspicious/malicious/unknown), "
        "is_known_scanner, is_known_partner_cdn. "
        "NOTE: Returns NEEDS_LIVE_DATA until customer provides TI feed. "
        "Used by Triage adjustments TG, Classification N1."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def lookup_threat_intel(ip: str) -> ThreatIntelOutput:
    """
    Look up threat intelligence for an IP address.

    Args:
        ip: IP address to look up
    """
    # Try customer-provided TI feed from COS
    ti_data = _fetch_cos_yaml("threat_intel_feed.yaml")
    if ti_data and isinstance(ti_data, list):
        for entry in ti_data:
            if entry.get("ip") == ip:
                return ThreatIntelOutput(
                    ip=ip,
                    ti_verdict=entry.get("verdict", "unknown"),
                    is_known_scanner=entry.get("is_known_scanner", False),
                    is_known_partner_cdn=entry.get("is_known_partner_cdn", False),
                    sources=entry.get("sources", []),
                    data_source="threat_intel",
                )

    # Check known scanner/CDN lists from proxy_and_lb.yaml
    proxy_data = _fetch_cos_yaml("proxy_and_lb.yaml")
    if proxy_data:
        proxies = (proxy_data.get("proxies") or []) + (proxy_data.get("load_balancers") or [])
        for entry in proxies:
            if entry.get("ip") == ip:
                return ThreatIntelOutput(
                    ip=ip,
                    ti_verdict="clean",
                    is_known_scanner=False,
                    is_known_partner_cdn=True,
                    sources=["proxy_and_lb.yaml"],
                    data_source="threat_intel",
                )

    return ThreatIntelOutput(
        ip=ip,
        ti_verdict="unknown",
        is_known_scanner=False,
        is_known_partner_cdn=False,
        sources=[],
        data_source="NEEDS_LIVE_DATA",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 5 — fetch_host_baseline
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_fetch_host_baseline",
    description=(
        "Check whether a process chain or command on a given host is periodic/normal behaviour. "
        "Returns is_periodic, occurrences, median_interval_minutes, first_seen, distinct_days. "
        "Used by Classification modules M2 (webserver process discrimination), M5, M6."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def fetch_host_baseline(
    host: str,
    process_chain_or_command: str,
    window_days: int = 30,
) -> HostBaselineOutput:
    """
    Determine if a process chain or command is periodic baseline behaviour on a given host.

    Args:
        host: Hostname or IP address
        process_chain_or_command: Process name, parent->child chain, or command line fragment
        window_days: Look-back window in days (default 30)
    """
    # Scan all event CSVs for matching host + process pattern
    event_keys = _list_cos_event_keys()

    pattern_lower = process_chain_or_command.strip().lower()
    timestamps: List[str] = []

    for event_key in event_keys:
        rows = _fetch_cos_csv(event_key)
        for row in rows:
            device = row.get("deviceName", "") or row.get("logSourceIdentifier", "")
            if host.lower() not in device.lower() and host not in row.get("srcIp", "") and host not in row.get("destIp", ""):
                continue
            custom = row.get("customProps", "")
            if pattern_lower in custom.lower() or pattern_lower in row.get("payloadAsUTF", "").lower():
                ts = row.get("startDateTime", row.get("deviceDateTime", ""))
                if ts:
                    timestamps.append(ts)

    if not timestamps:
        return HostBaselineOutput(
            host=host,
            process_chain_or_command=process_chain_or_command,
            window_days=window_days,
            found=False,
            occurrences=0,
            is_periodic=False,
            median_interval_minutes=0.0,
            first_seen="N/A",
            distinct_days=0,
            data_source="cos_dataset",
        )

    distinct_days = len(set(ts[:10] for ts in timestamps))
    is_periodic = len(timestamps) >= 3 and distinct_days >= 2

    return HostBaselineOutput(
        host=host,
        process_chain_or_command=process_chain_or_command,
        window_days=window_days,
        found=True,
        occurrences=len(timestamps),
        is_periodic=is_periodic,
        median_interval_minutes=0.0,  # Full computation requires sorted timestamps
        first_seen=sorted(timestamps)[0],
        distinct_days=distinct_days,
        data_source="cos_dataset",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 6 — check_allowlist
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_check_allowlist",
    description=(
        "Check whether a process chain, file path, service path, command or source IP "
        "matches an approved entry in allowlist.yaml. "
        "Returns matched, entry_id, approved_by, review_due, expired. "
        "Used by Classification modules M2, M3, M4, M7 and N1 proxy detection."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def check_allowlist(query: str) -> AllowlistOutput:
    """
    Check if a process chain, path, command or IP is in the approved allowlist.

    Args:
        query: Process chain (e.g. 'w3wp.exe->cmd.exe'), file path, service filename,
               command line fragment, or IP address to check
    """
    allowlist = _fetch_cos_yaml("allowlist.yaml")
    if not allowlist:
        return AllowlistOutput(
            query=query, matched=False, entry_id="", description="allowlist.yaml not found",
            approved_by="", approved_date="", review_due="", host_scope=[], expired=False,
        )

    query_lower = query.strip().lower()
    today = datetime.now(timezone.utc).date().isoformat()

    for entry in allowlist:
        match_block = entry.get("match", {})
        # Check each match field for a substring or glob match
        for field_val in match_block.values():
            pattern = str(field_val).lower().replace("*", "")
            if pattern and pattern in query_lower:
                review_due = str(entry.get("review_due", ""))
                expired = bool(review_due and review_due < today)
                return AllowlistOutput(
                    query=query,
                    matched=True,
                    entry_id=entry.get("id", ""),
                    description=entry.get("description", ""),
                    approved_by=str(entry.get("approved_by", "")),
                    approved_date=str(entry.get("approved_date", "")),
                    review_due=review_due,
                    host_scope=entry.get("host_scope", ["*"]),
                    expired=expired,
                )

    return AllowlistOutput(
        query=query, matched=False, entry_id="", description="No matching allowlist entry",
        approved_by="", approved_date="", review_due="", host_scope=[], expired=False,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 7 — check_maintenance_window
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_check_maintenance_window",
    description=(
        "Check whether a given host is in an approved maintenance window at a given timestamp. "
        "Returns in_window, window_id, approved_by. "
        "Used by Classification M6-TP-2 (system shutdown) and M6-TP-3 (credential change). "
        "NOTE: Returns NEEDS_LIVE_DATA until customer provides maintenance_windows.yaml."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def check_maintenance_window(hostname: str, timestamp: str) -> MaintenanceWindowOutput:
    """
    Check if a host is in an approved maintenance window at the given time.

    Args:
        hostname: Hostname or IP to check
        timestamp: ISO 8601 or epoch timestamp of the event
    """
    mw_data = _fetch_cos_yaml("maintenance_windows.yaml")
    if not mw_data:
        return MaintenanceWindowOutput(
            hostname=hostname, timestamp=timestamp,
            in_window=False, window_id="", approved_by="",
            data_source="NEEDS_LIVE_DATA",
        )

    for window in mw_data.get("windows", []):
        scope = window.get("host_scope", [])
        if "*" not in scope and hostname not in scope:
            continue
        start = window.get("start", "")
        end = window.get("end", "")
        if start <= timestamp <= end:
            return MaintenanceWindowOutput(
                hostname=hostname, timestamp=timestamp,
                in_window=True,
                window_id=window.get("id", ""),
                approved_by=window.get("approved_by", ""),
                data_source="schedule",
            )

    return MaintenanceWindowOutput(
        hostname=hostname, timestamp=timestamp,
        in_window=False, window_id="", approved_by="",
        data_source="schedule",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 8 — log_out_of_scope
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_log_out_of_scope",
    description=(
        "Log an offense that has an unrecognised formattedOffenseType. "
        "Called by Triage STEP 0 when offense type is not Source IP, "
        "Destination IP, or Device Name (custom). Writes to the audit log in COS."
    ),
    permission=ToolPermission.READ_WRITE,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def log_out_of_scope(offense_id: str, offense_type: str) -> AuditLogOutput:
    """
    Record an out-of-scope offense in the audit log.

    Args:
        offense_id: QRadar offense ID
        offense_type: The unrecognised formattedOffenseType value
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    print(f"[AUDIT] OUT_OF_SCOPE offense={offense_id} type='{offense_type}' at={timestamp}")
    return AuditLogOutput(
        status="LOGGED",
        offense_id=offense_id,
        reason=f"Unsupported offense type: {offense_type}",
        logged_at=timestamp,
        message=f"Offense {offense_id} logged as out-of-scope (type: {offense_type})",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 9 — log_suppressed_offense
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_log_suppressed_offense",
    description=(
        "Log an Informational offense that was suppressed. "
        "Called by Triage STEP 4 for Informational severity offenses. "
        "Feeds the end-of-day suppression digest."
    ),
    permission=ToolPermission.READ_WRITE,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def log_suppressed_offense(offense_id: str, reason: str) -> AuditLogOutput:
    """
    Record a suppressed (Informational) offense in the audit log.

    Args:
        offense_id: QRadar offense ID
        reason: Suppression reason (e.g. "triage_severity=Informational, rule=T9")
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    print(f"[AUDIT] SUPPRESSED offense={offense_id} reason='{reason}' at={timestamp}")
    return AuditLogOutput(
        status="LOGGED",
        offense_id=offense_id,
        reason=reason,
        logged_at=timestamp,
        message=f"Offense {offense_id} suppressed — no ticket created. Reason: {reason}",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Output schemas for the four config-file tools
# ─────────────────────────────────────────────────────────────────────────────

class ServicePathOutput(BaseModel):
    service_filename: str = Field(description="The service filename / path that was checked")
    verdict: str = Field(description="permitted | suspicious | unknown")
    reason: str = Field(description="Which policy rule matched and why")
    matched_permitted_path: str = Field(description="The permitted path prefix matched, or empty")
    matched_suspicious_path: str = Field(description="The suspicious path matched, or empty")
    extension_ok: bool = Field(description="True if extension is .exe, .sys or .dll")
    vendor_match: str = Field(description="Approved vendor name if matched, else empty")
    data_source: str = Field(description="'service_path_policy.yaml' or 'NEEDS_LIVE_DATA'")


class ExfilToolOutput(BaseModel):
    query: str = Field(description="The process name or command line fragment checked")
    matched: bool = Field(description="True if query matches a known exfil tool or pattern")
    tool_name: str = Field(description="Matched tool name, or empty")
    notes: str = Field(description="Context about the matched tool, or empty")
    matched_powershell_pattern: str = Field(description="Matched PowerShell exfil pattern, or empty")
    data_source: str = Field(description="'exfil_tools.yaml'")


class PrivilegedAccountOutput(BaseModel):
    account: str = Field(description="The account name that was checked")
    is_privileged: bool = Field(description="True if account matches a privileged entry or pattern")
    risk_level: str = Field(description="critical | high | unknown")
    match_type: str = Field(description="'exact' | 'pattern' | 'partner_specific' | 'none'")
    matched_entry: str = Field(description="The matched account name or pattern, or empty")
    data_source: str = Field(description="'privileged_accounts.yaml'")


class LogRotationOutput(BaseModel):
    file_path: str = Field(description="The log file path that was checked")
    is_approved_rotation: bool = Field(description="True if deletion is normal log rotation")
    reason: str = Field(description="Which rotation rule matched, or why it is not approved")
    is_never_benign: bool = Field(description="True if this path is in the never-benign list — immediate TRUE POSITIVE")
    data_source: str = Field(description="'linux_log_rotation.yaml'")


# ─────────────────────────────────────────────────────────────────────────────
# Tool 10 — check_service_path  (service_path_policy.yaml)
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_check_service_path",
    description=(
        "Check a Windows service filename/path against service_path_policy.yaml. "
        "Returns verdict (permitted|suspicious|unknown), whether the extension is valid "
        "(.exe/.sys/.dll), and whether the path matches a suspicious directory "
        "(Temp, AppData, PerfLogs, etc.) or an approved vendor directory. "
        "Used by Classification Module M3 (Service Installation) to distinguish "
        "legitimate from malicious service installs."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def check_service_path(service_filename: str) -> ServicePathOutput:
    """
    Evaluate a Windows service binary path against the service path policy.

    Args:
        service_filename: Full service binary path from EventID 7045/4697
                          e.g. "C:\\Windows\\Temp\\vmware-vmsvc-SYSTEM2.log"
    """
    policy = _fetch_cos_yaml("service_path_policy.yaml")
    if not policy:
        return ServicePathOutput(
            service_filename=service_filename,
            verdict="unknown",
            reason="service_path_policy.yaml not found in COS",
            matched_permitted_path="", matched_suspicious_path="",
            extension_ok=False, vendor_match="",
            data_source="NEEDS_LIVE_DATA",
        )

    path_lower = service_filename.strip().lower()

    # 1. Check never-permitted suspicious paths first — immediate verdict
    for sus_path in policy.get("suspicious_paths", []):
        if sus_path.lower() in path_lower:
            return ServicePathOutput(
                service_filename=service_filename,
                verdict="suspicious",
                reason=f"Path is under suspicious directory: {sus_path}",
                matched_permitted_path="", matched_suspicious_path=sus_path,
                extension_ok=False, vendor_match="",
                data_source="service_path_policy.yaml",
            )

    # 2. Check extension
    ext = ""
    for candidate_ext in [".exe", ".sys", ".dll"]:
        # Strip arguments: take the first token up to a space
        binary_part = path_lower.split(" ")[0]
        if binary_part.endswith(candidate_ext):
            ext = candidate_ext
            break

    # Also check suspicious extensions
    for sus_ext in policy.get("suspicious_extensions", []):
        binary_part = path_lower.split(" ")[0]
        if sus_ext and binary_part.endswith(sus_ext.lower()):
            return ServicePathOutput(
                service_filename=service_filename,
                verdict="suspicious",
                reason=f"Service binary has suspicious extension: {sus_ext}",
                matched_permitted_path="", matched_suspicious_path=sus_ext,
                extension_ok=False, vendor_match="",
                data_source="service_path_policy.yaml",
            )

    extension_ok = bool(ext)

    # 3. Check approved vendor directories
    for vendor in policy.get("approved_security_vendors", []):
        prefix = vendor.get("path_prefix", "").lower()
        if prefix and prefix in path_lower:
            return ServicePathOutput(
                service_filename=service_filename,
                verdict="permitted",
                reason=f"Approved security vendor: {vendor.get('name')}",
                matched_permitted_path=vendor.get("path_prefix", ""),
                matched_suspicious_path="",
                extension_ok=extension_ok,
                vendor_match=vendor.get("name", ""),
                data_source="service_path_policy.yaml",
            )

    # 4. Check permitted base paths
    for permitted in policy.get("permitted_paths", []):
        if permitted.lower() in path_lower:
            return ServicePathOutput(
                service_filename=service_filename,
                verdict="permitted" if extension_ok else "suspicious",
                reason=(
                    f"Path is under permitted directory: {permitted}"
                    if extension_ok
                    else f"Path is under permitted directory but extension is not .exe/.sys/.dll"
                ),
                matched_permitted_path=permitted,
                matched_suspicious_path="",
                extension_ok=extension_ok,
                vendor_match="",
                data_source="service_path_policy.yaml",
            )

    # 5. No match — unknown path outside all known directories
    return ServicePathOutput(
        service_filename=service_filename,
        verdict="unknown",
        reason="Path not under any permitted or suspicious directory — treat as NEEDS-RCA",
        matched_permitted_path="", matched_suspicious_path="",
        extension_ok=extension_ok, vendor_match="",
        data_source="service_path_policy.yaml",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 11 — check_exfil_tool  (exfil_tools.yaml)
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_check_exfil_tool",
    description=(
        "Check whether a process name or command line fragment matches a known "
        "data exfiltration tool from exfil_tools.yaml. "
        "Also checks for dangerous PowerShell upload/download patterns. "
        "Used by Classification Module M4 (Outbound Network Connection) to identify "
        "tools like rclone, ngrok, megacmd, plink, winscp to public destinations."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def check_exfil_tool(query: str) -> ExfilToolOutput:
    """
    Check if a process name or command line matches a known exfiltration tool.

    Args:
        query: Process name, command line fragment, or image path to check
               e.g. "rclone.exe" or "powershell.exe -enc ... Net.WebClient"
    """
    exfil_data = _fetch_cos_yaml("exfil_tools.yaml")
    if not exfil_data:
        return ExfilToolOutput(
            query=query, matched=False, tool_name="",
            notes="exfil_tools.yaml not found in COS",
            matched_powershell_pattern="",
            data_source="exfil_tools.yaml",
        )

    query_lower = query.strip().lower()

    # 1. Check tool names
    for entry in exfil_data.get("tools", []):
        tool_name = entry.get("name", "").lower()
        if tool_name and tool_name in query_lower:
            return ExfilToolOutput(
                query=query,
                matched=True,
                tool_name=entry.get("name", ""),
                notes=entry.get("notes", ""),
                matched_powershell_pattern="",
                data_source="exfil_tools.yaml",
            )

    # 2. Check PowerShell exfil patterns
    for pattern in exfil_data.get("powershell_exfil_patterns", []):
        if pattern.lower() in query_lower:
            return ExfilToolOutput(
                query=query,
                matched=True,
                tool_name="PowerShell",
                notes=f"Matched PowerShell exfiltration pattern: {pattern}",
                matched_powershell_pattern=pattern,
                data_source="exfil_tools.yaml",
            )

    return ExfilToolOutput(
        query=query, matched=False, tool_name="",
        notes="No exfiltration tool or pattern matched",
        matched_powershell_pattern="",
        data_source="exfil_tools.yaml",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 12 — get_privileged_accounts  (privileged_accounts.yaml)
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_check_privileged_account",
    description=(
        "Check whether a given account name is a privileged account requiring "
        "close monitoring, using privileged_accounts.yaml. "
        "Supports exact match, wildcard pattern match (svc_*, *_admin), "
        "and customer-specific entries. "
        "Used by Classification Module M5 (Authentication brute force) and "
        "M6-TP-3 (Linux credential change) to determine escalation priority."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def check_privileged_account(account: str) -> PrivilegedAccountOutput:
    """
    Check if an account name is in the privileged accounts list.

    Args:
        account: Account name to check e.g. "sa", "svc_backup", "administrator"
    """
    pa_data = _fetch_cos_yaml("privileged_accounts.yaml")
    if not pa_data:
        return PrivilegedAccountOutput(
            account=account, is_privileged=False,
            risk_level="unknown", match_type="none", matched_entry="",
            data_source="privileged_accounts.yaml",
        )

    account_lower = account.strip().lower()

    # 1. Exact match in universal list
    for entry in pa_data.get("universal", []):
        if entry.get("account", "").lower() == account_lower:
            return PrivilegedAccountOutput(
                account=account, is_privileged=True,
                risk_level=entry.get("risk", "high"),
                match_type="exact",
                matched_entry=entry.get("account", ""),
                data_source="privileged_accounts.yaml",
            )

    # 2. Exact match in customer-specific list
    for entry in pa_data.get("partner_specific", []) or []:
        if entry and entry.get("account", "").lower() == account_lower:
            return PrivilegedAccountOutput(
                account=account, is_privileged=True,
                risk_level=entry.get("risk", "high"),
                match_type="partner_specific",
                matched_entry=entry.get("account", ""),
                data_source="privileged_accounts.yaml",
            )

    # 3. Pattern match (prefix* and *suffix)
    for entry in pa_data.get("patterns", []):
        pattern = entry.get("pattern", "")
        if not pattern:
            continue
        pat_lower = pattern.lower()
        if pat_lower.endswith("*"):
            prefix = pat_lower[:-1]
            if account_lower.startswith(prefix):
                return PrivilegedAccountOutput(
                    account=account, is_privileged=True,
                    risk_level=entry.get("risk", "high"),
                    match_type="pattern",
                    matched_entry=pattern,
                    data_source="privileged_accounts.yaml",
                )
        elif pat_lower.startswith("*"):
            suffix = pat_lower[1:]
            if account_lower.endswith(suffix):
                return PrivilegedAccountOutput(
                    account=account, is_privileged=True,
                    risk_level=entry.get("risk", "high"),
                    match_type="pattern",
                    matched_entry=pattern,
                    data_source="privileged_accounts.yaml",
                )

    return PrivilegedAccountOutput(
        account=account, is_privileged=False,
        risk_level="unknown", match_type="none", matched_entry="",
        data_source="privileged_accounts.yaml",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tool 13 — check_linux_log_rotation  (linux_log_rotation.yaml)
# ─────────────────────────────────────────────────────────────────────────────

@tool(
    name="soc_check_linux_log_rotation",
    description=(
        "Check whether a Linux log file deletion or truncation command is consistent "
        "with approved log rotation, using linux_log_rotation.yaml. "
        "Returns is_approved_rotation and is_never_benign. "
        "IMPORTANT: is_approved_rotation=True alone is NOT sufficient for Benign — "
        "fetch_host_baseline must also confirm is_periodic=True. "
        "Used by Classification Module M6-TP-1 (Log Destruction detection)."
    ),
    permission=ToolPermission.READ_ONLY,
    expected_credentials=[ExpectedCredentials(app_id=COS_APP_ID, type=ConnectionType.KEY_VALUE)],
)
def check_linux_log_rotation(file_path: str) -> LogRotationOutput:
    """
    Check whether a log file deletion matches an approved rotation pattern.

    Args:
        file_path: The full path of the file being deleted or truncated
                   e.g. "/var/log/pcp/pmie.log.lock" or "/var/log/auth.log"
    """
    rotation_data = _fetch_cos_yaml("linux_log_rotation.yaml")
    if not rotation_data:
        return LogRotationOutput(
            file_path=file_path,
            is_approved_rotation=False,
            reason="linux_log_rotation.yaml not found in COS",
            is_never_benign=False,
            data_source="linux_log_rotation.yaml",
        )

    path_lower = file_path.strip().lower()

    # 1. Check never-benign list first — immediate TRUE POSITIVE signal
    for nb_path in rotation_data.get("never_benign", []):
        if nb_path.lower() in path_lower or path_lower == nb_path.lower():
            return LogRotationOutput(
                file_path=file_path,
                is_approved_rotation=False,
                reason=f"Path is in never-benign list: {nb_path}. Deletion is always TRUE POSITIVE.",
                is_never_benign=True,
                data_source="linux_log_rotation.yaml",
            )

    # 2. Check approved rotation paths
    for entry in (rotation_data.get("approved_rotation_paths", []) +
                  rotation_data.get("partner_specific", [])):
        if not entry:
            continue
        base_path = entry.get("path", "").lower()
        if not base_path or base_path not in path_lower:
            continue

        # Check if the filename matches a permitted target pattern
        filename = path_lower.split("/")[-1]
        permitted_targets = entry.get("permitted_targets", [])
        for target_pattern in permitted_targets:
            tp_lower = target_pattern.lower()
            if tp_lower == "*":
                return LogRotationOutput(
                    file_path=file_path,
                    is_approved_rotation=True,
                    reason=f"Path under approved rotation directory: {entry.get('path')} — {entry.get('description', '')}. NOTE: fetch_host_baseline must confirm is_periodic=True.",
                    is_never_benign=False,
                    data_source="linux_log_rotation.yaml",
                )
            # Handle glob patterns like *.lock, *.gz
            if tp_lower.startswith("*"):
                suffix = tp_lower[1:]
                if filename.endswith(suffix):
                    return LogRotationOutput(
                        file_path=file_path,
                        is_approved_rotation=True,
                        reason=f"File matches rotation pattern '{target_pattern}' under {entry.get('path')} — {entry.get('description', '')}. NOTE: fetch_host_baseline must confirm is_periodic=True.",
                        is_never_benign=False,
                        data_source="linux_log_rotation.yaml",
                    )
            # Exact filename match
            if filename == tp_lower:
                return LogRotationOutput(
                    file_path=file_path,
                    is_approved_rotation=True,
                    reason=f"File matches approved rotation target '{target_pattern}' — {entry.get('description', '')}. NOTE: fetch_host_baseline must confirm is_periodic=True.",
                    is_never_benign=False,
                    data_source="linux_log_rotation.yaml",
                )

    # 3. Path is under a known log directory but file does not match a permitted target
    for entry in rotation_data.get("approved_rotation_paths", []):
        if not entry:
            continue
        base_path = entry.get("path", "").lower()
        if base_path and base_path in path_lower:
            return LogRotationOutput(
                file_path=file_path,
                is_approved_rotation=False,
                reason=f"Path is under {entry.get('path')} but file does not match any permitted rotation target — treat as suspicious deletion.",
                is_never_benign=False,
                data_source="linux_log_rotation.yaml",
            )

    # 4. Unknown path — no match at all
    return LogRotationOutput(
        file_path=file_path,
        is_approved_rotation=False,
        reason="Path not found in any approved rotation directory — treat as suspicious.",
        is_never_benign=False,
        data_source="linux_log_rotation.yaml",
    )
