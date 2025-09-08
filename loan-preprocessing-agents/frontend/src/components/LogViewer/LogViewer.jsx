import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Loading, InlineNotification } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { authFetch } from '../../services/api';
import './LogViewer.css';

const LogViewer = ({ appId, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const logContainerRef = useRef(null);

    const fetchLogs = useCallback(async () => {
        if (logContainerRef.current) {
            console.log('Saving scroll position:', logContainerRef.current.scrollTop);
            logContainerRef.current.dataset.scrollTop =
                logContainerRef.current.scrollTop;
        }

        setIsLoading(true);
        setError('');
        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const response = await authFetch(`${apiUrl}/get_logs/${appId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch logs.');
            }
            const data = await response.json();
            const sortedLogs = data.logs.sort((a, b) => a.timestamp - b.timestamp);
            setLogs(sortedLogs);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);

            requestAnimationFrame(() => {
                if (logContainerRef.current?.dataset.scrollTop) {
                    console.log('Restoring scroll position:', logContainerRef.current.dataset.scrollTop);
                    logContainerRef.current.scrollTop =
                        logContainerRef.current.dataset.scrollTop;
                }
            });
        }
    }, [appId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getLogLevelClass = (level) => {
        return `log-level-${level.toLowerCase()}`;
    };

    return (
        <div className="log-viewer-panel">
            {onClose && (
            <Button kind="ghost" size="sm" onClick={onClose}>
                Close
            </Button>
            )}
            <div className="log-viewer-header">
                <h3>Processing Logs for {appId}</h3>
                <Button kind="ghost" size="sm" onClick={fetchLogs} renderIcon={Renew} iconDescription="Refresh Logs">
                    Refresh
                </Button>
            </div>
            <div ref={logContainerRef} className="log-viewer-content">
                {isLoading && <Loading small withOverlay={false} />}
                {error && <InlineNotification kind="error" title="Error" subtitle={error} />}
                {!isLoading && !error && (
                    <pre className="log-list">
                        {logs.map((log, index) => (
                            <div key={index} className="log-entry">
                                <span className="log-timestamp">{log.timestamp}</span>
                                <span className={`log-level ${getLogLevelClass(log.stage)}`}>{log.stage}</span>
                                <span className="log-message">{log.data}</span>
                            </div>
                        ))}
                    </pre>
                )}
            </div>
        </div>
    );
};

export default LogViewer;