// ui/src/pages/EventsPage.tsx
// Confluent Event Stream Monitor — shows live/simulated topic events
// Covers: supplier_status, port_status, shipment_update, material_requirement,
//         risk_detected, readiness_assessed (from spec/03 EVENT_CONTRACTS)
import React, { useState, useEffect, useRef } from 'react';
import { Tag } from '@carbon/react';

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind =
  | 'SUPPLIER_STATUS'
  | 'PORT_STATUS'
  | 'SHIPMENT_UPDATE'
  | 'MATERIAL_REQUIREMENT'
  | 'RISK_DETECTED'
  | 'READINESS_ASSESSED'
  | 'AVL_CHANGED';

interface StreamEvent {
  id: string;
  ts: number;
  topic: string;
  kind: EventKind;
  key: string;
  payload: Record<string, string | number | boolean>;
}

// ── Seed data — the demo scenario T+0..T+8 ────────────────────────────────────
const SEED_EVENTS: StreamEvent[] = [
  {
    id: 'e-001', ts: Date.now() - 8 * 60_000, topic: 'tsci.supplier.status', kind: 'SUPPLIER_STATUS',
    key: 'SUP-101::CVA-8842',
    payload: { supplier_id: 'SUP-101', material_id: 'CVA-8842', constraint_type: 'QUALITY_HOLD', severity: 'CRITICAL', affected_qty: 1 },
  },
  {
    id: 'e-002', ts: Date.now() - 7 * 60_000, topic: 'tsci.port.status', kind: 'PORT_STATUS',
    key: 'SGSIN',
    payload: { port_code: 'SGSIN', port_name: 'Port of Singapore', disruption_type: 'PORT_CONGESTION', severity: 'HIGH', affected_materials: 'CVA-8842', eta_delay_days: 4 },
  },
  {
    id: 'e-003', ts: Date.now() - 6 * 60_000, topic: 'tsci.shipment.update', kind: 'SHIPMENT_UPDATE',
    key: 'SHP-90017',
    payload: { shipment_id: 'SHP-90017', supplier_id: 'SUP-203', status: 'DELAYED', delay_days: 4, current_location: 'SGSIN', eta: '2026-03-22T00:00:00Z' },
  },
  {
    id: 'e-004', ts: Date.now() - 5 * 60_000, topic: 'tsci.avl.changed', kind: 'AVL_CHANGED',
    key: 'CVA-8842',
    payload: { material_id: 'CVA-8842', supplier_id: 'SUP-205', action: 'APPROVED', tier: 'TERTIARY', constrained: false },
  },
  {
    id: 'e-005', ts: Date.now() - 4 * 60_000, topic: 'tsci.material.requirement', kind: 'MATERIAL_REQUIREMENT',
    key: 'TW-2047::CVA-8842',
    payload: { work_package_id: 'TW-2047', material_id: 'CVA-8842', quantity_required: 1, required_by: '2026-03-18T00:00:00Z', criticality: 'CRITICAL' },
  },
  {
    id: 'e-006', ts: Date.now() - 3 * 60_000, topic: 'tsci.risk.detected', kind: 'RISK_DETECTED',
    key: 'RISK-CVA8842-TW2047',
    payload: { risk_id: 'RISK-CVA8842-TW2047', material_id: 'CVA-8842', work_package_id: 'TW-2047', severity: 'CRITICAL', risk_type: 'SUPPLY_DELAY', shipment_id: 'SHP-90017' },
  },
  {
    id: 'e-007', ts: Date.now() - 2 * 60_000, topic: 'tsci.readiness.assessed', kind: 'READINESS_ASSESSED',
    key: 'TW-2047::CVA-8842',
    payload: { work_package_id: 'TW-2047', material_id: 'CVA-8842', resilience_score: 60.5, readiness_status: 'CRITICAL', unconstrained_suppliers: 1, transfer_locations: 1 },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<EventKind, { bg: string; text: string }> = {
  SUPPLIER_STATUS:      { bg: 'rgba(248,113,113,0.12)',  text: 'var(--tsci-red)' },
  PORT_STATUS:          { bg: 'rgba(251,146,60,0.12)',   text: 'var(--tsci-orange)' },
  SHIPMENT_UPDATE:      { bg: 'rgba(250,204,21,0.12)',   text: 'var(--tsci-yellow)' },
  MATERIAL_REQUIREMENT: { bg: 'rgba(124,158,248,0.12)', text: 'var(--tsci-accent)' },
  RISK_DETECTED:        { bg: 'rgba(248,113,113,0.18)',  text: 'var(--tsci-red)' },
  READINESS_ASSESSED:   { bg: 'rgba(74,222,128,0.12)',   text: 'var(--tsci-green)' },
  AVL_CHANGED:          { bg: 'rgba(45,212,191,0.12)',   text: 'var(--tsci-teal)' },
};

const TOPIC_LABEL: Record<string, string> = {
  'tsci.supplier.status':     'supplier.status',
  'tsci.port.status':         'port.status',
  'tsci.shipment.update':     'shipment.update',
  'tsci.avl.changed':         'avl.changed',
  'tsci.material.requirement':'material.requirement',
  'tsci.risk.detected':       'risk.detected',
  'tsci.readiness.assessed':  'readiness.assessed',
};

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── Topic summary cards ───────────────────────────────────────────────────────
const TOPICS = [
  { id: 'tsci.supplier.status',      label: 'supplier.status',      kind: 'SUPPLIER_STATUS' as EventKind,      desc: 'SUP-101 QUALITY_HOLD/CRITICAL' },
  { id: 'tsci.port.status',          label: 'port.status',          kind: 'PORT_STATUS' as EventKind,          desc: 'SGSIN PORT_CONGESTION/HIGH' },
  { id: 'tsci.shipment.update',      label: 'shipment.update',      kind: 'SHIPMENT_UPDATE' as EventKind,      desc: 'SHP-90017 DELAYED +4d' },
  { id: 'tsci.avl.changed',          label: 'avl.changed',          kind: 'AVL_CHANGED' as EventKind,          desc: 'SUP-205 approved (TERTIARY)' },
  { id: 'tsci.material.requirement', label: 'material.requirement', kind: 'MATERIAL_REQUIREMENT' as EventKind, desc: 'CVA-8842 needed by 2026-03-18' },
  { id: 'tsci.risk.detected',        label: 'risk.detected',        kind: 'RISK_DETECTED' as EventKind,        desc: 'RISK-CVA8842-TW2047 CRITICAL' },
  { id: 'tsci.readiness.assessed',   label: 'readiness.assessed',   kind: 'READINESS_ASSESSED' as EventKind,   desc: 'Score 60.5 — CRITICAL posture' },
];

// ── Flink SQL rules ───────────────────────────────────────────────────────────
const FLINK_RULES = [
  {
    name: 'risk_rule_v2',
    sql: `INSERT INTO risk_detected
SELECT
  CONCAT('RISK-', material_id, '-', work_package_id) AS risk_id,
  material_id, work_package_id,
  'SUPPLY_DELAY' AS risk_type,
  'CRITICAL' AS severity,
  CURRENT_TIMESTAMP AS event_time
FROM supplier_status
JOIN material_requirement ON supplier_status.material_id = material_requirement.material_id
WHERE supplier_status.severity IN ('CRITICAL','HIGH')
  AND supplier_status.constraint_type <> 'CLEARED';`,
    status: 'RUNNING',
  },
  {
    name: 'readiness_assessment_job',
    sql: `INSERT INTO readiness_assessed
SELECT
  r.work_package_id, r.material_id,
  COUNT(DISTINCT CASE WHEN ss.constrained = FALSE THEN ss.supplier_id END) AS unconstrained_suppliers,
  CURRENT_TIMESTAMP AS assessed_at
FROM risk_detected r
LEFT JOIN supplier_status ss ON r.material_id = ss.material_id
GROUP BY r.work_package_id, r.material_id;`,
    status: 'RUNNING',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<StreamEvent[]>([...SEED_EVENTS].reverse());
  const [filter, setFilter] = useState<EventKind | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate new incoming events every 4s in live mode
  useEffect(() => {
    if (!liveMode) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      const templates = SEED_EVENTS;
      const base = templates[Math.floor(Math.random() * templates.length)];
      if (!base) return;
      const newEvt: StreamEvent = {
        ...base,
        id: `live-${Date.now()}`,
        ts: Date.now(),
        payload: { ...base.payload, simulated: true },
      };
      setEvents(prev => [newEvt, ...prev].slice(0, 80));
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [liveMode]);

  const filtered = filter === 'ALL' ? events : events.filter(e => e.kind === filter);

  return (
    <div className="tsci-page-content">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="tsci-page-header">
        <h1 className="bob-ask-title">Confluent Event Stream</h1>
        <p className="bob-ask-subtitle">Real-time supply chain events · Pearl GTL · TA-DEMO-2026</p>
      </div>

      {/* ── Topic summary cards ──────────────────────────────────────────── */}
      <div className="tsci-event-topic-grid">
        {TOPICS.map(t => {
          const col = KIND_COLORS[t.kind];
          const count = events.filter(e => e.kind === t.kind).length;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(prev => prev === t.kind ? 'ALL' : t.kind)}
              className={`tsci-event-topic-card${filter === t.kind ? ' active' : ''}`}
              style={{ background: filter === t.kind ? col.bg : undefined, borderColor: filter === t.kind ? col.text : undefined }}
            >
              <div className="tsci-event-topic-head">
                <span className="tsci-event-topic-label" style={{ color: col.text }}>{t.label}</span>
                <span className="tsci-event-topic-count" style={{ color: col.text }}>{count}</span>
              </div>
              <div className="tsci-event-topic-desc">{t.desc}</div>
            </button>
          );
        })}
      </div>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="tsci-event-controls">
        <span className="tsci-section-title tsci-event-count">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}{filter !== 'ALL' ? ` · ${filter}` : ''}
        </span>
        <button
          onClick={() => setLiveMode(l => !l)}
          className={`tsci-live-toggle${liveMode ? ' active' : ''}`}
        >
          <span className="tsci-live-dot" />
          {liveMode ? 'LIVE · Simulating' : 'LIVE OFF'}
        </button>
        {filter !== 'ALL' && (
          <button
            onClick={() => setFilter('ALL')}
            className="tsci-link-btn"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* ── Event feed ──────────────────────────────────────────────────── */}
      <div className="tsci-event-feed">
        {filtered.map(evt => {
          const col = KIND_COLORS[evt.kind];
          const isExpanded = expanded === evt.id;
          return (
            <div
              key={evt.id}
              className="tsci-event-card"
              style={{ borderColor: isExpanded ? col.text : undefined, borderLeftColor: col.text }}
            >
              {/* Row */}
              <button
                onClick={() => setExpanded(prev => prev === evt.id ? null : evt.id)}
                className="tsci-event-row"
              >
                {/* Kind badge */}
                <span className="tsci-event-kind tsci-badge" style={{ color: col.text, background: col.bg }}>
                  {evt.kind.replace(/_/g, ' ')}
                </span>
                {/* Topic */}
                <span className="tsci-event-topic">
                  {TOPIC_LABEL[evt.topic] ?? evt.topic}
                </span>
                {/* Key */}
                <span className="tsci-event-key">
                  {evt.key}
                </span>
                {/* Simulated badge */}
                {evt.payload['simulated'] && (
                  <span className="tsci-event-sim">SIM</span>
                )}
                {/* Timestamp */}
                <span className="tsci-event-time">
                  {relTime(evt.ts)}
                </span>
                {/* Chevron */}
                <span className={`tsci-event-chevron${isExpanded ? ' expanded' : ''}`}>▶</span>
              </button>

              {/* Expanded payload */}
              {isExpanded && (
                <div className="tsci-event-payload">
                  <pre className="tsci-code-block">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Flink SQL rules ──────────────────────────────────────────────── */}
      <div className="tsci-event-rules">
        <div className="tsci-section-title">
          FLINK SQL JOBS
        </div>
        {FLINK_RULES.map(rule => (
          <div key={rule.name} className="tsci-rule-card">
            <div className="tsci-rule-head">
              <span className="tsci-rule-name">{rule.name}</span>
              <Tag type="green" size="sm">{rule.status}</Tag>
            </div>
            <pre className="tsci-rule-code">
              {rule.sql}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};
