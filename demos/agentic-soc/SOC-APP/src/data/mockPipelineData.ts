import { RunDetails, PocOffense } from '@/types';
import { POC_OFFENSES } from './sampleOffenses';

export interface StageMockData {
  outputText: string;
  durationMs: number;
  toolCalls: Array<{
    name: string;
    input: Record<string, any>;
    output: Record<string, any>;
  }>;
}

export interface OffenseMockPipeline {
  triage: StageMockData;
  classification: StageMockData;
  rca: StageMockData;
  notification: StageMockData;
  action: StageMockData;
  close?: StageMockData;
}

// ── Detailed Mock Generators for Key Scenarios ──────────────────────────────────

function buildStepHistory(toolCalls: StageMockData['toolCalls']) {
  const steps: any[] = [];
  toolCalls.forEach((tc, idx) => {
    const callId = `call_mock_${idx + 1}_${tc.name}`;
    steps.push({
      type: 'tool_execution',
      step_details: [
        {
          type: 'tool_calls',
          tool_calls: [
            {
              id: callId,
              name: tc.name,
              args: tc.input,
            },
          ],
        },
        {
          type: 'tool_response',
          tool_call_id: callId,
          name: tc.name,
          content: tc.output,
        },
      ],
    });
  });
  return steps;
}

export function buildMockRunDetails(
  stageKey: string,
  offenseId: string,
  startedAt?: string
): RunDetails {
  const startTime = startedAt || new Date(Date.now() - 5000).toISOString();
  const offense = POC_OFFENSES.find((o) => o.id === offenseId) || POC_OFFENSES[0];
  const mockStage = getMockStageData(stageKey, offense);

  const durationMs = 5000;
  const completedTime = new Date(new Date(startTime).getTime() + durationMs).toISOString();
  const stepHistory = buildStepHistory(mockStage.toolCalls);

  const traces = mockStage.toolCalls.flatMap((tc, idx) => [
    {
      event_type: 'tool_call',
      name: tc.name,
      content: tc.input,
      timestamp: new Date(new Date(startTime).getTime() + idx * 400).toISOString(),
    },
    {
      event_type: 'tool_response',
      name: tc.name,
      content: tc.output,
      timestamp: new Date(new Date(startTime).getTime() + idx * 400 + 250).toISOString(),
    },
  ]);

  return {
    threadId: `mock-thread-${offense.id}-${stageKey}`,
    runId: `mock-run-${offense.id}-${stageKey}-${Date.now().toString(36)}`,
    taskId: `mock-task-${stageKey}`,
    messageId: `mock-msg-${stageKey}`,
    status: 'completed',
    outputText: mockStage.outputText,
    analytics: {
      status: 'completed',
      durationMs,
      toolCalls: mockStage.toolCalls.length,
      traceCount: traces.length + 2,
      startedAt: startTime,
      updatedAt: completedTime,
    },
    traces,
    raw: {
      status: 'completed',
      created_at: startTime,
      completed_at: completedTime,
      result: {
        data: {
          message: {
            content: [{ text: mockStage.outputText }],
            step_history: stepHistory,
          },
        },
      },
    },
  };
}

export function getMockStageData(stageKey: string, offense: PocOffense): StageMockData {
  const isTruePositive = offense.expectedOutcome === 'True Positive';

  switch (stageKey) {
    case 'triage':
      return generateTriageMock(offense);
    case 'classification':
      return generateClassificationMock(offense);
    case 'rca':
      return generateRcaMock(offense);
    case 'notification':
      return generateNotificationMock(offense);
    case 'action':
      return generateActionMock(offense);
    case 'close':
      return generateCloseMock(offense);
    default:
      return generateTriageMock(offense);
  }
}

// ── Triage Mock Data ────────────────────────────────────────────────────────────

function generateTriageMock(offense: PocOffense): StageMockData {
  const isTP = offense.expectedOutcome === 'True Positive';
  const severity = isTP ? 'High' : offense.severity;
  const ruleFired = isTP ? 'T4 (Web Exploit / High Impact Threat)' : 'T1 (Standard Telemetry / Allowlisted)';
  const allowlistStatus = isTP ? 'NO MATCH (External Unknown)' : 'MATCHED: BENIGN-001 (Internal Trusted)';

  const outputText = `### [Triage Agent] Offense Assessment Summary

- **Offense ID**: \`${offense.id}\`
- **Description**: ${offense.title}
- **Assigned Triage Severity**: \`${severity}\` (Initial: ${offense.severity})
- **Category**: ${offense.category}
- **Source IP**: \`${offense.sourceIp}\` | **Destination**: \`${offense.destinationIp}\`
- **Event Count**: ${offense.eventCount} events analyzed
- **Allowlist Status**: ${allowlistStatus}
- **Deterministic Rules Fired**: \`${ruleFired}\`

#### Key Findings:
1. Offense metadata retrieved from SIEM object store.
2. Threat intel lookup completed for source IP \`${offense.sourceIp}\`.
3. Asset criticality evaluated for target \`${offense.destinationIp}\`.
4. ${isTP ? '⚠️ Anomalous external request patterns identified requiring module classification.' : '✅ Matched standard operational baseline and allowlist patterns.'}

**Next Step Recommendation**: Hand off to **Classification Agent** with triage context.`;

  return {
    outputText,
    durationMs: 1450,
    toolCalls: [
      {
        name: 'fetch_offense',
        input: { offense_id: offense.id },
        output: {
          offense_id: offense.id,
          description: offense.title,
          severity: offense.severity,
          event_count: offense.eventCount,
          source_network: offense.sourceIp,
          destination_network: offense.destinationIp,
        },
      },
      {
        name: 'lookup_threat_intel',
        input: { ip: offense.sourceIp },
        output: {
          ip: offense.sourceIp,
          reputation_score: isTP ? 88 : 12,
          is_tor_or_proxy: isTP,
          tags: isTP ? ['known_scanner', 'exploit_source'] : ['internal_subnet', 'verified_service'],
        },
      },
      {
        name: 'lookup_asset',
        input: { ip: offense.destinationIp },
        output: {
          asset_id: `ASSET-${offense.id.slice(0, 4)}`,
          hostname: 'prod-srv-core-01',
          criticality: isTP ? 'Tier-1 Critical' : 'Tier-3 Internal',
          owner: 'secops-infrastructure-team',
        },
      },
      {
        name: 'check_allowlist',
        input: { ip: offense.sourceIp, category: offense.category },
        output: {
          matched: !isTP,
          allowlist_id: !isTP ? 'BENIGN-001' : null,
          action: !isTP ? 'suppress_alert' : 'proceed_triage',
        },
      },
      {
        name: 'update_offense_severity',
        input: { offense_id: offense.id, updated_severity: severity },
        output: { success: true, offense_id: offense.id, new_severity: severity },
      },
    ],
  };
}

// ── Classification Mock Data ───────────────────────────────────────────────────

function generateClassificationMock(offense: PocOffense): StageMockData {
  const isTP = offense.expectedOutcome === 'True Positive';
  const verdict = isTP ? 'True Positive' : 'Non-Issue';
  const confidence = isTP ? 'High (96.4%)' : 'High (98.2%)';
  const autoClose = !isTP;
  const moduleName = offense.module || (isTP ? 'M1 (Web Exploit Detection)' : 'M1 (Allowlist Verification)');

  const outputText = `### [Classification Agent] Adjudication Verdict

- **Offense ID**: \`${offense.id}\`
- **Final Classification**: **\`${verdict}\`**
- **Confidence**: \`${confidence}\`
- **Active Detection Module**: \`${moduleName}\`
- **Auto-Close Eligible**: \`${autoClose ? 'true' : 'false'}\`
- **Severity Override**: \`${isTP ? 'Critical' : 'Low'}\`

#### Module Evaluation Details:
- **Module Rule**: ${offense.title}
- **Payload Inspection**: ${isTP ? 'Detected active unauthorized exploit pattern in HTTP request stream.' : 'Payload consistent with benign scheduled task / administrative binary.'}
- **Closure Note**: ${offense.closeNote}

${
  isTP
    ? `**Workflow Branch**: ➔ **Full Investigation Path** (Proceeding to RCA Agent for 5-dimension analysis).`
    : `**Workflow Branch**: ➔ **Direct Closure Path** (Non-issue validated against security baseline; marked for auto-closure).`
}`;

  return {
    outputText,
    durationMs: 1820,
    toolCalls: [
      {
        name: 'fetch_offense_events',
        input: { offense_id: offense.id, limit: 100 },
        output: {
          offense_id: offense.id,
          retrieved_events: offense.eventCount,
          sample_events: [
            { timestamp: '2025-02-14T08:30:12Z', log_source: 'WAF_NGINX', alert_status: isTP ? 'passed' : 'blocked' },
          ],
        },
      },
      {
        name: 'fetch_host_baseline',
        input: { host: offense.destinationIp },
        output: {
          baseline_id: 'BASE-PROD-LINUX-2025',
          deviations_found: isTP ? 3 : 0,
          status: isTP ? 'anomalous_activity' : 'within_baseline',
        },
      },
      {
        name: 'check_service_path',
        input: { path: '/etc/passwd' },
        output: {
          is_protected: true,
          access_allowed: false,
          risk: isTP ? 'CRITICAL_FILE_ACCESS' : 'NONE',
        },
      },
      {
        name: 'close_offense',
        input: { offense_id: offense.id, auto_close: autoClose, reason: verdict },
        output: { success: true, auto_close_queued: autoClose },
      },
    ],
  };
}

// ── RCA Mock Data ──────────────────────────────────────────────────────────────

function generateRcaMock(offense: PocOffense): StageMockData {
  const isTP = offense.expectedOutcome === 'True Positive';

  if (!isTP) {
    return {
      outputText: `### [RCA Agent] Root Cause Analysis — Non-Issue Summary

- **Offense ID**: \`${offense.id}\`
- **Investigation Status**: **RESOLVED AS NON-ISSUE**
- **Root Cause**: Routine system behavior or approved administrative automation.
- **Evidence**: Events match baseline execution patterns for \`${offense.title}\`.
- **Closure Validation**: No malicious persistence, lateral movement, or data exfiltration detected.
- **Outcome**: Offense marked as ${offense.closeNote}.`,
      durationMs: 1100,
      toolCalls: [
        {
          name: 'fetch_rca_events',
          input: { offense_id: offense.id },
          output: { relevant_events_count: 0, status: 'baseline_verified' },
        },
      ],
    };
  }

  const mitreTechnique = offense.id === '177254'
    ? 'T1059.001 (PowerShell) / T1567 (Exfiltration Over Web Service)'
    : offense.id === '177940'
    ? 'T1110.001 (Brute Force: Password Guessing)'
    : offense.id === '173500'
    ? 'T1543.003 (Create or Modify System Process: Windows Service)'
    : offense.id === '180074'
    ? 'T1098 (Account Manipulation: Password Change)'
    : 'T1190 (Exploit Public-Facing Application) / T1083 (File and Directory Discovery)';

  const outputText = `### [RCA Agent] 5-Dimension Root Cause Investigation Report

- **Offense ID**: \`${offense.id}\`
- **Incident Determination**: **\`ATTACK ATTEMPT — ACTIVE EXPLOITATION\`**
- **Target Asset**: \`${offense.destinationIp}\`
- **Attacker IP / Identity**: \`${offense.sourceIp}\`
- **MITRE ATT&CK Mapping**: \`${mitreTechnique}\`

---

#### 1. Attack Vector & Initial Access
The threat actor initiated targeted requests against endpoint \`${offense.destinationIp}\` utilizing payload patterns tailored for \`${offense.category}\`. The requests bypassed initial ingress filters with \`alert_status=passed\`.

#### 2. Attacker Intent
- **Reconnaissance & Privilege Escalation**: System configuration probing.
- **Payload Signature**: Directory traversal patterns (\`../../etc/passwd\`) attempting to retrieve sensitive operational environment files.

#### 3. Attack Timeline Reconstruction
- **T0 (08:14:02 UTC)**: Initial port probe from \`${offense.sourceIp}\`.
- **T1 (08:14:28 UTC)**: First malformed request triggered WAF rule T4.
- **T2 (08:15:01 UTC)**: Continuous rapid-fire exploitation attempts (total: ${offense.eventCount} events).
- **T3 (08:15:45 UTC)**: SIEM correlated offense \`${offense.id}\` triggered.

#### 4. Asset & Business Impact
- **Impacted Host**: Critical production service.
- **Data Exposure Risk**: High risk of credential harvest or configuration leakage.

#### 5. Recommended Remediation
1. **Immediate**: Execute firewall block rule for attacker IP \`${offense.sourceIp}\`.
2. **Containment**: Validate integrity of web application service directory.
3. **Escalation**: Notify Tier-1 and SOC Incident Lead via Mailjet.`;

  return {
    outputText,
    durationMs: 2450,
    toolCalls: [
      {
        name: 'fetch_rca_events',
        input: { offense_id: offense.id, filter: 'relevant_only' },
        output: {
          offense_id: offense.id,
          filtered_event_count: offense.eventCount,
          time_window: '2025-02-14T08:14:02Z - 2025-02-14T08:15:45Z',
          attack_chain_length: 4,
        },
      },
      {
        name: 'fetch_offense_history',
        input: { source_ip: offense.sourceIp, lookback_days: 30 },
        output: {
          prior_offenses: 2,
          first_seen: '2025-01-20T11:22:00Z',
          risk_trend: 'escalating',
        },
      },
      {
        name: 'lookup_threat_intel',
        input: { ip: offense.sourceIp },
        output: {
          ip: offense.sourceIp,
          threat_actor: 'APT-SCAN-GROUP',
          cve_associations: ['CVE-2021-41773', 'CVE-2024-1709'],
        },
      },
    ],
  };
}

// ── Notification Mock Data ─────────────────────────────────────────────────────

function generateNotificationMock(offense: PocOffense): StageMockData {
  const isTP = offense.expectedOutcome === 'True Positive';

  const outputText = `### [Notification Agent] Stakeholder Incident Report Dispatched

- **Offense ID**: \`${offense.id}\`
- **Delivery Service**: **Mailjet REST API** (\`soc-mailjet-relay\`)
- **Recipient(s)**: \`soc-lead@enterprise-corp.com\`, \`secops-oncall@enterprise-corp.com\`
- **Subject**: \`[CRITICAL ALERT] QRadar Offense ${offense.id} — ${offense.title}\`
- **Status**: \`DELIVERED (HTTP 200 / MessageID: mj_msg_${offense.id}_99281)\`

#### Email Body Preview (HTML Formatted):
> **SOC Incident Alert Notification**
> - **Incident**: QRadar Offense #${offense.id}
> - **Verdict**: ${isTP ? 'True Positive (Critical)' : 'Non-Issue (Resolved)'}
> - **Source IP**: ${offense.sourceIp}
> - **Target**: ${offense.destinationIp}
> - **Summary**: ${offense.title}
> - **Action Item**: ${isTP ? 'Automated IP containment rule queued for execution.' : 'No analyst action required.'}

*Notification payload generated and archived to compliance audit log.*`;

  return {
    outputText,
    durationMs: 1320,
    toolCalls: [
      {
        name: 'generate_incident_report',
        input: {
          offense_id: offense.id,
          verdict: isTP ? 'True Positive' : 'Non-Issue',
          format: 'html',
        },
        output: {
          report_id: `RPT-${offense.id}`,
          html_size_bytes: 4820,
          status: 'generated',
        },
      },
      {
        name: 'send_email_notification',
        input: {
          to: 'soc-lead@enterprise-corp.com',
          subject: `[CRITICAL ALERT] QRadar Offense ${offense.id} — ${offense.title}`,
          connection: 'soc-mailjet',
        },
        output: {
          status: 'success',
          message_id: `mj_msg_${offense.id}_99281`,
          timestamp: new Date().toISOString(),
        },
      },
    ],
  };
}

// ── Action Mock Data ───────────────────────────────────────────────────────────

function generateActionMock(offense: PocOffense): StageMockData {
  const isTP = offense.expectedOutcome === 'True Positive';
  const actionType = isTP ? 'block_ip_address' : 'record_non_issue_closure';
  const target = isTP ? offense.sourceIp : offense.id;

  const outputText = `### [Action Agent] Remediation Execution Summary

- **Offense ID**: \`${offense.id}\`
- **Remediation Action**: **\`${actionType}\`**
- **Target Target/Entity**: \`${target}\`
- **Analyst Approval Policy**: \`Auto-approved (SOC Policy Engine v4.2)\`
- **Execution Status**: **\`SUCCESS\`** (Exit Code 0)

#### Actions Executed:
1. **${isTP ? `Firewall Ingress Block Applied` : `QRadar Offense Status Updated`}**:
   - Rule ID: \`FW-BLOCK-AUTO-${offense.id}\`
   - Scope: Ingress traffic dropped on perimeter edge gateway.
   - TTL / Duration: Permanent (Until manual tier-2 review).
2. **Audit Log Appended**:
   - Ticket reference stamped: \`#QRO-${offense.id}-CONTAINED\`
   - Status updated in QRadar SIEM instance.

**Pipeline Resolution**: Complete containment and ticket documentation finalized.`;

  return {
    outputText,
    durationMs: 1650,
    toolCalls: [
      {
        name: isTP ? 'block_ip' : 'close_offense',
        input: isTP
          ? { ip: offense.sourceIp, reason: `QRadar Offense ${offense.id} exploit containment` }
          : { offense_id: offense.id, reason: 'Non-Issue: Normal Behavior' },
        output: {
          success: true,
          action_id: `ACT-${offense.id}-01`,
          applied_at: new Date().toISOString(),
          status: 'SUCCESS',
        },
      },
      {
        name: 'update_firewall_rule',
        input: {
          rule_name: `AUTO_BLOCK_${offense.sourceIp.replace(/[^0-9]/g, '_')}`,
          action: 'DENY',
        },
        output: {
          firewall: 'paloalto-edge-cluster-01',
          rule_synced: true,
        },
      },
    ],
  };
}

// ── Close Mock Data (Optional 6th stage) ────────────────────────────────────────

function generateCloseMock(offense: PocOffense): StageMockData {
  return {
    outputText: `### [Close Agent] Offense Closure & Case Finalization

- **Offense ID**: \`${offense.id}\`
- **Final Verdict**: **\`${offense.expectedOutcome}\`**
- **Closure Note**: ${offense.closeNote}
- **QRadar Ticket Status**: \`CLOSED (RESOLVED)\`
- **Case Audit Trail**: All agent outputs, tool calls, and trace telemetry archived.`,
    durationMs: 950,
    toolCalls: [
      {
        name: 'close_offense_tool',
        input: {
          offense_id: offense.id,
          verdict: offense.expectedOutcome,
          close_note: offense.closeNote,
        },
        output: {
          success: true,
          offense_id: offense.id,
          closed_at: new Date().toISOString(),
          status: 'CLOSED',
        },
      },
    ],
  };
}

// ── Mock Supervisor Chat Responses ─────────────────────────────────────────────

export function getMockSupervisorChatResponse(userMessage: string, offenseId: string): string {
  const offense = POC_OFFENSES.find((o) => o.id === offenseId) || POC_OFFENSES[0];
  const msg = userMessage.toLowerCase();

  if (msg.includes('analyze') || msg.includes('start') || msg.includes('run')) {
    return `### 🛡️ Conversational Supervisor
I am orchestrating the multi-agent investigation for **Offense ${offense.id}** (${offense.title}).

**Current Pipeline Status:**
1. **Triage Agent**: Categorized as **${offense.severity}** severity.
2. **Classification Agent**: Evaluated as **${offense.expectedOutcome}** (${offense.module}).
3. **RCA Agent**: ${offense.expectedOutcome === 'True Positive' ? 'Identified active exploitation vector and mapped to MITRE ATT&CK.' : 'Validated against baseline (Non-issue).'}
4. **Notification Agent**: Email dispatched to SOC stakeholders.
5. **Action Agent**: Containment action applied (\`${offense.expectedOutcome === 'True Positive' ? 'block_ip ' + offense.sourceIp : 'close_offense'}\`).

Would you like me to drill down into the event logs, inspect tool traces, or modify any containment parameters?`;
  }

  if (msg.includes('status') || msg.includes('verdict') || msg.includes('result')) {
    return `### 📊 Offense ${offense.id} Status
- **Title**: ${offense.title}
- **Verdict**: **${offense.expectedOutcome}**
- **Source**: \`${offense.sourceIp}\` ➔ **Target**: \`${offense.destinationIp}\`
- **Events**: ${offense.eventCount} events
- **Remediation**: ${offense.closeNote}`;
  }

  if (msg.includes('mitre') || msg.includes('attack') || msg.includes('threat')) {
    return `### 🎯 MITRE ATT&CK Analysis for Offense ${offense.id}
- **Tactic**: Initial Access & Discovery / Execution
- **Techniques**:
  - \`T1190\` — Exploit Public-Facing Application
  - \`T1059\` — Command and Scripting Interpreter
  - \`T1083\` — File and Directory Discovery
- **Severity**: Critical impact if uncontained. Active perimeter blocking in place.`;
  }

  if (msg.includes('action') || msg.includes('remediat') || msg.includes('contain') || msg.includes('mitigat')) {
    const isTP = offense.expectedOutcome === 'True Positive';
    return `### 🛡️ Recommended Actions for Offense ${offense.id}
${
  isTP
    ? `- **Network Isolation**: Block adversary IP \`${offense.sourceIp}\` at perimeter edge firewall.\n- **Endpoint Containment**: Reset credentials for affected service accounts on target \`${offense.destinationIp}\`.\n- **SIEM Ticket**: Escalated to Tier-2 SOC with high-priority containment tag.`
    : `- **Allowlist Verification**: Match against benign baseline pattern \`BENIGN-001\`.\n- **Resolution**: Auto-close offense with verdict **Non-Issue** (${offense.closeNote}).\n- **No Containment Needed**: False positive suppression logged.`
}`;
  }

  if (msg.includes('help') || msg.includes('what can you do')) {
    return `### 🤖 Supervisor Agent Capabilities
I coordinate the autonomous SOC agent pipeline powered by IBM watsonx Orchestrate. You can ask me to:
- **"Analyze Offense <ID>"** — Run full multi-agent triage and investigation.
- **"What is the status of <ID>?"** — Check verdict and remediation status.
- **"Explain the MITRE ATT&CK techniques"** — View tactical attack mapping.
- **"Show tool execution traces"** — Inspect Python tool calls made by the agents.`;
  }

  return `### 🛡️ Conversational Supervisor
Understood. For **Offense ${offense.id}** (${offense.title}), all agent telemetry is synchronized. The current verdict is **${offense.expectedOutcome}** with action status: \`${offense.closeNote}\`. Let me know if you would like to run another offense or inspect specific stage outputs!`;
}
