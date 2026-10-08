/**
 * GET /api/poc-stages/[stageKey]/run/[runId]
 *
 * Thin pass-through to the Express backend on :3001.
 * Route Handler bypasses http-proxy's 30s socket timeout.
 * maxDuration 120s > Express REQUEST_TIMEOUT_MS (60s) to avoid racing with
 * a slow IAM token refresh.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const EXPRESS_BASE = process.env.BACKEND_URL
  ? process.env.BACKEND_URL.replace(/\/api.*$/, '')
  : 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stageKey: string; runId: string }> }
) {
  const { stageKey, runId } = await params;
  const search = req.nextUrl.searchParams.toString();
  const url = `${EXPRESS_BASE}/api/poc-stages/${encodeURIComponent(stageKey)}/run/${encodeURIComponent(runId)}${search ? `?${search}` : ''}`;

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(90_000),
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.code === 23;
    return NextResponse.json(
      {
        success: false,
        completed: false,
        status: 'running',
        error: isTimeout
          ? 'Status check timed out — agent is still running. Retrying…'
          : (err?.message ?? 'Upstream error'),
        retryable: true,
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
