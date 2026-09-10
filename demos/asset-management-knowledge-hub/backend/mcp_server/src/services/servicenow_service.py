"""ServiceNow REST API service for the MCP server.

Creates Incident tickets in a ServiceNow instance (e.g. a Personal Developer
Instance used for demos) via the Table API, using HTTP Basic Auth.
"""

from __future__ import annotations

from typing import Optional

import requests

from mcp_server.src.config import servicenow as cfg
from shared.logging import get_logger

logger = get_logger(__name__)

# ── Priority/urgency/impact keyword mapping ────────────────────────────────
# Maps our app's recommendation priority values to ServiceNow's numeric
# urgency/impact codes (1 = High, 2 = Medium, 3 = Low).
_PRIORITY_MAP: dict[str, str] = {
    "critical": "1",
    "high": "1",
    "medium": "2",
    "low": "3",
}


class ServiceNowConfigError(Exception):
    """Raised when ServiceNow credentials/instance URL are not configured."""


class ServiceNowService:
    """ServiceNow Table API client for Incident creation."""

    def __init__(self) -> None:
        self._base_url = cfg.instance_url.rstrip("/")
        self._username = cfg.username
        self._password = cfg.password
        self._timeout = cfg.timeout
        self._verify_ssl = cfg.verify_ssl

    def _is_configured(self) -> bool:
        return bool(self._base_url and self._username and self._password)

    def create_incident(
        self,
        *,
        short_description: str,
        description: str = "",
        priority: Optional[str] = None,
        category: str = "software",
        caller_id: Optional[str] = None,
    ) -> dict:
        """Create an Incident ticket via the ServiceNow Table API.

        Args:
            short_description: One-line ticket summary (required).
            description: Full ticket details.
            priority: Priority label ("Critical" | "High" | "Medium" | "Low").
                      Mapped to ServiceNow's urgency/impact codes.
            category: ServiceNow incident category.
            caller_id: Username/sys_id of the reporting user. Defaults to the
                       configured ServiceNow username.

        Returns:
            dict with keys: sys_id, number, state.

        Raises:
            ServiceNowConfigError: if the instance is not configured.
            requests.exceptions.RequestException: on network/HTTP failure.
        """
        if not self._is_configured():
            raise ServiceNowConfigError(
                "ServiceNow is not configured. Set SERVICENOW_INSTANCE_URL, "
                "SERVICENOW_USERNAME and SERVICENOW_PASSWORD in .env."
            )

        urgency_impact = _PRIORITY_MAP.get((priority or "").strip().lower(), "3")

        body = {
            "short_description": short_description,
            "description": description or short_description,
            "urgency": urgency_impact,
            "impact": urgency_impact,
            "category": category,
            "caller_id": caller_id or self._username,
        }

        url = f"{self._base_url}/api/now/table/incident"
        logger.info("ServiceNow create incident", extra={"url": url, "short_description": short_description})

        try:
            response = requests.post(
                url,
                json=body,
                auth=(self._username, self._password),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=self._timeout,
                verify=self._verify_ssl,
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as exc:
            logger.error("ServiceNow create incident failed", extra={"url": url, "error": str(exc)})
            raise

        result = response.json().get("result", {})
        logger.info("ServiceNow incident created", extra={"number": result.get("number"), "sys_id": result.get("sys_id")})
        return {
            "sys_id": result.get("sys_id"),
            "number": result.get("number"),
            "state": result.get("state"),
        }


servicenow_service = ServiceNowService()
