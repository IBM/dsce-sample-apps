# SPEC-007 — Frontend: Knowledge Hub Chat UI

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Location:** `frontend/`  
**Design System:** IBM Carbon Design System v11 (`@carbon/react`)

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | Reliability Engineers must be able to ask natural-language questions about Maximo assets and maintenance data through a conversational chat interface. |
| BR-002 | Chat responses must include inline source citations linking to the originating documents or Maximo records. |
| BR-003 | When Bob generates an investigation, analysis, report, or task in response to a chat message, an Action Card must appear in the chat with a direct link to the Action Center entry. |
| BR-004 | The UI must display real-time typing/streaming indicators while Bob generates a response. |
| BR-005 | Chat history must persist within a session and be accessible for follow-up questions. |
| BR-006 | The entire application must follow IBM Carbon Design System patterns — global header, left navigation, content canvas. |

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 18 + Vite 5 |
| Design System | IBM Carbon Design System v11 (`@carbon/react` ^1.37) |
| Icons | `@carbon/icons-react` ^11.25 |
| HTTP Client | Axios |
| Routing | React Router v6 |
| State Management | React Context + `useState`/`useReducer` hooks |

---

## 3. Application Shell

### 3.1 Global Header

Use IBM Carbon `Header` component.

```
IBM Asset Management Knowledge Hub        [User avatar / profile]
```

- Black background (`g100` theme)
- IBM logo or application name on the left
- User profile menu on the right
- No secondary navigation in the header

### 3.2 Left Navigation

Use IBM Carbon `SideNav` component with logical groupings (see SPEC-009 for full navigation spec).

**Navigation items:**

```
Workspace
  - Knowledge Hub          (chat interface — default landing page)
  - Action Center          (persistent AI-generated actions)

Data & Integration
  - Data Ingestion         (trigger and monitor ingestion pipeline)

Automation & Scheduling
  - Scheduled Jobs         (recurring background jobs)

Governance & Monitoring
  - Audit Log              (query history and action log)
  - Statistics             (index and usage statistics)

Platform
  - Architecture           (system architecture diagrams)

Configuration
  - Settings               (connection settings for Maximo, OpenSearch, Kafka)
```

Active page must be highlighted using Carbon's `isActive` navigation state.

### 3.3 Content Canvas

White/light background. Content follows IBM Carbon `Grid` with standard 16-column layout.

---

## 4. Knowledge Hub Chat Page

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ IBM Asset Management Knowledge Hub                          [User]         │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│   Left Nav   │   Knowledge Hub                                  │
│              │                                                   │
│  Knowledge   │   ┌─────────────────────────────────────────┐   │
│   Hub  ←     │   │ Chat Messages                           │   │
│  Action Ctr  │   │                                         │   │
│  Data Ing.   │   │  [User message]                        │   │
│  Sched Jobs  │   │  [Bob response + citations]            │   │
│  Audit Log   │   │  [Action Card — Open in Action Center] │   │
│  Statistics  │   │                                         │   │
│  Arch.       │   └─────────────────────────────────────────┘   │
│  Settings    │                                                   │
│              │   ┌─────────────────────────────────────────┐   │
│              │   │ [Chat input]            [Send ▶]        │   │
│              │   └─────────────────────────────────────────┘   │
│              │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

### 4.2 Chat Message Components

**User message:**
- Right-aligned, IBM Carbon `Tag` background
- Timestamp (subtle, `$text-secondary` color)

**Bob response:**
- Left-aligned
- Full-width prose answer
- Source citations as Carbon `Tag` chips below the response text: `📄 pump-manual.pdf · page 12`, `⚙ Maximo: Asset P-101`
- Carbon `InlineLoading` spinner while generating

**Action Card (when an action is created):**
```
┌────────────────────────────────────────────────┐
│  ✓ Action created                              │
│                                                │
│  Critical Asset Failure Investigation          │
│  15 assets analyzed                            │
│                                                │
│  [Open in Action Center →]                     │
└────────────────────────────────────────────────┘
```
Use `Tile` component with `CTA` link styled as `Button` kind `ghost`.

### 4.3 Chat Input

- Carbon `TextInput` or `TextArea` (multi-line)
- Carbon `Button` (primary) for send: "Send" with `Send20` icon
- Press Enter to send (Shift+Enter for newline)
- Disabled while Bob is generating a response

### 4.4 Suggested Questions (empty state)

When chat is empty, display 3-4 suggestion chips:

```
Try asking:
[Show assets with recurring failures in the last 6 months]
[Compare our job plans for P-101 against OEM recommendations]
[What maintenance gaps exist in our pump systems?]
[List open work orders for critical assets]
```

Use Carbon `Tag` interactive variant for suggestion chips.

---

## 5. Source Citations

Citations must clearly distinguish between:

| Source Type | Label | Carbon Tag Color |
|-------------|-------|-----------------|
| Ingested document (PDF/DOCX) | `📄 filename.pdf · p.12` | `blue` |
| Web knowledge (IBM Docs, community) | `🌐 ibm.com/docs` | `teal` |
| Maximo live data | `⚙ Maximo: MXAPIASSET` | `purple` |
| Kafka event | `⚡ Kafka: maximo.failures` | `magenta` |
| AI reasoning | `🤖 AI Analysis` | `gray` |

Clicking a document citation opens the document preview or scrolls to the relevant section.

---

## 6. Chat Context and Continuity

The chat must maintain session context so that follow-up queries reference the previous analysis:

> **User:** "Show me the assets with recurring failures"
> *(Bob creates Critical Asset Failure Investigation)*
>
> **User:** "Now compare these against OEM manuals"
> *(Bob understands "these" = the 15 assets from the previous investigation)*

The frontend must include the `previous_action_id` in the next `POST /api/query` request when an action has been recently created.

---

## 7. Data Ingestion Page

The Data Ingestion page allows triggering and monitoring ingestion runs.

### 7.1 Ingestion Trigger

```
┌─────────────────────────────────────────┐
│  Source:   [IBM Cloud Object Storage ▼] │
│  Bucket:   [maximo-docs-bucket        ] │
│  Prefix:   [pumps/                    ] │
│  ☐ Force re-index                       │
│                                         │
│  [Start Ingestion]                      │
└─────────────────────────────────────────┘
```

### 7.2 Progress Display

Use Carbon `ProgressBar` and `InlineLoading` with live `GET /api/pipelines/status` polling (1-second interval).

Display:
- Current file being processed
- Documents processed / total
- Documents failed / skipped
- Estimated time remaining

### 8. Settings Page

Display connectivity status cards for:

| Service | Card Content |
|---------|-------------|
| Maximo Manage | Connection status, logged-in user, URL |
| IBM watsonx AI | API connectivity status |
| IBM watsonx.data OpenSearch | Cluster health, document counts per index |
| Confluent Kafka | `configured` / `connected` / topics list |
| ServiceNow | Connection status |

Each card uses Carbon `Tile` with a green `Tag` ("Connected") or red `Tag` ("Unreachable") status indicator.

---

## 9. Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | The chat UI accepts a natural-language query and displays Bob's response with citations within 15 seconds. |
| AC-002 | When Bob creates an Action Center entry, an Action Card appears in the chat with a working "Open in Action Center →" link. |
| AC-003 | Source citations appear below Bob's response and are visually distinguished by type (document, Maximo, web, AI). |
| AC-004 | The global header and left navigation remain visible and unchanged on all pages. |
| AC-005 | The chat input is disabled (with InlineLoading indicator) while Bob is generating a response. |
| AC-006 | The Data Ingestion page displays live progress from `GET /api/pipelines/status` using a Carbon ProgressBar. |
| AC-007 | The Settings page shows correct live connectivity status for all integrated services. |
| AC-008 | The application renders correctly on desktop (1280px+) without horizontal scrollbars. |
| AC-009 | All interactive elements (buttons, links, form inputs) are accessible via keyboard and meet WCAG 2.1 AA standards. |
