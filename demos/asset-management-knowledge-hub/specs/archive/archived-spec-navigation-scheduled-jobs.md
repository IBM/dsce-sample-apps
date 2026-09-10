# Objective

Update the IBM Maximo Knowledge Hub left navigation to use clear logical groupings and add support for recurring/background jobs.

Before making UI changes, **use the Bob skill named `ibm-deign`** and follow its IBM Carbon design guidance.

## Navigation Structure

Group the existing menu items as follows:

### Workspace
- Knowledge Hub
- Action Center

### Data & Integration
- Data Ingestion

### Automation & Scheduling
- Scheduled Jobs

### Governance & Monitoring
- Audit Log
- Statistics

### Platform
- Architecture

### Configuration
- Settings

## Navigation Design

- Use IBM Carbon side-navigation patterns.
- Group labels should be visually subtle and non-clickable.
- Use compact spacing between groups.
- Do not add heavy separators or large headings.
- Keep the currently selected page clearly highlighted using Carbon navigation styling.

## Scheduled Jobs Page

Create a new **Scheduled Jobs** page for recurring/background workloads such as:

- Nightly Maximo synchronization
- OEM knowledge refresh
- Search/index refresh
- Recurring reliability analysis
- Scheduled report generation
- Cleanup/maintenance jobs

Use tabs:

- All
- Scheduled
- Running
- Completed
- Failed

Use a Carbon Data Table with:

- Job Name
- Type
- Schedule
- Last Run
- Next Run
- Status
- Duration
- Actions

Use readable schedule descriptions such as:

- Daily at 1:00 AM
- Every 6 hours
- Weekly on Sunday

Do not expose raw cron expressions as the primary UI value.

## Important

Use the existing application shell and Carbon components.

Do not create any additional HTML completion report, implementation report, or demo page. Only modify the actual application files and provide a short text summary when complete.