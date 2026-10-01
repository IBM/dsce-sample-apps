// GET /api/threads/[id]/messages — load chat history for a thread

import { NextRequest, NextResponse } from "next/server";
import { getThreadMessages } from "@/lib/bob-client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const data = await getThreadMessages(id);
    // Bob returns { items: [ { role, content, ... } ] }
    // Pair consecutive user/assistant messages into turns for the UI
    const items: Array<{ id: string; role: string; content: string; created_at: string; usage?: unknown }> =
      data.items ?? data.turns ?? [];

    const turns: Array<{ id: string; user_message?: string; assistant_message?: string; usage?: unknown }> = [];
    let i = 0;
    while (i < items.length) {
      const cur = items[i];
      if (cur.role === "user") {
        const next = items[i + 1];
        // Strip the injected context from the user message — show only the real question
        const userContent = extractQuestion(cur.content);
        turns.push({
          id: cur.id,
          user_message: userContent,
          assistant_message: next?.role === "assistant" ? next.content : undefined,
          usage: next?.usage,
        });
        i += next?.role === "assistant" ? 2 : 1;
      } else {
        i++;
      }
    }
    return NextResponse.json({ turns });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Extract the real user question from our injected prompt template.
 *  Tries multiple markers in order — falls back to raw content if none match. */
function extractQuestion(content: string): string {
  // Primary marker — "Question: <q>\n\nProvide"
  const m1 = content.match(/\bQuestion:\s*([\s\S]+?)(?:\n\nProvide|\nProvide)/);
  if (m1) return m1[1].trim();
  // Secondary marker — last line before "Provide a clear"
  const m2 = content.match(/\bQuestion:\s*([\s\S]+)/);
  if (m2) return m2[1].split("\n")[0].trim();
  // Fallback: return first 200 chars (hides injected KB context noise)
  return content.slice(0, 200).trim() + (content.length > 200 ? "…" : "");
}
