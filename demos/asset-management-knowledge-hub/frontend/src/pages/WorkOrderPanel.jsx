import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tag } from '@carbon/react';
import { Close } from '@carbon/icons-react';
import './ActionDetail.scss';

// ── Tag type maps ──────────────────────────────────────────────────────────
const STATUS_TYPE = {
  'Closed':       'green',
  'In Progress':  'blue',
  'Open':         'cyan',
  'Scheduled':    'cool-gray',
  'On Hold':      'warm-gray',
  'Cancelled':    'gray',
};

const PRIORITY_TYPE = {
  'Critical': 'red',
  'High':     'magenta',
  'Medium':   'blue',
  'Low':      'green',
};

const TYPE_COLOR = {
  'Corrective': 'red',
  'Preventive': 'green',
  'Inspection': 'blue',
};

// ── Compact field/value row ────────────────────────────────────────────────
function Field({ label, value, mono = false, link = false }) {
  if (!value || value === '—' && label !== 'Actual finish') return null;
  return (
    <div className="ep-field">
      <span className="ep-field__label">{label}</span>
      {link
        ? <a href="#" className="ep-field__link" onClick={e => e.preventDefault()}>{value}</a>
        : <span className={`ep-field__value${mono ? ' ep-field__value--mono' : ''}`}>{value}</span>
      }
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────
function Section({ badge, badgeClass, accentClass, heading, children }) {
  return (
    <div className={`ep-section ${accentClass ?? ''}`}>
      <div className="ep-section__meta">
        <span className={`ep-section__tag ${badgeClass}`}>{badge}</span>
        <span className="ep-section__heading">{heading}</span>
      </div>
      <div className="ep-section__body">{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WorkOrderPanel({ data, onClose }) {
  const isOpen = Boolean(data);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const totalLabourHrs = data?.labour?.reduce((s, l) => s + (l.hours ?? 0), 0) ?? 0;

  const content = (
    <>
      {/* Dim overlay */}
      <div
        className={`ep-overlay${isOpen ? ' ep-overlay--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side panel */}
      <aside
        className={`ep-panel${isOpen ? ' ep-panel--open' : ''}`}
        aria-label="Work order details"
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Sticky header ─────────────────────────────────────────── */}
        <div className="ep-header" style={{ borderLeftColor: '#007d79' }}>
          <div className="ep-header__text">
            <p className="ep-header__title">Work Order</p>
            <div className="ep-header__asset">
              <span className="ep-header__asset-id">{data?.woNum}</span>
              {data?.asset && <span className="ep-header__asset-sep">·</span>}
              {data?.asset && <span className="ep-header__asset-name">{data.asset}</span>}
            </div>
            {data?.woType && (
              <span className="ep-header__topic">{data.woType}</span>
            )}
          </div>
          <button
            className="ep-header__close"
            onClick={onClose}
            aria-label="Close work order"
            title="Close"
          >
            <Close size={20} />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────── */}
        <div className="ep-body">

          {/* 1 — Work order details */}
          <Section badge="Work order" badgeClass="ep-tag--wo-detail" accentClass="ep-section--wo-detail" heading="Details">
            <div className="ep-tags-row" style={{ paddingBottom: '0.5rem' }}>
              <Tag type={STATUS_TYPE[data?.status] ?? 'gray'} size="sm">{data?.status}</Tag>
              <Tag type={PRIORITY_TYPE[data?.priority] ?? 'gray'} size="sm">Priority {data?.priority}</Tag>
              <Tag type={TYPE_COLOR[data?.woType] ?? 'gray'} size="sm">{data?.woType}</Tag>
            </div>
            <Field label="Description"    value={data?.description} />
            <Field label="Asset"          value={data?.asset ? `${data.asset} — ${data.assetDesc}` : null} />
            <Field label="Location"       value={data?.location} mono />
            <Field label="Site"           value={data?.site} />
            <Field label="Reported by"    value={data?.reportedBy} />
            <Field label="Reported date"  value={data?.reportedDate} />
            <Field label="Parent PM"      value={data?.parentPM} mono link />
            <Field label="Job plan"       value={data?.jobPlan}   mono link />
            <Field label="Downtime"       value={data?.downtime} />
          </Section>

          {/* 2 — Schedule */}
          <Section badge="Schedule" badgeClass="ep-tag--wo-schedule" accentClass="ep-section--wo-schedule" heading="Target vs actual">
            <Field label="Target start"   value={data?.targetStart} />
            <Field label="Target finish"  value={data?.targetFinish} />
            <Field label="Actual start"   value={data?.actualStart} />
            <Field label="Actual finish"  value={data?.actualFinish === '—' ? 'In progress' : data?.actualFinish} />
          </Section>

          {/* 3 — Failure information (corrective WOs only) */}
          {(data?.failureClass || data?.cause) && (
            <Section badge="Failure" badgeClass="ep-tag--wo-failure" accentClass="ep-section--wo-failure" heading="Root cause">
              <Field label="Failure class" value={data?.failureClass} />
              <Field label="Failure code"  value={data?.failureCode} mono />
              {data?.cause && (
                <div className="ep-field" style={{ gridTemplateColumns: '1fr', gap: 0, padding: '0.5rem 0' }}>
                  <span className="ep-field__label" style={{ marginBottom: '0.25rem' }}>Cause</span>
                  <p className="ep-analysis-text" style={{ margin: 0 }}>{data.cause}</p>
                </div>
              )}
              {data?.remedy && (
                <div className="ep-field" style={{ gridTemplateColumns: '1fr', gap: 0, padding: '0.5rem 0 0' }}>
                  <span className="ep-field__label" style={{ marginBottom: '0.25rem' }}>Remedy</span>
                  <p className="ep-recommended-text" style={{ margin: 0 }}>{data.remedy}</p>
                </div>
              )}
            </Section>
          )}

          {/* 4 — Work log */}
          {data?.workLog?.length > 0 && (
            <Section badge="Work log" badgeClass="ep-tag--wo-log" accentClass="ep-section--wo-log" heading={`${data.workLog.length} entr${data.workLog.length === 1 ? 'y' : 'ies'}`}>
              {data.workLog.map((entry, i) => (
                <div key={i} className="wo-log-entry">
                  <div className="wo-log-entry__meta">
                    <span className="wo-log-entry__date">{entry.date}</span>
                    <span className="wo-log-entry__by">{entry.by}</span>
                  </div>
                  <p className="wo-log-entry__text">{entry.entry}</p>
                </div>
              ))}
            </Section>
          )}

          {/* 5 — Labour */}
          {data?.labour?.length > 0 && (
            <Section badge="Labour" badgeClass="ep-tag--wo-labour" accentClass="ep-section--wo-labour" heading={`${totalLabourHrs} hrs total`}>
              {data.labour.map((l, i) => (
                <div key={i} className="ep-field">
                  <span className="ep-field__label">{l.craft}</span>
                  <span className="ep-field__value">{l.name} — {l.hours} hrs</span>
                </div>
              ))}
            </Section>
          )}

          {/* 6 — Materials */}
          {data?.materials?.length > 0 && (
            <Section badge="Materials" badgeClass="ep-tag--wo-materials" accentClass="ep-section--wo-materials" heading={`${data.materials.length} line${data.materials.length === 1 ? '' : 's'}`}>
              {data.materials.map((m, i) => (
                <div key={i} className="ep-field">
                  <span className="ep-field__label" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.partNum}</span>
                  <span className="ep-field__value">{m.description} — {m.qty} {m.unit}</span>
                </div>
              ))}
            </Section>
          )}

          {/* 7 — AI insight */}
          {data?.aiInsight && (
            <Section badge="AI insight" badgeClass="ep-tag--ai" accentClass="ep-section--ai" heading="Pattern analysis">
              <p className="ep-analysis-text" style={{ margin: 0 }}>{data.aiInsight}</p>
            </Section>
          )}

        </div>

        {/* ── Sticky footer ─────────────────────────────────────────── */}
        <div className="ep-footer">
          <button className="ep-footer__create" onClick={onClose}>
            Create task from WO
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(content, document.body);
}
