import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setCsrfToken, setUnauthorizedHandler } from './api';
import { mockApi, withStatus } from '../test/utils';

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
  setUnauthorizedHandler(null);
});

describe('api client', () => {
  it('sends the CSRF token on mutating requests only', async () => {
    const { fn } = mockApi({ 'GET /bob/status': () => ({ state: 'connected' }), 'POST /bob/test-connection': () => ({ state: 'connected' }) });
    setCsrfToken('tok-123');
    await api.bob.status();
    await api.bob.test();
    const [getInit, postInit] = fn.mock.calls.map((c) => c[1] as RequestInit);
    expect((getInit.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
    expect((postInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok-123');
    expect(getInit.credentials).toBe('same-origin');
  });

  it('maps API errors to ApiError with code and message', async () => {
    mockApi({ 'POST /bob/test-connection': () => withStatus(502, { error: { code: 'bob_unreachable', message: 'Cannot reach Bob', requestId: 'r1' } }) });
    await expect(api.bob.test()).rejects.toMatchObject({ name: 'ApiError', status: 502, code: 'bob_unreachable', message: 'Cannot reach Bob', requestId: 'r1' });
  });

  it('calls the unauthorized handler on 401 except for login', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockApi({
      'GET /bob/status': () => withStatus(401, { error: { code: 'unauthenticated', message: 'Sign in' } }),
      'POST /auth/login': () => withStatus(401, { error: { code: 'invalid_credentials', message: 'Bad' } })
    });
    await expect(api.bob.status()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await expect(api.auth.login('a', 'b')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(api.bob.status()).rejects.toMatchObject({ code: 'network_error' });
  });

  it('builds download URLs without embedding credentials', () => {
    expect(api.reports.downloadUrl('abc', 'pdf')).toBe('/api/reports/abc/download?format=pdf');
    expect(api.executions.streamUrl('e1', 5)).toBe('/api/executions/e1/stream?after=5');
  });
});
