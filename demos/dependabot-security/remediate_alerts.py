"""
remediate_alerts.py

Scans all demo manifests (requirements*.txt, pyproject.toml, package.json)
for vulnerable packages flagged in security/Dependabot alerts (Critical, High, Medium, Low),
and updates or adds safe minimum version constraints (e.g. >= fixed_version).

Usage:
    # 1. Run with default catalog of known Critical/High/Medium remediations across all demos:
    python remediate_alerts.py

    # 2. Or pass specific packages and target versions (format: package_name@fixed_version):
    python remediate_alerts.py PyJWT@2.14.0 anyio@4.4.0 fastapi@0.115.5 jinja2@3.1.6 axios@1.18.0

    # 3. Filter by severity level when running:
    python remediate_alerts.py --severity CRITICAL,HIGH,MEDIUM
"""

import sys
import re
import json
from pathlib import Path

# Comprehensive alert catalog covering Critical, High, and Medium vulnerabilities
# across Python and Node ecosystems in the workspace
ALERT_CATALOG = {
    # ── Critical Vulnerabilities ───────────────────────────────────────────────
    "PyJWT": {"version": "2.14.0", "severity": "CRITICAL", "description": "Key confusion & signature bypass"},
    "cryptography": {"version": "50.0.0", "severity": "CRITICAL", "description": "Memory safety & cipher vulnerabilities"},
    "anyio": {"version": "4.4.0", "severity": "CRITICAL", "description": "Async event loop race & crash vulnerability"},
    "fastapi": {"version": "0.115.5", "severity": "CRITICAL", "description": "Transitive anyio/starlette resolution"},
    "uvicorn": {"version": "0.32.0", "severity": "CRITICAL", "description": "Transitive anyio/websockets resolution"},
    "starlette": {"version": "0.40.0", "severity": "CRITICAL", "description": "Multipart DoS and anyio vulnerability"},

    # ── High Vulnerabilities ───────────────────────────────────────────────────
    "aiohttp": {"version": "3.14.3", "severity": "HIGH", "description": "Request smuggling & directory traversal"},
    "axios": {"version": "1.18.0", "severity": "HIGH", "description": "SSRF & prototype pollution"},
    "express": {"version": "5.1.0", "severity": "HIGH", "description": "Prototype pollution in qs/body-parser"},
    "vite": {"version": "6.4.3", "severity": "HIGH", "description": "Dev server path traversal & DOM XSS"},
    "requests": {"version": "2.33.0", "severity": "HIGH", "description": "Proxy header leak & credential leak"},
    "geopy": {"version": "2.5.0", "severity": "HIGH", "description": "Regex DoS vulnerability"},
    "jinja2": {"version": "3.1.6", "severity": "HIGH", "description": "Sandbox escape & HTML injection"},
    "werkzeug": {"version": "3.1.3", "severity": "HIGH", "description": "Path traversal in safe_join & DoS"},
    "tornado": {"version": "6.4.2", "severity": "HIGH", "description": "HTTP request smuggling"},
    "micromatch": {"version": "4.0.8", "severity": "HIGH", "description": "ReDoS vulnerability"},
    "cross-spawn": {"version": "7.0.6", "severity": "HIGH", "description": "Command injection vulnerability"},

    # ── Medium Vulnerabilities ─────────────────────────────────────────────────
    "python-dotenv": {"version": "1.2.2", "severity": "MEDIUM", "description": "Malformed input parsing & injection"},
    "pytest": {"version": "9.0.3", "severity": "MEDIUM", "description": "Temporary directory race condition"},
    "pydantic": {"version": "2.10.3", "severity": "MEDIUM", "description": "Email validator ReDoS & schema bypass"},
    "urllib3": {"version": "2.3.0", "severity": "MEDIUM", "description": "Proxy authorization header stripping"},
    "certifi": {"version": "2024.12.14", "severity": "MEDIUM", "description": "Root certificate trust store updates"},
    "idna": {"version": "3.10", "severity": "MEDIUM", "description": "ReDoS in domain name decoding"},
    "postcss": {"version": "8.5.23", "severity": "MEDIUM", "description": "Line return parsing DoS"},
    "yaml": {"version": "2.8.3", "severity": "MEDIUM", "description": "Stack overflow on deeply nested YAML"},
    "dompurify": {"version": "3.4.15", "severity": "MEDIUM", "description": "HTML nested tag sanitization bypass"},
    "marked": {"version": "18.0.14", "severity": "MEDIUM", "description": "Markdown parser ReDoS and XSS"},
    "react-router-dom": {"version": "6.30.6", "severity": "MEDIUM", "description": "XSS in route parameter parsing"},
}

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def parse_alerts_from_args(args):
    """
    Parses CLI arguments.
    Supports:
      - package@version
      - --severity CRITICAL,HIGH,MEDIUM
      - empty args -> returns all items in ALERT_CATALOG
    """
    if not args:
        return {pkg: data["version"] for pkg, data in ALERT_CATALOG.items()}

    severities_filter = None
    alerts = {}

    for arg in args:
        if arg.startswith("--severity="):
            severities_filter = [s.strip().upper() for s in arg.split("=", 1)[1].split(",")]
        elif arg == "--severity":
            continue
        elif "@" in arg:
            pkg, ver = arg.split("@", 1)
            alerts[pkg.strip()] = ver.strip()
        elif "==" in arg:
            pkg, ver = arg.split("==", 1)
            alerts[pkg.strip()] = ver.strip()
        elif ">=" in arg:
            pkg, ver = arg.split(">=", 1)
            alerts[pkg.strip()] = ver.strip()
        else:
            # Check if it's a comma-separated list of severities passed after --severity
            parts = [p.strip().upper() for p in arg.split(",")]
            if all(p in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] for p in parts):
                severities_filter = parts
            else:
                print(f"Skipping unknown argument '{arg}'. Use package_name@version (e.g. PyJWT@2.14.0)")

    if severities_filter:
        for pkg, data in ALERT_CATALOG.items():
            if data["severity"] in severities_filter:
                alerts[pkg] = data["version"]

    return alerts or {pkg: data["version"] for pkg, data in ALERT_CATALOG.items()}


def update_requirements_file(filepath: Path, alerts: dict) -> list:
    """Updates requirements.txt files with safe version constraints."""
    changes = []
    lines = filepath.read_text(encoding="utf-8").splitlines()
    new_lines = []
    found_packages = set()

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue

        matched = False
        for pkg, target_ver in alerts.items():
            pattern = rf"^({re.escape(pkg)})(\[.*?\])?([=<>!~].*)?$"
            match = re.match(pattern, stripped, re.IGNORECASE)
            if match:
                matched = True
                matched_name = match.group(1)
                extras = match.group(2) or ""
                old_ver_match = re.search(r'[=<>!~]+\s*([0-9]+(?:\.[0-9]+)*)', stripped)
                should_update = True
                if old_ver_match and stripped.startswith(f"{matched_name}>="):
                    from packaging.version import parse as parse_v
                    try:
                        if parse_v(old_ver_match.group(1)) >= parse_v(target_ver):
                            should_update = False
                    except Exception:
                        pass

                if should_update:
                    new_req = f"{matched_name}{extras}>={target_ver}"
                    if new_req != stripped:
                        new_lines.append(new_req)
                        severity = ALERT_CATALOG.get(pkg, {}).get("severity", "ALERT")
                        changes.append(f"  [{severity}] [requirements] {filepath.relative_to(REPO_ROOT)}: '{stripped}' -> '{new_req}'")
                    else:
                        new_lines.append(line)
                else:
                    new_lines.append(line)
                found_packages.add(pkg.lower())
                break

        if not matched:
            new_lines.append(line)

    if changes:
        filepath.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    return changes


def update_pyproject_file(filepath: Path, alerts: dict) -> list:
    """Updates pyproject.toml files with safe version constraints."""
    changes = []
    content = filepath.read_text(encoding="utf-8")
    lines = content.splitlines()
    new_lines = []

    for line in lines:
        matched = False
        for pkg, target_ver in alerts.items():
            pattern = rf'(\s*["\'])({re.escape(pkg)})(\[.*?\])?([=<>!~][^"\']*)?(["\'].*)'
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                matched = True
                quote_start = match.group(1)
                matched_name = match.group(2)
                extras = match.group(3) or ""
                spec = match.group(4) or ""
                rest = match.group(5)

                old_ver_match = re.search(r'[=<>!~]+\s*([0-9]+(?:\.[0-9]+)*)', spec)
                should_update = True
                if old_ver_match and spec.startswith(">="):
                    from packaging.version import parse as parse_v
                    try:
                        if parse_v(old_ver_match.group(1)) >= parse_v(target_ver):
                            should_update = False
                    except Exception:
                        pass

                if should_update:
                    new_line = f"{quote_start}{matched_name}{extras}>={target_ver}{rest}"
                    if new_line != line:
                        new_lines.append(new_line)
                        severity = ALERT_CATALOG.get(pkg, {}).get("severity", "ALERT")
                        changes.append(f"  [{severity}] [pyproject.toml] {filepath.relative_to(REPO_ROOT)}: '{line.strip()}' -> '{new_line.strip()}'")
                    else:
                        new_lines.append(line)
                else:
                    new_lines.append(line)
                break

        if not matched:
            new_lines.append(line)

    if changes:
        filepath.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    return changes


def update_package_json(filepath: Path, alerts: dict) -> list:
    """Updates package.json dependencies and devDependencies."""
    changes = []
    try:
        data = json.loads(filepath.read_text(encoding="utf-8"))
    except Exception as e:
        return [f"  [package.json] Error parsing {filepath.relative_to(REPO_ROOT)}: {e}"]

    modified = False
    for section in ["dependencies", "devDependencies"]:
        if section in data and isinstance(data[section], dict):
            for pkg, target_ver in alerts.items():
                if pkg in data[section]:
                    old_ver = data[section][pkg]
                    old_ver_clean = re.sub(r'^[^\d]*', '', old_ver)
                    should_update = True
                    from packaging.version import parse as parse_v
                    try:
                        if parse_v(old_ver_clean) >= parse_v(target_ver):
                            should_update = False
                    except Exception:
                        pass

                    if should_update:
                        new_ver = f"^{target_ver}"
                        if old_ver != new_ver:
                            data[section][pkg] = new_ver
                            modified = True
                            severity = ALERT_CATALOG.get(pkg, {}).get("severity", "ALERT")
                            changes.append(f"  [{severity}] [package.json] {filepath.relative_to(REPO_ROOT)} ({section}): {pkg}: '{old_ver}' -> '{new_ver}'")

    if modified:
        filepath.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return changes


def main():
    alerts = parse_alerts_from_args(sys.argv[1:])
    print("=== Dependabot / Security Alert Remediation ===")
    print(f"Targeting {len(alerts)} package constraints across /demos (Critical, High, Medium):")
    for pkg, ver in alerts.items():
        info = ALERT_CATALOG.get(pkg, {})
        sev = f"[{info.get('severity', 'INFO')}]" if info else ""
        print(f"  - {sev:<10} {pkg} >= {ver}")
    print()

    demos_dir = REPO_ROOT / "demos"
    all_changes = []

    # 1. Scan requirements*.txt
    for req_file in demos_dir.glob("**/requirements*.txt"):
        changes = update_requirements_file(req_file, alerts)
        all_changes.extend(changes)

    # 2. Scan pyproject.toml
    for pyproject_file in demos_dir.glob("**/pyproject.toml"):
        changes = update_pyproject_file(pyproject_file, alerts)
        all_changes.extend(changes)

    # 3. Scan package.json
    for pkg_json in demos_dir.glob("**/package.json"):
        changes = update_package_json(pkg_json, alerts)
        all_changes.extend(changes)

    print(f"Remediation Summary:")
    if all_changes:
        for change in all_changes:
            print(change)
        print(f"\nSuccessfully applied {len(all_changes)} update(s).")
    else:
        print("All demo manifests are already compliant with all Critical, High, and Medium alert constraints.")


if __name__ == "__main__":
    main()
