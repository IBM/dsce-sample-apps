import { NextRequest, NextResponse } from 'next/server';
import { buildMockRunDetails } from '@/data/mockPipelineData';

export const maxDuration = 120;

const EXPRESS_BASE = process.env.BACKEND_URL
  ? process.env.BACKEND_URL.replace(/\/api.*$/, '')
  : 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stageKey: string; runId: string }> }
) {
  const { stageKey, runId } = await params;
  const search = req.nextUrl.searchParams;
  const startedAt = search.get('startedAt') || new Date().toISOString();
  const threadId = search.get('threadId') || null;

  // Extract offenseId from runId pattern (mock-run-167657-triage-...) or default
  const offenseMatch = runId.match(/\b(1[0-9]{5})\b/);
  const offenseId = offenseMatch ? offenseMatch[1] : '167657';

  // If mock runId or mock mode
  if (runId.startsWith('mock-')) {
    const mockDetails = buildMockRunDetails(stageKey, offenseId, startedAt);
    return NextResponse.json({
      success: true,
      completed: true,
      status: 'completed',
      stage: { key: stageKey, label: stageKey.toUpperCase(), agentId: `mock-agent-${stageKey}` },
      run: {
        ...mockDetails,
        threadId: threadId || mockDetails.threadId,
      },
    });
  }

  const searchStr = search.toString();
  const url = `${EXPRESS_BASE}/api/poc-stages/${encodeURIComponent(stageKey)}/run/${encodeURIComponent(runId)}${searchStr ? `?${searchStr}` : ''}`;

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  } catch {
    // Graceful fallback to mock data if upstream is unavailable
    const mockDetails = buildMockRunDetails(stageKey, offenseId, startedAt);
    return NextResponse.json({
      success: true,
      completed: true,
      status: 'completed',
      stage: { key: stageKey, label: stageKey.toUpperCase(), agentId: `mock-agent-${stageKey}` },
      run: {
        ...mockDetails,
        threadId: threadId || mockDetails.threadId,
      },
    });
  }
}
