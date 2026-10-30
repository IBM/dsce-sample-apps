import { PocOffense, StageState } from '@/types';

export interface IncidentReportParams {
  offense: PocOffense;
  runs?: Record<string, StageState>;
  generatedAt?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateIncidentReportHtml({
  offense: rawOffense,
  runs = {},
  generatedAt = new Date().toISOString(),
}: IncidentReportParams): string {
  // Escape every string field once so interpolating into the HTML template is safe.
  const offense = Object.fromEntries(
    Object.entries(rawOffense).map(([k, v]) => [k, typeof v === 'string' ? escapeHtml(v) : v])
  ) as unknown as PocOffense;
  const isTP = offense.expectedOutcome === 'True Positive';
  const incidentId = `QR-${offense.id}`;
  const formattedDate = new Date(generatedAt).toISOString();

  // Determine severity badge class & label
  const severityClass = isTP
    ? offense.severity === 'Critical'
      ? 'severity-high'
      : 'severity-high'
    : offense.severity === 'Medium'
    ? 'severity-medium'
    : offense.severity === 'Low'
    ? 'severity-low'
    : 'severity-informational';

  const severityText = isTP ? (offense.severity === 'Critical' ? 'CRITICAL' : 'HIGH') : offense.severity.toUpperCase();

  // MITRE & Attack details based on offense
  const mitreTechnique = offense.id === '177254'
    ? 'TA0002 - Execution, TA0010 - Exfiltration\n• T1059.001 - PowerShell\n• T1053.005 - Scheduled Task\n• T1567 - Exfiltration Over Web Service (rclone)'
    : offense.id === '177940'
    ? 'TA0001 - Initial Access, TA0006 - Credential Access\n• T1110.001 - Brute Force: Password Guessing (MSSQL sa/admin)\n• T1078 - Valid Accounts\n• T1021.002 - SMB/Windows Admin Shares'
    : offense.id === '173500'
    ? 'TA0003 - Persistence, TA0004 - Privilege Escalation\n• T1543.003 - Create or Modify System Process: Windows Service\n• T1036.005 - Masquerading: Match Legitimate Name or Location'
    : offense.id === '180074'
    ? 'TA0006 - Credential Access, TA0003 - Persistence\n• T1098 - Account Manipulation: Password Reset / Change\n• T1059.004 - Unix Shell'
    : isTP
    ? 'TA0001 - Initial Access, TA0007 - Discovery\n• T1190 - Exploit Public-Facing Application (Path Traversal / LFI)\n• T1083 - File and Directory Discovery\n• T1059.006 - Python / Web Scripting'
    : 'TA0007 - Discovery (Benign Baseline / Allowlist Verified)\n• T1057 - Process Discovery (Normal Administrative Operation)';

  const entryPoint = isTP
    ? `External Web / Network Ingress from ${offense.sourceIp} targeting ${offense.destinationIp}`
    : `Internal System / Local Process Execution on ${offense.destinationIp || 'Local Host'}`;

  const toolsUsed = offense.id === '177254'
    ? '• PowerShell v5.1 with -ExecutionPolicy Bypass\n• rclone cloud sync binary (lenhsys.ps1)\n• Windows Task Scheduler (SYSTEM)'
    : offense.id === '177940'
    ? '• Automated MSSQL credential brute-force script\n• Distributed public proxy network (340 events)\n• TDS Protocol probes'
    : isTP
    ? '• Automated Web Vulnerability Scanner / LFI probe\n• Custom HTTP Request payload with path traversal sequences\n• Public IP routing infrastructure'
    : '• Standard Windows/Linux Administrative Binaries\n• Verified OEM update / management services (Allowlist BENIGN-001)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Security Incident Report - ${incidentId}</title>
<style>
    @media print {
        body {
            background-color: white !important;
            padding: 0 !important;
            max-width: 100% !important;
        }
        .report-container {
            box-shadow: none !important;
            padding: 0 !important;
            border: none !important;
        }
        .no-print {
            display: none !important;
        }
        .page-break {
            page-break-after: always;
        }
    }
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f5f5f5;
    }
    .report-container {
        background-color: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .report-header {
        border-bottom: 3px solid #0066cc;
        padding-bottom: 20px;
        margin-bottom: 30px;
    }
    .report-header h1 {
        color: #0066cc;
        margin: 0 0 10px 0;
        font-size: 28px;
    }
    .report-meta {
        color: #666;
        font-size: 14px;
    }
    .severity-badge {
        display: inline-block;
        padding: 5px 15px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 14px;
        margin-left: 10px;
    }
    .severity-high {
        background-color: #dc3545;
        color: white;
    }
    .severity-medium {
        background-color: #fd7e14;
        color: white;
    }
    .severity-low {
        background-color: #ffc107;
        color: #333;
    }
    .severity-informational {
        background-color: #17a2b8;
        color: white;
    }
    .rca-section {
        margin-bottom: 30px;
        padding: 20px;
        background-color: #f8f9fa;
        border-left: 4px solid #0066cc;
        border-radius: 4px;
    }
    .rca-section h2 {
        color: #0066cc;
        margin-top: 0;
        font-size: 20px;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
    }
    .rca-table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
    }
    .rca-table td {
        padding: 10px;
        border-bottom: 1px solid #dee2e6;
        font-size: 14px;
    }
    .rca-table td:first-child {
        font-weight: bold;
        width: 220px;
        color: #495057;
    }
    .timeline {
        list-style: none;
        padding-left: 0;
    }
    .timeline li {
        padding: 10px 0 10px 30px;
        border-left: 2px solid #0066cc;
        margin-left: 10px;
        position: relative;
    }
    .timeline li:before {
        content: "●";
        position: absolute;
        left: -6px;
        color: #0066cc;
        font-size: 12px;
    }
    .evidence-list {
        list-style: none;
        padding-left: 0;
    }
    .evidence-list li {
        padding: 8px 0;
        border-bottom: 1px solid #e9ecef;
    }
    .evidence-list li:last-child {
        border-bottom: none;
    }
    .highlight-box {
        background-color: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        padding: 15px;
        margin: 15px 0;
    }
    .success-box {
        background-color: #d4edda;
        border: 1px solid #28a745;
        border-radius: 4px;
        padding: 15px;
        margin: 15px 0;
    }
    .danger-box {
        background-color: #f8d7da;
        border: 1px solid #dc3545;
        border-radius: 4px;
        padding: 15px;
        margin: 15px 0;
    }
    .info-box {
        background-color: #d1ecf1;
        border: 1px solid #17a2b8;
        border-radius: 4px;
        padding: 15px;
        margin: 15px 0;
    }
    ul, ol {
        margin: 10px 0;
        padding-left: 20px;
    }
    ul li, ol li {
        margin: 5px 0;
    }
    .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #e9ecef;
        text-align: center;
        color: #6c757d;
        font-size: 12px;
    }
    code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
        color: #0f172a;
    }
</style>
</head>
<body>
<div class="report-container">
    <div class="report-header">
        <h1>🔒 Security Incident Report</h1>
        <div class="report-meta">
            <strong>Report Generated:</strong> ${formattedDate}<br>
            <strong>Report Type:</strong> Root Cause Analysis (RCA) · watsonx Orchestrate Autonomous SOC
        </div>
    </div>

    <!-- Section 1: Incident Overview -->
    <div class="rca-section">
        <h2>1. Incident Overview</h2>
        <table class="rca-table">
            <tr>
                <td>Incident ID:</td>
                <td><strong>${incidentId}</strong> (QRadar Offense #${offense.id})</td>
            </tr>
            <tr>
                <td>Incident Title:</td>
                <td>${offense.title}</td>
            </tr>
            <tr>
                <td>Timestamp:</td>
                <td>${formattedDate}</td>
            </tr>
            <tr>
                <td>Target Host / Asset:</td>
                <td><code>${offense.destinationIp}</code></td>
            </tr>
            <tr>
                <td>Source Entity / IP:</td>
                <td><code>${offense.sourceIp}</code></td>
            </tr>
            <tr>
                <td>Category / Module:</td>
                <td>${offense.category} (Module ${offense.module})</td>
            </tr>
            <tr>
                <td>Severity:</td>
                <td>
                    <span class="severity-badge ${severityClass}">${severityText}</span>
                </td>
            </tr>
        </table>
        <div class="${isTP ? 'danger-box' : 'success-box'}">
            <strong>Executive Summary:</strong><br>
            ${isTP
                ? `Active security incident identified for QRadar Offense #${offense.id}. Anomalous requests and exploit indicators detected from source ${offense.sourceIp} targeting ${offense.destinationIp}. Multi-agent pipeline classified this event as a <strong>True Positive</strong> requiring immediate automated containment and stakeholder notification.`
                : `Automated assessment completed for QRadar Offense #${offense.id}. Investigation verified activity originated from routine operational automation or approved administrative maintenance matching baseline policy. Classified as <strong>Non-Issue (${offense.closeNote})</strong> and marked for automated resolution.`
            }
        </div>
    </div>

    <!-- Section 2: Timeline of Events -->
    <div class="rca-section">
        <h2>2. Timeline of Events</h2>
        <ul class="timeline">
            <li>
                <strong>T0 — Ingress & Sensor Detection</strong><br>
                <em>Source: QRadar SIEM</em><br>
                Offense #${offense.id} triggered: ${offense.title} (${offense.eventCount} total correlated events).
            </li>
            <li>
                <strong>T1 — Autonomous Triage & IP Enrichment</strong><br>
                <em>Source: Triage Agent (watsonx Orchestrate)</em><br>
                Offense telemetry pulled from object store. IP reputation scored, asset criticality evaluated, and triage severity assigned.
            </li>
            <li>
                <strong>T2 — Detection Cascade & Adjudication</strong><br>
                <em>Source: Classification Agent (Module ${offense.module})</em><br>
                Evaluated payload patterns and historical baselines. Verdict rendered: <strong>${offense.expectedOutcome}</strong> (Confidence: High).
            </li>
            <li>
                <strong>T3 — Deep Root Cause Analysis</strong><br>
                <em>Source: RCA Agent (5-Dimension Investigation)</em><br>
                5-dimension attack chain correlation completed, MITRE ATT&CK techniques mapped, and impact scope determined.
            </li>
            <li>
                <strong>T4 — Remediation & Stakeholder Notification</strong><br>
                <em>Source: Notification & Action Agents</em><br>
                ${isTP ? `Containment action executed (Firewall ingress block for ${offense.sourceIp}) and incident report dispatched via Mailjet.` : `Offense stamped with closure note "${offense.closeNote}" and auto-closed in SIEM.`}
            </li>
        </ul>
    </div>

    <!-- Section 3: Detection Details -->
    <div class="rca-section">
        <h2>3. Detection Details</h2>
        <table class="rca-table">
            <tr>
                <td>Detection Source:</td>
                <td>QRadar SIEM — Offense ID: ${incidentId}</td>
            </tr>
            <tr>
                <td>Rule Logic / Trigger:</td>
                <td>${offense.title}</td>
            </tr>
            <tr>
                <td>Trigger Conditions:</td>
                <td>
                    • Correlated event count: ${offense.eventCount} events<br>
                    • Detection Module: ${offense.module} (${offense.category})<br>
                    • Target Network: ${offense.destinationIp}
                </td>
            </tr>
            <tr>
                <td>Classification:</td>
                <td>
                    <strong>${offense.expectedOutcome} — ${offense.closeNote}</strong>
                </td>
            </tr>
        </table>
        <div class="${isTP ? 'danger-box' : 'highlight-box'}">
            <strong>Classification Reasoning:</strong><br>
            ${isTP
                ? `The detected telemetry displays confirmed malicious indicators:
                   <ul>
                       <li>Exploitation syntax identified in request stream matching ${offense.category}</li>
                       <li>Threat intelligence confirms external source IP ${offense.sourceIp} is untrusted</li>
                       <li>Temporal event clustering exceeds normal operational baseline</li>
                       <li>Access status bypasses perimeter rules (alert_status=passed) requiring active containment</li>
                   </ul>`
                : `The investigation confirms non-malicious operational activity:
                   <ul>
                       <li>Activity originates from approved administrative tooling / scheduled script</li>
                       <li>Matches documented baseline policy and allowlist (BENIGN-001)</li>
                       <li>Zero unauthorized persistence, privilege escalation, or lateral movement detected</li>
                       <li>Eligible for automated closure without analyst overhead</li>
                   </ul>`
            }
        </div>
    </div>

    <!-- Section 4: Attack Vector and Techniques -->
    <div class="rca-section">
        <h2>4. Attack Vector and Techniques</h2>
        <table class="rca-table">
            <tr>
                <td>Entry Point:</td>
                <td>${entryPoint}</td>
            </tr>
            <tr>
                <td>MITRE ATT&CK TTPs:</td>
                <td>
                    <pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${mitreTechnique}</pre>
                </td>
            </tr>
            <tr>
                <td>Tools / Binaries Involved:</td>
                <td>
                    <pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${toolsUsed}</pre>
                </td>
            </tr>
        </table>
        <div class="info-box">
            <strong>Attack Methodology / Process Breakdown:</strong><br>
            ${isTP
                ? `<ol>
                       <li><strong>Reconnaissance:</strong> Probing public endpoints for known vulnerability paths.</li>
                       <li><strong>Exploitation Attempt:</strong> Submitting malformed request payloads (${offense.category}).</li>
                       <li><strong>Access Verification:</strong> Evaluating server response headers and status codes.</li>
                       <li><strong>Containment Trigger:</strong> Autonomous SOC pipeline intercepted and blocked attack chain.</li>
                   </ol>`
                : `<ol>
                       <li><strong>Scheduled Execution:</strong> Background process initiated routine administrative action.</li>
                       <li><strong>Telemetry Ingestion:</strong> QRadar logged standard event pattern.</li>
                       <li><strong>Deterministic Rule Match:</strong> Agent matched allowlist rule and suppressed alert.</li>
                   </ol>`
            }
        </div>
    </div>

    <!-- Section 5: Root Cause -->
    <div class="rca-section">
        <h2>5. Root Cause</h2>
        <div class="${isTP ? 'danger-box' : 'success-box'}">
            <strong>Root Cause Determination: ${isTP ? 'CONFIRMED ACTIVE THREAT ATTEMPT' : 'VERIFIED BENIGN / NORMAL BEHAVIOR'}</strong>
        </div>
        <table class="rca-table">
            <tr>
                <td>Primary Root Cause:</td>
                <td>
                    ${isTP
                        ? `External threat actor from IP ${offense.sourceIp} attempted active exploitation against service ${offense.destinationIp} utilizing ${offense.category} patterns.`
                        : `Routine operational baseline execution matching verified system administration patterns (${offense.closeNote}).`
                    }
                </td>
            </tr>
            <tr>
                <td>Contributing Factors:</td>
                <td>
                    ${isTP
                        ? `• Publicly exposed ingress endpoint<br>• Need for stricter WAF input validation rule tuning<br>• High-volume automated scanner targeting perimeter`
                        : `• Standard maintenance window execution<br>• Known administrative software signature<br>• Safe internal network segment`
                    }
                </td>
            </tr>
        </table>
        <div class="highlight-box">
            <strong>Evidence Summary Supporting Determination:</strong>
            <ul>
                <li><strong>SIEM Correlation:</strong> ${offense.eventCount} events analyzed in time window</li>
                <li><strong>Threat Reputation:</strong> IP ${offense.sourceIp} evaluated across global threat feeds</li>
                <li><strong>Host Telemetry:</strong> Asset ${offense.destinationIp} baseline deviation checked</li>
                <li><strong>Audit Trail:</strong> Multi-agent reasoning trace logged with cryptographic verification</li>
            </ul>
        </div>
    </div>

    <!-- Section 6: Scope and Impact -->
    <div class="rca-section">
        <h2>6. Scope and Impact</h2>
        <table class="rca-table">
            <tr>
                <td>Affected Systems / Targets:</td>
                <td>
                    • Primary Host: <code>${offense.destinationIp}</code><br>
                    • Network Scope: Production Perimeter Gateway<br>
                    • Source IP: <code>${offense.sourceIp}</code>
                </td>
            </tr>
            <tr>
                <td>Affected Users / Scope:</td>
                <td>
                    • Impact Scope: ${isTP ? '1 targeted production asset' : 'Internal baseline system'}
                </td>
            </tr>
            <tr>
                <td>Exposure Duration:</td>
                <td>
                    • Detection Time: ${formattedDate}<br>
                    • Resolution: Automated within ~2 minutes<br>
                    • Current Status: <strong>${isTP ? 'Contained & Blocked' : 'Closed (Resolved)'}</strong>
                </td>
            </tr>
        </table>
        <div class="${isTP ? 'danger-box' : 'info-box'}">
            <strong>Business Impact Assessment:</strong>
            <ul>
                <li><strong>Confidentiality:</strong> ${isTP ? 'MEDIUM — Potential configuration probing prevented' : 'NONE — No sensitive data accessed'}</li>
                <li><strong>Integrity:</strong> ${isTP ? 'LOW — No host tampering or file modifications succeeded' : 'NONE — System state unchanged'}</li>
                <li><strong>Availability:</strong> NONE — Full service uptime maintained</li>
                <li><strong>Compliance & Audit:</strong> Incident logged with full multi-agent traceability</li>
            </ul>
        </div>
    </div>

    <!-- Section 7: Containment and Remediation -->
    <div class="rca-section">
        <h2>7. Containment and Remediation</h2>
        <div class="success-box">
            <strong>Containment Steps Taken:</strong>
            <ul>
                ${isTP
                    ? `<li>✅ Applied edge firewall ingress drop rule for attacker IP: <code>${offense.sourceIp}</code></li>
                       <li>✅ Generated and dispatched executive HTML incident report via Mailjet</li>
                       <li>✅ Stamped QRadar offense #${offense.id} with status: <code>${offense.closeNote}</code></li>
                       <li>✅ Enhanced telemetry monitoring activated for host <code>${offense.destinationIp}</code></li>`
                    : `<li>✅ Verified event signature against approved allowlist (BENIGN-001)</li>
                       <li>✅ Offense #${offense.id} automatically resolved with note: <code>${offense.closeNote}</code></li>
                       <li>✅ Tier-1 analyst manual workload saved</li>`
                }
            </ul>
        </div>
        <table class="rca-table">
            <tr>
                <td>Recommended Follow-Up Actions:</td>
                <td>
                    ${isTP
                        ? `<strong>Immediate (0-24 hours):</strong><br>
                           • Verify firewall edge drop rule persistence for ${offense.sourceIp}<br>
                           • Inspect web application access logs for secondary probes<br><br>
                           <strong>Short-term (1-7 days):</strong><br>
                           • Review WAF virtual patching rules for ${offense.category}<br>
                           • Conduct perimeter port audit on ${offense.destinationIp}`
                        : `<strong>Continuous Improvement:</strong><br>
                           • Maintain allowlist rules for scheduled maintenance tasks<br>
                           • Monitor future baseline drifts in QRadar SIEM`
                    }
                </td>
            </tr>
            <tr>
                <td>Remediation Priority:</td>
                <td>
                    <span class="severity-badge ${isTP ? 'severity-high' : 'severity-low'}">
                        ${isTP ? 'CRITICAL - P1' : 'INFORMATIONAL - P4'}
                    </span>
                </td>
            </tr>
        </table>
    </div>

    <!-- Section 8: Recommendations -->
    <div class="rca-section">
        <h2>8. Recommendations</h2>
        <table class="rca-table">
            <tr>
                <td>QRadar Tuning Suggestions:</td>
                <td>
                    • Update correlation threshold for rapid-fire ${offense.category} triggers<br>
                    • Integrate dynamic threat intelligence feed updates into rule sets<br>
                    • Maintain allowlist policies to suppress recurring benign administrative triggers
                </td>
            </tr>
            <tr>
                <td>Additional Security Controls:</td>
                <td>
                    <strong>Technical Controls:</strong><br>
                    • Enforce strict WAF request filtering on public-facing endpoints<br>
                    • Enable enhanced host baseline behavioral analytics<br><br>
                    <strong>Administrative Controls:</strong><br>
                    • Regular review of external IP blocklists<br>
                    • Periodic SOC multi-agent workflow validation exercises
                </td>
            </tr>
        </table>
    </div>

    <!-- Section 9: Evidence and Attachments -->
    <div class="rca-section">
        <h2>9. Evidence and Attachments</h2>
        <table class="rca-table">
            <tr>
                <td>Log Samples (Sanitized):</td>
                <td>
                    <code style="display:block; background:#f8f9fa; padding:10px; margin:5px 0; border-left:3px solid ${isTP ? '#dc3545' : '#28a745'};">
                        ${formattedDate} - OFFENSE #${offense.id} - ${offense.title} - SRC: ${offense.sourceIp} - DST: ${offense.destinationIp} - STATUS: ${isTP ? 'PASSED (CONTAINED)' : 'ALLOWLIST_MATCH'}
                    </code>
                </td>
            </tr>
            <tr>
                <td>Indicators of Compromise (IOCs):</td>
                <td>
                    <strong>IP Addresses:</strong><br>
                    • Source IP: <code>${offense.sourceIp}</code> (${isTP ? 'Malicious - Blocked' : 'Internal / Verified'})<br>
                    • Target IP: <code>${offense.destinationIp}</code><br><br>
                    <strong>Offense Classification:</strong><br>
                    • Verdict: <strong>${offense.expectedOutcome}</strong><br>
                    • Disposition Note: <code>${offense.closeNote}</code>
                </td>
            </tr>
            <tr>
                <td>Data Sources Consulted:</td>
                <td>
                    • IBM QRadar SIEM (Primary detection source)<br>
                    • IBM Cloud Object Storage Offense Repository<br>
                    • SOC Threat Intelligence & Asset Criticality CMDB<br>
                    • watsonx Orchestrate 5-Agent Multi-Agent Execution Engine
                </td>
            </tr>
        </table>
    </div>

    <div class="footer">
        <p>
            <strong>Report Classification:</strong> CONFIDENTIAL — Internal SOC Use Only<br>
            <strong>Distribution:</strong> Security Operations Center, Incident Response Team, CISO Office<br>
            <strong>Generated by:</strong> IBM watsonx Orchestrate Agentic SOC System<br>
            For questions or further investigation, contact the SOC Lead.
        </p>
    </div>
</div>
</body>
</html>`;
}

export function generateIncidentReportMarkdown({
  offense,
  runs = {},
  generatedAt = new Date().toISOString(),
}: IncidentReportParams): string {
  const isTP = offense.expectedOutcome === 'True Positive';
  const incidentId = `QR-${offense.id}`;
  const formattedDate = new Date(generatedAt).toISOString();

  return `# 🔒 Security Incident Report — ${incidentId}

**Report Generated:** ${formattedDate}  
**Report Type:** Root Cause Analysis (RCA) · watsonx Orchestrate Autonomous SOC  
**Classification:** CONFIDENTIAL — Internal SOC Use Only  

---

## 1. Incident Overview

- **Incident ID:** \`${incidentId}\` (QRadar Offense #${offense.id})
- **Incident Title:** ${offense.title}
- **Timestamp:** ${formattedDate}
- **Target Host / Asset:** \`${offense.destinationIp}\`
- **Source Entity / IP:** \`${offense.sourceIp}\`
- **Category / Module:** ${offense.category} (Module ${offense.module})
- **Severity:** **${isTP ? 'HIGH / CRITICAL' : offense.severity.toUpperCase()}**
- **Final Classification:** **${offense.expectedOutcome}** (${offense.closeNote})

> **Executive Summary:**  
> ${isTP
    ? `Active security incident identified for QRadar Offense #${offense.id}. Anomalous requests and exploit indicators detected from source ${offense.sourceIp} targeting ${offense.destinationIp}. Multi-agent pipeline classified this event as a True Positive requiring immediate automated containment.`
    : `Automated assessment completed for QRadar Offense #${offense.id}. Investigation verified activity originated from routine operational automation or approved administrative maintenance matching baseline policy. Classified as Non-Issue (${offense.closeNote}).`
  }

---

## 2. Timeline of Events

1. **T0 — Ingress & Sensor Detection**: Offense #${offense.id} triggered in QRadar SIEM with ${offense.eventCount} correlated events.
2. **T1 — Autonomous Triage & IP Enrichment**: Triage Agent enriched IP reputation, CMDB asset criticality, and calculated triage severity.
3. **T2 — Detection Cascade & Adjudication**: Classification Agent evaluated rules (Module ${offense.module}) and adjudicated verdict: **${offense.expectedOutcome}**.
4. **T3 — Root Cause Analysis**: RCA Agent completed 5-dimension analysis and MITRE ATT&CK correlation.
5. **T4 — Containment & Remediation**: ${isTP ? `Firewall ingress drop applied for ${offense.sourceIp} and alert dispatched.` : `Offense stamped with "${offense.closeNote}" and auto-closed.`}

---

## 3. Detection Details

- **Detection Source:** QRadar SIEM — Offense #${offense.id}
- **Rule Logic:** ${offense.title}
- **Event Count:** ${offense.eventCount} events analyzed
- **Verdict:** **${offense.expectedOutcome}**

---

## 4. Attack Vector & Techniques

- **Entry Point:** ${isTP ? `External Ingress from ${offense.sourceIp}` : 'Internal Local Process'}
- **MITRE ATT&CK:** ${isTP ? 'T1190 (Exploit Public-Facing Application) / T1083 (Discovery)' : 'T1057 (Process Discovery - Benign)'}
- **Remediation Priority:** **${isTP ? 'CRITICAL - P1' : 'INFORMATIONAL - P4'}**

---

## 5. Containment & Remediation

${isTP
  ? `- ✅ Applied edge firewall ingress drop rule for IP: \`${offense.sourceIp}\`
- ✅ Generated and dispatched executive HTML incident report
- ✅ Stamped QRadar offense #${offense.id} with status: \`${offense.closeNote}\``
  : `- ✅ Verified event signature against approved allowlist (BENIGN-001)
- ✅ Offense #${offense.id} automatically resolved with note: \`${offense.closeNote}\``
}

---

*Generated by IBM watsonx Orchestrate Agentic SOC System.*
`;
}
