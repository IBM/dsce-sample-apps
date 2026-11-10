import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ExecutionStatus } from '../types/api';

export const keys = {
  bob: ['bob'] as const,
  repos: ['repos'] as const,
  repo: (id: string) => ['repo', id] as const,
  qse: ['qse'] as const,
  qseDiscover: ['qse', 'discover'] as const,
  executions: (q: object) => ['executions', q] as const,
  execution: (id: string) => ['execution', id] as const,
  report: (id: string) => ['report', id] as const,
  prompts: ['prompts'] as const,
  settings: ['settings'] as const
};

export const useBob = () => useQuery({ queryKey: keys.bob, queryFn: api.bob.status, refetchInterval: (q) => (q.state.data?.state === 'connecting' ? 1500 : false) });
export const useQse = () => useQuery({ queryKey: keys.qse, queryFn: api.qse.status });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: api.settings.get, staleTime: 60_000 });
export const usePrompts = () => useQuery({ queryKey: keys.prompts, queryFn: api.executions.prompts });

export const useRepos = () =>
  useQuery({
    queryKey: keys.repos,
    queryFn: api.repos.list,
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === 'cloning' || r.status === 'validating') ? 1000 : false)
  });

export const useExecutions = (q: { search?: string; status?: ExecutionStatus | ''; sort?: string; direction?: string; page?: number; pageSize?: number }) =>
  useQuery({
    queryKey: keys.executions(q),
    queryFn: () => api.executions.list(q),
    placeholderData: (prev) => prev,
    refetchInterval: (query) => (query.state.data?.items.some((e) => ['queued', 'running', 'cancelling'].includes(e.status)) ? 3000 : false)
  });

export const useExecution = (id: string | null) =>
  useQuery({
    queryKey: keys.execution(id ?? 'none'),
    queryFn: () => api.executions.get(id!),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && ['queued', 'running', 'cancelling'].includes(q.state.data.status) ? 4000 : false)
  });

export const useReport = (id: string | null | undefined) =>
  useQuery({ queryKey: keys.report(id ?? 'none'), queryFn: () => api.reports.get(id!), enabled: !!id });

export function useInvalidate() {
  const qc = useQueryClient();
  return (...k: Array<readonly unknown[]>) => k.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
}

export { useMutation, useQueryClient };
