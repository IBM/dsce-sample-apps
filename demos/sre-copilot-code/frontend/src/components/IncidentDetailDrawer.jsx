/**
 * IncidentDetailDrawer.jsx
 * Slide-out panel showing full incident details:
 * description, enriched metadata, and raw logs.
 * An "Analyze with AI" button triggers the agent from inside.
 */
import React from 'react';
import { Tag, Button, IconButton } from '@carbon/react';
import { Close, Analytics, User, Globe, Chip, Time, Tag as TagIcon } from '@carbon/icons-react';

const SEVERITY_TAG_TYPE = {
  Critical: 'red',
  High: 'orange',
  Medium: 'warm-gray',
  Low: 'green',
};

const STATUS_TAG_TYPE = {
  Open: 'blue',
  'In Progress': 'purple',
  Resolved: 'teal',
};

// Realistic fake enrichment data per service
const ENRICHMENT = {
  'payment-service':     { env: 'Production',  region: 'us-east-1',  assignee: 'J. Ramirez',   source: 'PagerDuty',  runbook: 'KB-4412' },
  'db-cluster-01':       { env: 'Production',  region: 'us-east-1',  assignee: 'S. Patel',     source: 'Datadog',    runbook: 'KB-2201' },
  'auth-api':            { env: 'Production',  region: 'us-east-1',  assignee: 'M. Chen',      source: 'PagerDuty',  runbook: 'KB-3305' },
  'order-service':       { env: 'Production',  region: 'us-west-2',  assignee: 'T. Nguyen',    source: 'Splunk',     runbook: 'KB-5519' },
  'storage-node-03':     { env: 'Production',  region: 'eu-west-1',  assignee: 'A. Kovacs',    source: 'Prometheus', runbook: 'KB-1108' },
  'api-gateway':         { env: 'Production',  region: 'us-east-1',  assignee: 'L. Torres',    source: 'Datadog',    runbook: 'KB-6621' },
  'log-aggregator':      { env: 'Staging',     region: 'us-east-1',  assignee: 'R. Obi',       source: 'Fluentd',    runbook: 'KB-8803' },
  'k8s-cluster-prod':    { env: 'Production',  region: 'us-east-1',  assignee: 'D. Singh',     source: 'PagerDuty',  runbook: 'KB-7712' },
  'cache-cluster-02':    { env: 'Production',  region: 'us-east-1',  assignee: 'E. Johansson', source: 'Prometheus', runbook: 'KB-3341' },
  'notification-service':{ env: 'Production',  region: 'us-west-2',  assignee: 'F. Zhang',     source: 'Datadog',    runbook: 'KB-9901' },
  'elasticsearch-prod':  { env: 'Production',  region: 'eu-west-1',  assignee: 'B. Okafor',    source: 'Kibana',     runbook: 'KB-2298' },
  'network-fabric':      { env: 'Production',  region: 'us-east-1',  assignee: 'K. Williams',  source: 'Nagios',     runbook: 'KB-0045' },
  'object-storage-prod': { env: 'Production',  region: 'eu-central-1', assignee: 'P. Martin',  source: 'S3 Alerts',  runbook: 'KB-1133' },
  'inventory-service':   { env: 'Production',  region: 'us-east-1',  assignee: 'N. Ito',       source: 'PagerDuty',  runbook: 'KB-5571' },
  'mobile-api-gateway':  { env: 'Production',  region: 'us-east-1',  assignee: 'C. Hassan',    source: 'Fastly',     runbook: 'KB-7788' },
  'scheduler':           { env: 'Production',  region: 'us-east-1',  assignee: 'H. Muller',    source: 'Kubernetes', runbook: 'KB-4401' },
  'observability-stack': { env: 'Staging',     region: 'us-west-2',  assignee: 'G. Petrov',    source: 'Jaeger',     runbook: 'KB-8819' },
};

const DEFAULT_ENRICHMENT = { env: 'Production', region: 'us-east-1', assignee: 'On-call SRE', source: 'PagerDuty', runbook: 'KB-0001' };

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
}

function LogLine({ line }) {
  const isError = /\bERROR\b/i.test(line);
  const isWarn  = /\bWARN\b/i.test(line);
  const isInfo  = /\bINFO\b/i.test(line);
  const cls = isError ? 'log-line--error' : isWarn ? 'log-line--warn' : isInfo ? 'log-line--info' : '';
  return <div className={`log-line ${cls}`}>{line}</div>;
}

export default function IncidentDetailDrawer({ isOpen, incident, onClose, onAnalyze }) {
  if (!isOpen || !incident) return null;

  const enrichment = ENRICHMENT[incident.affected_service] || DEFAULT_ENRICHMENT;

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Detail panel */}
      <aside className="detail-drawer" aria-label="Incident Details">

        {/* ── Header ── */}
        <div className="detail-drawer__header">
          <div className="detail-drawer__header-text">
            <span className="detail-drawer__incident-id">{incident.id}</span>
            <h3 className="detail-drawer__title">{incident.title}</h3>
          </div>
          <IconButton label="Close" kind="ghost" size="sm" onClick={onClose}>
            <Close />
          </IconButton>
        </div>

        {/* ── Badge strip ── */}
        <div className="detail-drawer__badges">
          <Tag type={SEVERITY_TAG_TYPE[incident.severity] || 'gray'} size="sm">{incident.severity}</Tag>
          <Tag type={STATUS_TAG_TYPE[incident.status] || 'gray'} size="sm">{incident.status}</Tag>
          <Tag type="cool-gray" size="sm">{incident.affected_service}</Tag>
        </div>

        {/* ── Body ── */}
        <div className="detail-drawer__body">

          {/* Metadata grid */}
          <section className="detail-section">
            <h4 className="detail-section__heading">Incident Details</h4>
            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <span className="detail-meta-item__label"><User size={13} /> Assignee</span>
                <span className="detail-meta-item__value">{enrichment.assignee}</span>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-item__label"><Globe size={13} /> Environment</span>
                <span className="detail-meta-item__value">{enrichment.env}</span>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-item__label"><Chip size={13} /> Region</span>
                <span className="detail-meta-item__value">{enrichment.region}</span>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-item__label"><Time size={13} /> Detected</span>
                <span className="detail-meta-item__value">{formatTimestamp(incident.timestamp)}</span>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-item__label"><TagIcon size={13} /> Alert Source</span>
                <span className="detail-meta-item__value">{enrichment.source}</span>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-item__label"><Chip size={13} /> Runbook</span>
                <span className="detail-meta-item__value detail-meta-item__value--mono">{enrichment.runbook}</span>
              </div>
            </div>
          </section>

          {/* Description */}
          {incident.description && (
            <section className="detail-section">
              <h4 className="detail-section__heading">Description</h4>
              <p className="detail-section__description">{incident.description}</p>
            </section>
          )}

          {/* Logs */}
          {incident.logs && incident.logs.length > 0 && (
            <section className="detail-section">
              <h4 className="detail-section__heading">
                Raw Logs
                <span className="detail-section__log-count">{incident.logs.length} lines</span>
              </h4>
              <div className="log-viewer">
                {incident.logs.map((line, i) => (
                  <LogLine key={i} line={line} />
                ))}
              </div>
            </section>
          )}

        </div>

        {/* ── Footer: Analyze CTA ── */}
        <div className="detail-drawer__footer">
          <Button
            kind="primary"
            size="md"
            renderIcon={Analytics}
            onClick={() => { onClose(); onAnalyze(incident); }}
          >
            Analyze with AI
          </Button>
        </div>

      </aside>
    </>
  );
}
