import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

export function renderWithProviders(ui: ReactElement, route = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

type Handler = (body: unknown, url: URL, init: RequestInit) => unknown | { __status: number; body: unknown };
export const withStatus = (status: number, body: unknown) => ({ __status: status, body });

/** Installs a fetch mock routed by "METHOD /path". Unmatched requests fail the test loudly. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const key = `${method} ${url.pathname.replace(/^\/api/, '')}`;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: key, body });
    const h = routes[key];
    if (!h) throw new Error(`Unexpected request: ${key}`);
    const out = h(body, url, init) as { __status?: number; body?: unknown } | undefined;
    const status = out && typeof out === 'object' && '__status' in out ? (out.__status as number) : 200;
    const payload = out && typeof out === 'object' && '__status' in out ? out.body : out;
    return new Response(payload === undefined ? null : JSON.stringify(payload), { status: status === 200 && payload === undefined ? 204 : status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}
