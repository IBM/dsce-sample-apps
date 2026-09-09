# SPEC-008 — Frontend: Action Center

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Design System:** IBM Carbon Design System v11 (`@carbon/react`)

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | All AI-generated investigations, analyses, reports, recommendations, and tasks must persist in a single Action Center workspace visible to Reliability Engineers. |
| BR-002 | Each Action Center item must have a dedicated full-page detail view accessible via a unique URL route (`/action-center/:actionId`). |
| BR-003 | Detail pages must compose dynamically based on the action type (Investigation, Analysis, Report, Recommendation, Task) rather than using a single generic layout. |
| BR-004 | Evidence and explainability must be presented for every identified gap or finding via a slide-out side panel. |
| BR-005 | Users must be able to create reliability tasks directly from an analysis detail page; those tasks must appear in Action Center → Tasks. |
| BR-006 | All detail pages must maintain the application shell (global header + left navigation with Action Center highlighted). |
| BR-007 | Full traceability must be maintained: Chat → Investigation → Analysis → Report → Task. |
| BR-008 | Action lifecycle states must be enforced; human validation is required before any recommendation is marked as accepted or implemented. |

---

## 2. Action Center Main Page

**Route:** `/action-center`  
**Navigation:** Left nav → Action Center (top-level, same level as Architecture)

### 2.1 Page Header

```
Action Center
Manage and track AI-generated investigations, analyses, reports, recommendations, and tasks.
```

### 2.2 Tabs

Use IBM Carbon `Tabs` component:

```
All  |  Investigations  |  Analyses  |  Reports  |  Recommendations  |  Tasks
```

### 2.3 Toolbar

Above the data table, provide:
- Carbon `Search` — filter by title or asset
- Carbon `Dropdown` — Status filter (All, Draft, Running, Completed, In Review, Open, In Progress, Closed)
- Carbon `Dropdown` — Priority filter (All, Critical, High, Medium, Low)
- Carbon `Button` (secondary) — Sort options

### 2.4 Data Table

Use IBM Carbon `DataTable` with `TableToolbar`, `TableHead`, `TableRow`, `TableCell`.

**Columns:**

| Column | Description |
|--------|-------------|
| Title | Clickable — navigates to detail page |
| Type | `Tag`: Investigation (blue) / Analysis (teal) / Report (purple) / Recommendation (green) / Task (magenta) |
| Status | `Tag`: Running (blue) / Completed (green) / In Review (yellow) / Open (blue) / Closed (gray) |
| Priority | `Tag`: Critical (red) / High (orange) / Medium (yellow) / Low (gray) |
| Assets | Integer count |
| Created | Date/time (relative: "2 hours ago") |
| Source | Chat / System / User |
| Actions | Carbon `OverflowMenu`: View, Edit, Delete, Change Status |

**Example rows:**

| Title | Type | Status | Priority | Assets | Created |
|-------|------|--------|----------|--------|---------|
| Critical Asset Failure Investigation | Investigation | Completed | High | 15 | 2h ago |
| Job Plan vs OEM Analysis | Analysis | In Review | High | 7 | 1h ago |
| Maintenance Gap Report | Report | Completed | High | 7 | 45m ago |
| Job Plan Review Tasks | Task | Open | High | 4 | 30m ago |

### 2.5 Empty State

When no actions exist:
```
No actions yet.
Start by asking Bob a question in the Knowledge Hub.
[Go to Knowledge Hub]
```

---

## 3. Action Center Detail Routing

```
/action-center                     → Action Center list (inside application shell)
/action-center/:actionId           → Dynamic detail page (inside same application shell)
```

The detail renderer reads `action.type` and renders the appropriate layout:

```
action.type = "investigation"   → InvestigationDetail layout
action.type = "analysis"        → AnalysisDetail layout
action.type = "report"          → ReportDetail layout
action.type = "recommendation"  → RecommendationDetail layout
action.type = "task"            → TaskDetail layout
```

**Action Center must remain selected in the left navigation on all `/action-center/*` routes.**

---

## 4. Shared ActionDetailShell Component

All detail pages share a common outer shell:

```
← Back to Action Center

<Action Title>                    <Status Tag> <Priority Tag>

<Action description text>

<Metadata row: Type · Assets · Created · Source>

<Action-type specific Tabs>
─────────────────────────────────────────────────
<Action-type specific tab content>
```

**Carbon components used:**
- `Link` with `ArrowLeft16` icon for back navigation
- `Heading` (Carbon type: `productive-heading-04`) for title
- `Tag` for status and priority
- `Tabs`, `TabList`, `Tab`, `TabPanels`, `TabPanel` for tab navigation
- `Button` (primary/secondary) for action buttons

---

## 5. Investigation Detail Page

**Tabs:**
```
Overview | Assets (15) | Failure Patterns | Work Orders | Impact Analysis | Recommendations
```

**Overview tab — KPI tiles:**

Use Carbon `Tile` in a 4-column grid:

| Tile | Value |
|------|-------|
| Total Assets | 15 |
| Total Failures | 78 |
| Total Downtime | 1,240 hrs |
| High-Priority Assets | 5 |

Do not display estimated financial impact unless backed by source data.

**Overview tab — Top Priority Assets table:**

Carbon `DataTable`:

| Asset | Description | Criticality | Failures | Downtime | Priority | Reason |
|-------|-------------|-------------|----------|----------|----------|--------|
| P-101 | Booster Pump 1 | Critical | 12 | 256 hrs | High | High failure rate and downtime |
| C-203 | Compressor 3 | Critical | 8 | 198 hrs | High | Recurring seal failures |

Clicking an asset row opens the Evidence Side Panel for that asset.

**Assets tab:** Full asset table with all 15 prioritized assets, filterable/sortable.

**Failure Patterns tab:** Aggregated failure code analysis with Carbon `DataTable`.

**Work Orders tab:** Related work orders from Maximo, linked to the failure analysis.

**Impact Analysis tab:** Carbon `StructuredList` — downtime analysis and criticality matrix.

**Recommendations tab:** AI-generated reliability recommendations, each with status and evidence link.

---

## 6. Analysis Detail Page (Job Plan vs OEM Analysis)

**Tabs:**
```
Overview | Assets (7) | Current Job Plans | OEM Recommendations | Gaps | Evidence
```

**Overview tab — KPI tiles:**

| Tile | Value |
|------|-------|
| Assets Analyzed | 7 |
| Gaps Identified | 4 |
| Review Required | 3 |
| Aligned | 0 |

**Gaps tab — Gap Status Table:**

Each row uses a colored `Tag` for status:

| Status | Description | Carbon Tag Color |
|--------|-------------|-----------------|
| Aligned | Current practice is consistent with OEM guidance | green |
| Review Required | Potential difference — requires validation | yellow |
| Gap Identified | Meaningful difference between practice and OEM | red |

**Gap table columns:**

| Asset | Criticality | Current Interval | OEM Interval | Gap | Severity | Evidence |
|-------|-------------|-----------------|-------------|-----|----------|---------|
| P-101 | Critical | 6 months | 3 months | Lubrication frequency | High | [View →] |

Clicking "View →" opens the Evidence Side Panel for that gap.

---

## 7. Report Detail Page (Maintenance Gap Report)

**Tabs:**
```
Executive Summary | Asset Gaps | Maintenance Gaps | Recommended Actions
```

**Executive Summary tab:**

3-column layout:
- **Report Summary** — key findings prose (Carbon `StructuredList`)
- **Top Gap Categories** — ranked table
- **Potential Impact** — risk assessment

**High Severity Gaps table:**

Carbon `DataTable` with columns: Asset, Gap Category, Severity, Recommended Action, Status.

---

## 8. Recommendation Detail Page

**Tabs:**
```
Overview | Implementation Plan | Impact
```

**Overview tab — KPI tiles:**

| Tile | Value |
|------|-------|
| Total Recommendations | 12 |
| Critical Priority | 4 |
| High Priority | 6 |
| Implementation Rate | 0% |

**Recommendation table columns:**

| Recommendation | Asset | Priority | Status | Evidence |
|----------------|-------|----------|--------|---------|

**Status options:** Proposed / Accepted / Rejected / Implemented  
Human action required to change from Proposed — Bob must not auto-accept.

---

## 9. Task Detail Page

**Tabs:**
```
Overview | Open Tasks (4) | Task Distribution | Recent Activity
```

**Overview tab — KPI tiles:**

| Tile | Value |
|------|-------|
| Total Tasks | 4 |
| Open | 4 |
| In Progress | 0 |
| Completed | 0 |

**Open Tasks table columns:**

| Task | Asset | Priority | Owner | Status | Due Date | Evidence |
|------|-------|----------|-------|--------|---------|---------|
| Review Job Plan — P-101 | P-101 | High | — | Open | — | [View →] |

**Task Status lifecycle:** Open → In Progress → Completed → Closed

---

## 10. Evidence Side Panel

The `EvidencePanel` is a shared IBM Carbon side panel that opens when the user clicks "View Evidence" on any gap, asset, or finding.

**Panel Width:** 480px (33% of viewport, not full-screen)

**Panel Structure:**

```
[Close ×]

Evidence: P-101 — Lubrication Gap
Asset P-101 · Gap Identified · High Priority
──────────────────────────────────────────

OPERATIONAL DATA
─────────────────
Current Maximo Job Plan:  6-month lubrication interval
Last Completed:           3 months ago
Failure Code:             SEAL-WEAR
Work Orders (last 12m):   12 (4 unplanned)
Total Downtime:           256 hrs

ENGINEERING KNOWLEDGE
─────────────────────
Source: P-101 OEM Maintenance Manual v2.1 — Section 4.2
OEM Recommendation: Lubrication every 90 days (3 months)
"Pump shaft bearings require lubrication at 90-day intervals
under normal operating conditions..."

AI ANALYSIS
────────────
The current 6-month interval is double the OEM-specified
90-day requirement. Given the high failure rate and
significant downtime recorded, the extended interval is a
plausible contributing factor.

Confidence: High | Sources: 2 documents, 12 work orders

RECOMMENDED ACTION
──────────────────
Reduce lubrication frequency to every 90 days.
Update Job Plan PM-P101-LUB to reflect new interval.

[Create Task]
```

**Evidence categories — Carbon components:**

| Category | Carbon Treatment |
|----------|-----------------|
| Operational Data | `StructuredList` with `StructuredListRow` items |
| Engineering Knowledge | `Blockquote` or `StructuredList` with source citation `Link` |
| AI Analysis | `StructuredList` with `Tag` for confidence level |
| Recommended Action | `StructuredList` + primary `Button` for "Create Task" |

**Rules:**
- Never present AI-generated analysis as OEM requirements.
- Confidence level (`Tag`: High / Medium / Low) must appear next to all AI Analysis sections.
- Source documents must be linked (file name + page reference).
- "Create Task" button opens a Carbon `Modal` with pre-filled task fields.

---

## 11. Create Task Modal

Triggered from Evidence Side Panel "Create Task" button or Analysis page "Create Tasks" button.

**Modal fields (Carbon `Form`):**

| Field | Type | Pre-filled |
|-------|------|-----------|
| Task Title | `TextInput` | "Review Job Plan — P-101" |
| Asset | `TextInput` (read-only) | P-101 |
| Priority | `Dropdown` | High |
| Current Practice | `TextArea` (read-only) | 6-month lubrication |
| OEM Recommendation | `TextArea` (read-only) | Every 90 days |
| Gap Description | `TextArea` | Pre-filled from AI analysis |
| Recommended Change | `TextArea` | Pre-filled from AI analysis |
| Owner | `Dropdown` | — |
| Due Date | `DatePicker` | — |

**On submit:** POST to `/api/actions` with `type: "task"` — task appears in Action Center → Tasks tab.

---

## 12. Action Lifecycle

| Type | States | Carbon Tag Colors |
|------|--------|-------------------|
| Investigation | Running → Completed → In Review → Closed | blue → green → yellow → gray |
| Analysis | Running → Completed → In Review → Closed | blue → green → yellow → gray |
| Report | Draft → Completed → Closed | gray → green → gray |
| Recommendation | Proposed → Accepted → Rejected → Implemented | blue → green → red → teal |
| Task | Open → In Progress → Completed → Closed | blue → yellow → green → gray |

---

## 13. Demo Journey

The primary demonstration scenario that all Action Center detail pages must support:

1. **User asks:** "Show me assets with recurring failures in the last 6 months" → creates **Critical Asset Failure Investigation**
2. **User asks:** "Compare these against their OEM manuals" → creates **Job Plan vs OEM Analysis** (linked to investigation)
3. **User asks:** "Show me the significant gaps" → creates **Maintenance Gap Report** (linked to analysis)
4. **User asks:** "Create review tasks for the high-priority gaps" → creates **Job Plan Review Tasks** (linked to report)

Each artifact is traceable to the previous via `parent_action_id`.

---

## 14. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-001 | Action Center list shows all AI-generated artifacts in a Carbon `DataTable` with correct columns, tabs, and filters. |
| AC-002 | Clicking an action title navigates to `/action-center/:actionId` without leaving the application shell. |
| AC-003 | The global header and left navigation (with Action Center highlighted) remain visible on all detail pages. |
| AC-004 | Investigation detail renders the correct 6 tabs with Overview KPI tiles and Top Priority Assets table. |
| AC-005 | Analysis detail renders the Gap table with correct status tags (Aligned, Review Required, Gap Identified). |
| AC-006 | Clicking "View Evidence" opens the Evidence Side Panel on the right at 480px width. |
| AC-007 | Evidence Side Panel correctly separates Operational Data, Engineering Knowledge, AI Analysis, and Recommended Action sections. |
| AC-008 | "Create Task" from the Evidence Side Panel opens a pre-filled Modal and creates a task in the Action Center on submission. |
| AC-009 | Report detail renders Executive Summary, Top Gap Categories, and High Severity Gaps table with data. |
| AC-010 | Task detail renders Open Tasks table with correct lifecycle status options (Open / In Progress / Completed / Closed). |
| AC-011 | Recommendation status cannot be changed to Accepted/Implemented without explicit user action (no auto-accept). |
| AC-012 | Traceability links are visible: each detail page shows which parent action it originated from. |
