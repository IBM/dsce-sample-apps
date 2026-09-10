# Implement Action Center Detail Pages

Update the existing **IBM Maximo Knowledge Hub → Action Center** implementation so that clicking an Action Center item opens a full detail page that matches the approved IBM Carbon-style reference.

Do not create a separate application or duplicate Action Center implementation.

The required detail-page types are:

1. Investigation Detail Page
2. Analysis Detail Page
3. Report Detail Page
4. Recommendation Detail Page
5. Task Detail Page
6. Reusable Evidence Side Panel

The implementation should follow this interaction:

**Knowledge Hub Chat → Action Created → Action Center → Click Action → Dynamic Detail Page → Review Evidence → Create/Track Next Action**

---

# 1. Important File Creation Rule

Do not create any additional HTML file for:

- Completion report
- Implementation summary
- Test report
- Demo page
- Screenshot page
- Status report
- Documentation report

Do not create:

- `completion-report.html`
- `implementation-report.html`
- `summary.html`
- `test-report.html`
- `demo.html`

Only modify the application files required for the actual implementation.

At completion, provide only a short text response in Bob describing what was changed and validated.

---

# 2. Preserve Existing Application Shell

All detail pages must open inside the existing application shell.

Keep:

- IBM Maximo Knowledge Hub black global header
- Existing left navigation
- Existing user/profile controls
- Existing page width behavior

Keep **Action Center** selected in the left navigation while viewing any Action Center detail page.

Action Center must remain a top-level navigation item at the same level as Architecture.

Do not move it under Architecture.

---

# 3. Detail Page Routing

Each Action Center record must have an action ID and action type.

Clicking the title should route to a detail view such as:

```text
/action-center/:actionId
```

or the equivalent routing structure used by the current application.

The detail-page renderer must use the action's type to determine which Carbon components and tabs should be displayed.

Do not create a separate hard-coded route for every individual record if a reusable dynamic route can be used.

Example:

```text
action.type = investigation
→ Investigation detail layout

action.type = analysis
→ Analysis detail layout

action.type = report
→ Report detail layout

action.type = recommendation
→ Recommendation detail layout

action.type = task
→ Task detail layout
```

---

# 4. Shared Detail Page Header

All Action Center detail pages should use a consistent header.

Layout:

```text
← Back to Action Center

<Action Title>       <Status Tag>

<Action description>
```

Example:

```text
← Back to Action Center

Critical Asset Failure Investigation    Completed

Identified assets with recurring failures and prioritized them based
on criticality, failure frequency, and downtime.
```

Use Carbon components for:

- Back link
- Title
- Status Tag
- Tabs
- Buttons
- Overflow menu

Do not add controls that do not work.

If Export is functional, show Export.

If Share is not functional, do not display Share.

---

# 5. Page Type 1 — Investigation Detail

For an action such as:

# Critical Asset Failure Investigation

Use these tabs:

```text
Overview
Assets (15)
Failure Patterns
Work Orders
Impact Analysis
Recommendations
```

Default tab:

**Overview**

---

# 6. Investigation Overview

At the top of the Overview tab display compact Carbon metric tiles.

Example:

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

Do not fabricate financial impact.

Only show estimated financial impact if actual source-supported data exists.

---

# 7. Investigation — Top Priority Assets

Below the KPI tiles create:

## Top Priority Assets

Use a Carbon Data Table.

Columns:

```text
Asset
Description
Criticality
Failures
Downtime
Priority
Reason
```

Example data:

| Asset | Description | Criticality | Failures | Downtime | Priority | Reason |
|---|---|---|---:|---:|---|---|
| P-101 | Booster Pump 1 | Critical | 12 | 256 hrs | High | High failure rate & downtime |
| C-203 | Compressor 3 | Critical | 8 | 198 hrs | High | Recurring seal failures |
| P-204 | Process Pump 2 | High | 7 | 142 hrs | Medium | High maintenance recurrence |
| T-101 | Storage Tank 1 | High | 5 | 110 hrs | Medium | Repeated alarms and leaks |
| M-301 | Motor 301 | Medium | 4 | 68 hrs | Low | Bearing overheating |

Asset IDs should be interactive.

Clicking an Asset ID should open the reusable asset/evidence side panel or the existing asset route if one exists.

---

# 8. Investigation — Assets Tab

The Assets tab should contain all assets included in the investigation.

Suggested columns:

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

Allow sorting/filtering using Carbon Data Table functionality.

---

# 9. Investigation — Failure Patterns Tab

Display recurring failure patterns.

Columns:

```text
Failure Mode
Occurrences
Affected Assets
Severity
Last Occurrence
Trend
```

Example:

```text
Seal leakage             12
Bearing overheating       8
High vibration             7
Lubrication issue          5
```

Use a Carbon table.

A simple Carbon-compatible chart may be added only when it improves the analysis.

---

# 10. Investigation — Work Orders Tab

Display relevant Maximo work orders.

Columns:

```text
Work Order
Asset
Description
Type
Status
Reported Date
Completed Date
Downtime
```

Use actual work-order data where available.

Do not invent production work orders.

---

# 11. Investigation — Impact Analysis Tab

Show supported reliability impact information.

Examples:

- Failure frequency
- Total downtime
- Repeated corrective maintenance
- Number of critical assets affected
- Maintenance burden
- Production impact, if source data exists

Do not generate fictional monetary impact.

---

# 12. Investigation — Recommendations Tab

Show Bob-generated recommendations associated with the investigation.

Columns or structured items should include:

```text
Recommendation
Assets
Priority
Reason
Expected Benefit
Evidence
Status
```

Clearly label recommendations as:

**AI-generated recommendation**

Do not present AI-generated recommendations as OEM instructions.

---

# 13. Page Type 2 — Analysis Detail

For an action such as:

# Job Plan vs OEM Analysis

Use tabs:

```text
Overview
Assets (7)
Current Job Plans
OEM Recommendations
Gaps
Evidence
Recommendations
```

Default tab:

**Overview**

---

# 14. Analysis Overview KPIs

Use metric tiles such as:

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

These values should be calculated from the underlying action data.

---

# 15. Analysis — Gap Summary

Below KPI tiles display two compact analysis sections.

## Gap Summary by Category

Examples:

```text
Maintenance Interval
Inspection Frequency
Maintenance Tasks
Lubrication
Other
```

Use an appropriate Carbon-compatible chart or structured list.

## Gap Severity

Examples:

```text
High       4
Medium     3
Low        0
Aligned    8
```

Do not overuse charts.

---

# 16. Analysis — Assets with Identified Gaps

Create a table:

```text
Asset
Description
Criticality
Gap Count
Highest Gap
Status
Priority
```

Example:

| Asset | Description | Criticality | Gap Count | Highest Gap | Status | Priority |
|---|---|---|---:|---|---|---|
| P-101 | Booster Pump 1 | Critical | 2 | Maintenance Interval | Gap Identified | High |
| C-203 | Compressor 3 | Critical | 2 | Inspection Frequency | Review Required | High |
| P-204 | Process Pump 2 | High | 1 | Maintenance Tasks | Review Required | Medium |

Use Carbon tags for Status and Priority.

---

# 17. Analysis — Current Job Plans Tab

Display current Maximo maintenance practices.

Columns:

```text
Asset
Job Plan
Task
Frequency
Current Procedure
Last Updated
```

Where available, allow the Job Plan ID to open its source context.

---

# 18. Analysis — OEM Recommendations Tab

Display retrieved OEM maintenance guidance.

Columns:

```text
Asset
OEM Document
Section
Recommendation
Recommended Frequency
Document Date
Evidence
```

The evidence must be traceable to the source document.

---

# 19. Analysis — Gaps Tab

This is one of the most important pages.

Use a comparison table:

```text
Asset
Current Maximo Practice
OEM Recommendation
Identified Gap
Status
Priority
Evidence
```

Example:

| Asset | Current Maximo Practice | OEM Recommendation | Identified Gap | Status |
|---|---|---|---|---|
| P-101 | Lubricate every 6 months | Lubricate every 3 months | Maintenance interval mismatch | Gap Identified |
| C-203 | Visual inspection quarterly | Inspect monthly | Inspection frequency difference | Review Required |
| P-204 | Replace seal annually | Inspect seal condition every 6 months | Maintenance strategy difference | Review Required |

Do not detect a gap simply because the wording differs.

Use semantic comparison.

---

# 20. Analysis — Evidence Tab

Provide all operational and engineering evidence used by Bob.

Organize by asset.

For each asset show:

```text
Maximo Evidence
OEM Evidence
Bob Analysis
Recommendation
```

Clicking an evidence item should open the reusable Evidence Side Panel.

---

# 21. Page Type 3 — Report Detail

For an action such as:

# Maintenance Gap Report

Use tabs:

```text
Executive Summary
Asset Gaps
Maintenance Gaps
Evidence
Recommended Actions
```

Default:

**Executive Summary**

---

# 22. Report — Executive Summary

The page should visually feel like a generated engineering/reliability report.

Use a two-column Carbon grid.

Left side:

## Report Summary

Show:

- Assets evaluated
- Assets with gaps
- Assets requiring review
- Aligned assets
- Total gaps identified
- High severity gaps
- Medium severity gaps
- Low severity gaps

Right side:

## Top Gap Categories

Examples:

```text
Maintenance Interval
Inspection Frequency
Maintenance Tasks
Lubrication
```

Below this optionally show:

## Potential Impact

Only include supported values such as:

- Estimated downtime reduction
- Number of failures potentially addressed
- Number of PM/job plans requiring review

Avoid unsupported ROI values.

---

# 23. Report — High Severity Gaps

Below the executive summary show:

## High Severity Gaps

Columns:

```text
Asset
Gap Category
Current Practice
OEM Recommendation
Potential Impact
Priority
```

This table should provide an executive-ready view of the most important reliability gaps.

---

# 24. Report — Asset Gaps Tab

Organize all identified gaps by asset.

Allow:

- Sorting
- Filtering
- Evidence access
- Navigation to corresponding analysis

---

# 25. Report — Maintenance Gaps Tab

Group gaps by category.

Examples:

- Maintenance interval
- Inspection interval
- Lubrication
- Replacement policy
- Inspection procedure
- Safety checks
- Condition monitoring

Show count and severity.

---

# 26. Report — Recommended Actions Tab

List the actions produced from the report.

Examples:

```text
Review JP-PUMP-001
Review inspection frequency for C-203
Add seal condition inspection for P-204
Validate lubrication procedure for M-301
```

Allow the user to navigate to the corresponding Recommendation or Task action.

---

# 27. Page Type 4 — Recommendation Detail

For an action such as:

# High-Priority Reliability Recommendations

Use tabs:

```text
Overview
Recommendations (6)
Impact
Implementation Plan
Evidence
```

Default:

**Overview**

---

# 28. Recommendation Overview KPIs

Use:

```text
6
Total Recommendations

4
High Priority

2
Medium Priority

High
Overall Reliability Impact
```

The last metric may instead be another numeric metric if available.

---

# 29. Recommendation Table

Show:

```text
Recommendation
Assets
Priority
Expected Benefit
Effort
Status
```

Example:

| Recommendation | Assets | Priority | Expected Benefit | Effort | Status |
|---|---:|---|---|---|---|
| Align lubrication interval with OEM recommendation | 2 | High | Reduce lubrication-related failures | Medium | Proposed |
| Increase inspection frequency for critical components | 2 | High | Earlier detection of failures | Low | Proposed |
| Add seal condition check to PM tasks | 1 | High | Early detection of seal wear | Low | Proposed |
| Standardize PM tasks with OEM best practices | 3 | Medium | Improve maintenance consistency | Medium | Proposed |

Use Carbon tags.

---

# 30. Recommendation Status

Use lifecycle:

```text
Proposed
Accepted
Rejected
Implemented
```

Bob must never automatically mark recommendations as Accepted or Implemented.

Human approval is required.

---

# 31. Recommendation — Impact Tab

Show why the recommendation matters.

Possible dimensions:

- Affected assets
- Failure modes addressed
- Downtime exposure
- Maintenance effort
- Criticality
- Reliability benefit

Use supported operational data.

---

# 32. Recommendation — Implementation Plan Tab

Provide a practical proposed implementation path.

Example:

```text
1. Reliability Engineer reviews recommendation
2. Validate OEM evidence
3. Review affected Maximo Job Plan
4. Obtain engineering approval
5. Modify job plan using existing change-control process
6. Validate change
7. Close recommendation
```

This is a recommendation workflow, not automatic Maximo modification unless explicit automation exists.

---

# 33. Page Type 5 — Task Detail

For an action such as:

# Job Plan Review Tasks

Use tabs:

```text
Overview
Open Tasks (4)
In Progress (1)
Completed (0)
Evidence
```

Default:

**Overview**

---

# 34. Task Overview KPIs

Display:

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

Calculate from actual task records.

---

# 35. Open Tasks Table

Use:

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

| Task | Asset | Priority | Owner | Status | Created | Due Date |
|---|---|---|---|---|---|---|
| Review lubrication interval for P-101 | P-101 | High | R. Mehta | Open | Today 12:01 PM | May 25 |
| Review inspection frequency for C-203 | C-203 | High | A. Kumar | Open | Today 12:01 PM | May 25 |
| Add seal condition check to P-204 | P-204 | High | S. Patel | Open | Today 12:01 PM | May 25 |

Only show owners when ownership data exists.

---

# 36. Task Summary

Below the task table, optionally show:

## Task Summary by Priority

and:

## Recent Activity

Example activity:

```text
Task created: Review lubrication interval for P-101
Task created: Review inspection frequency for C-203
Task status changed: Review seal condition for P-204
```

Use Carbon Structured List or Activity-style presentation.

---

# 37. Reusable Evidence Side Panel

Implement one reusable Carbon SidePanel for evidence.

This side panel should work from Investigation, Analysis, Report, Recommendation, and Task pages.

Example:

# Evidence

## Current Maximo Practice

**Asset:** P-101 — Booster Pump 1

**Job Plan:** JP-PUMP-001

**Lubrication interval:** Every 6 months

**Source:** Maximo Job Plan

**Last updated:** Apr 10, 2025

---

## OEM Recommendation

**Lubrication interval:** Every 3 months

**Source document:** Pump Series X Maintenance Manual

**Section:** 5.4 Lubrication

**Document date:** 2024

---

## AI Analysis

**Gap identified**

Current Maximo lubrication interval is longer than the retrieved OEM recommendation.

This may increase the risk of bearing wear or lubrication-related failure.

---

## Recommended Action

Review JP-PUMP-001 with the Reliability Engineer and validate the OEM recommendation before changing the production job plan.

Primary action:

**Create Task**

Only show Create Task if task creation is actually implemented.

---

# 38. Evidence Classification

Every piece of evidence must be visually classified as one of:

```text
Operational Data
Engineering Knowledge
AI Analysis
Recommended Action
```

Do not mix them into a single generated paragraph.

Users must be able to distinguish facts from AI interpretation.

---

# 39. Related Actions

Every detail page should include a compact **Related Actions** section where relevant.

Example:

```text
Created from
Critical Asset Failure Investigation

Follow-up Analysis
Job Plan vs OEM Analysis

Generated Report
Maintenance Gap Report

Generated Recommendations
High-Priority Reliability Recommendations

Generated Tasks
Job Plan Review Tasks
```

Each item should be clickable.

This provides lineage across the Bob-generated workflow.

---

# 40. Source Conversation

Every Bob-generated action should retain its originating conversation.

Display:

**View source conversation**

where supported.

The action should store:

- Conversation ID
- User prompt
- Creation timestamp
- Source action if generated from another action

---

# 41. Data Model

The detail-page implementation should support an action structure similar to:

```text
Action
- id
- title
- description
- type
- status
- priority
- createdAt
- source
- sourceConversationId
- parentActionId
- affectedAssets[]
- metrics{}
- evidence[]
- recommendations[]
- tasks[]
```

Type-specific data can be stored separately.

Example:

```text
InvestigationAction
- failurePatterns[]
- workOrders[]
- impactAnalysis{}

AnalysisAction
- currentJobPlans[]
- oemRecommendations[]
- gaps[]

ReportAction
- summary{}
- gapCategories[]
- recommendedActions[]

RecommendationAction
- recommendations[]
- implementationPlan[]

TaskAction
- tasks[]
- activity[]
```

Reuse the application's existing data model where possible.

Do not rewrite working APIs unnecessarily.

---

# 42. Dynamic UI Requirement

The system should not rely on one static detail layout for all action types.

Use a shared detail-page shell, then dynamically render action-specific components.

Example:

```text
<ActionDetailShell>
    Header
    Status
    Tabs

    if investigation:
        InvestigationDetail

    if analysis:
        AnalysisDetail

    if report:
        ReportDetail

    if recommendation:
        RecommendationDetail

    if task:
        TaskDetail
</ActionDetailShell>
```

Reuse Carbon components across page types.

---

# 43. Carbon Design Requirements

Follow IBM Carbon styling closely.

Use:

- IBM Plex Sans
- Carbon Grid
- Carbon Tabs
- Carbon Data Table
- Carbon Tiles
- Carbon Tag
- Carbon SidePanel
- Carbon OverflowMenu
- Carbon Breadcrumb / Link
- Carbon Button
- Carbon Skeleton
- Carbon InlineNotification
- Carbon Structured List
- Carbon Charts where appropriate

Use IBM blue primarily for:

- Links
- Active navigation
- Active tabs
- Primary actions

Do not use IBM blue for every status and priority.

---

# 44. Desktop Layout

Target the application's current desktop experience.

At 1600–1900 px widths:

- Keep the left navigation unchanged.
- Keep detail content within the main workspace.
- Use the full available width.
- KPI tiles should appear in one row where possible.
- Tables should not be artificially narrow.
- Avoid large unused blank areas.
- Avoid horizontal scrolling unless a table genuinely requires it.

---

# 45. Required End-to-End Demo Flow

The UI must support this sequence.

## Step 1

User asks Bob:

> Show me assets with recurring failures and prioritize the critical ones.

Bob creates:

**Critical Asset Failure Investigation**

User clicks it.

→ Investigation Detail Page opens.

---

## Step 2

User asks:

> Now compare the maintenance job plans for these assets with the OEM manuals.

Bob creates:

**Job Plan vs OEM Analysis**

User clicks it.

→ Analysis Detail Page opens.

---

## Step 3

User asks:

> Generate a report of the significant gaps.

Bob creates:

**Maintenance Gap Report**

User clicks it.

→ Report Detail Page opens.

---

## Step 4

User asks:

> Recommend what we should do for the high-priority gaps.

Bob creates:

**High-Priority Reliability Recommendations**

User clicks it.

→ Recommendation Detail Page opens.

---

## Step 5

User asks:

> Create review tasks for the high-priority recommendations.

Bob creates:

**Job Plan Review Tasks**

User clicks it.

→ Task Detail Page opens.

---

# 46. Acceptance Criteria

Implementation is complete only when:

- Clicking Investigation opens the Investigation Detail Page.
- Clicking Analysis opens the Analysis Detail Page.
- Clicking Report opens the Report Detail Page.
- Clicking Recommendation opens the Recommendation Detail Page.
- Clicking Task opens the Task Detail Page.
- Each type has its own tabs and relevant content.
- KPIs render correctly.
- Tables contain meaningful data.
- Back to Action Center works.
- Action Center remains selected in navigation.
- Evidence Side Panel works from relevant records.
- Evidence clearly separates Maximo, OEM, AI analysis, and recommendations.
- Related Actions are linked.
- Source conversation traceability is preserved.
- No duplicate Action Center is created.
- No completion-report HTML file is generated.
- Existing application routes continue to work.

---

# 47. Final Completion Instruction

Do not generate an implementation-report HTML page.

Do not generate a completion-report HTML page.

Do not generate additional documentation files unless explicitly requested.

After implementing and validating the pages, return only a short Bob response such as:

**Implemented dynamic Action Center detail pages for Investigation, Analysis, Report, Recommendation, and Task actions using the existing Carbon-based application shell. Added action-specific tabs, KPIs, tables, evidence side panel, related-action lineage, and Action Center routing. Validated navigation and action detail rendering.**