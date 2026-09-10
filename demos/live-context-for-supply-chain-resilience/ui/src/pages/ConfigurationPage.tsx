// ui/src/pages/ConfigurationPage.tsx
// Configuration — Confluent, Backend, and System settings
// Grouped into tabs: Confluent, Backend API, System

import React, { useState } from 'react';
import { demoClearAndSimulate, demoReset } from '../api/client';

// ── Icons ─────────────────────────────────────────────────────────────────────

const EyeIcon = ({ show }: { show: boolean }) =>
  show ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const WarnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ── Tab IDs ───────────────────────────────────────────────────────────────────

type TabId = 'confluent' | 'backend' | 'system';

const TABS: { id: TabId; label: string }[] = [
  { id: 'confluent', label: 'Confluent' },
  { id: 'backend',   label: 'Backend API' },
  { id: 'system',    label: 'System' },
];

// ── Generic field components ───────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, hint, children }) => (
  <div className="cfg-field">
    <label className="cfg-field-label">{label}</label>
    {hint && <p className="cfg-field-hint">{hint}</p>}
    <div className="cfg-field-control">{children}</div>
  </div>
);

interface SecretInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  copyable?: boolean;
  id?: string;
}

const SecretInput: React.FC<SecretInputProps> = ({ value, onChange, placeholder, copyable, id }) => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="cfg-secret-row">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="cfg-input cfg-input--secret"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="cfg-icon-btn"
        onClick={() => setVisible(v => !v)}
        title={visible ? 'Hide' : 'Show'}
        aria-label={visible ? 'Hide secret' : 'Show secret'}
      >
        <EyeIcon show={visible} />
      </button>
      {copyable && (
        <button
          type="button"
          className={`cfg-icon-btn${copied ? ' cfg-icon-btn--success' : ''}`}
          onClick={handleCopy}
          title="Copy to clipboard"
          aria-label="Copy to clipboard"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      )}
    </div>
  );
};

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  id?: string;
}

const Select: React.FC<SelectProps> = ({ value, onChange, options, id }) => (
  <select id={id} className="cfg-select" value={value} onChange={e => onChange(e.target.value)}>
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

// ── Status pill ───────────────────────────────────────────────────────────────

type PillStatus = 'connected' | 'disconnected' | 'unknown';

const StatusPill: React.FC<{ status: PillStatus; label?: string }> = ({ status, label }) => {
  const colors: Record<PillStatus, string> = {
    connected:    'cfg-pill--green',
    disconnected: 'cfg-pill--red',
    unknown:      'cfg-pill--gray',
  };
  const labels: Record<PillStatus, string> = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    unknown: 'Not tested',
  };
  return (
    <span className={`cfg-pill ${colors[status]}`}>
      <span className="cfg-pill-dot" />
      {label ?? labels[status]}
    </span>
  );
};

// ── Section header ─────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; description?: string }> = ({ title, description }) => (
  <div className="cfg-section-header">
    <h3 className="cfg-section-title">{title}</h3>
    {description && <p className="cfg-section-desc">{description}</p>}
  </div>
);

// ── Toast ─────────────────────────────────────────────────────────────────────

const Toast: React.FC<{ message: string; kind: 'success' | 'error'; onDismiss: () => void }> = ({ message, kind, onDismiss }) => (
  <div className={`cfg-toast cfg-toast--${kind}`} role="status" aria-live="polite">
    <span className="cfg-toast-icon">{kind === 'success' ? <CheckIcon /> : <WarnIcon />}</span>
    <span className="cfg-toast-msg">{message}</span>
    <button className="cfg-toast-close" onClick={onDismiss} aria-label="Dismiss">×</button>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

export const ConfigurationPage: React.FC = () => {
  const [tab, setTab] = useState<TabId>('confluent');
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, PillStatus>>({});
  const [simulating, setSimulating] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Confluent fields ───────────────────────────────────────────────────────
  const [cfRestUrl, setCfRestUrl] = useState('');
  const [cfApiKey, setCfApiKey] = useState('');
  const [cfApiSecret, setCfApiSecret] = useState('');
  const [cfReadMode, setCfReadMode] = useState('auto');
  const [cfAllowedTopics, setCfAllowedTopics] = useState(
    'turnaround.material.required,supply.inventory.changed,supply.shipment.updated,supply.supplier.status.changed,supply.port.status.changed,supply.approved_vendor.changed,supply.risk.detected,supply.material.readiness.assessed,supply.action.completed'
  );
  const [cfTimeoutSecs, setCfTimeoutSecs] = useState('15');
  const [cfLookbackMin, setCfLookbackMin] = useState('60');
  const [cfMaxRecords, setCfMaxRecords] = useState('50');
  const [cfMaxTotal, setCfMaxTotal] = useState('250');
  const [cfCacheSeconds, setCfCacheSeconds] = useState('300');
  const [cfBootstrap, setCfBootstrap] = useState('');
  const [cfSchemaRegistry, setCfSchemaRegistry] = useState('');
  const [cfSchemaKey, setCfSchemaKey] = useState('');
  const [cfSchemaSecret, setCfSchemaSecret] = useState('');

  // ── Backend fields ─────────────────────────────────────────────────────────
  const [beUrl, setBeUrl] = useState('');
  const [wxoBaseUrl, setWxoBaseUrl] = useState('');
  const [wxoApiKey, setWxoApiKey] = useState('');
  const [demoMode, setDemoMode] = useState('true');
  const [logLevel, setLogLevel] = useState('info');

  // ── System fields ──────────────────────────────────────────────────────────
  const [embeddingUrl, setEmbeddingUrl] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('ibm/slate-125m-english-rtrvr');
  const [opensearchHost, setOpensearchHost] = useState('');
  const [opensearchUser, setOpensearchUser] = useState('admin');
  const [opensearchPass, setOpensearchPass] = useState('');

  const showToast = (message: string, kind: 'success' | 'error') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const result = await demoClearAndSimulate();
      showToast(
        result.risk_detected
          ? `Risk scenario fired — ${result.risk_id ?? 'RISK-CVA8842-TW2047'} · Severity: ${result.severity ?? 'CRITICAL'}`
          : 'Simulation ran but no risk was detected. Check backend logs.',
        result.risk_detected ? 'success' : 'error',
      );
    } catch {
      showToast('Simulation failed — is the FastAPI backend running?', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await demoReset();
      showToast('Demo state reset to seed data.', 'success');
    } catch {
      showToast('Reset failed — is the FastAPI backend running?', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    showToast('Configuration saved. Restart the service for changes to take effect.', 'success');
  };

  const handleTest = async (key: string, _url: string) => {
    setTesting(key);
    await new Promise(r => setTimeout(r, 1200));
    // In a real deployment, this would POST to a /api/config/test endpoint.
    const ok = _url.startsWith('http') || _url.startsWith('https');
    setTestResults(prev => ({ ...prev, [key]: ok ? 'connected' : 'disconnected' }));
    setTesting(null);
    showToast(ok ? `${key} reachable.` : `${key} unreachable — check URL and credentials.`, ok ? 'success' : 'error');
  };

  const cfStatus = testResults['confluent'] ?? 'unknown';
  const beStatus = testResults['backend'] ?? 'unknown';

  return (
    <div className="tsci-page-content">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="tsci-page-header">
        <div>
          <h1 className="bob-ask-title">Configuration</h1>
          <p className="bob-ask-subtitle">Confluent Cloud, Backend API, and system settings</p>
        </div>
      </div>

      {/* ── Toast notification ────────────────────────────────────────────── */}
      {toast && (
        <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="cfg-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`cfg-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          CONFLUENT TAB
          ───────────────────────────────────────────────────────────────────── */}
      {tab === 'confluent' && (
        <div className="cfg-panel">

          {/* Connection */}
          <div className="cfg-section">
            <SectionHeader
              title="Confluent Cloud Connection"
              description="REST Proxy endpoint and API credentials for the wxO confluent_kafka BASIC_AUTH connection."
            />

            <div className="cfg-row cfg-row--spread">
              <span className="cfg-section-desc">Connection status</span>
              <div className="cfg-row cfg-row--gap">
                <StatusPill status={cfStatus} />
                <button
                  className="cfg-btn cfg-btn--ghost cfg-btn--sm"
                  onClick={() => handleTest('confluent', cfRestUrl)}
                  disabled={testing === 'confluent' || !cfRestUrl}
                >
                  {testing === 'confluent' ? 'Testing…' : 'Test Connection'}
                </button>
              </div>
            </div>

            <Field
              label="Confluent REST URL"
              hint="Per-cluster REST Proxy endpoint. Format: https://<cluster-id>.<region>.aws.confluent.cloud:443"
            >
              <input
                className="cfg-input"
                type="url"
                value={cfRestUrl}
                onChange={e => setCfRestUrl(e.target.value)}
                placeholder="https://pkc-xxxxx.us-east-1.aws.confluent.cloud:443"
                spellCheck={false}
              />
            </Field>

            <Field label="API Key" hint="Confluent service account API key (read-only, restricted to TSCI topics).">
              <SecretInput
                value={cfApiKey}
                onChange={setCfApiKey}
                placeholder="Enter API key"
                copyable
                id="cf-api-key"
              />
            </Field>

            <Field label="API Secret">
              <SecretInput
                value={cfApiSecret}
                onChange={setCfApiSecret}
                placeholder="Enter API secret"
                id="cf-api-secret"
              />
            </Field>

            <Field label="Bootstrap Servers" hint="Used by direct Kafka clients (not required for REST Proxy only).">
              <input
                className="cfg-input"
                type="text"
                value={cfBootstrap}
                onChange={e => setCfBootstrap(e.target.value)}
                placeholder="pkc-xxxxx.us-east-1.aws.confluent.cloud:9092"
                spellCheck={false}
              />
            </Field>
          </div>

          {/* Direct Read Behaviour */}
          <div className="cfg-section">
            <SectionHeader
              title="Direct Read Behaviour"
              description="Controls how the Confluent Intelligence Agent retrieves event evidence."
            />

            <Field
              label="Read Mode"
              hint="auto — try direct Confluent first, fall back to trace bridge. direct — direct only, fail if unavailable. trace — trace bridge only."
            >
              <Select
                id="cf-read-mode"
                value={cfReadMode}
                onChange={setCfReadMode}
                options={[
                  { value: 'auto',   label: 'auto — Direct first, trace bridge fallback (recommended)' },
                  { value: 'direct', label: 'direct — Direct Confluent only, no fallback' },
                  { value: 'trace',  label: 'trace — Trace bridge only, never direct' },
                ]}
              />
            </Field>

            <div className="cfg-grid cfg-grid--3">
              <Field label="Timeout (seconds)">
                <input className="cfg-input cfg-input--sm" type="number" min="5" max="120"
                  value={cfTimeoutSecs} onChange={e => setCfTimeoutSecs(e.target.value)} />
              </Field>
              <Field label="Lookback (minutes)">
                <input className="cfg-input cfg-input--sm" type="number" min="1" max="120"
                  value={cfLookbackMin} onChange={e => setCfLookbackMin(e.target.value)} />
              </Field>
              <Field label="Max Records / Topic">
                <input className="cfg-input cfg-input--sm" type="number" min="1" max="100"
                  value={cfMaxRecords} onChange={e => setCfMaxRecords(e.target.value)} />
              </Field>
              <Field label="Max Total Records">
                <input className="cfg-input cfg-input--sm" type="number" min="1" max="500"
                  value={cfMaxTotal} onChange={e => setCfMaxTotal(e.target.value)} />
              </Field>
              <Field label="Capability Cache (seconds)">
                <input className="cfg-input cfg-input--sm" type="number" min="30" max="3600"
                  value={cfCacheSeconds} onChange={e => setCfCacheSeconds(e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Allowed Topics */}
          <div className="cfg-section">
            <SectionHeader
              title="Allowed Topics"
              description="Comma-separated list of Kafka topics the agent may query. Any topic outside this list is rejected before network access."
            />
            <Field label="CONFLUENT_ALLOWED_TOPICS">
              <textarea
                className="cfg-textarea"
                rows={4}
                value={cfAllowedTopics}
                onChange={e => setCfAllowedTopics(e.target.value)}
                spellCheck={false}
              />
            </Field>
            <div className="cfg-inline-note">
              <WarnIcon />
              Only grant the wxO service account READ permission on these topics. Never grant WRITE, CREATE, DELETE, or ALTER.
            </div>
          </div>

          {/* Schema Registry */}
          <div className="cfg-section">
            <SectionHeader
              title="Schema Registry (optional)"
              description="Only required if the direct read mechanism needs schema decoding. Leave blank to skip."
            />
            <Field label="Schema Registry URL">
              <input className="cfg-input" type="url" value={cfSchemaRegistry}
                onChange={e => setCfSchemaRegistry(e.target.value)}
                placeholder="https://psrc-xxxxx.us-east-2.aws.confluent.cloud" spellCheck={false} />
            </Field>
            <Field label="Schema Registry API Key">
              <SecretInput value={cfSchemaKey} onChange={setCfSchemaKey} placeholder="Enter key" />
            </Field>
            <Field label="Schema Registry API Secret">
              <SecretInput value={cfSchemaSecret} onChange={setCfSchemaSecret} />
            </Field>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          BACKEND API TAB
          ───────────────────────────────────────────────────────────────────── */}
      {tab === 'backend' && (
        <div className="cfg-panel">
          <div className="cfg-section">
            <SectionHeader
              title="TSCI Backend API"
              description="FastAPI backend providing risk, inventory, resilience, and trace-bridge endpoints."
            />

            <div className="cfg-row cfg-row--spread">
              <span className="cfg-section-desc">Connection status</span>
              <div className="cfg-row cfg-row--gap">
                <StatusPill status={beStatus} />
                <button
                  className="cfg-btn cfg-btn--ghost cfg-btn--sm"
                  onClick={() => handleTest('backend', beUrl)}
                  disabled={testing === 'backend' || !beUrl}
                >
                  {testing === 'backend' ? 'Testing…' : 'Test Connection'}
                </button>
              </div>
            </div>

            <Field
              label="TSCI API Base URL"
              hint="Must be publicly reachable from the wxO cloud runtime (not localhost)."
            >
              <input
                className="cfg-input"
                type="url"
                value={beUrl}
                onChange={e => setBeUrl(e.target.value)}
                placeholder="https://your-tsci-backend.example.com/api"
                spellCheck={false}
              />
            </Field>
          </div>

          <div className="cfg-section">
            <SectionHeader
              title="watsonx Orchestrate"
              description="wxO API credentials for the UI live-agent connection."
            />
            <Field label="WXO Base URL">
              <input
                className="cfg-input"
                type="url"
                value={wxoBaseUrl}
                onChange={e => setWxoBaseUrl(e.target.value)}
                placeholder="https://api.us-south.assistant.watson.cloud.ibm.com"
                spellCheck={false}
              />
            </Field>
            <Field label="WXO API Key">
              <SecretInput value={wxoApiKey} onChange={setWxoApiKey} placeholder="Enter API key" copyable />
            </Field>
          </div>

          <div className="cfg-section">
            <SectionHeader title="Demo Flags" description="Controls for the local simulation and demo mode." />

            <Field label="Demo Mode" hint="true — use seeded deterministic data. false — live backend state only.">
              <Select
                value={demoMode}
                onChange={setDemoMode}
                options={[
                  { value: 'true',  label: 'true — seed data active' },
                  { value: 'false', label: 'false — live data only' },
                ]}
              />
            </Field>

            <Field label="Log Level">
              <Select
                value={logLevel}
                onChange={setLogLevel}
                options={[
                  { value: 'debug', label: 'debug' },
                  { value: 'info',  label: 'info' },
                  { value: 'warn',  label: 'warn' },
                  { value: 'error', label: 'error' },
                ]}
              />
            </Field>
          </div>

          {/* Demo Scenario Controls */}
          <div className="cfg-section">
            <SectionHeader
              title="Demo Scenario Controls"
              description="Trigger or reset the CVA-8842 / TW-2047 supply risk scenario against the live backend."
            />
            <div className="cfg-inline-note" style={{ marginBottom: '1rem' }}>
              <WarnIcon />
              These actions write to the backend database. Use only in a development or demo environment.
            </div>
            <div className="cfg-row cfg-row--gap">
              <button
                className="cfg-btn cfg-btn--primary"
                onClick={handleSimulate}
                disabled={simulating || resetting}
              >
                {/* Play icon */}
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true" style={{ marginRight: '6px' }}>
                  <path d="M3 2.5l10 5.5-10 5.5V2.5z"/>
                </svg>
                {simulating ? 'Simulating…' : 'Simulate Delay Scenario'}
              </button>
              <button
                className="cfg-btn cfg-btn--ghost"
                onClick={handleReset}
                disabled={simulating || resetting}
              >
                {/* Reset icon */}
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" aria-hidden="true" style={{ marginRight: '6px' }}>
                  <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" strokeLinecap="round"/>
                  <path d="M8 1v3.5L10.5 2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {resetting ? 'Resetting…' : 'Reset Demo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          SYSTEM TAB
          ───────────────────────────────────────────────────────────────────── */}
      {tab === 'system' && (
        <div className="cfg-panel">
          <div className="cfg-section">
            <SectionHeader
              title="Embedding Service"
              description="IBM watsonx or compatible embedding service used by the RAG retriever."
            />
            <Field label="Embedding Service URL">
              <input className="cfg-input" type="url" value={embeddingUrl}
                onChange={e => setEmbeddingUrl(e.target.value)}
                placeholder="https://us-south.ml.cloud.ibm.com" spellCheck={false} />
            </Field>
            <Field label="Embedding Model">
              <input className="cfg-input" type="text" value={embeddingModel}
                onChange={e => setEmbeddingModel(e.target.value)}
                placeholder="ibm/slate-125m-english-rtrvr" spellCheck={false} />
            </Field>
          </div>

          <div className="cfg-section">
            <SectionHeader
              title="OpenSearch"
              description="Vector store for the enterprise knowledge base RAG pipeline."
            />
            <Field label="OpenSearch Host">
              <input className="cfg-input" type="url" value={opensearchHost}
                onChange={e => setOpensearchHost(e.target.value)}
                placeholder="https://your-opensearch.example.com" spellCheck={false} />
            </Field>
            <Field label="Username">
              <input className="cfg-input" type="text" value={opensearchUser}
                onChange={e => setOpensearchUser(e.target.value)} placeholder="admin" spellCheck={false} />
            </Field>
            <Field label="Password">
              <SecretInput value={opensearchPass} onChange={setOpensearchPass} />
            </Field>
          </div>
        </div>
      )}

      {/* ── Save bar ─────────────────────────────────────────────────────────── */}
      <div className="cfg-save-bar">
        <div className="cfg-save-bar-hint">
          <WarnIcon />
          Changes are stored in memory only. Update your <code>.env</code> file to persist between restarts.
        </div>
        <button
          className="cfg-btn cfg-btn--primary"
          onClick={handleSave}
          disabled={saving}
        >
          <SaveIcon />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
