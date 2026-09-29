// GET /api/run-output?runId=xxx
// Fetches the final output text of a completed run directly from Bob's run status endpoint.
// Used as fallback when SSE stream connects after the run has already completed.

import { NextRequest, NextResponse } from "next/server";

// nosemgrep: nodejs-ssrf
const BOB_URL: string = (() => {
  const SAFE_DEFAULT = "http://127.0.0.1:8000";
  const raw = process.env["HEADLESSBOB_URL"];
  if (typeof raw !== "string" || raw.length === 0) return SAFE_DEFAULT;
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) return SAFE_DEFAULT;
  try { return new URL(raw).origin; } catch { return SAFE_DEFAULT; }
})();
const BOB_TOKEN = process.env.HEADLESSBOB_TOKEN ?? "";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  try {
    const res = await fetch(`${BOB_URL}/api/v1/runs/${runId}`, {
      headers: { Authorization: `Bearer ${BOB_TOKEN}` },
    });
    if (!res.ok) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const run = await res.json();
    // Extract text from the output array
    const text = run.output
      ?.flatMap((msg: any) => msg.parts ?? [])
      .filter((p: any) => p.content_type === "text/plain")
      .map((p: any) => p.content)
      .join("") ?? "";

    return NextResponse.json({ text, usage: run.usage, status: run.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
