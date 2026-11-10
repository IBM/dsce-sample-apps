import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, InlineLoading, InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs, Tag, Tile } from '@carbon/react';
import { Copy, Download, DocumentExport } from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Card, KeyValues, PageHeader } from '../components/PageHeader';
import { LogViewer } from '../components/LogViewer';
import { Markdown } from '../components/Markdown';
import { StatusTag } from '../components/StatusTag';
import { useExecution } from '../hooks/queries';
import { useNotify } from '../hooks/useNotify';
import { api, ApiError } from '../services/api';
import { formatBytes, formatDate, formatDuration } from '../services/format';
import type { Report, ReportSection } from '../types/api';

const SOURCE_LABEL: Record<Report['source'], string> = {
  'headless-bob-file': 'Report file written by Headless Bob',
  'headless-bob-output': 'Final answer returned by Headless Bob (no report file was produced)',
  unavailable: 'Headless Bob returned no report content'
};

function Sections({ sections, empty }: { sections: ReportSection[]; empty: string }) {
  if (sections.length === 0) return <Tile>{empty}</Tile>;
  return (
    <div>
      {sections.map((s, i) => (
        <section key={`${s.key}-${i}`}>
          <h3 style={{ marginTop: i ? '1.5rem' : 0 }}>{s.title}</h3>
          <Markdown>{s.markdown || '_No content._'}</Markdown>
        </section>
      ))}
    </div>
  );
}

export function ReportViewPage() {
  const { executionId = '' } = useParams();
  const notify = useNotify();
  const [tab, setTab] = useState(0);

  const { data: execution } = useExecution(executionId);
  const reportQuery = useQuery({ queryKey: ['report-by-exec', executionId], queryFn: () => api.executions.report(executionId), enabled: !!executionId, retry: false });
  const logsQuery = useQuery({ queryKey: ['exec-logs', executionId], queryFn: () => api.executions.logs(executionId), enabled: !!executionId && tab === 5 });

  const report = reportQuery.data;
  const e = report?.execution ?? execution;

  if (reportQuery.isLoading) return <InlineLoading description="Loading report" />;
  if (reportQuery.isError || !report || !e) {
    const err = reportQuery.error;
    return (
      <div>
        <PageHeader title="Report" />
        <InlineNotification
          kind={err instanceof ApiError && err.status === 404 ? 'warning' : 'error'}
          lowContrast
          hideCloseButton
          title={err instanceof ApiError && err.status === 404 ? 'No report available' : 'Could not load report'}
          subtitle={err instanceof ApiError && err.status === 404 ? 'This execution has not produced a report. Failed or cancelled runs may have none.' : (err as Error | null)?.message}
        />
        <Link to={`/workspace/${executionId}`}>Open execution</Link>
      </div>
    );
  }

  const bySections = (keys: ReportSection['key'][]) => report.sections.filter((s) => keys.includes(s.key));
  const hasStructure = report.sections.length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.markdown);
      notify.success('Report copied', 'Markdown is on your clipboard.');
    } catch (err) {
      notify.error(err, 'Clipboard unavailable');
    }
  };

  return (
    <div>
      <PageHeader
        title="End-to-End Report"
        subtitle={`${e.repositoryName} · branch ${e.branch} · generated ${formatDate(report.generatedAt)}`}
        actions={
          <div className="row">
            <Button kind="tertiary" size="sm" renderIcon={Copy} onClick={() => void copy()}>
              Copy report
            </Button>
            <Button kind="tertiary" size="sm" renderIcon={Download} as="a" href={api.reports.downloadUrl(report.id, 'markdown')}>
              Markdown
            </Button>
            <Button kind="tertiary" size="sm" renderIcon={Download} as="a" href={api.reports.downloadUrl(report.id, 'pdf')}>
              PDF
            </Button>
            <Button kind="tertiary" size="sm" renderIcon={Download} as="a" href={api.reports.downloadUrl(report.id, 'json')}>
              JSON results
            </Button>
            <Button kind="ghost" size="sm" renderIcon={DocumentExport} onClick={() => setTab(5)}>
              View execution logs
            </Button>
          </div>
        }
      />
      <div className="row section">
        <StatusTag status={e.status} />
        <Tag type={report.source === 'headless-bob-file' ? 'green' : report.source === 'unavailable' ? 'red' : 'blue'}>{SOURCE_LABEL[report.source]}</Tag>
      </div>
      {report.source === 'unavailable' && (
        <InlineNotification kind="warning" lowContrast hideCloseButton title="No report content" subtitle={report.sourceDetail || 'Headless Bob did not produce a report. No findings are shown because none were returned.'} />
      )}
      {report.source === 'headless-bob-output' && (
        <InlineNotification kind="info" lowContrast hideCloseButton title="Report source" subtitle={report.sourceDetail || 'Rendered from Headless Bob’s final answer, because no report file was found in its workspace.'} />
      )}

      <Tabs selectedIndex={tab} onChange={({ selectedIndex }: { selectedIndex: number }) => setTab(selectedIndex)}>
        <TabList aria-label="Report sections" contained>
          <Tab>Executive Summary</Tab>
          <Tab>Findings</Tab>
          <Tab>Recommendations</Tab>
          <Tab>Execution Details</Tab>
          <Tab>Artifacts</Tab>
          <Tab>Logs</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Card>
              {hasStructure ? (
                <Sections sections={bySections(['summary', 'conclusion'])} empty="Headless Bob’s report has no summary or conclusion section. See the Findings tab for the full content." />
              ) : report.bobMarkdown ? (
                <Markdown>{report.bobMarkdown}</Markdown>
              ) : (
                <Tile>No report content was returned by Headless Bob.</Tile>
              )}
            </Card>
          </TabPanel>
          <TabPanel>
            <Card>
              <Sections sections={bySections(['findings', 'other'])} empty="Headless Bob’s report has no section identified as findings." />
            </Card>
          </TabPanel>
          <TabPanel>
            <Card>
              <Sections sections={bySections(['recommendations'])} empty="Headless Bob’s report has no section identified as recommendations." />
            </Card>
          </TabPanel>
          <TabPanel>
            <Card>
              <KeyValues
                rows={[
                  ['Execution ID', <code key="i">{e.id}</code>],
                  ['Status', <StatusTag key="s" status={e.status} size="sm" />],
                  ['Repository', e.repositoryUrl],
                  ['Branch', e.branch],
                  ['Commit', e.commit && <code>{e.commit.slice(0, 12)}</code>],
                  ['QSE CLI version', e.qseVersion],
                  ['Protocol', e.adapter],
                  ['Headless Bob run', e.bobRunId && <code>{e.bobRunId}</code>],
                  ['Started', formatDate(e.startedAt)],
                  ['Completed', formatDate(e.finishedAt)],
                  ['Duration', formatDuration(e.durationMs)],
                  ['Objective', <span key="p" className="pre-wrap">{e.prompt}</span>]
                ]}
              />
              {e.warnings.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  {e.warnings.map((w, i) => (
                    <InlineNotification key={i} kind="warning" lowContrast hideCloseButton title="Warning" subtitle={w} />
                  ))}
                </div>
              )}
              <h4 style={{ margin: '1.5rem 0 0.5rem' }}>Steps</h4>
              <ol className="step-list">
                {e.steps.map((s) => (
                  <li key={s.key}>
                    <span />
                    <div>
                      {s.label} <span className="step-source">({s.source === 'headless-bob' ? 'Headless Bob' : 'backend'})</span>
                      {s.message && <div className="msg">{s.message}</div>}
                    </div>
                    <StatusTag status={s.status} size="sm" />
                  </li>
                ))}
              </ol>
            </Card>
          </TabPanel>
          <TabPanel>
            <Card help="Files found in the Headless Bob workspace. Only retrievable files can be downloaded.">
              {report.artifacts.length === 0 ? (
                <Tile>No artifacts were recorded for this execution.</Tile>
              ) : (
                <ul className="step-list">
                  {report.artifacts.map((a) => (
                    <li key={a.id}>
                      <span />
                      <div>
                        <code>{a.path}</code>
                        <div className="msg">
                          {formatBytes(a.size)} · {a.contentType}
                          {a.note ? ` · ${a.note}` : ''}
                        </div>
                      </div>
                      {a.retrieved ? (
                        <Button kind="ghost" size="sm" renderIcon={Download} as="a" href={api.executions.artifactUrl(e.id, a.id)}>
                          Download
                        </Button>
                      ) : (
                        <Tag size="sm" type="gray">Not retrieved</Tag>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="actions">
                <Button kind="ghost" size="sm" as="a" href={api.reports.exportUrl(report.id)}>
                  Export report with logs (JSON)
                </Button>
              </div>
            </Card>
          </TabPanel>
          <TabPanel>
            <Card>
              {logsQuery.isLoading ? <InlineLoading description="Loading logs" /> : <LogViewer logs={logsQuery.data?.items ?? []} live={false} />}
              <p className="step-source" style={{ marginTop: '0.5rem' }}>
                Secrets are redacted before logs are stored.
              </p>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
}
