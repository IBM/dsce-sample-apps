import { useState } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Button,
  Select,
  SelectItem,
  Pagination,
} from '@carbon/react';
import './Audit.scss';

// ── Mock data ──────────────────────────────────────────────────────────────────
const ALL_LOGS = Array.from({ length: 52 }, (_, i) => {
  const sources  = ['maximo-live', 'documents', 'web-knowledge', 'all'];
  const users    = ['admin', 'operator1', 'technician', 'auditor'];
  const statuses = ['success', 'success', 'success', 'error', 'partial'];
  const queries  = [
    'What is the status of work order WO-1234?',
    'How to perform PM on pump?',
    'List all active assets',
    'Troubleshoot compressor vibration',
    'Show open service requests',
    'Maintenance procedure for motor',
    'HVAC filter replacement steps',
    'What assets are due for inspection?',
  ];
  return {
    id: `q-${1000 + i}`,
    timestamp: new Date(Date.now() - i * 23 * 60 * 60 * 1000).toISOString(),
    user:          users[i % users.length],
    query:         queries[i % queries.length],
    source:        sources[i % sources.length],
    status:        statuses[i % statuses.length],
    responseTime:  800 + Math.floor(Math.random() * 3200),
    results:       statuses[i % statuses.length] === 'error' ? 0 : 1 + (i % 8),
  };
});

const HEADERS = [
  { key: 'timestamp',    header: 'Timestamp'    },
  { key: 'user',         header: 'User'         },
  { key: 'query',        header: 'Query'        },
  { key: 'source',       header: 'Source'       },
  { key: 'status',       header: 'Status'       },
  { key: 'responseTime', header: 'Response (ms)'},
  { key: 'results',      header: 'Results'      },
];

const SOURCE_TAG = {
  'maximo-live':   { type: 'green',  label: 'Maximo Live' },
  documents:       { type: 'blue',   label: 'Documents'   },
  'web-knowledge': { type: 'purple', label: 'Web'         },
  all:             { type: 'gray',   label: 'All'         },
};

const STATUS_TAG = {
  success: { type: 'green',  label: 'Success' },
  error:   { type: 'red',    label: 'Error'   },
  partial: { type: 'yellow', label: 'Partial' },
};

// ── Export helper ─────────────────────────────────────────────────────────────
function exportCsv(rows) {
  const csv = [
    HEADERS.map(h => h.header).join(','),
    ...rows.map(r =>
      [r.timestamp, r.user, `"${r.query}"`, r.source, r.status, r.responseTime, r.results].join(',')
    ),
  ].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: 'maximo_audit_log.csv',
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Audit() {
  const [search,       setSearch]       = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page,         setPage]         = useState(1);
  const pageSize = 10;

  const filtered = ALL_LOGS.filter(r => {
    const matchSearch  = !search || r.query.toLowerCase().includes(search.toLowerCase()) || r.user.toLowerCase().includes(search.toLowerCase());
    const matchSource  = sourceFilter === 'all' || r.source === sourceFilter;
    const matchStatus  = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchSource && matchStatus;
  });

  const rows = filtered.slice((page - 1) * pageSize, page * pageSize).map(r => ({
    ...r,
    timestamp: new Date(r.timestamp).toLocaleString(),
    source: <Tag type={SOURCE_TAG[r.source]?.type ?? 'gray'} size="sm">{SOURCE_TAG[r.source]?.label ?? r.source}</Tag>,
    status: <Tag type={STATUS_TAG[r.status]?.type ?? 'gray'} size="sm">{STATUS_TAG[r.status]?.label ?? r.status}</Tag>,
    query: <span className="query-cell" title={r.query}>{r.query.length > 60 ? r.query.slice(0, 60) + '…' : r.query}</span>,
  }));

  return (
    <div className="audit-page">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="audit-page-header">
        <div>
          <h2>Audit Log</h2>
          <p>Complete history of all agent queries and system events.</p>
        </div>
        <Button kind="secondary" size="sm" onClick={() => exportCsv(filtered)}>
          Export CSV
        </Button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="filter-row">
        <Select id="src-filter" labelText="Source" size="sm" value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value); setPage(1); }}>
          <SelectItem value="all"           text="All sources"     />
          <SelectItem value="maximo-live"   text="Maximo Live"     />
          <SelectItem value="documents"     text="Documents"       />
          <SelectItem value="web-knowledge" text="Web Knowledge"   />
        </Select>
        <Select id="sts-filter" labelText="Status" size="sm" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <SelectItem value="all"     text="All statuses" />
          <SelectItem value="success" text="Success"      />
          <SelectItem value="error"   text="Error"        />
          <SelectItem value="partial" text="Partial"      />
        </Select>
        <div className="filter-summary">
          <strong>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── DataTable ───────────────────────────────────────────────────── */}
      <DataTable rows={rows} headers={HEADERS} isSortable>
        {({ rows: tRows, headers, getHeaderProps, getRowProps, getTableProps, onInputChange }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search queries or users…"
                  onChange={e => { onInputChange(e); setSearch(e.target.value); setPage(1); }}
                  persistent
                />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} size="sm">
              <TableHead>
                <TableRow>
                  {headers.map(h => (
                    <TableHeader key={h.key} {...getHeaderProps({ header: h })}>
                      {h.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tRows.map(row => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map(cell => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      <Pagination
        totalItems={filtered.length}
        pageSize={pageSize}
        page={page}
        pageSizes={[10, 20, 50]}
        onChange={({ page: p }) => setPage(p)}
      />
    </div>
  );
}
