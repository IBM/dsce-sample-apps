import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Tabs, TabList, Tab, TabPanels, TabPanel, Tag, Button,
} from '@carbon/react';
import { Send, Checkmark, Close } from '@carbon/icons-react';
import { findAction } from '../demo/demoStore';
import { getEvidence, applyEvidenceUpdate, WORK_ORDER_DATA } from './actionCenterData';
import EvidencePanel from './EvidencePanel';
import WorkOrderPanel from './WorkOrderPanel';
import ActionFooter from './ActionFooter';
import './ActionDetail.scss';

// Carbon Tag type maps — statuses only (priority uses PRIORITY_TYPE)
const STATUS_TYPE = {
  'Completed':       'green',
  'In Review':       'blue',
  'In Progress':     'blue',
  'Open':            'cyan',
  'Proposed':        'purple',
  'Accepted':        'green',
  'Rejected':        'red',
  'Draft':           'gray',
  'Running':         'teal',
  'Review Required': 'warm-gray',
  'Gap Identified':  'warm-gray',
  'Closed':          'gray',
  'Scheduled':       'cool-gray',
};

const PRIORITY_TYPE = {
  'Critical': 'red',
  'High':     'magenta',
  'Medium':   'blue',
  'Low':      'green',
};

function StatusTag({ value }) {
  if (!value) return null;
  return <Tag type={STATUS_TYPE[value] ?? 'gray'} size="sm">{value}</Tag>;
}

function PriorityTag({ value }) {
  if (!value) return null;
  return <Tag type={PRIORITY_TYPE[value] ?? 'gray'} size="sm">{value}</Tag>;
}

// ── ServiceNow ticket success/error toast ───────────────────────────────────
function TicketToast({ ticketNumber, error, onDismiss }) {
  return createPortal(
    <div className={`sn-toast${error ? ' sn-toast--error' : ' sn-toast--success'}`} role="status" aria-live="polite">
      {error ? <Close size={20} className="sn-toast__icon" /> : <Checkmark size={20} className="sn-toast__icon" />}
      <div className="sn-toast__text">
        {error
          ? <>Failed to create ServiceNow ticket — {error}</>
          : <>ServiceNow ticket <strong>{ticketNumber}</strong> created successfully.</>}
      </div>
      <button className="sn-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <Close size={16} />
      </button>
    </div>,
    document.body
  );
}

export default function InvestigationDetail({ actionId, onBack, onOpen }) {
  const action = findAction(String(actionId));
  const [evidencePanelData, setEvidencePanelData] = useState(null);
  const [woPanelData, setWoPanelData] = useState(null);
  const [creatingTicket, setCreatingTicket] = useState(null);
  const [ticketToast, setTicketToast] = useState(null);

  if (!action) {
    return (
      <div className="ad-page">
        <nav className="ad-breadcrumb">
          <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        </nav>
        <div className="ad-content"><p>Action not found.</p></div>
      </div>
    );
  }

  const {
    title, description, status, priority, created, source,
    metrics = {}, priorityAssets = [], allAssets = [],
    failurePatterns = [], workOrders = [], recommendations = [],
    relatedActions = [],
  } = action;

  function openEvidence(assetId) {
    const data = getEvidence(assetId);
    if (data) setEvidencePanelData(data);
  }

  function handleEvidenceUpdate(assetId, appliedFields) {
    applyEvidenceUpdate(assetId, appliedFields);
    setEvidencePanelData(getEvidence(assetId));
  }

  // SIMULATED — no backend/MCP call. Mimics the real flow with a short delay
  // and a fake ticket number so the UI/UX can be demoed without ServiceNow.
  async function handleCreateTicket(rec, idx) {
    setCreatingTicket(idx);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const fakeNumber = `INC00${Math.floor(10000 + Math.random() * 89999)}`;
    setTicketToast({ ticketNumber: fakeNumber });
    setCreatingTicket(null);
  }

  // ── Overview Tab ───────────────────────────────────────────────────────────
  const OverviewTab = () => (
    <div>
      <div className="ad-kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.totalAssets ?? '—'}</span>
          <span className="ad-kpi__label">Total Assets</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.totalFailures ?? '—'}</span>
          <span className="ad-kpi__label">Total Failures</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.totalDowntime ?? '—'}</span>
          <span className="ad-kpi__label">Total Downtime</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.highPriorityAssets ?? '—'}</span>
          <span className="ad-kpi__label">High-Priority Assets</span>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-card__header">
          <h3 className="ad-card__title">Top Priority Assets</h3>
        </div>
        <div className="ad-card__body" style={{ padding: 0 }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Description</th>
                <th>Criticality</th>
                <th style={{ textAlign: 'right' }}>Failures</th>
                <th style={{ textAlign: 'right' }}>Downtime</th>
                <th>Priority</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {priorityAssets.map((row) => (
                <tr key={row.asset}>
                  <td>
                    <button className="ad-asset-link" onClick={() => openEvidence(row.asset)}>
                      {row.asset}
                    </button>
                  </td>
                  <td>{row.description}</td>
                  <td>{row.criticality}</td>
                  <td style={{ textAlign: 'right' }}>{row.failures}</td>
                  <td style={{ textAlign: 'right' }}>{row.downtime}</td>
                  <td><PriorityTag value={row.priority} /></td>
                  <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.reason ?? '—'}</td>
                </tr>
              ))}
              {priorityAssets.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ActionFooter relatedActionIds={relatedActions} onOpen={onOpen} />
    </div>
  );

  // ── Assets Tab ─────────────────────────────────────────────────────────────
  // Total assets count: use metric value if allAssets sample is fewer than the total
  const totalAssetCount = metrics.totalAssets ?? allAssets.length;
  const AssetsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">All Assets ({totalAssetCount})</h3>
        {allAssets.length < totalAssetCount && (
          <span style={{ fontSize: '0.8125rem', color: '#525252', marginLeft: '0.75rem', alignSelf: 'center' }}>
            Showing {allAssets.length} of {totalAssetCount}
          </span>
        )}
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Description</th>
              <th>Location</th>
              <th>Criticality</th>
              <th style={{ textAlign: 'right' }}>Failures</th>
              <th style={{ textAlign: 'right' }}>Downtime</th>
              <th>Last Failure</th>
              <th>Current PM</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {allAssets.map((row) => (
              <tr key={row.asset}>
                <td>
                  <button className="ad-asset-link" onClick={() => openEvidence(row.asset)}>
                    {row.asset}
                  </button>
                </td>
                <td>{row.description}</td>
                <td>{row.location}</td>
                <td>{row.criticality}</td>
                <td style={{ textAlign: 'right' }}>{row.failures}</td>
                <td style={{ textAlign: 'right' }}>{row.downtime}</td>
                <td>{row.lastFailure}</td>
                <td>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                    {row.currentPM}
                  </span>
                </td>
                <td><PriorityTag value={row.priority} /></td>
              </tr>
            ))}
            {allAssets.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Failure Patterns Tab ───────────────────────────────────────────────────
  const FailurePatternsTab = () => {
    const maxOcc = Math.max(...failurePatterns.map((f) => f.occurrences), 1);
    return (
      <div className="ad-card">
        <div className="ad-card__header">
          <h3 className="ad-card__title">Failure Patterns ({failurePatterns.length})</h3>
        </div>
        <div className="ad-card__body" style={{ padding: 0 }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Occurrences</th>
                <th style={{ textAlign: 'right' }}>Affected Assets</th>
                <th>Severity</th>
                <th>Last Occurrence</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {failurePatterns.map((row) => (
                <tr key={row.mode}>
                  <td>{row.mode}</td>
                  <td style={{ minWidth: '160px' }}>
                    <div className="ad-bar-row">
                      <div className="ad-bar-row__track">
                        <div
                          className="ad-bar-row__fill"
                          style={{ width: `${(row.occurrences / maxOcc) * 100}%` }}
                        />
                      </div>
                      <span className="ad-bar-row__count">{row.occurrences}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{row.affectedAssets}</td>
                  <td><StatusTag value={row.severity} /></td>
                  <td>{row.lastOccurrence}</td>
                  <td>
                    <span
                      style={{
                        color: row.trend === 'Increasing' ? '#da1e28'
                          : row.trend === 'Decreasing' ? '#198038' : '#525252',
                        fontWeight: 500,
                      }}
                    >
                      {row.trend === 'Increasing' ? '↑ '
                        : row.trend === 'Decreasing' ? '↓ ' : '→ '}
                      {row.trend}
                    </span>
                  </td>
                </tr>
              ))}
              {failurePatterns.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Work Orders Tab ────────────────────────────────────────────────────────
  const WorkOrdersTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Work Orders ({workOrders.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>WO #</th>
              <th>Asset</th>
              <th>Description</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reported</th>
              <th>Completed</th>
              <th style={{ textAlign: 'right' }}>Downtime</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((row) => (
              <tr key={row.wo}>
                <td>
                  <button
                    className="ad-asset-link"
                    onClick={() => {
                      const d = WORK_ORDER_DATA[row.wo];
                      if (d) setWoPanelData(d);
                    }}
                  >
                    {row.wo}
                  </button>
                </td>
                <td>{row.asset}</td>
                <td>{row.description}</td>
                <td>{row.type}</td>
                <td><StatusTag value={row.status} /></td>
                <td>{row.reported}</td>
                <td>{row.completed}</td>
                <td style={{ textAlign: 'right' }}>{row.downtime}</td>
              </tr>
            ))}
            {workOrders.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Impact Analysis Tab ────────────────────────────────────────────────────
  const ImpactTab = () => {
    const totalDowntimeHrs = allAssets.reduce((sum, a) => {
      const n = parseInt((a.downtime || '0').replace(/\D/g, ''), 10);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
    const summaryRows = [
      { label: 'Total Affected Assets',      value: metrics.totalAssets ?? allAssets.length },
      { label: 'High Priority Assets',       value: metrics.highPriorityAssets ?? '—' },
      { label: 'Total Failures (12 months)', value: metrics.totalFailures ?? '—' },
      { label: 'Total Downtime (12 months)', value: metrics.totalDowntime ?? `${totalDowntimeHrs} hrs` },
      { label: 'Failure Modes Identified',   value: failurePatterns.length },
      { label: 'Work Orders Reviewed',       value: workOrders.length },
    ];
    const maxOcc = Math.max(...failurePatterns.map((f) => f.occurrences), 1);
    return (
      <div className="ad-two-col">
        <div className="ad-card">
          <div className="ad-card__header">
            <h3 className="ad-card__title">Reliability Impact Summary</h3>
          </div>
          <div className="ad-card__body" style={{ padding: 0 }}>
            <table className="ad-struct-list">
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="ad-card">
          <div className="ad-card__header">
            <h3 className="ad-card__title">Top Failure Modes</h3>
          </div>
          <div className="ad-card__body">
            {failurePatterns.slice(0, 5).map((fp) => (
              <div key={fp.mode} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.875rem' }}>
                  <span style={{ color: '#161616' }}>{fp.mode}</span>
                  <span style={{ color: '#525252' }}>{fp.occurrences} occurrences</span>
                </div>
                <div style={{ background: '#e0e0e0', height: '6px' }}>
                  <div style={{ width: `${(fp.occurrences / maxOcc) * 100}%`, height: '100%', background: '#0f62fe' }} />
                </div>
              </div>
            ))}
            {failurePatterns.length === 0 && (
              <p style={{ color: '#525252', fontSize: '0.875rem' }}>No failure pattern data.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Recommendations Tab ────────────────────────────────────────────────────
  const RecommendationsTab = () => (
    <div>
      {recommendations.map((rec, i) => (
        <div key={i} className="ad-card">
          <div className="ad-card__header">
            <h4 className="ad-card__title">{rec.recommendation}</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '1rem', alignItems: 'center' }}>
              <PriorityTag value={rec.priority} />
              <StatusTag value={rec.status} />
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Send}
                disabled={creatingTicket === i}
                onClick={() => handleCreateTicket(rec, i)}
              >
                {creatingTicket === i ? 'Creating…' : 'Create ServiceNow Ticket'}
              </Button>
            </div>
          </div>
          <div className="ad-card__body" style={{ padding: 0 }}>
            <table className="ad-struct-list">
              <tbody>
                <tr><td>Assets Affected</td><td>{rec.assets}</td></tr>
                <tr><td>Expected Benefit</td><td>{rec.expectedBenefit}</td></tr>
                <tr>
                  <td>Evidence</td>
                  <td><span style={{ color: '#0f62fe', fontWeight: 500 }}>{rec.evidence}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {recommendations.length === 0 && (
        <div className="ad-card">
          <div className="ad-card__body" style={{ color: '#525252', textAlign: 'center' }}>
            No recommendations yet.
          </div>
        </div>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="ad-page">
      <nav className="ad-breadcrumb">
        <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        <span className="ad-breadcrumb__separator">/</span>
        <span className="ad-breadcrumb__current">Investigation</span>
      </nav>

      <div className="ad-header">
        <div className="ad-header-row">
          <h1 className="ad-title">
            {action.actionNumber && (
              <span className="ad-action-number">{action.actionNumber}</span>
            )}
            {title}
          </h1>
          <div className="ad-header-right">
            <StatusTag value={status} />
            <PriorityTag value={priority} />
          </div>
        </div>
        <p className="ad-description">{description}</p>
        <div className="ad-meta">
          <span>Created {created}</span>
          <span className="ad-meta__separator">•</span>
          <span>Source {source}</span>
        </div>
      </div>

      <div className="ad-tabs-wrapper">
        <Tabs defaultSelectedIndex={0}>
          <TabList aria-label="Investigation detail tabs" className="ad-tablist">
            <Tab>Overview</Tab>
            <Tab>Assets ({totalAssetCount})</Tab>
            <Tab>Failure Patterns</Tab>
            <Tab>Work Orders</Tab>
            <Tab>Impact Analysis</Tab>
            <Tab>Recommendations</Tab>
          </TabList>
          <TabPanels>
            <TabPanel><div className="ad-content"><OverviewTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><AssetsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><FailurePatternsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><WorkOrdersTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><ImpactTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><RecommendationsTab /></div></TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      <EvidencePanel
        data={evidencePanelData}
        onClose={() => setEvidencePanelData(null)}
        onUpdate={(fields) => handleEvidenceUpdate(evidencePanelData?.currentMaximo?.assetNum ?? evidencePanelData?.asset?.split('—')[0]?.trim(), fields)}
      />
      <WorkOrderPanel data={woPanelData} onClose={() => setWoPanelData(null)} />

      {ticketToast && (
        <TicketToast
          ticketNumber={ticketToast.ticketNumber}
          error={ticketToast.error}
          onDismiss={() => setTicketToast(null)}
        />
      )}
    </div>
  );
}
