# From Customer Context to Customer Demo
### IBM Bob + Box Content Cloud • BoxWorks Booth Demonstration Application

> **Central Demo Message:**  
> *“Box provides the customer context. Bob turns that context into a tailored, evidence-backed demo.”*

---

## Executive Overview

**From Customer Context to Customer Demo** is an interactive, enterprise-grade demonstration application designed for live booth presentations (optimized for 3-minute SE demos on large displays).

It demonstrates how **IBM Bob** connects to **Box** via the **Model Context Protocol (MCP)** to ingest unstructured customer documents (discovery notes, technical requirements, RFPs, security mandates, alignment emails) and transform them into a tailored, evidence-backed customer demo plan and complete asset packet.

---

## Quick Start (Run Locally)

### Prerequisites
- Node.js `v18+` (tested on Node `v20+` and `v26+`)
- npm `v9+`

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Local Demo Server
```bash
npm run dev
```
Open your browser to: **[`http://127.0.0.1:5173`](http://127.0.0.1:5173)**

*(Note: In compliance with security standards, the server binds strictly to `127.0.0.1` and avoids `0.0.0.0`)*

### 3. Build for Production / Static Deployment
```bash
npm run build
npm run preview
```

---

## Booth Demonstration Walkthrough

| Step | Screen | Presenter Action & Key Talking Point |
|---|---|---|
| **1** | **The Ask** | Click **"Prepare My Demo"** (prefilled with *"Prepare me for tomorrow's demo with Acme Corp."*). Show that Bob operates directly on Acme's Box workspace. |
| **2** | **Bob Investigates** | Watch the 7-stage agentic synthesis (or click **"Skip Animation"** for instant results). Note that Bob performs deterministic extraction without fabricating risk scores. |
| **3** | **Box Content (12 Files)** | Show 12 synthetic Box documents across Discovery, Security, Tech Specs, and RFP folders. Click **"Preview"** on any card to show simulated Box file content. |
| **4** | **Acme Demo Brief** | Review 5 categorized finding blocks: *What Acme Wants to See*, *Documented Pain Points*, *Technical Requirements*, *Open Questions*, and *Recent Requests*. |
| **5** | **Verify Evidence** | Click **"Integration with Salesforce"** or **"Automated Document Classification"**. Show the verification chain: **Finding → Supporting Box Excerpt → Original Document**. |
| **6** | **Tailored Demo Plan** | Click **"Build My Demo Plan"**. Walk through the 8-step sequence, talking points, and why it matters to Acme. Point out **Questions to Confirm** during the 15-minute Q&A. |
| **7** | **Demo Assets & Prototype** | Click **"Generate Demo Assets"**. Switch between the **5-min Script**, **Presenter Talking Points**, **Validation Checklist**, and run the **Interactive Workflow Simulator** (with RBAC role toggles). |
| **8** | **Acme Demo Ready** | View the complete executive packet. Click **"Copy Meeting Brief"** to show instant clipboard export, and conclude with the central takeaway banner. |

---

## Synthetic Acme Corp Box Workspace (12 Files)

The application includes 12 internally consistent synthetic customer documents stored as structured records in [`src/data/syntheticDocuments.ts`](src/data/syntheticDocuments.ts) and exported in [`synthetic_demo_content/`](synthetic_demo_content/):

1. `Acme_Discovery_Notes.docx` (`BOX-FILE-8839210`) - Initial discovery with VP Ops on 48-hr intake backlog and Salesforce re-entry.
2. `Acme_Technical_Requirements.xlsx` (`BOX-FILE-8839211`) - Architecture matrix for SAML SSO, REST API, RBAC, and US Data Residency.
3. `Security_Requirements.pdf` (`BOX-FILE-8839212`) - CISO mandate for AES-256 / TLS 1.2+, 365-day audit logs, and US data sovereignty.
4. `Architecture_Workshop_Notes.docx` (`BOX-FILE-8839213`) - Salesforce CRM integration topology and metadata master debate.
5. `Acme_RFP.pdf` (`BOX-FILE-8839214`) - Formal RFP mandatory requirements for classification, approval flows, and search.
6. `Demo_Request.docx` (`BOX-FILE-8839215`) - SE briefing specifying Salesforce handoff demo, RBAC role permissions, and Q&A time.
7. `Acme_Current_Architecture.pdf` (`BOX-FILE-8839216`) - Legacy Windows SMB file share challenges and search friction.
8. `Customer_Workflow_Notes.docx` (`BOX-FILE-8839217`) - Email-based approval bottlenecks and lack of real-time status visibility.
9. `Integration_Requirements.xlsx` (`BOX-FILE-8839218`) - Salesforce Canvas integration specs and webhook triggers.
10. `September_Follow_Up_Notes.docx` (`BOX-FILE-8839219`) - Follow-up notes on classification priority and external collaborator audit.
11. `Data_Governance_Requirements.pdf` (`BOX-FILE-8839220`) - Data governance rules, unmetered volume, and retention schedule review.
12. `Demo_Planning_Email_Summary.docx` (`BOX-FILE-8839221`) - Pre-demo customer alignment email thread confirming agenda and timing.

---

## Evidence-First Grounding & Guardrails

To prevent AI hallucinations and maintain customer trust, Bob adheres to strict grounding principles:

- **No Predictive Fabrication:** Bob never fabricates customer sentiment, win probability, deal urgency, or renewal scores.
- **Support Indicators:** Evidence is labeled transparently by supporting document count (*Strongly Supported: 3+ sources*, *Supported: 1–2 sources*, *Not Found in Content: 0 sources*).
- **Insufficient Evidence Handling:** When asked about unsupported topics (e.g., *“What is Acme’s probability of purchasing?”* or *“What is Acme’s monthly document volume?”*), Bob explicitly responds:
  > *“I could not find sufficient evidence in the available Box content to answer that question.”*

---

## Box MCP Provider Architecture (Future Live Integration)

The application defines a clean service boundary using TypeScript interfaces in [`src/services/boxMcpService.ts`](src/services/boxMcpService.ts).

### Provider Contract:
```typescript
export interface BoxMcpProvider {
  searchContent(query: string, folder?: string): Promise<BoxDocument[]>;
  getAllDocuments(): Promise<BoxDocument[]>;
  getDocumentById(id: string): Promise<BoxDocument | undefined>;
  getExtractedFindings(): Promise<Finding[]>;
  getExcerptsForFinding(findingId: string): Promise<DocumentExcerpt[]>;
  getItemUrl(docId: string): string;
  getProviderMode(): 'mock' | 'live_mcp';
}
```

### Transitioning to Live Box MCP Server:
1. Set `VITE_BOX_MCP_MODE=live_mcp` in your environment.
2. Implement `LiveBoxMcpProviderStub` in `src/services/boxMcpService.ts` to call Box MCP tools (e.g. `mcp__box__search`, `mcp__box__get_file_content`).
3. Configure OAuth 2.0 / Box Enterprise credentials in `.env.local` (see [`.env.example`](.env.example)).

---

## Resetting the Demo

Click the **"Reset Demo"** button located in the top navigation bar or the footer of any screen to instantly restore the initial demo state for the next audience.

---

## Technologies Used
- **React 19** + **TypeScript**
- **Vite 6** (Fast HMR & Optimized Bundling)
- **Tailwind CSS** (IBM Carbon & Box Brand Color System)
- **Lucide React** (Clean Enterprise UI Iconography)
- **Model Context Protocol (MCP)** Provider Interface Abstraction
