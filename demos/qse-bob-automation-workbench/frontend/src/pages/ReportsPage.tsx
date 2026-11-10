import { Link } from 'react-router-dom';
import { Button, InlineNotification, SkeletonText, Tag, Tile } from '@carbon/react';
import { Card, PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useExecutions } from '../hooks/queries';
import { formatDate, formatDuration } from '../services/format';

export function ReportsPage() {
  const { data, isLoading, isError, error } = useExecutions({ page: 1, pageSize: 100, sort: 'createdAt', direction: 'desc' });
  const withReport = (data?.items ?? []).filter((e) => e.reportId);

  return (
    <div>
      <PageHeader title="Reports" subtitle="End-to-end reports retrieved from Headless Bob executions." />
      {isError && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not load reports" subtitle={(error as Error).message} />}
      {isLoading && <SkeletonText paragraph lineCount={5} />}
      {data && withReport.length === 0 && <Tile>No reports yet. A report is available after an execution finishes.</Tile>}
      <div className="grid-2">
        {withReport.map((e) => (
          <Card key={e.id}>
            <div className="row" style={{ marginBottom: '0.5rem' }}>
              <StatusTag status={e.status} size="sm" />
              {e.mock && <Tag size="sm" type="magenta">DEMO</Tag>}
              <span className="spacer" />
              <span className="step-source">{formatDate(e.createdAt)}</span>
            </div>
            <h3 style={{ marginBottom: '0.25rem' }}>{e.repositoryName}</h3>
            <p style={{ marginBottom: '0.75rem' }}>{e.promptSummary}</p>
            <p className="step-source" style={{ marginBottom: '1rem' }}>
              Branch {e.branch} · {formatDuration(e.durationMs)} · <Link to={`/workspace/${e.id}`}>Execution</Link>
            </p>
            <Button as={Link} to={`/reports/${e.id}`} size="sm">
              Open report
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
