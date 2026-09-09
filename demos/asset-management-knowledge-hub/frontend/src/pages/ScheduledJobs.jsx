import {
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Button,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import { Play } from '@carbon/icons-react';
import './ScheduledJobs.scss';

const JOBS = [
  {
    id: '1',
    name: 'Nightly Maximo Sync',
    type: 'Synchronization',
    schedule: 'Daily at 1:00 AM',
    lastRun: '2025-07-14 01:00',
    nextRun: '2025-07-15 01:00',
    status: 'Completed',
    duration: '4m 12s',
  },
  {
    id: '2',
    name: 'OEM Knowledge Refresh',
    type: 'Knowledge Update',
    schedule: 'Every 6 hours',
    lastRun: '2025-07-14 06:00',
    nextRun: '2025-07-14 12:00',
    status: 'Scheduled',
    duration: '—',
  },
  {
    id: '3',
    name: 'Search Index Rebuild',
    type: 'Indexing',
    schedule: 'Daily at 3:00 AM',
    lastRun: '2025-07-14 03:00',
    nextRun: '2025-07-15 03:00',
    status: 'Completed',
    duration: '1m 47s',
  },
  {
    id: '4',
    name: 'Reliability Analysis',
    type: 'Analytics',
    schedule: 'Weekly on Sunday',
    lastRun: '2025-07-13 00:00',
    nextRun: '2025-07-20 00:00',
    status: 'Completed',
    duration: '22m 08s',
  },
  {
    id: '5',
    name: 'Scheduled Report: Asset Health',
    type: 'Reporting',
    schedule: 'Daily at 7:00 AM',
    lastRun: '2025-07-14 07:00',
    nextRun: '2025-07-15 07:00',
    status: 'Running',
    duration: '—',
  },
  {
    id: '6',
    name: 'Database Cleanup',
    type: 'Maintenance',
    schedule: 'Weekly on Sunday',
    lastRun: '2025-07-13 02:00',
    nextRun: '2025-07-20 02:00',
    status: 'Failed',
    duration: '0m 43s',
  },
];

const STATUS_TAG_TYPE = {
  Completed: 'green',
  Running:   'blue',
  Scheduled: 'gray',
  Failed:    'red',
};

const HEADERS = [
  { key: 'name',     header: 'Job Name'  },
  { key: 'type',     header: 'Type'      },
  { key: 'schedule', header: 'Schedule'  },
  { key: 'lastRun',  header: 'Last Run'  },
  { key: 'nextRun',  header: 'Next Run'  },
  { key: 'status',   header: 'Status'    },
  { key: 'duration', header: 'Duration'  },
  { key: 'actions',  header: 'Actions'   },
];

const TABS = [
  { label: 'All',       filter: null          },
  { label: 'Scheduled', filter: 'Scheduled'   },
  { label: 'Running',   filter: 'Running'     },
  { label: 'Completed', filter: 'Completed'   },
  { label: 'Failed',    filter: 'Failed'      },
];

function JobsTable({ rows }) {
  return (
    <DataTable rows={rows} headers={HEADERS}>
      {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
        <TableContainer>
          <TableToolbar>
            <TableToolbarContent>
              <TableToolbarSearch
                placeholder="Search jobs…"
                onChange={onInputChange}
              />
              <Button renderIcon={Play} size="sm">Run job</Button>
            </TableToolbarContent>
          </TableToolbar>
          <Table {...getTableProps()} size="lg">
            <TableHead>
              <TableRow>
                {headers.map(h => (
                  <TableHeader
                    key={h.key}
                    {...(h.key !== 'actions' ? getHeaderProps({ header: h }) : {})}
                  >
                    {h.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map(row => (
                <TableRow key={row.id} {...getRowProps({ row })}>
                  {row.cells.map(cell => {
                    if (cell.info.header === 'status') {
                      return (
                        <TableCell key={cell.id}>
                          <Tag type={STATUS_TAG_TYPE[cell.value] || 'gray'} size="sm">
                            {cell.value}
                          </Tag>
                        </TableCell>
                      );
                    }
                    if (cell.info.header === 'actions') {
                      return (
                        <TableCell key={cell.id}>
                          <OverflowMenu size="sm" flipped>
                            <OverflowMenuItem itemText="Run now" />
                            <OverflowMenuItem itemText="Edit schedule" />
                            <OverflowMenuItem itemText="View history" />
                            <OverflowMenuItem itemText="Disable" hasDivider isDelete />
                          </OverflowMenu>
                        </TableCell>
                      );
                    }
                    return <TableCell key={cell.id}>{cell.value}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataTable>
  );
}

export default function ScheduledJobs() {
  return (
    <div className="scheduled-jobs">
      <h1 className="scheduled-jobs__title">Scheduled Jobs</h1>
      <p className="scheduled-jobs__subtitle">
        Manage and monitor recurring background workloads.
      </p>

      <Tabs className="scheduled-jobs__tabs">
        <TabList aria-label="Scheduled jobs filter">
          {TABS.map(t => <Tab key={t.label}>{t.label}</Tab>)}
        </TabList>
        <TabPanels>
          {TABS.map(t => {
            const filtered = t.filter
              ? JOBS.filter(j => j.status === t.filter)
              : JOBS;
            const rows = filtered.map(j => ({ ...j, actions: null }));
            return (
              <TabPanel key={t.label}>
                <JobsTable rows={rows} />
              </TabPanel>
            );
          })}
        </TabPanels>
      </Tabs>
    </div>
  );
}
