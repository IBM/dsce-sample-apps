# Building Blocks Q&A Bot — Demo Script

---

## Overview

Demonstrates how Headless Bob autonomously crawls IBM Building Blocks documentation, builds a knowledge base, and answers natural-language questions with cited, streamed responses — all with the Next.js app acting as a thin UI shell.

---

**Step 1 — Orient the Audience**

1. Open the app URL — point out the dark green sidebar and the four suggestion cards, one per Building Blocks pillar: **Agents**, **AI Control Plane**, **Data**, and **Automation**.
2. Draw attention to the **KB Ready** badge in the top-right corner — explain that Headless Bob has already autonomously crawled all 67 Building Blocks documentation pages and the knowledge base is live and indexed.

---

**Step 2 — Ask a Question from a Suggestion Card**

1. Click one of the suggestion cards — for example: *"What building blocks are available for building AI agents?"*
2. Watch the answer **stream word-by-word** in real time directly from Headless Bob via SSE.
3. Point out the **source citation chips** that appear below the response — each chip links directly to the specific documentation page Bob used to ground its answer.

---

**Step 3 — Follow-Up Question (Multi-Turn Conversation)**

1. Type a follow-up question in the input box — for example: *"How do these agents connect to watsonx.ai?"*
2. Show that the response continues in the **same thread** (same entry visible in the left sidebar) — demonstrating Bob's stateful multi-turn conversation capability.
3. Key talking point: Bob is maintaining full context across turns without any custom session management code in the app.

---

**Step 4 — Revisit a Previous Thread**

1. Click a **previous thread** in the left sidebar.
2. Show that the full conversation history — all prior questions and answers — loads back instantly.

---

**Step 5 — Demonstrate Agentic KB Refresh**

1. Click the **↻ refresh icon** at the bottom of the sidebar.
2. Narrate: *"Bob is now autonomously crawling all 67 pages of the Building Blocks documentation site and rebuilding the knowledge base live — this is Bob doing the work, not a script."*
3. Point out the **last crawl timestamp** in the bottom-left corner — this updates once the crawl completes (~5–10 minutes).

---

**Step 6 — Key Talking Point**

Emphasise to the audience:

> *"The Next.js app is a thin UI shell. Bob handles all the intelligence — crawling, reasoning, context injection, streaming, and thread management. This is exactly what Headless Bob enables: autonomous agentic capability with no custom AI orchestration code."*
