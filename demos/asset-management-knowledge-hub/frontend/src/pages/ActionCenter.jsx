import { useState, useMemo, useEffect } from 'react';
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  Search,
  Dropdown,
  Button,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';
import { getActions, subscribeStore } from '../demo/demoStore';
import './ActionCenter.scss';

// ── Carbon Tag type maps ───────────────────────────────────────────────────
const STATUS_TAG_TYPE = {
  'Completed':        'green',
  'In Review':        'blue',
  'In Progress':      'blue',
  'Open':             'cyan',
  'Proposed':         'purple',
  'Accepted':         'green',
  'Rejected':         'red',
  'Draft':            'gray',
  'Running':          'teal',
  'Review Required':  'warm-gray',
  'Closed':           'gray',
};

const PRIORITY_TAG_TYPE = {
  'Critical': 'red',
  'High':     'magenta',
  'Medium':   'blue',
  'Low':      'green',
};

const TAB_TYPES = ['All', 'Investigation', 'Analysis', 'Report', 'Recommendation', 'Task'];

const TABLE_HEADERS = [
  { key: 'title',    header: 'Title'    },
  { key: 'type',     header: 'Type'     },
  { key: 'status',   header: 'Status'   },
  { key: 'priority', header: 'Priority' },
  { key: 'assets',   header: 'Assets'   },
  { key: 'created',  header: 'Created'  },
  { key: 'source',   header: 'Source'   },
];

export default function ActionCenter({ onOpen }) {
  const [activeTab,      setActiveTab]      = useState(0);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState('All statuses');
  const [priorityFilter, setPriorityFilter] = useState('All priorities');
  const [typeFilter,     setTypeFilter]     = useState('All types');
  const [currentPage,    setCurrentPage]    = useState(1);
  const [pageSize,       setPageSize]       = useState(6);

  // Live store — re-render whenever demo mode adds/removes actions
  const [, forceUpdate] = useState(0);
  useEffect(() => subscribeStore(() => forceUpdate(n => n + 1)), []);
  const ACTIONS = getActions();

  const statuses   = ['All statuses',   ...Array.from(new Set(ACTIONS.map(a => a.status)))];
  const priorities = ['All priorities', 'Critical', 'High', 'Medium', 'Low'];
  const types      = ['All types',      ...TAB_TYPES.slice(1)];

  const filteredActions = useMemo(() => {
    const tabType = TAB_TYPES[activeTab];
    return ACTIONS.filter(a => {
      if (tabType !== 'All' && a.type !== tabType) return false;
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        if (!a.title.toLowerCase().includes(t) && !a.description.toLowerCase().includes(t)) return false;
      }
      if (statusFilter   !== 'All statuses'   && a.status   !== statusFilter)   return false;
      if (priorityFilter !== 'All priorities' && a.priority !== priorityFilter) return false;
      if (typeFilter     !== 'All types'      && a.type     !== typeFilter)      return false;
      return true;
    });
  }, [activeTab, searchTerm, statusFilter, priorityFilter, typeFilter, ACTIONS]);

  const totalRecords     = filteredActions.length;
  const startIndex       = (currentPage - 1) * pageSize;
  const paginatedActions = filteredActions.slice(startIndex, startIndex + pageSize);

  function tabCount(i) {
    const t = TAB_TYPES[i];
    return t === 'All' ? ACTIONS.length : ACTIONS.filter(a => a.type === t).length;
  }

  function resetPage() { setCurrentPage(1); }

  const rows = paginatedActions.map(a => ({
    id: a.id, title: a.title, description: a.description,
    type: a.type, status: a.status, priority: a.priority,
    assets: a.assets, created: a.created, source: a.source,
  }));

  return (
    <div className="ac-page">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="ac-header">
        <div className="ac-header__content">
          <h1 className="ac-title">Action Center</h1>
          <p className="ac-subtitle">
            Manage and track AI-generated investigations, analyses, reports, recommendations, and tasks.
          </p>
        </div>
        <div className="ac-header__actions">
          <Button kind="ghost" size="md" renderIcon={Renew} iconDescription="Refresh" hasIconOnly />
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="ac-tabs-wrapper">
        <Tabs
          selectedIndex={activeTab}
          onChange={({ selectedIndex }) => { setActiveTab(selectedIndex); resetPage(); }}
        >
          <TabList aria-label="Action center views" className="ac-tablist">
            <Tab>All ({tabCount(0)})</Tab>
            <Tab>Investigations ({tabCount(1)})</Tab>
            <Tab>Analyses ({tabCount(2)})</Tab>
            <Tab>Reports ({tabCount(3)})</Tab>
            <Tab>Recommendations ({tabCount(4)})</Tab>
            <Tab>Tasks ({tabCount(5)})</Tab>
          </TabList>
          <TabPanels>
            {TAB_TYPES.map(t => <TabPanel key={t} />)}
          </TabPanels>
        </Tabs>

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="ac-toolbar">
          <Search
            size="md"
            placeholder="Search actions…"
            labelText="Search"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); resetPage(); }}
            onClear={() => { setSearchTerm(''); resetPage(); }}
            className="ac-search"
          />
          <Dropdown
            id="filter-status"
            items={statuses}
            itemToString={i => i}
            selectedItem={statusFilter}
            onChange={e => { setStatusFilter(e.selectedItem); resetPage(); }}
            label="All statuses"
            titleText="Status"
            className="ac-dropdown"
          />
          <Dropdown
            id="filter-priority"
            items={priorities}
            itemToString={i => i}
            selectedItem={priorityFilter}
            onChange={e => { setPriorityFilter(e.selectedItem); resetPage(); }}
            label="All priorities"
            titleText="Priority"
            className="ac-dropdown"
          />
          <Dropdown
            id="filter-type"
            items={types}
            itemToString={i => i}
            selectedItem={typeFilter}
            onChange={e => { setTypeFilter(e.selectedItem); resetPage(); }}
            label="All types"
            titleText="Type"
            className="ac-dropdown"
          />
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        {totalRecords === 0 ? (
          <div className="ac-empty-state">
            <h3>No actions found</h3>
            <p>Try adjusting your filters, or start a conversation in the Knowledge Hub to generate actions.</p>
            <Button kind="primary" onClick={() => {}}>Go to Knowledge Hub</Button>
          </div>
        ) : (
          <div className="ac-table-wrapper">
            <DataTable rows={rows} headers={TABLE_HEADERS} isSortable>
              {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
                <Table {...getTableProps()} size="md" useZebraStyles={false}>
                  <TableHead>
                    <TableRow>
                      {tableHeaders.map(header => (
                        <TableHeader key={header.key} {...getHeaderProps({ header })}>
                          {header.header}
                        </TableHeader>
                      ))}
                      <TableHeader className="ac-actions-col">Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row, idx) => {
                      const action = paginatedActions[idx];
                      if (!action) return null;
                      return (
                        <TableRow key={row.id} {...getRowProps({ row })}>
                          {/* Title + description */}
                          <TableCell>
                            <div className="ac-title-cell">
                              <button
                                className="ac-title-link"
                                onClick={() => onOpen && onOpen(action.id)}
                              >
                                {action.actionNumber && (
                                  <span className="ac-action-number">{action.actionNumber}</span>
                                )}
                                {action.title}
                              </button>
                              <span className="ac-title-desc">{action.description}</span>
                            </div>
                          </TableCell>

                          {/* Type */}
                          <TableCell>{action.type}</TableCell>

                          {/* Status — Carbon Tag */}
                          <TableCell>
                            <Tag
                              type={STATUS_TAG_TYPE[action.status] ?? 'gray'}
                              size="sm"
                            >
                              {action.status}
                            </Tag>
                          </TableCell>

                          {/* Priority — Carbon Tag */}
                          <TableCell>
                            <Tag
                              type={PRIORITY_TAG_TYPE[action.priority] ?? 'gray'}
                              size="sm"
                            >
                              {action.priority}
                            </Tag>
                          </TableCell>

                          <TableCell>{action.assets}</TableCell>
                          <TableCell>{action.created}</TableCell>
                          <TableCell>{action.source}</TableCell>

                          {/* Overflow menu */}
                          <TableCell className="ac-menu-cell">
                            <OverflowMenu flipped size="sm" iconDescription="Row actions">
                              <OverflowMenuItem itemText="Open"                    onClick={() => onOpen && onOpen(action.id)} />
                              <OverflowMenuItem itemText="View source conversation" />
                              <OverflowMenuItem itemText="Export" />
                              <OverflowMenuItem itemText="Archive" isDelete />
                            </OverflowMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────── */}
        {totalRecords > 0 && (
          <Pagination
            backwardText="Previous page"
            forwardText="Next page"
            itemsCountInPage={paginatedActions.length}
            onChange={({ page, pageSize: ps }) => {
              setCurrentPage(page);
              if (ps !== pageSize) { setPageSize(ps); setCurrentPage(1); }
            }}
            page={currentPage}
            pageSize={pageSize}
            pageSizes={[6, 10, 15]}
            totalItems={totalRecords}
          />
        )}
      </div>
    </div>
  );
}
