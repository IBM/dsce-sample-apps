# Refine the Evidence Side Panel Using IBM Carbon Design

Update the existing **Evidence Side Panel** in the IBM Maximo Knowledge Hub Action Center.

Do not rebuild it as a separate page.

Do not create any additional HTML file.

Do not create:

- completion reports
- implementation reports
- demo HTML
- screenshot HTML
- standalone evidence pages

Only modify the existing application implementation.

The current information architecture is correct, but the visual design is too large, too card-heavy, and too form-like.

The target is a compact, professional **IBM Carbon enterprise evidence inspector**.

---

# 1. Use IBM Carbon Side Panel Pattern

Implement this as a true Carbon-style side panel.

The side panel should:

- Slide in from the right.
- Keep the underlying Action Detail page visible.
- Use a fixed/sticky panel header.
- Use a vertically scrollable content area.
- Use a sticky footer only when an action such as `Create task` is available.

Do not render the evidence view as a standalone route.

---

# 2. Panel Width

For desktop, use approximately:

**480–560 px**

or the appropriate Carbon side-panel width supported by the existing component library.

The current content should not feel stretched.

At larger desktop widths, avoid making the panel wider than necessary.

---

# 3. Simplify the Header

Current header is visually too large.

Use:

```text
Evidence                                      X

P-101 · Booster Pump 1
Maintenance Interval
```

Recommended hierarchy:

### Primary heading
**Evidence**

### Secondary context
**P-101 · Booster Pump 1**

### Tertiary context
**Maintenance Interval**

Do not put all context into one long subtitle.

---

# 4. Close Button

Use the standard Carbon icon button for Close.

Do not use an oversized custom square button.

The close button should:

- Use Carbon `Close` icon
- Be approximately standard Carbon icon-button size
- Have a tooltip/accessible label such as `Close evidence`
- Align with the Evidence heading

It should not visually dominate the panel.

---

# 5. Typography

Reduce the typography significantly.

The current labels and values are too large.

Use Carbon productive typography.

Recommended hierarchy:

- Panel title → Carbon heading
- Section title → productive heading
- Field labels → label/helper typography
- Field values → body-01/body-compact
- Supporting metadata → helper text

Do not use large all-caps field labels.

---

# 6. Compact Spacing

The current evidence blocks use too much vertical padding.

Use Carbon spacing tokens consistently.

Recommended:

- 24 px between major sections
- 16 px between related groups
- 8 px between label and value
- Compact row spacing for field/value pairs

The user should be able to see:

1. Current Maximo Practice
2. OEM Recommendation
3. AI Analysis

within a reasonable amount of vertical scrolling.

---

# 7. Use Four Clearly Separated Evidence Categories

Maintain four distinct categories:

1. **Operational Data**
2. **Engineering Knowledge**
3. **AI Analysis**
4. **Recommended Action**

This distinction is important for explainability.

Do not merge these into one generated paragraph.

---

# 8. Operational Data Section

Render:

```text
Operational Data
Current Maximo Practice
────────────────────────────

Asset
P-101 · Booster Pump 1

Job plan
JP-PUMP-001

Lubrication interval
Every 6 months

Source
Maximo Job Plan

Last updated
Apr 10, 2025
```

Do not put every field inside a large card.

Use either:

- Carbon Structured List
- compact two-column label/value layout
- simple stacked field/value groups

Prefer a compact Carbon Structured List where possible.

---

# 9. Engineering Knowledge Section

Render:

```text
Engineering Knowledge
OEM Recommendation
────────────────────────────

Lubrication interval
Every 3 months

Source document
Pump Series X Maintenance Manual

Section
5.4 Lubrication

Document date
2024
```

The source document should be clickable when source-document navigation is supported.

Use IBM blue only for links.

---

# 10. Reduce Category Badge Dominance

The current category labels:

- OPERATIONAL DATA
- ENGINEERING KNOWLEDGE
- AI ANALYSIS

are visually too dominant.

Replace the large colored blocks with smaller Carbon Tag-style classification labels.

Example:

`Operational data`

`Engineering knowledge`

`AI analysis`

`Recommended action`

Use subtle semantic styling.

Do not use large colored banners.

---

# 11. Section Heading Pattern

Use the same pattern for every section:

```text
[Operational data]
Current Maximo Practice
```

and:

```text
[Engineering knowledge]
OEM Recommendation
```

and:

```text
[AI analysis]
Gap Analysis
```

The classification tag should be small.

The actual section heading should carry the hierarchy.

---

# 12. AI Analysis Section

The current AI Analysis section is incomplete.

Do not show only:

```text
Status
Gap Identified

Priority
High
```

Add the actual analysis.

Recommended:

```text
AI Analysis
Gap Analysis

[Gap identified] [High]

The current Maximo job plan schedules lubrication
every 6 months, while the retrieved OEM maintenance
manual recommends every 3 months.

This creates a potential maintenance interval gap
that should be reviewed by reliability engineering.
```

Clearly indicate this is Bob's analysis.

Do not phrase it as an OEM statement.

---

# 13. Status and Priority

Do not display Status and Priority as large orange horizontal bars.

Use Carbon Tags.

Example:

```text
[Gap identified]  [High]
```

The text must be readable without relying on color.

Use semantic Carbon tag variants.

---

# 14. Recommended Action Section

Add a dedicated fourth section:

```text
Recommended Action

Review JP-PUMP-001 with reliability engineering
and validate the OEM recommendation before changing
the production Maximo job plan.
```

Optional metadata:

```text
Suggested next step
Engineering review

Affected object
JP-PUMP-001
```

Do not mix this with AI Analysis.

---

# 15. Evidence Flow

The visual order must always be:

```text
Operational Data

↓

Engineering Knowledge

↓

AI Analysis

↓

Recommended Action
```

This makes the reasoning easy to understand:

**What do we do today?**

→ **What does the engineering source recommend?**

→ **What difference did Bob identify?**

→ **What should the reliability team do next?**

---

# 16. Recommended Carbon Layout

Target something close to this:

```text
┌──────────────────────────────────────┐
│ Evidence                         X   │
│ P-101 · Booster Pump 1               │
│ Maintenance Interval                 │
├──────────────────────────────────────┤
│                                      │
│ [Operational data]                   │
│ Current Maximo Practice              │
│ ───────────────────────────────────  │
│                                      │
│ Asset                                │
│ P-101 · Booster Pump 1               │
│                                      │
│ Job plan                             │
│ JP-PUMP-001                          │
│                                      │
│ Lubrication interval                 │
│ Every 6 months                       │
│                                      │
│ Source                               │
│ Maximo Job Plan                      │
│                                      │
│ Last updated                         │
│ Apr 10, 2025                         │
│                                      │
│ [Engineering knowledge]             │
│ OEM Recommendation                   │
│ ───────────────────────────────────  │
│                                      │
│ Lubrication interval                 │
│ Every 3 months                       │
│                                      │
│ Source document                      │
│ Pump Series X Maintenance Manual     │
│                                      │
│ Section                              │
│ 5.4 Lubrication                      │
│                                      │
│ [AI analysis]                        │
│ Gap Analysis                         │
│ ───────────────────────────────────  │
│                                      │
│ [Gap identified] [High]             │
│                                      │
│ Current Maximo interval is longer    │
│ than the retrieved OEM recommendation│
│ and should be reviewed.              │
│                                      │
│ [Recommended action]                │
│ Review JP-PUMP-001 with reliability  │
│ engineering before modification.     │
│                                      │
├──────────────────────────────────────┤
│                         Create task  │
└──────────────────────────────────────┘
```

Use real Carbon components rather than literal ASCII layout.

---

# 17. Remove Heavy Card Borders

The current side panel places each category inside a large bordered rectangle.

Reduce this.

Use:

- subtle section separators
- whitespace
- Carbon Structured List borders
- light background only where necessary

Do not wrap every evidence category in a large card.

The page should feel lighter and denser.

---

# 18. Background

Use the normal Carbon layer/background hierarchy.

Suggested approach:

- Side panel background: normal Carbon layer
- Section content: same layer or subtle secondary layer
- Do not use different colored backgrounds for every section
- Use tags and typography to differentiate evidence type

---

# 19. Sticky Header

The Evidence header must remain visible while scrolling.

Sticky header:

```text
Evidence                        X
P-101 · Booster Pump 1
Maintenance Interval
```

Add a subtle divider below it.

---

# 20. Sticky Footer

Keep the footer visible only if the panel has a valid actionable next step.

If task creation is supported, use a sticky footer.

Do not use the current giant full-width blue button.

Recommended Carbon footer:

```text
                           Create task
```

Use a standard Carbon primary button aligned to the right.

Optionally:

```text
Close                      Create task
```

but only if Close provides useful behavior beyond the X icon.

---

# 21. Create Task Button

Use the normal Carbon primary-button size.

Do not:

- stretch it across the entire width
- make it unusually tall
- make the footer visually dominate the evidence

The evidence is the main content.

`Create task` is the next action, not the primary visual focus.

---

# 22. Create Task Behavior

When the user clicks:

**Create task**

the new task should automatically carry context from the evidence:

```text
Asset
P-101

Job plan
JP-PUMP-001

Gap
Maintenance interval mismatch

Current practice
Every 6 months

OEM recommendation
Every 3 months

Priority
High

Source action
Job Plan vs OEM Analysis
```

Do not make the user manually re-enter information already known by Bob.

---

# 23. Link Source Data

Where supported:

**JP-PUMP-001**

should be clickable.

**Pump Series X Maintenance Manual**

should be clickable.

Use IBM blue for these links.

Do not make ordinary field values blue.

---

# 24. Evidence Traceability

Include source identifiers where available.

For Operational Data:

```text
Source system
IBM Maximo

Object
Job Plan

Record
JP-PUMP-001
```

For Engineering Knowledge:

```text
Source
OEM Maintenance Manual

Document
Pump Series X Maintenance Manual

Section
5.4 Lubrication
```

Avoid unnecessary identifiers if they add no user value.

---

# 25. Recommended AI Analysis Language

AI analysis should be concise.

Example:

```text
The current Maximo lubrication interval is 6 months.

The retrieved OEM maintenance manual recommends
lubrication every 3 months.

Bob identified a potential interval gap of 3 months.

Reliability engineering review is recommended before
modifying the production job plan.
```

Do not generate long generic AI explanations.

---

# 26. Confidence

If the application has a meaningful evidence-confidence value, optionally display:

```text
Evidence confidence
High
```

Do not invent a confidence score.

Do not use arbitrary percentages unless confidence is genuinely calculated.

---

# 27. Accessibility

Follow Carbon accessibility patterns.

Ensure:

- Close button has accessible label
- Tags are readable without color
- Links are keyboard accessible
- Side panel traps focus correctly if implemented as modal overlay
- Escape closes the panel where appropriate
- Scroll content does not hide keyboard focus
- Text contrast meets Carbon standards

---

# 28. Responsive Behavior

Desktop is the primary target.

For desktop:

- Panel approximately 480–560 px
- Sticky header
- Sticky footer
- Scrollable body

For smaller screens:

- Allow the side panel to occupy most/full width
- Maintain the same information hierarchy
- Do not collapse Operational/OEM/AI sections into unreadable accordions unless necessary

---

# 29. Do Not Add Unnecessary Icons

Do not add icons beside every field.

Use icons only where they add semantic value.

The evidence panel should remain clean and technical.

---

# 30. Do Not Use Consumer Card Styling

Avoid:

- rounded cards everywhere
- shadows around each block
- colorful badge-heavy layouts
- large hero text
- decorative graphics
- gradients

This must look like IBM Maximo / IBM Carbon enterprise software.

---

# 31. Apply This Component Everywhere

The Evidence Side Panel should be reusable from:

- Investigation
- Analysis
- Report
- Recommendation
- Task

Do not build five separate evidence components.

Create/reuse one shared Evidence Panel component and pass the appropriate evidence data.

---

# 32. Required Evidence Component Model

The reusable component should conceptually receive:

```text
EvidencePanel
- title
- asset
- topic
- operationalData
- engineeringKnowledge
- aiAnalysis
- recommendedAction
- priority
- status
- sourceAction
- canCreateTask
```

Reuse the application's existing data model if available.

Do not duplicate data models unnecessarily.

---

# 33. Final Acceptance Criteria

The Evidence Side Panel is complete only when:

- It follows Carbon Side Panel styling.
- The close button is compact.
- Typography is reduced.
- The panel is visually denser.
- Large colored section banners are removed.
- Evidence categories use subtle Carbon Tags.
- Operational Data is clearly separated.
- Engineering Knowledge is clearly separated.
- AI Analysis includes actual reasoning.
- Gap status and priority use Carbon Tags.
- Recommended Action is a separate section.
- Create Task is a standard Carbon button.
- Footer is compact and sticky.
- Source records/documents are linked where supported.
- Evidence and AI inference are clearly distinguishable.
- No duplicate evidence pages are created.
- No additional HTML report files are created.

---

# 34. Final Instruction

Modify the existing shared Evidence Side Panel.

Do not create:

- additional HTML files
- completion reports
- implementation reports
- standalone evidence pages

When done, only provide a short Bob response summarizing the implementation and validation.