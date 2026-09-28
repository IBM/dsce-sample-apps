/**
 * test-bob-qa.mjs
 *
 * End-to-end test for the Building Blocks Q&A concept:
 *   1. Fetch a page from the Building Blocks docs site
 *   2. Strip HTML to plain text
 *   3. Create a thread on Headless Bob
 *   4. Send question + docs context as a prompt
 *   5. Stream Bob's response via SSE
 *
 * Usage:
 *   node test-bob-qa.mjs
 *
 * Requirements:
 *   - Headless Bob server running on http://127.0.0.1:8000
 *   - Token from headless-bob/assets/headlessbob/.env AUTH_TOKENS
 */

import https from "https";
import http from "http";

// ── Config ────────────────────────────────────────────────────────────────────
const BOB_BASE = "http://127.0.0.1:8000";
const TOKEN = process.env.AUTH_TOKEN ?? (() => { throw new Error("AUTH_TOKEN env var is required. Set it to an owner token from headless-bob/assets/headlessbob/.env AUTH_TOKENS."); })();
const DOCS_BASE = "https://ibm-self-serve-assets.github.io/building-blocks-docs";

// The question to ask
const QUESTION = process.argv[2] ?? "What is Headless Bob and what APIs does it expose?";

// Docs pages to fetch as context (slug relative to DOCS_BASE)
const DOCS_PAGES = [
  "/ai-core/ai-engineering/headless-bob/",
  "/ai-core/",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch a URL and return the body as a string */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "headlessbob-qa-test/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(new URL(res.headers.location, url).href).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Very simple HTML → plain text stripper */
function htmlToText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

/** POST JSON to Bob REST API */
function bobPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: "127.0.0.1",
      port: 8000,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: `Bearer ${TOKEN}`,
      },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode, body: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode, body: text });
        }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/** GET JSON from Bob REST API */
function bobGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "127.0.0.1",
      port: 8000,
      path,
      method: "GET",
      headers: { Authorization: `Bearer ${TOKEN}` },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode, body: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode, body: text });
        }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

/** Stream SSE events from Bob run */
function streamRunEvents(runId) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "127.0.0.1",
      port: 8000,
      path: `/api/v1/runs/${runId}/events`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "text/event-stream",
      },
    };

    console.log("\n── Streaming Bob's response ──────────────────────────────────");
    let fullText = "";

    const req = http.request(opts, (res) => {
      res.setEncoding("utf8");
      let buffer = "";

      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const event = JSON.parse(raw);
            // SSE event types: run.created, run.in-progress, message.created,
            // message.part, message.completed, run.completed, run.failed
            if (event.type === "message.part" && event.part?.content) {
                process.stdout.write(event.part.content);
                fullText += event.part.content;
              } else if (event.type === "run.completed") {
                console.log("\n\n── Run complete ──────────────────────────────────────────────");
                if (event.run?.usage) {
                  console.log("Usage:", JSON.stringify(event.run.usage, null, 2));
                }
              } else if (event.type === "run.failed") {
                console.error("\n[FAILED]", JSON.stringify(event.run?.error ?? event, null, 2));
              }
          } catch {
            // non-JSON line, skip
          }
        }
      });

      res.on("end", () => resolve(fullText));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Building Blocks Q&A — Headless Bob End-to-End Test");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`\nQuestion: "${QUESTION}"\n`);

  // Step 1 — Ping the server
  console.log("Step 1/5 — Checking Headless Bob server...");
  const ping = await bobGet("/ping");
  if (ping.status !== 200) {
    console.error("❌ Server not reachable. Start it with:\n  npm start (in headless-bob/assets/headlessbob)");
    process.exit(1);
  }
  console.log("✅ Server is up:", JSON.stringify(ping.body));

  // Step 2 — Fetch docs pages
  console.log("\nStep 2/5 — Fetching Building Blocks docs pages...");
  const docsChunks = [];
  for (const slug of DOCS_PAGES) {
    const url = `${DOCS_BASE}${slug}`;
    try {
      process.stdout.write(`  Fetching ${url} ... `);
      const html = await fetchUrl(url);
      const text = htmlToText(html);
      // Take first 6000 chars per page to stay within prompt limits
      const excerpt = text.slice(0, 6000);
      docsChunks.push(`### Source: ${url}\n\n${excerpt}`);
      console.log(`✅ (${excerpt.length} chars)`);
    } catch (err) {
      console.log(`⚠️  Failed: ${err.message}`);
    }
  }

  if (docsChunks.length === 0) {
    console.error("❌ Could not fetch any docs pages. Check network access.");
    process.exit(1);
  }

  // Step 3 — Build the prompt
  console.log("\nStep 3/5 — Building prompt with docs context...");
  const context = docsChunks.join("\n\n---\n\n");
  const prompt = `You are a helpful assistant for IBM Building Blocks documentation.

Use ONLY the following documentation excerpts to answer the question. If the answer is not in the provided docs, say so clearly.

== DOCUMENTATION CONTEXT ==
${context}
== END CONTEXT ==

Question: ${QUESTION}

Please provide a clear, structured answer based on the documentation above.`;

  console.log(`✅ Prompt built (${prompt.length} chars, ${docsChunks.length} doc sources)`);

  // Step 4 — Create a thread and send the message
  console.log("\nStep 4/5 — Creating thread and sending prompt to Bob...");
  const threadRes = await bobPost("/api/v1/threads", { title: "BB Q&A Test" });
  if (threadRes.status !== 200 && threadRes.status !== 201) {
    console.error("❌ Failed to create thread:", threadRes);
    process.exit(1);
  }
  const threadId = threadRes.body.id;
  console.log(`✅ Thread created: ${threadId}`);

  const msgRes = await bobPost(`/api/v1/threads/${threadId}/messages`, { content: prompt });
  if (msgRes.status !== 202 && msgRes.status !== 200) {
    console.error("❌ Failed to send message:", msgRes);
    process.exit(1);
  }
  const runId = msgRes.body.run?.run_id ?? msgRes.body.run_id ?? msgRes.body.id;
  console.log(`✅ Run started: ${runId}`);
  console.log(`   Events URL: ${msgRes.body.events_url ?? `/api/v1/runs/${runId}/events`}`);

  // Step 5 — Stream the response
  console.log("\nStep 5/5 — Streaming response from Bob...");
  await streamRunEvents(runId);

  // Final run status
  const runStatus = await bobGet(`/api/v1/runs/${runId}`);
  console.log("\n── Final run status ──────────────────────────────────────────");
  console.log(`  Status : ${runStatus.body.status}`);
  if (runStatus.body.usage) {
    console.log(`  Cost   : $${runStatus.body.usage.session_costs?.toFixed(4)}`);
    console.log(`  Time   : ${runStatus.body.usage.duration_ms}ms`);
  }

  console.log("\n✅ Test complete!\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
