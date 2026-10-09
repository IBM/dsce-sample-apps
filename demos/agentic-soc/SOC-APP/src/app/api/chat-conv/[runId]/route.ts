/**
 * GET /api/chat-conv/[runId]
 *
 * Thin pass-through to the Express backend.
 * Kept as a Route Handler (not a next.config.js rewrite) so it bypasses
 * http-proxy's 30-second socket timeout on long-running WxO status checks.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const EXPRESS_BASE = process.env.EXPRESS_BASE_URL || 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const search = req.nextUrl.searchParams.toString();
  const url = `${EXPRESS_BASE}/api/chat-conv/${encodeURIComponent(runId)}${search ? `?${search}` : ''}`;

  const upstream = await fetch(url, {
    signal: AbortSignal.timeout(55_000),
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
  });
}
