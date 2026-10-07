# Dependabot & Security Alert Automated Remediation

This directory provides automated scripts and agent execution instructions to remediate **Critical**, **High**, and **Medium** Dependabot, WhiteSource/Mend, and GitHub security alerts across all demo repositories in `demos/`.

---

## 🤖 Instructions for AI Agent (Bob)

When a user points you to this README or asks to remediate a Dependabot / security issue:

### Step 1: Collect Alert Information
- If the user hasn't provided the alert details (issue number, link, or markdown table of CVEs/packages), ask them:
  > *"Please provide the Dependabot issue URL/number or paste the table of vulnerable packages and target fix versions."*

### Step 2: Parse Alert Packages & Versions
- Save the issue text or table to a temporary file or parse it with `parse_issue_alerts.py`:
  ```bash
  python demos/dependabot-security/parse_issue_alerts.py <issue_alerts.txt>
  ```
- Extract the list of target packages and minimum safe versions across all severities:
  - **Critical**: `PyJWT@2.14.0`, `cryptography@50.0.0`, `anyio@4.4.0`, `fastapi@0.115.5`, `uvicorn@0.32.0`, `starlette@0.40.0`
  - **High**: `aiohttp@3.14.3`, `axios@1.18.0`, `express@5.1.0`, `vite@6.4.3`, `requests@2.33.0`, `geopy@2.5.0`, `jinja2@3.1.6`, `werkzeug@3.1.3`, `tornado@6.4.2`
  - **Medium**: `python-dotenv@1.2.2`, `pytest@9.0.3`, `pydantic@2.10.3`, `urllib3@2.3.0`, `certifi@2024.12.14`, `postcss@8.5.23`, `yaml@2.8.3`, `dompurify@3.4.15`, `marked@18.0.14`, `react-router-dom@6.30.6`

### Step 3: Parallel Execution via Subagents
- **Do not process every demo sequentially.** Divide the demo directories across parallel subagents using `spawn_subagent`.
- Group the demos into concurrent batches:
  - **Subagent 1**: `demos/smart-cold-chain-fleetops-phase1/` & `demos/live-context-for-supply-chain-resilience/`
  - **Subagent 2**: `demos/asset-management-knowledge-hub/` & `demos/unified-ai-driven-analytics-platform/`
  - **Subagent 3**: `demos/orbital-outfitters-code/`, `demos/sre-copilot-code/`, `demos/agent-ops-evaluation/`
  - **Subagent 4**: `demos/a2-d2-aerial-analysis-and-drone-detection/`, `demos/headlessbob-building-blocks-qa-bot/`, `demos/biw-motivation-graph/`, `demos/bob-in-slack-salesforce/`, `demos/dpdp-compliance/`, `demos/ai-guardrails/`, `demos/supply-chain-risk-control-tower/`
- Spawn all subagents in a single turn so they run concurrently:
  - Each subagent executes `remediate_alerts.py` or updates its assigned manifests (`requirements*.txt`, `pyproject.toml`, and `package.json`).
  - Each subagent returns a summary categorized by severity (**[CRITICAL]**, **[HIGH]**, **[MEDIUM]**).

### Step 4: Verification & Consolidation
- Collect results from all completed subagents.
- Run `git status -s` and `git diff` to verify changes across the workspace.
- Provide the user with a concise summary table:
  - Severity level (`CRITICAL` / `HIGH` / `MEDIUM`)
  - Affected Demo / Manifest
  - Package Name
  - Previous Version / Constraint -> New Safe Constraint
  - Vulnerability / CVE Status (Resolved)

---

## 🛠 Script Reference

### `remediate_alerts.py`
Scans manifests (`requirements*.txt`, `pyproject.toml`, `package.json`) and updates package constraints across all severity levels:
```bash
# Run with default catalog (covers Critical, High, and Medium alerts)
python demos/dependabot-security/remediate_alerts.py

# Filter by severity:
python demos/dependabot-security/remediate_alerts.py --severity CRITICAL,HIGH

# Run for specific packages and target versions
python demos/dependabot-security/remediate_alerts.py PyJWT@2.14.0 anyio@4.4.0 jinja2@3.1.6 axios@1.18.0
```

### `parse_issue_alerts.py`
Extracts package names, severities, and patched versions from GitHub issue markdown tables or raw alert text:
```bash
python demos/dependabot-security/parse_issue_alerts.py issue_alerts.txt
```
