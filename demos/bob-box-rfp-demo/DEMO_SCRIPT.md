# Seller & Presenter Demo Script
## IBM Bob + Box Content Cloud: Autonomous RFP & Demo Studio

---

## 1. Demo Overview & Value Proposition

* **Target Audience:** Technical Sales, Sales Engineers (SEs), Solution Architects, and Executive Buyers.
* **Core Message:** Demonstrates how **IBM Bob** integrates directly with **Box Content Cloud** via open standards (**Model Context Protocol - MCP** and **Agent Communication Protocol - ACP**) to turn raw, fragmented customer documentation into grounded proposals, executive slide decks, and gap analyses.
* **Key Differentiator vs. Standard RAG:** Direct system-of-record access inside Box governance boundaries without external vector databases, ETL synchronization lag, or ACL desynchronization.

---

## 2. Pre-Demo Setup & Checklist

1. **Start the Application:**
   * Run the web server: `npm run dev` (running locally on `http://127.0.0.1:5190`).
   * *(Optional live LLM mode)* Start Headless Bob: `npm run bob:start` (running on `http://127.0.0.1:8000`).
2. **Verify Box Connection:**
   * Check that `.env` contains either Box Client Credentials or a fresh `BOX_DEV_TOKEN`.
   * The app includes automatic fallback to local high-fidelity synthetic data if Box tokens expire on stage.
3. **Open Browser:**
   * Navigate to `http://127.0.0.1:5190` in full-screen mode.

---

## 3. Step-by-Step Presentation Script

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Flow: 1. Challenge Hook → 2. Ingestion → 3. Research Brief → 4. Draft Proposal  │
│       → 5. Deck Generation → 6. Iterative Revision → 7. Round-Trip Box Export   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 1: The Hook & Home Screen
**What to show:** The clean landing page showing the unified prompt bar with connected Box workspace badge.

**What to say:**
> *"Every technical sales team knows the pain of RFP season. A buyer sends a 40-page RFP, but critical context is scattered across Box—discovery call notes, architecture diagrams, past proposals, and late security addenda.*
>
> *Today, we’re showing how IBM Bob connects directly to Box as its live system of record to autonomously synthesize customer context, detect architectural contradictions, and co-create customer deliverables in minutes."*

**Action:**
* Click the primary preset prompt or enter:
  > `"Help me respond to the Acme Bank RFP with a technical proposal and slide deck"`
* Click **Start Studio / Send**.

---

### Step 2: Live Box Ingestion & Investigation
**What to show:** The live synchronization progress indicator traversing Box workspace folders (`Incoming RFPs`, `Customers/Acme Bank`, `Security & Compliance`, `Past Responses`).

**What to say:**
> *"Under the hood, Bob isn't querying a separate vector database. Using the **Model Context Protocol (MCP)**, Bob reads directly from Box Content Cloud under enterprise access controls. It ingests 40+ heterogeneous files—PDFs, DOCX discovery notes, and Excel requirement sheets—preserving tables and document hierarchy."*

---

### Step 3: The Research Brief & Gap Detection
**What to show:** The **Research Brief** tab in the right panel and the **Source Files** list in the left panel.

**What to say:**
> *"Before drafting answers, Bob acts as a technical analyst. It builds this **Research Brief**, extracting:
> 1. **Company Background & Objectives**
> 2. **Core Technical Requirements**
> 3. **Critical Gaps & Contradictions (OPEN ITEMS)**
>
> Notice this `OPEN ITEM:` flag. The discovery notes from September specified Okta for identity management, while the formal RFP asked for Azure AD. Instead of hallucinating an answer, Bob flags this contradiction immediately for the account team."*

**Action:**
* Click on one of the cited source chips in the brief (e.g., `Acme Bank Discovery Notes.docx`).
* Show the live document preview modal, proving direct grounding to Box files.

---

### Step 4: Reviewing the Generated RFP Response (v1)
**What to show:** Switch to or view the **RFP Response v1** tab.

**What to say:**
> *"Bob generates a complete, structured RFP proposal matching enterprise standards:
> * **Executive Summary & Value Proposition**
> * **Solution Architecture Matrix**
> * **Security & Compliance Mappings (SOC 2, FedRAMP, HIPAA BAA)**
> * **Transparent Multi-Year Pricing Breakdown**
>
> Every section includes bracketed citations back to source documents in Box."*

---

### Step 5: Generating Executive Presentation Decks
**What to show:** Prompt Bob in the left-hand chat panel to generate a presentation.

**Action:**
* In the chat input, type:
  > `"Create an executive presentation deck summarizing this proposal for the CIO"`
* Press **Send**.

**What to say:**
> *"Sales teams don't just deliver written proposals—they need executive presentations. Bob switches context and generates a structured, 16:9 presentation deck complete with slide titles, strategic bullet points, and speaker notes."*

**Action:**
* Click through the presentation slides using the interactive slide navigator.
* Highlight the speaker notes pane below the active slide.

---

### Step 6: Iterative Revision & Multi-Version Tabs
**What to show:** Prompt Bob to refine pricing or tighten technical details.

**Action:**
* Type a refinement prompt in chat:
  > `"Sharpen the pricing section by adding a 10% multi-year commitment discount"`
* Press **Send**.

**What to say:**
> *"Enterprise work is iterative. When we ask Bob to update pricing, it doesn't overwrite our previous work. It creates **RFP Response v2** and **Presentation v2**.
>
> Notice the tab bar: older versions are dimmed, the latest is badged 'Current', and previous revisions remain accessible in the version dropdown for side-by-side comparison."*

---

### Step 7: Round-Trip Export Back to Box
**What to show:** The **Save to Box** button in the top right of the artifact panel.

**Action:**
* Click **Save to Box** (or Download Local Office Files).

**What to say:**
> *"Finally, we close the loop. With one click on 'Save to Box', Bob converts these structured artifacts into native enterprise `.docx` and `.pptx` files and writes them directly back into the buyer's Box folder under `Generated RFP Responses/`.
>
> The workflow began in Box and finished in Box, with zero data leakage or vector database sprawl."*

---

## 4. Key Questions & Rebuttals (Audience Q&A)

### Q: "How is this different from Box AI?"
> *"Box AI is a feature inside Box for querying files. What we've built is an **autonomous cross-system agent**. Bob connects to Box via open MCP protocols, cross-examines 40+ files, detects requirement conflicts, generates multi-version deliverables, and can extend across other enterprise tools like Salesforce, Jira, or Watsonx."*

### Q: "Why is MCP better than traditional RAG here?"
> *"Traditional RAG vectorizes text chunks, breaking tables, losing hierarchical structure, and duplicating data outside Box ACLs. MCP allows Bob to read complete files directly from Box as the live system of record with zero indexing delay and full enterprise governance."*

### Q: "Can this be used for use cases other than RFPs?"
> *"Yes. The RFP scenario is our anchor demo, but the underlying decoupled MCP + ACP architecture is a general blueprint for contract analysis, compliance audits, customer onboarding, and executive intelligence."*

---

## 5. Demo Reset

To reset the demo for the next attendee:
1. Refresh the browser page (`Cmd + R` / `F5`) or click the **Reset / Home** button.
2. The session memory, tab versions, and chat thread will return to the initial clean state.
