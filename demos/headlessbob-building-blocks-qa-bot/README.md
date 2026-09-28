# 🧱 Building Blocks Q&A Bot

A **Headless Bob** demo that answers questions about IBM Building Blocks documentation — powered entirely by Bob's agentic capabilities.

> **The demo point:** Bob does everything. It crawls the docs, builds the knowledge base, and answers questions. The Next.js app is just a UI shell.

---

## What It Does

| Capability | Who does it |
|---|---|
| Crawl 67 docs pages & build `knowledge-base.json` | **Bob** (agentic) |
| Answer natural-language questions with citations | **Bob** (streaming SSE) |
| Thread & run management | **Headless Bob REST API** |
| UI rendering | Next.js (thin shell) |

---

## Architecture

![Building Blocks Q&A Bot — Architecture](bb-qa-app/public/Building_Blocks_Q%26A_Bot.png)

> **Q&A flow:** User asks → Next.js scores KB → Bob answers with streaming SSE → citations shown
>
> **Refresh KB flow:** User clicks refresh → Bob crawls 67 docs pages → writes `knowledge-base.json`

---

## Project Structure

```
Headlessbob-BB-QA-Bot/
├── bb-qa-app/                    # Next.js 16 frontend
│   ├── app/
│   │   ├── page.tsx              # Root layout: sidebar + chat
│   │   ├── layout.tsx            # HTML shell + favicon
│   │   ├── globals.css           # Tailwind + prose + scrollbar styles
│   │   └── api/
│   │       ├── chat/route.ts         # Creates thread, scores KB, sends to Bob
│   │       ├── stream/route.ts       # Proxies Bob SSE → browser
│   │       ├── threads/route.ts      # List + delete threads
│   │       ├── threads/[id]/messages/route.ts  # Load thread history
│   │       └── kb-status/route.ts    # GET: KB metadata · POST: trigger Bob crawl
│   ├── components/
│   │   ├── Sidebar.tsx           # Dark green sidebar: threads, KB status, refresh
│   │   └── ChatPanel.tsx         # Message bubbles, streaming, input box
│   ├── lib/
│   │   ├── bob-client.ts         # Headless Bob REST API client
│   │   ├── knowledge-base.ts     # Load KB JSON, keyword scoring, context builder
│   │   └── types.ts              # Shared TypeScript types
│   ├── public/
│   │   └── logo.png              # App icon (sidebar, hero, favicons, avatars)
│   └── .env.local                # BOB_URL, BOB_API_KEY, KB_PATH
│
├── headless-bob/assets/headlessbob/  # Headless Bob server
│   ├── .env                          # BOB_API_KEY, BOB_ENABLE_CONTINUATION=true
│   └── src/app.ts                    # Runtime: BobClientRuntime (bob acp)
│
├── crawler/
│   ├── knowledge-base.json       # 67 pages, built by Bob
│   └── build-knowledge-base.mjs  # Legacy Node.js crawler (not primary)
│
└── test-bob-qa.mjs               # E2E test script
```

---

## Getting Started

### 1. Start Headless Bob

```bash
cd headless-bob/assets/headlessbob
npm start
# Bob runs on http://127.0.0.1:8000
```

### 2. Start the Next.js app

```bash
cd bb-qa-app
npm run dev
# App runs on http://localhost:3000
```

### 3. Build the Knowledge Base

Click the **↻ refresh icon** in the sidebar — Bob will autonomously crawl all 67 docs pages and write `crawler/knowledge-base.json`. Takes ~5–10 minutes.

---

## Environment Variables

### `bb-qa-app/.env.local`

```env
HEADLESSBOB_URL=http://127.0.0.1:8000
HEADLESSBOB_TOKEN=<your-bob-api-key>
KNOWLEDGE_BASE_PATH=../crawler/knowledge-base.json
DOCS_BASE=https://ibm-self-serve-assets.github.io/building-blocks-docs
```

### `headless-bob/assets/headlessbob/.env`

```env
BOB_API_KEY=<your-bob-api-key>
BOB_ENABLE_CONTINUATION=true
RUN_TIMEOUT_MS=600000
```


## OpenShift Deployment

### Prerequisites
- `oc` CLI installed and logged in (`oc login <cluster-url>`)
- `BOB_API_KEY` environment variable set
- Cluster with image registry enabled and sufficient quota for 2 Deployments + 2 PVCs

### One-command deploy

```bash
export BOB_API_KEY=<your-key>
./openshift/deploy.sh [NAMESPACE]   # default namespace: bb-qa-bot
```

The script will:
1. Create the namespace/project
2. Create credentials Secret
3. Provision the shared KB PersistentVolumeClaim
4. Seed `knowledge-base.json` into the PVC via a one-shot Job
5. Build + deploy **Headless Bob** via OpenShift binary build
6. Build + deploy **bb-qa-app** via OpenShift binary build
7. Print the public HTTPS Route URL

### File structure

```
openshift/
├── deploy.sh                  # Full deploy script (run this)
├── secret.yaml                # Credentials template (DO NOT commit with real values)
├── kb-pvc.yaml                # Shared PVC for knowledge-base.json
├── kb-seed-job.yaml           # One-shot Job to seed KB into PVC
├── networkpolicy.yaml         # bb-qa-app ↔ headless-bob isolation
├── headless-bob/
│   ├── build.yaml             # ImageStream + BuildConfig
│   └── app.yaml               # ServiceAccount, PVC, Deployment, Service
└── bb-qa-app/
    ├── build.yaml             # ImageStream + BuildConfig
    └── app.yaml               # Deployment, Service, Route (public HTTPS)
```

### Manual re-deploy (after code changes)

```bash
# Rebuild and redeploy Bob
oc start-build headless-bob --from-dir=headless-bob/assets/headlessbob --follow

# Rebuild and redeploy UI
oc start-build bb-qa-app --from-dir=bb-qa-app --follow
```

### Storage note

The shared `kb-data` PVC uses `ReadWriteMany` so both pods can mount it simultaneously. If your storage class only supports `ReadWriteOnce` (e.g. block storage), edit [`openshift/kb-pvc.yaml`](openshift/kb-pvc.yaml) and add pod affinity rules to pin both deployments to the same node.

---


---

## Tech Stack

- **Headless Bob 2.0.4** — AI runtime, agentic crawl, SSE streaming
- **Next.js 16** — frontend + API routes
- **Tailwind CSS 4** — styling
- **marked** — markdown rendering
- **TypeScript** — end to end
