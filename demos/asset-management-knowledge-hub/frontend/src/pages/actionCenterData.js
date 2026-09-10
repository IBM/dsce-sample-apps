// ── Seed data for Action Center detail pages ──────────────────────────────
// All data is realistic demo data for the reliability engineering workflow.

// ── Dynamic timestamp helpers ─────────────────────────────────────────────
// All "Created" labels are computed at module-load time so they always
// reflect the actual current date rather than the date the file was written.

function _fmt(date) {
  return date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function _today(h, m)     { const d = new Date(); d.setHours(h, m, 0, 0); return `Today, ${_fmt(d)}`; }
function _yesterday(h, m) { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(h, m, 0, 0); return `Yesterday, ${_fmt(d)}`; }
function _daysAgo(n, h, m){ const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return `${n} days ago, ${_fmt(d)}`; }
function _lastWeek(h, m)  { return _daysAgo(7, h, m).replace('7 days ago', 'Last week'); }

export const ACTIONS = [
  // ── 1. Investigation ─────────────────────────────────────────────────────
  {
    id: '1',
    actionNumber: 'INV-001',
    title: 'Critical Asset Failure Investigation',
    description: 'Identified 15 assets with recurring failures and prioritized them based on criticality, failure frequency, and downtime.',
    type: 'Investigation',
    status: 'Completed',
    priority: 'High',
    assets: 15,
    created: _today(10, 24),
    source: 'Chat',
    sourceConversationId: 'conv-001',
    parentActionId: null,
    relatedActions: ['2', '3', '7'],
    metrics: {
      totalAssets: 15,
      totalFailures: 78,
      totalDowntime: '1,240 hrs',
      highPriorityAssets: 5,
    },
    priorityAssets: [
      { asset: 'P-101', description: 'Booster Pump 1',  criticality: 'Critical', failures: 12, downtime: '256 hrs', priority: 'High',   reason: 'High failure rate & downtime' },
      { asset: 'C-203', description: 'Compressor 3',    criticality: 'Critical', failures: 8,  downtime: '198 hrs', priority: 'High',   reason: 'Recurring seal failures' },
      { asset: 'P-204', description: 'Process Pump 2',  criticality: 'High',     failures: 7,  downtime: '142 hrs', priority: 'Medium', reason: 'High maintenance recurrence' },
      { asset: 'T-101', description: 'Storage Tank 1',  criticality: 'High',     failures: 5,  downtime: '110 hrs', priority: 'Medium', reason: 'Repeated alarms and leaks' },
      { asset: 'M-301', description: 'Motor 301',       criticality: 'Medium',   failures: 4,  downtime: '68 hrs',  priority: 'Low',    reason: 'Bearing overheating' },
    ],
    allAssets: [
      { asset: 'P-101',  description: 'Booster Pump 1',    location: 'Unit 3', criticality: 'Critical', failures: 12, downtime: '256 hrs', lastFailure: 'Apr 28, 2025', currentPM: 'PM-PUMP-001', priority: 'High' },
      { asset: 'C-203',  description: 'Compressor 3',      location: 'Unit 1', criticality: 'Critical', failures: 8,  downtime: '198 hrs', lastFailure: 'May 2, 2025',  currentPM: 'PM-COMP-003', priority: 'High' },
      { asset: 'P-204',  description: 'Process Pump 2',    location: 'Unit 2', criticality: 'High',     failures: 7,  downtime: '142 hrs', lastFailure: 'May 5, 2025',  currentPM: 'PM-PUMP-002', priority: 'Medium' },
      { asset: 'T-101',  description: 'Storage Tank 1',    location: 'Unit 4', criticality: 'High',     failures: 5,  downtime: '110 hrs', lastFailure: 'Apr 30, 2025', currentPM: 'PM-TANK-001', priority: 'Medium' },
      { asset: 'M-301',  description: 'Motor 301',         location: 'Unit 1', criticality: 'Medium',   failures: 4,  downtime: '68 hrs',  lastFailure: 'Apr 25, 2025', currentPM: 'PM-MOT-301',  priority: 'Low' },
      { asset: 'P-312',  description: 'Booster Pump 312',  location: 'Unit 2', criticality: 'High',     failures: 3,  downtime: '54 hrs',  lastFailure: 'Apr 18, 2025', currentPM: 'PM-PUMP-312', priority: 'Medium' },
      { asset: 'C-401',  description: 'Compressor 401',    location: 'Unit 3', criticality: 'High',     failures: 3,  downtime: '48 hrs',  lastFailure: 'Apr 14, 2025', currentPM: 'PM-COMP-401', priority: 'Medium' },
      { asset: 'P-518',  description: 'Process Pump 518',  location: 'Unit 4', criticality: 'Medium',   failures: 3,  downtime: '42 hrs',  lastFailure: 'Apr 10, 2025', currentPM: 'PM-PUMP-518', priority: 'Low' },
      { asset: 'T-202',  description: 'Storage Tank 202',  location: 'Unit 1', criticality: 'Medium',   failures: 2,  downtime: '36 hrs',  lastFailure: 'Mar 29, 2025', currentPM: 'PM-TANK-202', priority: 'Low' },
      { asset: 'M-415',  description: 'Motor 415',         location: 'Unit 2', criticality: 'Medium',   failures: 2,  downtime: '28 hrs',  lastFailure: 'Mar 25, 2025', currentPM: 'PM-MOT-415',  priority: 'Low' },
      { asset: 'P-627',  description: 'Injection Pump 627',location: 'Unit 3', criticality: 'High',     failures: 2,  downtime: '24 hrs',  lastFailure: 'Mar 20, 2025', currentPM: 'PM-PUMP-627', priority: 'Low' },
      { asset: 'C-522',  description: 'Compressor 522',    location: 'Unit 4', criticality: 'Medium',   failures: 2,  downtime: '20 hrs',  lastFailure: 'Mar 15, 2025', currentPM: 'PM-COMP-522', priority: 'Low' },
      { asset: 'P-730',  description: 'Transfer Pump 730', location: 'Unit 1', criticality: 'Low',      failures: 1,  downtime: '12 hrs',  lastFailure: 'Mar 8, 2025',  currentPM: 'PM-PUMP-730', priority: 'Low' },
      { asset: 'T-303',  description: 'Buffer Tank 303',   location: 'Unit 2', criticality: 'Low',      failures: 1,  downtime: '8 hrs',   lastFailure: 'Feb 28, 2025', currentPM: 'PM-TANK-303', priority: 'Low' },
      { asset: 'M-509',  description: 'Drive Motor 509',   location: 'Unit 3', criticality: 'Low',      failures: 1,  downtime: '6 hrs',   lastFailure: 'Feb 20, 2025', currentPM: 'PM-MOT-509',  priority: 'Low' },
    ],
    failurePatterns: [
      { mode: 'Seal leakage',          occurrences: 12, affectedAssets: 4, severity: 'High',   lastOccurrence: 'May 2, 2025',  trend: 'Increasing' },
      { mode: 'Bearing overheating',   occurrences: 8,  affectedAssets: 3, severity: 'High',   lastOccurrence: 'Apr 28, 2025', trend: 'Stable' },
      { mode: 'High vibration',        occurrences: 7,  affectedAssets: 3, severity: 'Medium', lastOccurrence: 'May 5, 2025',  trend: 'Increasing' },
      { mode: 'Lubrication issue',     occurrences: 5,  affectedAssets: 4, severity: 'Medium', lastOccurrence: 'Apr 30, 2025', trend: 'Stable' },
      { mode: 'Valve failure',         occurrences: 3,  affectedAssets: 2, severity: 'Low',    lastOccurrence: 'Apr 15, 2025', trend: 'Decreasing' },
    ],
    workOrders: [
      { wo: 'WO-10421', asset: 'P-101', description: 'Seal replacement',           type: 'Corrective', status: 'Closed',     reported: 'Apr 20, 2025', completed: 'Apr 22, 2025', downtime: '48 hrs' },
      { wo: 'WO-10398', asset: 'C-203', description: 'Bearing inspection',         type: 'Corrective', status: 'Closed',     reported: 'Apr 10, 2025', completed: 'Apr 12, 2025', downtime: '36 hrs' },
      { wo: 'WO-10502', asset: 'P-204', description: 'Vibration check',            type: 'Corrective', status: 'In Progress',reported: 'May 5, 2025',  completed: '—',            downtime: '18 hrs' },
      { wo: 'WO-10315', asset: 'T-101', description: 'Leak investigation',         type: 'Corrective', status: 'Closed',     reported: 'Mar 28, 2025', completed: 'Apr 1, 2025',  downtime: '72 hrs' },
      { wo: 'WO-10488', asset: 'M-301', description: 'Bearing temperature check',  type: 'Preventive', status: 'Scheduled',  reported: 'May 3, 2025',  completed: '—',            downtime: '0 hrs' },
    ],
    recommendations: [
      { recommendation: 'Align lubrication interval with OEM recommendation',         assets: 2, priority: 'High',   expectedBenefit: 'Reduce lubrication-related failures by 30%',  evidence: 'OEM Manual Section 5.4', status: 'Proposed' },
      { recommendation: 'Increase inspection frequency for critical components',       assets: 2, priority: 'High',   expectedBenefit: 'Earlier detection of seal wear and bearing failures', evidence: 'Failure pattern analysis', status: 'Proposed' },
      { recommendation: 'Add seal condition check to PM tasks',                        assets: 1, priority: 'High',   expectedBenefit: 'Early detection of seal wear',              evidence: 'Work order history WO-10421', status: 'Proposed' },
      { recommendation: 'Standardize PM tasks with OEM best practices',                assets: 3, priority: 'Medium', expectedBenefit: 'Consistency across assets',                  evidence: 'OEM Maintenance Manual',     status: 'Proposed' },
    ],
  },

  // ── 2. Analysis ──────────────────────────────────────────────────────────
  {
    id: '2',
    actionNumber: 'ANA-001',
    title: 'Job Plan vs OEM Analysis',
    description: 'Compared current Maximo job plans with OEM maintenance recommendations to identify gaps.',
    type: 'Analysis',
    status: 'In Review',
    priority: 'High',
    assets: 7,
    created: _today(11, 5),
    source: 'Chat',
    sourceConversationId: 'conv-001',
    parentActionId: '1',
    relatedActions: ['1', '3', '7'],
    metrics: {
      assetsEvaluated: 15,
      requireReview: 7,
      gapsIdentified: 4,
      aligned: 8,
    },
    gapSummaryByCategory: [
      { category: 'Maintenance Interval',  count: 4, pct: '40%' },
      { category: 'Inspection Frequency',  count: 3, pct: '30%' },
      { category: 'Maintenance Tasks',     count: 2, pct: '20%' },
      { category: 'Lubrication',           count: 1, pct: '10%' },
      { category: 'Other',                 count: 0, pct: '0%' },
    ],
    gapSeverity: [
      { severity: 'High',    count: 4 },
      { severity: 'Medium',  count: 3 },
      { severity: 'Low',     count: 0 },
      { severity: 'Aligned', count: 8 },
    ],
    assetsWithGaps: [
      { asset: 'P-101', description: 'Booster Pump 1', criticality: 'Critical', gapCount: 2, highestGap: 'Maintenance Interval', status: 'Gap Identified',   priority: 'High' },
      { asset: 'C-203', description: 'Compressor 3',   criticality: 'Critical', gapCount: 2, highestGap: 'Inspection Frequency', status: 'Review Required',  priority: 'High' },
      { asset: 'P-204', description: 'Process Pump 2', criticality: 'High',     gapCount: 1, highestGap: 'Maintenance Tasks',    status: 'Review Required',  priority: 'Medium' },
      { asset: 'T-101', description: 'Storage Tank 1', criticality: 'High',     gapCount: 1, highestGap: 'Inspection Frequency', status: 'Review Required',  priority: 'Medium' },
    ],
    currentJobPlans: [
      { asset: 'P-101', jobPlan: 'JP-PUMP-001', task: 'Lubrication check',      frequency: 'Every 6 months', procedure: 'Apply grease per spec',         lastUpdated: 'Jan 2024' },
      { asset: 'P-101', jobPlan: 'JP-PUMP-001', task: 'Seal inspection',        frequency: 'Annual',         procedure: 'Visual inspection only',         lastUpdated: 'Jan 2024' },
      { asset: 'C-203', jobPlan: 'JP-COMP-003', task: 'Bearing inspection',     frequency: 'Quarterly',      procedure: 'Visual + temperature check',     lastUpdated: 'Mar 2024' },
      { asset: 'C-203', jobPlan: 'JP-COMP-003', task: 'Vibration measurement',  frequency: 'Semi-annual',    procedure: 'Manual vibration logging',       lastUpdated: 'Mar 2024' },
      { asset: 'P-204', jobPlan: 'JP-PUMP-002', task: 'Seal replacement',       frequency: 'Annual',         procedure: 'Replace seal if worn',           lastUpdated: 'Feb 2024' },
    ],
    oemRecommendations: [
      { asset: 'P-101', document: 'Pump Series X Manual', section: '5.4 Lubrication',  recommendation: 'Lubricate every 3 months',        frequency: 'Every 3 months', docDate: '2024', evidence: 'Section 5.4, pg 42' },
      { asset: 'P-101', document: 'Pump Series X Manual', section: '6.2 Seals',        recommendation: 'Inspect seals every 6 months',    frequency: 'Every 6 months', docDate: '2024', evidence: 'Section 6.2, pg 58' },
      { asset: 'C-203', document: 'Compressor OEM Guide', section: '4.1 Bearings',     recommendation: 'Inspect bearings monthly',        frequency: 'Monthly',        docDate: '2023', evidence: 'Section 4.1, pg 31' },
      { asset: 'C-203', document: 'Compressor OEM Guide', section: '4.3 Vibration',    recommendation: 'Measure vibration quarterly',     frequency: 'Quarterly',      docDate: '2023', evidence: 'Section 4.3, pg 35' },
      { asset: 'P-204', document: 'Pump Series Y Manual', section: '6.1 Seals',        recommendation: 'Inspect seal condition every 6m', frequency: 'Every 6 months', docDate: '2024', evidence: 'Section 6.1, pg 54' },
    ],
    gaps: [
      { asset: 'P-101', currentPractice: 'Lubricate every 6 months',          oemRecommendation: 'Lubricate every 3 months',               identifiedGap: 'Maintenance interval too long',          status: 'Gap Identified',  priority: 'High',   evidence: 'OEM Manual 5.4' },
      { asset: 'C-203', currentPractice: 'Inspect bearing quarterly',          oemRecommendation: 'Inspect bearing monthly',                identifiedGap: 'Inspection frequency too low',           status: 'Review Required', priority: 'High',   evidence: 'OEM Guide 4.1' },
      { asset: 'P-204', currentPractice: 'Replace seal annually',              oemRecommendation: 'Inspect seal condition every 6 months', identifiedGap: 'Maintenance strategy difference',        status: 'Review Required', priority: 'Medium', evidence: 'OEM Manual 6.1' },
      { asset: 'T-101', currentPractice: 'Inspect quarterly',                  oemRecommendation: 'Inspect monthly',                       identifiedGap: 'Inspection frequency below OEM guidance', status: 'Review Required', priority: 'Medium', evidence: 'OEM Tank Guide' },
    ],
    evidence: [
      { asset: 'P-101', maximo: 'JP-PUMP-001 — 6-month lubrication', oem: 'OEM Section 5.4 — 3-month interval', analysis: 'Gap: interval is 2× longer than OEM guidance', recommendation: 'Update lubrication task frequency in JP-PUMP-001' },
      { asset: 'C-203', maximo: 'JP-COMP-003 — quarterly bearing inspection', oem: 'OEM Section 4.1 — monthly inspection', analysis: 'Gap: quarterly vs monthly — potential failure risk', recommendation: 'Increase bearing inspection to monthly frequency' },
    ],
  },

  // ── 3. Report ────────────────────────────────────────────────────────────
  {
    id: '3',
    actionNumber: 'RP-001',
    title: 'Maintenance Gap Report',
    description: 'Detailed report covering identified maintenance gaps with supporting engineering evidence and impact assessment.',
    type: 'Report',
    status: 'Completed',
    priority: 'Medium',
    assets: 7,
    created: _today(11, 30),
    source: 'Chat',
    sourceConversationId: 'conv-001',
    parentActionId: '2',
    relatedActions: ['1', '2', '7'],
    summary: {
      assetsEvaluated: 15,
      assetsWithGaps: 7,
      assetsRequireReview: 4,
      alignedAssets: 8,
      totalGaps: 10,
      highSeverityGaps: 4,
      mediumSeverityGaps: 3,
      lowSeverityGaps: 3,
    },
    topGapCategories: [
      { category: 'Maintenance Interval',  count: 4 },
      { category: 'Inspection Frequency',  count: 3 },
      { category: 'Maintenance Tasks',     count: 2 },
      { category: 'Lubrication',           count: 1 },
    ],
    potentialImpact: {
      estimatedDowntimeReduction: '620 hrs',
      estimatedCostAvoidance: '$190K',
      reliabilityImprovement: 'High',
    },
    highSeverityGaps: [
      { asset: 'P-101', category: 'Maintenance Interval',  currentPractice: 'Lubricate every 6 months', oemRecommendation: 'Lubricate every 3 months', potentialImpact: 'Bearing wear risk',   priority: 'High' },
      { asset: 'C-203', category: 'Inspection Frequency',  currentPractice: 'Inspect every 3 months',   oemRecommendation: 'Inspect monthly',          potentialImpact: 'Undetected failures', priority: 'High' },
      { asset: 'P-204', category: 'Maintenance Tasks',     currentPractice: 'No seal condition check',  oemRecommendation: 'Check seal condition monthly', potentialImpact: 'Seal failure risk',  priority: 'High' },
      { asset: 'T-101', category: 'Inspection Frequency',  currentPractice: 'Inspect quarterly',        oemRecommendation: 'Inspect monthly',          potentialImpact: 'Leak risk',           priority: 'High' },
    ],
    assetGaps: [
      { asset: 'P-101', description: 'Booster Pump 1', gapCategory: 'Maintenance Interval',  gap: 'Lubrication every 6m vs 3m OEM',   severity: 'High',   status: 'Gap Identified' },
      { asset: 'C-203', description: 'Compressor 3',   gapCategory: 'Inspection Frequency',  gap: 'Quarterly vs monthly OEM',         severity: 'High',   status: 'Review Required' },
      { asset: 'P-204', description: 'Process Pump 2', gapCategory: 'Maintenance Tasks',     gap: 'No seal condition check in PM',    severity: 'High',   status: 'Review Required' },
      { asset: 'T-101', description: 'Storage Tank 1', gapCategory: 'Inspection Frequency',  gap: 'Quarterly vs monthly OEM',         severity: 'Medium', status: 'Review Required' },
    ],
    maintenanceGaps: [
      { category: 'Maintenance Interval', count: 4, severity: 'High',   assets: ['P-101', 'M-301', 'P-204', 'T-101'] },
      { category: 'Inspection Frequency', count: 3, severity: 'High',   assets: ['C-203', 'T-101', 'M-301'] },
      { category: 'Maintenance Tasks',    count: 2, severity: 'Medium', assets: ['P-204', 'C-203'] },
      { category: 'Lubrication',          count: 1, severity: 'Medium', assets: ['P-101'] },
    ],
    recommendedActions: [
      { action: 'Review JP-PUMP-001',                          asset: 'P-101', priority: 'High',   relatedActionId: '4' },
      { action: 'Review inspection frequency for C-203',       asset: 'C-203', priority: 'High',   relatedActionId: '4' },
      { action: 'Add seal condition inspection for P-204',     asset: 'P-204', priority: 'High',   relatedActionId: '4' },
      { action: 'Validate lubrication procedure for M-301',    asset: 'M-301', priority: 'Medium', relatedActionId: '4' },
    ],
  },

  // ── 4. Task ──────────────────────────────────────────────────────────────
  {
    id: '4',
    actionNumber: 'TSK-001',
    title: 'Job Plan Review Tasks',
    description: 'Reliability engineering review tasks generated from confirmed maintenance gaps.',
    type: 'Task',
    status: 'Open',
    priority: 'High',
    assets: 4,
    created: _today(12, 1),
    source: 'Chat',
    sourceConversationId: 'conv-001',
    parentActionId: '3',
    relatedActions: ['1', '2', '3'],
    metrics: {
      openTasks: 4,
      inProgress: 1,
      completed: 0,
      highPriority: 3,
    },
    tasks: [
      { task: 'Review lubrication interval for P-101',    asset: 'P-101', priority: 'High',   owner: 'R. Mehta',  status: 'Open',        created: _today(12, 1), dueDate: 'May 25, 2025' },
      { task: 'Review inspection frequency for C-203',    asset: 'C-203', priority: 'High',   owner: 'A. Kumar',  status: 'Open',        created: _today(12, 1), dueDate: 'May 25, 2025' },
      { task: 'Add seal condition check to P-204',        asset: 'P-204', priority: 'High',   owner: 'S. Patel',  status: 'Open',        created: _today(12, 1), dueDate: 'May 25, 2025' },
      { task: 'Update job plan for T-101',                asset: 'T-101', priority: 'Medium', owner: 'R. Singh',  status: 'In Progress', created: _today(12, 1), dueDate: 'May 28, 2025' },
    ],
    activity: [
      { text: 'Task created: Review lubrication interval for P-101',          time: _today(12, 1) },
      { text: 'Task created: Review inspection frequency for C-203',           time: _today(12, 1) },
      { text: 'Task created: Add seal condition check to P-204',               time: _today(12, 1) },
      { text: 'Task status changed to In Progress: Update job plan for T-101', time: _today(12, 7) },
    ],
  },

  // ── 5. Analysis (Lubrication) ────────────────────────────────────────────
  {
    id: '5',
    actionNumber: 'ANA-002',
    title: 'Lubrication Interval Gap Analysis',
    description: 'Lubrication interval differs from OEM recommendation for selected critical assets.',
    type: 'Analysis',
    status: 'Review Required',
    priority: 'High',
    assets: 5,
    created: _yesterday(15, 22),
    source: 'Chat',
    sourceConversationId: 'conv-002',
    parentActionId: null,
    relatedActions: [],
    metrics: { assetsEvaluated: 5, requireReview: 3, gapsIdentified: 3, aligned: 2 },
    gapSummaryByCategory: [
      { category: 'Lubrication',  count: 3, pct: '60%' },
      { category: 'Other',        count: 2, pct: '40%' },
    ],
    gapSeverity: [
      { severity: 'High',    count: 3 },
      { severity: 'Medium',  count: 0 },
      { severity: 'Low',     count: 0 },
      { severity: 'Aligned', count: 2 },
    ],
    assetsWithGaps: [
      { asset: 'P-101', description: 'Booster Pump 1', criticality: 'Critical', gapCount: 1, highestGap: 'Lubrication', status: 'Gap Identified',  priority: 'High' },
      { asset: 'M-301', description: 'Motor 301',       criticality: 'Medium',  gapCount: 1, highestGap: 'Lubrication', status: 'Gap Identified',  priority: 'High' },
    ],
    currentJobPlans: [],
    oemRecommendations: [],
    gaps: [
      { asset: 'P-101', currentPractice: 'Lubricate every 6 months', oemRecommendation: 'Lubricate every 3 months', identifiedGap: 'Interval 2× longer than OEM', status: 'Gap Identified', priority: 'High', evidence: 'OEM Manual 5.4' },
    ],
    evidence: [],
  },

  // ── 6. Investigation ─────────────────────────────────────────────────────
  {
    id: '6',
    actionNumber: 'INV-002',
    title: 'OEM Maintenance Compliance Review',
    description: 'Verify lubrication intervals against OEM specifications for identified critical assets.',
    type: 'Investigation',
    status: 'Completed',
    priority: 'Medium',
    assets: 12,
    created: _yesterday(14, 10),
    source: 'Chat',
    sourceConversationId: 'conv-002',
    parentActionId: null,
    relatedActions: [],
    metrics: { totalAssets: 12, totalFailures: 34, totalDowntime: '420 hrs', highPriorityAssets: 3 },
    priorityAssets: [
      { asset: 'P-101', description: 'Booster Pump 1', criticality: 'Critical', failures: 12, downtime: '256 hrs', priority: 'High',   reason: 'High failure rate' },
      { asset: 'C-203', description: 'Compressor 3',   criticality: 'Critical', failures: 8,  downtime: '198 hrs', priority: 'High',   reason: 'Recurring seal failures' },
      { asset: 'M-301', description: 'Motor 301',       criticality: 'Medium',  failures: 4,  downtime: '68 hrs',  priority: 'Medium', reason: 'Bearing overheating' },
    ],
    allAssets: [],
    failurePatterns: [],
    workOrders: [],
    recommendations: [],
  },

  // ── 7. Recommendation ────────────────────────────────────────────────────
  {
    id: '7',
    actionNumber: 'REC-001',
    title: 'High-Priority Reliability Recommendations',
    description: 'AI-generated recommendations to address identified maintenance gaps and improve reliability.',
    type: 'Recommendation',
    status: 'Proposed',
    priority: 'High',
    assets: 7,
    created: _yesterday(13, 45),
    source: 'System',
    sourceConversationId: 'conv-001',
    parentActionId: '3',
    relatedActions: ['1', '2', '3'],
    metrics: {
      totalRecommendations: 6,
      highPriority: 4,
      mediumPriority: 2,
      reliabilityImpact: 'High',
    },
    recommendations: [
      { recommendation: 'Align lubrication interval with OEM recommendation',          assets: 2, priority: 'High',   expectedBenefit: 'Reduce failures by 30%',       effort: 'Medium', status: 'Proposed' },
      { recommendation: 'Increase inspection frequency for critical components',        assets: 2, priority: 'High',   expectedBenefit: 'Prevent recurring failures',    effort: 'Low',    status: 'Proposed' },
      { recommendation: 'Add seal condition check to PM tasks',                         assets: 1, priority: 'High',   expectedBenefit: 'Early detection of seal wear',  effort: 'Low',    status: 'Proposed' },
      { recommendation: 'Standardize PM tasks with OEM best practices',                 assets: 3, priority: 'Medium', expectedBenefit: 'Consistency across assets',     effort: 'Medium', status: 'Proposed' },
      { recommendation: 'Update job plans for critical assets',                          assets: 2, priority: 'Medium', expectedBenefit: 'Improve reliability & uptime',  effort: 'High',   status: 'Proposed' },
      { recommendation: 'Review and optimize PM schedule',                               assets: 3, priority: 'Medium', expectedBenefit: 'Better maintenance alignment',  effort: 'Medium', status: 'Proposed' },
    ],
    implementationPlan: [
      { step: 1, action: 'Reliability Engineer reviews each recommendation' },
      { step: 2, action: 'Validate OEM evidence for each identified gap' },
      { step: 3, action: 'Review affected Maximo Job Plans' },
      { step: 4, action: 'Obtain engineering and maintenance supervisor approval' },
      { step: 5, action: 'Modify job plans using existing change-control process' },
      { step: 6, action: 'Validate changes in Maximo and confirm PM schedule alignment' },
      { step: 7, action: 'Mark recommendations as Implemented and close associated tasks' },
    ],
    impactAreas: [
      { dimension: 'Affected Assets',    value: '8 assets across Units 1–4' },
      { dimension: 'Failure Modes',      value: 'Seal failure, bearing wear, lubrication issues' },
      { dimension: 'Downtime Exposure',  value: '620 hrs estimated reduction' },
      { dimension: 'Criticality',        value: '4 Critical, 3 High assets addressed' },
      { dimension: 'Reliability Benefit', value: 'High — addresses top recurring failure modes' },
    ],
  },
  // ── 8. Analysis (PM Schedule) ─────────────────────────────────────────────
  {
    id: '8',
    actionNumber: 'ANA-003',
    title: 'Preventive Maintenance Schedule Review',
    description: 'PM schedule alignment with OEM best practices for high-criticality assets.',
    type: 'Analysis',
    status: 'Completed',
    priority: 'Medium',
    assets: 10,
    created: _lastWeek(16, 30),
    source: 'Chat',
    sourceConversationId: 'conv-003',
    parentActionId: null,
    relatedActions: [],
    metrics: { assetsEvaluated: 10, requireReview: 3, gapsIdentified: 3, aligned: 7 },
    gapSummaryByCategory: [
      { category: 'PM Frequency', count: 2, pct: '67%' },
      { category: 'Task Coverage', count: 1, pct: '33%' },
    ],
    gapSeverity: [
      { severity: 'High',    count: 1 },
      { severity: 'Medium',  count: 2 },
      { severity: 'Low',     count: 0 },
      { severity: 'Aligned', count: 7 },
    ],
    assetsWithGaps: [
      { asset: 'P-101', description: 'Booster Pump 1', criticality: 'Critical', gapCount: 1, highestGap: 'PM Frequency',   status: 'Gap Identified',  priority: 'High' },
      { asset: 'M-301', description: 'Motor 301',       criticality: 'Medium',  gapCount: 1, highestGap: 'Task Coverage',  status: 'Review Required', priority: 'Medium' },
      { asset: 'T-101', description: 'Storage Tank 1',  criticality: 'High',    gapCount: 1, highestGap: 'PM Frequency',   status: 'Review Required', priority: 'Medium' },
    ],
    currentJobPlans: [],
    oemRecommendations: [],
    gaps: [
      { asset: 'P-101', currentPractice: 'PM every 6 months', oemRecommendation: 'PM every 3 months', identifiedGap: 'Interval is 2× the OEM recommendation', status: 'Gap Identified', priority: 'High', evidence: 'OEM Manual 5.4' },
    ],
    evidence: [],
  },

  // ── 9. Report (Compressor Performance) ───────────────────────────────────
  {
    id: '9',
    actionNumber: 'RP-002',
    title: 'Compressor Performance Trending',
    description: 'Performance degradation analysis and prediction for compressor assets.',
    type: 'Report',
    status: 'Completed',
    priority: 'Medium',
    assets: 3,
    created: _lastWeek(14, 15),
    source: 'Chat',
    sourceConversationId: 'conv-003',
    parentActionId: null,
    relatedActions: [],
    summary: {
      assetsEvaluated: 3,
      assetsWithGaps: 2,
      assetsRequireReview: 1,
      alignedAssets: 1,
      totalGaps: 4,
      highSeverityGaps: 2,
      mediumSeverityGaps: 2,
      lowSeverityGaps: 0,
    },
    topGapCategories: [
      { category: 'Vibration Monitoring', count: 2 },
      { category: 'Bearing Inspection',   count: 2 },
    ],
    potentialImpact: {
      estimatedDowntimeReduction: '180 hrs',
      estimatedCostAvoidance: '$55K',
      reliabilityImprovement: 'Medium',
    },
    highSeverityGaps: [
      { asset: 'C-203', category: 'Vibration Monitoring', currentPractice: 'Semi-annual measurement', oemRecommendation: 'Quarterly measurement', potentialImpact: 'Missed vibration anomalies', priority: 'High' },
      { asset: 'C-203', category: 'Bearing Inspection',   currentPractice: 'Quarterly inspection',     oemRecommendation: 'Monthly inspection',     potentialImpact: 'Bearing failure risk',     priority: 'High' },
    ],
    assetGaps: [
      { asset: 'C-203', description: 'Compressor 3', gapCategory: 'Vibration Monitoring', gap: 'Semi-annual vs quarterly OEM', severity: 'High',   status: 'Review Required' },
      { asset: 'C-203', description: 'Compressor 3', gapCategory: 'Bearing Inspection',   gap: 'Quarterly vs monthly OEM',     severity: 'High',   status: 'Review Required' },
    ],
    maintenanceGaps: [
      { category: 'Vibration Monitoring', count: 2, severity: 'High',   assets: ['C-203'] },
      { category: 'Bearing Inspection',   count: 2, severity: 'Medium', assets: ['C-203'] },
    ],
    recommendedActions: [
      { action: 'Increase vibration monitoring frequency for C-203', asset: 'C-203', priority: 'High',   relatedActionId: null },
      { action: 'Update bearing inspection interval to monthly',      asset: 'C-203', priority: 'Medium', relatedActionId: null },
    ],
  },

  // ── 10. Task (Spare Parts) ────────────────────────────────────────────────
  {
    id: '10',
    actionNumber: 'TSK-002',
    title: 'Spare Parts Optimization Tasks',
    description: 'Tasks for optimizing spare parts inventory for critical assets.',
    type: 'Task',
    status: 'In Progress',
    priority: 'Medium',
    assets: 6,
    created: _lastWeek(10, 0),
    source: 'System',
    sourceConversationId: 'conv-003',
    parentActionId: null,
    relatedActions: [],
    metrics: { openTasks: 3, inProgress: 2, completed: 1, highPriority: 2 },
    tasks: [
      { task: 'Audit critical spare parts inventory for P-101',   asset: 'P-101',   priority: 'High',   owner: 'R. Mehta',  status: 'In Progress', created: _lastWeek(10, 0), dueDate: 'Jun 1, 2025' },
      { task: 'Audit critical spare parts inventory for C-203',   asset: 'C-203',   priority: 'High',   owner: 'A. Kumar',  status: 'Open',        created: _lastWeek(10, 0), dueDate: 'Jun 1, 2025' },
      { task: 'Review seal stock levels across all pump assets',   asset: 'Various', priority: 'Medium', owner: 'S. Patel',  status: 'Open',        created: _lastWeek(10, 0), dueDate: 'Jun 5, 2025' },
      { task: 'Order replacement bearings for M-301',             asset: 'M-301',   priority: 'Medium', owner: 'R. Singh',  status: 'In Progress', created: _lastWeek(10, 0), dueDate: 'May 30, 2025' },
      { task: 'Validate spare parts alignment with OEM spec',     asset: 'P-204',   priority: 'Medium', owner: 'R. Mehta',  status: 'Open',        created: _lastWeek(10, 0), dueDate: 'Jun 5, 2025' },
      { task: 'Close spare parts audit for T-101',                asset: 'T-101',   priority: 'Low',    owner: 'A. Kumar',  status: 'Completed',   created: _lastWeek(10, 0), dueDate: 'May 20, 2025' },
    ],
    activity: [
      { text: 'Spare parts audit completed for T-101',                          time: 'Last week, 3:00 PM' },
      { text: 'Bearing order placed for M-301 — awaiting confirmation',         time: 'Last week, 1:30 PM' },
      { text: 'P-101 audit started by R. Mehta',                                time: 'Last week, 11:00 AM' },
    ],
  },

  // ── 11. Investigation (Equipment Failure RCA) ────────────────────────────
  {
    id: '11',
    actionNumber: 'INV-003',
    title: 'Equipment Failure Root Cause Analysis',
    description: 'Deep dive into root causes of recent failures across critical equipment.',
    type: 'Investigation',
    status: 'In Review',
    priority: 'Critical',
    assets: 2,
    created: _daysAgo(2, 9, 45),
    source: 'Chat',
    sourceConversationId: 'conv-004',
    parentActionId: null,
    relatedActions: [],
    metrics: { totalAssets: 2, totalFailures: 20, totalDowntime: '454 hrs', highPriorityAssets: 2 },
    priorityAssets: [
      { asset: 'P-101', description: 'Booster Pump 1', criticality: 'Critical', failures: 12, downtime: '256 hrs', priority: 'High',   reason: 'Recurring seal failures — root cause under investigation' },
      { asset: 'C-203', description: 'Compressor 3',   criticality: 'Critical', failures: 8,  downtime: '198 hrs', priority: 'High',   reason: 'Bearing wear pattern under investigation' },
    ],
    allAssets: [
      { asset: 'P-101', description: 'Booster Pump 1', location: 'Unit 3', criticality: 'Critical', failures: 12, downtime: '256 hrs', lastFailure: 'Apr 28, 2025', currentPM: 'PM-PUMP-001', priority: 'High' },
      { asset: 'C-203', description: 'Compressor 3',   location: 'Unit 1', criticality: 'Critical', failures: 8,  downtime: '198 hrs', lastFailure: 'May 2, 2025',  currentPM: 'PM-COMP-003', priority: 'High' },
    ],
    failurePatterns: [
      { mode: 'Seal leakage',        occurrences: 12, affectedAssets: 1, severity: 'High',   lastOccurrence: 'May 2, 2025',  trend: 'Increasing' },
      { mode: 'Bearing wear',        occurrences: 8,  affectedAssets: 1, severity: 'High',   lastOccurrence: 'Apr 28, 2025', trend: 'Stable' },
    ],
    workOrders: [
      { wo: 'WO-10421', asset: 'P-101', description: 'Seal replacement — root cause analysis', type: 'Corrective', status: 'In Progress', reported: 'Apr 20, 2025', completed: '—',           downtime: '48 hrs' },
      { wo: 'WO-10398', asset: 'C-203', description: 'Bearing inspection and RCA',             type: 'Corrective', status: 'In Progress', reported: 'Apr 10, 2025', completed: '—',           downtime: '36 hrs' },
    ],
    recommendations: [],
  },

  // ── 12. Recommendation (Maintenance Best Practices) ──────────────────────
  {
    id: '12',
    actionNumber: 'REC-002',
    title: 'Maintenance Best Practices Documentation',
    description: 'Documentation of optimized maintenance procedures for reliability improvement.',
    type: 'Recommendation',
    status: 'Accepted',
    priority: 'Low',
    assets: 15,
    created: _daysAgo(3, 15, 20),
    source: 'Chat',
    sourceConversationId: 'conv-004',
    parentActionId: null,
    relatedActions: [],
    metrics: {
      totalRecommendations: 4,
      highPriority: 1,
      mediumPriority: 2,
      reliabilityImpact: 'Medium',
    },
    recommendations: [
      { recommendation: 'Standardize lubrication intervals across all pump assets', assets: 6, priority: 'High',   expectedBenefit: 'Reduce lubrication-related failures',       effort: 'Low',    status: 'Accepted' },
      { recommendation: 'Implement monthly bearing inspection schedule',            assets: 4, priority: 'Medium', expectedBenefit: 'Earlier detection of bearing wear',          effort: 'Low',    status: 'Accepted' },
      { recommendation: 'Update PM task descriptions with step-by-step procedures', assets: 8, priority: 'Medium', expectedBenefit: 'Improve technician consistency',             effort: 'Medium', status: 'Proposed' },
      { recommendation: 'Create a central OEM reference library in Maximo',         assets: 15, priority: 'Low',   expectedBenefit: 'Faster access to maintenance specifications', effort: 'High',   status: 'Proposed' },
    ],
    implementationPlan: [
      { step: 1, action: 'Reliability engineer reviews and approves all recommendations' },
      { step: 2, action: 'Update Maximo job plans with standardized lubrication intervals' },
      { step: 3, action: 'Schedule monthly bearing inspection tasks for all critical assets' },
      { step: 4, action: 'Draft step-by-step PM task procedures for technician reference' },
      { step: 5, action: 'Set up OEM documentation library in Maximo attachments' },
    ],
    impactAreas: [
      { dimension: 'Affected assets',     value: '15 assets across all units' },
      { dimension: 'Failure modes',       value: 'Lubrication issues, bearing wear, inspection gaps' },
      { dimension: 'Criticality',         value: 'Targets all critical and high assets' },
      { dimension: 'Reliability benefit', value: 'Medium — improves consistency and traceability' },
    ],
  },
];

// ── Evidence panel data (reusable side panel) ──────────────────────────────
export const EVIDENCE_DATA = {
  // ── Assets used in chat-created investigation (demo scenarios) ─────────────
  'PUMP-2547': {
    asset: 'PUMP-2547 — Booster Pump 2547',
    gap: 'Maintenance Interval',
    priority: 'High',
    currentMaximo: {
      jobPlan:             'JP-PUMP-2547',
      lubricationInterval: 'Every 6 months',
      source:              'Maximo PM-2547 (BEDFORD / EAGLENA)',
      lastUpdated:         'Jan 2024',
      pmNum:               'PM-2547',
      assetNum:            'PUMP-2547',
      assetType:           'Pump',
      assetStatus:         'Operating',
      site:                'BEDFORD',
      priority:            '2',
      installDate:         'Aug 1, 2022',
      nextDueDate:         'Aug 15, 2026',
    },
    oemRecommendation: {
      lubricationInterval: 'Every 3 months',
      sourceDocument:      'Pump Series X OEM Manual',
      section:             '5.4 Lubrication',
      documentDate:        '2024',
    },
    aiAnalysis: 'PM-2547 (JP-PUMP-2547) lubricates every 6 months, but the OEM specifies every 3 months. This 2× gap is a likely contributor to the 12 bearing failures and 256 hrs downtime recorded on this asset.',
    recommendedAction: 'Update the lubrication interval in JP-PUMP-2547 from 6 months to 3 months to align with OEM Manual section 5.4.',
    confidence: 'High',
    impact: 'Estimated 30% reduction in bearing failures and ~180 hrs/year downtime reduction.',
    maximoUpdates: {
      pmNum: 'PM-2547',
      fields: [
        { label: 'Lubrication Interval', fieldName: 'frequency', current: '6', updated: '3', frequnit: 'MONTHS', source: 'OEM Manual §5.4' },
      ],
    },
  },
  'COMP-1103': {
    asset: 'COMP-1103 — Compressor 1103',
    gap: 'Inspection Frequency',
    priority: 'High',
    currentMaximo: {
      jobPlan: 'JP-COMP-1103',
      inspectionFrequency: 'Every 3 months',
      source: 'Maximo Job Plan',
      lastUpdated: 'Mar 2024',
    },
    oemRecommendation: {
      inspectionFrequency: 'Monthly',
      sourceDocument: 'Compressor OEM Maintenance Guide',
      section: '4.1 Bearings',
      documentDate: '2023',
    },
    aiAnalysis: 'Bearing inspection in JP-COMP-1103 runs quarterly, while the OEM specifies monthly checks. This under-frequency is the probable cause of the 8 failures and 198 hrs downtime observed — recurring seal failures go undetected between quarterly visits.',
    recommendedAction: 'Update JP-COMP-1103 bearing inspection to monthly as per OEM Guide section 4.1.',
    confidence: 'High',
    impact: 'Earlier detection of bearing wear; estimated reduction of recurring seal failures.',
    maximoUpdates: {
      pmNum: 'PM-COMP-1103',
      fields: [
        { label: 'Bearing Inspection Frequency', fieldName: 'frequency', current: '3', updated: '1', frequnit: 'MONTHS', source: 'OEM Guide §4.1' },
      ],
    },
  },
  'PUMP-0392': {
    asset: 'PUMP-0392 — Process Pump 0392',
    gap: 'Maintenance Tasks',
    priority: 'Medium',
    currentMaximo: {
      jobPlan: 'JP-PUMP-0392',
      inspectionFrequency: 'Annual seal replacement',
      source: 'Maximo Job Plan',
      lastUpdated: 'Feb 2024',
    },
    oemRecommendation: {
      inspectionFrequency: 'Every 6 months',
      sourceDocument: 'Pump Series Y OEM Manual',
      section: '6.1 Seals',
      documentDate: '2024',
    },
    aiAnalysis: 'JP-PUMP-0392 replaces seals annually but includes no interim condition check. The OEM recommends inspecting seal condition every 6 months. This gap contributes to the 7 failures and high maintenance recurrence recorded on this asset.',
    recommendedAction: 'Add a 6-monthly seal condition inspection task to JP-PUMP-0392 per OEM Manual section 6.1.',
    confidence: 'High',
    impact: 'Reduced seal failures and lower unplanned maintenance recurrence.',
    maximoUpdates: {
      pmNum: 'PM-PUMP-0392',
      fields: [
        { label: 'Seal Inspection Frequency', fieldName: 'frequency', current: '12', updated: '6', frequnit: 'MONTHS', source: 'OEM Manual §6.1' },
      ],
    },
  },
  'TANK-0051': {
    asset: 'TANK-0051 — Storage Tank 0051',
    gap: 'Inspection Frequency',
    priority: 'Medium',
    currentMaximo: {
      jobPlan: 'JP-TANK-0051',
      inspectionFrequency: 'Quarterly',
      source: 'Maximo Job Plan',
      lastUpdated: 'Apr 2024',
    },
    oemRecommendation: {
      inspectionFrequency: 'Monthly',
      sourceDocument: 'Tank Maintenance & Inspection Guide',
      section: '3.2 Integrity Checks',
      documentDate: '2023',
    },
    aiAnalysis: 'Current quarterly inspection of TANK-0051 is below the OEM-recommended monthly frequency. With 5 failures and 110 hrs downtime linked to repeated alarms and leaks, the inspection gap is likely allowing early-stage leak indications to develop undetected.',
    recommendedAction: 'Update JP-TANK-0051 to perform monthly integrity checks as specified in section 3.2 of the OEM guide.',
    confidence: 'Medium',
    impact: 'Earlier leak detection and reduced alarm-driven downtime.',
    maximoUpdates: {
      pmNum: 'PM-TANK-0051',
      fields: [
        { label: 'Integrity Check Frequency', fieldName: 'frequency', current: '3', updated: '1', frequnit: 'MONTHS', source: 'OEM Guide §3.2' },
      ],
    },
  },
  'MOT-8821': {
    asset: 'MOT-8821 — Motor 8821',
    gap: 'Maintenance Interval',
    priority: 'Low',
    currentMaximo: {
      jobPlan: 'JP-MOT-8821',
      inspectionFrequency: 'Semi-annual bearing temperature check',
      source: 'Maximo Job Plan',
      lastUpdated: 'Jan 2024',
    },
    oemRecommendation: {
      inspectionFrequency: 'Quarterly',
      sourceDocument: 'Motor OEM Service Manual',
      section: '5.1 Bearing Maintenance',
      documentDate: '2022',
    },
    aiAnalysis: 'Bearing temperature checks in JP-MOT-8821 are scheduled semi-annually; the OEM specifies quarterly. The bearing overheating trend (4 failures, 68 hrs downtime) suggests thermal events are occurring between PM cycles and going undetected until corrective action is required.',
    recommendedAction: 'Increase bearing temperature check to quarterly in JP-MOT-8821 per OEM Service Manual section 5.1.',
    confidence: 'Medium',
    impact: 'Earlier detection of bearing overheating; reduction in unplanned downtime.',
    maximoUpdates: {
      pmNum: 'PM-MOT-8821',
      fields: [
        { label: 'Bearing Temp Check Frequency', fieldName: 'frequency', current: '6', updated: '3', frequnit: 'MONTHS', source: 'OEM Service Manual §5.1' },
      ],
    },
  },

  // ── Assets used in static Action Center actions ────────────────────────────
  'P-101': {
    asset: 'P-101 — Booster Pump 1',
    gap: 'Maintenance Interval',
    currentMaximo: {
      jobPlan: 'JP-PUMP-001',
      lubricationInterval: 'Every 6 months',
      source: 'Maximo Job Plan',
      lastUpdated: 'Apr 10, 2025',
    },
    oemRecommendation: {
      lubricationInterval: 'Every 3 months',
      sourceDocument: 'Pump Series X Maintenance Manual',
      section: '5.4 Lubrication',
      documentDate: '2024',
    },
    aiAnalysis: 'Current lubrication interval in Maximo (6 months) is longer than the OEM recommended interval (3 months). This may increase the risk of bearing failures.',
    recommendedAction: 'Review JP-PUMP-001 and update lubrication interval to align with OEM recommendation.',
    confidence: 'High',
    impact: 'Potential increase in bearing failures and unplanned downtime.',
    maximoUpdates: {
      pmNum: 'PM-PUMP-001',
      fields: [
        { label: 'Lubrication Interval', fieldName: 'frequency', current: '6', updated: '3', frequnit: 'MONTHS', source: 'OEM Manual §5.4' },
      ],
    },
  },
  'C-203': {
    asset: 'C-203 — Compressor 3',
    gap: 'Inspection Frequency',
    currentMaximo: {
      jobPlan: 'JP-COMP-003',
      inspectionFrequency: 'Every 3 months',
      source: 'Maximo Job Plan',
      lastUpdated: 'Mar 10, 2025',
    },
    oemRecommendation: {
      inspectionFrequency: 'Monthly',
      sourceDocument: 'Compressor OEM Maintenance Guide',
      section: '4.1 Bearings',
      documentDate: '2023',
    },
    aiAnalysis: 'Current quarterly inspection is less frequent than the OEM monthly recommendation. This could delay detection of bearing wear.',
    recommendedAction: 'Increase bearing inspection frequency to monthly as per OEM guidance.',
    confidence: 'High',
    impact: 'Recurring seal failures and unplanned downtime if not addressed.',
    maximoUpdates: {
      pmNum: 'PM-COMP-003',
      fields: [
        { label: 'Bearing Inspection Frequency', fieldName: 'frequency', current: '3', updated: '1', frequnit: 'MONTHS', source: 'OEM Guide §4.1' },
      ],
    },
  },
};

// ── Session-level evidence cache ─────────────────────────────────────────────
// Starts as a shallow clone of EVIDENCE_DATA. On a successful Maximo update
// the entry is replaced with a version that has maximoUpdates:null and
// currentMaximo fields reflecting the applied values.
const _evidenceCache = { ...EVIDENCE_DATA };

/**
 * Look up evidence for an asset — always reads from the session cache so
 * post-update state is visible without a page reload.
 */
export function getEvidence(assetId) {
  return _evidenceCache[assetId] ?? null;
}

/**
 * Called by EvidencePanel after a successful Maximo PM update.
 * Merges the applied field values into currentMaximo and clears maximoUpdates
 * so the panel shows the "updated" state on next open.
 */
export function applyEvidenceUpdate(assetId, appliedFields) {
  const entry = _evidenceCache[assetId];
  if (!entry) return;

  // Build a patch for currentMaximo from the applied fields
  const patch = {};
  for (const f of appliedFields) {
    if (f.fieldName === 'frequency' && f.frequnit) {
      // Convert raw numbers back to a human-readable interval string
      const unit = f.frequnit.charAt(0).toUpperCase() + f.frequnit.slice(1).toLowerCase();
      patch.lubricationInterval = `Every ${f.updated} ${unit.toLowerCase()}`;
      patch.inspectionFrequency = `Every ${f.updated} ${unit.toLowerCase()}`;
    }
  }

  const now = new Date();
  const lastUpdated = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  _evidenceCache[assetId] = {
    ...entry,
    currentMaximo: {
      ...entry.currentMaximo,
      ...patch,
      lastUpdated,
    },
    maximoUpdates: null,
    aiAnalysis: `PM record updated in Maximo on ${lastUpdated}. Fields aligned with OEM recommendation.`,
  };
}

// ── Work Order panel data ─────────────────────────────────────────────────────
// Keyed by WO number. Reflects Maximo WORKORDER object fields.
export const WORK_ORDER_DATA = {
  'WO-10421': {
    woNum:          'WO-10421',
    description:    'Seal replacement — mechanical seal failure on suction side',
    asset:          'PUMP-2547',
    assetDesc:      'Booster Pump 2547',
    location:       'UNIT-3 / PUMP-BAY-01',
    site:           'SITE-01',
    woType:         'Corrective',
    status:         'Closed',
    priority:       'High',
    reportedBy:     'R. Mehta',
    reportedDate:   'Apr 20, 2025',
    targetStart:    'Apr 21, 2025',
    targetFinish:   'Apr 22, 2025',
    actualStart:    'Apr 21, 2025',
    actualFinish:   'Apr 22, 2025',
    downtime:       '48 hrs',
    parentPM:       'PM-PUMP-2547',
    jobPlan:        'JP-PUMP-2547',
    failureClass:   'MECHANICAL SEAL',
    failureCode:    'SEAL-LEAK',
    cause:          'Lubrication interval exceeded — dry running caused mechanical seal face wear',
    remedy:         'Replaced mechanical seal assembly. Updated PM lubrication frequency to 3 months per OEM recommendation.',
    workLog: [
      { date: 'Apr 20, 2025, 08:30', by: 'R. Mehta',   entry: 'Work order raised. Pump isolated and locked out.' },
      { date: 'Apr 21, 2025, 07:00', by: 'T. Singh',   entry: 'Seal assembly removed. Seal faces confirmed worn beyond tolerance.' },
      { date: 'Apr 21, 2025, 14:00', by: 'T. Singh',   entry: 'New seal kit installed (Part No. SK-PUMP-2547-A). Pressure test passed.' },
      { date: 'Apr 22, 2025, 09:00', by: 'R. Mehta',   entry: 'Pump returned to service. Vibration readings within normal range.' },
    ],
    labour: [
      { craft: 'Mechanical Technician', name: 'T. Singh',  hours: 6 },
      { craft: 'Reliability Engineer',  name: 'R. Mehta',  hours: 2 },
    ],
    materials: [
      { partNum: 'SK-PUMP-2547-A', description: 'Mechanical seal kit',   qty: 1, unit: 'EA' },
      { partNum: 'LUB-ISO-VG46',   description: 'ISO VG 46 grease 1kg',  qty: 2, unit: 'KG' },
    ],
    aiInsight: 'This is the 4th seal replacement on PUMP-2547 in 12 months. Root cause analysis links recurrence to the 6-month lubrication interval exceeding the OEM-recommended 3-month cycle. Closing the job plan gap is expected to reduce seal failures by ~30%.',
  },

  'WO-10398': {
    woNum:          'WO-10398',
    description:    'Bearing inspection — high temperature alarm triggered on drive-end bearing',
    asset:          'COMP-1103',
    assetDesc:      'Compressor 1103',
    location:       'UNIT-1 / COMP-BAY-02',
    site:           'SITE-01',
    woType:         'Corrective',
    status:         'Closed',
    priority:       'High',
    reportedBy:     'A. Kumar',
    reportedDate:   'Apr 10, 2025',
    targetStart:    'Apr 11, 2025',
    targetFinish:   'Apr 12, 2025',
    actualStart:    'Apr 10, 2025',
    actualFinish:   'Apr 12, 2025',
    downtime:       '36 hrs',
    parentPM:       'PM-COMP-1103',
    jobPlan:        'JP-COMP-1103',
    failureClass:   'BEARING',
    failureCode:    'BEARING-WEAR',
    cause:          'Bearing wear due to insufficient inspection frequency — quarterly checks missed early-stage pitting on drive-end bearing inner race',
    remedy:         'Replaced drive-end bearing assembly. Lubricated adjacent bearings. Recommended increase of inspection cadence to monthly.',
    workLog: [
      { date: 'Apr 10, 2025, 11:00', by: 'A. Kumar',   entry: 'High temperature alarm on drive-end bearing. Compressor shut down.' },
      { date: 'Apr 10, 2025, 13:30', by: 'S. Patel',   entry: 'Bearing removed for inspection. Inner race pitting confirmed — failure imminent.' },
      { date: 'Apr 11, 2025, 08:00', by: 'S. Patel',   entry: 'Replacement bearing fitted (Part No. BRG-COMP-1103-DE). Alignment checked.' },
      { date: 'Apr 12, 2025, 10:00', by: 'A. Kumar',   entry: 'Compressor restarted. Temperature and vibration readings normal. WO closed.' },
    ],
    labour: [
      { craft: 'Mechanical Technician', name: 'S. Patel',  hours: 8 },
      { craft: 'Reliability Engineer',  name: 'A. Kumar',  hours: 3 },
    ],
    materials: [
      { partNum: 'BRG-COMP-1103-DE', description: 'Drive-end bearing assembly', qty: 1, unit: 'EA' },
      { partNum: 'LUB-ISO-VG46',     description: 'ISO VG 46 grease 1kg',       qty: 1, unit: 'KG' },
    ],
    aiInsight: 'Bearing wear on COMP-1103 is a recurring pattern — 3 of 8 failures in the last 12 months involved drive-end bearing deterioration. Increasing bearing inspection to monthly per OEM Guide section 4.1 would allow earlier detection of pitting before it reaches a critical stage.',
  },

  'WO-10502': {
    woNum:          'WO-10502',
    description:    'Vibration check — elevated vibration on discharge side, cause under investigation',
    asset:          'PUMP-0392',
    assetDesc:      'Process Pump 0392',
    location:       'UNIT-2 / PUMP-BAY-03',
    site:           'SITE-01',
    woType:         'Corrective',
    status:         'In Progress',
    priority:       'High',
    reportedBy:     'S. Patel',
    reportedDate:   'May 5, 2025',
    targetStart:    'May 6, 2025',
    targetFinish:   'May 9, 2025',
    actualStart:    'May 6, 2025',
    actualFinish:   '—',
    downtime:       '18 hrs',
    parentPM:       'PM-PUMP-0392',
    jobPlan:        'JP-PUMP-0392',
    failureClass:   'VIBRATION',
    failureCode:    'VIB-HIGH',
    cause:          'Under investigation — preliminary inspection suggests possible impeller imbalance or cavitation',
    remedy:         'Pending — vibration analysis report due May 9, 2025',
    workLog: [
      { date: 'May 5, 2025, 14:00',  by: 'S. Patel',   entry: 'Vibration alarm triggered. Discharge side reading 12.4 mm/s — above 8 mm/s threshold.' },
      { date: 'May 6, 2025, 08:00',  by: 'T. Singh',   entry: 'Pump isolated. Initial visual inspection of impeller underway.' },
      { date: 'May 6, 2025, 15:00',  by: 'T. Singh',   entry: 'Impeller appears intact. Collecting vibration spectrum data for analysis.' },
    ],
    labour: [
      { craft: 'Mechanical Technician', name: 'T. Singh',  hours: 10 },
      { craft: 'Reliability Engineer',  name: 'S. Patel',  hours: 4 },
    ],
    materials: [],
    aiInsight: 'PUMP-0392 has had 7 failures in 12 months, making it the third highest priority asset. No vibration check is currently included in JP-PUMP-0392. Adding a quarterly vibration measurement task per OEM guidance could have detected this imbalance trend 6–8 weeks earlier.',
  },

  'WO-10315': {
    woNum:          'WO-10315',
    description:    'Leak investigation — product seepage identified at shell weld seam',
    asset:          'TANK-0051',
    assetDesc:      'Storage Tank 0051',
    location:       'UNIT-4 / TANK-FARM-01',
    site:           'SITE-01',
    woType:         'Corrective',
    status:         'Closed',
    priority:       'High',
    reportedBy:     'R. Singh',
    reportedDate:   'Mar 28, 2025',
    targetStart:    'Mar 29, 2025',
    targetFinish:   'Apr 1, 2025',
    actualStart:    'Mar 29, 2025',
    actualFinish:   'Apr 1, 2025',
    downtime:       '72 hrs',
    parentPM:       'PM-TANK-0051',
    jobPlan:        'JP-TANK-0051',
    failureClass:   'CONTAINMENT',
    failureCode:    'LEAK-WELD',
    cause:          'Weld seam degradation due to thermal cycling — not detected in quarterly inspections as leak was below visibility threshold',
    remedy:         'Weld seam re-welded and hydrostatically tested. Tank integrity confirmed. Inspection frequency increased to monthly as interim measure.',
    workLog: [
      { date: 'Mar 28, 2025, 07:00', by: 'R. Singh',   entry: 'Product seepage reported by operations. Tank contents transferred to standby tank.' },
      { date: 'Mar 29, 2025, 09:00', by: 'T. Singh',   entry: 'Shell weld seam inspected — 180mm crack identified. Ultrasonic thickness testing confirms thinning.' },
      { date: 'Mar 30, 2025, 08:00', by: 'T. Singh',   entry: 'Weld repair in progress. Area prepared and pre-heated.' },
      { date: 'Mar 31, 2025, 16:00', by: 'T. Singh',   entry: 'Weld repair complete. Awaiting hydrostatic test.' },
      { date: 'Apr 1, 2025, 10:00',  by: 'R. Singh',   entry: 'Hydrostatic test passed at 1.5× operating pressure. Tank returned to service.' },
    ],
    labour: [
      { craft: 'Welder',              name: 'T. Singh',  hours: 16 },
      { craft: 'Reliability Engineer', name: 'R. Singh',  hours: 5 },
      { craft: 'NDT Inspector',        name: 'D. Rao',    hours: 4 },
    ],
    materials: [
      { partNum: 'WELD-ROD-E7018',  description: 'Welding rod E7018 (1kg box)',   qty: 2, unit: 'BOX' },
      { partNum: 'SEAL-COAT-HT',    description: 'High-temp sealant coating',     qty: 1, unit: 'LTR' },
    ],
    aiInsight: 'TANK-0051 has had 5 failures in 12 months, all related to containment integrity. The current quarterly inspection frequency is below the OEM-recommended monthly check. More frequent inspection would have detected the weld thinning at an early stage, avoiding the 72-hour production loss.',
  },

  'WO-10488': {
    woNum:          'WO-10488',
    description:    'Bearing temperature check — scheduled PM task per PM-MOT-8821',
    asset:          'MOT-8821',
    assetDesc:      'Motor 8821',
    location:       'UNIT-1 / MOT-BAY-04',
    site:           'SITE-01',
    woType:         'Preventive',
    status:         'Scheduled',
    priority:       'Medium',
    reportedBy:     'System (PM Schedule)',
    reportedDate:   'May 3, 2025',
    targetStart:    'May 12, 2025',
    targetFinish:   'May 12, 2025',
    actualStart:    '—',
    actualFinish:   '—',
    downtime:       '0 hrs',
    parentPM:       'PM-MOT-8821',
    jobPlan:        'JP-MOT-8821',
    failureClass:   null,
    failureCode:    null,
    cause:          null,
    remedy:         null,
    workLog: [
      { date: 'May 3, 2025, 00:00',  by: 'System',     entry: 'Work order auto-generated from PM-MOT-8821 schedule (semi-annual cycle).' },
    ],
    labour: [
      { craft: 'Mechanical Technician', name: 'TBD', hours: 2 },
    ],
    materials: [
      { partNum: 'LUB-ISO-VG46', description: 'ISO VG 46 grease 1kg', qty: 1, unit: 'KG' },
    ],
    aiInsight: 'This is a scheduled PM — however the semi-annual frequency is below the OEM-recommended quarterly bearing temperature check. The bearing overheating trend on MOT-8821 (4 events, 68 hrs downtime) suggests that extending the interval between checks increases the risk of thermal runaway going undetected.',
  },

  // ── Static Action Center WOs (P-101, C-203 asset IDs) ───────────────────
  'WO-10421-P101': {
    woNum:          'WO-10421',
    description:    'Seal replacement — mechanical seal failure on suction side',
    asset:          'P-101',
    assetDesc:      'Booster Pump 1',
    location:       'UNIT-3 / PUMP-BAY-01',
    site:           'SITE-01',
    woType:         'Corrective',
    status:         'Closed',
    priority:       'High',
    reportedBy:     'R. Mehta',
    reportedDate:   'Apr 20, 2025',
    targetStart:    'Apr 21, 2025',
    targetFinish:   'Apr 22, 2025',
    actualStart:    'Apr 21, 2025',
    actualFinish:   'Apr 22, 2025',
    downtime:       '48 hrs',
    parentPM:       'PM-PUMP-001',
    jobPlan:        'JP-PUMP-001',
    failureClass:   'MECHANICAL SEAL',
    failureCode:    'SEAL-LEAK',
    cause:          'Lubrication interval exceeded — dry running caused mechanical seal face wear',
    remedy:         'Replaced mechanical seal assembly. Updated PM lubrication frequency to 3 months per OEM recommendation.',
    workLog: [
      { date: 'Apr 20, 2025, 08:30', by: 'R. Mehta',   entry: 'Work order raised. Pump isolated and locked out.' },
      { date: 'Apr 21, 2025, 07:00', by: 'T. Singh',   entry: 'Seal assembly removed. Seal faces confirmed worn beyond tolerance.' },
      { date: 'Apr 22, 2025, 09:00', by: 'R. Mehta',   entry: 'Pump returned to service. WO closed.' },
    ],
    labour: [
      { craft: 'Mechanical Technician', name: 'T. Singh', hours: 6 },
      { craft: 'Reliability Engineer',  name: 'R. Mehta', hours: 2 },
    ],
    materials: [
      { partNum: 'SK-PUMP-001-A',  description: 'Mechanical seal kit',  qty: 1, unit: 'EA' },
      { partNum: 'LUB-ISO-VG46',   description: 'ISO VG 46 grease 1kg', qty: 2, unit: 'KG' },
    ],
    aiInsight: 'Recurring seal failure on P-101. Lubrication interval gap vs OEM is the likely root cause.',
  },
};
