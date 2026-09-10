// ui/src/pages/ShipmentsPage.tsx
// Shipments & Materials — live shipment status, material readiness, and active risks for Pearl GTL TA-2026
import React, { useEffect, useState } from 'react';
import {
  DataTable, TableContainer, Table, TableHead, TableRow,
  TableHeader, TableBody, TableCell, InlineLoading, Tag, Tile, Button,
} from '@carbon/react';
import { DataAdd } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { getShipment, getRisks, demoPopulate, demoReset } from '../api/client';
import { SeverityTag } from '../components/shared/SeverityTag';
import type { Shipment, RiskEvent } from '../types';

// ── All shipment IDs seeded in the demo backend ────────────────────────────────
const DEMO_SHIPMENT_IDS = [
  'SHP-90017', // CVA-8842 — DELAYED (transport disruption, via Singapore)
  'SHP-90023', // GS-7701 — IN_TRANSIT (Rotterdam → Umm Qasr)
  'SHP-90031', // BP-4410 — CUSTOMS (Hamburg → Umm Qasr, customs hold)
  'SHP-90044', // SV-3320 — IN_TRANSIT (Los Angeles → Umm Qasr)
  'SHP-90058', // TC-8800 — DELIVERED (Osaka → Pearl GTL)
  'SHP-90062', // CVA-8843 — DELAYED (quality hold, via Singapore)
  'SHP-90071', // GS-7701 — PLANNED (Shanghai → Umm Qasr, Nov dispatch)
];

// ── Static material manifest (synthetic demo) ─────────────────────────────────
const MATERIALS = [
  { id: 'CVA-8842', name: 'Control Valve Actuator', qty: 1, unit: 'EA', criticality: 'CRITICAL', workPackage: 'TW-2047', requiredBy: '2026-03-18', status: 'AT RISK' },
  { id: 'GS-7701',  name: 'Gasket Set — HP Flange',  qty: 24, unit: 'SET', criticality: 'HIGH',     workPackage: 'TW-2051', requiredBy: '2026-03-22', status: 'CONFIRMED' },
  { id: 'BP-4410',  name: 'Bearing Pack 4410',        qty: 4,  unit: 'EA', criticality: 'HIGH',     workPackage: 'TW-2055', requiredBy: '2026-03-25', status: 'CONFIRMED' },
  { id: 'SV-3320',  name: 'Safety Relief Valve',      qty: 2,  unit: 'EA', criticality: 'CRITICAL', workPackage: 'TW-2060', requiredBy: '2026-03-20', status: 'CONFIRMED' },
  { id: 'TC-8800',  name: 'Thermocouple Assembly',    qty: 12, unit: 'EA', criticality: 'MEDIUM',   workPackage: 'TW-2049', requiredBy: '2026-03-28', status: 'CONFIRMED' },
];

const SHIP_HEADERS = [
  { key: 'shipment_id',   header: 'Shipment ID' },
  { key: 'material_id',   header: 'Material' },
  { key: 'status',        header: 'Status' },
  { key: 'supplier',      header: 'Supplier' },
  { key: 'original_eta',  header: 'Original ETA' },
  { key: 'current_eta',   header: 'Current ETA' },
  { key: 'delay',         header: 'Delay' },
  { key: 'port',          header: 'Port / Location' },
];

const MAT_HEADERS = [
  { key: 'mat_id',      header: 'Material ID' },
  { key: 'name',        header: 'Description' },
  { key: 'qty',         header: 'Qty' },
  { key: 'criticality', header: 'Criticality' },
  { key: 'workPackage', header: 'Work Package' },
  { key: 'requiredBy',  header: 'Required By' },
  { key: 'status',      header: 'Readiness' },
];

const RISK_HEADERS = [
  { key: 'risk_id',        header: 'Risk ID' },
  { key: 'severity',       header: 'Severity' },
  { key: 'material_id',    header: 'Material' },
  { key: 'work_package_id',header: 'Work Package' },
  { key: 'risk_type',      header: 'Type' },
  { key: 'status',         header: 'Status' },
  { key: 'event_time',     header: 'Detected At' },
];

export const ShipmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [risks, setRisks] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [populating, setPopulating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [shipResults, riskResult] = await Promise.allSettled([
      Promise.allSettled(DEMO_SHIPMENT_IDS.map(id => getShipment(id))),
      getRisks(),
    ]);
    if (shipResults.status === 'fulfilled') {
      setShipments(
        shipResults.value
          .filter((r): r is PromiseFulfilledResult<Shipment> => r.status === 'fulfilled')
          .map(r => r.value),
      );
    }
    if (riskResult.status === 'fulfilled') {
      setRisks(riskResult.value.risks);
    }
    setLoading(false);
  };

  const handlePopulate = async () => {
    setPopulating(true);
    try {
      await demoReset();
      await demoPopulate();
      await loadData();
    } finally {
      setPopulating(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const delayed    = shipments.filter(s => s.status === 'DELAYED').length;
  const intransit  = shipments.filter(s => s.status === 'IN_TRANSIT').length;
  const atRiskMats = MATERIALS.filter(m => m.status === 'AT RISK').length;
  const confirmedMats = MATERIALS.filter(m => m.status === 'CONFIRMED').length;
  const criticalRisks = risks.filter(r => r.severity === 'CRITICAL').length;
  const openRisks     = risks.filter(r => r.status === 'OPEN').length;

  // ── Table rows ──────────────────────────────────────────────────────────────
  const shipRows = shipments.map(s => {
    const origDate = new Date(s.original_eta).toLocaleDateString();
    const currDate = new Date(s.current_eta).toLocaleDateString();
    const diffDays = Math.round(
      (new Date(s.current_eta).getTime() - new Date(s.original_eta).getTime()) / 86_400_000,
    );
    return {
      id: s.shipment_id,
      shipment_id: <code>{s.shipment_id}</code>,
      material_id: <code>{s.material_id}</code>,
      status: (() => {
        const type =
          s.status === 'DELAYED'    ? 'red'       :
          s.status === 'CUSTOMS'    ? 'purple'    :
          s.status === 'IN_TRANSIT' ? 'blue'      :
          s.status === 'DELIVERED'  ? 'green'     :
          s.status === 'PLANNED'    ? 'cool-gray' : 'teal';
        return <Tag type={type} size="sm">{s.status}</Tag>;
      })(),
      supplier: s.logistics_provider ?? '—',
      original_eta: origDate,
      current_eta: <span style={{ color: diffDays > 0 ? 'var(--cds-support-error)' : 'inherit' }}>{currDate}</span>,
      delay: diffDays > 0
        ? <Tag type="red" size="sm">+{diffDays}d</Tag>
        : <Tag type="green" size="sm">On Time</Tag>,
      port: s.port_of_departure ? <code>{s.port_of_departure}</code> : '—',
    };
  });

  const matRows = MATERIALS.map(m => ({
    id: m.id,
    mat_id: <code>{m.id}</code>,
    name: m.name,
    qty: `${m.qty} ${m.unit}`,
    criticality: (
      <Tag type={m.criticality === 'CRITICAL' ? 'red' : m.criticality === 'HIGH' ? 'warm-gray' : 'cyan'} size="sm">
        {m.criticality}
      </Tag>
    ),
    workPackage: <code>{m.workPackage}</code>,
    requiredBy: m.requiredBy,
    status: (
      <Tag type={m.status === 'AT RISK' ? 'red' : 'green'} size="sm">
        {m.status}
      </Tag>
    ),
  }));

  // ── Risk table rows ─────────────────────────────────────────────────────────
  const riskRows = risks.map(r => ({
    id: r.risk_id,
    risk_id: <code>{r.risk_id}</code>,
    severity: <SeverityTag severity={r.severity} />,
    material_id: <code>{r.material_id}</code>,
    work_package_id: <code>{r.work_package_id}</code>,
    risk_type: r.risk_type,
    status: (
      <Tag type={r.status === 'MITIGATED' ? 'green' : 'blue'} size="sm">{r.status}</Tag>
    ),
    event_time: new Date(r.event_time).toLocaleString(),
  }));

  return (
    <div className="tsci-page-content">
      <div className="tsci-page-header">
        <div>
          <h1 className="bob-ask-title">Shipments &amp; Materials</h1>
          <p className="bob-ask-subtitle">
            Pearl GTL · TA-DEMO-2026 · Inbound logistics, material readiness &amp; active risks
          </p>
        </div>
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
      </div>

      {/* KPI Tiles */}
      <div className="tsci-kpi-grid">
        <Tile className="tsci-kpi-tile tsci-kpi-critical">
          <span className="tsci-kpi-label">Delayed Shipments</span>
          <span className="tsci-kpi-value">{delayed}</span>
        </Tile>
        <Tile className="tsci-kpi-tile">
          <span className="tsci-kpi-label">In Transit</span>
          <span className="tsci-kpi-value">{intransit}</span>
        </Tile>
        <Tile className="tsci-kpi-tile tsci-kpi-critical">
          <span className="tsci-kpi-label">Critical Risks</span>
          <span className="tsci-kpi-value">{criticalRisks}</span>
        </Tile>
        <Tile className="tsci-kpi-tile tsci-kpi-warning">
          <span className="tsci-kpi-label">Open Risks</span>
          <span className="tsci-kpi-value">{openRisks}</span>
        </Tile>
        <Tile className="tsci-kpi-tile tsci-kpi-critical">
          <span className="tsci-kpi-label">Materials At Risk</span>
          <span className="tsci-kpi-value">{atRiskMats}</span>
        </Tile>
        <Tile className="tsci-kpi-tile tsci-kpi-success">
          <span className="tsci-kpi-label">Materials Confirmed</span>
          <span className="tsci-kpi-value">{confirmedMats}</span>
        </Tile>
      </div>

      {loading && <InlineLoading description="Loading…" className="tsci-loading-state" />}

      {/* Active Risks table */}
      <DataTable rows={riskRows} headers={RISK_HEADERS}>
        {({ rows: tableRows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <TableContainer
            title="Active Risk Events"
            description="Live Confluent-driven risk detections linked to shipments and materials"
          >
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(h => (
                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={RISK_HEADERS.length} className="tsci-empty-cell">
                      No active risks. Run a demo simulation from the Readiness Dashboard to generate data.
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
                      {row.cells.map(cell => <TableCell key={cell.id}>{cell.value}</TableCell>)}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {/* Shipment tracker table */}
      <DataTable rows={shipRows} headers={SHIP_HEADERS}>
        {({ rows: tableRows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <TableContainer title="Active Shipments" description="Inbound shipments for Pearl GTL turnaround">
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(h => (
                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={SHIP_HEADERS.length} className="tsci-empty-cell">
                      No shipment data. Backend may be offline.
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map(row => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map(cell => <TableCell key={cell.id}>{cell.value}</TableCell>)}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {/* Material requirements table */}
      <DataTable rows={matRows} headers={MAT_HEADERS}>
        {({ rows: tableRows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <TableContainer
            title="Material Readiness Register"
            description="Critical and high-priority materials for TA-2026 work packages"
            style={{ marginTop: '1.5rem' }}
          >
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(h => (
                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map(row => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map(cell => <TableCell key={cell.id}>{cell.value}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};
