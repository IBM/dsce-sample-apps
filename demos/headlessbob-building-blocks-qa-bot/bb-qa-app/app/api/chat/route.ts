// POST /api/chat
// Multi-turn: reuses the existing threadId when provided (BOB_ENABLE_CONTINUATION=true).
// First message in a conversation creates a new thread; follow-ups reuse it.
// Each message injects fresh KB context so Bob always has relevant docs.

import { NextRequest, NextResponse } from "next/server";
import { createThread, sendMessage } from "@/lib/bob-client";
import { scorePages, buildContext, loadKnowledgeBase } from "@/lib/knowledge-base";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { question, threadId: existingThreadId, threadTitle } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    // Check KB exists
    const kb = loadKnowledgeBase();
    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not built yet. Please click Refresh to build it." },
        { status: 503 }
      );
    }

    // Score and pick top relevant pages
    const topPages = scorePages(question, 5);
    const sources  = topPages.map(p => ({
      breadcrumb: cleanBreadcrumb(p.breadcrumb),
      url: p.full_url ?? p.url,
    }));

    // Build context from selected pages
    const context = buildContext(topPages);

    // Build the grounded prompt
    const promptTemplate = `You are a knowledgeable assistant for IBM Building Blocks documentation.

Use ONLY the following documentation excerpts to answer the question.
If the answer is not in the provided context, say so clearly.
Always cite sources using their breadcrumb paths.

== DOCUMENTATION CONTEXT ==
${context}
== END CONTEXT ==

Question: ${question}

Provide a clear, structured answer using markdown. Cite the documentation sources you used.`;

    if (promptTemplate.length > 19800) {
      return NextResponse.json(
        { error: "Question + context too large. Try a more specific question." },
        { status: 400 }
      );
    }

    // ── Multi-turn: reuse existing thread if provided, otherwise create new ──
    let threadId: string;
    let isNewThread = false;

    if (existingThreadId) {
      // Continue the existing conversation in the same Bob thread
      threadId = existingThreadId;
    } else {
      // First message — create a fresh thread
      const title = threadTitle ?? question.slice(0, 60) + (question.length > 60 ? "..." : "");
      const thread = await createThread(title);
      threadId = thread.id;
      isNewThread = true;
    }

    // Send message to Bob
    const idempotencyKey = crypto.randomUUID();
    const msgRes = await sendMessage(threadId, promptTemplate, idempotencyKey);
    const runId  = msgRes.run?.run_id ?? (msgRes as any).run_id;

    return NextResponse.json({ threadId, runId, sources, isNewThread });
  } catch (err: any) {
    console.error("[/api/chat]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

/** Strip leading ### / ## / # markdown heading prefixes from breadcrumbs */
function cleanBreadcrumb(raw: string): string {
  return raw.replace(/^#+\s*/, "").trim();
}
