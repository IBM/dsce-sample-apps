import { useCallback, useEffect, useRef, useState } from 'react';
import { BoxDocument, Finding, WorkspaceContext, WorkspaceContextStatus } from '../types';
import { extractWorkspaceContext } from '../services/contextExtractor';

export interface UseWorkspaceContextResult {
  context: WorkspaceContext | null;
  status: WorkspaceContextStatus;
  /** Generic, user-safe error message when `status === 'error'`. */
  error: string | null;
  /** Re-runs the extraction. */
  refresh: () => void;
}

/**
 * Fetches/derives the Context tab content once `documents` are available and re-runs it
 * when the document list changes or `refresh()` is called.
 */
export function useWorkspaceContext(
  documents: BoxDocument[],
  mode: 'mock' | 'live_mcp',
  findings: Finding[] = []
): UseWorkspaceContextResult {
  const [context, setContext] = useState<WorkspaceContext | null>(null);
  const [status, setStatus] = useState<WorkspaceContextStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const findingsRef = useRef(findings);
  findingsRef.current = findings;

  useEffect(() => {
    if (documents.length === 0) {
      setContext(null);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(null);
    extractWorkspaceContext(documents, { mode, findings: findingsRef.current })
      .then(result => {
        if (cancelled) return;
        setContext(result);
        setStatus('ready');
      })
      .catch(err => {
        console.error('[Context] Extraction failed:', err);
        if (cancelled) return;
        setError('Could not build the context from the Box documents.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [documents, mode, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  return { context, status, error, refresh };
}
