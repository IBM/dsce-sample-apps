// ui/src/pages/AvlLiveTab.tsx
// AVL Live tab — Approved Vendor Intelligence Agent
//
// Spec: specs/WXO_AGENT_UI_INTEGRATION_SPEC_UPDATED.md
//
// UI display name : "Approved Vendor Intelligence Agent"   (spec §3.1)
// Short label     : "AVL Agent"                            (spec §3.1)
// Internal name   : crag_rag_agent_v1                      (NEVER shown in UI)
//
// Flow (production — all WXO calls proxied through backend):
//   Send msg  → sendCragAndWait()  → POST /api/agent/crag/chat (backend)
//                                     backend calls WXO; response.thread_id saved for follow-ups
//   Follow-up → same call + threadId arg; backend passes X-IBM-THREAD-ID to WXO
//   New chat  → reset local state; next send creates a new thread automatically
//   History   → session-local only (IBM Cloud has no GET /v1/threads API)
//   Rename    → local state only   (no-op against WXO)
//   Delete    → local state only   (no-op against WXO)
//
// Zero changes to the Ask / Today / Patterns / My Board tabs.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { InlineNotification } from '@carbon/react';
import {
  sendCragAndWait,
  listCragThreads,
  renameThread,
  deleteThread,
  wxoConfigured,
  WxoError,
  type WxoThread,
} from '../api/wxo';
import {
  type ChatMessage,
  type ProgressStep,
  matchStubAnswer,
  AgentNameBlock,
  AgentProgressTracker,
  RichAnswer,
  SendArrow,
} from './AgentPage';
import { EvidenceBlock } from '../components/shared/EvidenceBlock';

// ── Spec §17: starter prompts (supply.approved_vendor.changed only) ───────────
const AVL_STARTER_PROMPTS: string[] = [
  // Current state
  'What is the current AVL approval status for each supplier of CVA-8842?',
  'Which suppliers are currently approved to supply material CVA-8842?',

  // January AVL review — Events 1 & 2
  'Which suppliers were re-qualified in the January 2026 annual AVL review?',
  'Who is the primary approved supplier for CVA-8842?',

  // Emergency fast-track — Event 3
  'Who was approved as the emergency tertiary supplier for CVA-8842, and why?',
  'Who authorised the fast-track emergency approval for SUP-205?',

  // Suspension — Event 4
  'Which suppliers are currently suspended in the AVL stream?',
  'Why was SUP-205 suspended after its emergency approval?',

  // Reinstatement — Event 5
  'Has SUP-205 been reinstated? Show the full compliance hold timeline.',

  // Full history & correlation trace
  'Show the complete AVL event history for SUP-205 and CVA-8842 in order.',
  'Trace all AVL events for correlation ID DEMO-TW2047-001.',

  // Live refresh
  'Refresh the live approved-vendor context now and tell me what changed.',
];

// ── History sidebar entry ─────────────────────────────────────────────────────
interface HistoryItem {
  id: string;
  title: string;
  updatedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 2)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AvlLiveTab: React.FC = () => {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    wxoConfigured().then(setIsLive).catch(() => setIsLive(false));
  }, []);

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages,  setMessages]  = useState<ChatMessage[]>([{
    id: 'avl-welcome',
    role: 'agent',
    agentLabel: 'CRAG_RAG_AGENT_V1',
    text: 'Initialising agent connection…',
  }]);

  // Update welcome message once we know whether WXO is live
  useEffect(() => {
    setMessages(prev => {
      const first = prev[0];
      if (!first || first.id !== 'avl-welcome') return prev;
      return [
        {
          ...first,
          text: isLive
            ? 'Hi! I\'m your **Vendor Intelligence Agent**\n\nI can help you stay on top of your supplier approvals in real time. Want to know:\n\n- Which vendors are currently approved for **CVA-8842**?\n- Has any supplier been suspended or reinstated recently?\n- What\'s the full approval history for a specific supplier?\n\nJust ask — I\'ll fetch the latest data straight from the live Confluent event stream.'
            : 'Hi! I\'m your **Vendor Intelligence Agent**\n\nI can help you track supplier approvals, suspensions, and reinstatements for your turnaround materials. Try asking:\n\n- *"Which suppliers are approved for CVA-8842?"*\n- *"What happened to SUP-205 between August and September?"*\n- *"Show me the full vendor history for this material."*\n\n*(Running in demo mode — configure WXO credentials on the backend to go live.)*',
        },
        ...prev.slice(1),
      ];
    });
  }, [isLive]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [threadId,  setThreadId]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── History sidebar state ───────────────────────────────────────────────────
  const [history,       setHistory]       = useState<HistoryItem[]>([]);
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [historyBusy,   setHistoryBusy]   = useState(false);
  const [renamingId,    setRenamingId]    = useState<string | null>(null);
  const [renameText,    setRenameText]    = useState('');

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load history when going live
  useEffect(() => {
    if (!isLive) return;
    void refreshHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // ── History helpers ─────────────────────────────────────────────────────────

  const refreshHistory = useCallback(async () => {
    if (!isLive) return;
    setHistoryBusy(true);
    try {
      const threads = await listCragThreads(30);
      setHistory(threads.map(t => ({
        id: t.id,
        title: (t as unknown as Record<string, string>).title ?? 'Untitled',
        updatedAt: (t as unknown as Record<string, string>).updated_at
          ?? (t as unknown as Record<string, string>).created_on ?? undefined,
      })));
    } catch {
      // history is best-effort — don't block the chat
    } finally {
      setHistoryBusy(false);
    }
  }, [isLive]);

  const handleNewChat = useCallback(() => {
    // IBM Cloud: thread is created implicitly by the first sendCragAndWait call.
    // No pre-creation needed — just reset local state.
    setMessages([welcomeMsg()]);
    setThreadId(null);
    setError(null);
    setInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  const handleOpenThread = useCallback(async (item: HistoryItem) => {
    if (item.id === threadId) return;
    setThreadId(item.id);
    setMessages([welcomeMsg(), {
      id: `load-${item.id}`,
      role: 'system',
      text: `Loaded chat: "${item.title}"`,
    }]);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const handleRenameCommit = useCallback(async (id: string) => {
    const title = renameText.trim();
    if (!title) { setRenamingId(null); return; }
    try {
      if (isLive) await renameThread(id, title);
      setHistory(prev => prev.map(h => h.id === id ? { ...h, title } : h));
    } catch {/* silent */}
    setRenamingId(null);
  }, [isLive, renameText]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      if (isLive) await deleteThread(id);
      setHistory(prev => prev.filter(h => h.id !== id));
      if (threadId === id) {
        setThreadId(null);
        setMessages([welcomeMsg()]);
      }
    } catch {/* silent */}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, threadId]);

  // ── Send message ─────────────────────────────────────────────────────────────

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setInput('');
    setLoading(true);

    const uid = `avl-u-${Date.now()}`;
    const pid = `avl-a-${Date.now() + 1}`;

    const steps: ProgressStep[] = [
      { label: 'Routing to Vendor Intelligence Agent…', done: false },
      { label: 'Calling getMetadata on supply.approved_vendor.changed', done: false },
      { label: 'Calling queryData — reading RTCE rows…', done: false },
      { label: 'Composing answer from live evidence…', done: false },
    ];

    setMessages(prev => [
      ...prev,
      { id: uid, role: 'user', text: t },
      { id: pid, role: 'agent', agentLabel: 'CRAG_RAG_AGENT_V1', text: '…', progressSteps: steps },
    ]);

    if (isLive) {
      // ── Live path: WXO chat/completions (spec §9) ───────────────────────────
      // IBM Cloud: thread_id is returned by sendCragAndWait; no pre-creation needed.
      // Pass the existing threadId (if any) so WXO continues the same conversation.
      try {
        // Tick progress steps while WXO processes
        for (let i = 0; i < steps.length - 1; i++) {
          await new Promise<void>(r => setTimeout(r, 700 + Math.floor(Math.random() * 600)));
          setCragStepDone(pid, i);
        }
        const result = await sendCragAndWait(t, threadId ?? undefined);
        // WXO returns the thread_id; save it for subsequent turns
        if (result.threadId) {
          const isNewThread = !threadId;
          setThreadId(result.threadId);
          if (isNewThread) {
            setHistory(prev => [{
              id: result.threadId,
              title: t.slice(0, 60) || 'Approved Vendor Investigation',
              updatedAt: new Date().toISOString(),
            }, ...prev]);
          }
        }
        setMessages(prev => prev.map(m => m.id === pid
          ? { ...m, text: result.text, toolCalls: result.toolCalls, progressSteps: undefined }
          : m));
      } catch (err) {
        const msg = err instanceof WxoError ? err.message : 'Approved Vendor Intelligence Agent unavailable';
        setMessages(prev => prev.map(m => m.id === pid
          ? { ...m, role: 'error' as const, text: `❌ ${msg}`, progressSteps: undefined }
          : m));
        setError(msg);
      }
    } else {
      // ── Stub path ───────────────────────────────────────────────────────────
      for (let i = 0; i < steps.length - 1; i++) {
        await new Promise<void>(r => setTimeout(r, 500 + Math.floor(Math.random() * 500)));
        setCragStepDone(pid, i);
      }
      const stub = matchStubAnswer(t);
      if (stub) {
        setMessages(prev => prev.map(m => m.id === pid
          ? { ...m, agentLabel: stub.agentLabel, text: stub.answer, evidence: stub.evidence,
              grounded: true, confidence: stub.confidence, progressSteps: undefined }
          : m));
      } else {
        setMessages(prev => prev.map(m => m.id === pid
          ? { ...m,
              text: 'No matching demo answer for that query.\n\nIn live mode this would query the Confluent RTCE `supply.approved_vendor.changed` topic via watsonx Orchestrate.\n\nTry one of the starter prompts above.',
              progressSteps: undefined }
          : m));
      }
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, threadId, isLive]);

  // Helper: tick a progress step done for the pending message
  function setCragStepDone(pid: string, i: number) {
    setMessages(prev => prev.map(m => {
      if (m.id !== pid || !m.progressSteps) return m;
      return { ...m, progressSteps: m.progressSteps.map((s, si) => si <= i ? { ...s, done: true } : s) };
    }));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="tsci-crag-panel">

      {/* ── Error banner (spec §20) ──────────────────────────────────────────── */}
      {error && (
        <InlineNotification
          kind="error"
          title="Vendor Intelligence Agent error"
          subtitle={error}
          onClose={() => setError(null)}
          className="tsci-agent-notification"
        />
      )}

      {/* ── Header banner ────────────────────────────────────────────────────── */}
      <div className="tsci-crag-header">
        <div className="tsci-crag-header-left">
          {/* Confluent / cycle icon */}
          <svg viewBox="0 0 24 24" fill="#22d3ee" width="18" height="18" style={{ flexShrink: 0 }}>
            <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5v-5l-2.28 2.28C7.81 18 6 15.21 6 12c0-4.08 3.05-7.44 7-7.93V2.05z"/>
          </svg>
          <div>
            {/* Spec §3.1: UI display name — never show internal agent name */}
            <div className="tsci-crag-header-title">Vendor Intelligence Agent</div>
          </div>
        </div>
        <div className="tsci-crag-header-right">
          <div className="bob-wxo-pill" data-live={isLive} style={{ fontSize: '11px' }}>
            <span className="bob-wxo-dot" />
            {isLive ? 'wxO Live · RTCE' : 'Stub mode'}
          </div>
          <button className="tsci-crag-new-btn" onClick={handleNewChat} title="New chat">
            + New chat
          </button>
        </div>
      </div>

      {/* ── Starter prompts (spec §17) ────────────────────────────────────────── */}
      <div className="tsci-crag-prompts">
        {AVL_STARTER_PROMPTS.slice(0, 5).map(p => (
          <button key={p} className="tsci-crag-prompt-chip"
            onClick={() => send(p)} disabled={loading}>
            {p}
          </button>
        ))}
      </div>

      {/* ── Main body: sidebar + toggle + chat ───────────────────────────────── */}
      <div className="tsci-crag-body">

        {/* ── History sidebar — always in DOM, collapsed class hides content ─── */}
        <div className={`tsci-crag-sidebar${historyOpen ? '' : ' collapsed'}`}>
          <div className="tsci-crag-sidebar-header">
            <span>CHATS</span>
            {historyBusy && <span className="tsci-crag-sidebar-spinner" />}
            <button className="tsci-crag-sidebar-refresh" onClick={refreshHistory}
              title="Refresh history" disabled={historyBusy}>↻</button>
          </div>
          {history.length === 0 && !historyBusy && (
            <div className="tsci-crag-sidebar-empty">
              {isLive ? 'No chats yet.' : 'Session history\nwill appear here.'}
            </div>
          )}
          <div className="tsci-crag-sidebar-list">
            {history.map(item => (
              <div key={item.id}
                className={`tsci-crag-sidebar-item${item.id === threadId ? ' active' : ''}`}>
                {renamingId === item.id ? (
                  <input
                    className="tsci-crag-sidebar-rename-input"
                    value={renameText}
                    onChange={e => setRenameText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleRenameCommit(item.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => void handleRenameCommit(item.id)}
                    autoFocus
                  />
                ) : (
                  <button className="tsci-crag-sidebar-title"
                    onClick={() => void handleOpenThread(item)}>
                    <span className="tsci-crag-sidebar-title-text">{item.title}</span>
                    {item.updatedAt && (
                      <span className="tsci-crag-sidebar-ago">{relativeTime(item.updatedAt)}</span>
                    )}
                  </button>
                )}
                <div className="tsci-crag-sidebar-actions">
                  <button title="Rename"
                    onClick={() => { setRenamingId(item.id); setRenameText(item.title); }}>
                    ✎
                  </button>
                  <button title="Delete" className="danger"
                    onClick={() => void handleDelete(item.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Collapse toggle — inline thin strip between sidebar and chat ─── */}
        <button className="tsci-crag-sidebar-toggle"
          aria-label={historyOpen ? 'Hide history' : 'Show history'}
          onClick={() => setHistoryOpen(o => !o)}
          title={historyOpen ? 'Hide history' : 'Show history'}>
          {historyOpen ? '‹' : '›'}
        </button>

        {/* ── Chat area ──────────────────────────────────────────────────────── */}
        <div className="bob-ask-chat" style={{ flex: 1 }}>
          <div className="bob-chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`bob-msg bob-msg-${msg.role}`}>
                {msg.role === 'agent' && !msg.progressSteps && (
                  <AgentNameBlock agentLabel={msg.agentLabel} isThinking={false} />
                )}
                {msg.progressSteps ? (
                  <AgentProgressTracker steps={msg.progressSteps} agentLabel={msg.agentLabel} />
                ) : msg.text === '…' ? (
                  <div className="bob-msg-bubble">
                    <div className="tsci-typing-dots"><span /><span /><span /></div>
                  </div>
                ) : (
                  <div className="bob-msg-bubble">
                    <RichAnswer text={msg.text} />
                    {msg.evidence && msg.evidence.length > 0 && (
                      <div className="tsci-evidence-section" style={{ marginTop: '8px' }}>
                        {msg.evidence.map((ev, i) => (
                          <EvidenceBlock key={ev.evidence_id ?? i} evidence={ev} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ──────────────────────────────────────────────────── */}
          <div className="bob-input-bar">
            <input
              ref={inputRef}
              className="bob-input"
              placeholder="Ask about approved-vendor changes for CVA-8842…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              disabled={loading}
            />
            <button className="bob-send-btn"
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              aria-label="Send">
              <SendArrow />
            </button>
          </div>

          {/* ── Thread footer (spec §10) ─────────────────────────────────── */}
          {threadId && (
            <div className="tsci-crag-thread-footer">
              Thread: <code>{threadId.slice(0, 8)}…</code>
              &nbsp;·&nbsp;
              <button className="tsci-crag-reset-btn" onClick={handleNewChat}>
                New conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
