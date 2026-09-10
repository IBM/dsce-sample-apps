// ui/src/pages/ActiveRisksPage.tsx
// Active Risks — grouped risk registry with inline facts, filter controls,
// and direct navigation to each Risk Detail page.
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  InlineLoading, Tag, Button, InlineNotification,
} from '@carbon/react';
import { Renew, DataAdd } from '@carbon/icons-react';
import { getRisks, demoPopulate, demoReset } from '../api/client';
import { SeverityTag } from '../components/shared/SeverityTag';
import type { RiskEvent, RiskSeverity, RiskStatus } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: RiskSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const STATUS_COLORS: Record<RiskStatus, 'red' | 'blue' | 'purple' | 'teal' | 'green' | 'warm-gray'> = {
  OPEN:                 'red',
  INVESTIGATING:        'blue',
  MITIGATION_PROPOSED:  'purple',
  APPROVED:             'teal',
  MITIGATED:            'green',
  CLOSED:               'warm-gray',
};

const RISK_TYPE_LABEL: Record<string, string> = {
  SUPPLY_DELAY:         'Supply Delay',
  QUALITY_HOLD:         'Quality Hold',
  PORT_CONGESTION:      'Port Congestion',
  CAPACITY_CONSTRAINT:  'Capacity Constraint',
  LEAD_TIME_EXTENSION:  'Lead Time Extension',
  FORCE_MAJEURE:        'Force Majeure',
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    viewBox="0 0 16 16" fill="currentColor" width="14" height="14"
    style={{ transition: 'transform 0.18s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    aria-hidden="true"
  >
    <path d="M6 4l4 4-4 4V4z" />
  </svg>
);

const ArrowRight: React.FC = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

interface RiskCardProps {
  risk: RiskEvent;
  onNavigate: (id: string) => void;
}

const RiskCard: React.FC<RiskCardProps> = ({ risk, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const facts = risk.facts as Record<string, string | number>;

  const delayDays = facts.delay_days as number | undefined;
  const requiredBy = facts.required_by as string | undefined;
  const currentEta = facts.current_eta as string | undefined;
  const shortage = facts.shortage_quantity as number | undefined;
  const delayReason = facts.delay_reason_code as string | undefined;

  return (
    <div
      className={`tsci-risk-card${open ? ' tsci-risk-card--open' : ''}`}
      data-severity={risk.severity}
    >
      {/* ── Card header row ────────────────────────────────────────────── */}
      <button
        className="tsci-risk-card-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <ChevronIcon open={open} />
        <span className="tsci-risk-card-id">{risk.risk_id}</span>
        <SeverityTag severity={risk.severity} />
        <Tag type={STATUS_COLORS[risk.status] ?? 'blue'} size="sm">{risk.status}</Tag>
        <span className="tsci-risk-card-meta">
          <code>{risk.material_id}</code>
          <span className="tsci-risk-card-sep">·</span>
          <code>{risk.work_package_id}</code>
          <span className="tsci-risk-card-sep">·</span>
          <span>{RISK_TYPE_LABEL[risk.risk_type] ?? risk.risk_type}</span>
        </span>
        <span className="tsci-risk-card-time">
          {new Date(risk.event_time).toLocaleString()}
        </span>
      </button>

      {/* ── Expanded facts ─────────────────────────────────────────────── */}
      {open && (
        <div className="tsci-risk-card-body">
          <div className="tsci-risk-facts-grid">
            {requiredBy && (
              <div className="tsci-risk-fact">
                <span className="tsci-risk-fact-label">Required By</span>
                <span className="tsci-risk-fact-value">
                  {new Date(requiredBy).toLocaleDateString()}
                </span>
              </div>
            )}
            {currentEta && (
              <div className="tsci-risk-fact">
                <span className="tsci-risk-fact-label">Current ETA</span>
                <span className="tsci-risk-fact-value tsci-text-danger">
                  {new Date(currentEta).toLocaleDateString()}
                </span>
              </div>
            )}
            {delayDays != null && (
              <div className="tsci-risk-fact">
                <span className="tsci-risk-fact-label">Delay</span>
                <span className="tsci-risk-fact-value tsci-text-danger">+{delayDays}d</span>
              </div>
            )}
            {shortage != null && (
              <div className="tsci-risk-fact">
                <span className="tsci-risk-fact-label">Shortage Qty</span>
                <span className="tsci-risk-fact-value tsci-text-danger">{shortage}</span>
              </div>
            )}
            {delayReason && (
              <div className="tsci-risk-fact">
                <span className="tsci-risk-fact-label">Delay Reason</span>
                <span className="tsci-risk-fact-value">{delayReason}</span>
              </div>
            )}
            {risk.shipment_id && (
              <div className="tsci-risk-fact">
                <span className="tsci-risk-fact-label">Shipment</span>
                <code className="tsci-risk-fact-value">{risk.shipment_id}</code>
              </div>
            )}
            {risk.correlation_id && (
              <div className="tsci-risk-fact">
                <span className="tsci-risk-fact-label">Correlation ID</span>
                <code className="tsci-risk-fact-value">{risk.correlation_id}</code>
              </div>
            )}
          </div>

          {/* Resilience flags strip */}
          {risk.resilience_flags && (
            <div className="tsci-risk-flags">
              <FlagPill
                label="Primary Constrained"
                active={risk.resilience_flags.primary_supplier_constrained}
              />
              <FlagPill
                label="Secondary Constrained"
                active={risk.resilience_flags.secondary_supplier_constrained}
              />
              <FlagPill
                label="Alt Inventory"
                active={risk.resilience_flags.alternate_inventory_available}
                positiveWhenActive
              />
              <FlagPill
                label="Substitute Approved"
                active={risk.resilience_flags.approved_substitute_document_exists}
                positiveWhenActive
              />
              <span className="tsci-risk-flag-meta">
                {risk.resilience_flags.active_sourcing_tiers} active tier
                {risk.resilience_flags.active_sourcing_tiers !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <button
            className="tsci-risk-detail-link"
            onClick={() => onNavigate(risk.risk_id)}
          >
            View full detail &amp; mitigation options <ArrowRight />
          </button>
        </div>
      )}
    </div>
  );
};

const FlagPill: React.FC<{ label: string; active: boolean; positiveWhenActive?: boolean }> = ({
  label, active, positiveWhenActive = false,
}) => {
  const isGood = positiveWhenActive ? active : !active;
  return (
    <span
      className="tsci-risk-flag-pill"
      style={{
        color: isGood ? 'var(--tsci-green)' : 'var(--tsci-red)',
        background: isGood ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
        borderColor: isGood ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)',
      }}
    >
      {active ? '✓' : '✗'} {label}
    </span>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export const ActiveRisksPage: React.FC = () => {
  const navigate = useNavigate();
  const [risks, setRisks] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [populating, setPopulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<RiskStatus | 'ALL'>('ALL');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRisks();
      setRisks(data.risks);
    } catch {
      setError('Could not load risks — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handlePopulate = async () => {
    setPopulating(true);
    setError(null);
    try {
      await demoReset();
      await demoPopulate();
      await load();
    } catch {
      setError('Could not populate demo data — is the backend running?');
    } finally {
      setPopulating(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Derived counts ──────────────────────────────────────────────────────────
  const critical   = risks.filter(r => r.severity === 'CRITICAL').length;
  const high       = risks.filter(r => r.severity === 'HIGH').length;
  const open       = risks.filter(r => r.status === 'OPEN').length;
  const mitigated  = risks.filter(r => r.status === 'MITIGATED').length;
  const investigating = risks.filter(r => r.status === 'INVESTIGATING').length;

  // ── Filtered + grouped ──────────────────────────────────────────────────────
  const filtered = useMemo(() => risks.filter(r => {
    if (severityFilter !== 'ALL' && r.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    return true;
  }), [risks, severityFilter, statusFilter]);

  const grouped = useMemo(() =>
    SEVERITY_ORDER
      .map(sev => ({ sev, items: filtered.filter(r => r.severity === sev) }))
      .filter(g => g.items.length > 0),
    [filtered],
  );

  const allStatuses = useMemo(() =>
    Array.from(new Set(risks.map(r => r.status))) as RiskStatus[],
    [risks],
  );

  return (
    <div className="tsci-page-content">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="tsci-page-header">
        <div>
          <h1 className="bob-ask-title">Active Risks</h1>
          <p className="bob-ask-subtitle">
            Pearl GTL · TA-2026 · Risk registry grouped by severity
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button
            kind="tertiary"
            renderIcon={DataAdd}
            iconDescription="Populate demo data"
            onClick={handlePopulate}
            disabled={populating || loading}
            size="sm"
          >
            {populating ? 'Populating…' : 'Populate Demo Data'}
          </Button>
          <Button
            kind="ghost"
            renderIcon={Renew}
            iconDescription="Refresh"
            onClick={load}
            disabled={loading || populating}
            size="sm"
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          title="Load failed"
          subtitle={error}
          onClose={() => setError(null)}
          className="tsci-notification"
        />
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────── */}
      <div className="tsci-kpi-grid">
        <div className="tsci-kpi-tile tsci-kpi-critical">
          <span className="tsci-kpi-label">Critical</span>
          <span className="tsci-kpi-value">{critical}</span>
        </div>
        <div className="tsci-kpi-tile tsci-kpi-warning">
          <span className="tsci-kpi-label">High</span>
          <span className="tsci-kpi-value">{high}</span>
        </div>
        <div className="tsci-kpi-tile">
          <span className="tsci-kpi-label">Open</span>
          <span className="tsci-kpi-value">{open}</span>
        </div>
        <div className="tsci-kpi-tile">
          <span className="tsci-kpi-label">Investigating</span>
          <span className="tsci-kpi-value">{investigating}</span>
        </div>
        <div className="tsci-kpi-tile tsci-kpi-success">
          <span className="tsci-kpi-label">Mitigated</span>
          <span className="tsci-kpi-value">{mitigated}</span>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="tsci-risk-filter-bar">
        <span className="tsci-risk-filter-label">Severity</span>
        {(['ALL', ...SEVERITY_ORDER] as const).map(s => (
          <button
            key={s}
            className={`tsci-filter-chip${severityFilter === s ? ' active' : ''}`}
            onClick={() => setSeverityFilter(s)}
          >
            {s}
          </button>
        ))}
        <span className="tsci-risk-filter-sep" />
        <span className="tsci-risk-filter-label">Status</span>
        {(['ALL', ...allStatuses] as const).map(s => (
          <button
            key={s}
            className={`tsci-filter-chip${statusFilter === s ? ' active' : ''}`}
            onClick={() => setStatusFilter(s as RiskStatus | 'ALL')}
          >
            {s}
          </button>
        ))}
        {(severityFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            className="tsci-link-btn"
            onClick={() => { setSeverityFilter('ALL'); setStatusFilter('ALL'); }}
          >
            Clear filters
          </button>
        )}
        <span className="tsci-risk-filter-count">
          {loading ? <InlineLoading /> : `${filtered.length} of ${risks.length} risk${risks.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Risk groups ────────────────────────────────────────────────── */}
      {!loading && risks.length === 0 && (
        <div className="tsci-card tsci-card--dashed tsci-board-empty">
          <p className="tsci-body-md">No risks detected yet.</p>
          <p className="tsci-board-empty-hint">
            Go to the Readiness Dashboard and click "Simulate Delay Scenario" to generate demo risk data.
          </p>
        </div>
      )}

      {!loading && risks.length > 0 && filtered.length === 0 && (
        <div className="tsci-card tsci-card--dashed tsci-board-empty">
          <p className="tsci-body-md">No risks match the current filters.</p>
        </div>
      )}

      {grouped.map(({ sev, items }) => (
        <div key={sev} className="tsci-risk-group">
          <div className="tsci-risk-group-header" data-severity={sev}>
            <SeverityTag severity={sev} />
            <span className="tsci-risk-group-count">{items.length} risk{items.length !== 1 ? 's' : ''}</span>
          </div>
          {items.map(r => (
            <RiskCard key={r.risk_id} risk={r} onNavigate={id => navigate(`/risks/${id}`)} />
          ))}
        </div>
      ))}
    </div>
  );
};
