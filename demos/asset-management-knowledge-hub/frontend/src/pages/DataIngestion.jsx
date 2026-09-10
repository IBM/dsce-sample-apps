import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Button, Tag, InlineNotification, InlineLoading,
  TextInput, NumberInput, Toggle,
  DataTable, TableContainer, Table, TableHead, TableRow,
  TableHeader, TableBody, TableCell, TableToolbar,
  TableToolbarContent, TableToolbarSearch,
  Modal,
} from '@carbon/react';
import {
  CloudUpload, Globe, Box,
  Settings, Renew, CheckmarkFilled, ErrorFilled,
  InformationFilled, Close,
} from '@carbon/icons-react';
import axios from 'axios';
import { loadIngestSources, saveIngestSources } from '../utils/ingestSources';
import { getSecrets } from '../utils/ingestSecrets';
import './DataIngestion.scss';

const INGEST_URL = import.meta.env.VITE_INGESTION_URL || '/ingest-api';

// ── Timestamp formatter — "04 Aug 2026, 15:31" (unambiguous, 24 h) ────────────
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ value }) {
  const map = {
    indexed: 'green', ok: 'green', success: 'green',
    done:    'green',
    failed:  'red',   error: 'red',
    skipped: 'gray',
    running: 'blue',
    pending: 'purple',
    start:   'blue',
  };
  const type = map[(value || '').toLowerCase()] || 'gray';
  return <Tag type={type} size="sm">{value || '—'}</Tag>;
}

// ── Source definitions ─────────────────────────────────────────────────────────
const SOURCE_DEFS = {
  cos: {
    Icon: CloudUpload,
    title: 'IBM Cloud Object Storage',
    description: 'Ingest documents stored in IBM COS buckets. Bucket, API key, and endpoint are configured via server environment variables.',
  },
  web: {
    Icon: Globe,
    title: 'Web Pages / URLs',
    description: 'Crawl public web pages and index their content. Configure seed URLs and crawl depth in Settings.',
  },
  box: {
    Icon: Box,
    title: 'Box.com',
    description: 'Ingest files from Box folders using OAuth credentials. Configure your Box App details in Settings.',
  },
};

// ── Jobs history table columns ────────────────────────────────────────────────
const JOB_HEADERS = [
  { key: 'label',      header: 'Job / File'    },
  { key: 'source',     header: 'Source'        },
  { key: 'status',     header: 'Status'        },
  { key: 'chunkCount', header: 'Chunks'        },
  { key: 'indexedAt',  header: 'Started'       },
];

// ── Progress event type → icon ────────────────────────────────────────────────
function EventIcon({ type }) {
  if (type === 'done')  return <CheckmarkFilled size={14} style={{ fill: '#24a148', flexShrink: 0 }} />;
  if (type === 'error') return <ErrorFilled     size={14} style={{ fill: '#da1e28', flexShrink: 0 }} />;
  if (type === 'chunk') return <CheckmarkFilled size={14} style={{ fill: '#0f62fe', flexShrink: 0 }} />;
  return <InformationFilled size={14} style={{ fill: '#8a8a8a', flexShrink: 0 }} />;
}

// ── Job detail modal ──────────────────────────────────────────────────────────
function JobDetailModal({ job, onClose }) {
  const [events, setEvents]     = useState([]);
  const [status, setStatus]     = useState(job?.status || 'running');
  const bottomRef               = useRef(null);
  const esRef                   = useRef(null);

  useEffect(() => {
    if (!job) return;

    // If job is already completed (from file store, no job_id) just show what we have
    if (!job.job_id || job.status === 'indexed' || job.status === 'failed' || job.status === 'skipped') {
      setStatus(job.status);
      setEvents([{
        type: job.status === 'indexed' ? 'done' : job.status,
        message: job.error
          ? `Failed: ${job.error}`
          : `${job.chunkCount || 0} chunks indexed`,
      }]);
      return;
    }

    // Open SSE stream for live job
    const url = `${INGEST_URL}/api/ingestion/progress/${job.job_id}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents(prev => [...prev, data]);
        if (data.type === 'done' || data.type === 'error') {
          setStatus(data.type === 'done' ? 'done' : 'error');
          es.close();
        }
      } catch {}
    };

    es.onerror = () => {
      setStatus(s => s === 'running' ? 'error' : s);
      es.close();
    };

    return () => { es.close(); };
  }, [job]);

  // Auto-scroll to bottom as events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (!job) return null;

  const label = job.label || job.fileName || job.job_id || '—';

  return (
    <Modal
      open
      passiveModal
      size="sm"
      modalHeading={
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusBadge value={status} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
            {label}
          </span>
        </span>
      }
      onRequestClose={onClose}
    >
      <div className="jd-meta">
        <span className="jd-meta__item">Source: <strong>{job.source || '—'}</strong></span>
        {job.startedAt && (
          <span className="jd-meta__item">
            Started: <strong>{fmtTime(job.startedAt)}</strong>
          </span>
        )}
        {(status === 'running') && (
          <InlineLoading description="Running…" status="active" style={{ marginLeft: 'auto' }} />
        )}
      </div>

      <div className="jd-log">
        {events.length === 0 && status === 'running' && (
          <div className="jd-log__waiting">Waiting for events…</div>
        )}
        {events.map((ev, i) => (
          <div key={i} className={`jd-log__line jd-log__line--${ev.type}`}>
            <EventIcon type={ev.type} />
            <span className="jd-log__msg">{ev.message}</span>
            {ev.chunks > 0 && (
              <span className="jd-log__chunks">{ev.chunks} chunks</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </Modal>
  );
}

// ── Source card ───────────────────────────────────────────────────────────────
function SourceCard({
  sourceKey, sources, running,
  cosPrefix, setCosPrefix, cosForce, setCosForce,
  webUrls, setWebUrls, webDepth, setWebDepth,
  boxForce, setBoxForce,
  onRun, onConfigure,
}) {
  const def = SOURCE_DEFS[sourceKey];
  const { Icon, title, description } = def;
  const src = sources[sourceKey];
  const configured = src?.configured ?? false;
  const isRunning = running[sourceKey];

  const runLabel = {
    cos: 'Run COS pipeline',
    web: 'Run web crawl',
    box: 'Run Box ingestion',
  }[sourceKey];

  return (
    <div className="di-source-card">
      <div className="di-source-card__header">
        <div className="di-source-card__icon-wrap"><Icon size={20} /></div>
        <div className="di-source-card__meta">
          <span className="di-source-card__title">{title}</span>
          <span className="di-source-card__badge">
            {configured
              ? <Tag type="green" size="sm">Configured</Tag>
              : <Tag type="gray"  size="sm">Not configured</Tag>
            }
          </span>
        </div>
      </div>

      <div className={`di-source-card__body${!configured ? ' di-source-card__body--no-controls' : ''}`}>
        <p className="di-source-card__desc">{description}</p>
        {configured && (
          <div className="di-source-card__controls">
            {sourceKey === 'cos' && (
              <>
                <TextInput
                  id="cos-run-prefix" size="sm"
                  labelText="Prefix override (optional)"
                  placeholder={src.prefix || 'documents/'}
                  value={cosPrefix}
                  onChange={e => setCosPrefix(e.target.value)}
                />
                <div className="di-source-card__toggle">
                  <Toggle id="cos-run-force" size="sm" labelText="Force re-index"
                    labelA="Off" labelB="On" toggled={cosForce} onToggle={setCosForce} />
                </div>
              </>
            )}
            {sourceKey === 'web' && (
              <>
                <TextInput
                  id="web-run-urls" size="sm"
                  labelText="Additional URLs (one per line, optional)"
                  placeholder="https://extra-page.example.com"
                  value={webUrls}
                  onChange={e => setWebUrls(e.target.value)}
                />
                <NumberInput
                  id="web-run-depth" size="sm"
                  label="Override max depth" min={0} max={5}
                  value={webDepth ?? ''}
                  onChange={(_, { value }) => setWebDepth(value === '' ? null : value)}
                />
              </>
            )}
            {sourceKey === 'box' && (
              <>
                <div className="di-source-card__summary">
                  Folder ID: <code>{src.folderId || '0'}</code>
                </div>
                <div className="di-source-card__toggle">
                  <Toggle id="box-run-force" size="sm" labelText="Force re-index"
                    labelA="Off" labelB="On" toggled={boxForce} onToggle={setBoxForce} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`di-source-card__footer${!configured ? ' di-source-card__footer--unconfigured' : ''}`}>
        {configured ? (
          <Button
            kind="primary" size="sm" renderIcon={Icon}
            onClick={() => onRun(sourceKey)}
            disabled={isRunning}
          >
            {isRunning
              ? <InlineLoading description="Queued…" status="active" />
              : runLabel}
          </Button>
        ) : (
          <Button kind="primary" size="sm" renderIcon={Settings} onClick={onConfigure}>
            Configure
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DataIngestion({ onNavigate }) {
  const [sources,     setSources]     = useState(() => loadIngestSources());
  const [notice,      setNotice]      = useState(null);
  const [jobs,        setJobs]        = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [running,     setRunning]     = useState({ cos: false, web: false, box: false });
  const [selectedJob, setSelectedJob] = useState(null);

  // Run-time overrides
  const [cosPrefix, setCosPrefix] = useState('');
  const [cosForce,  setCosForce]  = useState(false);
  const [webUrls,   setWebUrls]   = useState('');
  const [webDepth,  setWebDepth]  = useState(null);
  const [boxForce,  setBoxForce]  = useState(false);

  // Track active job_ids so we know when to poll
  const activeJobIds  = useRef(new Set());
  // Timestamp of last run — keeps poll alive for 30 s even if no job_id yet
  const lastRunAt     = useRef(0);

  // On mount: reload from localStorage (catches changes saved by Configuration page)
  // then check the ingestion server for live COS status so the button is always
  // enabled when COS_API_KEY is set — even if Configuration was never visited.
  useEffect(() => {
    const stored = loadIngestSources();
    setSources(stored);

    (async () => {
      try {
        const { data } = await axios.get(`${INGEST_URL}/api/cos/status`);
        if (data.iamConfigured && !stored.cos?.configured) {
          const updated = {
            ...stored,
            cos: {
              ...stored.cos,
              configured: true,
              ...(data.bucketName && { bucket:   data.bucketName }),
              ...(data.endpoint   && { endpoint: data.endpoint }),
              ...(data.region     && { region:   data.region }),
            },
          };
          saveIngestSources(updated);
          setSources(updated);
        }
      } catch {
        // ingestion server unreachable — rely on whatever was in localStorage
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRun = (src, v) => setRunning(p => ({ ...p, [src]: v }));

  const notify = (kind, title, msg) => {
    setNotice({ kind, title, msg });
    setTimeout(() => setNotice(null), 6000);
  };

  const goSettings = () => onNavigate?.('configuration');

  // ── Merge running (in-memory) + completed (file store) jobs ──────────────────
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      // Fetch both in parallel
      const [runningRes, historyRes] = await Promise.allSettled([
        axios.get(`${INGEST_URL}/api/ingestion/jobs/running`),
        axios.get(`${INGEST_URL}/api/ingestion/jobs`),
      ]);

      const runningJobs = runningRes.status === 'fulfilled'
        ? (runningRes.value.data.jobs || [])
        : [];
      const historyJobs = historyRes.status === 'fulfilled'
        ? (historyRes.value.data.jobs || [])
        : [];

      // Running jobs take precedence — dedupe by job_id
      const runningIds = new Set(runningJobs.map(j => j.job_id));

      const normaliseRunning = (j, i) => ({
        id:         `run-${j.job_id || i}`,
        job_id:     j.job_id,
        label:      j.label || j.job_id || '—',
        fileName:   j.label || j.job_id || '—',
        source:     j.source || '—',
        status:     j.status || 'running',
        chunkCount: j.chunks ?? '—',
        indexedAt:  fmtTime(j.startedAt),
        startedAt:  j.startedAt,
        error:      j.lastMsg || '',
        _isRunning: true,
      });

      const normaliseHistory = (j, i) => ({
        // Always include index so duplicate documentIds don't collapse in Carbon DataTable
        id:         `hist-${i}-${j.jobId || j.documentId || i}`,
        job_id:     j.jobId || null,
        label:      j.fileName || j.documentId || '—',
        fileName:   j.fileName || j.documentId || '—',
        source:     j.source || '—',
        status:     j.status || '—',
        chunkCount: j.chunkCount ?? '—',
        indexedAt:  fmtTime(j.indexedAt),
        startedAt:  j.indexedAt,
        error:      j.error || '',
        _isRunning: false,
      });

      const merged = [
        ...runningJobs.map(normaliseRunning),
        ...historyJobs
          .filter(j => !runningIds.has(j.jobId))
          .map(normaliseHistory),
      ];

      setJobs(merged);

      // Update activeJobIds — used by the polling interval
      activeJobIds.current = new Set(
        runningJobs.filter(j => j.status === 'running').map(j => j.job_id)
      );
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Poll every 3 s while any job is running OR within 30 s of the last run
  useEffect(() => {
    const timer = setInterval(() => {
      const recentRun = (Date.now() - lastRunAt.current) < 30_000;
      if (activeJobIds.current.size > 0 || recentRun) loadJobs();
    }, 3000);
    return () => clearInterval(timer);
  }, [loadJobs]);

  // ── Run helpers ───────────────────────────────────────────────────────────────
  // Wraps every POST: sets running flag, records lastRunAt, always clears on done.
  // A 15 s hard timeout ensures the button never gets stuck if the server hangs.
  const fireRun = useCallback(async (src, postFn) => {
    setRun(src, true);
    lastRunAt.current = Date.now();

    // Hard-timeout guard — clears the button after 15 s regardless
    const timeout = setTimeout(() => setRun(src, false), 15_000);
    try {
      await postFn();
      loadJobs();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      // FastAPI 422 returns detail as an array of validation error objects — flatten to string
      const msg = Array.isArray(detail)
        ? detail.map(e => e.msg || JSON.stringify(e)).join('; ')
        : (typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : err.message);
      notify('error', `${src.toUpperCase()} failed — `, msg);
    } finally {
      clearTimeout(timeout);
      setRun(src, false);
    }
  }, [loadJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run handlers — fire & forget ──────────────────────────────────────────────
  const runCos = () => fireRun('cos', async () => {
    // Use the run-time override if set, else fall back to the saved prefix.
    // Pass the value directly — do NOT use || so that an explicit empty string
    // ("no prefix" = scan the whole bucket) is respected instead of being
    // replaced by the server's default of "documents/".
    const prefix = cosPrefix.trim() !== '' ? cosPrefix.trim() : sources.cos.prefix;
    await axios.post(`${INGEST_URL}/api/pipelines/run`, {
      prefix,
      force: cosForce,
    });
    notify('success', 'IBM COS — ', 'Job started. Watch the history table for progress.');
  });

  const runWeb = () => {
    const web = sources.web;
    const urlList = (webUrls.trim() || web.urls)
      .split('\n').map(u => u.trim()).filter(Boolean);
    if (!urlList.length) {
      notify('warning', 'Web — ', 'No URLs configured. Add URLs in Settings → Ingestion Sources.');
      return;
    }
    fireRun('web', async () => {
      const { data } = await axios.post(`${INGEST_URL}/api/ingestion/web`, {
        urls: urlList,
        max_depth: webDepth ?? web.maxDepth,
        max_pages: web.maxPages,
        selector: web.selector || null,
        category: web.category,
      });
      notify('success', 'Web crawl — ', `Job ${data.job_id} started for ${data.urls} URL(s).`);
    });
  };

  const runBox = () => fireRun('box', async () => {
    const box = sources.box;
    const { clientId, clientSecret, accessToken } = getSecrets('box');
    if (!clientId || !accessToken) {
      notify('warning', 'Box — ', 'Enter OAuth credentials in Settings → Ingestion Sources first.');
      return;
    }
    const { data } = await axios.post(`${INGEST_URL}/api/ingestion/box`, {
      client_id: clientId, client_secret: clientSecret,
      access_token: accessToken, folder_id: box.folderId,
      force: boxForce, category: box.category,
    });
    notify('success', 'Box — ', `Job ${data.job_id} started.`);
  });

  const runHandlers = { cos: runCos, web: runWeb, box: runBox };

  const sharedCardProps = {
    sources, running,
    cosPrefix, setCosPrefix, cosForce, setCosForce,
    webUrls, setWebUrls, webDepth, setWebDepth,
    boxForce, setBoxForce,
    onConfigure: goSettings,
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="di-page">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="di-page-header">
        <h1 className="di-page-header__title">Data ingestion</h1>
        <p className="di-page-header__sub">
          Connect and manage content sources for the Knowledge Hub.
        </p>
      </div>

      {/* ── Inline notification ─────────────────────────────────────────────── */}
      {notice && (
        <div className="di-notice-wrap">
          <InlineNotification
            kind={notice.kind}
            title={notice.title}
            subtitle={notice.msg}
            onCloseButtonClick={() => setNotice(null)}
          />
        </div>
      )}

      {/* ── Source cards grid ────────────────────────────────────────────────── */}
      <section className="di-section">
        <h2 className="di-section__heading">Content sources</h2>
        <div className="di-source-grid">
          {['cos', 'web', 'box'].map(key => (
            <SourceCard
              key={key}
              sourceKey={key}
              {...sharedCardProps}
              onRun={runHandlers[key]}
            />
          ))}
        </div>
      </section>

      {/* ── Ingestion history ────────────────────────────────────────────────── */}
      <section className="di-section di-section--history">
        <div className="di-section__header-row">
          <h2 className="di-section__heading" style={{ marginBottom: 0 }}>
            Ingestion jobs
            {activeJobIds.current.size > 0 && (
              <Tag type="blue" size="sm" style={{ marginLeft: '0.5rem' }}>
                {activeJobIds.current.size} running
              </Tag>
            )}
          </h2>
          <Button
            kind="ghost" size="sm" renderIcon={Renew}
            onClick={loadJobs} disabled={jobsLoading}
          >
            {jobsLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {jobsLoading && jobs.length === 0 ? (
          <div className="di-history-loading">
            <InlineLoading description="Loading job history…" status="active" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="di-history-empty">
            <div className="di-history-empty__icon"><CloudUpload size={32} /></div>
            <p className="di-history-empty__title">No ingestion jobs yet</p>
            <p className="di-history-empty__sub">
              Configure a source and run your first ingestion job.
            </p>
            <Button kind="primary" size="sm" renderIcon={Settings} onClick={goSettings}>
              Configure a source
            </Button>
          </div>
        ) : (
          <div className="di-history-table">
            <DataTable rows={jobs} headers={JOB_HEADERS} isSortable>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
                <TableContainer>
                  <TableToolbar>
                    <TableToolbarContent>
                      <TableToolbarSearch onChange={onInputChange} placeholder="Filter jobs…" />
                    </TableToolbarContent>
                  </TableToolbar>
                  <Table {...getTableProps()} size="sm">
                    <TableHead>
                      <TableRow>
                        {headers.map(h => {
                          const { key, ...headerProps } = getHeaderProps({ header: h });
                          return (
                            <TableHeader key={key} {...headerProps}>
                              {h.header}
                            </TableHeader>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map(row => {
                        const rawJob = jobs.find(j => j.id === row.id);
                        const { key: rowKey, ...rowProps } = getRowProps({ row });
                        return (
                          <TableRow
                            key={rowKey}
                            {...rowProps}
                            className={`di-job-row${rawJob?._isRunning ? ' di-job-row--running' : ''}`}
                            onClick={() => setSelectedJob(rawJob)}
                            title="Click to view job details"
                          >
                            {row.cells.map(cell => (
                              <TableCell key={cell.id}>
                                {cell.info.header === 'status' ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <StatusBadge value={cell.value} />
                                    {rawJob?._isRunning && cell.value === 'running' && (
                                      <InlineLoading status="active" style={{ width: 'auto' }} />
                                    )}
                                  </span>
                                ) : cell.info.header === 'label' ? (
                                  <span className="di-job-row__label" title={cell.value}>
                                    {cell.value}
                                  </span>
                                ) : (
                                  cell.value
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
            <p className="di-history-hint">Click any row to view job details and live progress.</p>
          </div>
        )}
      </section>

      {/* ── Job detail modal ─────────────────────────────────────────────────── */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}

    </div>
  );
}
