from __future__ import annotations

from typing import Any

import requests


def send_slack_alert(webhook_url: str, alert: dict[str, Any]) -> None:
    payload = {
        "text": f"*{alert['title']}*\n{alert['message']}\n*Recommended action:* {alert['recommended_action']}",
    }
    response = requests.post(webhook_url, json=payload, timeout=10)
    response.raise_for_status()
