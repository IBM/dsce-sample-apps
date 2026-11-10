import { ApiError } from '../services/api';
import { useToasts } from '../stores/notifications';

export function useNotify() {
  const push = useToasts((s) => s.push);
  return {
    success: (title: string, subtitle?: string) => push({ kind: 'success', title, subtitle }),
    info: (title: string, subtitle?: string) => push({ kind: 'info', title, subtitle }),
    error: (e: unknown, title = 'Something went wrong') => {
      const message = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      push({ kind: 'error', title, subtitle: message });
    }
  };
}
