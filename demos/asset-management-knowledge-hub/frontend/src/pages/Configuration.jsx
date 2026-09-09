import { useState, useEffect } from 'react';
import {
  Button,
  TextInput,
  PasswordInput,
  Select,
  SelectItem,
  Toggle,
  Tag,
  InlineNotification,
  InlineLoading,
  NumberInput,
  Tile,
} from '@carbon/react';
import {
  CheckmarkFilled, ErrorFilled, RadioButton, RadioButtonChecked,
  TrashCan, Add, CloudUpload, Globe, Box, Play, EventSchedule,
} from '@carbon/icons-react';
import axios from 'axios';
import { loadIngestSources, saveIngestSources } from '../utils/ingestSources';
import { defaultSecrets, setSecrets } from '../utils/ingestSecrets';
import { isDemoMode, enableDemoMode, disableDemoMode, getActions } from '../demo/demoStore';
import './Configuration.scss';

const MCP_URL    = import.meta.env.VITE_MCP_SERVER_URL  || '';
const INGEST_URL = import.meta.env.VITE_INGESTION_URL   || '';

const WATSONX_MODELS = [
  'ibm/granite-3-8b-instruct',
  'ibm/granite-13b-chat-v2',
  'ibm/granite-13b-instruct-v2',
  'ibm/granite-20b-multilingual',
  'meta-llama/llama-3-70b-instruct',
];

const EMBED_MODELS = [
  'ibm/slate-30m-english-rtrvr-v2',
  'ibm/slate-125m-english-rtrvr',
];

// ── Instance row ───────────────────────────────────────────────────────────────
function InstanceRow({ inst, isActive, onSelect, onTest, onDelete, testState }) {
  const statusClass = inst.status === 'active'   ? 'status-active'
                    : inst.status === 'inactive' ? 'status-inactive'
                    : 'status-unknown';

  return (
    <div className={`instance-row${isActive ? ' instance-row--active' : ''}`}>
      <div className={`status-indicator ${statusClass}`} />
      <div className="instance-info">
        <div className="instance-name">
          {inst.name}
          {inst.primary && <Tag type="purple" size="sm">Primary</Tag>}
          <Tag
            type={
              inst.status === 'active'   ? 'green' :
              inst.status === 'inactive' ? 'cool-gray' :
              'cool-gray'
            }
            size="sm"
          >
            {inst.status ?? 'unknown'}
          </Tag>
        </div>
        <div className="instance-url">{inst.url}</div>
        {testState?.user && (
          <div className="instance-meta">Connected as {testState.user}</div>
        )}
        {testState?.error && (
          <div className="instance-meta" style={{ color: '#da1e28' }}>{testState.error}</div>
        )}
      </div>
      <div className="instance-actions">
        {/* Select / active button */}
        {isActive ? (
          <Button kind="ghost" size="sm" renderIcon={RadioButtonChecked} iconDescription="Active" hasIconOnly
            disabled aria-label="Currently active instance" />
        ) : (
          <Button kind="ghost" size="sm" renderIcon={RadioButton} iconDescription="Set active"
            onClick={() => onSelect(inst.id)} aria-label="Set as active instance">
            Use
          </Button>
        )}
        {/* Test connection */}
        {testState?.loading ? (
          <Button kind="ghost" size="sm" disabled>
            <InlineLoading description="Testing…" status="active" />
          </Button>
        ) : testState?.connected === true ? (
          <Button kind="ghost" size="sm" renderIcon={CheckmarkFilled}
            onClick={() => onTest(inst.id)} aria-label="Connection successful">
            Connected
          </Button>
        ) : testState?.connected === false ? (
          <Button kind="ghost" size="sm" renderIcon={ErrorFilled}
            onClick={() => onTest(inst.id)} aria-label="Connection failed">
            Failed
          </Button>
        ) : (
          <Button kind="ghost" size="sm" onClick={() => onTest(inst.id)}>
            Test
          </Button>
        )}
        {/* Delete */}
        <Button kind="danger-ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly
          onClick={() => onDelete(inst.id)} aria-label="Remove instance" />
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Configuration() {
  // ── Ingestion source configs (non-secret, persisted to localStorage) ──────
  const [ingestSources, setIngestSources] = useState(() => loadIngestSources());
  // ── Ingestion secrets (in-memory only, never written to localStorage) ──────
  const [ingestSecrets, setIngestSecrets] = useState(() => defaultSecrets());

  const updateIngest = (source, patch) => {
    setIngestSources(prev => {
      const next = { ...prev, [source]: { ...prev[source], ...patch } };
      saveIngestSources(next);
      return next;
    });
  };

  const updateSecret = (source, patch) => {
    setIngestSecrets(prev => {
      const next = { ...prev, [source]: { ...prev[source], ...patch } };
      setSecrets(source, next[source]); // sync into module-level store for DataIngestion
      return next;
    });
  };

  const markConfigured = (source) => updateIngest(source, { configured: true });

  // ── Instance state ───────────────────────────────────────────────────────
  const [instances,   setInstances]   = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [testStates,  setTestStates]  = useState({});  // { [id]: { loading, connected, user, error } }
  const [instLoading, setInstLoading] = useState(true);
  const [instError,   setInstError]   = useState(null);

  // Add-instance form
  const [newName,     setNewName]     = useState('');
  const [newUrl,      setNewUrl]      = useState('');
  const [newApiKey,   setNewApiKey]   = useState('');
  const [newUser,     setNewUser]     = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [addLoading,  setAddLoading]  = useState(false);

  // ── Demo Mode state ──────────────────────────────────────────────────────
  const [demoMode,        setDemoMode]        = useState(() => isDemoMode());
  const [demoActionCount, setDemoActionCount] = useState(() => getActions().filter(a => a.demoOnly).length);

  const handleDemoToggle = (checked) => {
    const on = typeof checked === 'boolean' ? checked : checked?.target?.checked ?? checked;
    if (on) {
      enableDemoMode();
    } else {
      disableDemoMode();
    }
    setDemoMode(on);
    setDemoActionCount(getActions().filter(a => a.demoOnly).length);
  };

  // ── Other config state ───────────────────────────────────────────────────
  const [saved,           setSaved]           = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [cosStatusError,  setCosStatusError]  = useState(null); // non-null = fetch failed
  const [wxModel,         setWxModel]         = useState(WATSONX_MODELS[0]);
  const [embedModel,      setEmbedModel]      = useState(EMBED_MODELS[0]);
  const [maxTokens,       setMaxTokens]       = useState(1024);
  const [temperature,     setTemperature]     = useState(0.7);
  const [osHost,          setOsHost]          = useState('https://localhost:9200');
  const [osIndex,         setOsIndex]         = useState('maximo-documents');
  const [webIndex,        setWebIndex]        = useState('maximo_web_knowledge');
  const [verifySSL,       setVerifySSL]       = useState(false);
  // OpenSearch direct connection test (proxied through /opensearch-api in dev)
  const [osTestState,     setOsTestState]     = useState(null); // null | 'loading' | 'ok' | 'error'
  const [osTestMsg,       setOsTestMsg]       = useState('');
  const [osMaskedHost,    setOsMaskedHost]    = useState('');
  const [enableMaximo,    setEnableMaximo]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('mkh_enable_maximo') ?? 'true'); } catch { return true; }
  });
  const [enableDocs,      setEnableDocs]      = useState(() => {
    try { return JSON.parse(localStorage.getItem('mkh_enable_docs') ?? 'true'); } catch { return true; }
  });
  const [enableWeb,       setEnableWeb]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('mkh_enable_web') ?? 'true'); } catch { return true; }
  });
  const [enableSynth,     setEnableSynth]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('mkh_enable_synth') ?? 'true'); } catch { return true; }
  });
  const [maxResults,      setMaxResults]      = useState(() => {
    try { return JSON.parse(localStorage.getItem('mkh_max_results') ?? '5'); } catch { return 5; }
  });
  // OpenSearch live instance info (populated on successful check)
  const [osClusterStatus, setOsClusterStatus] = useState('');   // 'green' | 'yellow' | 'red'
  // Kafka connection state
  const [kafkaTestState,  setKafkaTestState]  = useState(null); // null | 'loading' | 'ok' | 'error' | 'unconfigured'
  const [kafkaTopics,     setKafkaTopics]     = useState([]);
  const [kafkaError,      setKafkaError]      = useState('');


  // Load instances on mount. Only auto-test instances whose status is still
  // 'unknown' (i.e. freshly loaded from the file or never tested this session).
  // This avoids hammering Maximo on every Configuration page visit.
  useEffect(() => {
    (async () => {
      setInstLoading(true);
      setInstError(null);
      let loaded = [];
      try {
        const { data } = await axios.get(`${MCP_URL}/api/instances`);
        loaded = data.instances || [];
        setInstances(loaded);
        setActiveId(data.activeId || null);
      } catch {
        loaded = [{
          id: 'env-default',
          name: 'Production Maximo',
          url: '',
          api_key: '',
          status: 'unknown',
          primary: true,
        }];
        setInstances(loaded);
        setActiveId('env-default');
        setInstError('Cannot reach MCP server. Showing local defaults.');
      } finally {
        setInstLoading(false);
      }
      // Only auto-test instances whose status is unknown (first load / fresh from file).
      // Instances that were already tested this session keep their result.
      loaded
        .filter(inst => !inst.status || inst.status === 'unknown')
        .forEach(inst => handleTestInstance(inst.id));
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Instance actions ─────────────────────────────────────────────────────
  const handleSelectInstance = async (id) => {
    try {
      await axios.post(`${MCP_URL}/api/instances/${id}/select`);
      setActiveId(id);
      setInstances(prev => prev.map(i => ({ ...i, isActive: i.id === id, primary: i.id === id })));
    } catch {
      setSaveError('Failed to switch active instance.');
    }
  };

  const handleTestInstance = async (id) => {
    setTestStates(p => ({ ...p, [id]: { loading: true } }));
    try {
      const { data } = await axios.post(`${MCP_URL}/api/instances/${id}/test`);
      setTestStates(p => ({ ...p, [id]: {
        loading: false,
        connected: data.connected,
        user: data.user,
        error: data.error,
      }}));
      // Refresh status from server
      setInstances(prev => prev.map(i => i.id === id ? { ...i, status: data.status || i.status } : i));
    } catch (err) {
      setTestStates(p => ({ ...p, [id]: {
        loading: false, connected: false,
        error: err?.response?.data?.detail || 'Connection test failed',
      }}));
    }
  };

  const handleDeleteInstance = async (id) => {
    try {
      await axios.delete(`${MCP_URL}/api/instances/${id}`);
      setInstances(prev => prev.filter(i => i.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      setSaveError('Failed to remove instance.');
    }
  };

  const handleAddInstance = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    setAddLoading(true);
    try {
      const { data: added } = await axios.post(`${MCP_URL}/api/instances`, {
        name: newName.trim(),
        url: newUrl.trim(),
        api_key: newApiKey.trim(),
        username: newUser.trim(),
        password: newPass,
      });
      // Refresh instances list after successful add
      const { data } = await axios.get(`${MCP_URL}/api/instances`);
      setInstances(data.instances || []);
      setActiveId(data.activeId || null);
      setNewName(''); setNewUrl(''); setNewApiKey(''); setNewUser(''); setNewPass('');
      // Auto-test the newly added instance immediately so its status is shown
      if (added?.id) handleTestInstance(added.id);
    } catch (err) {
      setSaveError(err?.response?.data?.detail || 'Failed to add instance to MCP server.');
    } finally {
      setAddLoading(false);
    }
  };

  // ── OpenSearch health check via MCP server ───────────────────────────────
  const handleTestOpenSearch = async () => {
    setOsTestState('loading');
    setOsTestMsg('');
    setOsMaskedHost('');
    setOsClusterStatus('');
    try {
      const { data } = await axios.get(`${MCP_URL}/api/opensearch/status`);
      if (data.connected) {
        setOsTestState('ok');
        setOsTestMsg('');
        setOsMaskedHost(data.maskedHost || '');
        setOsClusterStatus(data.clusterStatus || '');
        setOsHost(data.host);
      } else {
        setOsTestState('error');
        setOsTestMsg(data.error || 'Could not reach OpenSearch');
      }
    } catch (err) {
      setOsTestState('error');
      setOsTestMsg(err?.response?.data?.detail || err.message || 'Could not reach MCP server');
    }
  };

  // Auto-check the OpenSearch connection on load so the status dot reflects
  // reality without requiring a manual click (mirrors the Maximo instances behavior).
  useEffect(() => {
    handleTestOpenSearch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Kafka connection check via MCP server ────────────────────────────────
  const handleTestKafka = async () => {
    setKafkaTestState('loading');
    setKafkaTopics([]);
    setKafkaError('');
    try {
      const { data } = await axios.get(`${MCP_URL}/api/kafka/status`);
      if (!data.configured) {
        setKafkaTestState('unconfigured');
      } else if (data.connected) {
        setKafkaTestState('ok');
        setKafkaTopics(data.topics || []);
        updateIngest('confluent', { configured: true });
      } else {
        setKafkaTestState('error');
        setKafkaError(data.error || 'Could not reach Kafka cluster');
        updateIngest('confluent', { configured: true });
      }
    } catch (err) {
      setKafkaTestState('error');
      setKafkaError(err?.response?.data?.detail || err.message || 'Could not reach MCP server');
    }
  };

  useEffect(() => {
    handleTestKafka();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── COS status check via ingestion server ───────────────────────────────
  // On mount, ask the ingestion server whether COS_API_KEY + COS_BUCKET_NAME
  // are set. If yes, auto-mark the IBM COS block as configured and populate
  // the read-only display fields (bucket, endpoint, region) from the server.
  // No credentials are sent back to the browser — only non-secret values.
  useEffect(() => {
    // Retry up to 3 times with a 3 s gap to handle Code Engine cold-start 502s.
    let cancelled = false;
    (async () => {
      const MAX_ATTEMPTS = 3;
      const RETRY_DELAY_MS = 3000;
      let lastErr = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const { data } = await axios.get(`${INGEST_URL}/api/cos/status`);
          if (cancelled) return;
          setCosStatusError(null);
          if (data.iamConfigured) {
            updateIngest('cos', {
              configured: true,
              ...(data.bucketName && { bucket:   data.bucketName }),
              ...(data.endpoint   && { endpoint: data.endpoint }),
              ...(data.region     && { region:   data.region }),
            });
          }
          return; // success — stop retrying
        } catch (err) {
          lastErr = err;
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }
      // All attempts exhausted — surface the error
      if (!cancelled) {
        const msg = lastErr?.response?.data?.detail || lastErr?.message || 'Could not reach ingestion service';
        setCosStatusError(msg);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="config-page">

      {/* ── Page title ──────────────────────────────────────────────────── */}
      <div className="config-page-title">
        <h2>Settings</h2>
        <p>Manage Maximo instances, AI models, OpenSearch, ingestion source credentials, and agent feature flags.</p>
      </div>

      {saved && (
        <InlineNotification kind="success" title="Saved — " subtitle="Configuration updated."
          onCloseButtonClick={() => setSaved(false)} className="save-notification" />
      )}
      {saveError && (
        <InlineNotification kind="error" title="Error — " subtitle={saveError}
          onCloseButtonClick={() => setSaveError(null)} className="save-notification" />
      )}
      {instError && (
        <InlineNotification kind="warning" title="MCP Server — " subtitle={instError}
          onCloseButtonClick={() => setInstError(null)} className="save-notification" />
      )}

      {/* ── Maximo Instances ────────────────────────────────────────────── */}
      <section className="config-section">
        <h3 className="section-heading">Maximo Instances</h3>
        <Tile className="config-tile">
          <div className="tile-intro">
            Configure one or more Maximo Manage instances. The <strong>active</strong> instance
            is used for all live data queries. Click <em>Use</em> to switch the active instance,
            or <em>Test</em> to verify connectivity.
          </div>

          {/* Instance list */}
          {instLoading ? (
            <div style={{ padding: '1rem 0' }}>
              <InlineLoading description="Loading instances from MCP server…" status="active" />
            </div>
          ) : (
            <div className="instance-list">
              {instances.length === 0 && (
                <div style={{ padding: '1rem 1.25rem', color: 'var(--cds-text-secondary)', fontSize: '0.85rem' }}>
                  No instances configured. Add one below.
                </div>
              )}
              {instances.map(inst => (
                <InstanceRow
                  key={inst.id}
                  inst={inst}
                  isActive={inst.id === activeId}
                  testState={testStates[inst.id]}
                  onSelect={handleSelectInstance}
                  onTest={handleTestInstance}
                  onDelete={handleDeleteInstance}
                />
              ))}
            </div>
          )}

          {/* Add instance form */}
          <div className="add-instance-form">
            <h4 className="subsection-heading">Add instance</h4>
            <div className="add-row-2col">
              <TextInput id="new-inst-name" labelText="Instance name"
                placeholder="e.g. Production Maximo"
                value={newName} onChange={e => setNewName(e.target.value)} />
              <TextInput id="new-inst-url" labelText="REST API URL"
                placeholder="https://maximo.company.com/maximo/api"
                value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            </div>
            <div className="add-row-3col" style={{ marginTop: '0.75rem' }}>
              <PasswordInput id="new-api-key" labelText="API Key (preferred)"
                placeholder="Leave blank if using username/password"
                value={newApiKey} onChange={e => setNewApiKey(e.target.value)} />
              <TextInput id="new-user" labelText="Username (fallback)"
                placeholder="maxadmin"
                value={newUser} onChange={e => setNewUser(e.target.value)} />
              <PasswordInput id="new-pass" labelText="Password (fallback)"
                placeholder="••••••••"
                value={newPass} onChange={e => setNewPass(e.target.value)} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Button kind="primary" renderIcon={Add}
                onClick={handleAddInstance}
                disabled={!newName.trim() || !newUrl.trim() || addLoading}>
                {addLoading ? 'Adding…' : 'Add instance'}
              </Button>
            </div>
          </div>
        </Tile>
      </section>

      {/* ── watsonx AI ──────────────────────────────────────────────────── */}
      <section className="config-section">
        <h3 className="section-heading">watsonx AI</h3>
        <div className="two-col">
          <Tile className="config-tile">
            <h4 className="subsection-heading">Model selection</h4>
            <div className="field-list">
              <div className="field-row">
                <Select id="wx-model" labelText="Generation model" value={wxModel}
                  onChange={e => setWxModel(e.target.value)}>
                  {WATSONX_MODELS.map(m => <SelectItem key={m} value={m} text={m} />)}
                </Select>
              </div>
              <div className="field-row field-row--last">
                <Select id="embed-model" labelText="Embedding model" value={embedModel}
                  onChange={e => setEmbedModel(e.target.value)}>
                  {EMBED_MODELS.map(m => <SelectItem key={m} value={m} text={m} />)}
                </Select>
              </div>
            </div>
          </Tile>
          <Tile className="config-tile">
            <h4 className="subsection-heading">Generation parameters</h4>
            <div className="field-list">
              <div className="field-row">
                <NumberInput id="max-tokens" label="Max new tokens" value={maxTokens}
                  min={64} max={4096} step={64}
                  onChange={(_, { value }) => setMaxTokens(value)} />
              </div>
              <div className="field-row field-row--last">
                <NumberInput id="temperature" label="Temperature" value={temperature}
                  min={0} max={2} step={0.05}
                  onChange={(_, { value }) => setTemperature(value)} />
              </div>
            </div>
          </Tile>
        </div>
      </section>

      {/* ── OpenSearch ──────────────────────────────────────────────────── */}
      <section className="config-section">
        <h3 className="section-heading">OpenSearch</h3>
        <div className="tile-intro-standalone">
          Local development: run <code>bash backend/opensearch/start.sh start</code> then
          <code>bash backend/opensearch/setup-indexes.sh</code> to start the Podman container.
          The default settings below match the local Podman setup.
        </div>
        <div className="two-col">
          <Tile className="config-tile">
            <h4 className="subsection-heading">Connection</h4>

            {/* ── Live status row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <div className={`status-indicator ${
                osTestState === 'ok'      ? 'status-active' :
                osTestState === 'error'   ? 'status-error'  :
                osTestState === 'loading' ? 'status-unknown' :
                'status-unknown'
              }`} />
              <Tag
                type={osTestState === 'ok' ? 'green' : osTestState === 'error' ? 'red' : 'cool-gray'}
                size="sm"
              >
                {osTestState === 'loading' ? 'Checking…' :
                 osTestState === 'ok'      ? 'Connected' :
                 osTestState === 'error'   ? 'Disconnected' :
                 'Unknown'}
              </Tag>
              {osTestState === 'ok' && osMaskedHost && (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.75rem',
                  color: '#0043ce',
                  background: '#edf4ff',
                  border: '1px solid #c9d4f5',
                  borderRadius: '4px',
                  padding: '1px 6px',
                }}>
                  {osMaskedHost}
                </span>
              )}
              {osTestState === 'error' && osTestMsg && (
                <span style={{ fontSize: '0.75rem', color: '#da1e28' }}>{osTestMsg}</span>
              )}
            </div>

            <div className="field-list">
              <div className="field-row">
                <TextInput id="os-host" labelText="Host URL" value={osHost}
                  onChange={e => setOsHost(e.target.value)}
                  helperText="e.g. https://localhost:9200 for local Podman" />
              </div>
              <div className="toggle-row">
                <Toggle id="verify-ssl" labelText="Verify SSL certificate"
                  labelA="Off" labelB="On" toggled={verifySSL} onToggle={setVerifySSL} />
              </div>
              <div className="field-row field-row--last" style={{ paddingTop: '0.75rem' }}>
                <Button
                  kind="tertiary"
                  size="sm"
                  onClick={handleTestOpenSearch}
                  disabled={osTestState === 'loading'}
                >
                  {osTestState === 'loading' ? 'Testing…' : 'Test connection'}
                </Button>
              </div>
            </div>
          </Tile>
          <Tile className="config-tile">
            <h4 className="subsection-heading">Index names</h4>
            <div className="field-list">
              <div className="field-row">
                <TextInput id="os-index" labelText="Documents index" value={osIndex}
                  onChange={e => setOsIndex(e.target.value)}
                  helperText="Created by: bash backend/opensearch/setup-indexes.sh" />
              </div>
              <div className="field-row field-row--last">
                <TextInput id="web-index" labelText="Web knowledge index" value={webIndex}
                  onChange={e => setWebIndex(e.target.value)}
                  helperText="Created by: bash backend/opensearch/setup-indexes.sh" />
              </div>
            </div>
          </Tile>
        </div>
      </section>

      {/* ── Agent Features ──────────────────────────────────────────────── */}
      <section className="config-section">
        <h3 className="section-heading">Agent Features</h3>
        <div className="two-col">
          <Tile className="config-tile">
            <h4 className="subsection-heading">Data sources</h4>
            <div className="toggle-list">
              <div className="toggle-row">
                <Toggle id="en-maximo" labelText="Maximo Live Data" labelA="Disabled" labelB="Enabled"
                  toggled={enableMaximo} onToggle={v => { const b = typeof v === 'boolean' ? v : v?.target?.checked ?? v; setEnableMaximo(b); localStorage.setItem('mkh_enable_maximo', JSON.stringify(b)); }} />
              </div>
              <div className="toggle-row">
                <Toggle id="en-docs" labelText="Document RAG" labelA="Disabled" labelB="Enabled"
                  toggled={enableDocs} onToggle={v => { const b = typeof v === 'boolean' ? v : v?.target?.checked ?? v; setEnableDocs(b); localStorage.setItem('mkh_enable_docs', JSON.stringify(b)); }} />
              </div>
              <div className="toggle-row toggle-row--last">
                <Toggle id="en-web" labelText="Web Knowledge" labelA="Disabled" labelB="Enabled"
                  toggled={enableWeb} onToggle={v => { const b = typeof v === 'boolean' ? v : v?.target?.checked ?? v; setEnableWeb(b); localStorage.setItem('mkh_enable_web', JSON.stringify(b)); }} />
              </div>
            </div>
          </Tile>
          <Tile className="config-tile">
            <h4 className="subsection-heading">Response options</h4>
            <div className="toggle-list">
              <div className="toggle-row">
                <Toggle id="en-synth" labelText="Multi-source synthesis" labelA="Disabled" labelB="Enabled"
                  toggled={enableSynth} onToggle={v => { const b = typeof v === 'boolean' ? v : v?.target?.checked ?? v; setEnableSynth(b); localStorage.setItem('mkh_enable_synth', JSON.stringify(b)); }} />
              </div>
              <div className="toggle-row toggle-row--last">
                <NumberInput id="max-results" label="Max results per source" value={maxResults}
                  min={1} max={20} onChange={(_, { value }) => { setMaxResults(value); localStorage.setItem('mkh_max_results', value); }} />
              </div>
            </div>
          </Tile>
        </div>
      </section>

      {/* ── Ingestion Sources ───────────────────────────────────────────── */}
      <section className="config-section">
        <h3 className="section-heading">Ingestion Sources</h3>
        <div className="tile-intro-standalone">
          Configure credentials for each data source once here. The <strong>Data Ingestion</strong> tab
          will use these saved settings — you won't need to re-enter credentials every time you run a pipeline.
        </div>

        {/* IBM COS — auto-configured from server env vars, no manual step needed */}
        <div className="ingest-source-config-block">
          <div className="ingest-source-config-header">
            <CloudUpload size={18} />
            <span className="ingest-source-config-title">IBM Cloud Object Storage</span>
            {ingestSources.cos.configured
              ? <Tag type="green" size="sm">Configured</Tag>
              : <Tag type="gray"  size="sm">Not configured</Tag>}
          </div>
          {ingestSources.cos.configured ? (
            <>
              <div className="field-list" style={{ marginBottom: '0.75rem' }}>
                <div className="field-row">
                  <TextInput id="cos-cfg-bucket" labelText="Bucket" readOnly
                    value={ingestSources.cos.bucket || '—'} />
                </div>
                <div className="field-row">
                  <TextInput id="cos-cfg-endpoint" labelText="Endpoint" readOnly
                    value={ingestSources.cos.endpoint || '—'} />
                </div>
                <div className="field-row field-row--last">
                  <TextInput id="cos-cfg-prefix" labelText="Default prefix (folder path)"
                    placeholder="documents/"
                    value={ingestSources.cos.prefix}
                    onChange={e => updateIngest('cos', { prefix: e.target.value })} />
                </div>
              </div>
              <p className="ingest-source-config-note">
                Bucket, API key, endpoint, and region are read from <code>COS_*</code> env vars on the server.
                Auth uses IAM API key — no HMAC credentials required.
              </p>
            </>
          ) : (
            <p className="ingest-source-config-note" style={{ color: '#da1e28' }}>
              {cosStatusError
                ? <>Cannot reach ingestion service: <code>{cosStatusError}</code></>
                : <>Not detected. Set <code>COS_API_KEY</code> and <code>COS_BUCKET_NAME</code> in the server <code>.env</code> file and restart the ingestion service.</>
              }
            </p>
          )}
        </div>

        {/* Web / URLs */}
        <div className="ingest-source-config-block">
          <div className="ingest-source-config-header">
            <Globe size={18} />
            <span className="ingest-source-config-title">Web Pages / URLs</span>
            {ingestSources.web.configured
              ? <Tag type="green" size="sm">Configured</Tag>
              : <Tag type="gray"  size="sm">Not configured</Tag>}
          </div>
          <div className="two-col">
            <Tile className="config-tile">
              <h4 className="subsection-heading">Default seed URLs</h4>
              <div className="field-list">
                <div className="field-row field-row--last">
                  <TextInput id="web-cfg-urls" labelText="URLs (one per line)"
                    placeholder="https://www.ibm.com/docs/en/maximo"
                    value={ingestSources.web.urls}
                    onChange={e => updateIngest('web', { urls: e.target.value })} />
                </div>
              </div>
            </Tile>
            <Tile className="config-tile">
              <h4 className="subsection-heading">Crawl defaults</h4>
              <div className="field-list">
                <div className="field-row">
                  <NumberInput id="web-cfg-depth" label="Max link depth" min={0} max={5}
                    value={ingestSources.web.maxDepth}
                    onChange={(_, { value }) => updateIngest('web', { maxDepth: value })} />
                </div>
                <div className="field-row">
                  <NumberInput id="web-cfg-pages" label="Max pages" min={1} max={200}
                    value={ingestSources.web.maxPages}
                    onChange={(_, { value }) => updateIngest('web', { maxPages: value })} />
                </div>
                <div className="field-row">
                  <TextInput id="web-cfg-selector" labelText="CSS selector (optional)"
                    placeholder="article.content"
                    value={ingestSources.web.selector}
                    onChange={e => updateIngest('web', { selector: e.target.value })} />
                </div>
                <div className="field-row field-row--last">
                  <TextInput id="web-cfg-category" labelText="Default document category"
                    value={ingestSources.web.category}
                    onChange={e => updateIngest('web', { category: e.target.value })} />
                </div>
              </div>
            </Tile>
          </div>
          <Button kind="primary" size="sm" renderIcon={CheckmarkFilled}
            style={{ marginTop: '1rem', minWidth: '200px' }}
            onClick={() => markConfigured('web')}
            disabled={!ingestSources.web.urls.trim()}>
            Save web defaults
          </Button>
        </div>

        {/* Confluent / Apache Kafka */}
        <div className="ingest-source-config-block">
          <div className="ingest-source-config-header">
            <EventSchedule size={18} />
            <span className="ingest-source-config-title">Confluent / Apache Kafka</span>
            {ingestSources.confluent?.configured
              ? <Tag type="green" size="sm">Configured</Tag>
              : <Tag type="gray"  size="sm">Not configured</Tag>}
          </div>
          <div className="ingest-source-config-note">
            Stream real-time events from Confluent Cloud or a self-managed Kafka cluster into the knowledge index.
            API key and secret are session-only and never stored in the browser.
          </div>

          {/* ── Live status row (mirrors OpenSearch) ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div className={`status-indicator ${
              kafkaTestState === 'ok'           ? 'status-active'  :
              kafkaTestState === 'error'        ? 'status-error'   :
              kafkaTestState === 'unconfigured' ? 'status-unknown' :
              'status-unknown'
            }`} />
            <Tag
              type={
                kafkaTestState === 'ok'           ? 'green'     :
                kafkaTestState === 'error'        ? 'red'       :
                kafkaTestState === 'unconfigured' ? 'cool-gray' :
                'cool-gray'
              }
              size="sm"
            >
              {kafkaTestState === 'loading'      ? 'Checking…'     :
               kafkaTestState === 'ok'           ? 'Connected'     :
               kafkaTestState === 'error'        ? 'Disconnected'  :
               kafkaTestState === 'unconfigured' ? 'Not configured':
               'Unknown'}
            </Tag>
            {kafkaTestState === 'error' && kafkaError && (
              <span style={{ fontSize: '0.75rem', color: '#da1e28' }}>{kafkaError}</span>
            )}
            <Button kind="ghost" size="sm"
              onClick={handleTestKafka}
              disabled={kafkaTestState === 'loading'}
              style={{ marginLeft: 'auto' }}
            >
              {kafkaTestState === 'loading' ? 'Testing…' : 'Test connection'}
            </Button>
          </div>

          <div className="two-col">
            {/* Connection tile */}
            <Tile className="config-tile">
              <h4 className="subsection-heading">Cluster connection</h4>
              <div className="field-list">
                <div className="field-row">
                  <TextInput id="confluent-bootstrap" labelText="Bootstrap servers"
                    placeholder="pkc-abc12.us-east-1.aws.confluent.cloud:9092"
                    value={ingestSources.confluent?.bootstrapServers || ''}
                    onChange={e => updateIngest('confluent', { bootstrapServers: e.target.value })} />
                </div>
                <div className="field-row">
                  <Select id="confluent-protocol" labelText="Security protocol"
                    value={ingestSources.confluent?.securityProtocol || 'SASL_SSL'}
                    onChange={e => updateIngest('confluent', { securityProtocol: e.target.value })}>
                    <SelectItem value="SASL_SSL"      text="SASL_SSL (Confluent Cloud)" />
                    <SelectItem value="SASL_PLAINTEXT" text="SASL_PLAINTEXT (internal)" />
                    <SelectItem value="SSL"            text="SSL only" />
                    <SelectItem value="PLAINTEXT"      text="PLAINTEXT (dev/local)" />
                  </Select>
                </div>
                <div className="field-row field-row--last">
                  <Select id="confluent-sasl" labelText="SASL mechanism"
                    value={ingestSources.confluent?.saslMechanism || 'PLAIN'}
                    onChange={e => updateIngest('confluent', { saslMechanism: e.target.value })}>
                    <SelectItem value="PLAIN"         text="PLAIN (Confluent Cloud)" />
                    <SelectItem value="SCRAM-SHA-256" text="SCRAM-SHA-256" />
                    <SelectItem value="SCRAM-SHA-512" text="SCRAM-SHA-512" />
                    <SelectItem value="GSSAPI"        text="GSSAPI / Kerberos" />
                  </Select>
                </div>
              </div>
            </Tile>

            {/* Credentials tile */}
            <Tile className="config-tile">
              <h4 className="subsection-heading">API credentials</h4>
              <p className="ingest-source-config-note" style={{ marginBottom: '0.75rem' }}>
                Entered here for this session only — never stored in the browser.
              </p>
              <div className="field-list">
                <div className="field-row">
                  <TextInput id="confluent-apikey" labelText="API Key"
                    placeholder="ABCDEFGHIJKLMNOP"
                    value={ingestSecrets.confluent?.apiKey || ''}
                    onChange={e => updateSecret('confluent', { apiKey: e.target.value })} />
                </div>
                <div className="field-row field-row--last">
                  <PasswordInput id="confluent-apisecret" labelText="API Secret"
                    value={ingestSecrets.confluent?.apiSecret || ''}
                    onChange={e => updateSecret('confluent', { apiSecret: e.target.value })} />
                </div>
              </div>
            </Tile>
          </div>

          {/* Topics tile — full width */}
          <Tile className="config-tile" style={{ marginTop: '0.75rem' }}>
            <h4 className="subsection-heading">Topics</h4>
            {kafkaTestState === 'ok' && kafkaTopics.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginBottom: '0.35rem' }}>
                  Topics on cluster ({kafkaTopics.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {kafkaTopics.map(t => (
                    <Tag key={t} type="blue" size="sm">{t}</Tag>
                  ))}
                </div>
              </div>
            )}
            <div className="field-list">
              <div className="field-row">
                <TextInput id="confluent-topics" labelText="Topic names to ingest (comma-separated)"
                  placeholder="maximo.workorders, maximo.assets, maximo.sr"
                  value={ingestSources.confluent?.topics || ''}
                  onChange={e => updateIngest('confluent', { topics: e.target.value })}
                  helperText="Each topic is ingested as a separate event stream into the knowledge index." />
              </div>
              <div className="field-row">
                <TextInput id="confluent-group" labelText="Consumer group ID"
                  placeholder="maximo-knowledge-hub"
                  value={ingestSources.confluent?.groupId || ''}
                  onChange={e => updateIngest('confluent', { groupId: e.target.value })} />
              </div>
              <div className="field-row field-row--last">
                <TextInput id="confluent-category" labelText="Default document category"
                  placeholder="event-stream"
                  value={ingestSources.confluent?.category || ''}
                  onChange={e => updateIngest('confluent', { category: e.target.value })} />
              </div>
            </div>
          </Tile>

          <Button kind="primary" size="sm" renderIcon={CheckmarkFilled}
            style={{ marginTop: '1rem', minWidth: '200px' }}
            onClick={() => markConfigured('confluent')}
            disabled={
              !ingestSources.confluent?.bootstrapServers ||
              !ingestSources.confluent?.topics ||
              !ingestSecrets.confluent?.apiKey
            }>
            Save Confluent settings
          </Button>
        </div>

        {/* Box */}
        <div className="ingest-source-config-block" style={{ borderBottom: 'none', marginBottom: 0 }}>
          <div className="ingest-source-config-header">
            <Box size={18} />
            <span className="ingest-source-config-title">Box.com</span>
            {ingestSources.box.configured
              ? <Tag type="green" size="sm">Configured</Tag>
              : <Tag type="gray"  size="sm">Not configured</Tag>}
          </div>
          <div className="two-col">
            <Tile className="config-tile">
              <h4 className="subsection-heading">OAuth credentials</h4>
              <p className="ingest-source-config-note" style={{ marginBottom: '0.75rem' }}>
                Entered here for this session only — never stored in the browser.
              </p>
              <div className="field-list">
                <div className="field-row">
                  <TextInput id="box-cfg-client-id" labelText="Client ID"
                    value={ingestSecrets.box.clientId}
                    onChange={e => updateSecret('box', { clientId: e.target.value })} />
                </div>
                <div className="field-row">
                  <PasswordInput id="box-cfg-client-secret" labelText="Client Secret"
                    value={ingestSecrets.box.clientSecret}
                    onChange={e => updateSecret('box', { clientSecret: e.target.value })} />
                </div>
                <div className="field-row field-row--last">
                  <PasswordInput id="box-cfg-token" labelText="Access Token"
                    value={ingestSecrets.box.accessToken}
                    onChange={e => updateSecret('box', { accessToken: e.target.value })} />
                </div>
              </div>
            </Tile>
            <Tile className="config-tile">
              <h4 className="subsection-heading">Folder &amp; defaults</h4>
              <div className="field-list">
                <div className="field-row">
                  <TextInput id="box-cfg-folder" labelText="Folder ID (0 = root)"
                    value={ingestSources.box.folderId}
                    onChange={e => updateIngest('box', { folderId: e.target.value })} />
                </div>
                <div className="field-row field-row--last">
                  <TextInput id="box-cfg-category" labelText="Default document category"
                    value={ingestSources.box.category}
                    onChange={e => updateIngest('box', { category: e.target.value })} />
                </div>
              </div>
            </Tile>
          </div>
          <Button kind="primary" size="sm" renderIcon={CheckmarkFilled}
            style={{ marginTop: '1rem', minWidth: '200px' }}
            onClick={() => markConfigured('box')}
            disabled={!ingestSecrets.box.clientId || !ingestSecrets.box.accessToken}>
            Save Box credentials
          </Button>
        </div>

      </section>

      {/* ── Demo mode ────────────────────────────────────────────────────── */}
      <div className="demo-mode-footer-strip">
        <span className="demo-mode-footer-label">Demo Mode</span>
        <Toggle
          id="demo-mode-toggle"
          size="sm"
          labelText=""
          labelA="Off"
          labelB="On"
          toggled={demoMode}
          onToggle={handleDemoToggle}
        />
        {demoMode && (
          <span className="demo-mode-footer-status">
            <Play size={12} />
            {demoActionCount} {demoActionCount === 1 ? 'action' : 'actions'} loaded
          </span>
        )}
      </div>
      <p className="demo-mode-footer-note">
        <strong>Demo Mode</strong> pre-loads a set of scripted actions into the chat interface,
        letting you walk through a guided demonstration without needing live data or a running
        backend. Turn this on before a presentation to showcase key features with predictable,
        pre-defined responses.
      </p>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="config-actions">
        <Button kind="primary"
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 3500); }}>
          Save all settings
        </Button>
        <Button kind="secondary">Reset to defaults</Button>
      </div>

    </div>
  );
}
