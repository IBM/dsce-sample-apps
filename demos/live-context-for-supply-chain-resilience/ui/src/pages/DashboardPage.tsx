// ui/src/pages/DashboardPage.tsx
// Page 1: Turnaround Readiness Dashboard (spec/07)
import React, { useEffect, useState } from 'react';
import {
  Button,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  InlineLoading,
  Tile,
  InlineNotification,
  Tag,
} from '@carbon/react';
import { Warning } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { getRisks, getResilienceProfile } from '../api/client';
import { SeverityTag } from '../components/shared/SeverityTag';
import { ReadinessBadge } from '../components/shared/ReadinessBadge';
import type { RiskEvent, SupplyChainResilienceProfile } from '../types';

const TABLE_HEADERS = [
  { key: 'risk_id', header: 'Risk ID' },
  { key: 'severity', header: 'Severity' },
  { key: 'material_id', header: 'Material' },
  { key: 'work_package_id', header: 'Work Package' },
  { key: 'risk_type', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'event_time', header: 'Detected At' },
];

// Demo: always fetch the resilience profile for CVA-8842 / TW-2047
const DEMO_WP = 'TW-2047';
const DEMO_MAT = 'CVA-8842';
const DEMO_PORT = 'SGSIN';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [risks, setRisks] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ kind: 'success' | 'error'; title: string; subtitle: string } | null>(null);
  const [resilienceProfile, setResilienceProfile] = useState<SupplyChainResilienceProfile | null>(null);
  const [profileAgeSecs, setProfileAgeSecs] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, resilience] = await Promise.allSettled([
        getRisks(),
        getResilienceProfile(DEMO_WP, DEMO_MAT),
      ]);
      if (data.status === 'fulfilled') setRisks(data.value.risks ?? []);
      if (resilience.status === 'fulfilled') {
        setResilienceProfile(resilience.value.profile);
        setProfileAgeSecs(resilience.value.profile_age_secs);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const critical = risks.filter(r => r.severity === 'CRITICAL').length;
  const high = risks.filter(r => r.severity === 'HIGH').length;
  const open = risks.filter(r => r.status === 'OPEN').length;
  const mitigated = risks.filter(r => r.status === 'MITIGATED').length;

  const rows = risks.map(r => ({
    id: r.risk_id,
    risk_id: r.risk_id,
    severity: <SeverityTag severity={r.severity} />,
    material_id: r.material_id,
    work_package_id: r.work_package_id,
    risk_type: r.risk_type,
    status: <Tag type={r.status === 'MITIGATED' ? 'green' : 'blue'} size="sm">{r.status}</Tag>,
    event_time: new Date(r.event_time).toLocaleString(),
  }));

  return (
    <div className="tsci-page-content">
      <div className="tsci-page-header">
        <h1 className="bob-ask-title">
          Turnaround Readiness Dashboard
        </h1>
        <p className="bob-ask-subtitle">
          Pearl GTL · TA-DEMO-2026
        </p>
      </div>

      {/* Scrolling disruption ticker — replaces the block banner */}
      <DisruptionTicker portCode={DEMO_PORT} materialId={DEMO_MAT} />

      {notification && (
        <InlineNotification
          kind={notification.kind}
          title={notification.title}
          subtitle={notification.subtitle}
          onClose={() => setNotification(null)}
          className="tsci-notification"
        />
      )}

      {/* KPI Tiles */}
      <div className="tsci-kpi-grid">
        <Tile className="tsci-kpi-tile tsci-kpi-critical">
          <span className="tsci-kpi-label">Critical Risks</span>
          <span className="tsci-kpi-value">{critical}</span>
        </Tile>
        <Tile className="tsci-kpi-tile tsci-kpi-warning">
          <span className="tsci-kpi-label">High Risks</span>
          <span className="tsci-kpi-value">{high}</span>
        </Tile>
        <Tile className="tsci-kpi-tile">
          <span className="tsci-kpi-label">Open</span>
          <span className="tsci-kpi-value">{open}</span>
        </Tile>
        <Tile className="tsci-kpi-tile tsci-kpi-success">
          <span className="tsci-kpi-label">Mitigated</span>
          <span className="tsci-kpi-value">{mitigated}</span>
        </Tile>
      </div>

      {/* Supply Chain Resilience Posture Strip */}
      {resilienceProfile && (
        <>
          <div className="tsci-resilience-strip-header">
<span>
              Supply Chain Resilience — Critical Material Posture
            </span>
            {profileAgeSecs != null && profileAgeSecs > 300 && (
              <span className="tsci-stale-warning">
                <Warning size={16} /> Profile data may be stale ({Math.round(profileAgeSecs / 60)}m old)
              </span>
            )}
          </div>
          <div className="tsci-resilience-strip">
            <div className="tsci-resilience-tile">
              <span className="tsci-kpi-label">Material</span>
<code className="tsci-text-strong">{resilienceProfile.material_id}</code>
            </div>
            <div className="tsci-resilience-tile">
              <span className="tsci-kpi-label">Readiness</span>
              <ReadinessBadge status={resilienceProfile.readiness_status} />
            </div>
            <div className="tsci-resilience-tile">
              <span className="tsci-kpi-label">Resilience Score</span>
              <span
                className="tsci-resilience-score"
                data-status={resilienceProfile.readiness_status}
              >
                {Math.round(resilienceProfile.resilience_score)}
              </span>
            </div>
            <div className="tsci-resilience-tile">
              <span className="tsci-kpi-label">Unconstrained Suppliers</span>
              <span className="tsci-resilience-metric" style={{
                color: resilienceProfile.unconstrained_approved_supplier_count === 0
                  ? 'var(--cds-support-error)'
                  : resilienceProfile.unconstrained_approved_supplier_count === 1
                    ? 'var(--cds-support-warning)'
                    : 'var(--cds-support-success)',
              }}>
                {resilienceProfile.unconstrained_approved_supplier_count}
              </span>
            </div>
            <div className="tsci-resilience-tile">
              <span className="tsci-kpi-label">Transfer Locations</span>
<span className="tsci-resilience-metric">
                {resilienceProfile.feasible_transfer_location_count}
              </span>
            </div>
            <div className="tsci-resilience-tile">
              <span className="tsci-kpi-label">Primary Supplier</span>
              <ConstraintStatusBadge status={resilienceProfile.primary_supplier_status} />
            </div>
            {resilienceProfile.secondary_supplier_status && (
              <div className="tsci-resilience-tile">
                <span className="tsci-kpi-label">Secondary Supplier</span>
                <ConstraintStatusBadge status={resilienceProfile.secondary_supplier_status} />
              </div>
            )}
          </div>
        </>
      )}

      {loading && <InlineLoading description="Loading…" className="tsci-inline-loading" />}

      {/* Risks Table */}
      <DataTable rows={rows} headers={TABLE_HEADERS}>
        {({ rows: tableRows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <TableContainer title="Active Risk Events" description="Live Confluent-driven risk detections">
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(h => (
                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>
                      {h.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={TABLE_HEADERS.length} className="tsci-empty-cell">
                      No risks detected. Go to Configuration → Backend API → Demo Scenario Controls to run a scenario.
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map(row => (
                    <TableRow
                      {...getRowProps({ row })}
                      key={row.id}
                      className="tsci-clickable-row"
                      onClick={() => navigate(`/risks/${row.id}`)}
                    >
                      {row.cells.map(cell => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

// ── Internal helpers ─────────────────────────────────────────────────────────

const ConstraintStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const isActive = status.includes('CRITICAL') || status.includes('HIGH');
  return (
    <span className={`tsci-badge tsci-constraint-badge ${isActive ? 'active-risk' : 'clear'}`}>
      {status === 'ACTIVE' ? '✓ Active' : status}
    </span>
  );
};

// Scrolling ticker — fetches port status once and scrolls the alert under the title
const DisruptionTicker: React.FC<{ portCode: string; materialId: string }> = ({ portCode, materialId }) => {
  const [disruption, setDisruption] = React.useState<{ name: string; type: string; severity: string } | null>(null);

  React.useEffect(() => {
    import('../api/client').then(({ getPortStatus }) => {
      getPortStatus(portCode, materialId).then(ps => {
        if (ps.status !== 'NO_DISRUPTION' && ps.disruption_type && ps.severity) {
          if (ps.severity === 'HIGH' || ps.severity === 'CRITICAL') {
            setDisruption({ name: ps.port_name, type: ps.disruption_type, severity: ps.severity });
          }
        }
      }).catch(() => {/* silently skip if backend down */});
    });
  }, [portCode, materialId]);

  if (!disruption) return null;

  const isCritical = disruption.severity === 'CRITICAL';
  const message = `⚠ Port Disruption — ${disruption.name} (${portCode}) · ${disruption.type} / ${disruption.severity} · Affecting supply routes for ${materialId} · ETA impact on SHP-90017 +4 days`;

  return (
    <div className="tsci-ticker-strip" role="marquee" aria-label="Live disruption alert">
      <span className={`tsci-ticker-inner${isCritical ? ' tsci-ticker-inner--critical' : ''}`}>
        <span className="tsci-ticker-dot" aria-hidden="true" />
        {message}
        &nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;
        <span className="tsci-ticker-dot" aria-hidden="true" />
        {message}
      </span>
    </div>
  );
};
