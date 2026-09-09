"""Standalone watsonx.data / Presto connectivity test.

Run from the motivation_graph/ directory:
    python3 test_trino_connection.py

Reads credentials from .env in this directory (or parent).
Uses only the standard library — no trino package required.

Auth: watsonx.data Presto uses HTTP Basic Auth with:
  user     = "ibmlhapikey_<ibm-email>"
  password = IAM API key  (from WATSONX_AI_API_KEY)

Tests:
  1. TCP reachability of the Presto host:port
  2. POST /v1/statement SELECT 1  — auth + engine accepts queries
  3. POST /v1/statement SHOW CATALOGS  — lists available catalogs
"""

from __future__ import annotations

import base64
import json
import os
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

_here = Path(__file__).parent
for _candidate in [_here / ".env", _here.parent / ".env"]:
    if _candidate.exists():
        load_dotenv(_candidate, override=True)
        print(f"Loaded env from: {_candidate}")
        break

HOST    = os.environ.get("WATSONX_DATA_HOST", "")
PORT    = int(os.environ.get("WATSONX_DATA_PORT", "30186"))
USER    = os.environ.get("WATSONX_DATA_USER", "")
CATALOG = os.environ.get("WATSONX_DATA_CATALOG", "")
SCHEMA  = os.environ.get("WATSONX_DATA_SCHEMA", "")
API_KEY = os.environ.get("WATSONX_AI_API_KEY", "") or os.environ.get("WATSONX_API_KEY", "")

# watsonx.data Presto auth: ibmlhapikey_<email> + API key as Basic Auth
PRESTO_USER = f"ibmlhapikey_{USER}" if USER else ""
_token = base64.b64encode(f"{PRESTO_USER}:{API_KEY}".encode()).decode()

PASS = "\033[32m  PASS\033[0m"
FAIL = "\033[31m  FAIL\033[0m"


def check(label: str, ok: bool, detail: str = "") -> bool:
    icon = PASS if ok else FAIL
    suffix = f"  ({detail})" if detail else ""
    print(f"{icon}  {label}{suffix}")
    return ok


def presto_post(sql: str) -> dict:
    """POST a SQL statement to the Presto /v1/statement endpoint."""
    url = f"https://{HOST}:{PORT}/v1/statement"
    req = urllib.request.Request(
        url,
        data=sql.encode(),
        headers={
            "Content-Type":  "application/json",
            "X-Presto-User": PRESTO_USER,
            "X-Trino-User":  PRESTO_USER,
            "Authorization": f"Basic {_token}",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read()), r.status


def main() -> int:
    print("\n── watsonx.data / Presto Connection Test ────────────────────────")
    print(f"  host        : {HOST or '(not set)'}")
    print(f"  port        : {PORT}")
    print(f"  presto user : {PRESTO_USER or '(not set)'}")
    print(f"  api key     : {(API_KEY[:8] + '...') if API_KEY and not API_KEY.startswith('<') else 'NOT SET'}")
    print(f"  catalog     : {CATALOG or '(not set)'}")
    print(f"  schema      : {SCHEMA or '(not set)'}")
    print("─────────────────────────────────────────────────────────────────\n")

    if not HOST:
        print(f"{FAIL}  WATSONX_DATA_HOST not set in .env")
        return 1
    if not API_KEY or API_KEY.startswith("<"):
        print(f"{FAIL}  WATSONX_AI_API_KEY not set in .env")
        return 1

    all_ok = True

    # ── 1. TCP probe ─────────────────────────────────────────────────────────
    try:
        with socket.create_connection((HOST, PORT), timeout=5):
            pass
        all_ok &= check("TCP connect", True, f"{HOST}:{PORT}")
    except OSError as exc:
        all_ok &= check("TCP connect", False, str(exc))
        print(f"\n{FAIL}  Cannot reach host — check VPN / firewall.")
        return 1

    # ── 2. SELECT 1 ──────────────────────────────────────────────────────────
    try:
        body, status = presto_post("SELECT 1")
        qid = body.get("id", "?")
        state = body.get("stats", {}).get("state", "?")
        all_ok &= check("SELECT 1 (POST /v1/statement)", status == 200,
                        f"id={qid}  state={state}")
    except urllib.error.HTTPError as exc:
        all_ok &= check("SELECT 1 (POST /v1/statement)", False,
                        f"HTTP {exc.code}: {exc.read().decode()[:120]}")
        print(f"\n{FAIL}  Auth error — skipping further tests.")
        return 1
    except Exception as exc:
        all_ok &= check("SELECT 1 (POST /v1/statement)", False, str(exc))
        return 1

    # ── 3. SHOW CATALOGS ─────────────────────────────────────────────────────
    try:
        body, status = presto_post("SHOW CATALOGS")
        qid = body.get("id", "?")
        state = body.get("stats", {}).get("state", "?")
        all_ok &= check("SHOW CATALOGS (POST /v1/statement)", status == 200,
                        f"id={qid}  state={state}")
    except Exception as exc:
        all_ok &= check("SHOW CATALOGS (POST /v1/statement)", False, str(exc)[:120])

    print()
    if all_ok:
        print("\033[32m✓  watsonx.data connection OK — all checks passed.\033[0m")
        return 0
    else:
        print("\033[31m✗  One or more checks FAILED.\033[0m")
        return 1


if __name__ == "__main__":
    sys.exit(main())
