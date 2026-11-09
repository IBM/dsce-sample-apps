import React, { useState, useEffect, useCallback } from 'react';
import ScenarioControl, { SimulatedBadge } from './ScenarioControl.jsx';

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - (ts > 1e12 ? ts : ts * 1000);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function errColor(rate) {
  if (rate >= 10) return '#da1e28';
  if (rate >= 3)  return '#f1c21b';
  return '#24a148';
}

function latColor(ms) {
  if (ms >= 3000) return '#da1e28';
  if (ms >= 1500) return '#f1c21b';
  return '#24a148';
}

function sevBadge(sev) {
  const map = {
    critical: { bg: '#da1e28', text: '#fff', label: '🔴 Critical' },
    warning:  { bg: '#f1c21b', text: '#161616', label: '🟡 Warning' },
    info:     { bg: '#0f62fe', text: '#fff', label: '🔵 Info'     },
  };
  const s = map[sev] ?? map.info;
  return (
    <span style={{
      background: s.bg, color: s.text,
      padding: '1px 6px', borderRadius: 3,
      fontSize: 10, fontWeight: 700,
    }}>{s.label}</span>
  );
}

// ── sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, unit = '', sub, color, loading }) {
  return (
    <div style={{
      background: 'var(--cds-layer-01)',
      border: '1px solid var(--cds-border-subtle-01)',
      borderRadius: 4,
      padding: '14px 16px',
      minWidth: 0,
      flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: 28, background: 'var(--cds-skeleton-element)', borderRadius: 3, animation: 'pulse 1.4s ease-in-out infinite' }} />
      ) : (
        <div style={{ fontSize: 26, fontWeight: 300, color: color ?? 'var(--cds-text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value ?? '—'}
          {unit && <span style={{ fontSize: 13, marginLeft: 3, color: 'var(--cds-text-secondary)' }}>{unit}</span>}
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 4, background: 'var(--cds-layer-02)', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
    </div>
  );
}

function ServiceTable({ services, loading, winLabel }) {
  const maxCalls = Math.max(...(services.map((s) => s.calls)), 1);
  return (
    <div style={{ background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--cds-border-subtle-01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cds-text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Retail Microservices Telemetry{winLabel ? ` · Last ${winLabel}` : ''}
        </span>
        <span style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>{services.length} services</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--cds-layer-02)' }}>
              {['Service', 'Calls', 'Volume', 'Errors', 'Error Rate', 'P90 Latency', 'Mean Latency'].map((h) => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--cds-text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--cds-border-subtle-01)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3,4].map((i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7].map((j) => (
                    <td key={j} style={{ padding: '8px 12px' }}>
                      <div style={{ height: 12, background: 'var(--cds-skeleton-element)', borderRadius: 2 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : services.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--cds-text-secondary)' }}>No service data</td></tr>
            ) : (
              services.map((svc) => (
                <tr key={svc.name} style={{ borderBottom: '1px solid var(--cds-border-subtle-01)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--cds-layer-hover-01)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px', color: 'var(--cds-text-primary)', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {svc.name}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--cds-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {svc.calls.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', minWidth: 80 }}>
                    <MiniBar value={svc.calls} max={maxCalls} color="#0f62fe" />
                  </td>
                  <td style={{ padding: '8px 12px', color: svc.errors > 0 ? '#da1e28' : 'var(--cds-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {svc.errors.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ color: errColor(svc.errorRate), fontWeight: svc.errorRate > 0 ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
                      {Number(svc.errorRate).toFixed(2)}%
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {svc.p90 != null
                      ? <span style={{ color: latColor(svc.p90) }}>{svc.p90.toLocaleString()} ms</span>
                      : <span style={{ color: 'var(--cds-text-placeholder)' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--cds-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {svc.mean != null ? `${svc.mean.toLocaleString()} ms` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventList({ events, title, emptyText, loading, onInvestigate }) {
  return (
    <div style={{ background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--cds-border-subtle-01)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cds-text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {loading ? (
          [1,2].map((i) => (
            <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--cds-border-subtle-01)' }}>
              <div style={{ height: 12, background: 'var(--cds-skeleton-element)', borderRadius: 2, marginBottom: 4 }} />
              <div style={{ height: 10, background: 'var(--cds-skeleton-element)', borderRadius: 2, width: '60%' }} />
            </div>
          ))
        ) : events.length === 0 ? (
          <div style={{ padding: '16px 14px', color: 'var(--cds-text-secondary)', fontSize: 12, textAlign: 'center' }}>
            ✅ {emptyText}
          </div>
        ) : (
          events.map((ev) => (
            <div key={ev.id ?? ev.title} style={{ padding: '8px 14px', borderBottom: '1px solid var(--cds-border-subtle-01)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--cds-text-primary)', lineHeight: 1.4, marginBottom: 3 }}>{ev.title}</div>
                {ev.entity && <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.entity}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                {sevBadge(ev.severity)}
                <span style={{ fontSize: 10, color: 'var(--cds-text-placeholder)' }}>{relativeTime(ev.start)}</span>
                {onInvestigate && (
                  <button
                    onClick={() => onInvestigate(
                      `Investigate Instana ${ev.id ? `event ${ev.id}` : 'event'}: ${ev.title}${ev.entity ? ` (entity: ${ev.entity})` : ''}`,
                    )}
                    style={{
                      marginTop: 2, padding: '2px 8px', fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                      border: '1px solid #0f62fe', borderRadius: 3, background: 'rgba(15, 98, 254, 0.12)',
                      color: '#78a9ff', cursor: 'pointer',
                    }}
                  >
                    🤖 Investigate
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '5m',  ms: 300_000   },
  { label: '15m', ms: 900_000   },
  { label: '1h',  ms: 3_600_000 },
  { label: '3h',  ms: 10_800_000},
  { label: '24h', ms: 86_400_000},
];

export default function InsightsDashboard({ onAskBob, mock = null, syncVersion = 0 }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [rateLimitSecs, setRateLimitSecs] = useState(0); // countdown seconds
  const [win, setWin]             = useState(3_600_000);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchInsights = useCallback(async (w, force = false) => {
    const resolvedWin = w ?? win;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/insights?window=${resolvedWin}${force ? '&force=true' : ''}`);
      const d = await r.json();
      if (r.status === 429) {
        const resetTs = d.resetTs ? d.resetTs * 1000 : Date.now() + 60_000;
        setRateLimitSecs(Math.max(1, Math.ceil((resetTs - Date.now()) / 1000)));
        throw new Error(d.error ?? 'Instana API rate limit exceeded.');
      }
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setData(d);
      if (d.rateLimited && d.resetTs) {
        const resetTs = d.resetTs * 1000;
        setRateLimitSecs(Math.max(1, Math.ceil((resetTs - Date.now()) / 1000)));
      } else {
        setRateLimitSecs(0);
      }
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [win]);

  // Fetch on mount and when window changes; mock mode also refetches when a
  // scenario is loaded/reset (syncVersion) so all tabs stay consistent.
  useEffect(() => { fetchInsights(win, syncVersion > 0); }, [win, syncVersion]);

  // Auto-refresh every 60s (skip if rate limited)
  useEffect(() => {
    const t = setInterval(() => { if (rateLimitSecs <= 0) fetchInsights(win); }, 60_000);
    return () => clearInterval(t);
  }, [win, fetchInsights, rateLimitSecs]);

  // Countdown ticker — starts whenever rateLimitSecs is set to a positive value,
  // auto-retries when it reaches 0
  useEffect(() => {
    if (rateLimitSecs <= 0) return;
    const t = setInterval(() => {
      setRateLimitSecs((s) => {
        if (s <= 1) {
          clearInterval(t);
          // Schedule retry outside the state updater
          setTimeout(() => fetchInsights(), 100);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rateLimitSecs]); // re-runs each time a new countdown value is set

  const s = data?.summary;
  const window = win; // alias for JSX below
  const winLabel = WINDOWS.find((w) => w.ms === win)?.label;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', overflowY: 'auto', flex: 1 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cds-text-primary)' }}>
          Retail Application — {mock ? 'Mock Insights' : 'Live Insights'}
        </span>
        {mock && <SimulatedBadge />}

        {/* Time window selector */}
        <div style={{ display: 'flex', border: '1px solid var(--cds-border-subtle-01)', borderRadius: 4, overflow: 'hidden' }}>
          {WINDOWS.map((w) => (
            <button key={w.ms} onClick={() => setWin(w.ms)} style={{
              padding: '4px 10px', border: 'none', cursor: 'pointer', fontSize: 12,
              background: win === w.ms ? '#0f62fe' : 'var(--cds-layer-01)',
              color:      win === w.ms ? '#fff'    : 'var(--cds-text-secondary)',
              fontFamily: 'inherit', transition: 'background 0.1s',
            }}>{w.label}</button>
          ))}
        </div>

        <button onClick={() => fetchInsights(win, true)} disabled={loading || rateLimitSecs > 0} style={{
          padding: '4px 10px', border: '1px solid var(--cds-border-subtle-01)', borderRadius: 4,
          background: rateLimitSecs > 0 ? 'var(--cds-layer-02)' : 'var(--cds-layer-01)',
          color: rateLimitSecs > 0 ? '#f1c21b' : 'var(--cds-text-secondary)',
          cursor: (loading || rateLimitSecs > 0) ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit',
        }}>
          {loading ? '⟳ Loading…' : rateLimitSecs > 0 ? `⏳ Cooldown (${rateLimitSecs}s)` : '↺ Refresh'}
        </button>

        {lastFetch && (
          <span style={{ fontSize: 11, color: 'var(--cds-text-placeholder)', marginLeft: 'auto' }}>
            {data?.isStale ? 'Cached snapshot · ' : ''}Updated {lastFetch.toLocaleTimeString()} · auto-refresh 60s
          </span>
        )}
      </div>

      {mock && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 12px',
          background: 'var(--cds-layer-01)', border: '1px dashed #f1c21b', borderRadius: 4,
        }}>
          <ScenarioControl {...mock} />
          <span style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>
            Demo mode: injected anomalies are mock data; no Instana query is made.
          </span>
        </div>
      )}

      {data?.isStale && (
        <div style={{ background: '#2d1f00', border: '1px solid #f1c21b', borderRadius: 4, padding: '8px 14px', fontSize: 12, color: '#f1c21b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>ℹ️ Instana API rate limit active on tenant. Showing latest cached telemetry snapshot (refreshes automatically when limit resets).</span>
        </div>
      )}

      {data?.unavailable && (
        <div style={{ background: '#2d1f00', border: '1px solid #f1c21b', borderRadius: 4, padding: '8px 14px', fontSize: 12, color: '#f1c21b' }}>
          ⚠ {data.notice ?? 'Telemetry is currently unavailable.'} No data is shown until Instana responds.
        </div>
      )}

      {error && !data && (
        <div style={{ background: '#2d0709', border: '1px solid #da1e28', borderRadius: 4, padding: '8px 14px', fontSize: 12, color: '#fa4d56' }}>
          ⚠ {error} — <button onClick={() => fetchInsights(window, true)} style={{ background: 'none', border: 'none', color: '#ff8389', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, fontFamily: 'inherit' }}>retry</button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KpiCard label="Total Calls"    value={s?.totalCalls?.toLocaleString()}    loading={loading && !data} />
        <KpiCard label="Total Errors"   value={s?.totalErrors?.toLocaleString()}   loading={loading && !data}
          color={s?.totalErrors > 0 ? '#da1e28' : '#24a148'} />
        <KpiCard label="Error Rate"     value={s?.overallErrorRate}  unit="%"      loading={loading && !data}
          color={s ? errColor(s.overallErrorRate) : undefined}
          sub={s?.overallErrorRate >= 10 ? '🔴 Critical' : s?.overallErrorRate >= 3 ? '🟡 Warning' : '✅ Healthy'} />
        <KpiCard label="Top P90 Latency" value={s?.topP90?.toLocaleString()}  unit="ms" loading={loading && !data}
          color={s?.topP90 != null ? latColor(s.topP90) : undefined} />
        <KpiCard label="Open Incidents" value={s?.openIncidents}               loading={loading && !data}
          color={s?.openIncidents > 0 ? '#da1e28' : '#24a148'} />
        <KpiCard label="Open Issues"    value={s?.openIssues}                  loading={loading && !data}
          color={s?.openIssues > 0 ? '#f1c21b' : '#24a148'} />
      </div>

      {/* ── Service table ── */}
      <ServiceTable services={data?.services ?? []} loading={loading && !data} winLabel={winLabel} />

      {/* ── Events row ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <EventList title="Open Incidents" events={data?.incidents ?? []} emptyText="No open incidents" loading={loading && !data} onInvestigate={onAskBob} />
        <EventList title="Open Issues"    events={data?.issues    ?? []} emptyText="No open issues"    loading={loading && !data} onInvestigate={onAskBob} />
      </div>

      {/* ── Ask Bob button ── */}
      {data && onAskBob && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 8 }}>
          {[
            'Explain the root cause of errors in the Retail Application',
            'Which service has the worst error rate and why?',
            'Give me a full health report for the Retail Application',
            'Are there any SLO breaches for the Retail Application?',
          ].map((q) => (
            <button key={q} onClick={() => onAskBob(q)} style={{
              padding: '5px 12px', border: '1px solid var(--cds-border-subtle-01)', borderRadius: 4,
              background: 'var(--cds-layer-01)', color: 'var(--cds-text-secondary)',
              cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cds-layer-hover-01)'; e.currentTarget.style.color = 'var(--cds-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cds-layer-01)';       e.currentTarget.style.color = 'var(--cds-text-secondary)'; }}
            >
              💬 {q}
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
