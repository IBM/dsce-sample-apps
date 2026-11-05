import React, { useState, useEffect, useCallback, useRef } from 'react';
import ScenarioControl, { SimulatedBadge } from './ScenarioControl.jsx';

// OpenShift / Kubernetes digital twin, fed by GET /api/infrastructure/digital-twin.
//  - STREAM_MODE=realtime: every value comes from Instana through the MCP server.
//    Missing values are rendered as "n/a" — never defaulted or simulated.
//  - STREAM_MODE=mock: the payload is simulated (data.source === 'mock') and the
//    panel is labelled accordingly; the `mock` prop adds the scenario injector.

const POLL_MS = 45_000;       // bridge cache TTL is 30 s
const MOCK_POLL_MS = 4_000;   // simulated data is free to poll
const MAX_SVG_NODES = 6;      // nodes drawn in the topology; all remain selectable
const MAX_SVG_PODS = 6;

const SEV_COLOR = { ok: '#24a148', warning: '#f1c21b', critical: '#da1e28' };
const SEV_LABEL = { ok: 'Healthy', warning: 'Warning', critical: 'Critical' };

const UNAVAILABLE_TEXT = {
  no_kubernetes_entities: 'Instana returned no Kubernetes node entities.',
  cluster_has_no_nodes: 'The selected cluster has no node entities in this window.',
  rate_limited: 'Instana API rate limit is active and no cached snapshot exists yet.',
  mcp_error: 'The Instana MCP query failed.',
};

const fmtNum = (v, d = 0) => (v == null || Number.isNaN(v) ? 'n/a' : Number(v).toFixed(d));
const fmtPct = (v) => (v == null ? 'n/a' : `${v}%`);
const fmtBytes = (b) => {
  if (b == null) return 'n/a';
  const gib = b / 1024 ** 3;
  return gib >= 1 ? `${gib.toFixed(0)} GiB` : `${(b / 1024 ** 2).toFixed(0)} MiB`;
};
// Host label for the topology: first DNS label (ocp-worker-03.retail.internal -> ocp-worker-03).
const hostLabel = (n = '') => { const h = n.split('.')[0]; return h.length > 26 ? `${h.slice(0, 12)}…${h.slice(-10)}` : h; };
const podLabel = (n = '') => (n.length > 30 ? `${n.slice(0, 14)}…${n.slice(-13)}` : n);
const shortName = (n = '') => (n.length > 24 ? `${n.slice(0, 11)}…${n.slice(-10)}` : n);

function gaugeColor(percent) {
  if (percent >= 80) return '#da1e28';
  if (percent >= 65) return '#f1c21b';
  return '#24a148';
}

// ── Circular gauge ───────────────────────────────────────────────────────────

function CircularGauge({ value, size = 80, strokeWidth = 7, label, sublabel }) {
  const known = value != null;
  const percent = known ? Math.min(100, Math.max(0, value)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = known ? gaugeColor(percent) : '#6f6f6f';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      role="img" aria-label={`${label}: ${known ? `${value} percent` : 'not available'}`}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent"
            stroke="var(--cds-layer-02, #262626)" strokeWidth={strokeWidth} />
          {known && (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent"
              stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease',
                filter: `drop-shadow(0 0 5px ${color}88)`,
              }} />
          )}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: known ? 14 : 12, fontWeight: 700, color: 'var(--cds-text-primary)',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {known ? `${value}%` : 'n/a'}
          </span>
          {sublabel && (
            <span style={{ fontSize: 9, color: 'var(--cds-text-secondary)', marginTop: 2 }}>{sublabel}</span>
          )}
        </div>
      </div>
      {label && (
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--cds-text-secondary)', marginTop: 6 }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ── Linear bar ───────────────────────────────────────────────────────────────

function AnimatedBar({ label, value, sublabel }) {
  const known = value != null;
  const percent = known ? Math.min(100, Math.max(0, value)) : 0;
  const color = known ? gaugeColor(percent) : '#6f6f6f';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'var(--cds-text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ color: 'var(--cds-text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {known ? `${value}%` : 'n/a'}{' '}
          {sublabel && <span style={{ color: 'var(--cds-text-secondary)', fontWeight: 400 }}>({sublabel})</span>}
        </span>
      </div>
      <div style={{ height: 6, width: '100%', background: 'var(--cds-layer-02, #2c2c2c)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${percent}%`, background: color, borderRadius: 3,
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease',
          boxShadow: known ? `0 0 6px ${color}99` : 'none',
        }} />
      </div>
    </div>
  );
}

function SevPill({ severity }) {
  const c = SEV_COLOR[severity] ?? '#6f6f6f';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      color: c, background: `${c}22`, border: `1px solid ${c}66`, whiteSpace: 'nowrap',
    }}>
      {SEV_LABEL[severity] ?? 'Unknown'}
    </span>
  );
}

function Banner({ tone, children }) {
  const c = tone === 'error' ? '#da1e28' : '#f1c21b';
  return (
    <div role="status" style={{
      margin: '0 20px 12px', padding: '8px 14px', borderRadius: 4, fontSize: 12,
      color: 'var(--cds-text-primary)', background: `${c}1f`, border: `1px solid ${c}66`,
    }}>
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DigitalTwinPanel({ onAskBob, mock = null, syncVersion = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [clusterSel, setClusterSel] = useState('');        // '' = bridge auto-selects
  const [selectedNodeId, setSelectedNodeId] = useState(null); // null = bridge focus node
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [rateSecs, setRateSecs] = useState(0);
  const dataRef = useRef(null);
  // Topology is drawn at 1 SVG unit = 1 CSS px so its text matches the rest of the panel.
  const [topoW, setTopoW] = useState(0);
  const roRef = useRef(null);
  const topoRef = useCallback((node) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!node) return;
    setTopoW(node.clientWidth);
    if (typeof ResizeObserver !== 'undefined') {
      roRef.current = new ResizeObserver((entries) => {
        const w = Math.round(entries[0].contentRect.width);
        setTopoW((prev) => (prev === w ? prev : w));
      });
      roRef.current.observe(node);
    }
  }, []);
  const inFlight = useRef(false);

  const load = useCallback(async (force = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const qs = new URLSearchParams({ window: '900000' });
      if (clusterSel) qs.set('cluster', clusterSel);
      if (force) qs.set('force', 'true');
      const res = await fetch(`/api/infrastructure/digital-twin?${qs}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error(`Bridge returned non-JSON (HTTP ${res.status})`);
      const json = await res.json();
      dataRef.current = json;
      setData(json);
      setFetchError(res.ok ? null : (json.error || `HTTP ${res.status}`));
      setLastRefreshed(new Date());
    } catch (e) {
      setFetchError(e.message);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [clusterSel]);

  // Initial load, reload when the cluster changes, then poll.
  // Polling is suspended while the Instana rate-limit window is active.
  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(() => {
      const d = dataRef.current;
      if (d?.rateLimited && d.resetTs && d.resetTs * 1000 > Date.now()) return;
      load();
    }, mock ? MOCK_POLL_MS : POLL_MS);
    return () => clearInterval(t);
  }, [load, !!mock]);

  // Mock mode: a scenario was loaded/reset elsewhere — refresh immediately.
  useEffect(() => { if (syncVersion > 0) load(true); }, [syncVersion]);

  // Reset the node focus only when the cluster changes.
  useEffect(() => { setSelectedNodeId(null); }, [clusterSel]);

  // Rate-limit countdown
  useEffect(() => {
    if (!data?.rateLimited || !data.resetTs) { setRateSecs(0); return undefined; }
    const tick = () => setRateSecs(Math.max(0, Math.ceil((data.resetTs * 1000 - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data]);

  const nodes = data?.nodes ?? [];
  const cluster = data?.cluster;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
    || nodes.find((n) => n.id === data?.focusNodeId)
    || nodes[0];
  const clusters = data?.clusters ?? [];
  const clusterName = cluster?.name ?? clusterSel;
  const status = cluster?.status ?? 'ok';
  const statusColor = SEV_COLOR[status] ?? '#6f6f6f';
  const hasNodes = nodes.length > 0;

  const askBob = () => {
    if (!selectedNode || !onAskBob) return;
    onAskBob(
      `Investigate node pressure, pod restarts and open Instana issues on Kubernetes node ${selectedNode.name} ` +
      `in cluster ${clusterName}. Use Instana tools to verify CPU/memory requests, pod allocation and events.`,
    );
  };

  // ── Topology geometry (generated from live nodes; 1 unit = 1 CSS px) ──
  const T_PRIMARY = 13, T_SECONDARY = 11;          // same sizes as "Worker Node Infrastructure Telemetry"
  const svgW = Math.max(900, topoW);
  const PAD = 12, TOP = 40;
  const CL_W = 170, CL_H = 112;
  const NODE_W = 276, NODE_H = 60, NODE_GAP = 14;
  const POD_W = 290, POD_H = 48, POD_GAP = 10;
  const POD_X = svgW - PAD - POD_W;
  const NODE_X = Math.round(PAD + CL_W + (POD_X - (PAD + CL_W) - NODE_W) / 2);
  const svgNodes = nodes.slice(0, MAX_SVG_NODES);
  const hiddenNodes = Math.max(0, nodes.length - svgNodes.length);
  const nodeY = (i) => TOP + i * (NODE_H + NODE_GAP);
  const allPods = selectedNode?.pods ?? [];
  const svgPods = allPods.slice(0, MAX_SVG_PODS);
  const hiddenPods = Math.max(0, allPods.length - svgPods.length);
  const selIdx = Math.max(0, svgNodes.findIndex((n) => n.id === selectedNode?.id));
  const podsBlockH = svgPods.length * (POD_H + POD_GAP) - POD_GAP;
  const svgH = Math.max(200,
    TOP + svgNodes.length * (NODE_H + NODE_GAP) + 6 + (hiddenNodes ? 20 : 0),
    TOP + podsBlockH + 30);
  const clusterY = Math.round(svgH / 2 - CL_H / 2);
  const podY = (i) => Math.max(TOP - 4, svgH / 2 - podsBlockH / 2) + i * (POD_H + POD_GAP);
  const nodeCounts = nodes.reduce((acc, n) => { acc[n.severity] = (acc[n.severity] || 0) + 1; return acc; }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--cds-background)' }}>
      <style>{`
        @keyframes pulse-glow-red { 0% { box-shadow: 0 0 0 0 rgba(218,30,40,.7);} 70% { box-shadow: 0 0 0 10px rgba(218,30,40,0);} 100% { box-shadow: 0 0 0 0 rgba(218,30,40,0);} }
        @keyframes pulse-glow-green { 0% { box-shadow: 0 0 0 0 rgba(36,161,72,.6);} 70% { box-shadow: 0 0 0 6px rgba(36,161,72,0);} 100% { box-shadow: 0 0 0 0 rgba(36,161,72,0);} }
        @keyframes flow-dash-fast { to { stroke-dashoffset: -60; } }
        @keyframes flow-dash-normal { to { stroke-dashoffset: -40; } }
        .dt-node { cursor: pointer; outline: none; opacity: .88; transition: opacity .15s ease; }
        .dt-node:hover, .dt-node[aria-pressed="true"] { opacity: 1; }
        .dt-node .dt-node-bg { transition: fill .15s ease, stroke .15s ease; }
        .dt-node:hover .dt-node-bg { fill: var(--cds-layer-hover-01, #333); }
        .dt-node:focus-visible .dt-node-bg { stroke: #ffffff; stroke-width: 3; }
        @media (prefers-reduced-motion: reduce) { .dt-flow, .dt-pulse { animation: none !important; } .dt-node, .dt-node .dt-node-bg { transition: none; } }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px',
        borderBottom: '1px solid var(--cds-border-subtle-01)', background: 'var(--cds-layer-01)',
        flexShrink: 0, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 6, background: 'linear-gradient(135deg,#0f62fe,#002d9c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }} aria-hidden="true">☸️</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--cds-text-primary)' }}>
                Infrastructure Insights &amp; OpenShift Digital Twin
              </h2>
              {hasNodes && (
                <span className="dt-pulse" style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: '#fff',
                  background: statusColor,
                  animation: status === 'critical' ? 'pulse-glow-red 1.6s infinite'
                    : status === 'ok' ? 'pulse-glow-green 2.4s infinite' : 'none',
                }}>
                  {status === 'ok' ? 'HEALTHY' : status === 'warning' ? 'WARNING' : 'CRITICAL'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginTop: 2 }}>
              {mock ? 'Mock cluster (STREAM_MODE=mock)' : 'Live from Instana via MCP'} · requests/limits vs capacity · 15 min window
              {lastRefreshed && ` · updated ${lastRefreshed.toLocaleTimeString()}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {mock && <SimulatedBadge />}
          {mock && <ScenarioControl {...mock} />}
          <label htmlFor="dt-cluster" style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>Cluster</label>
          <select id="dt-cluster" value={clusterSel || clusterName || ''}
            onChange={(e) => setClusterSel(e.target.value)}
            disabled={clusters.length === 0}
            style={{
              maxWidth: 260, fontSize: 12, padding: '5px 8px', borderRadius: 4, fontFamily: 'inherit',
              background: 'var(--cds-layer-02)', color: 'var(--cds-text-primary)',
              border: '1px solid var(--cds-border-subtle-01)',
            }}>
            {clusters.length === 0 && <option value="">{clusterName || 'no clusters'}</option>}
            {clusters.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({c.nodesCount} nodes)</option>
            ))}
          </select>
          <button type="button" onClick={() => load(true)} title="Refresh now (bypass bridge cache)"
            aria-label="Refresh infrastructure snapshot"
            style={{
              width: 32, height: 32, borderRadius: 4, cursor: 'pointer', fontSize: 16,
              background: 'var(--cds-layer-02)', color: 'var(--cds-text-primary)',
              border: '1px solid var(--cds-border-subtle-01)',
            }}>↻</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 20px' }}>
        {/* ── State banners ── */}
        {fetchError && <Banner tone="error">Bridge error: {fetchError}</Banner>}
        {data?.isStale && <Banner tone="warn">Stale snapshot: {data.notice || 'showing last cached data.'}</Banner>}
        {data?.rateLimited && rateSecs > 0 && (
          <Banner tone="warn">Instana rate limit active — polling paused. Resets in {rateSecs}s.</Banner>
        )}
        {cluster?.selection && cluster.selection !== 'query' && (
          <Banner tone="warn">
            Cluster auto-selected ({cluster.selection === 'env' ? 'INSTANA_K8S_CLUSTER' : 'highest CPU requests'}).
            Use the picker to inspect another cluster.
          </Banner>
        )}
        {data?.clustersTruncated && <Banner tone="warn">Cluster list is truncated; set INSTANA_K8S_CLUSTER for a specific cluster.</Banner>}

        {loading && !data && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--cds-text-secondary)' }} role="status">
            {mock ? 'Loading mock cluster…' : 'Querying Instana for Kubernetes entities…'}
          </div>
        )}

        {!loading && !hasNodes && (
          <div style={{
            margin: '0 20px', padding: 24, borderRadius: 6, background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-subtle-01)', color: 'var(--cds-text-secondary)', fontSize: 13,
          }}>
            <strong style={{ color: 'var(--cds-text-primary)' }}>No infrastructure data available.</strong>
            <div style={{ marginTop: 6 }}>
              {UNAVAILABLE_TEXT[data?.reason] ?? 'The bridge returned no node data.'}
              {data?.notice ? ` ${data.notice}` : ''}
              {data?.error ? ` (${data.error})` : ''}
            </div>
          </div>
        )}

        {hasNodes && (
          <>
            {/* ── Overview cards ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12, padding: '0 20px', marginBottom: 16,
            }}>
              <div style={cardStyle}>
                <div style={cardTitle}>OpenShift / Kubernetes cluster</div>
                <Row k="Cluster" v={cluster.name} />
                <Row k="Worker nodes" v={cluster.nodesCount} />
                <Row k="Pods monitored" v={`${cluster.podsMonitored}${cluster.podsTruncated ? '+ (list truncated)' : ''}`} />
                <Row k="Status" v={<SevPill severity={status} />} />
              </div>
              <div style={cardStyle}>
                <div style={cardTitle}>{mock ? 'Open issues (mock)' : 'Open Instana issues'}</div>
                <Row k="Total (all nodes)" v={cluster.openIssues} />
                {nodes.filter((n) => n.issues.length).slice(0, 3).map((n) => (
                  <Row key={n.id} k={shortName(n.name)} v={`${n.issues.length} issue${n.issues.length > 1 ? 's' : ''}`} />
                ))}
                {cluster.openIssues === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>No open issues reported by Instana.</div>
                )}
              </div>
              <div style={cardStyle}>
                <div style={cardTitle}>How to read these metrics</div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--cds-text-secondary)' }}>
                  CPU and memory gauges are <strong>requests vs allocatable capacity</strong> from Instana, not live
                  utilisation. Pod gauges are usage vs the pod&apos;s own limits. Values show “n/a” when Instana
                  returns no data.
                </div>
              </div>
            </div>

            {/* ── Topology ── */}
            <div style={{ ...cardStyle, margin: '0 20px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ ...cardTitle, marginBottom: 0 }}>Live Topology — click a node to focus</div>
                {selectedNode && (
                  <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>
                    Focused: <b style={{ color: 'var(--cds-text-primary)' }}>{hostLabel(selectedNode.name)}</b>
                    {' '}· {allPods.length} pod{allPods.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>
              <div ref={topoRef} style={{ overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} role="group"
                aria-label={`Topology of cluster ${cluster.name} with ${nodes.length} nodes`}
                style={{ display: 'block', fontFamily: 'inherit' }}>
                <defs>
                  <filter id="glowRed"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <filter id="glowBlue"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>

                {/* lane headers (same style as the card titles) */}
                {[['CLUSTER', PAD], ['WORKER NODES', NODE_X], [`PODS${selectedNode ? ` · ${hostLabel(selectedNode.name)}` : ''}`, POD_X]].map(([t, x]) => (
                  <text key={t} x={x} y="18" fontSize={T_SECONDARY} fontWeight="700" letterSpacing="0.05em" fill="var(--cds-text-secondary)">{t.toUpperCase()}</text>
                ))}
                <line x1={PAD} y1="26" x2={svgW - PAD} y2="26" stroke="var(--cds-border-subtle-01)" strokeWidth="1" />

                {/* cluster */}
                <g transform={`translate(${PAD},${clusterY})`}>
                  <rect width={CL_W} height={CL_H} rx="8" fill="var(--cds-layer-02)" stroke={statusColor} strokeWidth="2"
                    filter={status === 'critical' ? 'url(#glowRed)' : undefined} />
                  <text x={CL_W / 2} y="34" textAnchor="middle" fontSize="22">☸️</text>
                  <text x={CL_W / 2} y="56" textAnchor="middle" fontSize={T_SECONDARY} fontWeight="700" fill="var(--cds-text-primary)">
                    {cluster.name.length > 24 ? `${cluster.name.slice(0, 23)}…` : cluster.name}
                  </text>
                  <text x={CL_W / 2} y="72" textAnchor="middle" fontSize={T_SECONDARY} fill="var(--cds-text-secondary)">
                    {cluster.nodesCount} nodes · {cluster.podsMonitored ?? '?'} pods
                  </text>
                  <rect x={(CL_W - 78) / 2} y="82" width="78" height="18" rx="9" fill={statusColor} />
                  <text x={CL_W / 2} y="95" textAnchor="middle" fontSize="10" fontWeight="700" fill={status === 'warning' ? '#161616' : '#fff'}>
                    {(SEV_LABEL[status] ?? 'Unknown').toUpperCase()}
                  </text>
                </g>

                {/* cluster → node flows + node cards */}
                {svgNodes.map((n, i) => {
                  const c = SEV_COLOR[n.severity];
                  const y = nodeY(i);
                  const sel = n.id === selectedNode?.id;
                  const bad = n.severity !== 'ok';
                  const crit = n.podSummary.critical;
                  const warn = n.podSummary.warning;
                  const x0 = PAD + CL_W;
                  const dx = (NODE_X - x0) / 2;
                  return (
                    <g key={n.id}>
                      <path d={`M${x0},${clusterY + CL_H / 2} C${x0 + dx},${clusterY + CL_H / 2} ${NODE_X - dx},${y + NODE_H / 2} ${NODE_X},${y + NODE_H / 2}`}
                        className="dt-flow" fill="none" stroke={sel ? '#4589ff' : c} strokeWidth={sel ? 2.5 : 1.5}
                        strokeDasharray="6 6" opacity={sel ? 1 : 0.45}
                        style={{ animation: `${bad ? 'flow-dash-fast' : 'flow-dash-normal'} 1.4s linear infinite` }} />
                      <circle cx={NODE_X} cy={y + NODE_H / 2} r="3.5" fill={sel ? '#4589ff' : c} />
                      <g className="dt-node" role="button" tabIndex={0} aria-pressed={sel}
                        aria-label={`Node ${n.name}, ${SEV_LABEL[n.severity]}, ${n.podSummary.total} pods. Select to focus.`}
                        onClick={() => setSelectedNodeId(n.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedNodeId(n.id); } }}>
                        <title>{n.name}</title>
                        <rect className="dt-node-bg" x={NODE_X} y={y} width={NODE_W} height={NODE_H} rx="8"
                          fill={sel ? 'var(--cds-layer-02)' : 'var(--cds-layer-01)'}
                          stroke={sel ? '#4589ff' : c} strokeWidth={sel ? 2.5 : 1.2} strokeOpacity={sel ? 1 : 0.7}
                          filter={sel ? 'url(#glowBlue)' : bad ? 'url(#glowRed)' : undefined} />
                        <rect x={NODE_X + 1} y={y + 9} width="4" height={NODE_H - 18} rx="2" fill={c} />
                        <circle cx={NODE_X + 26} cy={y + NODE_H / 2} r="10" fill={c} />
                        <text x={NODE_X + 26} y={y + NODE_H / 2 + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill={n.severity === 'warning' ? '#161616' : '#fff'}>
                          {n.severity === 'ok' ? '✓' : '!'}
                        </text>
                        <text x={NODE_X + 46} y={y + 26} fontSize={T_PRIMARY} fontWeight="700" fill="var(--cds-text-primary)">{hostLabel(n.name)}</text>
                        <text x={NODE_X + 46} y={y + 44} fontSize={T_SECONDARY} fill="var(--cds-text-secondary)">{n.zone ?? 'zone n/a'} · {n.podSummary.total} pods</text>
                        {(crit > 0 || warn > 0) && (
                          <text x={NODE_X + NODE_W - 12} y={y + 44} textAnchor="end" fontSize={T_SECONDARY} fontWeight="700">
                            {crit > 0 && <tspan fill="#ff8389">{crit} crit</tspan>}
                            {crit > 0 && warn > 0 && <tspan fill="var(--cds-text-secondary)"> · </tspan>}
                            {warn > 0 && <tspan fill="#f1c21b">{warn} warn</tspan>}
                          </text>
                        )}
                        {sel && (
                          <g>
                            <rect x={NODE_X + NODE_W - 64} y={y - 9} width="56" height="16" rx="8" fill="#0f62fe" />
                            <text x={NODE_X + NODE_W - 36} y={y + 2.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff">FOCUSED</text>
                          </g>
                        )}
                      </g>
                    </g>
                  );
                })}
                {hiddenNodes > 0 && (
                  <text x={NODE_X} y={svgH - 6} fontSize={T_SECONDARY} fill="var(--cds-text-secondary)">
                    +{hiddenNodes} more node{hiddenNodes > 1 ? 's' : ''} — pick from the selector below
                  </text>
                )}

                {/* focused node → pods */}
                {selectedNode && svgNodes.length > 0 && svgPods.map((p, i) => {
                  const y = podY(i);
                  const c = SEV_COLOR[p.severity];
                  const ny = nodeY(selIdx) + NODE_H / 2;
                  const x0 = NODE_X + NODE_W;
                  const dx = (POD_X - x0) / 2;
                  return (
                    <g key={`${p.namespace}/${p.name}`}>
                      <path d={`M${x0},${ny} C${x0 + dx},${ny} ${POD_X - dx},${y + POD_H / 2} ${POD_X},${y + POD_H / 2}`}
                        className="dt-flow" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="5 5" opacity="0.7"
                        style={{ animation: 'flow-dash-normal 1.6s linear infinite' }} />
                      <g>
                        <title>{`${p.namespace ?? ''}/${p.name}`}</title>
                        <rect x={POD_X} y={y} width={POD_W} height={POD_H} rx="6" fill="var(--cds-layer-01)" stroke={c} strokeOpacity="0.7" strokeWidth="1.2" />
                        <rect x={POD_X + 1} y={y + 8} width="3.5" height={POD_H - 16} rx="1.75" fill={c} />
                        <text x={POD_X + 16} y={y + 20} fontSize={T_PRIMARY} fontWeight="700" fill="var(--cds-text-primary)">{podLabel(p.name)}</text>
                        <text x={POD_X + 16} y={y + 37} fontSize={T_SECONDARY} fill="var(--cds-text-secondary)">
                          {p.namespace ?? 'ns n/a'} · mem {p.mem ?? fmtPct(p.memToLimitPct)}
                        </text>
                      </g>
                    </g>
                  );
                })}
                {selectedNode && hiddenPods > 0 && (
                  <text x={POD_X} y={podY(svgPods.length - 1) + POD_H + 16} fontSize={T_SECONDARY} fill="var(--cds-text-secondary)">
                    +{hiddenPods} more pod{hiddenPods > 1 ? 's' : ''} — see the pod list below
                  </text>
                )}
                {selectedNode && svgPods.length === 0 && (
                  <text x={POD_X} y={svgH / 2} fontSize={T_SECONDARY} fill="var(--cds-text-secondary)">No pod data for this node</text>
                )}
              </svg>
              </div>

              {/* legend */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontSize: 11, color: 'var(--cds-text-secondary)' }}>
                {['ok', 'warning', 'critical'].map((k) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: SEV_COLOR[k] }} />
                    {SEV_LABEL[k]}{nodeCounts[k] ? ` (${nodeCounts[k]})` : ''}
                  </span>
                ))}
                <span style={{ marginLeft: 'auto' }}>Enter or Space also focuses a node</span>
              </div>
            </div>

            {/* ── Selected node detail ── */}
            {selectedNode && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 12, padding: '0 20px',
              }}>
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={cardTitle}>Worker Node Infrastructure Telemetry</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cds-text-primary)', wordBreak: 'break-all' }}>
                        {selectedNode.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginTop: 2 }}>
                        Zone: {selectedNode.zone ?? 'n/a'} • IP: {selectedNode.ip ?? 'n/a'} • OS: {selectedNode.os ?? 'n/a'}
                      </div>
                    </div>
                    <SevPill severity={selectedNode.severity} />
                  </div>

                  {nodes.length > 1 && (
                    <div style={{ marginBottom: 12 }}>
                      <label htmlFor="dt-node" style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginRight: 8 }}>Focus node</label>
                      <select id="dt-node" value={selectedNode.id} onChange={(e) => setSelectedNodeId(e.target.value)}
                        style={{
                          maxWidth: '70%', fontSize: 12, padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit',
                          background: 'var(--cds-layer-02)', color: 'var(--cds-text-primary)',
                          border: '1px solid var(--cds-border-subtle-01)',
                        }}>
                        {nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {shortName(n.name)} — {SEV_LABEL[n.severity]}{n.id === data.focusNodeId ? ' (worst)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <CircularGauge size={86} value={selectedNode.metrics.cpuRequestedPct} label="CPU requested"
                      sublabel={selectedNode.metrics.cpuCapacityCores != null ? `${fmtNum(selectedNode.metrics.cpuCapacityCores)} cores` : undefined} />
                    <CircularGauge size={86} value={selectedNode.metrics.memRequestedPct} label="Memory requested"
                      sublabel={selectedNode.metrics.memCapacityBytes != null ? fmtBytes(selectedNode.metrics.memCapacityBytes) : undefined} />
                    <CircularGauge size={86} value={selectedNode.metrics.podAllocationPct} label="Pod allocation"
                      sublabel={selectedNode.metrics.podsCapacity != null
                        ? `${fmtNum(selectedNode.metrics.podsAllocated)}/${fmtNum(selectedNode.metrics.podsCapacity)}` : undefined} />
                  </div>

                  <AnimatedBar label="CPU limits vs allocatable" value={selectedNode.metrics.cpuLimitPct} />

                  {selectedNode.mock ? (
                    <div style={{ margin: '8px 0 10px' }}>
                      <AnimatedBar label="Disk (mock)" value={selectedNode.mock.diskPercent} />
                      <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>
                        Instana agent: {selectedNode.mock.agentStatus} (mock) · Net in/out:{' '}
                        {selectedNode.mock.netInMbps}/{selectedNode.mock.netOutMbps} Mbps (mock)
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', margin: '8px 0 10px' }}>
                      Instana entity present for this node (snapshot {String(selectedNode.id).slice(0, 12)}…).
                      Agent version, disk and network I/O are not fetched by this view.
                    </div>
                  )}

                  <div style={{ ...cardTitle, marginTop: 8 }}>Open Instana issues ({selectedNode.issues.length})</div>
                  {selectedNode.issues.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginBottom: 10 }}>None reported for this node.</div>
                  )}
                  {selectedNode.issues.map((iss, i) => (
                    <div key={iss.id ?? i} style={{
                      fontSize: 11, padding: '6px 8px', marginBottom: 6, borderRadius: 4,
                      borderLeft: `3px solid ${SEV_COLOR[iss.severity]}`, background: 'var(--cds-layer-02)',
                      color: 'var(--cds-text-primary)',
                    }}>
                      <div style={{ fontWeight: 600 }}>{iss.text}</div>
                      {iss.fixSuggestion && (
                        <div style={{ color: 'var(--cds-text-secondary)', marginTop: 2 }}>Instana suggests: {iss.fixSuggestion}</div>
                      )}
                    </div>
                  ))}

                  <button type="button" onClick={askBob} style={{
                    width: '100%', marginTop: 10, padding: '10px 14px', borderRadius: 4, border: 'none',
                    background: '#0f62fe', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    🤖 Ask Autonomous SRE Agent to Diagnose {shortName(selectedNode.name)}
                  </button>
                </div>

                <div style={cardStyle}>
                  <div style={{ ...cardTitle, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Hosted Pods (worst first)</span>
                    <span style={{ fontWeight: 400 }}>
                      {selectedNode.podSummary.total} listed · {selectedNode.podSummary.critical} critical · {selectedNode.podSummary.warning} warning
                    </span>
                  </div>
                  {cluster.podsTruncated && (
                    <div style={{ fontSize: 10, color: 'var(--cds-text-secondary)', marginBottom: 6 }}>
                      Pod list is capped by the bridge; this node may host more pods than shown.
                    </div>
                  )}
                  {selectedNode.pods.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--cds-text-secondary)' }}>No pod telemetry returned for this node.</div>
                  )}
                  <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedNode.pods.map((p) => {
                      const c = SEV_COLOR[p.severity];
                      return (
                        <div key={`${p.namespace}/${p.name}`} style={{
                          padding: '8px 10px', borderRadius: 4, background: 'var(--cds-layer-02)',
                          border: `1px solid ${p.severity === 'critical' ? '#da1e28' : 'var(--cds-border-subtle-01)'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} aria-hidden="true" />
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cds-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={p.name}>{p.name}</span>
                            </div>
                            <SevPill severity={p.severity} />
                          </div>
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 10.5, color: 'var(--cds-text-secondary)' }}>
                            <span>Namespace: <b style={{ color: 'var(--cds-text-primary)' }}>{p.namespace ?? 'n/a'}</b></span>
                            <span>CPU/limit: <b style={{ color: 'var(--cds-text-primary)' }}>{fmtPct(p.cpuToLimitPct)}</b></span>
                            {p.mem
                              ? <span>Mem: <b style={{ color: 'var(--cds-text-primary)' }}>{p.mem}</b></span>
                              : <span>Mem/limit: <b style={{ color: 'var(--cds-text-primary)' }}>{fmtPct(p.memToLimitPct)}</b></span>}
                            <span>Restarts: <b style={{ color: 'var(--cds-text-primary)' }}>{fmtNum(p.restarts)}</b></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  padding: 14, borderRadius: 6, background: 'var(--cds-layer-01)',
  border: '1px solid var(--cds-border-subtle-01)',
};
const cardTitle = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--cds-text-secondary)', marginBottom: 8,
};

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', gap: 8 }}>
      <span style={{ color: 'var(--cds-text-secondary)' }}>{k}</span>
      <span style={{ color: 'var(--cds-text-primary)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
    </div>
  );
}
