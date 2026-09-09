import { useState } from 'react';
import {
  Tabs, TabList, Tab, TabPanels, TabPanel,
  Tag,
} from '@carbon/react';
import { findAction } from '../demo/demoStore';
import { getEvidence, applyEvidenceUpdate } from './actionCenterData';
import EvidencePanel from './EvidencePanel';
import ActionFooter from './ActionFooter';
import './ActionDetail.scss';

// ── Helpers ──────────────────────────────────────────────────────────────────
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

const SEV_TYPE = { Critical: 'red', High: 'red', Medium: 'blue', Low: 'green' };

function StatusTag({ value }) {
  if (!value) return null;
  return <Tag type={STATUS_TYPE[value] ?? 'gray'} size="sm">{value}</Tag>;
}

function PriorityTag({ value }) {
  if (!value) return null;
  return <Tag type={PRIORITY_TYPE[value] ?? 'gray'} size="sm">{value}</Tag>;
}

function SevTag({ value }) {
  if (!value) return null;
  return <Tag type={SEV_TYPE[value] ?? 'gray'} size="sm">{value}</Tag>;
}

// Compact bar row used in summary cards
function BarRow({ label, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="ad-bar-row">
      <span className="ad-bar-row__label">{label}</span>
      <div className="ad-bar-row__track">
        <div className="ad-bar-row__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="ad-bar-row__count">{count}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReportDetail({ actionId, onBack, onOpen }) {
  const action = findAction(String(actionId));
  const [evidencePanelAsset, setEvidencePanelAsset] = useState(null);
  const [evidencePanelData, setEvidencePanelData] = useState(null);

  function openEvidenceAsset(assetId) {
    setEvidencePanelAsset(assetId);
    setEvidencePanelData(getEvidence(assetId) ?? null);
  }

  function handleEvidenceUpdate(assetId, appliedFields) {
    applyEvidenceUpdate(assetId, appliedFields);
    setEvidencePanelData(getEvidence(assetId));
  }

  if (!action) {
    return (
      <div className="ad-page">
        <nav className="ad-breadcrumb">
          <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        </nav>
        <div className="ad-content">
          <p style={{ padding: '2rem' }}>Action not found.</p>
        </div>
      </div>
    );
  }

  const {
    title,
    description,
    status,
    priority,
    created,
    summary = {},
    topGapCategories = [],
    potentialImpact = {},
    highSeverityGaps = [],
    assetGaps = [],
    maintenanceGaps = [],
    recommendedActions = [],
    relatedActions: relatedIds = [],
  } = action;

  // Max count across topGapCategories for bar-row scaling
  const maxCatCount = Math.max(...topGapCategories.map((c) => c.count), 1);

  // ── Executive Summary Tab ──────────────────────────────────────────────────
  const ExecutiveSummaryTab = () => (
    <div>
      <div className="ad-two-col">
        {/* Left card – Report Summary */}
        <div className="ad-card">
          <div className="ad-card__header">
            <h3 className="ad-card__title">Report summary</h3>
          </div>
          <div className="ad-card__body">
            <table className="ad-struct-list">
              <tbody>
                <tr><td>Created</td><td>{created}</td></tr>
                <tr><td>Status</td><td><StatusTag value={status} /></td></tr>
                <tr><td>Priority</td><td><PriorityTag value={priority} /></td></tr>
                <tr><td>Assets evaluated</td><td>{summary.assetsEvaluated ?? 0}</td></tr>
                <tr><td>Assets with gaps</td><td>{summary.assetsWithGaps ?? 0}</td></tr>
                <tr><td>High-severity gaps</td><td>{summary.highSeverityGaps ?? 0}</td></tr>
                <tr><td>Medium-severity gaps</td><td>{summary.mediumSeverityGaps ?? 0}</td></tr>
                <tr><td>Estimated downtime reduction</td><td>{potentialImpact.estimatedDowntimeReduction ?? '—'}</td></tr>
                <tr><td>Estimated cost avoidance</td><td>{potentialImpact.estimatedCostAvoidance ?? '—'}</td></tr>
                <tr><td>Reliability improvement</td><td>{potentialImpact.reliabilityImprovement ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right card – Top Gap Categories */}
        <div className="ad-card">
          <div className="ad-card__header">
            <h3 className="ad-card__title">Top gap categories</h3>
          </div>
          <div className="ad-card__body">
            {topGapCategories.length === 0 ? (
              <p style={{ color: '#525252', fontSize: '0.875rem' }}>No gap categories available.</p>
            ) : (
              topGapCategories.map((cat) => (
                <BarRow
                  key={cat.category}
                  label={cat.category}
                  count={cat.count}
                  max={maxCatCount}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* High-severity gaps table */}
      {highSeverityGaps.length > 0 && (
        <div className="ad-card">
          <div className="ad-card__header">
            <h3 className="ad-card__title">High severity gaps</h3>
            <Tag type="red" size="sm">{highSeverityGaps.length} gaps</Tag>
          </div>
          <div className="ad-card__body" style={{ padding: 0 }}>
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Current practice</th>
                  <th>OEM recommendation</th>
                  <th>Potential impact</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {highSeverityGaps.map((g, i) => (
                  <tr key={i}>
                    <td>
                      <button
                        className="ad-asset-link"
                        onClick={() => openEvidenceAsset(g.asset)}
                      >
                        {g.asset}
                      </button>
                    </td>
                    <td>{g.category}</td>
                    <td>{g.currentPractice}</td>
                    <td>{g.oemRecommendation}</td>
                    <td>{g.potentialImpact}</td>
                    <td><SevTag value={g.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ActionFooter relatedActionIds={relatedIds} onOpen={onOpen} />
    </div>
  );

  // ── Asset Gaps Tab ─────────────────────────────────────────────────────────
  const AssetGapsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Asset configuration gaps ({assetGaps.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Description</th>
              <th>Gap category</th>
              <th>Gap detail</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assetGaps.map((g, i) => (
              <tr key={i}>
                <td>
                  <button
                    className="ad-asset-link"
                    onClick={() => openEvidenceAsset(g.asset)}
                  >
                    {g.asset}
                  </button>
                </td>
                <td>{g.description}</td>
                <td>{g.gapCategory}</td>
                <td>{g.gap}</td>
                <td><SevTag value={g.severity} /></td>
                <td><StatusTag value={g.status} /></td>
              </tr>
            ))}
            {assetGaps.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Maintenance Gaps Tab ───────────────────────────────────────────────────
  const MaintenanceGapsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Maintenance schedule gaps by category ({maintenanceGaps.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Gap count</th>
              <th>Severity</th>
              <th>Affected assets</th>
            </tr>
          </thead>
          <tbody>
            {maintenanceGaps.map((g, i) => (
              <tr key={i}>
                <td>{g.category}</td>
                <td>{g.count}</td>
                <td><SevTag value={g.severity} /></td>
                <td>{Array.isArray(g.assets) ? g.assets.join(', ') : g.assets}</td>
              </tr>
            ))}
            {maintenanceGaps.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Recommended Actions Tab ────────────────────────────────────────────────
  const RecommendedActionsTab = () => (
    <div className="ad-card">
      <div className="ad-card__header">
        <h3 className="ad-card__title">Recommended actions ({recommendedActions.length})</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Asset</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {recommendedActions.map((r, i) => (
              <tr key={i}>
                <td>{r.action}</td>
                <td>{r.asset}</td>
                <td><SevTag value={r.priority} /></td>
              </tr>
            ))}
            {recommendedActions.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: '#525252' }}>No data</td></tr>
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
        <h3 className="ad-card__title">Report evidence</h3>
      </div>
      <div className="ad-card__body">
        <table className="ad-struct-list">
          <tbody>
            <tr><td>Report date</td><td>{created}</td></tr>
            <tr><td>Source</td><td>{action.source}</td></tr>
            <tr><td>Assets evaluated</td><td>{summary.assetsEvaluated ?? 0}</td></tr>
            <tr><td>High-severity gaps</td><td>{summary.highSeverityGaps ?? 0}</td></tr>
            <tr><td>Estimated downtime reduction</td><td>{potentialImpact.estimatedDowntimeReduction ?? '—'}</td></tr>
            <tr><td>Estimated cost avoidance</td><td>{potentialImpact.estimatedCostAvoidance ?? '—'}</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#525252' }}>
          Click any asset link in the other tabs to view detailed evidence from Maximo job plans and OEM documentation.
        </p>
      </div>
    </div>
  );

  return (
    <div className="ad-page">
      <nav className="ad-breadcrumb">
        <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        <span className="ad-breadcrumb__separator">/</span>
        <span className="ad-breadcrumb__current">Report</span>
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
          <span>Source {action.source ?? 'Chat'}</span>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="ad-kpis" style={{ margin: '0 1.5rem 0' }}>
        <div className="ad-kpi">
          <div className="ad-kpi__value">{summary.assetsEvaluated ?? 0}</div>
          <div className="ad-kpi__label">Assets evaluated</div>
        </div>
        <div className="ad-kpi">
          <div className="ad-kpi__value ad-kpi__value--warn">
            {summary.assetsWithGaps ?? assetGaps.length}
          </div>
          <div className="ad-kpi__label">Assets with gaps</div>
        </div>
        <div className="ad-kpi">
          <div className="ad-kpi__value ad-kpi__value--warn">
            {summary.totalGaps ?? 0}
          </div>
          <div className="ad-kpi__label">Total gaps found</div>
        </div>
        <div className="ad-kpi">
          <div className="ad-kpi__value ad-kpi__value--good">
            {summary.alignedAssets ?? 0}
          </div>
          <div className="ad-kpi__label">Aligned assets</div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="ad-tabs-wrapper">
        <Tabs defaultSelectedIndex={0}>
          <TabList aria-label="Report sections" className="ad-tablist">
            <Tab>Executive summary</Tab>
            <Tab>Asset gaps ({assetGaps.length})</Tab>
            <Tab>Maintenance gaps ({maintenanceGaps.length})</Tab>
            <Tab>Recommended actions ({recommendedActions.length})</Tab>
            <Tab>Evidence</Tab>
          </TabList>
          <TabPanels>
            <TabPanel><div className="ad-content"><ExecutiveSummaryTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><AssetGapsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><MaintenanceGapsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><RecommendedActionsTab /></div></TabPanel>
            <TabPanel><div className="ad-content"><EvidenceTab /></div></TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      {/* ── Evidence side panel ──────────────────────────────────────────────── */}
      <EvidencePanel
        data={evidencePanelData}
        onClose={() => { setEvidencePanelAsset(null); setEvidencePanelData(null); }}
        onUpdate={(fields) => handleEvidenceUpdate(evidencePanelAsset, fields)}
      />
    </div>
  );
}
