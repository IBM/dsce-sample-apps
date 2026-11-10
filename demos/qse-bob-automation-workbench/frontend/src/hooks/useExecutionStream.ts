import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Execution, ExecutionLog } from '../types/api';
import { keys } from './queries';

const TERMINAL = ['completed', 'failed', 'cancelled'];
const MAX_LOGS = 5000;

export interface StreamState {
  execution: Execution | null;
  logs: ExecutionLog[];
  connected: boolean;
}

/** Subscribes to live execution events (SSE). Falls back to the persisted logs after completion. */
export function useExecutionStream(id: string | null): StreamState {
  const qc = useQueryClient();
  const [state, setState] = useState<StreamState>({ execution: null, logs: [], connected: false });
  const lastId = useRef(0);

  useEffect(() => {
    lastId.current = 0;
    setState({ execution: null, logs: [], connected: false });
    if (!id) return;
    let es: EventSource | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const open = () => {
      if (closed) return;
      es = new EventSource(api.executions.streamUrl(id, lastId.current), { withCredentials: true });
      es.onopen = () => setState((s) => ({ ...s, connected: true }));
      es.addEventListener('execution', (ev) => {
        const execution = JSON.parse((ev as MessageEvent).data) as Execution;
        setState((s) => ({ ...s, execution }));
        qc.setQueryData(keys.execution(id), execution);
        if (TERMINAL.includes(execution.status)) {
          void qc.invalidateQueries({ queryKey: ['executions'] });
          void qc.invalidateQueries({ queryKey: ['prompts'] });
        }
      });
      es.addEventListener('log', (ev) => {
        const log = JSON.parse((ev as MessageEvent).data) as ExecutionLog;
        if (log.id <= lastId.current) return;
        lastId.current = log.id;
        setState((s) => ({ ...s, logs: s.logs.length >= MAX_LOGS ? [...s.logs.slice(-MAX_LOGS + 1), log] : [...s.logs, log] }));
      });
      es.onerror = () => {
        setState((s) => ({ ...s, connected: false }));
        es?.close();
        const current = qc.getQueryData<Execution>(keys.execution(id));
        if (current && TERMINAL.includes(current.status)) return;
        retry = setTimeout(open, 2000);
      };
    };
    open();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [id, qc]);

  return state;
}
