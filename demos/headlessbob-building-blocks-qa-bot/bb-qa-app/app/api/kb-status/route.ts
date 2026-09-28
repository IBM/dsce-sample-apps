// GET  /api/kb-status  — returns knowledge base metadata
// POST /api/kb-status  — triggers a fully AGENTIC Bob crawl
//                        Bob fetches the sitemap, crawls all pages,
//                        builds the JSON and writes it to disk autonomously.
//                        Streams Bob's live output back via SSE.

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getKBStatus, invalidateCache } from "@/lib/knowledge-base";
import { resolve } from "path";

const BOB_URL   = process.env.HEADLESSBOB_URL  ?? "http://127.0.0.1:8000";
const BOB_TOKEN = process.env.HEADLESSBOB_TOKEN ?? "";
const KB_PATH   = resolve(process.env.KNOWLEDGE_BASE_PATH ?? "../crawler/knowledge-base.json");
const DOCS_BASE = process.env.DOCS_BASE ?? "https://ibm-self-serve-assets.github.io/building-blocks-docs";
const SITEMAP_URL = `${DOCS_BASE}/sitemap.xml`;

// ── GET — return current KB status ───────────────────────────────────────────
export async function GET() {
  const status = getKBStatus();
  return NextResponse.json(status);
}

// ── POST — agentic crawl via Bob ──────────────────────────────────────────────
export async function POST(_req: NextRequest) {
  const encoder = new TextEncoder();

  function sseMsg(type: string, data: Record<string, unknown>) {
    return encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sseMsg("status", { text: "🤖 Creating Bob thread for agentic crawl..." }));

        // 1. Create a dedicated thread for the crawl
        const threadRes = await fetch(`${BOB_URL}/api/v1/threads`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOB_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ title: "🕷️ Knowledge Base Crawl" }),
        });
        if (!threadRes.ok) throw new Error(`Failed to create thread: ${threadRes.status}`);
        const thread = await threadRes.json();

        controller.enqueue(sseMsg("status", { text: `🤖 Bob is starting — thread ${thread.id.slice(0, 8)}...` }));

        // 2. Send the agentic crawl prompt
        const crawlPrompt = buildCrawlPrompt();
        const msgRes = await fetch(`${BOB_URL}/api/v1/threads/${thread.id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOB_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: crawlPrompt }),
        });
        if (!msgRes.ok) {
          const err = await msgRes.text();
          throw new Error(`Failed to send crawl prompt: ${msgRes.status} ${err}`);
        }
        const msgData = await msgRes.json();
        const runId = msgData.run?.run_id;

        controller.enqueue(sseMsg("status", { text: `🤖 Bob is crawling docs... (run ${runId?.slice(0, 8)})` }));

        // 3. Stream Bob's live SSE output back to the UI
        const upstream = await fetch(`${BOB_URL}/api/v1/runs/${runId}/events`, {
          headers: { Authorization: `Bearer ${BOB_TOKEN}`, Accept: "text/event-stream" },
        });

        if (!upstream.ok || !upstream.body) throw new Error("Failed to connect to Bob event stream");

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let chunkCount = 0;

        // Keepalive: ping the browser every 20s so the SSE connection stays open
        // during long crawls (Bob may take 3-5 minutes for 67 pages)
        const keepalive = setInterval(() => {
          try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { /* stream closed */ }
        }, 20000);

        outerLoop: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            try {
              const event = JSON.parse(raw);

              if (event.type === "message.part" && event.part?.content) {
                fullText += event.part.content;
                chunkCount++;
                // Send every chunk as a live log line to the sidebar
                controller.enqueue(sseMsg("bob_chunk", {
                  text: event.part.content,
                  chunk: chunkCount,
                }));

              } else if (event.type === "run.completed") {
                // Bob finished — invalidate KB cache and report done
                invalidateCache();
                const status = getKBStatus();
                controller.enqueue(sseMsg("done", {
                  page_count: status.page_count ?? 0,
                  built_at: status.built_at ?? new Date().toISOString(),
                  text: `✅ Bob completed the crawl! ${status.page_count ?? "?"} pages indexed`,
                  bob_output_length: fullText.length,
                }));
                break outerLoop;

              } else if (event.type === "run.failed") {
                throw new Error(event.run?.error?.message ?? "Bob crawl run failed");
              }
            } catch (parseErr) {
              // skip malformed lines
            }
          }
        }

        reader.cancel();
        clearInterval(keepalive);

      } catch (err: any) {
        controller.enqueue(sseMsg("error", { text: `❌ Agentic crawl failed: ${err.message}` }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ── Build the agentic crawl prompt ────────────────────────────────────────────
function buildCrawlPrompt(): string {
  return `You are a web crawler agent. Your task is to build a structured knowledge base JSON file from the IBM Building Blocks documentation site. This is an automated task — complete it fully without asking for confirmation.

## Step 1: Fetch the sitemap
\`\`\`bash
curl -s "${SITEMAP_URL}"
\`\`\`
Parse all <loc> URLs from the XML output.

## Step 2: Fetch each page
For EACH URL found in the sitemap, run:
\`\`\`bash
curl -s "<URL>"
\`\`\`
From each page extract:
- The page title (from <title> tag, strip everything after " - " or " | ")
- The URL path segments as an array e.g. ["ai-core", "agents", "agent-builder"]
- A human-readable breadcrumb e.g. "AI Core > Agents > Agent Builder"
- Plain text content (strip ALL HTML tags, nav, scripts, styles) — keep first 5000 chars
- Top 15 keywords from the content (exclude stop words: the, a, an, is, are, was, etc.)

## Step 3: Build the JSON structure
Create this exact JSON:
\`\`\`json
{
  "meta": {
    "built_at": "<ISO 8601 timestamp>",
    "page_count": <N>,
    "total_urls": <N>,
    "docs_base": "${DOCS_BASE}",
    "version": 1,
    "pillars": ["ai-core", "automation-core", "data-core", "ibm-bob", "build-with-bob", "workshop"]
  },
  "tree": {},
  "index": [
    {
      "path": ["pillar", "section", "page"],
      "breadcrumb": "Pillar > Section > Page",
      "url": "/pillar/section/page/",
      "full_url": "https://full-url",
      "label": "Page Title",
      "keywords": ["keyword1", "keyword2"],
      "depth": 3,
      "text": "plain text content..."
    }
  ]
}
\`\`\`

## Step 4: Save to disk
Save the JSON to this exact path:
\`\`\`bash
${KB_PATH}
\`\`\`

Use python3 to write it reliably:
\`\`\`bash
python3 << 'PYEOF'
import json, os
data = { ...your built data... }
os.makedirs(os.path.dirname("${KB_PATH}"), exist_ok=True)
with open("${KB_PATH}", "w") as f:
    json.dump(data, f, indent=2)
print(f"Saved {len(data['index'])} pages to ${KB_PATH}")
PYEOF
\`\`\`

## Step 5: Verify
\`\`\`bash
python3 -c "import json; d=json.load(open('${KB_PATH}')); print(f'✅ {d[\\\"meta\\\"][\\\"page_count\\\"]} pages indexed, file size: {os.path.getsize(\\\"${KB_PATH}\\\")} bytes')"
\`\`\`

Complete all steps now. Report progress as you go. Do not stop until the file is saved and verified.`;
}
