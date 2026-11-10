import { Link, useNavigate } from 'react-router-dom';
import { Button, InlineNotification, SkeletonText, Tile } from '@carbon/react';
import { ArrowRight, CheckmarkFilled, CircleDash } from '@carbon/icons-react';
import { Card, PageHeader, Stat } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useBob, useExecutions, useQse, useRepos } from '../hooks/queries';
import { formatDate, formatDuration } from '../services/format';

export function OverviewPage() {
  const navigate = useNavigate();
  const bob = useBob();
  const repos = useRepos();
  const qse = useQse();
  const recent = useExecutions({ page: 1, pageSize: 5, sort: 'createdAt', direction: 'desc' });

  const cloned = repos.data?.items.find((r) => r.status === 'cloned');
  const bobOk = bob.data?.state === 'connected';
  const qseOk = qse.data?.status === 'valid';

  const steps = [
    { n: 1, title: 'Connect Headless Bob', done: bobOk, to: '/bob', text: bob.data ? bob.data.message ?? 'Provide the address and API key, then test the connection.' : '' },
    { n: 2, title: 'Clone a GitHub repository', done: !!cloned, to: '/repository', text: cloned ? `${cloned.owner}/${cloned.name}@${cloned.branch}` : 'Validate and clone the repository to analyse.' },
    { n: 3, title: 'Validate the QSE CLI', done: qseOk, to: '/qse', text: qse.data?.version ? `Version ${qse.data.version}` : 'Discover or configure qse-cli and validate it.' },
    { n: 4, title: 'Run an execution', done: false, to: '/workspace', text: 'Describe the task and let Headless Bob run the workflow.' }
  ];

  return (
    <div>
      <PageHeader title="Overview" subtitle="Orchestrate quantum-safe analysis with Headless Bob: connect, clone, validate the QSE CLI, then run and review an end-to-end report." />
      <div className="grid-4 section">
        <Stat label="Headless Bob" value={bob.data ? <StatusTag status={bob.data.state} /> : <SkeletonText />} tone={bobOk ? 'ok' : bob.data?.state === 'not_configured' ? undefined : 'bad'} sub={bob.data?.endpoint ?? undefined} />
        <Stat label="Repository" value={cloned ? `${cloned.owner}/${cloned.name}` : 'None cloned'} tone={cloned ? 'ok' : undefined} sub={cloned ? `Branch ${cloned.branch}` : undefined} />
        <Stat label="QSE CLI" value={qse.data ? <StatusTag status={qse.data.status} /> : <SkeletonText />} tone={qseOk ? 'ok' : undefined} sub={qse.data?.version ?? undefined} />
        <Stat label="Executions" value={recent.data?.total ?? '—'} sub="Total recorded" tone="info" />
      </div>

      <div className="grid-2 section">
        <Card title="Getting started" help="Complete these steps in order. Each step reflects live state from the backend.">
          <ol className="step-list">
            {steps.map((s) => (
              <li key={s.n}>
                {s.done ? <CheckmarkFilled size={20} style={{ fill: 'var(--cds-support-success)' }} aria-label="Done" /> : <CircleDash size={20} aria-label="Not done" />}
                <div>
                  <strong>{s.title}</strong>
                  <div className="msg">{s.text}</div>
                </div>
                <Button kind="ghost" size="sm" renderIcon={ArrowRight} onClick={() => navigate(s.to)}>
                  Open
                </Button>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Recent executions" actions={<Link to="/history">View all</Link>}>
          {recent.isLoading && <SkeletonText paragraph lineCount={4} />}
          {recent.data && recent.data.items.length === 0 && (
            <Tile>No executions yet. Complete the steps on the left, then start one from the Execution Workspace.</Tile>
          )}
          {recent.data?.items.map((e) => (
            <div key={e.id} className="row" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--cds-border-subtle-01)' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Link to={e.status === 'completed' && e.reportId ? `/reports/${e.id}` : `/workspace/${e.id}`}>{e.promptSummary || e.id}</Link>
                <div className="step-source">
                  {e.repositoryName} · {formatDate(e.createdAt)} · {formatDuration(e.durationMs)}
                </div>
              </div>
              <StatusTag status={e.status} size="sm" />
            </div>
          ))}
          {recent.isError && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not load executions" />}
        </Card>
      </div>
    </div>
  );
}
