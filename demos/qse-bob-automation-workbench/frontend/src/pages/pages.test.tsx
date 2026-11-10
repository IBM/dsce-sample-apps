import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BobConnectionPage } from './BobConnectionPage';
import { WorkspacePage } from './WorkspacePage';
import { LoginPage } from './LoginPage';
import { AppShell } from '../layouts/AppShell';
import { mockApi, renderWithProviders, withStatus } from '../test/utils';
import { useWorkspace } from '../stores/workspace';
import { useSession } from '../stores/session';

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  useWorkspace.setState({ promptDraft: '', activeRepositoryId: null, activeExecutionId: null });
});

const bobBase = { state: 'not_configured', configured: false, endpoint: null, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', authHeaderName: 'authorization', apiKeyHint: null, message: null, lastTestedAt: null, capabilities: null, mock: false };
const settings = { version: '1.0.0', streamMode: 'realtime', executionStrategy: 'shared-volume', githubAllowedHosts: ['github.com'], limits: { maxPromptChars: 20000, executionTimeoutMs: 1800000, maxConcurrentExecutions: 2 }, sharedMounts: [], encryptionKeyId: 'k1', session: { ttlMinutes: 480, idleMinutes: 60 } };

describe('BobConnectionPage', () => {
  it('saves config, masks the key, then tests the connection and shows capabilities', async () => {
    let current = { ...bobBase } as Record<string, unknown>;
    const { calls } = mockApi({
      'GET /bob/status': () => current,
      'GET /settings': () => settings,
      'POST /bob/connect': (b) => {
        current = { ...bobBase, configured: true, endpoint: (b as { endpoint: string }).endpoint, apiKeyHint: '••••1234', state: 'not_configured' };
        return current;
      },
      'POST /bob/test-connection': () => {
        current = {
          ...current,
          state: 'connected',
          message: 'Connected',
          capabilities: { adapter: 'rest-threads', runtimeReady: true, features: { streaming: true, cancellation: true, fileDownloads: true, threads: true, continuation: true }, limits: { timeoutMs: 300000, maxMessageCharacters: 20000, maxConcurrentRuns: 2, maxDownloadBytes: 1048576 } }
        };
        return current;
      }
    });
    const user = userEvent.setup();
    renderWithProviders(<BobConnectionPage />);

    const key = await screen.findByLabelText(/Bob API key/i, { selector: 'input' });
    expect(key).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /Test connection/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/Headless Bob address/i), 'http://headless-bob:3000');
    await user.type(key, 'super-secret-token-1234');
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    await waitFor(() => expect(calls.some((c) => c.path === 'POST /bob/connect')).toBe(true));
    expect(calls.find((c) => c.path === 'POST /bob/connect')!.body).toMatchObject({ endpoint: 'http://headless-bob:3000', apiKey: 'super-secret-token-1234' });
    // The key field is cleared after save and the page never shows the full key.
    await waitFor(() => expect(screen.getByLabelText(/Bob API key/i, { selector: 'input' })).toHaveValue(''));
    expect(document.body.textContent).not.toContain('super-secret-token-1234');
    expect(await screen.findByText('••••1234')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Test connection/i }));
    expect(await screen.findByText('Connected', { selector: '.cds--tag *, .cds--tag' })).toBeInTheDocument();
    expect(await screen.findByText(/Streaming events/)).toBeInTheDocument();
    expect(screen.getByText('5m 0s')).toBeInTheDocument();
  });

  it('shows the authentication failure state with the server message', async () => {
    mockApi({
      'GET /bob/status': () => ({ ...bobBase, configured: true, endpoint: 'http://b:3000', state: 'auth_failed', message: 'Headless Bob rejected the API key (HTTP 401).' }),
      'GET /settings': () => settings
    });
    renderWithProviders(<BobConnectionPage />);
    expect(await screen.findByText('Headless Bob rejected the API key (HTTP 401).')).toBeInTheDocument();
    expect(screen.getAllByText('Authentication failed').length).toBeGreaterThan(0);
  });

  it('offers only real protocols in realtime mode', async () => {
    mockApi({ 'GET /bob/status': () => bobBase, 'GET /settings': () => settings });
    const user = userEvent.setup();
    renderWithProviders(<BobConnectionPage />);
    await user.click(await screen.findByRole('button', { name: /Show protocol settings/i }));
    await user.click(screen.getByRole('combobox', { name: /Execution protocol/i }));
    expect(screen.queryByText(/Mock/i)).toBeNull();
    expect(screen.getAllByText(/REST threads API/).length).toBeGreaterThan(0);
  });

  it('lets the form be saved without an address in mock mode', async () => {
    const demoBob = { ...bobBase, configured: true, state: 'connected', mock: true, message: 'DEMO - RECORDED DATA: replay' };
    const { calls } = mockApi({
      'GET /bob/status': () => demoBob,
      'GET /settings': () => ({ ...settings, streamMode: 'mock' }),
      'POST /bob/connect': () => demoBob
    });
    const user = userEvent.setup();
    renderWithProviders(<BobConnectionPage />);
    const save = await screen.findByRole('button', { name: /Save configuration/i });
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.queryByText(/recorded data, not a live run/i)).toBeNull();
    await user.click(save);
    await waitFor(() => expect(calls.some((c) => c.path === 'POST /bob/connect')).toBe(true));
  });
});

describe('WorkspacePage pre-flight', () => {
  const repo = { id: 'r1', url: 'https://github.com/o/n', name: 'n', owner: 'o', branch: 'main', status: 'cloned', error: null, hasToken: false, commit: 'abc', fileCount: 3, lastClonedAt: null, createdAt: '2026-01-01T00:00:00Z', workspaceLabel: 'o/n', progress: [] };
  const qseValid = { status: 'valid', mode: 'manual', executablePath: '/opt/qse-cli/qse-cli', bobVisiblePath: '/opt/qse-cli/qse-cli', reachableFromBob: true, version: '1.2.3', validatedAt: null, message: null, versionArgs: ['--version'], strategy: 'shared-volume' };

  it('blocks Start until Bob, repo, QSE and prompt are all ready, then starts the execution', async () => {
    const created = { id: 'e1', status: 'queued', steps: [], warnings: [], prompt: 'p', promptSummary: 'p', repositoryName: 'n', mock: false };
    const { calls } = mockApi({
      'GET /bob/status': () => ({ ...bobBase, state: 'connected', configured: true }),
      'GET /repositories': () => ({ items: [repo] }),
      'GET /qse/status': () => qseValid,
      'GET /settings': () => settings,
      'GET /executions/prompts': () => ({ items: [] }),
      'POST /executions': () => created,
      'GET /executions/e1': () => created,
      'GET /executions/e1/logs': () => ({ items: [] })
    });
    vi.stubGlobal('EventSource', class { addEventListener() {} close() {} } as unknown as typeof EventSource);
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePage />);

    const start = await screen.findByRole('button', { name: /Start execution/i });
    await waitFor(() => expect(screen.getAllByLabelText('Ready').length).toBe(3));
    expect(start).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: /What would you like Headless Bob to do/i }), 'Analyse the repo');
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);

    await waitFor(() => expect(calls.find((c) => c.path === 'POST /executions')).toBeTruthy());
    expect(calls.find((c) => c.path === 'POST /executions')!.body).toEqual({ repositoryId: 'r1', prompt: 'Analyse the repo' });
  });

  it('keeps Start disabled when the QSE CLI is not validated', async () => {
    mockApi({
      'GET /bob/status': () => ({ ...bobBase, state: 'connected', configured: true }),
      'GET /repositories': () => ({ items: [repo] }),
      'GET /qse/status': () => ({ ...qseValid, status: 'invalid' }),
      'GET /settings': () => settings,
      'GET /executions/prompts': () => ({ items: [] })
    });
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePage />);
    await user.type(await screen.findByRole('textbox', { name: /What would you like Headless Bob to do/i }), 'x');
    await waitFor(() => expect(screen.getByText(/QSE CLI is validated and reachable/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Start execution/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Fix' })).toHaveAttribute('href', '/qse');
  });
});

describe('LoginPage', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('starts blank when the build sets no default credentials', () => {
    useSession.setState({ user: null, ready: true });
    renderWithProviders(<LoginPage />, '/login');
    expect(screen.getByLabelText('Username')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeDisabled();
  });

  it('prefills the credentials the build provides and signs in with one click', async () => {
    vi.stubEnv('VITE_DEFAULT_USERNAME', 'admin');
    vi.stubEnv('VITE_DEFAULT_PASSWORD', 'a-long-dev-password');
    useSession.setState({ user: null, ready: true });
    const login = vi.fn(() => ({ user: { id: '1', username: 'admin', role: 'admin' }, csrfToken: 'c' }));
    mockApi({ 'POST /auth/login': login });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, '/login');
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('a-long-dev-password');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(useSession.getState().user?.username).toBe('admin'));
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('signs in with typed credentials and stores the user in memory', async () => {
    useSession.setState({ user: null, ready: true });
    mockApi({ 'POST /auth/login': () => ({ user: { id: '1', username: 'admin', role: 'admin' }, csrfToken: 'c' }) });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, '/login');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'a-long-password');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(useSession.getState().user?.username).toBe('admin'));
  });

  it('shows the server error when credentials are wrong', async () => {
    useSession.setState({ user: null, ready: true });
    mockApi({ 'POST /auth/login': () => withStatus(401, { error: { code: 'invalid_credentials', message: 'Invalid username or password' } }) });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, '/login');
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
  });
});

describe('AppShell header stream mode', () => {
  const shellRoutes = (mode: 'mock' | 'realtime', mock: boolean) => ({
    'GET /bob/status': () => ({ ...bobBase, configured: mock, state: mock ? 'connected' : 'not_configured', mock }),
    'GET /settings': () => ({ ...settings, streamMode: mode }),
    'GET /qse/status': () => ({ status: 'not_configured' }),
    'GET /repositories': () => ({ items: [] })
  });

  it('shows STREAM_MODE=mock next to the Bob status and no page banner', async () => {
    useSession.getState().setSession({ id: '1', username: 'admin', role: 'admin' }, 'c');
    mockApi(shellRoutes('mock', true));
    renderWithProviders(<AppShell />);
    expect(await screen.findByText('STREAM_MODE=mock')).toBeInTheDocument();
    expect(screen.getByText(/Bob: Demo/)).toBeInTheDocument();
    expect(screen.queryByText(/DEMO — recorded data, not a live run/)).toBeNull();
  });

  it('shows no stream-mode tag in realtime', async () => {
    useSession.getState().setSession({ id: '1', username: 'admin', role: 'admin' }, 'c');
    mockApi(shellRoutes('realtime', false));
    renderWithProviders(<AppShell />);
    expect(await screen.findByText(/Bob:/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('STREAM_MODE=mock')).toBeNull());
  });
});
