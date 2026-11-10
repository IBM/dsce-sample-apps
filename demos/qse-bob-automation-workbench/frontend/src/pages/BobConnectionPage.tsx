import { useEffect, useState, type FormEvent } from 'react';
import { Button, Dropdown, InlineLoading, InlineNotification, PasswordInput, TextInput, Tile } from '@carbon/react';
import { Plug, Save, Unlink } from '@carbon/icons-react';
import { Card, KeyValues, PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { keys, useBob, useInvalidate, useMutation, useSettings } from '../hooks/queries';
import { useNotify } from '../hooks/useNotify';
import { api } from '../services/api';
import { formatBytes, formatDate, formatDuration } from '../services/format';
import type { BobAdapterKind, BobAuthMode } from '../types/api';

const ADAPTERS: Array<{ id: BobAdapterKind; label: string; help: string }> = [
  { id: 'rest-threads', label: 'Headless Bob REST threads API (recommended)', help: 'Threads, messages, runs, SSE events, cancellation and file download.' },
  { id: 'acp', label: 'Agent Communication Protocol (ACP 0.2.0)', help: 'Runs and events only. No file API, so workspace artifacts cannot be retrieved.' }
];
const AUTH_MODES: Array<{ id: BobAuthMode; label: string }> = [
  { id: 'bearer', label: 'Authorization: Bearer <key>' },
  { id: 'header', label: 'Custom header' },
  { id: 'none', label: 'None' }
];

export function BobConnectionPage() {
  const { data: bob, isLoading } = useBob();
  const { data: settings } = useSettings();
  const demo = settings?.streamMode === 'mock' || Boolean(bob?.mock);
  const invalidate = useInvalidate();
  const notify = useNotify();

  const [endpoint, setEndpoint] = useState('');
  const [adapter, setAdapter] = useState<BobAdapterKind>('rest-threads');
  const [apiBasePath, setApiBasePath] = useState('/api/v1');
  const [authMode, setAuthMode] = useState<BobAuthMode>('bearer');
  const [authHeaderName, setAuthHeaderName] = useState('authorization');
  const [apiKey, setApiKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!bob) return;
    setEndpoint(bob.endpoint ?? '');
    setAdapter(bob.adapter);
    setApiBasePath(bob.apiBasePath);
    setAuthMode(bob.authMode);
    setAuthHeaderName(bob.authHeaderName);
  }, [bob?.endpoint, bob?.adapter, bob?.apiBasePath, bob?.authMode, bob?.authHeaderName]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => invalidate(keys.bob);
  const save = useMutation({
    mutationFn: () => api.bob.connect({ endpoint: endpoint.trim(), adapter, apiBasePath: apiBasePath.trim(), authMode, authHeaderName: authHeaderName.trim(), ...(apiKey ? { apiKey } : {}) }),
    onSuccess: () => {
      setApiKey('');
      notify.success('Configuration saved', demo ? 'Demo mode: the address and key were not used or stored.' : 'The API key is stored encrypted on the server. Run Test Connection to verify.');
      refresh();
    },
    onError: (e) => notify.error(e, 'Could not save configuration')
  });
  const test = useMutation({
    mutationFn: api.bob.test,
    onSuccess: (r) => {
      refresh();
      if (r.state === 'connected') notify.success('Connected to Headless Bob');
      else notify.error(new Error(r.message ?? 'Connection failed'), 'Connection test failed');
    },
    onError: (e) => notify.error(e, 'Connection test failed')
  });
  const disconnect = useMutation({
    mutationFn: api.bob.disconnect,
    onSuccess: () => {
      notify.info('Disconnected', 'The stored connection and API key were removed.');
      setApiKey('');
      refresh();
    },
    onError: (e) => notify.error(e, 'Could not disconnect')
  });

  const busy = save.isPending || test.isPending || disconnect.isPending;
  const state = test.isPending ? 'connecting' : bob?.state ?? 'not_configured';
  const canSave = (demo || endpoint.trim().length > 0) && !busy;
  const caps = bob?.capabilities;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSave) save.mutate();
  };

  return (
    <div>
      <PageHeader title="Bob Connection" subtitle="Configure the Headless Bob container. The backend holds the API key encrypted and performs every call; the browser never talks to Headless Bob." />
      <div className="grid-2">
        <Card title="Connection settings" icon={<Plug size={20} />}>
          <form className="form-stack" onSubmit={onSubmit} aria-label="Bob connection settings">
            <TextInput
              id="bob-endpoint"
              labelText="Headless Bob address"
              placeholder="http://headless-bob:3000"
              helperText="HTTP or HTTPS endpoint of the Headless Bob service. Metadata and link-local addresses are always rejected; private networks must be allowed by the administrator."
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
            <PasswordInput
              id="bob-api-key"
              labelText="Bob API key"
              autoComplete="new-password"
              showPasswordLabel="Show API key"
              hidePasswordLabel="Hide API key"
              placeholder={bob?.apiKeyHint ? `Stored: ${bob.apiKeyHint} — leave blank to keep` : 'Service token (AUTH_TOKENS entry)'}
              helperText="Sent to the server over the session and stored AES-256-GCM encrypted. The full key is never shown again."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={authMode === 'none'}
            />
            <Button kind="ghost" size="sm" type="button" onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced}>
              {showAdvanced ? 'Hide' : 'Show'} protocol settings
            </Button>
            {showAdvanced && (
              <div className="form-stack">
                <Dropdown
                  id="bob-adapter"
                  titleText="Execution protocol"
                  label="Protocol"
                  items={ADAPTERS}
                  itemToString={(i: (typeof ADAPTERS)[number] | null) => i?.label ?? ''}
                  selectedItem={ADAPTERS.find((a) => a.id === adapter)}
                  helperText={ADAPTERS.find((a) => a.id === adapter)?.help}
                  onChange={({ selectedItem }: { selectedItem: (typeof ADAPTERS)[number] | null }) => selectedItem && setAdapter(selectedItem.id)}
                />
                <TextInput id="bob-base" labelText="API base path" helperText="Headless Bob default: /api/v1 (REST) or / (ACP)." value={apiBasePath} onChange={(e) => setApiBasePath(e.target.value)} />
                <Dropdown
                  id="bob-auth"
                  titleText="Authentication mechanism"
                  label="Authentication"
                  items={AUTH_MODES}
                  itemToString={(i: (typeof AUTH_MODES)[number] | null) => i?.label ?? ''}
                  selectedItem={AUTH_MODES.find((a) => a.id === authMode)}
                  onChange={({ selectedItem }: { selectedItem: (typeof AUTH_MODES)[number] | null }) => selectedItem && setAuthMode(selectedItem.id)}
                />
                {authMode === 'header' && <TextInput id="bob-header" labelText="Header name" value={authHeaderName} onChange={(e) => setAuthHeaderName(e.target.value)} />}
              </div>
            )}
            <div className="actions">
              <Button type="submit" renderIcon={Save} disabled={!canSave}>
                {save.isPending ? 'Saving…' : 'Save configuration'}
              </Button>
              <Button kind="secondary" type="button" renderIcon={Plug} disabled={busy || !bob?.configured} onClick={() => test.mutate()}>
                Test connection
              </Button>
              <Button kind="danger--tertiary" type="button" renderIcon={Unlink} disabled={busy || !bob?.configured} onClick={() => disconnect.mutate()}>
                Disconnect
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Connection status">
          {isLoading ? (
            <InlineLoading description="Loading status" />
          ) : (
            <div className="form-stack">
              <div className="row">
                <StatusTag status={state} />
                {(test.isPending || state === 'connecting') && <InlineLoading description="Contacting Headless Bob" />}
              </div>
              {bob?.message && state !== 'connected' && state !== 'not_configured' && (
                <InlineNotification kind="error" lowContrast hideCloseButton title={state === 'auth_failed' ? 'Authentication failed' : 'Connection failed'} subtitle={bob.message} />
              )}
              {bob?.message && state === 'connected' && <p className="step-source">{bob.message}</p>}
              <KeyValues
                rows={[
                  ['Address', bob?.endpoint],
                  ['Protocol', ADAPTERS.find((a) => a.id === bob?.adapter)?.label],
                  ['API key', bob?.apiKeyHint ?? 'Not stored'],
                  ['Last tested', formatDate(bob?.lastTestedAt)]
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      <div className="section" />
      <Card title="Supported capabilities" help="Reported by Headless Bob (GET /api/v1/capabilities). Shown only after a successful test.">
        {!caps ? (
          <Tile>No capabilities available. Test the connection to retrieve them.</Tile>
        ) : (
          <div className="grid-2">
            <KeyValues
              rows={[
                ['Runtime ready', caps.runtimeReady ? 'Yes' : `No${caps.runtimeReason ? ` — ${caps.runtimeReason}` : ''}`],
                ['Streaming events', caps.features.streaming ? 'Supported' : 'Not supported'],
                ['Cancellation', caps.features.cancellation ? 'Supported' : 'Not supported'],
                ['Workspace file download', caps.features.fileDownloads ? 'Supported' : 'Not supported'],
                ['Threads / continuation', `${caps.features.threads ? 'Yes' : 'No'} / ${caps.features.continuation ? 'Yes' : 'No'}`]
              ]}
            />
            <KeyValues
              rows={[
                ['Run timeout', caps.limits.timeoutMs ? formatDuration(caps.limits.timeoutMs) : 'Not reported'],
                ['Max message size', caps.limits.maxMessageCharacters ? `${caps.limits.maxMessageCharacters.toLocaleString()} characters` : 'Not reported'],
                ['Max concurrent runs', caps.limits.maxConcurrentRuns ?? 'Not reported'],
                ['Max download size', caps.limits.maxDownloadBytes ? formatBytes(caps.limits.maxDownloadBytes) : 'Not reported']
              ]}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
