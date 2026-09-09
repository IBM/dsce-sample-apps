import { useState } from 'react';
import { Select, SelectItem, Button, Tile } from '@carbon/react';
import './Statistics.scss';

// ── Dynamic date helpers ───────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** Return the short month name for a date N months before today. */
function monthLabel(monthsAgo) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return MONTH_SHORT[d.getMonth()];
}

/** Return the short day name for a date N days before today (0 = today). */
function dayLabel(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return DAY_SHORT[d.getDay()];
}

/**
 * Return a "Mon DD" label for a date N days before today.
 * Used for 30d weekly buckets so each label is always unique
 * regardless of what day of the week today falls on.
 */
function weekEndLabel(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// ── Data keyed by time range ───────────────────────────────────────────────────
// Daily labels are computed at module-load time so they always reflect
// the actual current date (e.g. "Last 90 days" in August → Jun / Jul / Aug).

const DATA = {
  '7d': {
    // 7 rows: oldest day first (6 days ago → today)
    daily: [
      { day: dayLabel(6), count:  42, errors: 3 },
      { day: dayLabel(5), count:  58, errors: 1 },
      { day: dayLabel(4), count:  74, errors: 5 },
      { day: dayLabel(3), count:  61, errors: 2 },
      { day: dayLabel(2), count:  89, errors: 4 },
      { day: dayLabel(1), count:  33, errors: 1 },
      { day: dayLabel(0), count:  21, errors: 0 },
    ],
    sourceDist: [
      { label: 'Maximo Live',   count: 178, color: '#24a148' },
      { label: 'Documents',     count: 134, color: '#0f62fe' },
      { label: 'Web Knowledge', count:  66, color: '#8a3ffc' },
    ],
    perf: [
      { source: 'Maximo Live',   avg:  420, p95:  980, p99: 1820 },
      { source: 'Documents',     avg:  640, p95: 1240, p99: 2150 },
      { source: 'Web Knowledge', avg:  390, p95:  820, p99: 1430 },
      { source: 'Synthesis',     avg: 1640, p95: 3100, p99: 4800 },
    ],
    topQueries: [
      { query: 'List all active work orders',  count:  38 },
      { query: 'Pump PM procedure',            count:  27 },
      { query: 'Compressor troubleshooting',   count:  21 },
      { query: 'Asset inspection schedule',    count:  18 },
      { query: 'Open service requests',        count:  16 },
    ],
    kpi: { deltaTotal: '+12% vs prior period', deltaSuccess: '+0.8pp', deltaResp: '−140ms improvement' },
  },

  '30d': {
    // 4 rows: oldest week first — label shows the week-end date (e.g. "Aug 11")
    // so each row is always distinct regardless of what weekday today falls on.
    daily: [
      { day: weekEndLabel(21), count: 312, errors: 14 },
      { day: weekEndLabel(14), count: 387, errors: 18 },
      { day: weekEndLabel(7),  count: 426, errors: 11 },
      { day: weekEndLabel(0),  count: 451, errors: 22 },
    ],
    sourceDist: [
      { label: 'Maximo Live',   count: 724, color: '#24a148' },
      { label: 'Documents',     count: 538, color: '#0f62fe' },
      { label: 'Web Knowledge', count: 314, color: '#8a3ffc' },
    ],
    perf: [
      { source: 'Maximo Live',   avg:  435, p95: 1010, p99: 1890 },
      { source: 'Documents',     avg:  660, p95: 1280, p99: 2240 },
      { source: 'Web Knowledge', avg:  405, p95:  855, p99: 1510 },
      { source: 'Synthesis',     avg: 1710, p95: 3240, p99: 4950 },
    ],
    topQueries: [
      { query: 'List all active work orders',  count: 154 },
      { query: 'Pump PM procedure',            count: 112 },
      { query: 'Asset inspection schedule',    count:  98 },
      { query: 'Compressor troubleshooting',   count:  87 },
      { query: 'Spare parts availability',     count:  74 },
    ],
    kpi: { deltaTotal: '+18% vs prior period', deltaSuccess: '+1.2pp', deltaResp: '−95ms improvement' },
  },

  '90d': {
    // 3 rows: the 3 calendar months ending this month (oldest first)
    daily: [
      { day: monthLabel(2), count: 1140, errors:  52 },
      { day: monthLabel(1), count: 1380, errors:  61 },
      { day: monthLabel(0), count: 1620, errors:  48 },
    ],
    sourceDist: [
      { label: 'Maximo Live',   count: 2180, color: '#24a148' },
      { label: 'Documents',     count: 1640, color: '#0f62fe' },
      { label: 'Web Knowledge', count:  920, color: '#8a3ffc' },
    ],
    perf: [
      { source: 'Maximo Live',   avg:  448, p95: 1045, p99: 1960 },
      { source: 'Documents',     avg:  675, p95: 1310, p99: 2290 },
      { source: 'Web Knowledge', avg:  418, p95:  880, p99: 1560 },
      { source: 'Synthesis',     avg: 1780, p95: 3380, p99: 5120 },
    ],
    topQueries: [
      { query: 'List all active work orders',  count: 468 },
      { query: 'Pump PM procedure',            count: 341 },
      { query: 'Asset inspection schedule',    count: 298 },
      { query: 'Compressor troubleshooting',   count: 261 },
      { query: 'Spare parts availability',     count: 224 },
    ],
    kpi: { deltaTotal: '+23% vs prior period', deltaSuccess: '+1.6pp', deltaResp: '−210ms improvement' },
  },
};

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, delta, up }) {
  return (
    <Tile className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div className={`kpi-delta ${up ? 'kpi-up' : 'kpi-down'}`}>{delta}</div>
      )}
    </Tile>
  );
}

// ── Horizontal stacked bar chart (table-based — no fragile SVG math) ──────────
// Each row: label cell | stacked bar cell (query + error divs) | count cell
function BarChart({ data }) {
  const maxTotal = Math.max(...data.map(d => d.count + d.errors));
  return (
    <div className="bar-chart-wrap">
      <table className="bar-chart-table" aria-label="Daily query volume">
        <tbody>
          {data.map(d => {
            const qPct = (d.count  / maxTotal) * 100;
            const ePct = (d.errors / maxTotal) * 100;
            return (
              <tr key={d.day}>
                <td className="bar-label">{d.day}</td>
                <td className="bar-cell">
                  <div className="bar-track">
                    <div className="bar-fill bar-fill--query"  style={{ width: `${qPct}%` }} />
                    {d.errors > 0 && (
                      <div className="bar-fill bar-fill--error" style={{ width: `${ePct}%` }} />
                    )}
                  </div>
                </td>
                <td className="bar-count">{d.count.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-swatch" style={{ background: '#0f62fe' }} />Queries</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: '#da1e28' }} />Errors</span>
      </div>
    </div>
  );
}

// ── SVG stacked bar (source dist) ─────────────────────────────────────────────
function SourceDistChart({ data, total }) {
  const W = 300, H = 20;
  let x = 0;
  const segments = data.map(d => {
    const w = (d.count / total) * W;
    const seg = { ...d, x, w };
    x += w;
    return seg;
  });

  return (
    <div className="source-dist-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', marginBottom: 12 }}>
        {segments.map((s, i) => (
          <rect key={i} x={s.x} y={0} width={s.w} height={H} fill={s.color} />
        ))}
      </svg>
      <div className="source-dist-legend">
        {data.map((d, i) => (
          <div key={i} className="dist-row">
            <span className="dist-dot" style={{ background: d.color }} />
            <span className="dist-label">{d.label}</span>
            <span className="dist-count">{d.count.toLocaleString()}</span>
            <span className="dist-pct">({Math.round(d.count / total * 100)}%)</span>
            <div className="dist-bar-track">
              <div className="dist-bar-fill" style={{ width: `${Math.round(d.count / total * 100)}%`, background: d.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Statistics() {
  const [range, setRange] = useState('7d');

  const { daily, sourceDist, perf, topQueries, kpi } = DATA[range];

  const total    = daily.reduce((s, d) => s + d.count,  0);
  const errors   = daily.reduce((s, d) => s + d.errors, 0);
  const avgResp  = Math.round(perf.reduce((s, r) => s + r.avg, 0) / perf.length);
  const succRate = (((total - errors) / total) * 100).toFixed(1);
  const totalSrc = sourceDist.reduce((s, r) => s + r.count, 0);
  const maxP95   = Math.max(...perf.map(r => r.p95));

  return (
    <div className="stats-page">
      {/* Header */}
      <div className="stats-page-header">
        <div>
          <h2>Statistics</h2>
          <p>System usage metrics, response performance, and query analytics.</p>
        </div>
        <div className="stats-controls">
          <Select id="range-select" labelText="Time range" size="sm" value={range}
            onChange={e => setRange(e.target.value)} hideLabel>
            <SelectItem value="7d"  text="Last 7 days" />
            <SelectItem value="30d" text="Last 30 days" />
            <SelectItem value="90d" text="Last 90 days" />
          </Select>
          <Button kind="ghost" size="sm">Export</Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row">
        <KPICard label="Total Queries"    value={total.toLocaleString()} delta={kpi.deltaTotal}   up />
        <KPICard label="Success Rate"     value={`${succRate}%`}         delta={kpi.deltaSuccess} up />
        <KPICard label="Avg Response"     value={`${avgResp}ms`}         delta={kpi.deltaResp}    up />
        <KPICard label="Active Instances" value="2"                      delta="unchanged"        up={false} />
      </div>

      {/* Volume + Source distribution */}
      <p className="stats-section-label">Query Volume</p>
      <div className="stats-row-2">
        <Tile className="chart-tile">
          <div className="chart-tile-title">Daily Query Volume</div>
          <BarChart data={daily} />
        </Tile>
        <Tile className="chart-tile">
          <div className="chart-tile-title">Source Distribution</div>
          <SourceDistChart data={sourceDist} total={totalSrc} />
        </Tile>
      </div>

      {/* Response time + Top queries */}
      <p className="stats-section-label">Performance &amp; Top Queries</p>
      <div className="stats-row-2">
        <Tile className="chart-tile">
          <div className="chart-tile-title">Response Time by Source</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Avg</th>
                <th>p95</th>
                <th>p99</th>
                <th className="col-bar">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {perf.map(r => (
                <tr key={r.source}>
                  <td>{r.source}</td>
                  <td>{r.avg} ms</td>
                  <td>{r.p95} ms</td>
                  <td>{r.p99} ms</td>
                  <td className="col-bar">
                    <div className="mini-bar-track">
                      <div className="mini-bar-fill" style={{ width: `${Math.round(r.p95 / maxP95 * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
        <Tile className="chart-tile">
          <div className="chart-tile-title">Top Queries</div>
          <table className="data-table">
            <thead>
              <tr><th>Query</th><th>Count</th></tr>
            </thead>
            <tbody>
              {topQueries.map((q, i) => (
                <tr key={i}>
                  <td className="truncate-cell" title={q.query}>{q.query}</td>
                  <td><strong>{q.count.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
      </div>
    </div>
  );
}
