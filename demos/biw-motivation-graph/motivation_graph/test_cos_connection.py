"""Standalone COS connectivity test.

Run from the motivation_graph/ directory:
    python test_cos_connection.py

Reads credentials from .env in this directory (or parent).
Tests:
  1. head_bucket  — bucket exists and credentials are accepted
  2. put_object   — write permission (uploads a small probe file)
  3. list_objects — list objects in bucket root
  4. delete_object — clean up the probe file
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from this directory (or parent)
_here = Path(__file__).parent
for _candidate in [_here / ".env", _here.parent / ".env"]:
    if _candidate.exists():
        load_dotenv(_candidate, override=False)
        print(f"Loaded env from: {_candidate}")
        break

from config import (  # noqa: E402 — must come after load_dotenv
    COS_ACCESS_KEY,
    COS_BUCKET,
    COS_ENDPOINT,
    COS_REGION,
    COS_SECRET_KEY,
)

_PROBE_KEY = "biw-cos-probe/connection_test.txt"
_PROBE_BODY = b"IBM COS connection probe - BIW motivation graph"

PASS = "\033[32m  PASS\033[0m"
FAIL = "\033[31m  FAIL\033[0m"


def check(label: str, ok: bool, detail: str = "") -> bool:
    icon = PASS if ok else FAIL
    suffix = f"  ({detail})" if detail else ""
    print(f"{icon}  {label}{suffix}")
    return ok


def main() -> int:
    print("\n── IBM COS Connection Test ──────────────────────────────────────")
    print(f"  endpoint : {COS_ENDPOINT}")
    print(f"  bucket   : {COS_BUCKET}")
    print(f"  region   : {COS_REGION}")
    print(f"  key_id   : {COS_ACCESS_KEY[:8]}…")
    print("─────────────────────────────────────────────────────────────────\n")

    if not all([COS_ENDPOINT, COS_ACCESS_KEY, COS_SECRET_KEY, COS_BUCKET]):
        print(f"{FAIL}  Missing one or more COS_* environment variables.")
        return 1

    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError

    s3 = boto3.client(
        "s3",
        endpoint_url=COS_ENDPOINT,
        aws_access_key_id=COS_ACCESS_KEY,
        aws_secret_access_key=COS_SECRET_KEY,
        region_name=COS_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )

    all_ok = True

    # ── 1. head_bucket ───────────────────────────────────────────────────────
    try:
        s3.head_bucket(Bucket=COS_BUCKET)
        all_ok &= check("head_bucket — bucket accessible", True)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        all_ok &= check("head_bucket — bucket accessible", False, f"HTTP {code}: {exc}")

    # ── 2. put_object ────────────────────────────────────────────────────────
    try:
        s3.put_object(Bucket=COS_BUCKET, Key=_PROBE_KEY, Body=_PROBE_BODY)
        all_ok &= check("put_object  — write probe file", True, _PROBE_KEY)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        all_ok &= check("put_object  — write probe file", False, f"HTTP {code}: {exc}")

    # ── 3. list_objects_v2 ───────────────────────────────────────────────────
    try:
        resp = s3.list_objects_v2(Bucket=COS_BUCKET, MaxKeys=5)
        count = resp.get("KeyCount", 0)
        keys = [o["Key"] for o in resp.get("Contents", [])]
        all_ok &= check("list_objects — bucket readable", True,
                        f"{count} object(s) visible: {keys}")
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        all_ok &= check("list_objects — bucket readable", False, f"HTTP {code}: {exc}")

    # ── 4. delete_object (cleanup) ───────────────────────────────────────────
    try:
        s3.delete_object(Bucket=COS_BUCKET, Key=_PROBE_KEY)
        all_ok &= check("delete_object — cleanup probe file", True)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        # Non-fatal: object may not have been written
        check("delete_object — cleanup probe file", False, f"HTTP {code}: {exc}")

    print()
    if all_ok:
        print("\033[32m✓  IBM COS connection OK — all checks passed.\033[0m")
        return 0
    else:
        print("\033[31m✗  One or more COS checks FAILED. See details above.\033[0m")
        return 1


if __name__ == "__main__":
    sys.exit(main())
