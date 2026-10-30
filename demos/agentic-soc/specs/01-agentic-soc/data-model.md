# Agentic SOC — Data Model

**Feature**: Automated QRadar Offense Response Pipeline

---

## 1. TypeScript Interfaces (`src/types/index.ts`)

### 1.1 `StageConfig`
Configuration for a single pipeline stage loaded from Express `/api/config` or `defaultStages.ts`.

```typescript
interface StageConfig {
  key: string;                                           // "triage" | "classification" | "rca" | "notification" | "action" | "close"
  label: string;                                         // Display name e.g. "Triage"
  agentId: string;                                       // WxO agent UUID
  instruction: string;                                   // One-line description shown in StageCard
  agentName?: string;                                    // WxO agent name (optional, from defaultStages.ts)
  tools?: string[];                                      // Tool names (optional, from defaultStages.ts)
  stepLabel?: string;                                    // Short label for PipelineFlow node
  color?: 'blue' | 'violet' | 'teal' | 'amber' | 'rose' | 'indigo';  // UI accent color
}
```

### 1.2 `TraceItem`
A single trace entry from a WxO agent run, used in AnalyticsVisualizer.

```typescript
interface TraceItem {
  type?: string;
  event_type?: string;
  name?: string;
  content?: any;
  timestamp?: string;
  [key: string]: any;    // WxO trace shape varies; indexed signature required
}
```

### 1.3 `AnalyticsData`
Aggregated performance metrics for a completed stage run.

```typescript
interface AnalyticsData {
  status: 'completed' | 'failed' | 'cancelled' | 'running' | 'idle' | string;
  durationMs: number | null;    // null if < 2 timestamps available
  toolCalls: number;            // count of tool/step trace items
  traceCount: number;           // total trace items
  startedAt: string;            // ISO 8601
  updatedAt?: string | null;    // ISO 8601 or null
}
```

### 1.4 `RunDetails`
Full result from a completed WxO agent run.

```typescript
interface RunDetails {
  threadId: string | null;
  runId: string;
  taskId?: string | null;
  messageId?: string | null;
  status: string;               // "completed" | "failed" | "cancelled"
  outputText: string;           // extracted from result.data.message.content[0].text
  analytics: AnalyticsData;
  traces: TraceItem[];
  raw?: any;                    // full WxO response (for debugging)
}
```

### 1.5 `StageState`
Per-stage UI state tracked in `runs: Record<string, StageState>`.

```typescript
interface StageState {
  prompt?: string;      // last prompt submitted for this stage
  loading?: boolean;    // true while polling
  run?: RunDetails;     // completed run details
  error?: string;       // error message if run failed
}
```

### 1.6 `ConfigResponse`
Response shape from `GET /api/config`.

```typescript
interface ConfigResponse {
  success: boolean;
  serviceConfigured: boolean;
  stages: StageConfig[];
  error?: string;
}
```

### 1.7 `SampleOffense`
Legacy offense type (used in older OffenseSelector variants).

```typescript
interface SampleOffense {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  sourceIp: string;
  destinationIp: string;
  category: string;
  eventCount: number;
  prompt: string;
}
```

### 1.8 `PocOffense`
Primary offense record type used in `sampleOffenses.ts` and `OffenseSelector`.

```typescript
interface PocOffense {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  module: string;              // "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "N1"
  sourceIp: string;
  destinationIp: string;
  category: string;
  eventCount: number;
  expectedOutcome: 'True Positive' | 'Non-Issue';
  closeNote: string;
  prompt: string;              // e.g. "Analyze QRadar Offense 167657"
}
```

### 1.9 `ActionItem`
A single proposed remediation action in the Action Approval Panel.

```typescript
// Exported from components/ActionApprovalPanel.tsx
interface ActionItem {
  id: string;
  name: string;           // e.g. "Block IP" | "Isolate Host"
  target: string;         // IP address or hostname
  reasoning: string;      // reasoning from RCA
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'pending' | 'approved' | 'rejected';
}
```

### 1.10 WxO Window Globals
Injected by `ConversationalSupervisorWidget.tsx` for the WxO embed script.

```typescript
interface Window {
  wxOConfiguration: {
    orchestrationID: string;
    hostURL: string;
    rootElementID: string;
    deploymentPlatform?: string;
    crn?: string;
    token?: string;
    chatOptions: {
      agentId: string;
      agentEnvironmentId?: string;
    };
  };
  wxoLoader: {
    init: (options?: Record<string, any>) => {
      on: (event: string, handler: (...args: any[]) => any) => void;
      [key: string]: any;
    };
  };
}
```

---

## 2. Python Pydantic Models (WxO Tools)

### 2.1 `offense_tools.py` — Offense Data Models

#### `OffenseOutput`
Returned by `soc_fetch_offense`.

```python
class OffenseOutput(BaseModel):
    found: bool
    offense_id: str
    description: str                  # offense rule name / title
    status: str                       # "OPEN" | "CLOSED"
    formattedOffenseType: str         # "Source IP" | "Destination IP" | "Device Name (custom)"
    offenseSource: str                # attacker IP or hostname
    severity: int                     # numeric 1–10
    magnitude: int
    relevance: int
    credibility: int
    event_count: int
    categoryCount: int
    formattedDuration: str            # human-readable duration string
    localizedCloseReason: str         # empty string if not closed
    closeUser: str
    startTime: str                    # ISO 8601
```

#### `EventsOutput`
Returned by `soc_fetch_offense_events` and `soc_fetch_rca_events`.

```python
class EventsOutput(BaseModel):
    found: bool
    offense_id: str
    event_count: int
    events: List[Dict[str, Any]]      # list of raw CSV row dicts
```

### 2.2 `enrichment_tools.py` — Enrichment Models

#### `RuleStatisticsOutput`
```python
class RuleStatisticsOutput(BaseModel):
    rule_name: str
    window_days: int
    total_occurrences: int
    true_positive_count: int
    false_positive_count: int
    rule_tp_rate: float               # 0.0–1.0
    rule_sample_size: int
```

#### `AssetOutput`
```python
class AssetOutput(BaseModel):
    ip: str
    found: bool
    hostname: str
    asset_criticality: str            # "crown_jewel" | "high" | "medium" | "low" | "unknown"
    is_internet_facing: bool
    os_family: str                    # "windows" | "linux" | "network" | "other" | "unknown"
    environment: str
    owner: str
    department: str
```

#### `ThreatIntelOutput`
```python
class ThreatIntelOutput(BaseModel):
    ip: str
    found: bool
    ti_verdict: str                   # "clean" | "suspicious" | "malicious" | "unknown"
    is_known_scanner: bool
    is_known_partner_cdn: bool
    reputation_score: int
    categories: List[str]
    first_seen: str
    last_seen: str
```

#### `OffenseHistoryOutput`
```python
class OffenseHistoryOutput(BaseModel):
    rule_name: str
    attacker: str
    target: str
    window_days: int
    historical_occurrences: int
    ever_true_positive: bool
    ever_false_positive: bool
    last_seen: str
```

### 2.3 `update_offense_status.py`

#### `UpdateSeverityOutput`
```python
class UpdateSeverityOutput(BaseModel):
    success: bool
    offense_id: str
    offense_title: str
    old_severity: str
    new_severity: str
    updated_at: str                   # ISO 8601
```

### 2.4 `close_offense_tool.py`

#### `CloseOffenseOutput`
```python
class CloseOffenseOutput(BaseModel):
    success: bool
    offense_id: str
    classification: str               # "True Positive" | "Non-Issue"
    close_reason: str                 # "True Positive" | "Non-Issue"
    close_note: str                   # "Verified and Notified" | "Normal Behavior" | "Administrator Behavior"
    closed_at: str                    # ISO 8601
    closed_by: str                    # "soc_close_agent"
```

### 2.5 `notify_tool.py`

#### `NotifyOutput`
```python
class NotifyOutput(BaseModel):
    success: bool
    status: str
    message: str
    timestamp: str                    # ISO 8601
    recipient: str
    subject: str
```

### 2.6 `action_tools.py`

#### `ActionApprovalOutput`
```python
class ActionApprovalOutput(BaseModel):
    request_id: str
    action_type: str
    target: str
    status: str                       # "pending_approval"
    requested_at: str                 # ISO 8601
    justification: str
```

#### `ActionExecutionOutput`
```python
class ActionExecutionOutput(BaseModel):
    request_id: str
    action_type: str
    target: str
    approved: bool
    executed: bool
    executed_at: str                  # ISO 8601
    result: str
```

---

## 3. Agent Output Text Formats

These are plain-text blocks (not JSON) output by each agent. They are parsed by downstream agents and the frontend.

> **Source of truth.** The block layouts below are copied from the deployed agent definitions
> (`agents/{triage,classification,rca,action,notify,close}_agent.yaml`, the "OUTPUT … BLOCK" step of each).
> A generated application MUST parse these exact labels. Do not invent additional keys
> (for example there is **no** `mitre_technique_id`, `evidence_network`, `evidence_payload`, `attacker_ip_list`
> or `root_cause` snake_case key in the RCA block, and there is no `auto_closed` key in the Classification block).

### 3.1 TRIAGE RESULT Block
```
TRIAGE RESULT
offense_id: <id>
offense_status: <OPEN | ALREADY_CLOSED | NOT_FOUND | OUT_OF_SCOPE>
offense_type: <Source IP | Destination IP | Device Name (custom)>
description: <offense description>
triage_severity: <Critical|High|Medium|Low|Informational|ALREADY_CLOSED|NOT_FOUND|OUT_OF_SCOPE>
old_severity_numeric: <numeric severity>
magnitude: <magnitude>
relevance: <relevance>
credibility: <credibility>
attacker: <attacker IP or hostname>
attacker_is_hostname: <true|false>
target: <target IP>
event_count: <event count>
start_time: <start time>          # NOT guaranteed ISO 8601 — see §3.8
duration: <formatted duration>
asset_criticality: <crown_jewel|high|medium|low|unknown>
os_family: <windows|linux|network|other|unknown>
is_internet_facing: <true|false|unknown>
ti_verdict: <clean|suspicious|malicious|unknown>
no_block_recommended: <true|false>
rule_tp_rate: <0.00-1.00 | unknown>
rule_sample_size: <n | unknown>
historical_occurrences_90d: <n | unknown>
must_inspect_events: <true|false>
rules_fired: <comma-separated rule codes e.g. T1, T4, TI>
triage_reasoning: <1-2 sentences in Vietnamese: which rules fired and why>
END TRIAGE RESULT
```
`triage_reasoning` is written in Vietnamese by the agent. The report MUST NOT quote it as English prose.

### 3.2 CLASSIFICATION RESULT Block
```
CLASSIFICATION RESULT
offense_id: <id>
offense_type: <from TRIAGE RESULT>
triage_severity: <from TRIAGE RESULT>
classification: <True Positive | False Positive | Benign Positive | Needs-RCA>
confidence: <High | Medium | Low>
severity_override: <Critical | none>
modules_run: <e.g. M1, M2>
stages_fired: <e.g. C0, M1-TP, M1-SEV>
events_total: <n>
events_analyzed: <n>
coverage: <0.00-1.00>
real_source_ip: <IP | same as srcIp>
source_ip_corrected: <true|false>
compromised_account: <username | none>
allowlist_entry: <entry_id | none>
historical_occurrences_90d: <n | unknown>
rule_tp_rate: <0.00-1.00 | unknown>
enrichment_status: <ok | ti_failed | asset_failed | history_failed | baseline_failed>
category: <QRadar event category names observed across analyzed events, comma-separated>
key_evidence: <2-3 sentences quoting field values verbatim: IPs, process names, paths, URIs, alert_status, sysmon event IDs, service filenames>
rca:
  - <relevant process path, command line, or URI extracted verbatim from the events>
  - <parent process path or source/target relationship if applicable>
  - <additional context: payload content, real source IP note, username, scheduled task, file path, or network destination>
  - <behavioral conclusion: "Normal behavior" | "Administrator behavior" | "Abnormal behavior">
recommended_actions: <specific action>
auto_close_eligible: <true|false>
close_reason: <True Positive | Non-Issue | none>
close_note: <Verified and Notified | Normal Behavior | Administrator Behavior | none>
END CLASSIFICATION RESULT
```
`close_reason` / `close_note` are `none` only when `classification` is `Needs-RCA`.
The `rca:` key is a multi-line list (4 bullets); the first three hold quoted evidence, the fourth is the behavioral conclusion.

### 3.3 RCA REPORT Block
The RCA block uses **title-case labels with ` : ` separators** and `═══` delimiters (not snake_case keys):
```
═══ RCA REPORT ═══
Offense ID        : <id>
Description       : <offense description from fetch_offense>
Determination     : <CONFIRMED COMPROMISE | ATTACK ATTEMPT — ACTIVE | ATTACK ATTEMPT — FAILED | BENIGN — NORMAL BEHAVIOR | SUSPICIOUS — UNCONFIRMED>
Classification    : <True Positive | Benign Positive>
MITRE ATT&CK      : <Tactic: Technique — T-number | N/A>
Attacker          : <attacker_ip or N/A>
Attacker IP List  : <all distinct source IPs; N/A if single or absent>
Target            : <target_ip or N/A>
Username          : <username from events; N/A if absent>
Event Timestamp   : <event_timestamp of key event; N/A if absent>
Categories        : <comma-separated categoryDescription values from events>

Evidence Summary  :
  Network  : <1 sentence — external/internal, src→dest, port/protocol if known>
  Payload  : <1-2 sentences — uri, payload_sample, alert_status quoted verbatim>
  Process  : <1-2 sentences — process_name, process_id, parent_process, command_line quoted verbatim>
  Scope    : <1 sentence — hosts involved, duration, pattern type>

Attack Timeline   :                      (True Positive only — omitted for Benign Positive)
  <HH:MM> — <categoryDescription> — <key payload, command, or process name>     (up to 3 entries)

Root Cause        : <2-3 sentences quoting actual field values>

Recommended Actions:
  - <one line per action>                (Benign Positive: "- None — close as non-issue")

═══ END RCA REPORT ═══
```
Notes (all taken from the RCA agent's rules):
- `MITRE ATT&CK` is required for True Positive and `N/A` for Benign Positive. Its value is a single string `Tactic: Technique — T-number`.
- `Attack Timeline` entries use `HH:MM` only; dates are not present in timeline entries.
- `Attacker IP List` is `N/A` when there is a single attacker IP.

### 3.4 ACTION REPORT Block
```
ACTION REPORT
offense_id: <id>
actions_requested: <count>
actions_executed: <count>
action_details:
  - action_id: <id>
    action_type: <type>
    target: <target entity>
    execution_status: <SUCCESS | SKIPPED>
summary: <1 sentence — what was done or why nothing was done>
END ACTION REPORT
```

### 3.5 NOTIFICATION REPORT Block
```
NOTIFICATION REPORT
status: SUCCESS
offense_id: <id>
notification: HTML incident report generated and queued for delivery
timestamp: <timestamp from tool response>
END NOTIFICATION REPORT
```
Failure variant: `status: FAILED`, `offense_id`, `reason: <brief failure reason>`.

### 3.6 CLOSURE REPORT Block
```
CLOSURE REPORT
offense_id: <id>
classification: <True Positive | False Positive | Benign Positive | Undetermined>
status: Closed
workflow_path: <e.g. "Triage → Classification → RCA → Action → Close">
closed_at: <timestamp from close_offense tool>
closing_reason: <1-2 sentences>
END CLOSURE REPORT
```

### 3.7 Live Report Field Mapping (normative)

In **Live mode** every field of the generated Incident Report (HTML and Markdown) MUST come from the parsed
`runs.<stage>.run.outputText` blocks above. Static offense data (`PocOffense` / `sampleOffenses`) and mock data
MUST NOT be used in Live mode. Each field has an ordered list of sources; the first non-absent value wins.

| Report field | Source 1 | Source 2 (fallback) | Source 3 (fallback) | If all absent |
|---|---|---|---|---|
| Offense ID | RCA `Offense ID` | Classification `offense_id` | Triage `offense_id` / selected offense id | never absent |
| Description | RCA `Description` | Triage `description` | — | omit row |
| Determination | RCA `Determination` | — | — | omit row |
| Classification | RCA `Classification` | Classification `classification` | Close `classification` | omit row |
| Confidence | Classification `confidence` | — | — | omit row |
| Severity | Triage `triage_severity` (with Classification `severity_override` if not `none`) | — | — | omit row |
| MITRE tactic / technique / ID | RCA `MITRE ATT&CK` split on first `:` (tactic) and last ` — ` (technique / T-number) | — | — | omit MITRE section |
| Attacker | RCA `Attacker` | Classification `real_source_ip` (when not `same as srcIp`) | Triage `attacker` | omit row |
| All attacker IPs | RCA `Attacker IP List` | — | — | omit row (single attacker is shown in Attacker) |
| Target | RCA `Target` | Triage `target` | — | omit row |
| Username / account | RCA `Username` | Classification `compromised_account` (when not `none`) | — | omit row |
| Event timestamp | RCA `Event Timestamp` | Triage `start_time` | — | omit row |
| Event count | Classification `events_total` | Triage `event_count` | — | omit row |
| Event categories | RCA `Categories` | Classification `category` | — | omit row |
| Evidence — Network / Payload / Process / Scope | RCA `Evidence Summary` sub-lines `Network` / `Payload` / `Process` / `Scope` | Classification `key_evidence` and `rca:` bullets (shown as "Evidence") | — | omit that sub-row |
| Attack timeline | RCA `Attack Timeline` entries | — | — | omit section (always omitted for Benign Positive) |
| Root cause | RCA `Root Cause` | Classification `rca:` bullets 1-3 | — | omit section |
| Recommended actions | RCA `Recommended Actions` list | Classification `recommended_actions` | — | omit section |
| Actions taken | ACTION REPORT `actions_executed`, `action_details`, `summary` | — | — | omit section |
| Notification | NOTIFICATION REPORT `status`, `timestamp` | — | — | omit row |
| Closure | CLOSURE REPORT `closed_at`, `closing_reason`, `workflow_path`; Classification `close_reason`, `close_note` | — | — | omit row |
| Asset criticality / internet-facing / OS / TI verdict | Triage `asset_criticality`, `is_internet_facing`, `os_family`, `ti_verdict` | — | — | omit row (see §3.9) |

### 3.8 Parsing and Absent-Value Rules (normative)

1. **Locate blocks** by their start/end markers (`═══ RCA REPORT ═══` … `═══ END RCA REPORT ═══`, `TRIAGE RESULT` … `END TRIAGE RESULT`, etc.). Ignore any text outside a block (agents may emit reasoning before it).
2. **Parse by label**, not by line position: match `^\s*<Label>\s*:\s*(.*)$` case-insensitively and tolerate variable spacing before the colon (RCA labels are space-padded). A value continues on subsequent lines that are more indented than the label (Evidence Summary sub-lines, Attack Timeline entries, Recommended Actions bullets, Classification `rca:` bullets, Action `action_details`).
3. **Absent values.** A value is *absent* when it is empty or, case-insensitively, one of `N/A`, `NA`, `unknown`, `none`, `null`, `-`. Absent values MUST NOT be rendered as the literal text "N/A" / "Unknown" / "—"; the field is omitted per §3.7 (never replaced with an invented value).
4. **No static fallback in Live mode.** If no source in §3.7 has a value, the field is omitted. Values from `PocOffense`, `sampleOffenses`, `mockPipelineData` and placeholder IPs such as `10.x.x.x` / `203.0.x.x` MUST NOT appear in a Live report.
5. **Dates and times.** Offense start times are not guaranteed ISO 8601. Observed forms: `HH:MM:SS, D thg M, YYYY` (Vietnamese month marker "thg") in CSV `startDateTime`, and `Fri Jul 24 14:04:07 ICT 2026` in `startTime`. Show timestamps as returned by the agent; do not reformat to a locale the parser cannot confirm.
6. **Missing stage.** If a stage has not run or failed, only the fields that depend on it are omitted; the report is still generated from the stages that did produce output. The report requires at least the RCA block **or** the Classification block; otherwise the Report button stays disabled with the tooltip "No analysis output available yet".
7. **Language.** Do not paste Vietnamese `triage_reasoning` into the English report; omit it.
8. **Provenance.** Each section of the report may show a muted "Source: RCA | Classification | Triage" caption so reviewers can trace the value.

### 3.9 Known Source-Data Characteristics (affect report completeness)

These come from the real tool and data behaviour and explain genuine gaps; the report must show only what the sources provide.
- **Enrichment lookups.** `soc_lookup_asset` and `soc_lookup_threat_intel` return `unknown` unless `asset_registry.yaml` / `threat_intel_feed.yaml` are present in COS (uploaded only when `UPLOAD_YAML_TO_COS=true`). When they return `unknown` the corresponding Triage fields are `unknown` and the rows are omitted per §3.8.
- **Event sampling.** `soc_fetch_offense_events` returns at most 20 events by default; the RCA agent calls it with `max_events=25`. For offenses with large event files (for example 34,082 rows for the 173500 RCA-relevant file) key evidence can lie outside the sample, so RCA values reflect only the sampled events plus aggregate fields. Reports must not claim completeness beyond `events_analyzed` / `events_total`.
- **Multi-valued fields.** Some offenses involve several distinct values (e.g. multiple attacker IPs, multiple targeted usernames, multiple services). The report MUST list every value present in the parsed block (comma-separated for IPs, one bullet each for actions/evidence); it MUST NOT collapse to the first value.
- **Proxy and redacted payloads.** For offenses fronted by a proxy, the offense-level `attacker` may be the proxy or a masked id while the real client is in the payload (`src=`) or in `X-Forwarded-For`; Classification `real_source_ip` / `source_ip_corrected` carry that correction, and it takes precedence over the offense-level attacker when `source_ip_corrected` is `true`. Some events carry `payloadAsUTF = [REDACTED_DUPLICATE_PAYLOAD]` or a `false` `rawEvent`; evidence for those events is limited to the other populated fields.
- **Offense-level `categories`.** The `categories` value from `soc_fetch_offense` is derived from the offense `eventDescription` text ("N events and 0 flows in M categories") and is NOT a list of category names. Category names MUST come from events' `categoryDescription` (RCA `Categories`, Classification `category`).
- **Offense-level `username`.** Empty in the offense CSV; username appears only in event data and is surfaced in RCA `Username` / Classification `compromised_account`.

---

## 4. IBM COS Data Schemas

### 4.1 Offense CSV (`Offense_{id}.csv`)
Key columns: `id`, `description`, `status`, `offense_type`, `offense_source`,
`severity`, `magnitude`, `relevance`, `credibility`, `event_count`, `category_count`,
`duration`, `close_reason`, `close_user`, `start_time`

### 4.2 Events CSV (`Offense_{id}_Events.csv`)
Key columns: `event_id`, `start_time`, `log_source`, `event_name`, `source_ip`,
`destination_ip`, `username`, `payload`, `category`, `magnitude`

### 4.3 Config YAMLs
- `allowlist.yaml` — entries with `id`, `pattern`, `verdict`, `reason`
- `asset_registry.yaml` — entries with `ip`, `hostname`, `criticality`, `internet_facing`, `os_family`
- `threat_intel_feed.yaml` — entries with `ip`, `verdict`, `categories`, `first_seen`, `last_seen`
- `maintenance_windows.yaml` — entries with `start`, `end`, `description`, `affected_hosts`
- `service_path_policy.yaml` — entries with `source_process`, `target_path`, `verdict`
- `exfil_tools.yaml` — tool name → `{ verdict, description }` mapping
- `privileged_accounts.yaml` — entries with `username`, `role`, `authorized_hosts`
- `linux_log_rotation.yaml` — entries with `pattern`, `verdict`
- `proxy_and_lb.yaml` — entries with `ip`, `type` (`proxy` | `load_balancer`)
