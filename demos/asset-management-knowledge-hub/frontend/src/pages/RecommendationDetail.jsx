import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, TabList, Tab, TabPanels, TabPanel, Tag, Button } from '@carbon/react';
import { Send, Checkmark, Close } from '@carbon/icons-react';
import { findAction } from '../demo/demoStore';
import ActionFooter from './ActionFooter';
import './ActionDetail.scss';

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

const EFFORT_TYPE = {
  'High':   'red',
  'Medium': 'blue',
  'Low':    'green',
};

function StatusTag({ value }) {
  if (!value) return null;
  return <Tag type={STATUS_TYPE[value] ?? 'gray'} size="sm">{value}</Tag>;
}

function PriorityTag({ value }) {
  if (!value) return null;
  return <Tag type={PRIORITY_TYPE[value] ?? 'gray'} size="sm">{value}</Tag>;
}

function EffortTag({ value }) {
  if (!value) return null;
  return <Tag type={EFFORT_TYPE[value] ?? 'gray'} size="sm">{value} effort</Tag>;
}

// ── ServiceNow ticket success toast ─────────────────────────────────────────
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

export default function RecommendationDetail({ actionId, onBack, onOpen }) {
  const action = findAction(String(actionId));
  const [creatingTicket, setCreatingTicket] = useState(null); // index of row being submitted
  const [ticketToast, setTicketToast] = useState(null); // { ticketNumber } | { error }

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
    metrics = {},
    recommendations = [],
    implementationPlan = [],
    impactAreas = [],
    relatedActions = [],
    assets: affectedAssets,
  } = action;

  const highPriorityCount  = recommendations.filter((r) => r.priority === 'High').length;
  const mediumPriorityCount = recommendations.filter((r) => r.priority === 'Medium').length;

  // SIMULATED — no backend/MCP call. Mimics the real flow with a short delay
  // and a fake ticket number so the UI/UX can be demoed without ServiceNow.
  async function handleCreateTicket(rec, idx) {
    setCreatingTicket(idx);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const fakeNumber = `INC00${Math.floor(10000 + Math.random() * 89999)}`;
    setTicketToast({ ticketNumber: fakeNumber });
    setCreatingTicket(null);
  }

  // ── Overview Tab ─────────────────────────────────────────────────────────────
  const OverviewTab = () => (
    <div>
      <div className="ad-kpis">
        <div className="ad-kpi">
          <span className="ad-kpi__value">{recommendations.length}</span>
          <span className="ad-kpi__label">Total Recommendations</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{highPriorityCount}</span>
          <span className="ad-kpi__label">High Priority</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{mediumPriorityCount}</span>
          <span className="ad-kpi__label">Medium Priority</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi__value">{affectedAssets ?? metrics.affectedAssets ?? '—'}</span>
          <span className="ad-kpi__label">Affected Assets</span>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-card__header">
          <h3 className="ad-card__title">Summary</h3>
        </div>
        <div className="ad-card__body" style={{ padding: 0 }}>
          <table className="ad-struct-list">
            <tbody>
              <tr><td>Created</td><td>{created}</td></tr>
              <tr><td>Source</td><td>{source}</td></tr>
              <tr><td>Status</td><td><StatusTag value={status} /></td></tr>
              <tr><td>Priority</td><td><PriorityTag value={priority} /></td></tr>
              <tr><td>Total Recommendations</td><td>{recommendations.length}</td></tr>
              <tr><td>Implementation Steps</td><td>{implementationPlan.length}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <ActionFooter relatedActionIds={relatedActions} onOpen={onOpen} />
    </div>
  );

  // ── Recommendations Tab ───────────────────────────────────────────────────────
  const RecommendationsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Recommended Actions ({recommendations.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Recommendation</th>
              <th style={{ textAlign: 'right' }}>Assets</th>
              <th>Priority</th>
              <th>Expected Benefit</th>
              <th>Effort</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((rec, idx) => (
              <tr key={idx}>
                <td>{rec.recommendation}</td>
                <td style={{ textAlign: 'right' }}>{rec.assets}</td>
                <td><PriorityTag value={rec.priority} /></td>
                <td>{rec.expectedBenefit}</td>
                <td><EffortTag value={rec.effort} /></td>
                <td><StatusTag value={rec.status} /></td>
                <td>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Send}
                    disabled={creatingTicket === idx}
                    onClick={() => handleCreateTicket(rec, idx)}
                  >
                    {creatingTicket === idx ? 'Creating…' : 'Create ServiceNow Ticket'}
                  </Button>
                </td>
              </tr>
            ))}
            {recommendations.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#525252' }}>No recommendations.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Impact Tab ────────────────────────────────────────────────────────────────
  const ImpactTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Impact Assessment</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-struct-list">
          <tbody>
            {impactAreas.map((row) => (
              <tr key={row.dimension}>
                <td>{row.dimension}</td>
                <td>{row.value}</td>
              </tr>
            ))}
            {impactAreas.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: 'center', color: '#525252' }}>No impact data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Implementation Plan Tab ───────────────────────────────────────────────────
  const ImplementationTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Implementation Plan ({implementationPlan.length} steps)</h3>
      </div>
      <div className="ad-card__body">
        <div className="ad-steps">
          {implementationPlan.map((item) => (
            <div key={item.step} className="ad-step">
              <div className="ad-step__num">{item.step}</div>
              <div className="ad-step__text">{item.action}</div>
            </div>
          ))}
          {implementationPlan.length === 0 && (
            <p style={{ color: '#525252', fontSize: '0.875rem' }}>No steps defined.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Evidence Tab ──────────────────────────────────────────────────────────────
  const EvidenceTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Supporting Evidence</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-struct-list">
          <tbody>
            <tr><td>Analysis Basis</td><td>OEM maintenance documentation and Maximo work order history</td></tr>
            <tr><td>Supporting Data</td><td>Failure patterns, inspection records, and job plan comparison</td></tr>
            <tr><td>Validation Method</td><td>Cross-reference of OEM specifications vs current job plans</td></tr>
            <tr><td>Confidence Score</td><td>High</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="ad-page">
      <nav className="ad-breadcrumb">
        <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        <span className="ad-breadcrumb__separator">/</span>
        <span className="ad-breadcrumb__current">Recommendation</span>
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

      <div className="ad-tabs-wrapper">
        <Tabs defaultSelectedIndex={0}>
          <TabList aria-label="Recommendation detail tabs" className="ad-tablist">
            <Tab>Overview</Tab>
            <Tab>Recommendations ({recommendations.length})</Tab>
            <Tab>Impact</Tab>
            <Tab>Implementation Plan</Tab>
            <Tab>Evidence</Tab>
          </TabList>
          <TabPanels>
            <TabPanel><div className="ad-content"><OverviewTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><RecommendationsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><ImpactTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><ImplementationTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><EvidenceTab /></div></TabPanel>
          </TabPanels>
        </Tabs>
      </div>

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
