import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import PromptInput from './components/PromptInput.jsx';
import ChatToolbar from './components/ChatToolbar.jsx';
import StatusBar from './components/StatusBar.jsx';
import HeadlessBobPanel from './components/HeadlessBobPanel.jsx';
import InsightsDashboard from './components/InsightsDashboard.jsx';
import DigitalTwinPanel from './components/DigitalTwinPanel.jsx';
import { BobMascotIcon } from './components/Icons.jsx';

// Shown until /api/health reports the STREAM_MODE, so a panel never renders
// live-mode labels for a moment before switching to mock (or the reverse).
const ModePending = () => (
  <div role="status" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cds-text-secondary)', fontSize: 13 }}>
    Connecting to the bridge…
  </div>
);

const SUGGESTED_PROMPTS = [
  'Give me the health of "Retail Application"',
  'What is the current erroneous call rate across all services?',
  'Show me erroneous traces for the Retail Application backend service in the last 1 hour',
  'Are there any open incidents for the Retail Application?',
  'Check Kubernetes events for the retail-app namespace',
  'Show me the top 5 slowest endpoints in the Retail Application',
  'What is the P90 latency for the backend service over the last 30 minutes?',
  'Investigate the root cause of any backend service errors',
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBobDiagnosing, setIsBobDiagnosing] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);
  // STREAM_MODE=mock only: scenario injector state (see server/mockRoutes.mjs)
  const [scenarios, setScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [syncVersion, setSyncVersion] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('infrastructure'); // 'infrastructure' | 'dashboard' | 'chat'
  const [showHeadlessBob, setShowHeadlessBob] = useState(true);
  const [activeChatId, setActiveChatId] = useState('default');
  const [chatSessions, setChatSessions] = useState([
    { id: 'default', title: 'New Conversation', timestamp: new Date() },
  ]);

  // Check server health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        setServerStatus(data);
        if (data.streamMode === 'mock') {
          setActiveScenarioId(data.isLoaded ? data.activeScenario : null);
          fetch('/api/scenarios')
            .then((r) => r.json())
            .then((d) => setScenarios(d.scenarios ?? []))
            .catch(() => setScenarios([]));
        }
      })
      .catch(() => setServerStatus({ status: 'error', mcpConnected: false }));
  }, []);

  const isMock = serverStatus?.streamMode === 'mock';

  const handleSelectScenario = useCallback(async (scenarioId) => {
    try {
      const r = await fetch('/api/demo/load-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setActiveScenarioId(scenarioId);
      setSyncVersion((v) => v + 1);
    } catch (e) {
      console.error('[Scenario] load failed:', e.message);
    }
  }, []);

  const handleResetData = useCallback(async () => {
    try {
      const r = await fetch('/api/demo/reset-data', { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setActiveScenarioId(null);
      setSyncVersion((v) => v + 1);
    } catch (e) {
      console.error('[Scenario] reset failed:', e.message);
    }
  }, []);

  const mockControls = isMock
    ? { scenarios, activeScenarioId, onSelect: handleSelectScenario, onReset: handleResetData }
    : null;

  const handleAutonomousAlert = useCallback((alert) => {
    if (alert.scenarioId) {
      setActiveScenarioId(alert.scenarioId);
      setSyncVersion((v) => v + 1);
    }
    let alertContent = alert.message || '';
    // Strip machine-readable sentinel block if present
    alertContent = alertContent.replace(/\{[^{}]*"severity"\s*:\s*"[^"]*"[^{}]*\}\s*$/m, '').trim();

    const alertMsg = {
      id: alert.ts ? `alert-${alert.ts}` : `alert-${Date.now()}`,
      role: 'assistant',
      isHeadlessBob: true,
      isAutonomousAlert: true,
      severity: alert.severity || 'critical',
      errorRate: alert.errorRate,
      p90Latency: alert.p90Latency,
      hasOpenIncidents: alert.hasOpenIncidents,
      content: alertContent,
      timestamp: new Date(alert.ts || Date.now()),
    };

    setMessages((prev) => {
      // Prevent duplicate messages if already present
      if (prev.some((m) => m.id === alertMsg.id)) return prev;
      return [...prev, alertMsg];
    });
  }, []);

  const sendPrompt = async (promptText) => {
    if (!promptText.trim() || isLoading) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Update chat session title from first message
    if (messages.length === 0) {
      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === activeChatId
            ? { ...s, title: promptText.slice(0, 45) + (promptText.length > 45 ? '…' : '') }
            : s
        )
      );
    }

    try {
      // Keep only the last 20 messages to avoid 413 payload errors
      const trimmedHistory = conversationHistory.slice(-20);

      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, conversationHistory: trimmedHistory }),
      });

      // Guard: if response is not JSON (e.g. Cloudflare HTML error), surface a clean error
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`);
      }

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Server error');

      // 1. Instana Assistant response (Telemetry & health report via MCP)
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        isHeadlessBob: false,
        content: data.answer,
        toolCalls: data.toolCalls || [],
        iterations: data.iterations,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setConversationHistory(data.conversationHistory || []);
      setIsLoading(false);

      // 2. Headless Bob RCA Trigger (ONLY if critical issues or alerts were detected)
      if (data.criticalIssue?.detected) {
        setIsBobDiagnosing(true);
        try {
          const rcaRes = await fetch('/api/headlessbob/diagnose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: promptText,
              instanaAnswer: data.answer,
              issueSummary: data.criticalIssue.summary || 'Critical issue detected',
            }),
          });
          const rcaData = await rcaRes.json();
          if (rcaRes.ok && rcaData.rca) {
            const bobMsg = {
              id: Date.now() + 2,
              role: 'assistant',
              isHeadlessBob: true,
              content: rcaData.rca,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, bobMsg]);
          }
        } catch (e) {
          console.error('[HeadlessBob RCA Trigger] Error:', e);
        } finally {
          setIsBobDiagnosing(false);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'error',
          content: `Error: ${err.message}`,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const askBobInChat = (q) => {
    setActiveView('chat');
    sendPrompt(q);
  };

  const newChat = () => {
    const id = `chat-${Date.now()}`;
    setChatSessions((prev) => [
      { id, title: 'New Conversation', timestamp: new Date() },
      ...prev,
    ]);
    setActiveChatId(id);
    setMessages([]);
    setConversationHistory([]);
  };

  const clearChat = () => {
    setMessages([]);
    setConversationHistory([]);
    setChatSessions((prev) => prev.map((x) => (x.id === activeChatId ? { ...x, title: 'New Conversation' } : x)));
  };

  const selectChat = (id) => {
    setActiveChatId(id);
    // In a full implementation, messages would be loaded per session
    // For this demo, switching resets — extend with localStorage for persistence
    setMessages([]);
    setConversationHistory([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        serverStatus={serverStatus}
        activeView={activeView}
        showHeadlessBob={showHeadlessBob}
        onToggleHeadlessBob={() => setShowHeadlessBob((s) => !s)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {sidebarOpen && (
          <Sidebar
            chatSessions={chatSessions}
            activeChatId={activeChatId}
            onNewChat={newChat}
            onSelectChat={selectChat}
            suggestedPrompts={SUGGESTED_PROMPTS}
            onSelectPrompt={askBobInChat}
          />
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--cds-background)',
          }}
        >
          {/* ── Tab bar ── */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--cds-border-subtle-01)',
            background: 'var(--cds-layer-01)',
            flexShrink: 0,
          }}>
            {[
              { id: 'infrastructure', label: '☸️ Infrastructure Insights' },
              { id: 'dashboard',      label: '📊 Application Insights Dashboard' },
              { id: 'chat',           label: '🤖 Autonomous SRE Chat' },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveView(tab.id)} style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: activeView === tab.id ? '2px solid #0f62fe' : '2px solid transparent',
                background: 'none',
                color: activeView === tab.id ? '#0f62fe' : 'var(--cds-text-secondary)',
                fontWeight: activeView === tab.id ? 600 : 400,
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>
                {tab.label}
              </button>
            ))}

            {/* Headless Bob panel switch (chat view only) */}
            {activeView === 'chat' && (
              <button
                type="button"
                role="switch"
                aria-checked={showHeadlessBob}
                onClick={() => setShowHeadlessBob((s) => !s)}
                title="Toggle Headless Bob SRE panel"
                style={{
                  marginLeft: 'auto', marginRight: 14, alignSelf: 'center',
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px',
                  borderRadius: 4, border: '1px solid var(--cds-border-subtle-01)',
                  background: 'var(--cds-layer-02)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13 }} aria-hidden="true">🤖</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: showHeadlessBob ? '#78a9ff' : 'var(--cds-text-secondary)' }}>
                  Headless Bob
                </span>
                <span style={{
                  width: 32, height: 18, borderRadius: 9, position: 'relative', display: 'inline-block',
                  background: showHeadlessBob ? '#0f62fe' : '#393939',
                  border: showHeadlessBob ? '1px solid #0f62fe' : '1px solid #525252',
                  transition: 'background 0.2s',
                }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute',
                    top: 2, left: showHeadlessBob ? 16 : 2, transition: 'left 0.2s',
                  }} />
                </span>
              </button>
            )}
          </div>

          {/* ── 1. Infrastructure Insights (live digital twin) ── */}
          <div style={{
            display: activeView === 'infrastructure' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
          }}>
            {serverStatus ? <DigitalTwinPanel onAskBob={askBobInChat} mock={mockControls} syncVersion={syncVersion} /> : <ModePending />}
          </div>

          {/* ── 2. Application Insights Dashboard ── */}
          <div style={{
            display: activeView === 'dashboard' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
          }}>
            {serverStatus ? <InsightsDashboard onAskBob={askBobInChat} mock={mockControls} syncVersion={syncVersion} /> : <ModePending />}
          </div>

          {/* ── 3. Autonomous SRE Chat (Headless Bob column on the left) ── */}
          <div style={{
            display: activeView === 'chat' ? 'flex' : 'none',
            flexDirection: 'row',
            flex: 1,
            overflow: 'hidden',
          }}>
            {showHeadlessBob ? (
              <div style={{
                width: 350, minWidth: 320, maxWidth: 420,
                borderRight: '1px solid var(--cds-border-subtle-01)',
                display: 'flex', flexDirection: 'column',
                background: 'var(--cds-layer-01)', overflow: 'hidden', flexShrink: 0,
              }}>
                <HeadlessBobPanel
                  streamMode={serverStatus?.streamMode ?? null}
                  onAutonomousAlert={handleAutonomousAlert}
                  onInvestigateAlert={(prompt) => sendPrompt(prompt)}
                  onContract={() => setShowHeadlessBob(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowHeadlessBob(true)}
                title="Expand Headless Bob SRE panel"
                aria-label="Expand Headless Bob SRE panel"
                style={{
                  width: 46, border: 'none', borderRight: '1px solid var(--cds-border-subtle-01)',
                  background: 'var(--cds-layer-01)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', padding: '10px 0', cursor: 'pointer', flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: '50%', marginBottom: 10, overflow: 'hidden',
                  background: 'linear-gradient(135deg, #0f62fe 0%, #002d9c 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(15, 98, 254, 0.4)',
                }}>
                  <BobMascotIcon size={24} />
                </span>
                <span style={{
                  writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                  color: 'var(--cds-text-secondary)', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Headless Bob SRE
                </span>
              </button>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
              <ChatToolbar
                messageCount={messages.length}
                busy={isLoading || isBobDiagnosing}
                onClear={clearChat}
              />
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                isBobDiagnosing={isBobDiagnosing}
                onSuggestedPrompt={sendPrompt}
                onInvestigate={sendPrompt}
                hasMessages={messages.length > 0}
                suggestedPrompts={SUGGESTED_PROMPTS.slice(0, 4)}
              />
              <PromptInput onSubmit={sendPrompt} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>

      <StatusBar serverStatus={serverStatus} messageCount={messages.length} />
    </div>
  );
}
