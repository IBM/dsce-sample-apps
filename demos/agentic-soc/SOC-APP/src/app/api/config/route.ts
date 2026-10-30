import { NextResponse } from 'next/server';
import { DEFAULT_STAGES } from '@/data/defaultStages';

export async function GET() {
  const hasWxoUrl = Boolean(process.env.WXO_URL || process.env.WATSONX_SERVICE_URL);
  const hasWxoApiKey = Boolean(process.env.WXO_API_KEY || process.env.WATSONX_API_KEY);
  const serviceConfigured = hasWxoUrl && hasWxoApiKey;

  return NextResponse.json({
    success: true,
    serviceConfigured,
    stages: DEFAULT_STAGES,
    mode: serviceConfigured ? 'live_capable' : 'mock_default',
  });
}
