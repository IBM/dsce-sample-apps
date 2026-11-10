import { BoxDocument, Finding } from '../types';
import { GeneratedDemoPlan, GeneratedDemoAssets, GeneratedExecBrief } from './assetGenerator';

export interface HeadlessBobStatus {
  isOnline: boolean;
  url?: string;
  error?: string;
}

export interface HeadlessBobAnalysisResult {
  customerName?: string;
  relevantDocumentIds?: string[];
  findings?: Finding[];
  execBrief?: GeneratedExecBrief;
  demoPlan?: GeneratedDemoPlan;
  demoAssets?: GeneratedDemoAssets;
}

export interface HeadlessBobChatResult {
  answer: string;
  grounded: boolean;
  insufficientEvidence: boolean;
  supportingDocumentIds: string[];
}

/**
 * Check if the Headless Bob background service is currently reachable
 */
export async function checkHeadlessBobStatus(): Promise<HeadlessBobStatus> {
  try {
    const res = await fetch('/api/headless-bob/status');
    if (!res.ok) return { isOnline: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      isOnline: Boolean(data.ok),
      url: data.url,
      error: data.error
    };
  } catch (err: any) {
    return {
      isOnline: false,
      error: err?.message || 'Headless Bob is offline'
    };
  }
}

/**
 * Run full LLM synthesis via Headless Bob to analyze prompt and Box files
 */
export async function analyzeCustomerContextWithBob(
  prompt: string,
  documents: BoxDocument[]
): Promise<HeadlessBobAnalysisResult | null> {
  try {
    const res = await fetch('/api/headless-bob/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, documents })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[HeadlessBob] Analysis call returned status', res.status, errText);
      return null;
    }

    const data = await res.json();
    if (data.success && data.result) {
      console.log('[HeadlessBob] Successfully received LLM analysis result:', data.result);
      return data.result as HeadlessBobAnalysisResult;
    }
    return null;
  } catch (err) {
    console.warn('[HeadlessBob] Analysis request failed:', err);
    return null;
  }
}

/**
 * Chat with Headless Bob using live Box document context
 */
export async function askBobChat(
  question: string,
  documents: BoxDocument[],
  history: Array<{ role: string; content: string }> = []
): Promise<HeadlessBobChatResult> {
  try {
    const res = await fetch('/api/headless-bob/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, documents, history })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      answer: data.answer || 'Unable to generate response from Headless Bob.',
      grounded: data.grounded ?? true,
      insufficientEvidence: data.insufficientEvidence ?? false,
      supportingDocumentIds: data.supportingDocumentIds || []
    };
  } catch (err: any) {
    console.warn('[HeadlessBob] Chat request failed, falling back:', err);
    throw err;
  }
}
