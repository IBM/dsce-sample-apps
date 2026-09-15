/**
 * IncidentCard.jsx
 * A single card representing one incident on the Kanban board.
 *
 * Feature D: Incident Timeline — 4-step progress bar
 *   Detected → Assigned → Analyzing → Resolved
 *   Status maps to a step; clicking Analyze advances to "Analyzing".
 */
import React from 'react';
import { Tag, Button } from '@carbon/react';
import { Analytics, Launch } from '@carbon/icons-react';

const SEVERITY_TAG_TYPE = {
  Critical: 'red',
  High: 'orange',
  Medium: 'warm-gray',
  Low: 'green',
};

const STATUS_TAG_TYPE = {
  Open:        'blue',
  'In Progress': 'purple',
  Analyzing:   'cyan',
  Resolved:    'teal',
};

// Timeline steps definition
const TIMELINE_STEPS = ['Detected', 'Assigned', 'Analyzing', 'Resolved'];

// Map incident status → active step index
function statusToStep(status) {
  if (status === 'Resolved')    return 3;
  if (status === 'Analyzing')   return 2;
  if (status === 'In Progress') return 1;
  return 0; // Open
}

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

// ── Timeline bar component ────────────────────────────────────────────────────
function IncidentTimeline({ status }) {
  const activeStep  = statusToStep(status);
  const isFullyDone = status === 'Resolved'; // all 4 steps complete

  return (
    <div className="incident-timeline">
      {TIMELINE_STEPS.map((step, idx) => {
        // A step is "complete" (filled blue ✓) if:
        //   - it's before the active step, OR
        //   - the incident is fully resolved (all steps done)
        const isComplete = idx < activeStep || isFullyDone;
        const isActive   = idx === activeStep && !isFullyDone;
        return (
          <React.Fragment key={step}>
            {/* Step node */}
            <div className={`incident-timeline__step
              ${isComplete ? 'incident-timeline__step--complete' : ''}
              ${isActive   ? 'incident-timeline__step--active'   : ''}
            `}>
              <div className="incident-timeline__dot">
                {isComplete && <span className="incident-timeline__check">✓</span>}
              </div>
              <span className="incident-timeline__label">{step}</span>
            </div>
            {/* Connector — filled when both endpoints are complete */}
            {idx < TIMELINE_STEPS.length - 1 && (
              <div className={`incident-timeline__connector ${isComplete ? 'incident-timeline__connector--filled' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function IncidentCard({ incident, onAnalyze, onViewDetails }) {
  return (
    <div className="incident-card">
      {/* Clickable body — opens detail drawer */}
      <div
        className="incident-card__body"
        onClick={() => onViewDetails(incident)}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${incident.id}`}
        onKeyDown={(e) => e.key === 'Enter' && onViewDetails(incident)}
      >
        {/* ID + Status row */}
        <div className="incident-card__header">
          <span className="incident-card__id">{incident.id}</span>
          <Tag type={STATUS_TAG_TYPE[incident.status] || 'gray'} size="sm">
            {incident.status}
          </Tag>
        </div>

        {/* Title */}
        <h4 className="incident-card__title">{incident.title}</h4>

        {/* Description (clamped to 2 lines) */}
        {incident.description && (
          <p className="incident-card__description">{incident.description}</p>
        )}

        {/* Service tag + timestamp */}
        <div className="incident-card__meta">
          <Tag type="cool-gray" size="sm" className="incident-card__service-tag">
            {incident.affected_service}
          </Tag>
          <span className="incident-card__timestamp">
            {formatTimestamp(incident.timestamp)}
          </span>
        </div>

        {/* Feature D: timeline progress bar */}
        <IncidentTimeline status={incident.status} />
      </div>

      {/* Actions row */}
      <div className="incident-card__actions">
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Launch}
          iconDescription="View details"
          onClick={() => onViewDetails(incident)}
          className="incident-card__details-btn"
        >
          Details
        </Button>
        <Button
          kind="primary"
          size="sm"
          renderIcon={Analytics}
          onClick={(e) => { e.stopPropagation(); onAnalyze(incident); }}
        >
          Analyze
        </Button>
      </div>
    </div>
  );
}
