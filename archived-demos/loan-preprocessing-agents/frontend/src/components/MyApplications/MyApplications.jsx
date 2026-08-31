import React, { useState, useEffect, useContext } from 'react';
import Markdown from 'react-markdown'
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Loading,
  InlineNotification,
  Tag
} from '@carbon/react';
import './MyApplications.css';
import { authFetch } from '../../services/api';
import { PanelContext } from '../../App';
import LogViewer from '../LogViewer/LogViewer';

// Define the headers for our table
const headers = [
  { key: 'app_id_str', header: 'Application ID' },
  { key: 'applicant_name', header: 'Applicant Name' },
  { key: 'loan_type', header: 'Loan Type' },
  { key: 'amount', header: 'Amount' },
  { key: 'status', header: 'Status' },
  { key: 'validation_comments', header: 'Validation Comments' },
  { key: 'submitted_date', header: 'Submitted Date' },
];

// A helper function to render status tags with colors
const renderStatusTag = (status) => {
  const displayStatus = status
    ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
    : '';
  switch (status?.toLowerCase()) {
    case 'approved':
      return <Tag type="green">{displayStatus}</Tag>;
    case 'pending':
      return <Tag type="blue">{displayStatus}</Tag>;
    case 'rejected':
      return <Tag type="red">{displayStatus}</Tag>;
    default:
      return <Tag type="gray">{displayStatus}</Tag>;
  }
};

const MyApplications = () => {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setIsPanelOpen, setPanelContent } = useContext(PanelContext);

  const handleRowClick = (rowId) => {
      const application = applications.find(app => app.app_id_str === rowId);
      console.log(rowId);
      console.log(application);
      if (application) {
          setPanelContent(<LogViewer appId={application.app_id_str} onClose={() => setIsPanelOpen(false)} />);
          setIsPanelOpen(true);
      }
  };

  useEffect(() => {
    const fetchApplications = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const response = await authFetch(`${apiUrl}/list_applications`);
            if (!response.ok) {
                throw new Error('Failed to fetch applications.');
            }
            const data = await response.json();
            setApplications(data.map(app => ({
  ...app,
  id: app.app_id_str,
})));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    fetchApplications();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <Loading description="Loading applications..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        title="Failed to load applications"
        subtitle={error || 'Please try again later.'}
      />
    );
  }

  return (
    <div className="applications-container">
      <h1 className="applications-header">My Applications</h1>
      <p>Here is a list of your submitted loan applications.</p>
      <p className="applications-subtitle">You can hover on a row and click to see the detailed steps followed by agents.</p>
      
      <DataTable rows={applications} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    // Destructure the key and the rest of the props
                    const { key, ...rest } = getHeaderProps({ header });
                    return (
                      // Apply the key directly, and spread the rest
                      <TableHeader key={key} {...rest}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  // Destructure the key and the rest of the props for the row
                  const { key, ...rest } = getRowProps({ row });
                    return (
                    <TableRow key={key} {...rest}
                    className="clickable-row"
                    onClick={() => handleRowClick(row.id)}>
                      {row.cells.map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.info.header === 'status'
                        ? renderStatusTag(cell.value)
                        : cell.info.header === 'validation_comments'
                          ? (
                            <Markdown>{cell.value|| ''}</Markdown>
                          )
                          : cell.info.header === 'app_id_str'
                            ?<span style={{color: 'blue', textDecoration: 'underline'}}>{cell.value}</span>
                            : cell.value}
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
    </div>
  );
};

export default MyApplications;