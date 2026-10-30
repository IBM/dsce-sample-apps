import { NextRequest, NextResponse } from 'next/server';
import { buildMockRunDetails } from '@/data/mockPipelineData';

export const maxDuration = 120;

const EXPRESS_BASE = process.env.BACKEND_URL
  ? process.env.BACKEND_URL.replace(/\/api.*$/, '')
  : 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageKey: string }> }
) {
  const { stageKey } = await params;
  let bodyJson: any = {};
  let bodyText = '';

  try {
    bodyText = await req.text();
    bodyJson = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    bodyJson = {};
  }

  const prompt = bodyJson.prompt || '';
  const offenseMatch = prompt.match(/\b(1[0-9]{5})\b/);
  const offenseId = offenseMatch ? offenseMatch[1] : '167657';

  // Check if Watsonx Orchestrate is configured
  const hasWxo = Boolean(process.env.WXO_URL && process.env.WXO_API_KEY);

  if (hasWxo) {
    try {
      const url = `${EXPRESS_BASE}/api/poc-stages/${encodeURIComponent(stageKey)}/run`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyText,
        signal: AbortSignal.timeout(10_000),
      });

      if (upstream.ok) {
        const resText = await upstream.text();
        return new NextResponse(resText, {
          status: upstream.status,
          headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
        });
      }
    } catch {
      // Fall through to mock response
    }
  }

  // Self-contained Mock Fallback
  const startedAt = new Date().toISOString();
  const runId = `mock-run-${offenseId}-${stageKey}-${Date.now().toString(36)}`;
  const threadId = `mock-thread-${offenseId}-${stageKey}`;

  return NextResponse.json({
    success: true,
    runId,
    threadId,
    taskId: `mock-task-${stageKey}`,
    startedAt,
    mock: true,
  });
}
