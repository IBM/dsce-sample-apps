import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, DataTable, Dropdown, InlineNotification, Pagination, Search, SkeletonText, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent, Tag } from '@carbon/react';
import { useExecutions } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { formatDate, formatDuration } from '../services/format';
import type { ExecutionStatus } from '../types/api';

const STATUS_FILTERS: Array<{ id: ExecutionStatus | ''; label: string }> = [
  { id: '', label: 'All statuses' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'running', label: 'Running' },
  { id: 'queued', label: 'Queued' },
  { id: 'cancelling', label: 'Cancelling' },
  { id: 'cancelled', label: 'Cancelled' }
];

const HEADERS = [
  { key: 'id', header: 'Execution ID', sort: null },
  { key: 'repositoryName', header: 'Repository', sort: 'repositoryName' },
  { key: 'prompt', header: 'Prompt', sort: null },
  { key: 'createdAt', header: 'Date', sort: 'createdAt' },
  { key: 'durationMs', header: 'Duration', sort: 'durationMs' },
  { key: 'status', header: 'Status', sort: 'status' },
  { key: 'report', header: 'Report', sort: null }
] as const;

export function HistoryPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ExecutionStatus | ''>('');
  const [sort, setSort] = useState('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useExecutions({ search, status, sort, direction, page, pageSize });
  const items = data?.items ?? [];

  const rows = items.map((e) => ({
    id: e.id,
    repositoryName: e.repositoryName,
    prompt: e.promptSummary,
    createdAt: e.createdAt,
    durationMs: e.durationMs,
    status: e.status,
    report: e.reportId
  }));

  const toggleSort = (key: string | null) => {
    if (!key) return;
    if (sort === key) setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDirection('desc');
    }
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Execution History" subtitle="Every execution is persisted with its logs and report, so results remain available after you leave the workspace." />
      {isError && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not load history" subtitle={(error as Error).message} />}
      <DataTable rows={rows} headers={HEADERS.map((h) => ({ key: h.key, header: h.header }))} isSortable={false}>
        {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer title="Executions" description={data ? `${data.total} total` : undefined}>
            <TableToolbar aria-label="Execution history filters">
              <TableToolbarContent>
                <Search id="history-search" size="lg" labelText="Search executions" placeholder="Search prompt, repository or ID" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onClear={() => setSearchInput('')} />
                <div style={{ minWidth: '12rem', alignSelf: 'center' }}>
                  <Dropdown
                    id="history-status"
                    titleText=""
                    label="Status"
                    size="lg"
                    items={STATUS_FILTERS}
                    itemToString={(i: (typeof STATUS_FILTERS)[number] | null) => i?.label ?? ''}
                    selectedItem={STATUS_FILTERS.find((s) => s.id === status)}
                    onChange={({ selectedItem }: { selectedItem: (typeof STATUS_FILTERS)[number] | null }) => {
                      setStatus(selectedItem?.id ?? '');
                      setPage(1);
                    }}
                  />
                </div>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((h) => {
                    const meta = HEADERS.find((x) => x.key === h.key)!;
                    const { key: _k, ...hp } = getHeaderProps({ header: h });
                    return (
                      <TableHeader
                        key={h.key}
                        {...hp}
                        isSortable={!!meta.sort}
                        isSortHeader={sort === meta.sort}
                        sortDirection={sort === meta.sort ? (direction === 'asc' ? 'ASC' : 'DESC') : 'NONE'}
                        onClick={() => toggleSort(meta.sort)}
                      >
                        {h.header}
                      </TableHeader>
                    );
                  })}
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={HEADERS.length + 1}>
                      <SkeletonText paragraph lineCount={3} />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && tableRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={HEADERS.length + 1}>No executions match. Start one from the <Link to="/workspace">Execution Workspace</Link>.</TableCell>
                  </TableRow>
                )}
                {tableRows.map((r) => {
                  const e = items.find((x) => x.id === r.id)!;
                  const { key: _rk, ...rp } = getRowProps({ row: r });
                  return (
                    <TableRow key={r.id} {...rp}>
                      <TableCell>
                        <code title={e.id}>{e.id.slice(0, 8)}</code>
                        {e.mock && <Tag size="sm" type="magenta" style={{ marginLeft: 8 }}>DEMO</Tag>}
                      </TableCell>
                      <TableCell>{e.repositoryName}</TableCell>
                      <TableCell style={{ maxWidth: '26rem' }}>
                        <span title={e.prompt}>{e.promptSummary}</span>
                      </TableCell>
                      <TableCell>{formatDate(e.createdAt)}</TableCell>
                      <TableCell>{formatDuration(e.durationMs)}</TableCell>
                      <TableCell>
                        <StatusTag status={e.status} size="sm" />
                      </TableCell>
                      <TableCell>{e.reportId ? <Tag size="sm" type="green">Available</Tag> : <Tag size="sm" type="gray">None</Tag>}</TableCell>
                      <TableCell>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <Button kind="ghost" size="sm" onClick={() => navigate(`/workspace/${e.id}`)}>
                            View execution
                          </Button>
                          <Button kind="ghost" size="sm" disabled={!e.reportId} onClick={() => navigate(`/reports/${e.id}`)}>
                            View report
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              pageSizes={[10, 25, 50]}
              totalItems={data?.total ?? 0}
              onChange={({ page: p, pageSize: ps }: { page: number; pageSize: number }) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
}
