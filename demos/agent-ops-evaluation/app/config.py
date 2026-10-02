"""Runtime configuration, read once from the environment."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # demo root: agents/, tools/, evaluations/, scenarios.json

WXO_INSTANCE_URL = os.environ.get("WXO_INSTANCE_URL", "").rstrip("/")
WXO_API_KEY = os.environ.get("WXO_API_KEY", "")
WXO_ENV_NAME = os.environ.get("WXO_ENV_NAME", "demo")          # label used by the evaluation framework

# Where evaluation runs are written (ephemeral in the container).
RUN_ROOT = Path(os.environ.get("RUN_ROOT", "/tmp/agentops-d1-runs"))

# Limits that keep a public deployment inexpensive.
CHAT_PER_IP_PER_10MIN = int(os.environ.get("CHAT_PER_IP_PER_10MIN", "12"))
CHAT_MAX_CONCURRENT = int(os.environ.get("CHAT_MAX_CONCURRENT", "4"))
JOB_START_COOLDOWN_S = int(os.environ.get("JOB_START_COOLDOWN_S", "20"))
JOB_TIMEOUT_S = int(os.environ.get("JOB_TIMEOUT_S", "900"))
RESULT_FRESH_S = int(os.environ.get("RESULT_FRESH_S", "600"))  # reuse a result younger than this unless forced
TRACE_FETCH_PER_MIN = int(os.environ.get("TRACE_FETCH_PER_MIN", "3"))  # platform limit is 4/min
JOBS_PER_HOUR = int(os.environ.get("JOBS_PER_HOUR", "30"))             # global cap on live evaluation starts
CHATS_PER_HOUR = int(os.environ.get("CHATS_PER_HOUR", "300"))          # global cap on live chat runs

IAM_TOKEN_URL = os.environ.get("IAM_TOKEN_URL", "https://iam.cloud.ibm.com/identity/token")

STATIC_DIR = Path(os.environ.get("STATIC_DIR", ROOT / "frontend" / "dist"))

with open(ROOT / "scenarios.json", encoding="utf-8") as _f:
    CATALOG = json.load(_f)

VERSIONS = CATALOG["versions"]
SCENARIOS = {s["id"]: s for s in CATALOG["scenarios"]}
ATTACKS = {a["id"]: a for a in CATALOG["attacks"]}


def require_settings() -> None:
    missing = [k for k, v in {"WXO_INSTANCE_URL": WXO_INSTANCE_URL, "WXO_API_KEY": WXO_API_KEY}.items() if not v]
    if missing:
        raise RuntimeError(f"missing environment variables: {', '.join(missing)}")
