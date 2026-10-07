"""
parse_issue_alerts.py

Helper script to parse a GitHub Dependabot issue/table or text dump
and generate arguments for remediate_alerts.py across Critical, High, and Medium alerts.

Usage:
    # 1. Ingest from an issue markdown/text file:
    python parse_issue_alerts.py issue_alerts.txt

    # 2. Or paste text directly into stdin:
    cat issue_alerts.txt | python parse_issue_alerts.py
"""

import sys
import re
from pathlib import Path


def extract_package_fixes(text: str) -> dict:
    """
    Extracts package names and patched versions from common markdown table formats:
    | CVE | Package | Affected | Patched In / Fix Version | Severity (Critical/High/Medium) |
    or lines like:
    - Package: PyJWT, Fixed: 2.14.0, Severity: Critical
    - anyio >= 4.4.0 (High)
    - [Medium] jinja2 >= 3.1.6
    """
    fixes = {}
    lines = text.splitlines()

    for line in lines:
        # Match table rows: | CVE | Package | ... | Fixed Version | ...
        # e.g. | CVE-2024-xxxx | PyJWT | < 2.14.0 | 2.14.0 | Critical |
        table_match = re.search(r'\|\s*([a-zA-Z0-9_\-\.\@\/]+)\s*\|\s*([^\|]+)\|\s*([0-9\.\-\w]+)\s*\|', line)
        if table_match:
            pkg = table_match.group(1).strip()
            ver = table_match.group(3).strip()
            if pkg.lower() not in ["package", "dependency", "name", "cve"]:
                fixes[pkg] = ver
                continue

        # Match table format: | Severity | Package | Vulnerable | Patched |
        table_match_sev = re.search(r'\|\s*(?:critical|high|medium|low)\s*\|\s*([a-zA-Z0-9_\-\.\@\/]+)\s*\|\s*[^\|]+\|\s*([0-9\.\-\w]+)\s*\|', line, re.IGNORECASE)
        if table_match_sev:
            pkg = table_match_sev.group(1).strip()
            ver = table_match_sev.group(2).strip()
            if pkg.lower() not in ["package", "dependency", "name", "cve"]:
                fixes[pkg] = ver
                continue

        # Match key-value patterns: Package: foo, Fix: 1.2.3 or foo@1.2.3
        kv_match = re.search(r'([a-zA-Z0-9_\-\.\@\/]+)[@:\s]+(?:fixed|patched|version)?\s*([0-9]+\.[0-9]+(?:\.[0-9a-zA-Z]+)?)', line, re.IGNORECASE)
        if kv_match:
            pkg = kv_match.group(1).strip()
            ver = kv_match.group(2).strip()
            if pkg.lower() not in ["package", "dependency", "name", "cve", "critical", "high", "medium", "low"]:
                fixes[pkg] = ver

    return fixes


def main():
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        if path.exists():
            text = path.read_text(encoding="utf-8")
        else:
            text = " ".join(sys.argv[1:])
    else:
        if not sys.stdin.isatty():
            text = sys.stdin.read()
        else:
            print("Usage: python parse_issue_alerts.py <issue_file.txt> or pipe text via stdin")
            return

    fixes = extract_package_fixes(text)
    if not fixes:
        print("No package fix versions detected in input text.")
        return

    print("Detected package fixes (Critical, High, Medium):")
    cli_args = []
    for pkg, ver in fixes.items():
        print(f"  {pkg} -> {ver}")
        cli_args.append(f"{pkg}@{ver}")

    print("\nCommand to run remediation:")
    print(f"python demos/dependabot-security/remediate_alerts.py {' '.join(cli_args)}")


if __name__ == "__main__":
    main()
