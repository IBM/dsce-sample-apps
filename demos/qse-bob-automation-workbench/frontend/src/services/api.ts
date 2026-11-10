import type {
  Artifact,
  BobConnectInput,
  BobConnection,
  Execution,
  ExecutionLog,
  ExecutionStatus,
  Page,
  PromptHistoryItem,
  QseCandidate,
  QseConfig,
  Report,
  RepoValidation,
  Repository,
  Settings,
  User
} from '../types/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setCsrfToken = (t: string | null) => {
  csrfToken = t;
};
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the Workbench backend. Check your connection.');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; requestId?: string } } | undefined)?.error;
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') onUnauthorized?.();
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? `Request failed (HTTP ${res.status})`, err?.requestId);
  }
  return data as T;
}

const get = <T>(p: string) => request<T>('GET', p);
const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {});
const del = <T>(p: string) => request<T>('DELETE', p);

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    login: (username: string, password: string) => post<{ user: User; csrfToken: string }>('/auth/login', { username, password }),
    logout: () => post<void>('/auth/logout'),
    me: () => get<{ user: User; csrfToken: string }>('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) => post<void>('/auth/password', { currentPassword, newPassword })
  },
  bob: {
    status: () => get<BobConnection>('/bob/status'),
    connect: (input: BobConnectInput) => post<BobConnection>('/bob/connect', input),
    test: () => post<BobConnection>('/bob/test-connection'),
    disconnect: () => post<BobConnection>('/bob/disconnect')
  },
  repos: {
    list: () => get<{ items: Repository[] }>('/repositories'),
    get: (id: string) => get<Repository>(`/repositories/${id}`),
    validate: (b: { url: string; branch: string; token?: string }) => post<RepoValidation>('/repositories/validate', b),
    clone: (b: { url: string; branch: string; token?: string }) => post<Repository>('/repositories/clone', b),
    reclone: (id: string, b: { branch?: string; token?: string } = {}) => post<Repository>(`/repositories/${id}/reclone`, b),
    remove: (id: string) => del<void>(`/repositories/${id}`)
  },
  qse: {
    status: () => get<QseConfig>('/qse/status'),
    discover: () => get<{ candidates: QseCandidate[]; searched: { envPath: string | null; dirs: string[] } }>('/qse/discover'),
    configure: (b: { mode: 'auto' | 'manual'; path?: string; versionArgs?: string[] }) => post<QseConfig>('/qse/configure', b),
    validate: () => post<QseConfig>('/qse/validate')
  },
  executions: {
    list: (q: { search?: string; status?: ExecutionStatus | ''; sort?: string; direction?: string; page?: number; pageSize?: number }) =>
      get<Page<Execution>>(`/executions${qs(q)}`),
    get: (id: string) => get<Execution>(`/executions/${id}`),
    create: (b: { repositoryId: string; prompt: string }) => post<Execution>('/executions', b),
    cancel: (id: string) => post<Execution>(`/executions/${id}/cancel`),
    logs: (id: string, after = 0) => get<{ items: ExecutionLog[] }>(`/executions/${id}/logs${qs({ after })}`),
    report: (id: string) => get<Report>(`/executions/${id}/report`),
    artifacts: (id: string) => get<{ items: Artifact[] }>(`/executions/${id}/artifacts`),
    prompts: () => get<{ items: PromptHistoryItem[] }>('/executions/prompts'),
    streamUrl: (id: string, after = 0) => `/api/executions/${id}/stream${qs({ after })}`,
    artifactUrl: (id: string, artifactId: string) => `/api/executions/${id}/artifacts/${artifactId}/download`
  },
  reports: {
    get: (id: string) => get<Report>(`/reports/${id}`),
    downloadUrl: (id: string, format: 'markdown' | 'pdf' | 'json') => `/api/reports/${id}/download?format=${format}`,
    exportUrl: (id: string) => `/api/reports/${id}/export`
  },
  settings: {
    get: () => get<Settings>('/settings'),
    rotateSecrets: () => post<{ activeKeyId: string; bobApiKeyReencrypted: boolean; repositoryTokensReencrypted: number }>('/admin/rotate-secrets')
  }
};
