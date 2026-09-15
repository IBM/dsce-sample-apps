/**
 * IncidentBoard.jsx
 * Full-page component: IBM Carbon Header + Kanban board + drawers.
 * Features:
 *  - Auto-generate interval control (Off / 5s / 15s / 30s / 1min)
 *  - Incident Detail Drawer (click card or "Details")
 *  - Analysis Drawer (click "Analyze")
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  InlineNotification,
  Button,
  Tag,
  Loading,
  Select,
  SelectItem,
} from '@carbon/react';
import { Add, Settings } from '@carbon/icons-react';

import IncidentCard from '../components/IncidentCard';
import AnalysisDrawer from '../components/AnalysisDrawer';
import IncidentDetailDrawer from '../components/IncidentDetailDrawer';
import KpiBar from '../components/KpiBar';
import { getIncidents, generateIncident, analyzeIncident, chatWithAgent } from '../services/api';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

const COLUMN_CONFIG = {
  Critical: { label: 'Critical', tagType: 'red',       icon: '🔴' },
  High:     { label: 'High',     tagType: 'orange',     icon: '🟠' },
  Medium:   { label: 'Medium',   tagType: 'warm-gray',  icon: '🟡' },
  Low:      { label: 'Low',      tagType: 'green',      icon: '🟢' },
};

// Auto-generate interval options
const INTERVAL_OPTIONS = [
  { value: '0',     label: 'Off' },
  { value: '5',     label: 'Every 5 sec' },
  { value: '15',    label: 'Every 15 sec' },
  { value: '30',    label: 'Every 30 sec' },
  { value: '60',    label: 'Every 1 min' },
];

export default function IncidentBoard({ onOpenAdmin, controlsActive = false, boardResetKey = 0 }) {
  // ── Incident data ──────────────────────────────────────────────────────────
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // ── Auto-generate interval ─────────────────────────────────────────────────
  const [intervalSecs, setIntervalSecs] = useState('0');
  const [isPulsing, setIsPulsing] = useState(false);
  const intervalRef = useRef(null);

  // ── Per-incident chat history (persists across drawer open/close) ──────────
  // Map<incidentId, Array<{role: 'user'|'agent', content: string}>>
  const chatHistoriesRef = useRef({});

  // ── Detail drawer state ────────────────────────────────────────────────────
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailIncident, setDetailIncident] = useState(null);

  // ── Analysis drawer state ──────────────────────────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  // ── Load incidents on mount (and when boardResetKey changes) ──────────────
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const data = await getIncidents();
        setIncidents(data);
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [boardResetKey]);

  // ── Create a new random incident ──────────────────────────────────────────
  const handleCreateIncident = useCallback(async () => {
    setIsCreating(true);
    try {
      const newIncident = await generateIncident();
      setIncidents((prev) => [newIncident, ...prev]);
      // Brief pulse on the interval badge
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 600);
    } catch (e) {
      setLoadError(`Failed to create incident: ${e.message}`);
    } finally {
      setIsCreating(false);
    }
  }, []);

  // ── Auto-generate interval wiring ─────────────────────────────────────────
  useEffect(() => {
    // Clear any existing timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const secs = parseInt(intervalSecs, 10);
    if (secs > 0) {
      intervalRef.current = setInterval(() => {
        handleCreateIncident();
      }, secs * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [intervalSecs, handleCreateIncident]);

  // ── Open detail drawer ────────────────────────────────────────────────────
  const handleViewDetails = useCallback((incident) => {
    setDetailIncident(incident);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setDetailIncident(null);
  }, []);

  // ── Helper: update a single incident's status in local store ─────────────
  const updateIncidentStatus = useCallback((id, status) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status } : i))
    );
  }, []);

  // ── Open analysis drawer and trigger analysis ─────────────────────────────
  const handleAnalyze = useCallback(async (incident) => {
    // Feature D: advance timeline to "Analyzing"
    updateIncidentStatus(incident.id, 'Analyzing');

    setSelectedIncident({ ...incident, status: 'Analyzing' });
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsAnalyzing(true);
    setIsDrawerOpen(true);

    try {
      const result = await analyzeIncident(incident.id);
      setAnalysisResult(result);
      // Feature D: advance timeline to "In Progress" once result is back
      updateIncidentStatus(incident.id, 'In Progress');
    } catch (e) {
      setAnalysisError(e.message);
      // Revert on error
      updateIncidentStatus(incident.id, incident.status);
    } finally {
      setIsAnalyzing(false);
    }
  }, [updateIncidentStatus]);

  // ── Close analysis drawer ─────────────────────────────────────────────────
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedIncident(null);
    setAnalysisResult(null);
    setAnalysisError(null);
  }, []);

  // ── Mark incident resolved ────────────────────────────────────────────────
  const handleResolve = useCallback((incidentId) => {
    updateIncidentStatus(incidentId, 'Resolved');
    setSelectedIncident((prev) => prev ? { ...prev, status: 'Resolved' } : prev);
  }, [updateIncidentStatus]);

  // ── Chat: send message, persist history per incident ─────────────────────
  const handleSendChat = useCallback(async (incidentId, message, currentHistory) => {
    // Return a new history array with the user message + agent reply appended
    // The drawer owns local isSending state; we just do the fetch + return reply
    try {
      const { reply } = await chatWithAgent(
        incidentId,
        message,
        currentHistory,
        analysisResult,
      );
      const updated = [
        ...currentHistory,
        { role: 'user',  content: message },
        { role: 'agent', content: reply   },
      ];
      // Persist to ref so history survives drawer close/reopen
      chatHistoriesRef.current[incidentId] = updated;
      return { reply, updatedHistory: updated };
    } catch (e) {
      throw e;
    }
  }, [analysisResult]);

  // ── Get persisted chat history for an incident ────────────────────────────
  const getChatHistory = useCallback((incidentId) => {
    return chatHistoriesRef.current[incidentId] || [];
  }, []);

  // ── Group incidents by severity ───────────────────────────────────────────
  const grouped = SEVERITIES.reduce((acc, sev) => {
    acc[sev] = incidents.filter((i) => i.severity === sev);
    return acc;
  }, {});

  const isAutoActive = intervalSecs !== '0';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* ── IBM Carbon Header ── */}
      <Header aria-label="SRE Copilot">
        <HeaderName href="#" prefix="IBM watsonx">
          SRE Copilot
        </HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label={isCreating ? 'Creating incident…' : 'Create Incident'}
            tooltipAlignment="end"
            onClick={handleCreateIncident}
            disabled={isCreating}
          >
            <Add size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label="Admin Panel"
            tooltipAlignment="end"
            onClick={onOpenAdmin}
          >
            <Settings size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      {/* ── KPI summary bar (Feature A) ── */}
      {!isLoading && <KpiBar incidents={incidents} controlsActive={controlsActive} />}

      {/* ── Page content ── */}
      <main className="incident-board">
        {/* Toolbar row */}
        <div className="incident-board__toolbar">
          <div className="incident-board__toolbar-left">
            <h2 className="incident-board__page-title">Incident Board</h2>
            <span className="incident-board__total">
              {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Right side: auto-generate control + create button */}
          <div className="incident-board__toolbar-right">
            {/* Auto-generate interval selector */}
            <div className="autogen-control">
              <span className={`autogen-control__dot ${isAutoActive ? 'autogen-control__dot--active' : ''} ${isPulsing ? 'autogen-control__dot--pulse' : ''}`} />
              <span className="autogen-control__label">Auto-generate:</span>
              <Select
                id="autogen-interval"
                labelText=""
                hideLabel
                value={intervalSecs}
                onChange={(e) => setIntervalSecs(e.target.value)}
                size="sm"
                className="autogen-control__select"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                ))}
              </Select>
            </div>

            <Button
              kind="primary"
              size="md"
              renderIcon={Add}
              onClick={handleCreateIncident}
              disabled={isCreating}
            >
              {isCreating ? 'Creating…' : 'Create Incident'}
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {loadError && (
          <InlineNotification
            kind="error"
            title="Error — "
            subtitle={loadError}
            onCloseButtonClick={() => setLoadError(null)}
            className="incident-board__error"
          />
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="incident-board__loading">
            <Loading description="Loading incidents…" withOverlay={false} />
          </div>
        )}

        {/* Kanban columns */}
        {!isLoading && (
          <div className="kanban-grid">
            {SEVERITIES.map((sev) => {
              const { label, tagType, icon } = COLUMN_CONFIG[sev];
              const col = grouped[sev] || [];
              return (
                <div
                  key={sev}
                  className={`kanban-column kanban-column--${sev.toLowerCase()}`}
                >
                  {/* Column header */}
                  <div className="kanban-column__header">
                    <div className="kanban-column__header-left">
                      <span className="kanban-column__icon">{icon}</span>
                      <span className="kanban-column__label">{label}</span>
                    </div>
                    <Tag
                      type={tagType}
                      size="sm"
                      className="kanban-column__count"
                    >
                      {col.length}
                    </Tag>
                  </div>

                  {/* Incident cards */}
                  <div className="kanban-column__cards">
                    {col.length === 0 ? (
                      <p className="kanban-column__empty">No incidents</p>
                    ) : (
                      col.map((incident) => (
                        <IncidentCard
                          key={incident.id}
                          incident={incident}
                          onAnalyze={handleAnalyze}
                          onViewDetails={handleViewDetails}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Incident Detail Drawer ── */}
      <IncidentDetailDrawer
        isOpen={isDetailOpen}
        incident={detailIncident}
        onClose={handleCloseDetail}
        onAnalyze={handleAnalyze}
      />

      {/* ── Analysis Drawer ── */}
      <AnalysisDrawer
        isOpen={isDrawerOpen}
        incident={selectedIncident}
        analysisResult={analysisResult}
        isAnalyzing={isAnalyzing}
        error={analysisError}
        onClose={handleCloseDrawer}
        onResolve={handleResolve}
        onSendChat={handleSendChat}
        initialChatHistory={selectedIncident ? getChatHistory(selectedIncident.id) : []}
      />
    </div>
  );
}
