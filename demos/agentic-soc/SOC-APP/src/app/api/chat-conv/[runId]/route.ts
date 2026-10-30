import { NextRequest, NextResponse } from 'next/server';
import { getMockSupervisorChatResponse } from '@/data/mockPipelineData';

export const maxDuration = 120;

const EXPRESS_BASE = process.env.EXPRESS_BASE_URL || 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const search = req.nextUrl.searchParams;
  const startedAt = search.get('startedAt') || new Date().toISOString();
  const threadId = search.get('threadId') || null;
  const offenseId = search.get('offenseId') || '167657';
  const queryMsg = search.get('message') || 'Analyze offense';

  // If mock runId or Express offline
  if (runId.startsWith('mock-')) {
    const outputText = getMockSupervisorChatResponse(queryMsg, offenseId);
    return NextResponse.json({
      success: true,
      completed: true,
      threadId: threadId || `mock-thread-${runId}`,
      runId,
      status: 'completed',
      outputText,
      analytics: {
        status: 'completed',
        durationMs: 780,
        toolCalls: 2,
        traceCount: 4,
        startedAt,
        updatedAt: new Date().toISOString(),
      },
      traces: [],
    });
  }

  const url = `${EXPRESS_BASE}/api/chat-conv/${encodeURIComponent(runId)}${search ? `?${search.toString()}` : ''}`;

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(55_000),
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  } catch {
    // If backend is not available, return mock completion
    const outputText = getMockSupervisorChatResponse('Analyze offense', offenseId);
    return NextResponse.json({
      success: true,
      completed: true,
      threadId: threadId || `mock-thread-${runId}`,
      runId,
      status: 'completed',
      outputText,
      analytics: {
        status: 'completed',
        durationMs: 820,
        toolCalls: 2,
        traceCount: 4,
        startedAt,
        updatedAt: new Date().toISOString(),
      },
      traces: [],
    });
  }
}
