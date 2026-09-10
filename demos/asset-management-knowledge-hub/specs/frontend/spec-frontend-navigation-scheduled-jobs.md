# SPEC-009 — Frontend: Navigation Grouping and Scheduled Jobs

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Design System:** IBM Carbon Design System v11 (`@carbon/react`)

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | The application left navigation must be organized into clear logical groups to reduce cognitive load for Reliability Engineers. |
| BR-002 | A new Scheduled Jobs page must allow operators to view, monitor, and manage recurring background jobs (synchronization, indexing, analysis). |
| BR-003 | Navigation groups must be subtle and non-clickable — they are visual organizers, not navigation targets. |
| BR-004 | The currently active page must always be clearly highlighted using IBM Carbon navigation styling. |
| BR-005 | Scheduled Jobs must display human-readable schedule descriptions rather than raw cron expressions. |

---

## 2. Navigation Structure

Use IBM Carbon `SideNav` with `SideNavItems` and custom group label dividers.

### 2.1 Navigation Groups

```
┌─────────────────────────┐
│  Workspace              │  ← group label (non-clickable, subtle)
│    Knowledge Hub        │
│    Action Center        │
│                         │
│  Data & Integration     │  ← group label
│    Data Ingestion       │
│                         │
│  Automation & Scheduling│  ← group label
│    Scheduled Jobs       │
│                         │
│  Governance & Monitoring│  ← group label
│    Audit Log            │
│    Statistics           │
│                         │
│  Platform               │  ← group label
│    Architecture         │
│                         │
│  Configuration          │  ← group label
│    Settings             │
└─────────────────────────┘
```

### 2.2 Design Rules

- Group labels: `$text-secondary` color, 11px `productive-heading-01` or equivalent Caption style, uppercase, non-clickable, `padding-top: $spacing-05`.
- No heavy separators or large headings between groups — subtle padding difference is sufficient.
- Active page: Carbon `isActive` + `$link-primary` highlight.
- Hover state: Carbon default `SideNavLink` hover behavior.
- No icons per nav item unless Carbon provides them by default (keep it clean).

---

## 3. Scheduled Jobs Page

**Route:** `/scheduled-jobs`  
**Navigation group:** Automation & Scheduling

### 3.1 Page Header

```
Scheduled Jobs
Manage recurring background workloads including synchronization, indexing, and analysis jobs.
```

### 3.2 Tabs

Use IBM Carbon `Tabs`:

```
All  |  Scheduled  |  Running  |  Completed  |  Failed
```

Tab counts update dynamically (e.g., `Running (2)`).

### 3.3 Data Table

Use IBM Carbon `DataTable` with `TableToolbar`.

**Columns:**

| Column | Type | Description |
|--------|------|-------------|
| Job Name | `Link` | Clickable for job detail |
| Type | `Tag` | Sync / Index / Analysis / Report / Cleanup |
| Schedule | Text | Human-readable: "Daily at 1:00 AM" |
| Last Run | Date/time | Relative: "Yesterday at 1:04 AM" |
| Next Run | Date/time | Absolute or relative |
| Status | `Tag` | Scheduled / Running / Completed / Failed / Disabled |
| Duration | Text | e.g. "4 min 32 sec" |
| Actions | `OverflowMenu` | Run Now, Disable, Edit Schedule, View Logs |

### 3.4 Schedule Display Format

**Rule:** Do not expose raw cron expressions as the primary UI value.

| Raw Cron | Human-Readable Display |
|----------|----------------------|
| `0 1 * * *` | Daily at 1:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 2 * * 0` | Weekly on Sunday at 2:00 AM |
| `0 3 1 * *` | Monthly on the 1st at 3:00 AM |
| `*/15 * * * *` | Every 15 minutes |

Optional: Show the cron expression in a tooltip (`Tooltip` component) for advanced users.

### 3.5 Job Types

| Job Name | Type | Default Schedule | Description |
|----------|------|-----------------|-------------|
| Nightly Maximo Synchronization | Sync | Daily at 1:00 AM | Sync Maximo assets, WOs, and PMs to local cache |
| OEM Knowledge Refresh | Index | Weekly on Sunday | Re-crawl OEM documentation sources |
| Search Index Refresh | Index | Every 6 hours | Refresh OpenSearch index with new documents |
| Recurring Reliability Analysis | Analysis | Daily at 3:00 AM | Run proactive failure pattern analysis |
| Scheduled Report Generation | Report | Weekly on Monday | Generate weekly maintenance gap summary |
| Cleanup / Maintenance | Cleanup | Monthly on 1st | Purge old audit log entries and temp data |

### 3.6 Status Tags

| Status | Carbon Tag Color |
|--------|-----------------|
| Scheduled | blue |
| Running | green (+ spinner icon) |
| Completed | green |
| Failed | red |
| Disabled | gray |

### 3.7 Toolbar

- Carbon `Search` — filter jobs by name
- Carbon `Dropdown` — filter by type
- Carbon `Button` (primary) — "Add Job" (opens `Modal` with job form)

### 3.8 Job Detail Slide-Out or Modal

Clicking a job name opens a Carbon `Modal` or side panel with:
- Job configuration (name, type, schedule)
- Last run details (start time, end time, duration, records processed)
- Run history (last 10 runs as a table)
- View Logs button (opens log modal)

### 3.9 "Run Now" Confirmation

Carbon `Modal` (danger variant):
```
Run "Nightly Maximo Synchronization" now?

This will execute the job immediately in addition to its next scheduled run.

[Cancel]  [Run Now]
```

---

## 4. Empty States

### Scheduled Jobs — no jobs configured:
```
No scheduled jobs configured.
Add your first job to automate recurring workloads.
[Add Job]
```

### Scheduled Jobs — Running tab, nothing running:
```
No jobs are currently running.
```

---

## 5. Action Center "New" Indicator

When Bob creates a new Action Center entry, display a small badge on the Action Center navigation item:

```
Action Center    ●
```

Use a small filled circle (`$support-success` green, 8px) to indicate new unreviewed items. Clear on navigation to Action Center.

---

## 6. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-001 | The left navigation displays all items organized under the correct group labels with no items missing or misplaced. |
| AC-002 | Group labels are non-clickable, visually subtle, and do not change their appearance on hover. |
| AC-003 | The active navigation item is highlighted using IBM Carbon `isActive` styling on every page. |
| AC-004 | The Scheduled Jobs page renders with Carbon `Tabs` (All / Scheduled / Running / Completed / Failed). |
| AC-005 | The Scheduled Jobs `DataTable` displays Job Name, Type, Schedule, Last Run, Next Run, Status, Duration, Actions columns. |
| AC-006 | Schedule column shows human-readable descriptions ("Daily at 1:00 AM") and never shows raw cron strings as primary text. |
| AC-007 | Status tags use correct Carbon tag colors: blue for Scheduled, green for Running/Completed, red for Failed, gray for Disabled. |
| AC-008 | "Run Now" overflow menu action triggers a Carbon `Modal` confirmation dialog before executing. |
| AC-009 | The Scheduled Jobs page uses the existing application shell — no standalone rendering. |
| AC-010 | An "Add Job" button in the toolbar opens a Carbon `Modal` with a form for creating new scheduled jobs. |
