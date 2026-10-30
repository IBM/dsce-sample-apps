import { NextRequest, NextResponse } from 'next/server';
import { getMockSupervisorChatResponse } from '@/data/mockPipelineData';

const EXPRESS_BASE = process.env.EXPRESS_BASE_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, threadId, offenseId } = body;

    const hasWxo = Boolean(process.env.WXO_URL && process.env.WXO_API_KEY && process.env.CONV_SUPERVISOR_AGENT_ID);

    if (hasWxo) {
      try {
        const upstream = await fetch(`${EXPRESS_BASE}/api/chat-conv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });
        if (upstream.ok) {
          const upstreamData = await upstream.json();
          return NextResponse.json(upstreamData);
        }
      } catch {
        // Fall back to mock response below
      }
    }

    // Mock Mode fallback
    const runId = `mock-conv-${Date.now().toString(36)}`;
    const newThreadId = threadId || `mock-thread-${Date.now().toString(36)}`;
    const startedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      runId,
      threadId: newThreadId,
      startedAt,
      mock: true,
      message: message || '',
      offenseId: offenseId || '167657',
    });
  } catch (err: any) {
    console.error('[chat-conv] error:', err?.message);
    return NextResponse.json({ success: false, error: 'Chat error' }, { status: 500 });
  }
}
