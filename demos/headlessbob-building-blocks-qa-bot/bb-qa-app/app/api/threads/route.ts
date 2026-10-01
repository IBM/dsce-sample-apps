// GET    /api/threads       — list all threads
// DELETE /api/threads?id=x  — delete a single thread
// DELETE /api/threads?all=1 — delete ALL threads

import { NextRequest, NextResponse } from "next/server";
import { listThreads, deleteThread } from "@/lib/bob-client";

export async function GET() {
  try {
    const data = await listThreads();
    // Bob returns { items: [...] } — normalize to { threads: [...] } for the UI
    return NextResponse.json({ threads: data.items ?? data.threads ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id  = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all");

  // Delete ALL threads
  if (all === "1") {
    try {
      const data = await listThreads();
      const threads = data.items ?? data.threads ?? [];
      await Promise.all(threads.map((t: any) => deleteThread(t.id)));
      return NextResponse.json({ ok: true, deleted: threads.length });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Delete single thread
  if (!id) return NextResponse.json({ error: "id or all=1 required" }, { status: 400 });
  try {
    await deleteThread(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
