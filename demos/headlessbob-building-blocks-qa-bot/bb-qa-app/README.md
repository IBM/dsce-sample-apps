# BB Q&A App — Next.js Frontend

The UI layer for the **Building Blocks Q&A Bot**. All AI logic runs through [Headless Bob](../headless-bob/).

## Dev

```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Env vars required (`bb-qa-app/.env.local`)

```env
HEADLESSBOB_URL=http://127.0.0.1:8000
HEADLESSBOB_TOKEN=<your-bob-api-key>
KNOWLEDGE_BASE_PATH=../crawler/knowledge-base.json
DOCS_BASE=https://ibm-self-serve-assets.github.io/building-blocks-docs
```

## Key files

| File | Purpose |
|---|---|
| `app/page.tsx` | Root layout — sidebar + chat |
| `components/Sidebar.tsx` | Thread list, KB status, refresh |
| `components/ChatPanel.tsx` | Streaming chat, message bubbles |
| `app/api/chat/route.ts` | Creates Bob thread, scores KB, sends prompt |
| `app/api/stream/route.ts` | Proxies Bob SSE to browser |
| `app/api/kb-status/route.ts` | GET status · POST trigger Bob crawl |
| `lib/bob-client.ts` | Headless Bob REST API client |
| `lib/knowledge-base.ts` | KB loader, keyword scorer, context builder |

See the [root README](../README.md) for full architecture docs.
