import {
  Tabs, TabList, Tab, TabPanels, TabPanel,
  Tag,
} from '@carbon/react';
import { findAction } from '../demo/demoStore';
import ActionFooter from './ActionFooter';
import './ActionDetail.scss';

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Task Overview table ────────────────────────────────────────────────────

function TaskTable({ rows, emptyText }) {
  if (!rows.length) {
    return (
      <p style={{ padding: '1rem 0', color: '#525252', fontSize: '0.875rem' }}>
        {emptyText}
      </p>
    );
  }
  return (
    <table className="ad-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Asset</th>
          <th>Priority</th>
          <th>Owner</th>
          <th>Status</th>
          <th>Created</th>
          <th>Due Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t, i) => (
          <tr key={i}>
            <td style={{ color: '#0f62fe', fontWeight: 500, cursor: 'default' }}>{t.task}</td>
            <td>{t.asset}</td>
            <td><PriorityTag value={t.priority} /></td>
            <td>{t.owner ?? '—'}</td>
            <td><StatusTag value={t.status} /></td>
            <td>{t.created}</td>
            <td>{t.dueDate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Priority distribution — structured stats ───────────────────────────────

function PriorityStats({ tasks }) {
  const total = tasks.length;
  const counts = { High: 0, Medium: 0, Low: 0 };
  tasks.forEach((t) => {
    if (counts[t.priority] !== undefined) counts[t.priority]++;
  });

  return (
    <div>
      {Object.entries(counts).map(([label, count]) => (
        <div key={label} className="ad-bar-row">
          <span className="ad-bar-row__label">{label}</span>
          <div className="ad-bar-row__track">
            <div
              className="ad-bar-row__fill"
              style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
            />
          </div>
          <span className="ad-bar-row__count">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Recent Activity (structured list) ─────────────────────────────────────

function ActivitySection({ items }) {
  if (!items.length) return null;
  return (
    <div className="ad-card" style={{ marginTop: '1rem' }}>
      <div className="ad-card__header">
        <h3 className="ad-card__title">Recent Activity</h3>
      </div>
      <div className="ad-card__body" style={{ padding: 0 }}>
        <div className="ad-activity">
          {items.map((item, i) => (
            <div key={i} className="ad-activity-item">
              <span className="ad-activity-item__text">{item.text}</span>
              <span className="ad-activity-item__time">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── Main component ─────────────────────────────────────────────────────────

export default function TaskDetail({ actionId, onBack, onOpen }) {
  const action = findAction(String(actionId));

  // ── Not found state ──────────────────────────────────────────────────────
  if (!action) {
    return (
      <div className="ad-page">
        <nav className="ad-breadcrumb">
          <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        </nav>
        <div className="ad-content">
          <p>Action not found.</p>
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
    source,
    tasks = [],
    activity = [],
    relatedActions = [],
  } = action;

  // Derive counts from actual task data
  const openTasks       = tasks.filter((t) => t.status === 'Open');
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress');
  const completedTasks  = tasks.filter((t) => t.status === 'Completed');
  const highPriority    = tasks.filter((t) => t.priority === 'High' || t.priority === 'Critical');

  return (
    <div className="ad-page">
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav className="ad-breadcrumb">
        <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        <span className="ad-breadcrumb__separator">/</span>
        <span className="ad-breadcrumb__current">Task</span>
      </nav>

      {/* ── Page header ─────────────────────────────────────────────────── */}
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
          {source && <><span className="ad-meta__separator">•</span><span>Source {source}</span></>}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="ad-tabs-wrapper">
        <Tabs defaultSelectedIndex={0}>
          <TabList aria-label="Task detail tabs" className="ad-tablist">
            <Tab>Overview</Tab>
            <Tab>Open Tasks ({openTasks.length})</Tab>
            <Tab>In Progress ({inProgressTasks.length})</Tab>
            <Tab>Completed ({completedTasks.length})</Tab>
            <Tab>Evidence</Tab>
          </TabList>

          <TabPanels>
            {/* ── Overview ─────────────────────────────────────────────── */}
            <TabPanel>
              <div className="ad-content">
                {/* KPI tiles — 4 up */}
                <div className="ad-kpis">
                  <div className="ad-kpi">
                    <span className="ad-kpi__value">{openTasks.length}</span>
                    <span className="ad-kpi__label">Open Tasks</span>
                  </div>
                  <div className="ad-kpi">
                    <span className="ad-kpi__value">{inProgressTasks.length}</span>
                    <span className="ad-kpi__label">In Progress</span>
                  </div>
                  <div className="ad-kpi">
                    <span className="ad-kpi__value">{completedTasks.length}</span>
                    <span className="ad-kpi__label">Completed</span>
                  </div>
                  <div className="ad-kpi">
                    <span className="ad-kpi__value">{highPriority.length}</span>
                    <span className="ad-kpi__label">High Priority</span>
                  </div>
                </div>

                {/* Open tasks table directly below KPI tiles */}
                <div className="ad-card">
                  <div className="ad-card__header">
                    <h3 className="ad-card__title">Open Tasks ({openTasks.length})</h3>
                  </div>
                  <div className="ad-card__body" style={{ padding: 0 }}>
                    <TaskTable rows={openTasks} emptyText="No open tasks." />
                  </div>
                </div>

                {/* Task summary by priority */}
                <div className="ad-two-col" style={{ marginBottom: 0 }}>
                  <div className="ad-card">
                    <div className="ad-card__header">
                      <h3 className="ad-card__title">Task Summary by Priority</h3>
                    </div>
                    <div className="ad-card__body">
                      <PriorityStats tasks={tasks} />
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <ActivitySection items={activity} />
                  </div>
                </div>

                {/* Related Actions */}
                <ActionFooter relatedActionIds={relatedActions} onOpen={onOpen} />
              </div>
            </TabPanel>

            {/* ── Open Tasks tab ───────────────────────────────────────── */}
            <TabPanel>
              <div className="ad-content">
                <div className="ad-card">
                  <div className="ad-card__header">
                    <h3 className="ad-card__title">Open Tasks ({openTasks.length})</h3>
                  </div>
                  <div className="ad-card__body" style={{ padding: 0 }}>
                    <TaskTable rows={openTasks} emptyText="No open tasks." />
                  </div>
                </div>
              </div>
            </TabPanel>

            {/* ── In Progress tab ──────────────────────────────────────── */}
            <TabPanel>
              <div className="ad-content">
                <div className="ad-card">
                  <div className="ad-card__header">
                    <h3 className="ad-card__title">In Progress ({inProgressTasks.length})</h3>
                  </div>
                  <div className="ad-card__body" style={{ padding: 0 }}>
                    <TaskTable rows={inProgressTasks} emptyText="No tasks in progress." />
                  </div>
                </div>
              </div>
            </TabPanel>

            {/* ── Completed tab ────────────────────────────────────────── */}
            <TabPanel>
              <div className="ad-content">
                <div className="ad-card">
                  <div className="ad-card__header">
                    <h3 className="ad-card__title">Completed ({completedTasks.length})</h3>
                  </div>
                  <div className="ad-card__body" style={{ padding: 0 }}>
                    <TaskTable rows={completedTasks} emptyText="No completed tasks yet." />
                  </div>
                </div>
              </div>
            </TabPanel>

            {/* ── Evidence tab ─────────────────────────────────────────── */}
            <TabPanel>
              <div className="ad-content">
                <div className="ad-card">
                  <div className="ad-card__header">
                    <h3 className="ad-card__title">Evidence</h3>
                  </div>
                  <div className="ad-card__body">
                    <p style={{ color: '#525252', fontSize: '0.875rem', margin: 0 }}>
                      These tasks were generated from confirmed maintenance gaps identified
                      during the Job Plan vs OEM Analysis.
                      Open the individual gap evidence in the source Analysis action for
                      full OEM documentation references.
                    </p>
                    <div style={{ marginTop: '1rem' }}>
                      {tasks.map((t, i) => (
                          <div key={i} className="ad-severity-row">
                            <span className="ad-severity-row__label">
                              {t.task} — {t.asset}
                            </span>
                            <PriorityTag value={t.priority} />
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>

    </div>
  );
}
