// GET /api/stream?runId=xxx
// Proxies SSE stream from Headless Bob to the browser with live streaming.
// Strategy: always connect to Bob's live SSE first (replays all stored events).
// Bob's SSE endpoint replays all past events then streams new ones — so even if
// the run already completed, all message.part chunks will be replayed in order.

import { NextRequest } from "next/server";

function validateBobUrl(raw: string): string {
  let parsed: URL;
  try { parsed = new URL(raw); } catch {
    throw new Error(`HEADLESSBOB_URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`HEADLESSBOB_URL must use http or https, got: ${parsed.protocol}`);
  }
  return `${parsed.protocol}//${parsed.host}`;
}

const BOB_URL   = validateBobUrl(process.env.HEADLESSBOB_URL ?? "http://127.0.0.1:8000");
const BOB_TOKEN = process.env.HEADLESSBOB_TOKEN ?? "";

function encode(obj: object) {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return new Response("runId required", { status: 400 });

  // Always connect to Bob's live SSE — it replays all stored events from the beginning,
  // so we get every message.part chunk even if the run already completed.
  const upstream = await fetch(`${BOB_URL}/api/v1/runs/${runId}/events`, {
    headers: {
      Authorization: `Bearer ${BOB_TOKEN}`,
      Accept: "text/event-stream",
    },
  });

  if (!upstream.ok || !upstream.body) {
    // Fallback: fetch run output directly
    const runRes = await fetch(`${BOB_URL}/api/v1/runs/${runId}`, {
      headers: { Authorization: `Bearer ${BOB_TOKEN}` },
    });
    const run = runRes.ok ? await runRes.json() : null;
    const text = run?.output
      ?.flatMap((msg: any) => msg.parts ?? [])
      .filter((p: any) => p.content_type === "text/plain")
      .map((p: any) => p.content)
      .join("") ?? "";

    const stream = new ReadableStream({
      start(controller) {
        if (text) controller.enqueue(encode({ type: "chunk", text }));
        controller.enqueue(encode({ type: "done", usage: run?.usage, status: run?.status ?? "unknown" }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // Stream Bob's SSE events, transforming them into our UI event format
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const send = (obj: object) => controller.enqueue(encode(obj));

      try {
        outer: while (true) {
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
                // Live text chunk — send immediately for streaming effect
                send({ type: "chunk", text: event.part.content });

              } else if (event.type === "run.completed") {
                send({ type: "done", usage: event.run?.usage, status: "completed" });
                break outer;

              } else if (event.type === "run.failed") {
                send({ type: "error", message: event.run?.error?.message ?? "Run failed" });
                break outer;

              } else if (event.type === "run.cancelled") {
                send({ type: "cancelled" });
                break outer;
              }
              // Ignore: run.created, run.in-progress, message.created, message.completed
            } catch { /* skip malformed lines */ }
          }
        }
      } finally {
        reader.cancel();
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
