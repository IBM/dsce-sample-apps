import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BobMascotIcon } from './Icons.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────
function Dot({ color }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: color !== '#6f6f6f' ? `0 0 5px ${color}` : 'none',
    }} />
  );
}

const SEV = {
  critical: { border: '#da1e28', bg: '#2d0709', badge: '#da1e28', label: '🔴 CRITICAL' },
  warning:  { border: '#f1c21b', bg: '#2d1f00', badge: '#f1c21b', label: '🟡 WARNING'  },
  ok:       { border: '#24a148', bg: '#071908', badge: '#24a148', label: '✅ OK'        },
};

// ── Manual run card ────────────────────────────────────────────────────────
function RunCard({ run }) {
  const [open, setOpen] = useState(false);
  const color = run.status === 'completed' ? '#24a148'
    : run.status === 'failed'    ? '#da1e28'
    : run.status === 'cancelled' ? '#6f6f6f'
    : '#f1c21b';
  return (
    <div style={{ borderLeft: `3px solid ${color}`, background: 'var(--cds-layer-02)', marginBottom: 2 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', cursor: 'pointer' }}>
        <Dot color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginBottom: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color, fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>{run.status}</span>
            <span style={{ color: 'var(--cds-text-placeholder)' }}>{new Date(run.ts).toLocaleTimeString()}</span>
            {run.usage?.total_tokens && <span style={{ color: 'var(--cds-text-placeholder)' }}>· {run.usage.total_tokens} tok</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cds-text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: open ? 'none' : 80, overflow: open ? 'visible' : 'hidden' }}>
            {run.output || run.prompt}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--cds-text-placeholder)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}

// ── Alert card (from auto-monitor SSE) ────────────────────────────────────
function AlertCard({ alert, onInvestigate }) {
  const [open, setOpen] = useState(true);
  const s = SEV[alert.severity] ?? SEV.warning;
  return (
    <div style={{ borderLeft: `3px solid ${s.border}`, background: s.bg, marginBottom: 6, borderRadius: 2 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer' }}>
        {/* Severity badge */}
        <span style={{ background: s.badge, color: alert.severity === 'warning' ? '#161616' : '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>
          {s.label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--cds-text-placeholder)', flexShrink: 0 }}>
          {new Date(alert.ts).toLocaleTimeString()}
        </span>
        {alert.errorRate !== null && (
          <span style={{ fontSize: 10, color: 'var(--cds-text-secondary)' }}>
            err&nbsp;<strong style={{ color: s.badge }}>{alert.errorRate}%</strong>
            {alert.p90Latency && <> · p90&nbsp;<strong>{alert.p90Latency}ms</strong></>}
          </span>
        )}
        {alert.source === 'headlessbob' && (
          <span style={{ fontSize: 9, background: '#0f3460', color: '#78a9ff', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
            via headlessbob
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cds-text-placeholder)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 12px 10px', fontSize: 12, color: 'var(--cds-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {alert.message}
          {onInvestigate && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInvestigate(`Investigate root cause of this critical anomaly detected in Retail Application: ${alert.message.slice(0, 200)}`);
                }}
                style={{
                  background: 'var(--cds-layer-02)',
                  border: '1px solid #0f62fe',
                  color: '#78a9ff',
                  padding: '4px 10px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🔍</span> Investigate Root Cause in Chat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
const DEFAULT_URL = 'http://127.0.0.1:8000';

export default function HeadlessBobPanel({ streamMode = null, onAutonomousAlert, onInvestigateAlert, onContract }) {
  // STREAM_MODE=mock: no Headless Bob server exists. The panel is pre-connected to the
  // bridge's simulated monitor stream and manual prompts go to the simulated /api/prompt.
  const mock = streamMode === 'mock';
  // `onContract` present => rendered as a full-height side column (chat view).
  // Otherwise it behaves as the original collapsible bottom bar.
  const column = typeof onContract === 'function';

  // ── layout
  const [expanded, setExpanded]     = useState(true);
  const [activeTab, setActiveTab]   = useState('monitor'); // 'monitor' | 'chat'

  // ── headlessbob connection
  const [url, setUrl]               = useState(DEFAULT_URL);
  const [token, setToken]           = useState('');
  const [editingConn, setEditingConn] = useState(false);
  const [connected, setConnected]   = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError]   = useState('');
  const [threadId, setThreadId]     = useState(null);

  // ── auto-monitor
  const [monitoring, setMonitoring]   = useState(false);
  const [lastTick, setLastTick]       = useState(null); // {ts, severity, errorRate, p90Latency}
  const [checking, setChecking]       = useState(false);
  const [alerts, setAlerts]           = useState([]);
  const sseRef                        = useRef(null);

  // ── manual chat runs
  const [runs, setRuns]               = useState([]);
  const [prompt, setPrompt]           = useState('');
  const [sending, setSending]         = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);
  const runPollRef                    = useRef(null);
  const bottomRef                     = useRef(null);

  // Latest alert callback without re-creating the SSE subscription (fixes a stale closure).
  const onAlertRef = useRef(onAutonomousAlert);
  useEffect(() => { onAlertRef.current = onAutonomousAlert; }, [onAutonomousAlert]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [runs, alerts]);
  useEffect(() => () => {
    sseRef.current?.close();
    if (runPollRef.current) clearInterval(runPollRef.current);
  }, []);

  // All headlessbob API calls go through the bridge /hb/* proxy — no CORS issues.
  const hbFetch = useCallback((path, opts = {}) => {
    return fetch(`/hb${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    });
  }, []);

  // ── Register / deregister headlessbob URL+token with the bridge server
  const registerWithBridge = useCallback(async (hbUrl, hbToken) => {
    try {
      await fetch('/api/monitor/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: hbUrl, token: hbToken || undefined }),
      });
    } catch { /* bridge may not be up yet */ }
  }, []);

  const deregisterFromBridge = useCallback(async () => {
    try { await fetch('/api/monitor/register', { method: 'DELETE' }); } catch {}
  }, []);

  // ── SSE subscription for auto-monitor alerts
  const subscribeSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource('/api/monitor/stream');
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'check_start') setChecking(true);
        if (ev.type === 'status_tick') {
          setChecking(false);
          setLastTick(ev);
        }
        if (ev.type === 'alert') {
          setChecking(false);
          setLastTick(ev);
          setAlerts(prev => [...prev.slice(-49), ev]);
          onAlertRef.current?.(ev);
        }
        if (ev.type === 'monitor_stopped') {
          setMonitoring(false);
          setChecking(false);
        }
      } catch {}
    };
    es.onerror = () => {}; // auto-reconnects
  }, []);

  // ── Connect: register URL+token with bridge, then verify via /hb proxy and auto-start monitoring
  const connect = useCallback(async () => {
    setConnecting(true);
    setConnError('');
    try {
      // Step 1: tell the bridge about the headlessbob URL + token
      await registerWithBridge(url, token);

      // Step 2: verify capabilities via the bridge proxy (no direct browser→hb contact)
      const cap = await hbFetch('/api/v1/capabilities');
      if (!cap.ok) throw new Error(`Capabilities check failed: HTTP ${cap.status}`);
      const capData = await cap.json();
      if (!capData.features?.threads) throw new Error('headlessbob instance does not support threads');

      // Step 3: create a thread
      const tr = await hbFetch('/api/v1/threads', {
        method: 'POST',
        body: JSON.stringify({ title: 'Instana Demo — ' + new Date().toLocaleString() }),
      });
      if (!tr.ok) throw new Error(`Thread creation failed: HTTP ${tr.status}`);
      const thread = await tr.json();
      setThreadId(thread.id);
      setConnected(true);
      setEditingConn(false);
      setRuns([]);

      // Step 4: Automatically start autonomous monitoring
      subscribeSSE();
      await fetch('/api/monitor/start', { method: 'POST' }).catch(() => {});
      setMonitoring(true);
    } catch (e) {
      setConnError(e.message);
      // Deregister from bridge if connect failed
      await deregisterFromBridge();
    } finally {
      setConnecting(false);
    }
  }, [url, token, hbFetch, registerWithBridge, deregisterFromBridge, subscribeSSE]);

  const disconnect = useCallback(async () => {
    sseRef.current?.close();
    sseRef.current = null;
    if (runPollRef.current) clearInterval(runPollRef.current);
    setConnected(false);
    setThreadId(null);
    setRuns([]);
    setAlerts([]);
    setActiveRunId(null);
    setMonitoring(false);
    setLastTick(null);
    setEditingConn(false);
    await deregisterFromBridge();
  }, [deregisterFromBridge]);

  // ── Start / stop auto-monitor
  const startMonitor = useCallback(async () => {
    subscribeSSE();
    await fetch('/api/monitor/start', { method: 'POST' });
    setMonitoring(true);
  }, [subscribeSSE]);

  const stopMonitor = useCallback(async () => {
    await fetch('/api/monitor/stop', { method: 'POST' });
    sseRef.current?.close();
    sseRef.current = null;
    setMonitoring(false);
    setChecking(false);
  }, []);

  const triggerCheckNow = useCallback(async () => {
    setChecking(true);
    try {
      await fetch('/api/monitor/check_now', { method: 'POST' });
    } catch {}
  }, []);

  // ── Poll a manual run until terminal
  const pollRun = useCallback((runId) => {
    if (runPollRef.current) clearInterval(runPollRef.current);
    runPollRef.current = setInterval(async () => {
      try {
        const r = await hbFetch(`/api/v1/runs/${runId}`);
        if (!r.ok) return;
        const run = await r.json();
        const terminal = ['completed', 'failed', 'cancelled'].includes(run.status);
        setRuns(prev => prev.map(x => x.runId === runId
          ? { ...x, status: run.status, output: run.output ?? x.output, usage: run.usage }
          : x));
        if (terminal) {
          clearInterval(runPollRef.current);
          setActiveRunId(null);
        }
      } catch {}
    }, 2000);
  }, [hbFetch]);

  // ── Send a manual message
  const send = useCallback(async () => {
    if (!prompt.trim() || !connected || (!mock && !threadId) || sending) return;
    const p = prompt.trim();
    setPrompt('');
    setSending(true);
    const ts = Date.now();

    if (mock) {
      // Simulated answer from the bridge (canned, ~6.5 s delay); no Headless Bob involved.
      const runId = `sim-${ts}`;
      setActiveRunId(runId);
      setRuns(prev => [...prev, { runId, ts, prompt: p, status: 'running', output: null, usage: null }]);
      try {
        const r = await fetch('/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: p }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        const output = (data.answer || '').replace(/<!--STATUS:[\s\S]*?-->/g, '').trim();
        setRuns(prev => prev.map(x => x.runId === runId ? { ...x, status: 'completed', output } : x));
      } catch (e) {
        setRuns(prev => prev.map(x => x.runId === runId ? { ...x, status: 'failed', output: e.message } : x));
      } finally {
        setActiveRunId(null);
        setSending(false);
      }
      return;
    }

    try {
      const r = await hbFetch(`/api/v1/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: p }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setActiveRunId(data.run_id);
      setRuns(prev => [...prev, { runId: data.run_id, ts, prompt: p, status: 'running', output: null, usage: null }]);
      pollRun(data.run_id);
    } catch (e) {
      setRuns(prev => [...prev, { runId: `err-${ts}`, ts, prompt: p, status: 'failed', output: e.message, usage: null }]);
    } finally {
      setSending(false);
    }
  }, [prompt, connected, threadId, sending, mock, hbFetch, pollRun]);

  const cancelRun = useCallback(async () => {
    if (!activeRunId || mock) return;
    await hbFetch(`/api/v1/runs/${activeRunId}/cancel`, { method: 'POST' }).catch(() => {});
  }, [activeRunId, mock, hbFetch]);

  // Mock mode: skip the connect flow and attach to the simulated monitor immediately.
  useEffect(() => {
    if (!mock) return;
    setConnected(true);
    setMonitoring(true);
    subscribeSSE();
  }, [mock, subscribeSSE]);

  // ── Derived UI state
  const connDotColor = connected ? '#24a148' : connecting ? '#f1c21b' : '#6f6f6f';
  const monDot = monitoring
    ? (checking ? '#f1c21b' : (SEV[lastTick?.severity]?.badge ?? '#24a148'))
    : '#6f6f6f';

  return (
    <div style={{
      borderTop: column ? 'none' : '1px solid var(--cds-border-subtle)',
      background: 'var(--cds-layer)',
      fontSize: 12,
      userSelect: 'none',
      ...(column ? { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } : {}),
    }}>

      {/* ── Header ── */}
      <div
        onClick={column ? undefined : () => setExpanded(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: column ? 'default' : 'pointer', borderBottom: (expanded || column) ? '1px solid var(--cds-border-subtle)' : 'none', flexWrap: 'wrap', flexShrink: 0 }}
      >
        <div style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0f62fe 0%, #002d9c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 8px rgba(15, 98, 254, 0.4)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <BobMascotIcon size={20} />
        </div>
        <span style={{ color: 'var(--cds-text-primary)', fontWeight: 600, letterSpacing: '0.02em', fontSize: 12 }}>
          HEADLESS BOB
        </span>

        {/* Connection status */}
        <Dot color={connDotColor} />
        <span style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>
          {mock ? 'mock' : connected ? 'connected' : connecting ? 'connecting…' : 'disconnected'}
        </span>
        {mock && (
          <span title="STREAM_MODE=mock: alerts and answers are generated by the demo scenario engine."
            style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#f1c21b', color: '#161616' }}>
            MOCK
          </span>
        )}

        {/* Monitor status */}
        {connected && (
          <>
            <span style={{ color: 'var(--cds-border-subtle)', fontSize: 11 }}>|</span>
            <Dot color={monDot} />
            <span style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>
              {monitoring ? (checking ? 'checking…' : (lastTick ? `last check ${new Date(lastTick.ts).toLocaleTimeString()}` : 'monitoring')) : 'monitor off'}
            </span>
            {lastTick?.errorRate !== null && lastTick?.errorRate !== undefined && (
              <span style={{ fontSize: 11, color: SEV[lastTick.severity]?.badge ?? 'var(--cds-text-secondary)' }}>
                · err {lastTick.errorRate}%
              </span>
            )}
          </>
        )}

        {/* Cancel active run */}
        {activeRunId && (
          <button onClick={e => { e.stopPropagation(); cancelRun(); }}
            style={{ padding: '2px 8px', border: '1px solid #da1e28', borderRadius: 3, background: 'transparent', color: '#da1e28', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
            ✕ Cancel
          </button>
        )}

        {!mock && (
          <button
            onClick={e => { e.stopPropagation(); connected ? disconnect() : setEditingConn(o => !o); }}
            style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 3, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11, background: connected ? '#6f6f6f' : '#0f62fe', color: '#fff' }}>
            {connected ? 'Disconnect' : 'Connect'}
          </button>
        )}
        {mock && <span style={{ marginLeft: 'auto' }} />}
        {column ? (
          <button
            onClick={e => { e.stopPropagation(); onContract(); }}
            title="Contract Headless Bob panel"
            aria-label="Contract Headless Bob panel"
            style={{ padding: '3px 8px', borderRadius: 3, border: '1px solid var(--cds-border-subtle-01)', background: 'var(--cds-layer-02)', color: 'var(--cds-text-secondary)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
            ◀ Contract
          </button>
        ) : (
          <span style={{ color: 'var(--cds-text-secondary)', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {/* ── Body ── */}
      {(expanded || column) && (
        <div style={{ display: 'flex', flexDirection: 'column', ...(column ? { flex: 1, minHeight: 0 } : { maxHeight: 340 }) }}>

          {/* ── Connection form ── */}
          {!connected && editingConn && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--cds-border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="http://127.0.0.1:8000"
                  style={{ flex: 2, padding: '4px 8px', background: 'var(--cds-field-01)', border: '1px solid var(--cds-border-strong-01)', borderRadius: 3, color: 'var(--cds-text-primary)', fontSize: 12, fontFamily: 'inherit' }} />
                <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Bearer token (optional)"
                  style={{ flex: 3, padding: '4px 8px', background: 'var(--cds-field-01)', border: '1px solid var(--cds-border-strong-01)', borderRadius: 3, color: 'var(--cds-text-primary)', fontSize: 12, fontFamily: 'inherit' }} />
                <button onClick={connect} disabled={connecting}
                  style={{ padding: '4px 14px', border: 'none', borderRadius: 3, background: '#0f62fe', color: '#fff', cursor: connecting ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
                  {connecting ? '…' : 'Connect'}
                </button>
              </div>
              {connError && <p style={{ margin: 0, fontSize: 11, color: '#da1e28' }}>⚠ {connError}</p>}
              <p style={{ margin: 0, fontSize: 11, color: 'var(--cds-text-secondary)' }}>
                Deploy headlessbob locally or on OpenShift. See{' '}
                <a href="https://ibm-self-serve-assets.github.io/building-blocks-docs/ai-core/engineering/headless-bob/" target="_blank" rel="noopener" style={{ color: '#0f62fe' }}>docs ↗</a>
              </p>
            </div>
          )}

          {/* ── Not connected placeholder ── */}
          {!connected && !editingConn && (
            <div style={{ padding: '10px 12px', color: 'var(--cds-text-secondary)', fontSize: 12 }}>
              Connect to a <a href="https://ibm-self-serve-assets.github.io/building-blocks-docs/ai-core/engineering/headless-bob/" target="_blank" rel="noopener" style={{ color: '#0f62fe' }}>headlessbob</a> instance to enable auto-monitoring and chat.
            </div>
          )}

          {/* ── Connected UI ── */}
          {connected && (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--cds-border-subtle)', flexShrink: 0 }}>
                {[
                  { id: 'monitor', label: `🔔 Autonomous Monitor${alerts.length ? ` (${alerts.length})` : ''}` },
                  { id: 'chat',    label: `💬 Chat${runs.length ? ` (${runs.length})` : ''}` },
                ].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{ padding: '6px 14px', border: 'none', borderBottom: activeTab === t.id ? '2px solid #0f62fe' : '2px solid transparent', background: 'none', color: activeTab === t.id ? '#0f62fe' : 'var(--cds-text-secondary)', fontWeight: activeTab === t.id ? 600 : 400, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                    {t.label}
                  </button>
                ))}
                
                {/* Live telemetry badge & Trigger check button */}
                {activeTab === 'monitor' && (
                  <div style={{ marginLeft: 'auto', marginRight: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--cds-text-secondary)' }}>
                    <button
                      onClick={triggerCheckNow}
                      disabled={checking}
                      title="Run an instant health & alert inspection via Instana MCP"
                      style={{
                        padding: '2px 8px',
                        border: '1px solid var(--cds-border-subtle-01)',
                        borderRadius: 3,
                        background: 'var(--cds-layer-02)',
                        color: 'var(--cds-text-primary)',
                        cursor: checking ? 'not-allowed' : 'pointer',
                        fontSize: 10,
                        fontFamily: 'inherit',
                      }}
                    >
                      {checking ? '⟳ Inspecting…' : '⚡ Check Now'}
                    </button>
                    <Dot color={checking ? '#f1c21b' : (SEV[lastTick?.severity]?.badge ?? '#24a148')} />
                    <span>{checking ? (mock ? 'Evaluating mock telemetry…' : 'Analyzing Instana telemetry…') : monitoring ? 'Active (60s)' : 'Paused'}</span>
                  </div>
                )}
              </div>

              {/* ── Monitor tab ── */}
              {activeTab === 'monitor' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {/* Status header */}
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--cds-border-subtle-01)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--cds-layer-01)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cds-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Autonomous Monitoring Status
                      </span>
                      <span style={{
                        background: monitoring ? '#0f3460' : 'var(--cds-layer-02)',
                        color: monitoring ? '#78a9ff' : 'var(--cds-text-secondary)',
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontWeight: 600,
                      }}>
                        {monitoring ? 'STREAMING TO CHAT' : 'PAUSED'}
                      </span>
                    </div>
                    {lastTick && (
                      <span style={{ fontSize: 10, color: 'var(--cds-text-secondary)' }}>
                        Last evaluated: {new Date(lastTick.ts).toLocaleTimeString()}
                        {lastTick.errorRate != null && <> · err: <strong style={{ color: SEV[lastTick.severity]?.badge ?? '#24a148' }}>{lastTick.errorRate}%</strong></>}
                        {lastTick.p90Latency != null && <> · p90: <strong>{lastTick.p90Latency}ms</strong></>}
                      </span>
                    )}
                  </div>

                  {/* KPI cards: real values from the last monitor tick only ("—" until one arrives) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: '10px 14px 0' }}>
                    {[
                      { label: 'Error rate', value: lastTick?.errorRate != null ? `${lastTick.errorRate}%` : '—', color: SEV[lastTick?.severity]?.badge },
                      { label: 'P90 latency', value: lastTick?.p90Latency != null ? `${lastTick.p90Latency} ms` : '—' },
                      { label: 'Severity', value: lastTick?.severity ?? '—', color: SEV[lastTick?.severity]?.badge },
                      { label: 'Cycle', value: monitoring ? '60 s' : 'paused' },
                    ].map(k => (
                      <div key={k.label} style={{ background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)', borderRadius: 4, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: k.color ?? 'var(--cds-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Live streaming callout */}
                    <div style={{
                      background: 'var(--cds-layer-01)',
                      border: '1px solid var(--cds-border-subtle-01)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}>
                      <span style={{ fontSize: 16 }}>💬</span>
                      <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--cds-text-primary)' }}>Direct Chat Stream Enabled:</strong> Autonomous alerts, critical incident notifications, and automated root cause analyses are sent directly into the chat window{column ? ' on the right' : ' above'}.
                      </div>
                    </div>

                    {/* Quick status summary */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <Dot color={checking ? '#f1c21b' : (SEV[lastTick?.severity]?.badge ?? '#24a148')} />
                      <span style={{ fontWeight: 600, color: 'var(--cds-text-primary)' }}>
                        {checking
                          ? 'Inspecting Retail Application telemetry…'
                          : lastTick?.severity === 'critical'
                          ? 'Critical Anomaly Detected — Alert Dispatched to Chat'
                          : lastTick?.severity === 'warning'
                          ? 'Warning Anomaly Detected — Alert Dispatched to Chat'
                          : 'Retail Application Status: Healthy (Polling every 60s)'}
                      </span>
                    </div>

                    {/* Dispatched alerts log */}
                    {alerts.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--cds-text-placeholder)', textTransform: 'uppercase', marginBottom: 6 }}>
                          Dispatched Alerts History ({alerts.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {alerts.slice(-5).reverse().map((a, i) => {
                            const s = SEV[a.severity] ?? SEV.warning;
                            return (
                              <div key={`${a.ts}-${i}`} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                background: 'var(--cds-layer-02)',
                                borderLeft: `3px solid ${s.border}`,
                                borderRadius: 2,
                                fontSize: 11,
                              }}>
                                <span style={{ background: s.badge, color: a.severity === 'warning' ? '#161616' : '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2 }}>
                                  {s.label}
                                </span>
                                <span style={{ color: 'var(--cds-text-placeholder)', fontSize: 10 }}>
                                  {new Date(a.ts).toLocaleTimeString()}
                                </span>
                                {a.errorRate !== null && a.errorRate !== undefined && (
                                  <span style={{ color: 'var(--cds-text-secondary)', fontSize: 10 }}>
                                    err: <strong style={{ color: s.badge }}>{a.errorRate}%</strong>
                                  </span>
                                )}
                                <span style={{ color: '#78a9ff', fontSize: 10, marginLeft: 'auto' }}>
                                  ✓ Sent to Chat
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={bottomRef} />
                </div>
              )}

              {/* ── Chat tab ── */}
              {activeTab === 'chat' && (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', padding: runs.length ? 0 : '10px 12px' }}>
                    {runs.length === 0
                      ? <p style={{ margin: 0, color: 'var(--cds-text-secondary)', fontSize: 12 }}>
                          {mock ? 'Send a prompt — a mock answer is returned (no Headless Bob is running in mock mode).'
                                : 'Send a prompt — Bob will run it in the headlessbob workspace.'}
                        </p>
                      : runs.map(r => <RunCard key={r.runId} run={r} />)
                    }
                    <div ref={bottomRef} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderTop: '1px solid var(--cds-border-subtle)', flexShrink: 0 }}>
                    <textarea rows={1} value={prompt} onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Ask Bob something… (Enter to send)" disabled={!!activeRunId}
                      style={{ flex: 1, resize: 'none', padding: '5px 8px', background: 'var(--cds-field-01)', border: '1px solid var(--cds-border-strong-01)', borderRadius: 3, color: 'var(--cds-text-primary)', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.4 }} />
                    <button onClick={send} disabled={!prompt.trim() || !!activeRunId || sending}
                      style={{ padding: '5px 12px', border: 'none', borderRadius: 3, background: (!prompt.trim() || !!activeRunId) ? 'var(--cds-layer-02)' : '#0f62fe', color: (!prompt.trim() || !!activeRunId) ? 'var(--cds-text-secondary)' : '#fff', cursor: (!prompt.trim() || !!activeRunId) ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, flexShrink: 0 }}>
                      {activeRunId ? '⟳' : '→'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
