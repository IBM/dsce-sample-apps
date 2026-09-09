// ── Demo Chat Scenarios ───────────────────────────────────────────────────────
// Maps user query keywords to a scripted bot response and an optional action
// to create. When demo mode is on, AgentChat checks the user's message against
// these scenarios before calling the real backend.
//
// Each scenario:
//   keywords   — array of lowercase strings; ALL must match (AND logic) for the
//                scenario to fire. Use single-word fragments for flexibility.
//   response   — the synthesised answer the bot returns (markdown supported)
//   action     — if present, a "Create action" button is shown in the bot message.
//                Clicking it calls addAction(action) and shows a confirmation card.
//   sources    — which source tags to show in the "Searched:" footer
//   maximo     — optional Maximo live data table rows to display

// ── Helpers ───────────────────────────────────────────────────────────────────

function _now() {
  return new Date().toLocaleString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function _nowLabel() {
  return `Today, ${_now()}`;
}

// ── Scenario definitions ──────────────────────────────────────────────────────

export const DEMO_SCENARIOS = [

  // ── Scenario 1: Asset failure / recurring failures ─────────────────────────
  {
    id: 'scenario-failure',
    keywords: ['failure', 'recurring'],
    response: `## Asset Failure Analysis — Rotating Equipment

I've analysed work order history and failure records across your Maximo asset register for the last 12 months.

### Key findings

| Asset | Description | Failures | Downtime | Criticality |
|---|---|---|---|---|
| PUMP-2547 | Booster Pump 2547 | 12 | 256 hrs | Critical |
| COMP-1103 | Compressor 1103 | 8 | 198 hrs | Critical |
| PUMP-0392 | Process Pump 0392 | 7 | 142 hrs | High |
| TANK-0051 | Storage Tank 0051 | 5 | 110 hrs | High |
| MOT-8821 | Motor 8821 | 4 | 68 hrs | Medium |

**Total:** 78 failures · 1,240 hrs downtime across 15 assets

### Top failure modes
- **Seal leakage** (12 occurrences, 4 assets) — Increasing trend
- **Bearing overheating** (8 occurrences, 3 assets) — Stable
- **High vibration** (7 occurrences, 3 assets) — Increasing trend

### OEM recommendation
OEM manual for PUMP-2547 (Section 5.4) specifies lubrication every **3 months**. Current Maximo job plan JP-PUMP-2547 schedules lubrication every **6 months** — a gap that correlates with the observed seal and bearing failures.`,
    sources: { maximoLive: true, documents: true, webKnowledge: false },
    action: {
      id: 'demo-chat-inv-001',
      actionNumber: 'INV-005',
      demoOnly: true,
      title: 'Critical Asset Failure Investigation',
      description: 'Identified 15 rotating assets with recurring failures. PUMP-2547 and COMP-1103 are highest priority. Seal leakage and bearing overheating are the dominant failure modes.',
      type: 'Investigation',
      status: 'Open',
      priority: 'High',
      assets: 15,
      created: _nowLabel(),
      source: 'Chat',
      parentActionId: null,
      relatedActions: [],
      metrics: { totalAssets: 15, totalFailures: 78, totalDowntime: '1,240 hrs', highPriorityAssets: 5 },
      priorityAssets: [
        { asset: 'PUMP-2547', description: 'Booster Pump 2547',  criticality: 'Critical', failures: 12, downtime: '256 hrs', priority: 'High',   reason: 'High failure rate & unplanned downtime' },
        { asset: 'COMP-1103', description: 'Compressor 1103',    criticality: 'Critical', failures: 8,  downtime: '198 hrs', priority: 'High',   reason: 'Recurring seal failures' },
        { asset: 'PUMP-0392', description: 'Process Pump 0392',  criticality: 'High',     failures: 7,  downtime: '142 hrs', priority: 'Medium', reason: 'High maintenance recurrence' },
        { asset: 'TANK-0051', description: 'Storage Tank 0051',  criticality: 'High',     failures: 5,  downtime: '110 hrs', priority: 'Medium', reason: 'Repeated alarms and leaks' },
        { asset: 'MOT-8821',  description: 'Motor 8821',         criticality: 'Medium',   failures: 4,  downtime: '68 hrs',  priority: 'Low',    reason: 'Bearing overheating trend' },
      ],
      allAssets: [
        { asset: 'PUMP-2547', description: 'Booster Pump 2547',    location: 'Unit 3', criticality: 'Critical', failures: 12, downtime: '256 hrs', lastFailure: 'Apr 28, 2025', currentPM: 'PM-PUMP-2547', priority: 'High' },
        { asset: 'COMP-1103', description: 'Compressor 1103',      location: 'Unit 1', criticality: 'Critical', failures: 8,  downtime: '198 hrs', lastFailure: 'May 2, 2025',  currentPM: 'PM-COMP-1103', priority: 'High' },
        { asset: 'PUMP-0392', description: 'Process Pump 0392',    location: 'Unit 2', criticality: 'High',     failures: 7,  downtime: '142 hrs', lastFailure: 'May 5, 2025',  currentPM: 'PM-PUMP-0392', priority: 'Medium' },
        { asset: 'TANK-0051', description: 'Storage Tank 0051',    location: 'Unit 4', criticality: 'High',     failures: 5,  downtime: '110 hrs', lastFailure: 'Apr 30, 2025', currentPM: 'PM-TANK-0051', priority: 'Medium' },
        { asset: 'MOT-8821',  description: 'Motor 8821',           location: 'Unit 1', criticality: 'Medium',   failures: 4,  downtime: '68 hrs',  lastFailure: 'Apr 25, 2025', currentPM: 'PM-MOT-8821',  priority: 'Low' },
        { asset: 'PUMP-1144', description: 'Booster Pump 1144',    location: 'Unit 2', criticality: 'High',     failures: 3,  downtime: '54 hrs',  lastFailure: 'Apr 18, 2025', currentPM: 'PM-PUMP-1144', priority: 'Medium' },
        { asset: 'COMP-0881', description: 'Compressor 0881',      location: 'Unit 3', criticality: 'High',     failures: 3,  downtime: '48 hrs',  lastFailure: 'Apr 14, 2025', currentPM: 'PM-COMP-0881', priority: 'Medium' },
        { asset: 'PUMP-0775', description: 'Process Pump 0775',    location: 'Unit 4', criticality: 'Medium',   failures: 3,  downtime: '42 hrs',  lastFailure: 'Apr 10, 2025', currentPM: 'PM-PUMP-0775', priority: 'Low' },
        { asset: 'TANK-0113', description: 'Storage Tank 0113',    location: 'Unit 1', criticality: 'Medium',   failures: 2,  downtime: '36 hrs',  lastFailure: 'Mar 29, 2025', currentPM: 'PM-TANK-0113', priority: 'Low' },
        { asset: 'MOT-4402',  description: 'Motor 4402',           location: 'Unit 2', criticality: 'Medium',   failures: 2,  downtime: '28 hrs',  lastFailure: 'Mar 25, 2025', currentPM: 'PM-MOT-4402',  priority: 'Low' },
        { asset: 'PUMP-2201', description: 'Injection Pump 2201',  location: 'Unit 3', criticality: 'High',     failures: 2,  downtime: '24 hrs',  lastFailure: 'Mar 20, 2025', currentPM: 'PM-PUMP-2201', priority: 'Low' },
        { asset: 'COMP-0334', description: 'Compressor 0334',      location: 'Unit 4', criticality: 'Medium',   failures: 2,  downtime: '20 hrs',  lastFailure: 'Mar 15, 2025', currentPM: 'PM-COMP-0334', priority: 'Low' },
        { asset: 'PUMP-0610', description: 'Transfer Pump 0610',   location: 'Unit 1', criticality: 'Low',      failures: 1,  downtime: '12 hrs',  lastFailure: 'Mar 8, 2025',  currentPM: 'PM-PUMP-0610', priority: 'Low' },
        { asset: 'TANK-0228', description: 'Buffer Tank 0228',     location: 'Unit 2', criticality: 'Low',      failures: 1,  downtime: '8 hrs',   lastFailure: 'Feb 28, 2025', currentPM: 'PM-TANK-0228', priority: 'Low' },
        { asset: 'MOT-0991',  description: 'Drive Motor 0991',     location: 'Unit 3', criticality: 'Low',      failures: 1,  downtime: '6 hrs',   lastFailure: 'Feb 20, 2025', currentPM: 'PM-MOT-0991',  priority: 'Low' },
      ],
      failurePatterns: [
        { mode: 'Seal leakage',        occurrences: 12, affectedAssets: 4, severity: 'High',   lastOccurrence: 'May 2, 2025',  trend: 'Increasing' },
        { mode: 'Bearing overheating', occurrences: 8,  affectedAssets: 3, severity: 'High',   lastOccurrence: 'Apr 28, 2025', trend: 'Stable' },
        { mode: 'High vibration',      occurrences: 7,  affectedAssets: 3, severity: 'Medium', lastOccurrence: 'May 5, 2025',  trend: 'Increasing' },
        { mode: 'Lubrication issue',   occurrences: 5,  affectedAssets: 4, severity: 'Medium', lastOccurrence: 'Apr 30, 2025', trend: 'Stable' },
        { mode: 'Valve failure',       occurrences: 3,  affectedAssets: 2, severity: 'Low',    lastOccurrence: 'Apr 15, 2025', trend: 'Decreasing' },
      ],
      workOrders: [
        { wo: 'WO-10421', asset: 'PUMP-2547', description: 'Seal replacement',          type: 'Corrective', status: 'Closed',      reported: 'Apr 20, 2025', completed: 'Apr 22, 2025', downtime: '48 hrs' },
        { wo: 'WO-10398', asset: 'COMP-1103', description: 'Bearing inspection',        type: 'Corrective', status: 'Closed',      reported: 'Apr 10, 2025', completed: 'Apr 12, 2025', downtime: '36 hrs' },
        { wo: 'WO-10502', asset: 'PUMP-0392', description: 'Vibration check',           type: 'Corrective', status: 'In Progress', reported: 'May 5, 2025',  completed: '—',            downtime: '18 hrs' },
        { wo: 'WO-10315', asset: 'TANK-0051', description: 'Leak investigation',        type: 'Corrective', status: 'Closed',      reported: 'Mar 28, 2025', completed: 'Apr 1, 2025',  downtime: '72 hrs' },
        { wo: 'WO-10488', asset: 'MOT-8821',  description: 'Bearing temperature check', type: 'Preventive', status: 'Scheduled',   reported: 'May 3, 2025',  completed: '—',            downtime: '0 hrs' },
      ],
      recommendations: [
        { recommendation: 'Align lubrication interval with OEM recommendation for PUMP-2547', assets: 2, priority: 'High',   expectedBenefit: 'Reduce failures by 30%',  evidence: 'OEM Manual Section 5.4', status: 'Proposed' },
        { recommendation: 'Increase bearing inspection frequency for COMP-1103',              assets: 2, priority: 'High',   expectedBenefit: 'Earlier detection',        evidence: 'Failure pattern analysis',  status: 'Proposed' },
        { recommendation: 'Add seal condition check to PM tasks',                              assets: 1, priority: 'High',   expectedBenefit: 'Early seal wear detection', evidence: 'WO-10421 history',          status: 'Proposed' },
      ],
    },
  },

  // ── Scenario 2: Job plan / OEM gap ─────────────────────────────────────────
  {
    id: 'scenario-jobplan',
    keywords: ['job plan', 'oem'],
    response: `## Job Plan vs OEM Gap Analysis — PUMP-2547

I compared the current Maximo job plan **JP-PUMP-2547** against the OEM maintenance manual (Pump Series X, 2024 edition).

### Gaps identified

| Gap | Current practice | OEM recommendation | Severity |
|---|---|---|---|
| Lubrication interval | Every 6 months | Every 3 months | **High** |
| Seal inspection | Annual | Every 6 months | **High** |
| Vibration check | Not in job plan | Quarterly | **Medium** |

### Evidence
- OEM Manual Section 5.4 (pg 42): *"Lubricate pump bearings every 3 months using ISO VG 46 grease."*
- OEM Manual Section 6.2 (pg 58): *"Inspect mechanical seal condition every 6 months. Replace if wear exceeds 20%."*

### Impact
Closing these gaps is estimated to reduce PUMP-2547 unplanned downtime by **~180 hrs/year** and avoid approximately **$55K** in emergency repair costs.`,
    sources: { maximoLive: true, documents: true, webKnowledge: false },
    action: {
      id: 'demo-chat-ana-001',
      actionNumber: 'ANA-005',
      demoOnly: true,
      title: 'Job Plan vs OEM Gap Analysis — PUMP-2547',
      description: 'Lubrication interval in JP-PUMP-2547 is 2× longer than OEM recommendation. Seal inspection also misaligned. Estimated 180 hrs/year downtime reduction if gaps are closed.',
      type: 'Analysis',
      status: 'Open',
      priority: 'High',
      assets: 1,
      created: _nowLabel(),
      source: 'Chat',
      parentActionId: null,
      relatedActions: [],
      metrics: { assetsEvaluated: 1, requireReview: 1, gapsIdentified: 3, aligned: 0 },
      gapSummaryByCategory: [
        { category: 'Maintenance Interval', count: 1, pct: '33%' },
        { category: 'Inspection Frequency', count: 1, pct: '33%' },
        { category: 'Maintenance Tasks',    count: 1, pct: '33%' },
      ],
      gapSeverity: [
        { severity: 'High',    count: 2 },
        { severity: 'Medium',  count: 1 },
        { severity: 'Low',     count: 0 },
        { severity: 'Aligned', count: 0 },
      ],
      assetsWithGaps: [
        { asset: 'PUMP-2547', description: 'Booster Pump 2547', criticality: 'Critical', gapCount: 3, highestGap: 'Maintenance Interval', status: 'Gap Identified', priority: 'High' },
      ],
      currentJobPlans: [
        { asset: 'PUMP-2547', jobPlan: 'JP-PUMP-2547', task: 'Lubrication check',  frequency: 'Every 6 months', procedure: 'Apply grease per spec',   lastUpdated: 'Jan 2024' },
        { asset: 'PUMP-2547', jobPlan: 'JP-PUMP-2547', task: 'Seal inspection',    frequency: 'Annual',         procedure: 'Visual inspection only',  lastUpdated: 'Jan 2024' },
      ],
      oemRecommendations: [
        { asset: 'PUMP-2547', document: 'Pump Series X OEM Manual', section: '5.4 Lubrication', recommendation: 'Lubricate every 3 months',    frequency: 'Every 3 months', docDate: '2024', evidence: 'Section 5.4, pg 42' },
        { asset: 'PUMP-2547', document: 'Pump Series X OEM Manual', section: '6.2 Seals',       recommendation: 'Inspect seals every 6 months', frequency: 'Every 6 months', docDate: '2024', evidence: 'Section 6.2, pg 58' },
      ],
      gaps: [
        { asset: 'PUMP-2547', currentPractice: 'Lubricate every 6 months', oemRecommendation: 'Lubricate every 3 months',          identifiedGap: 'Interval 2× longer than OEM',    status: 'Gap Identified', priority: 'High',   evidence: 'OEM Manual 5.4' },
        { asset: 'PUMP-2547', currentPractice: 'Inspect seals annually',   oemRecommendation: 'Inspect seals every 6 months',      identifiedGap: 'Inspection frequency too low',   status: 'Gap Identified', priority: 'High',   evidence: 'OEM Manual 6.2' },
        { asset: 'PUMP-2547', currentPractice: 'No vibration check in PM', oemRecommendation: 'Measure vibration quarterly',        identifiedGap: 'Missing vibration monitoring',   status: 'Gap Identified', priority: 'Medium', evidence: 'OEM Manual 4.3' },
      ],
      evidence: [
        { asset: 'PUMP-2547', maximo: 'JP-PUMP-2547 — 6-month lubrication', oem: 'OEM Section 5.4 — 3-month interval', analysis: 'Gap: interval is 2× longer than OEM guidance', recommendation: 'Update lubrication task frequency in JP-PUMP-2547' },
      ],
    },
  },

  // ── Scenario 3: Generate / create report ───────────────────────────────────
  {
    id: 'scenario-report',
    keywords: ['report', 'maintenance'],
    response: `## Maintenance Gap Report — Rotating Equipment

I've compiled a maintenance gap report based on your Maximo job plans and OEM documentation.

### Executive summary
- **15 assets** evaluated across Units 1–4
- **7 assets** have confirmed maintenance gaps
- **4 assets** require immediate engineering review
- Estimated downtime reduction if gaps are closed: **620 hrs/year**
- Estimated cost avoidance: **$190K/year**

### Top gap categories

| Category | Gaps | Severity |
|---|---|---|
| Maintenance Interval | 4 | High |
| Inspection Frequency | 3 | High |
| Maintenance Tasks | 2 | Medium |
| Lubrication | 1 | Medium |

### Priority assets requiring action
1. **PUMP-2547** — Lubrication interval gap (OEM: 3m vs current: 6m)
2. **COMP-1103** — Bearing inspection gap (OEM: monthly vs current: quarterly)
3. **PUMP-0392** — Missing seal condition check in PM
4. **TANK-0051** — Inspection frequency below OEM guidance`,
    sources: { maximoLive: true, documents: true, webKnowledge: true },
    action: {
      id: 'demo-chat-rep-001',
      actionNumber: 'RP-004',
      demoOnly: true,
      title: 'Maintenance Gap Report — Rotating Equipment Q2 2025',
      description: '15 assets evaluated; 7 with gaps; 4 requiring immediate review. Estimated 620 hrs downtime reduction and $190K cost avoidance if gaps are closed.',
      type: 'Report',
      status: 'Draft',
      priority: 'Medium',
      assets: 7,
      created: _nowLabel(),
      source: 'Chat',
      parentActionId: null,
      relatedActions: [],
      summary: { assetsEvaluated: 15, assetsWithGaps: 7, assetsRequireReview: 4, alignedAssets: 8, totalGaps: 10, highSeverityGaps: 4, mediumSeverityGaps: 3, lowSeverityGaps: 3 },
      topGapCategories: [
        { category: 'Maintenance Interval', count: 4 },
        { category: 'Inspection Frequency', count: 3 },
        { category: 'Maintenance Tasks',    count: 2 },
        { category: 'Lubrication',          count: 1 },
      ],
      potentialImpact: { estimatedDowntimeReduction: '620 hrs', estimatedCostAvoidance: '$190K', reliabilityImprovement: 'High' },
      highSeverityGaps: [
        { asset: 'PUMP-2547', category: 'Maintenance Interval',  currentPractice: 'Lubricate every 6 months',      oemRecommendation: 'Lubricate every 3 months',      potentialImpact: 'Bearing wear risk',   priority: 'High' },
        { asset: 'COMP-1103', category: 'Inspection Frequency',  currentPractice: 'Inspect bearing every 3 months', oemRecommendation: 'Inspect monthly',               potentialImpact: 'Undetected failures', priority: 'High' },
        { asset: 'PUMP-0392', category: 'Maintenance Tasks',     currentPractice: 'No seal condition check',        oemRecommendation: 'Check seal condition monthly',  potentialImpact: 'Seal failure risk',   priority: 'High' },
        { asset: 'TANK-0051', category: 'Inspection Frequency',  currentPractice: 'Inspect quarterly',              oemRecommendation: 'Inspect monthly',               potentialImpact: 'Leak risk',           priority: 'High' },
      ],
      assetGaps: [
        { asset: 'PUMP-2547', description: 'Booster Pump 2547', gapCategory: 'Maintenance Interval', gap: 'Lubrication every 6m vs 3m OEM',  severity: 'High',   status: 'Gap Identified' },
        { asset: 'COMP-1103', description: 'Compressor 1103',   gapCategory: 'Inspection Frequency', gap: 'Quarterly vs monthly OEM',        severity: 'High',   status: 'Review Required' },
        { asset: 'PUMP-0392', description: 'Process Pump 0392', gapCategory: 'Maintenance Tasks',    gap: 'No seal condition check in PM',   severity: 'High',   status: 'Review Required' },
        { asset: 'TANK-0051', description: 'Storage Tank 0051', gapCategory: 'Inspection Frequency', gap: 'Quarterly vs monthly OEM',        severity: 'Medium', status: 'Review Required' },
      ],
      maintenanceGaps: [
        { category: 'Maintenance Interval', count: 4, severity: 'High',   assets: ['PUMP-2547', 'PUMP-0392', 'TANK-0051', 'MOT-8821'] },
        { category: 'Inspection Frequency', count: 3, severity: 'High',   assets: ['COMP-1103', 'TANK-0051', 'MOT-8821'] },
        { category: 'Maintenance Tasks',    count: 2, severity: 'Medium', assets: ['PUMP-0392', 'COMP-1103'] },
        { category: 'Lubrication',          count: 1, severity: 'Medium', assets: ['PUMP-2547'] },
      ],
      recommendedActions: [
        { action: 'Review job plan JP-PUMP-2547',                    asset: 'PUMP-2547', priority: 'High',   relatedActionId: null },
        { action: 'Increase bearing inspection for COMP-1103',       asset: 'COMP-1103', priority: 'High',   relatedActionId: null },
        { action: 'Add seal condition inspection for PUMP-0392',     asset: 'PUMP-0392', priority: 'High',   relatedActionId: null },
        { action: 'Update inspection schedule for TANK-0051',        asset: 'TANK-0051', priority: 'Medium', relatedActionId: null },
      ],
    },
  },

  // ── Scenario 4: Recommendations / what should I do ─────────────────────────
  {
    id: 'scenario-recommend',
    keywords: ['recommend', 'should i'],
    response: `## Reliability Recommendations — Rotating Equipment

Based on failure history, OEM documentation, and current Maximo job plans, here are my prioritised recommendations:

### High priority
1. **Align lubrication interval for PUMP-2547** — OEM specifies every 3 months; current job plan schedules every 6 months. Estimated benefit: 30% reduction in seal/bearing failures.
2. **Increase bearing inspection for COMP-1103** — OEM specifies monthly; current job plan is quarterly. Risk: undetected bearing wear leading to unplanned shutdown.
3. **Add seal condition check to PUMP-0392** — No seal inspection currently in PM tasks. OEM recommends monthly visual check.
4. **Update inspection schedule for TANK-0051** — OEM specifies monthly inspection; current schedule is quarterly.

### Medium priority
5. Standardise all PM task descriptions with OEM best practices (improves technician consistency).
6. Review PM schedule frequencies across the full rotating equipment fleet.

### Implementation path
Engineering review → Job plan update via change-control → Validate in Maximo → Monitor failure rates over next quarter.`,
    sources: { maximoLive: false, documents: true, webKnowledge: false },
    action: {
      id: 'demo-chat-rec-001',
      actionNumber: 'REC-004',
      demoOnly: true,
      title: 'Reliability Recommendations — Rotating Equipment Program',
      description: '6 prioritised recommendations to close maintenance gaps. High priority: PUMP-2547 lubrication, COMP-1103 bearing inspection, PUMP-0392 seal check.',
      type: 'Recommendation',
      status: 'Proposed',
      priority: 'High',
      assets: 4,
      created: _nowLabel(),
      source: 'Chat',
      parentActionId: null,
      relatedActions: [],
      metrics: { totalRecommendations: 6, highPriority: 4, mediumPriority: 2, reliabilityImpact: 'High' },
      recommendations: [
        { recommendation: 'Align lubrication interval with OEM recommendation for PUMP-2547',  assets: 1, priority: 'High',   expectedBenefit: 'Reduce failures by 30%',       effort: 'Medium', status: 'Proposed' },
        { recommendation: 'Increase bearing inspection frequency for COMP-1103 to monthly',    assets: 1, priority: 'High',   expectedBenefit: 'Prevent recurring failures',   effort: 'Low',    status: 'Proposed' },
        { recommendation: 'Add seal condition check to PM tasks for PUMP-0392',                assets: 1, priority: 'High',   expectedBenefit: 'Early detection of seal wear', effort: 'Low',    status: 'Proposed' },
        { recommendation: 'Update inspection schedule for TANK-0051 to monthly',               assets: 1, priority: 'High',   expectedBenefit: 'Reduce leak risk',             effort: 'Low',    status: 'Proposed' },
        { recommendation: 'Standardize PM tasks against OEM best practices',                   assets: 4, priority: 'Medium', expectedBenefit: 'Consistency across fleet',     effort: 'Medium', status: 'Proposed' },
        { recommendation: 'Review PM schedule frequencies across rotating equipment fleet',    assets: 4, priority: 'Medium', expectedBenefit: 'Better maintenance alignment',  effort: 'Medium', status: 'Proposed' },
      ],
      implementationPlan: [
        { step: 1, action: 'Reliability engineer reviews each recommendation against OEM evidence' },
        { step: 2, action: 'Validate supporting OEM documentation and work order history' },
        { step: 3, action: 'Review affected Maximo job plans (JP-PUMP-2547, JP-COMP-1103, JP-PUMP-0392)' },
        { step: 4, action: 'Obtain engineering and maintenance supervisor approval' },
        { step: 5, action: 'Modify job plans through the established change-control process' },
        { step: 6, action: 'Validate changes in Maximo and confirm PM schedule alignment' },
      ],
      impactAreas: [
        { dimension: 'Affected assets',     value: '4 critical/high assets in Units 1–4' },
        { dimension: 'Failure modes',       value: 'Seal failure, bearing wear, lubrication issues' },
        { dimension: 'Downtime exposure',   value: '620 hrs estimated reduction' },
        { dimension: 'Reliability benefit', value: 'High — addresses top recurring failure modes' },
      ],
    },
  },

  // ── Scenario 5: Tasks / assign work ────────────────────────────────────────
  {
    id: 'scenario-task',
    keywords: ['task', 'assign'],
    response: `## Engineering Review Tasks — PUMP-2547 Maintenance Gaps

Based on the identified gaps, here are the recommended tasks for your reliability engineering team:

| # | Task | Asset | Priority | Suggested owner |
|---|---|---|---|---|
| 1 | Review lubrication interval in JP-PUMP-2547 | PUMP-2547 | High | R. Mehta |
| 2 | Increase bearing inspection to monthly in JP-COMP-1103 | COMP-1103 | High | A. Kumar |
| 3 | Add seal condition check to JP-PUMP-0392 | PUMP-0392 | High | S. Patel |
| 4 | Update inspection schedule in job plan for TANK-0051 | TANK-0051 | Medium | R. Singh |

**Suggested due date:** within 14 days to align with next PM cycle.`,
    sources: { maximoLive: true, documents: false, webKnowledge: false },
    action: {
      id: 'demo-chat-task-001',
      actionNumber: 'TSK-004',
      demoOnly: true,
      title: 'Job Plan Review Tasks — Rotating Equipment Gaps',
      description: '4 tasks assigned to reliability engineering team to review and update Maximo job plans for PUMP-2547, COMP-1103, PUMP-0392, TANK-0051.',
      type: 'Task',
      status: 'Open',
      priority: 'High',
      assets: 4,
      created: _nowLabel(),
      source: 'Chat',
      parentActionId: null,
      relatedActions: [],
      metrics: { openTasks: 4, inProgress: 0, completed: 0, highPriority: 3 },
      tasks: [
        { task: 'Review lubrication interval in JP-PUMP-2547',  asset: 'PUMP-2547', priority: 'High',   owner: 'R. Mehta', status: 'Open', created: _nowLabel(), dueDate: 'May 25, 2025' },
        { task: 'Increase bearing inspection for COMP-1103',    asset: 'COMP-1103', priority: 'High',   owner: 'A. Kumar', status: 'Open', created: _nowLabel(), dueDate: 'May 25, 2025' },
        { task: 'Add seal condition check to JP-PUMP-0392',     asset: 'PUMP-0392', priority: 'High',   owner: 'S. Patel', status: 'Open', created: _nowLabel(), dueDate: 'May 25, 2025' },
        { task: 'Update inspection schedule for TANK-0051',     asset: 'TANK-0051', priority: 'Medium', owner: 'R. Singh', status: 'Open', created: _nowLabel(), dueDate: 'May 28, 2025' },
      ],
      activity: [
        { text: 'Action created from chat conversation',                        time: _nowLabel() },
        { text: 'Task created: Review lubrication interval in JP-PUMP-2547',    time: _nowLabel() },
        { text: 'Task created: Increase bearing inspection for COMP-1103',      time: _nowLabel() },
        { text: 'Task created: Add seal condition check to JP-PUMP-0392',       time: _nowLabel() },
        { text: 'Task created: Update inspection schedule for TANK-0051',       time: _nowLabel() },
      ],
    },
  },

  // ── Scenario 6: Work orders / status ───────────────────────────────────────
  {
    id: 'scenario-workorder',
    keywords: ['work order', 'work orders'],
    response: `## Open Work Orders — Rotating Equipment

Here are the current open and in-progress work orders for your critical rotating assets:

| WO # | Asset | Description | Type | Status | Reported |
|---|---|---|---|---|---|
| WO-10502 | PUMP-0392 | Vibration check | Corrective | In Progress | May 5, 2025 |
| WO-10488 | MOT-8821 | Bearing temperature check | Preventive | Scheduled | May 3, 2025 |
| WO-10521 | PUMP-2547 | Seal replacement — PM | Preventive | Scheduled | May 8, 2025 |
| WO-10534 | COMP-1103 | Monthly bearing inspection | Preventive | Open | May 9, 2025 |

**4 open work orders** · Total backlog: 18 hrs

WO-10502 is overdue by 2 days — PUMP-0392 vibration levels have not returned to baseline. Recommend escalating to corrective maintenance review.`,
    sources: { maximoLive: true, documents: false, webKnowledge: false },
    action: {
      id: 'demo-chat-inv-002',
      actionNumber: 'INV-006',
      demoOnly: true,
      title: 'Work Order Escalation — PUMP-0392 Vibration',
      description: 'WO-10502 is overdue. PUMP-0392 vibration levels have not returned to baseline after corrective maintenance. Escalation and root cause investigation required.',
      type: 'Investigation',
      status: 'Open',
      priority: 'High',
      assets: 1,
      created: _nowLabel(),
      source: 'Chat',
      parentActionId: null,
      relatedActions: [],
      metrics: { totalAssets: 1, totalFailures: 7, totalDowntime: '142 hrs', highPriorityAssets: 1 },
      priorityAssets: [
        { asset: 'PUMP-0392', description: 'Process Pump 0392', criticality: 'High', failures: 7, downtime: '142 hrs', priority: 'High', reason: 'Ongoing vibration issue — WO-10502 overdue' },
      ],
      allAssets: [
        { asset: 'PUMP-0392', description: 'Process Pump 0392', location: 'Unit 2', criticality: 'High', failures: 7, downtime: '142 hrs', lastFailure: 'May 5, 2025', currentPM: 'PM-PUMP-0392', priority: 'High' },
      ],
      failurePatterns: [
        { mode: 'High vibration', occurrences: 7, affectedAssets: 1, severity: 'Medium', lastOccurrence: 'May 5, 2025', trend: 'Increasing' },
      ],
      workOrders: [
        { wo: 'WO-10502', asset: 'PUMP-0392', description: 'Vibration check', type: 'Corrective', status: 'In Progress', reported: 'May 5, 2025', completed: '—', downtime: '18 hrs' },
      ],
      recommendations: [
        { recommendation: 'Escalate WO-10502 to senior maintenance engineer for root cause analysis', assets: 1, priority: 'High', expectedBenefit: 'Prevent further asset damage', evidence: 'Ongoing vibration outside baseline', status: 'Proposed' },
      ],
    },
  },

  // ── Scenario 7: Pump / asset-specific query ────────────────────────────────
  {
    id: 'scenario-pump',
    keywords: ['pump', 'pump-2547'],
    response: `## Asset Overview — PUMP-2547 (Booster Pump 2547)

**Location:** Unit 3, Block B · **Criticality:** Critical · **Current status:** Active

### Maintenance history (last 12 months)
- **12 failures** · **256 hrs** total downtime
- Most recent failure: Apr 28, 2025 — Seal leakage (WO-10421, resolved Apr 22)
- Dominant failure mode: **Seal leakage** (8 of 12 failures)

### Current job plan: JP-PUMP-2547
| Task | Current frequency | OEM recommendation | Gap |
|---|---|---|---|
| Lubrication | Every 6 months | Every 3 months | ⚠ 2× too long |
| Seal inspection | Annual | Every 6 months | ⚠ 2× too long |
| Vibration check | Not scheduled | Quarterly | ⚠ Missing |

### OEM source
Pump Series X Maintenance Manual (2024) — Sections 5.4, 6.2, 4.3

### Recommendation
Updating JP-PUMP-2547 to align with OEM recommendations is estimated to reduce PUMP-2547 failures by **~8 per year** and recover **~170 hrs** of annual production time.`,
    sources: { maximoLive: true, documents: true, webKnowledge: false },
    action: {
      id: 'demo-chat-ana-pump-001',
      actionNumber: 'ANA-006',
      demoOnly: true,
      title: 'Job Plan Review — PUMP-2547',
      description: 'JP-PUMP-2547 has 3 identified gaps vs OEM Manual. Updating lubrication, seal inspection and adding vibration check estimated to reduce failures by 8/year.',
      type: 'Analysis',
      status: 'Open',
      priority: 'High',
      assets: 1,
      created: _nowLabel(),
      source: 'Chat',
      parentActionId: null,
      relatedActions: [],
      metrics: { assetsEvaluated: 1, requireReview: 1, gapsIdentified: 3, aligned: 0 },
      gapSummaryByCategory: [
        { category: 'Maintenance Interval', count: 1, pct: '33%' },
        { category: 'Inspection Frequency', count: 1, pct: '33%' },
        { category: 'Maintenance Tasks',    count: 1, pct: '33%' },
      ],
      gapSeverity: [
        { severity: 'High',    count: 2 },
        { severity: 'Medium',  count: 1 },
        { severity: 'Low',     count: 0 },
        { severity: 'Aligned', count: 0 },
      ],
      assetsWithGaps: [
        { asset: 'PUMP-2547', description: 'Booster Pump 2547', criticality: 'Critical', gapCount: 3, highestGap: 'Maintenance Interval', status: 'Gap Identified', priority: 'High' },
      ],
      currentJobPlans: [
        { asset: 'PUMP-2547', jobPlan: 'JP-PUMP-2547', task: 'Lubrication check', frequency: 'Every 6 months', procedure: 'Apply grease per spec', lastUpdated: 'Jan 2024' },
        { asset: 'PUMP-2547', jobPlan: 'JP-PUMP-2547', task: 'Seal inspection',   frequency: 'Annual',         procedure: 'Visual inspection only', lastUpdated: 'Jan 2024' },
      ],
      oemRecommendations: [
        { asset: 'PUMP-2547', document: 'Pump Series X OEM Manual', section: '5.4 Lubrication', recommendation: 'Lubricate every 3 months',    frequency: 'Every 3 months', docDate: '2024', evidence: 'Section 5.4, pg 42' },
        { asset: 'PUMP-2547', document: 'Pump Series X OEM Manual', section: '6.2 Seals',       recommendation: 'Inspect seals every 6 months', frequency: 'Every 6 months', docDate: '2024', evidence: 'Section 6.2, pg 58' },
        { asset: 'PUMP-2547', document: 'Pump Series X OEM Manual', section: '4.3 Vibration',   recommendation: 'Measure vibration quarterly',  frequency: 'Quarterly',      docDate: '2024', evidence: 'Section 4.3, pg 35' },
      ],
      gaps: [
        { asset: 'PUMP-2547', currentPractice: 'Lubricate every 6 months', oemRecommendation: 'Lubricate every 3 months', identifiedGap: 'Interval 2× longer than OEM',    status: 'Gap Identified', priority: 'High',   evidence: 'OEM Manual 5.4' },
        { asset: 'PUMP-2547', currentPractice: 'Inspect seals annually',   oemRecommendation: 'Inspect seals every 6 months', identifiedGap: 'Inspection frequency too low', status: 'Gap Identified', priority: 'High',   evidence: 'OEM Manual 6.2' },
        { asset: 'PUMP-2547', currentPractice: 'No vibration monitoring',  oemRecommendation: 'Measure vibration quarterly',  identifiedGap: 'Missing vibration monitoring', status: 'Gap Identified', priority: 'Medium', evidence: 'OEM Manual 4.3' },
      ],
      evidence: [
        { asset: 'PUMP-2547', maximo: 'JP-PUMP-2547 — 6-month lubrication', oem: 'OEM Section 5.4 — 3-month interval', analysis: 'Gap: interval is 2× longer than OEM guidance', recommendation: 'Update lubrication task frequency in JP-PUMP-2547' },
      ],
    },
  },
];

// ── Matcher ───────────────────────────────────────────────────────────────────

/**
 * Find the best matching scenario for a user query.
 * Returns the scenario object or null if no match.
 */
export function matchScenario(query) {
  const q = query.toLowerCase();
  // Score each scenario by how many keywords match
  let best = null;
  let bestScore = 0;
  for (const scenario of DEMO_SCENARIOS) {
    const score = scenario.keywords.filter(kw => q.includes(kw)).length;
    if (score > 0 && score >= scenario.keywords.length && score > bestScore) {
      best = scenario;
      bestScore = score;
    }
  }
  // Fallback: partial match (any single keyword)
  if (!best) {
    for (const scenario of DEMO_SCENARIOS) {
      const score = scenario.keywords.filter(kw => q.includes(kw)).length;
      if (score > 0 && score > bestScore) {
        best = scenario;
        bestScore = score;
      }
    }
  }
  return best;
}

/**
 * Build a bot message object from a matched scenario.
 * Stamped with a unique id and current timestamp.
 */
export function scenarioToMessage(scenario) {
  return {
    id: Date.now(),
    type: 'bot',
    timestamp: new Date(),
    synthesizedAnswer: scenario.response,
    sections: [],
    sourcesQueried: scenario.sources,
    provenance: null,
    demoScenario: scenario,          // carried for the "Create action" button
  };
}

