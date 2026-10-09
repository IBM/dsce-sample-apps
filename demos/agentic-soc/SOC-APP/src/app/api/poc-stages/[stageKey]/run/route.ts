/**
 * POST /api/poc-stages/[stageKey]/run
 *
 * Thin pass-through to the Express backend on :3001.
 * Kept as a Route Handler (instead of a rewrite) to avoid the http-proxy 30 s
 * socket timeout — Route Handlers have no such limit in local dev.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const EXPRESS_BASE = process.env.BACKEND_URL
  ? process.env.BACKEND_URL.replace(/\/api.*$/, '')
  : 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageKey: string }> }
) {
  const { stageKey } = await params;
  const url = `${EXPRESS_BASE}/api/poc-stages/${encodeURIComponent(stageKey)}/run`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: req.body,
    // @ts-expect-error — Node.js fetch supports this to avoid buffering
    duplex: 'half',
    signal: AbortSignal.timeout(30_000),
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
  });
}
