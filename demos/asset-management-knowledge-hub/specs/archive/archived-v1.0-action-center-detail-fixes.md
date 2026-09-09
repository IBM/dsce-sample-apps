# Fix the Existing Action Center Detail Pages

Fix the current Action Center detail-page implementation based on the screenshots.

Do **not** rebuild the application and do **not** create another Action Center implementation.

The current implementation has two categories of problems:

1. **Shared layout / Carbon styling is not consistently applied across action types.**
2. **Several pages are rendering incorrect or empty data, especially Report and Task pages.**

The Investigation page is much closer to the required experience and should become the baseline/shared shell for all other detail pages.

---

# 1. Critical Architecture Fix — All Detail Pages Must Use the Same Application Shell

The Action Center detail pages currently appear to be rendered outside the normal Maximo Knowledge Hub application shell.

This is incorrect.

Every detail route must remain inside the existing application layout:

```text
IBM Maximo Knowledge Hub global header
|
+-- Left navigation
|   Knowledge Hub
|   Data Ingestion
|   Settings
|   Audit Log
|   Statistics
|   Architecture
|   Action Center  <-- remains selected
|
+-- Main content
    Action Detail Page
```

Do not render `/action-center/:id` as a standalone full-browser page.

It must use the same parent layout component as the Action Center list.

If routing is nested, make the detail route a child of the existing application layout.

Expected behavior:

```text
/action-center
→ Action Center list inside application shell

/action-center/:actionId
→ Action detail inside exactly the same application shell
```

The black global header and dark left navigation must remain visible.

---

# 2. Create One Shared `ActionDetailShell`

Do not independently style Investigation, Analysis, Report, Recommendation and Task pages.

Create or reuse a shared component conceptually equivalent to:

```text
ActionDetailShell
├── Back link
├── Action title
├── Status / Priority
├── Description
├── Metadata
├── Action-specific tabs
└── Action-specific page content
```

Then render:

```text
InvestigationDetail
AnalysisDetail
ReportDetail
RecommendationDetail
TaskDetail
```

inside this shell.

This is important because the screenshots show:

* Investigation = reasonably formatted
* Report = badly formatted
* Task = badly formatted

This indicates Report and Task are not using the same design system/component structure.

Fix the shared structure rather than adding more page-specific CSS hacks.

---

# 3. Shared Detail Header — Exact Structure

Every detail page must start like this:

```text
← Back to Action Center

Critical Asset Failure Investigation        [Completed] [High]

Identified 15 assets with recurring failures and prioritized them
based on criticality, failure frequency, and downtime.

Created: Today, 10:24 AM     Source: Chat
```

Use Carbon typography.

### Header requirements

* Back link uses IBM blue.
* Title uses a normal enterprise heading size.
* Do not use oversized hero typography.
* Description appears under title.
* Status and priority appear on the same header level or aligned on the right.
* Created/Source metadata appears as secondary text.
* Keep consistent vertical spacing.

The Report and Task screenshots currently have titles that are much too large.

For example:

**Maintenance Gap Report**

and

**Job Plan Review Tasks**

must use the same title size as:

**Critical Asset Failure Investigation**

Do not use a separate large hero heading for Report/Task.

---

# 4. Fix Breadcrumb / Back Navigation

The current display:

```text
Action Center ← / Investigation
```

is awkward.

Replace it with:

```text
← Back to Action Center
```

Optionally show action type as subtle metadata elsewhere.

Do not display both a back arrow and slash breadcrumb unless using a real Carbon Breadcrumb component.

Preferred:

**← Back to Action Center**

---

# 5. Fix Detail Tabs

The Investigation screenshot currently shows the selected **Assets** tab inside a blue rectangular border.

That is not the required Carbon tab treatment.

Use Carbon tabs consistently:

```text
Overview
Assets (15)
Failure Patterns
Work Orders
Impact Analysis
Recommendations
```

Selected tab:

* Blue underline
* Dark/bold text
* No blue rectangle around the whole tab

The same style must be applied to every action type.

---

# 6. Investigation Page — Fix Existing Issues

The Investigation page is the closest to correct.

Do not rewrite it.

Fix these specific issues.

## KPI tiles

Current KPIs:

```text
15 Total Assets
78 Total Failures
1,240 hrs Total Downtime
5 High Priority Assets
5 Failure Modes
```

Use **4 tiles per row** to match the approved reference and Carbon grid better.

Recommended first row:

```text
15
Total Assets

78
Total Failures

1,240 hrs
Total Downtime

5
High-Priority Assets
```

Failure Modes can appear in Failure Patterns or a second metric row if needed.

Do not overcrowd the header with five equally sized metrics.

---

# 7. Investigation — Add Missing Reason Column

The current Top Priority Assets table is missing an important field from the reference.

Required:

```text
Asset
Description
Criticality
Failures
Downtime
Priority
Reason
```

Examples:

```text
P-101 | Booster Pump 1 | Critical | 12 | 256 hrs | High |
High failure frequency and downtime

C-203 | Compressor 3 | Critical | 8 | 198 hrs | High |
Recurring seal failures
```

The **Reason** explains why Bob prioritized the asset.

This is important for AI explainability.

---

# 8. Investigation — Fix Assets Count

The Investigation header says:

```text
15 Total Assets
```

but the Assets tab currently says:

```text
All Assets (5)
```

This is inconsistent.

If the investigation contains 15 assets:

```text
Assets (15)
```

and:

```text
All Assets (15)
```

must represent 15 records.

If only 5 are shown because of pagination, show:

```text
1–5 of 15 assets
```

Do not change the total asset count to 5 simply because only five sample rows are visible.

---

# 9. Investigation — Assets Tab

Keep the current table structure because it is reasonably good:

```text
Asset
Description
Location
Criticality
Failures
Downtime
Last Failure
Current PM
Priority
```

But:

* Add correct pagination.
* Ensure there are 15 records or the correct investigation total.
* Use Carbon Tag for Priority.
* Asset ID remains an IBM blue link.
* Clicking asset opens its evidence/details side panel.

---

# 10. Fix Related Actions Styling

The current Related Actions section should not look like large empty boxes or raw text blocks.

Use a compact Carbon Structured List.

Example:

```text
RELATED ACTIONS

Analysis
Job Plan vs OEM Analysis
7 assets require review                         →

Report
Maintenance Gap Report
4 significant maintenance gaps                 →

Recommendation
High-Priority Reliability Recommendations
6 recommendations                              →

Tasks
Job Plan Review Tasks
4 open tasks                                    →
```

Each related action must be clickable.

Avoid huge cards.

---

# 11. REPORT PAGE IS CURRENTLY BROKEN

The current **Maintenance Gap Report** screenshot is not acceptable.

Current problems visible in the screenshot:

* Title is oversized.
* Header does not use the shared layout.
* KPI values appear as raw text vertically.
* `Assets Reported 0` conflicts with existing gaps.
* `Assets Analyzed: 0` conflicts with `Total Gaps Found: 8`.
* `Risk Index 0` appears without explanation.
* Report Summary is not structured.
* Key Findings is empty.
* Related Actions are raw text.
* Huge unused whitespace.
* No Carbon Data Tables.
* No Carbon Tiles.
* No clear page grid.

Fix the Report page completely using the shared Action Detail Shell.

---

# 12. Report Detail — Required Header

Render:

```text
← Back to Action Center

Maintenance Gap Report              [Completed] [Medium]

Detailed report covering identified maintenance gaps with
supporting engineering evidence and impact assessment.

Created: Today, 11:30 AM     Source: Chat
```

Then tabs:

```text
Executive Summary
Asset Gaps (7)
Maintenance Gaps (10)
Evidence
Recommended Actions
```

Do not display raw statistics above the tabs.

---

# 13. Report — Executive Summary Layout

The approved layout should use a proper Carbon grid.

First row:

```text
┌─────────────────────────────┐  ┌──────────────────────────┐
│ Report Summary              │  │ Top Gap Categories       │
│                             │  │                          │
│ Assets evaluated       15   │  │ Maintenance Interval  4 │
│ Assets with gaps        7   │  │ Inspection Frequency 3 │
│ Gaps identified        10   │  │ Maintenance Tasks     2 │
│ Aligned assets          8   │  │ Lubrication           1 │
│ High severity gaps      4   │  │                          │
│ Medium severity gaps    3   │  │ [simple visualization] │
└─────────────────────────────┘  └──────────────────────────┘
```

If the data differs, calculate it from the action dataset.

Do not hard-code `0`.

---

# 14. Remove Meaningless Report Metrics

Do not display:

```text
Risk Index 0
Reliability Impact 0%
Assets Reported 0
```

unless those values are genuinely calculated and meaningful.

If data does not exist, omit that metric.

Never show placeholder zero metrics that contradict other information.

---

# 15. Report — High Severity Gaps Table

Under Executive Summary add:

## High Severity Gaps

Carbon Data Table:

```text
Asset
Gap Category
Current Practice
OEM Recommendation
Potential Impact
Priority
```

Example:

```text
P-101
Maintenance Interval
Lubricate every 6 months
Lubricate every 3 months
Potential lubrication-related reliability exposure
High
```

This should occupy the page width and visually anchor the report.

---

# 16. Report — Key Findings

Do not render an empty:

```text
Key Findings
```

section.

Either populate it or omit it.

Example:

```text
Key Findings

• 7 of 15 analyzed assets require engineering review.
• Maintenance interval is the most common gap category.
• 4 gaps are classified as high priority.
• P-101 and C-203 account for the highest-priority differences.
```

Use Carbon Structured List or concise content blocks.

---

# 17. TASK PAGE IS CURRENTLY BROKEN

The current **Job Plan Review Tasks** page is also not acceptable.

Visible issues include:

* Huge title.
* Title and description appear on one line.
* `Total Tasks 0`.
* `Open 0`.
* `In Progress 0`.
* `Completed 0`.
* Yet this action is supposed to contain review tasks.
* KPI metrics are rendered as plain vertical text.
* `High0 Medium0 Low0` is raw text.
* No task table.
* No proper Carbon components.
* Huge empty whitespace.
* Related Actions appear as raw text.
* Tab overflow arrow appears unnecessarily.
* Activity has been added as a tab even though the approved reference uses Evidence.

Fix this page using the shared shell.

---

# 18. Task Detail — Required Header

Render:

```text
← Back to Action Center

Job Plan Review Tasks                    [Open] [High]

Reliability engineering review tasks generated from confirmed
maintenance gaps.

Created: Today, 12:01 PM     Source: Chat
```

Tabs:

```text
Overview
Open Tasks (4)
In Progress (1)
Completed (0)
Evidence
```

All tabs should fit on desktop.

Do not show a horizontal overflow arrow at normal desktop resolution.

---

# 19. Task Overview — KPI Tiles

Use 4 Carbon metric tiles:

```text
4
Open Tasks

1
In Progress

0
Completed

3
High Priority
```

Do NOT render these as:

```text
Total Tasks
0
Open
0
...
```

The values must come from the task array.

---

# 20. Fix Task Data

The Action Center item represents actual generated reliability tasks.

Ensure the data model contains task records.

Example demo records:

```text
Review lubrication interval for P-101
Asset: P-101
Priority: High
Owner: R. Mehta
Status: Open

Review inspection frequency for C-203
Asset: C-203
Priority: High
Owner: A. Kumar
Status: Open

Add seal condition check to P-204
Asset: P-204
Priority: High
Owner: S. Patel
Status: Open

Update job plan for T-101
Asset: T-101
Priority: Medium
Owner: R. Singh
Status: Open

Validate maintenance interval for M-301
Asset: M-301
Priority: Medium
Status: In Progress
```

If owners do not exist in the data source, omit Owner rather than inventing one.

---

# 21. Task Overview — Open Tasks Table

Immediately below the KPI tiles add:

## Open Tasks

Columns:

```text
Task
Asset
Priority
Owner
Status
Created
Due Date
```

Example:

```text
Review lubrication interval for P-101
P-101
High
R. Mehta
Open
Today, 12:01 PM
May 25
```

Task name should be clickable.

Use Carbon Tags for:

* Priority
* Status

---

# 22. Task Distribution

Do not display:

```text
High0
Medium0
Low0
```

as plain text.

Use either:

* Carbon Donut Chart, or
* Carbon structured statistics

Example:

```text
Task Summary by Priority

High      3
Medium    2
Low       0
```

If chart libraries are already available, use a compact donut chart similar to the approved reference.

Do not introduce a new heavy chart dependency only for this.

---

# 23. Recent Activity

On the Task Overview page, create a compact:

## Recent Activity

Example:

```text
Task created
Review lubrication interval for P-101
Today, 12:01 PM

Task created
Review inspection frequency for C-203
Today, 12:01 PM

Status changed
Validate maintenance interval for M-301 → In Progress
Today, 1:15 PM
```

Use Carbon Structured List.

Do not make Activity a top-level tab unless required.

---

# 24. Analysis Detail Must Follow the Same Shell

Although not shown in these screenshots, verify the existing:

**Job Plan vs OEM Analysis**

page uses the same structure.

Header:

```text
Job Plan vs OEM Analysis            [In Review] [High]
```

Tabs:

```text
Overview
Assets (7)
Current Job Plans
OEM Recommendations
Gaps
Evidence
Recommendations
```

Overview tiles:

```text
15
Assets Evaluated

7
Require Review

4
Gaps Identified

8
Aligned
```

---

# 25. Recommendation Detail Must Follow the Same Shell

Verify:

**High-Priority Reliability Recommendations**

Header:

```text
High-Priority Reliability Recommendations     [Proposed]
```

Tabs:

```text
Overview
Recommendations (6)
Impact
Implementation Plan
Evidence
```

Metrics:

```text
6
Total Recommendations

4
High Priority

2
Medium Priority

7
Affected Assets
```

---

# 26. Data Consistency Is Mandatory

Several current pages have contradictory metrics.

Create a single action object as the source of truth.

For example:

```text
Critical Asset Failure Investigation

affectedAssets.length = 15
totalFailures = 78
totalDowntime = 1240
highPriorityAssets = 5
```

Then derive every UI count from this object.

Do not independently hard-code:

* tab counts
* table counts
* KPI counts
* pagination counts

They must derive from the same source data.

---

# 27. Same Rule for Analysis

Example:

```text
assetsEvaluated = 15
gaps = 4
reviewRequired = 7
aligned = 8
```

Ensure:

```text
Aligned + Require Review
```

logically corresponds with the evaluated asset dataset where appropriate.

Do not show unrelated hard-coded numbers.

---

# 28. Same Rule for Report

The report must derive from analysis.

Example lineage:

```text
Investigation
15 assets

        ↓

Analysis
15 evaluated
7 require review
4 significant gaps

        ↓

Report
15 evaluated
7 assets requiring review
4 high-priority gaps
```

The report must not suddenly display:

```text
Assets Analyzed = 0
```

---

# 29. Same Rule for Tasks

Tasks must derive from recommendations/gaps.

Example:

```text
4 open tasks
1 in progress
0 completed
```

Then:

```text
Total Tasks = 5
```

not zero.

Calculate:

```text
totalTasks =
openTasks.length +
inProgressTasks.length +
completedTasks.length
```

Do not hard-code counters.

---

# 30. Use Empty States Instead of Fake Zeros

If a dataset genuinely has no records:

Do not display a broken dashboard containing ten zeros.

Use a Carbon Empty State such as:

```text
No tasks created yet

Tasks generated from reliability recommendations
will appear here.
```

Similarly:

```text
No maintenance gaps identified
```

is better than displaying:

```text
Maintenance Gaps 0
Risk Index 0
Reliability Impact 0%
```

---

# 31. Required Page Grid

Every Overview page should approximately follow:

```text
┌──────────────────────────────────────────────────────┐
│ Back / Header / Status / Description                 │
├──────────────────────────────────────────────────────┤
│ Tabs                                                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│ KPI 1       KPI 2       KPI 3       KPI 4           │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Primary analysis/table                               │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Supporting analysis / activity / evidence            │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Related Actions                                      │
└──────────────────────────────────────────────────────┘
```

Do not create long areas of blank grey background.

---

# 32. Carbon Spacing

Apply the same spacing consistently to all page types.

Suggested layout behavior:

* Main content horizontal padding: 32 px
* Header vertical padding: approximately 24–32 px
* 24 px between primary content sections
* 16 px between closely related components
* KPI tile heights consistent
* Tables aligned to the same content grid

Use Carbon spacing tokens rather than arbitrary values where the existing project supports them.

---

# 33. Typography

Current Report and Task titles are too large.

Use approximately:

```text
Page title → Carbon heading-05 / equivalent
Section title → heading-03 / heading-04
Table title → productive heading
Metadata → body compact / helper text
```

Do not use giant 50–60 px page titles.

This is an enterprise application, not a marketing page.

---

# 34. Color Usage

Use IBM blue for:

* Links
* Active tabs
* Back navigation
* Primary functional actions

Use semantic colors for:

* Completed
* Open
* High
* Medium
* Low
* Review Required

Do not rely solely on color.

Tags must always contain labels.

---

# 35. Evidence Side Panel

Clicking:

* an asset,
* Evidence,
* a gap,
* or a relevant recommendation

should be able to open a Carbon SidePanel.

Example:

```text
Evidence

P-101 — Booster Pump 1

CURRENT MAXIMO PRACTICE
Job Plan: JP-PUMP-001
Lubrication: Every 6 months

OEM RECOMMENDATION
Lubrication: Every 3 months
Source: Pump Series X Maintenance Manual
Section: 5.4 Lubrication

AI ANALYSIS
Gap Identified
Current interval exceeds OEM recommendation.

RECOMMENDED ACTION
Review JP-PUMP-001 with reliability engineering.
```

Keep these four concepts visually separated:

```text
Operational Data
Engineering Knowledge
AI Analysis
Recommended Action
```

---

# 36. Specific Investigation Acceptance Criteria

Investigation is fixed when:

* Application shell remains visible.
* Action Center remains selected.
* Back link works.
* Title is correctly sized.
* Carbon tabs use underline selection.
* Assets tab says `Assets (15)`.
* Top Priority Assets includes Reason.
* Assets list represents all 15 assets or paginates correctly.
* KPI values and table counts are consistent.
* Related Actions use structured Carbon layout.

---

# 37. Specific Report Acceptance Criteria

Report is fixed when:

* It visually uses the same shell as Investigation.
* There is no oversized title.
* No raw metric text appears.
* No contradictory zero values appear.
* Executive Summary uses Carbon grid/cards.
* Gap categories are visualized cleanly.
* High Severity Gaps table exists.
* Key Findings is populated or removed.
* Related Actions are styled consistently.
* No excessive empty whitespace remains.

---

# 38. Specific Task Acceptance Criteria

Task is fixed when:

* It visually uses the same shell as Investigation.
* Title and description are properly separated.
* KPI tiles display actual task counts.
* Open Tasks table is populated.
* Task Priority summary is formatted.
* Recent Activity is formatted.
* No raw `High0 Medium0 Low0` text exists.
* No unnecessary tab overflow arrow exists.
* Related Actions are styled consistently.
* Task counts derive from task records.

---

# 39. Fix the Root Cause, Not Just CSS

Before changing visual details, inspect why:

* Investigation renders properly,
* Report does not,
* Task does not.

Likely areas to verify:

* Different page components bypassing Carbon components
* Missing shared wrapper
* Missing stylesheet/module import
* Incorrect action-type renderer
* Different layout route
* Data shape mismatch
* Type-specific components receiving undefined arrays
* Default values becoming zero
* Report and Task renderers using raw HTML elements instead of shared components

Fix these root causes.

Do not solve the problem by adding many one-off CSS rules.

---

# 40. Do Not Create Additional HTML Reports

Do not create:

* completion report HTML
* implementation report HTML
* test report HTML
* screenshot HTML
* standalone demo HTML
* duplicate Action Center HTML

Modify only the existing application implementation.

After completion, respond only with a concise textual summary of changes and validation.
