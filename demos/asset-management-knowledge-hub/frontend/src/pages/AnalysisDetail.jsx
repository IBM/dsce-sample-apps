import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, TabList, Tab, TabPanels, TabPanel, Tag, Button } from '@carbon/react';
import { Send, Checkmark, Close } from '@carbon/icons-react';
import { findAction } from '../demo/demoStore';
import { getEvidence, applyEvidenceUpdate } from './actionCenterData';
import EvidencePanel from './EvidencePanel';
import ActionFooter from './ActionFooter';
import './ActionDetail.scss';

// ── Tag helpers — statuses only (priority uses PRIORITY_TYPE) ──────────────
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

// ── Component ──────────────────────────────────────────────────────────────
export default function AnalysisDetail({ actionId, onBack, onOpen }) {
  const action = findAction(String(actionId));
  const [evidencePanelData, setEvidencePanelData] = useState(null);
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
    title,
    description,
    status,
    priority,
    created,
    source,
    metrics = {},
    assetsWithGaps = [],
    currentJobPlans = [],
    oemRecommendations = [],
    gaps = [],
    gapSummaryByCategory = [],
    gapSeverity = [],
    evidence = [],
    recommendations = [],
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
      {/* 4 KPI tiles — derived from metrics field */}
      <div className="ad-kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.assetsEvaluated ?? '—'}</span>
          <span className="ad-kpi__label">Assets Evaluated</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.requireReview ?? '—'}</span>
          <span className="ad-kpi__label">Require Review</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.gapsIdentified ?? gaps.length}</span>
          <span className="ad-kpi__label">Gaps Identified</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{metrics.aligned ?? '—'}</span>
          <span className="ad-kpi__label">Aligned</span>
        </div>
      </div>

      {/* Gap Summary by Category */}
      {gapSummaryByCategory.length > 0 && (
        <div className="ad-card">
          <div className="ad-card__header">
            <h3 className="ad-card__title">Gap Summary by Category</h3>
          </div>
          <div className="ad-card__body" style={{ padding: 0 }}>
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Occurrences</th>
                  <th style={{ textAlign: 'right' }}>% of Gaps</th>
                </tr>
              </thead>
              <tbody>
                {gapSummaryByCategory.map((row) => {
                  const maxCount = Math.max(...gapSummaryByCategory.map((r) => r.count), 1);
                  return (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td style={{ minWidth: '180px' }}>
                        <div className="ad-bar-row">
                          <div className="ad-bar-row__track">
                            <div
                              className="ad-bar-row__fill"
                              style={{ width: `${(row.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="ad-bar-row__count">{row.count}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', color: '#525252' }}>{row.pct}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gap Severity */}
      {gapSeverity.length > 0 && (
        <div className="ad-card">
          <div className="ad-card__header">
            <h3 className="ad-card__title">Gap Severity Breakdown</h3>
          </div>
          <div className="ad-card__body" style={{ padding: 0 }}>
            <table className="ad-struct-list">
              <tbody>
                {gapSeverity.map((row) => (
                  <tr key={row.severity}>
                    <td>{row.severity}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ActionFooter relatedActionIds={relatedActions} onOpen={onOpen} />
    </div>
  );

  // ── Assets Tab ─────────────────────────────────────────────────────────────
  const AssetsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Assets with Identified Gaps ({assetsWithGaps.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Description</th>
              <th>Criticality</th>
              <th style={{ textAlign: 'right' }}>Gap Count</th>
              <th>Highest Gap Type</th>
              <th>Status</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {assetsWithGaps.map((row) => (
              <tr key={row.asset}>
                <td>
                  <button className="ad-asset-link" onClick={() => openEvidence(row.asset)}>
                    {row.asset}
                  </button>
                </td>
                <td>{row.description}</td>
                <td>{row.criticality}</td>
                <td style={{ textAlign: 'right' }}>{row.gapCount}</td>
                <td>{row.highestGap}</td>
                <td><StatusTag value={row.status} /></td>
                <td><PriorityTag value={row.priority} /></td>
              </tr>
            ))}
            {assetsWithGaps.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Current Job Plans Tab ──────────────────────────────────────────────────
  const CurrentJobPlansTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Current Job Plans ({currentJobPlans.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Job Plan</th>
              <th>Task</th>
              <th>Frequency</th>
              <th>Procedure</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {currentJobPlans.map((row, idx) => (
              <tr key={idx}>
                <td>{row.asset}</td>
                <td>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: '#0f62fe' }}>
                    {row.jobPlan}
                  </span>
                </td>
                <td>{row.task}</td>
                <td>{row.frequency}</td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.procedure}</td>
                <td>{row.lastUpdated}</td>
              </tr>
            ))}
            {currentJobPlans.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── OEM Recommendations Tab ────────────────────────────────────────────────
  const OemRecommendationsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">OEM Recommendations ({oemRecommendations.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Document</th>
              <th>Section</th>
              <th>Recommendation</th>
              <th>Frequency</th>
              <th>Document Date</th>
            </tr>
          </thead>
          <tbody>
            {oemRecommendations.map((row, idx) => (
              <tr key={idx}>
                <td>{row.asset}</td>
                <td style={{ fontSize: '0.8125rem', color: '#525252' }}>{row.document}</td>
                <td style={{ fontSize: '0.8125rem' }}>{row.section}</td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.recommendation}</td>
                <td>{row.frequency}</td>
                <td>{row.docDate}</td>
              </tr>
            ))}
            {oemRecommendations.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Gaps Tab ───────────────────────────────────────────────────────────────
  const GapsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Identified Maintenance Gaps ({gaps.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Current Practice</th>
              <th>OEM Recommendation</th>
              <th>Identified Gap</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <button className="ad-asset-link" onClick={() => openEvidence(row.asset)}>
                    {row.asset}
                  </button>
                </td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.currentPractice}</td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.oemRecommendation}</td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.identifiedGap}</td>
                <td><StatusTag value={row.status} /></td>
                <td><PriorityTag value={row.priority} /></td>
                <td style={{ color: '#0f62fe', fontSize: '0.8125rem', fontWeight: 500 }}>{row.evidence}</td>
              </tr>
            ))}
            {gaps.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#525252' }}>No gaps identified</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Evidence Tab ───────────────────────────────────────────────────────────
  const EvidenceTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Analysis Evidence ({evidence.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Current Maximo Practice</th>
              <th>OEM Reference</th>
              <th>AI Analysis</th>
              <th>Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <button className="ad-asset-link" onClick={() => openEvidence(row.asset)}>
                    {row.asset}
                  </button>
                </td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.maximo}</td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.oem}</td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.analysis}</td>
                <td style={{ color: '#525252', fontSize: '0.8125rem' }}>{row.recommendation}</td>
              </tr>
            ))}
            {evidence.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#525252' }}>No evidence data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

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
                {rec.evidence && (
                  <tr>
                    <td>Evidence</td>
                    <td><span style={{ color: '#0f62fe', fontWeight: 500 }}>{rec.evidence}</span></td>
                  </tr>
                )}
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
        <span className="ad-breadcrumb__current">Analysis</span>
      </nav>

      <div className="ad-header">
        <div className="ad-header-row">
          <h1 className="ad-title">
            {action.actionNumber && <span className="ad-action-number">{action.actionNumber}</span>}
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

      {/* Tabs */}
      <div className="ad-tabs-wrapper">
        <Tabs defaultSelectedIndex={0}>
          <TabList aria-label="Analysis detail tabs" className="ad-tablist">
            <Tab>Overview</Tab>
            <Tab>Assets ({assetsWithGaps.length})</Tab>
            <Tab>Current Job Plans</Tab>
            <Tab>OEM Recommendations</Tab>
            <Tab>Gaps</Tab>
            <Tab>Evidence</Tab>
            <Tab>Recommendations</Tab>
          </TabList>
          <TabPanels>
            <TabPanel><div className="ad-content"><OverviewTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><AssetsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><CurrentJobPlansTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><OemRecommendationsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><GapsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><EvidenceTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><RecommendationsTab /></div></TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      <EvidencePanel
        data={evidencePanelData}
        onClose={() => setEvidencePanelData(null)}
        onUpdate={(fields) => handleEvidenceUpdate(evidencePanelData?.currentMaximo?.assetNum ?? evidencePanelData?.asset?.split('—')[0]?.trim(), fields)}
      />

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
