import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Button,
  TextInput,
  Tag,
  Select,
  SelectItem,
  InlineNotification,
} from '@carbon/react';
import { SendAlt, ChevronDown, ChevronUp, ArrowRight, Information, Time, Close, TrashCan, Launch, CheckmarkFilled } from '@carbon/icons-react';
import axios from 'axios';
import { MarkdownText } from '../utils/markdown';
import { isDemoMode, addAction, subscribeStore } from '../demo/demoStore';
import { matchScenario, scenarioToMessage } from '../demo/demoChatScenarios';
import './AgentChat.scss';

// ── Source metadata ────────────────────────────────────────────────────────────
const SOURCE_META = {
  'maximo-live':   { label: 'Maximo Live Data',   cssClass: 'source-maximo',    tagType: 'green'  },
  documents:       { label: 'Uploaded Documents', cssClass: 'source-documents', tagType: 'blue'   },
  'web-knowledge': { label: 'Web Knowledge',      cssClass: 'source-web',       tagType: 'teal'   },
};

// ── Suggestion cards shown on the welcome screen — match the watsonx Orchestrate style
const SUGGESTION_CARDS = [
  {
    title: 'Asset Status',
    description: 'What is the status of all active work orders and assets?',
  },
  {
    title: 'Maintenance Procedures',
    description: 'How do I perform preventive maintenance on a pump or compressor?',
  },
  {
    title: 'Service Requests',
    description: 'Show me open service requests and troubleshooting guides.',
  },
];

// Demo mode suggestion tiles — shown when demo mode is active
const DEMO_SUGGESTION_CARDS = [
  {
    title: 'Recurring failures',
    description: 'Can you find all the recurring failures in our rotating equipment?',
  },
  {
    title: 'Job plan vs OEM',
    description: 'What is the gap between our job plan and the OEM recommendation for PUMP-2547?',
  },
  {
    title: 'Recommendations',
    description: 'What are your recommendations to improve asset reliability?',
  },
];

// ── Collapsible citations ──────────────────────────────────────────────────────
function Citations({ section }) {
  const [open, setOpen] = useState(false);
  if (!section.citations?.length) return null;
  return (
    <div className="citations-block">
      <button
        className="citations-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {section.citations.length} source{section.citations.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="citations-list">
          {section.citations.map((c, i) => (
            <li key={i} className="citation-item">
              {c.url
                ? <a href={c.url} target="_blank" rel="noreferrer" className="citation-link">{c.title || c.url}</a>
                : <span className="citation-filename">{c.title || c.documentId || `Source ${i + 1}`}</span>
              }
              {c.score != null && <span className="citation-meta">score: {c.score.toFixed(2)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Provenance / trace panel ───────────────────────────────────────────────────
function ProvenancePanel({ provenance }) {
  const [open, setOpen] = useState(false);
  if (!provenance) return null;
  return (
    <div className="provenance-block">
      <button
        className="provenance-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Toggle API trace"
      >
        <Information size={14} />
        <span>API Trace</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="provenance-body">
          <pre className="provenance-json">
            {JSON.stringify(provenance, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

const STATUS_CLASS = {
  WAPPR: 'status-wappr', APPR: 'status-appr', INPRG: 'status-inprg',
  COMP: 'status-comp', CLOSE: 'status-close', CAN: 'status-can',
  WSCH: 'status-wsch', WMATL: 'status-wmatl',
};

function StatusBadge({ value }) {
  if (!value) return null;
  return <span className={`status-badge ${STATUS_CLASS[value] || 'status-default'}`}>{value}</span>;
}

const TABLE_COLS = {
  wonum:       'WO #',
  description: 'Description',
  status:      'Status',
  assetnum:    'Asset',
  location:    'Location',
  reportdate:  'Reported',
  targstartdate: 'Target Start',
  targcompdate:  'Target End',
  assignedto:  'Assigned To',
  worktype:    'Type',
  priority:    'Priority',
};

const DEFAULT_COLS = [['id','ID'],['description','Description'],['status','Status']]
const ROWS_DEFAULT = 5

function MaximoDataTable({ records, objectStructure }) {
  const [showAll, setShowAll] = useState(false);
  if (!records?.length) return null;

  // Derive columns from TABLE_COLS keys that are present in the first record,
  // or fall back to DEFAULT_COLS for unknown object structures.
  const firstRec = records[0];
  const detected = Object.entries(TABLE_COLS).filter(([k]) => k in firstRec);
  const cols = detected.length ? detected : DEFAULT_COLS;

  const visible = showAll ? records : records.slice(0, ROWS_DEFAULT);

  return (
    <>
      <div className="maximo-data-table-wrap">
        <table className="maximo-data-table">
          <thead>
            <tr>{cols.map(([k, label]) => <th key={k}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.wonum || row.id || i}>
                {cols.map(([k]) => (
                  <td key={k}>
                    {k === 'status' ? <StatusBadge value={row[k]} /> : (row[k] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length > ROWS_DEFAULT && (
        <button className="source-card-table-toggle" onClick={() => setShowAll(s => !s)}>
          {showAll
            ? <><ChevronUp size={14} /> Show less</>
            : <><ChevronDown size={14} /> Show {records.length - ROWS_DEFAULT} more records</>
          }
        </button>
      )}
    </>
  );
}

function SourceCard({ section }) {
  const meta = SOURCE_META[section.source] || { label: section.label, cssClass: '', tagType: 'gray' };
  const isMaximo = section.source === 'maximo-live';
  const records  = isMaximo ? (section.records || []) : [];
  return (
    <div className={`source-card ${meta.cssClass}`}>
      <div className="source-card-header">
        <div className="source-card-label-group">
          <span className="source-card-dot" />
          <span className="source-card-label">{meta.label}</span>
        </div>
        {section.recordCount != null && (
          <span className="source-card-count">{section.recordCount} record{section.recordCount !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="source-card-body">
        {section.answer && (
          <div className="source-card-answer">
            <MarkdownText text={section.answer} />
          </div>
        )}
        {isMaximo && records.length > 0 && (
          <MaximoDataTable records={records} objectStructure={section.objectStructure} />
        )}
        {!isMaximo && <Citations section={section} />}
      </div>
    </div>
  );
}

function _fmtTime(ts) {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function UserMessage({ message, username, userInitials }) {
  return (
    <div className="msg-row msg-user">
      <div className="msg-user-meta">
        <span className="msg-user-name">{username}</span>
        <span className="msg-time">{_fmtTime(message.timestamp)}</span>
      </div>
      <div className="msg-user-bubble-row">
        <div className="msg-user-bubble">{message.text}</div>
        <span className="msg-user-avatar" aria-hidden="true">{userInitials}</span>
      </div>
    </div>
  );
}

// ── Demo action creation card ──────────────────────────────────────────────────
// Shown inside a bot message when the scenario carries an action payload.
// Manages its own `created` state so the button flips to a confirmation view.
function DemoActionCard({ action, onNavigate }) {
  const [created, setCreated] = useState(false);

  const handleCreate = () => {
    // Stamp the real creation time at the moment the user clicks,
    // not at module-load time (which is when _nowLabel() in the scenario
    // data is evaluated and would be stale for the rest of the session).
    const now = new Date();
    const timeLabel = now.toLocaleString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    addAction({ ...action, created: `Today, ${timeLabel}` });
    setCreated(true);
  };

  const TYPE_COLORS = {
    Investigation:  'purple',
    Analysis:       'blue',
    Report:         'teal',
    Task:           'cyan',
    Recommendation: 'green',
  };

  if (created) {
    return (
      <div className="demo-action-card demo-action-card--created">
        <div className="demo-action-card__confirm">
          <CheckmarkFilled size={16} className="demo-action-card__check" />
          <span>Action created —&nbsp;</span>
          <Tag type={TYPE_COLORS[action.type] || 'gray'} size="sm">{action.type}</Tag>
          <strong className="demo-action-card__title">{action.title}</strong>
        </div>
        {onNavigate && (
          <button
            className="demo-action-card__link"
            onClick={() => onNavigate('actions')}
          >
            Open in Action Center <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="demo-action-card">
      <div className="demo-action-card__prompt">
        <Tag type={TYPE_COLORS[action.type] || 'gray'} size="sm">{action.type}</Tag>
        <span className="demo-action-card__title">{action.title}</span>
      </div>
      <button className="demo-action-card__btn" onClick={handleCreate}>
        Create action
      </button>
    </div>
  );
}

// ── Bot message ────────────────────────────────────────────────────────────────
// Split markdown text into segments: {type:'prose'|'table', text:string}[]
// A "table" segment is a contiguous run of pipe-table lines.
function _splitMarkdownSegments(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const segments = [];
  let current = { type: 'prose', lines: [] };

  for (const line of lines) {
    const isTableLine = /^\s*\|/.test(line);
    if (isTableLine) {
      if (current.type === 'prose') {
        if (current.lines.length) segments.push({ type: 'prose', text: current.lines.join('\n') });
        current = { type: 'table', lines: [] };
      }
      current.lines.push(line);
    } else {
      if (current.type === 'table') {
        segments.push({ type: 'table', text: current.lines.join('\n') });
        current = { type: 'prose', lines: [] };
      }
      current.lines.push(line);
    }
  }
  if (current.lines.length) segments.push({ type: current.type, text: current.lines.join('\n') });
  return segments;
}

function BotMessage({ message, agentName, onNavigate }) {
  const hasSections = message.sections?.length > 0;
  // Combined synthesis only when multiple sources contributed
  const showSynth = hasSections && message.sections.length > 1 && message.synthesizedAnswer;
  // Plain fallback when no source cards (0-result or error path)
  const showFallback = !hasSections && message.synthesizedAnswer;
  // Last-resort plain text
  const showText = !hasSections && !message.synthesizedAnswer && message.text;

  // Build searched-source tags — shown for both section-based and fallback/demo messages
  const sq = message.sourcesQueried;
  const searchedTags = sq ? [
    sq.maximoLive   && { type: 'green', label: 'Maximo Live'   },
    sq.documents    && { type: 'blue',  label: 'Documents'     },
    sq.webKnowledge && { type: 'teal',  label: 'Web Knowledge' },
  ].filter(Boolean) : [];

  // Segments for fallback rendering (splits prose and table blocks)
  const fallbackSegments = showFallback ? _splitMarkdownSegments(message.synthesizedAnswer) : [];

  return (
    <div className="msg-row msg-bot">
      <div className="msg-bot-meta">
        <span className="msg-bot-avatar" aria-hidden="true">KH</span>
        <span className="msg-bot-name">{agentName}</span>
        <span className="msg-time">{_fmtTime(message.timestamp)}</span>
      </div>
      <div className="msg-bot-body">
        {/* ── Provenance panel — always first, collapsed by default ── */}
        <ProvenancePanel provenance={message.provenance} />

        {/* Combined synthesis when multiple sources answered */}
        {showSynth && (
          <div className="synthesis-block">
            <p className="synthesis-heading">Combined Answer</p>
            <MarkdownText text={message.synthesizedAnswer} />
          </div>
        )}

        {/* Fallback — prose and table blocks rendered separately */}
        {showFallback && fallbackSegments.map((seg, i) =>
          seg.type === 'table' ? (
            <div key={i} className="bot-table-block">
              <MarkdownText text={seg.text} />
            </div>
          ) : (
            <div key={i} className="bot-fallback">
              <MarkdownText text={seg.text} />
            </div>
          )
        )}
        {showText && <MarkdownText text={message.text} />}

        {/* Source cards — each card renders its own LLM answer + data table */}
        {hasSections && (
          <div className="source-cards">
            {message.sections.map((sec, i) => <SourceCard key={i} section={sec} />)}
          </div>
        )}

        {/* Searched-sources footer — only when at least one tag is present */}
        {searchedTags.length > 0 && (
          <div className="searched-row">
            <span className="searched-label">Searched:</span>
            {searchedTags.map(t => (
              <Tag key={t.label} type={t.type} size="sm">{t.label}</Tag>
            ))}
          </div>
        )}

        {/* Demo action creation card — only when the scenario has an action payload */}
        {message.demoScenario?.action && (
          <DemoActionCard action={message.demoScenario.action} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

// ── Instance picker dropdown ───────────────────────────────────────────────────
function InstancePicker({ instances, activeInstId, onChange, size = 'sm' }) {
  if (!instances || instances.length === 0) return null;
  const activeInst = instances.find(i => i.id === activeInstId);
  return (
    <div className="instance-picker">
      <span className="instance-picker-label">Maximo instance:</span>
      <Select
        id="instance-select"
        hideLabel
        size={size}
        value={activeInstId || ''}
        onChange={e => onChange(e.target.value)}
        className="instance-picker-select"
      >
        {instances.map(inst => (
          <SelectItem
            key={inst.id}
            value={inst.id}
            text={inst.name || inst.id}
          />
        ))}
      </Select>
      {activeInst && (
        <span className={`instance-status-dot instance-status-dot--${activeInst.status || 'unknown'}`} />
      )}
    </div>
  );
}

// ── Chat history helpers ───────────────────────────────────────────────────────
const HISTORY_API = `${import.meta.env.VITE_MCP_SERVER_URL || ''}/api/history`;

function _slimMessage(m) {
  if (m.type === 'user') {
    return {
      id: m.id, type: 'user', text: m.text,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    };
  }
  return {
    id: m.id, type: 'bot',
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    synthesizedAnswer: m.synthesizedAnswer || null,
    text: m.text || null,
    sourcesQueried: m.sourcesQueried || null,
    sections: (m.sections || []).map(s => ({
      source:      s.source,
      label:       s.label,
      answer:      typeof s.answer === 'string' ? s.answer.slice(0, 1000) : s.answer,
      recordCount: s.recordCount ?? null,
      sources:     s.sources || [],
    })),
  };
}

function saveSessionToHistory(messages, username = 'default') {
  if (!messages || messages.length === 0) return;
  const firstUser = messages.find(m => m.type === 'user');
  if (!firstUser) return;
  const session = {
    id:        firstUser.id,
    title:     firstUser.text.slice(0, 60),
    timestamp: new Date().toISOString(),
    messages:  messages.map(_slimMessage),
    username,
  };
  // fire-and-forget POST to the MCP server
  axios.post(HISTORY_API, session).catch(() => { /* best-effort */ });
}

function groupByDate(sessions) {
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups    = { Today: [], Yesterday: [], Earlier: [] };
  sessions.forEach(s => {
    const d = new Date(s.timestamp); d.setHours(0,0,0,0);
    if (d >= today)          groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else                     groups.Earlier.push(s);
  });
  return groups;
}

// ── History panel (slide-in drawer) ───────────────────────────────────────────
function HistoryPanel({ open, onClose, onRestore, username }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    axios.get(HISTORY_API, { params: { username } })
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [open, username]);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    axios.delete(`${HISTORY_API}/${id}`, { params: { username } }).catch(() => {});
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleClearAll = () => {
    axios.delete(HISTORY_API, { params: { username } }).catch(() => {});
    setSessions([]);
  };

  const groups = groupByDate(sessions);

  return (
    <>
      {open && <div className="history-backdrop" onClick={onClose} aria-hidden="true" />}
      <div className={`history-panel${open ? ' history-panel--open' : ''}`} aria-label="Chat history">
        <div className="history-panel-header">
          <span className="history-panel-title">
            <Time size={16} /> Chat History
          </span>
          <div className="history-panel-header-actions">
            {sessions.length > 0 && (
              <button className="history-clear-all" onClick={handleClearAll} aria-label="Clear all history">
                Clear all
              </button>
            )}
            <button className="history-panel-close" onClick={onClose} aria-label="Close history">
              <Close size={16} />
            </button>
          </div>
        </div>
        <div className="history-panel-body">
          {loading ? (
            <p className="history-empty">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="history-empty">
              No saved chats yet.<br />
              Start a conversation, then click <strong>+ New chat</strong> — the current chat will be saved here automatically.
            </p>
          ) : (
            Object.entries(groups).map(([label, items]) =>
              items.length === 0 ? null : (
                <div key={label} className="history-group">
                  <div className="history-group-label">{label}</div>
                  {items.map(s => (
                    <div
                      key={s.id}
                      className="history-item"
                      onClick={() => { onRestore(s.messages); onClose(); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && (onRestore(s.messages), onClose())}
                      aria-label={`Restore chat: ${s.title}`}
                    >
                      <div className="history-item-title">{s.title}</div>
                      <div className="history-item-meta">
                        {new Date(s.timestamp).toLocaleString(undefined, {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                        {' · '}
                        {s.messages.filter(m => m.type === 'user').length} msg
                      </div>
                      <button
                        className="history-item-delete"
                        onClick={e => handleDelete(e, s.id)}
                        aria-label="Delete this chat"
                      >
                        <TrashCan size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </div>
      </div>
    </>
  );
}

// ── Welcome screen ─────────────────────────────────────────────────────────────
function WelcomeScreen({ onSuggest, agentName, demoMode }) {
  const cards = demoMode ? DEMO_SUGGESTION_CARDS : SUGGESTION_CARDS;
  const description = demoMode
    ? 'Demo mode is active. Click a question below or type your own to explore the AI Action Center workflow.'
    : 'Ask questions about your Maximo assets, work orders, and maintenance knowledge base.';

  return (
    <div className="welcome-screen">
      <div className="welcome-agent-row">
        <span className="welcome-avatar" aria-hidden="true">KH</span>
        <span className="welcome-agent-name">{agentName}</span>
      </div>
      <h1 className="welcome-heading">Hello, I'm {agentName}</h1>
      <p className="welcome-description">{description}</p>
      <div className="suggestion-tiles" role="list">
        {cards.map(card => (
          <button
            key={card.title}
            role="listitem"
            className="suggestion-tile"
            onClick={() => onSuggest(card.description)}
            aria-label={`Ask: ${card.description}`}
          >
            <span className="suggestion-tile-title">{card.title}</span>
            <span className="suggestion-tile-desc">{card.description}</span>
            <span className="suggestion-tile-arrow" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function initials(name = 'U') {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ChatHeader({ instances, activeInstId, onInstanceChange, onNewChat, showNewChat, onHistoryOpen }) {
  return (
    <div className="chat-header-bar">
      <div className="chat-header-left">
        <InstancePicker
          instances={instances}
          activeInstId={activeInstId}
          onChange={onInstanceChange}
          size="sm"
        />
      </div>
      <div className="chat-header-right">
        <button className="chat-header-history" onClick={onHistoryOpen} aria-label="Open chat history">
          <Time size={16} /> History
        </button>
        {showNewChat && (
          <button className="chat-header-new" onClick={onNewChat} aria-label="Start a new chat">
            + New chat
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main AgentChat component ───────────────────────────────────────────────────
export default function AgentChat({ username = 'User', onNavigate, isActive = true }) {
  const mcpUrl = import.meta.env.VITE_MCP_SERVER_URL || '';
  const AGENT_NAME = 'Asset Management Knowledge Hub';

  // ── Instance selector state ───────────────────────────────────────────────
  const [instances,    setInstances]    = useState([]);
  const [activeInstId, setActiveInstId] = useState(null);

  const fetchInstances = () => {
    axios.get(`${mcpUrl}/api/instances`)
      .then(({ data }) => {
        setInstances(data.instances || []);
        setActiveInstId(data.activeId || null);
      })
      .catch(() => {
        // MCP server not running yet — stay with null; query will use server default
      });
  };

  // Fetch on mount and re-fetch every time the tab becomes active so that
  // instances added in the Configuration tab are reflected immediately.
  useEffect(() => {
    if (isActive) fetchInstances();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, mcpUrl]);

  const handleInstanceChange = async (id) => {
    setActiveInstId(id);
    try {
      await axios.post(`${mcpUrl}/api/instances/${id}/select`);
    } catch { /* best-effort */ }
  };

  // ── Demo mode — re-check whenever the store notifies (toggle in Settings) ──
  const [demoMode, setDemoMode] = useState(() => isDemoMode());
  useEffect(() => subscribeStore(() => setDemoMode(isDemoMode())), []);

  // messages — empty = show welcome screen
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [historyOpen,  setHistoryOpen]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const messagesRef = useRef(messages); // always holds latest messages for beforeunload

  // Keep ref in sync so the beforeunload handler always sees latest messages
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Save active chat when user reloads or closes the tab
  useEffect(() => {
    const handleUnload = () => saveSessionToHistory(messagesRef.current, username);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [username]);

  // Save active chat when the user navigates away via the SPA sidebar
  // (AgentChat is never unmounted — it is hidden via display:none — so we
  // watch the isActive prop and flush to history whenever it turns false).
  const prevIsActive = useRef(isActive);
  useEffect(() => {
    if (prevIsActive.current && !isActive) {
      // Navigated away — persist the current session
      saveSessionToHistory(messagesRef.current, username);
    }
    prevIsActive.current = isActive;
  }, [isActive, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── UI command patterns — handled locally, never sent to the backend ─────────
  const UI_COMMANDS = [
    { pattern: /^(clear|clear (the )?(chat|page|screen|history|conversation)|new chat|reset|start over|start again)$/i,
      action: () => {
        setMessages(prev => { saveSessionToHistory(prev, username); return []; });
        setError(null);
      }
    },
  ];

  const send = async (text) => {
    const query = (text ?? input).trim();
    if (!query || loading) return;

    // Check for UI commands first — handle locally without hitting the backend
    for (const cmd of UI_COMMANDS) {
      if (cmd.pattern.test(query)) {
        setInput('');
        cmd.action();
        return;
      }
    }

    setMessages(prev => [...prev, {
      id: Date.now(), type: 'user', text: query, timestamp: new Date(),
    }]);
    setInput('');
    setLoading(true);
    setError(null);

    // ── Demo mode intercept ───────────────────────────────────────────────────
    // When demo mode is on, match the query against scripted scenarios and
    // return a canned response instead of calling the real backend.
    if (isDemoMode()) {
      const scenario = matchScenario(query);
      if (scenario) {
        await new Promise(r => setTimeout(r, 2200)); // simulate Maximo API round-trip
        setMessages(prev => [...prev, scenarioToMessage(scenario)]);
        setLoading(false);
        return;
      }
      // No scenario match in demo mode — show a friendly fallback
      await new Promise(r => setTimeout(r, 1500));
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        timestamp: new Date(),
        synthesizedAnswer: `**Demo mode** — no scripted scenario matched your query.\n\nTry asking about: *recurring failures*, *job plan vs OEM*, *maintenance report*, *recommendations*, *work orders*, *tasks*, or *PUMP-2547*.`,
        sections: [],
        sourcesQueried: null,
        provenance: null,
      }]);
      setLoading(false);
      return;
    }

    // Read agent feature flags from localStorage (set by Settings page).
    // Each key is read independently so a corrupt value for one key cannot
    // cause the others to fall back to the default (true = enabled).
    const _readFlag = (key, fallback) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        // Guard against old corrupt "[object Object]" writes — treat as fallback
        if (typeof parsed !== typeof fallback) return fallback;
        return parsed;
      } catch { return fallback; }
    };
    const agentConfig = {
      enableMaximo: _readFlag('mkh_enable_maximo', true),
      enableDocs:   _readFlag('mkh_enable_docs',   true),
      enableWeb:    _readFlag('mkh_enable_web',     true),
      enableSynth:  _readFlag('mkh_enable_synth',   true),
      maxResults:   _readFlag('mkh_max_results',    20),
    };

    try {
      const { data } = await axios.post(`${mcpUrl}/api/query`, {
        query,
        maxResults: agentConfig.maxResults,
        instanceId: activeInstId || undefined,
        enableMaximo: agentConfig.enableMaximo,
        enableDocs:   agentConfig.enableDocs,
        enableWeb:    agentConfig.enableWeb,
        enableSynth:  agentConfig.enableSynth,
      });
      // ── Build provenance trace from the raw API response ─────────────────
      const mx = data.sections?.find(s => s.source === 'maximo-live');
      const routing = data.routing || {};
      const provenance = {
        timestamp:       new Date().toISOString(),
        query:           data.query || '',
        route:           routing.route || 'unknown',
        objectStructure: routing.objectStructure || null,
        apiUrl:          data.apiUrl  || null,
        whereClause:     data.whereClause || null,
        orderBy:         data.orderBy    || null,
        recordCount:     mx?.recordCount ?? null,
        sourcesQueried:  data.sourcesQueried || null,
        sections:        data.sections?.map(s => ({
          source:      s.source,
          label:       s.label,
          recordCount: s.recordCount ?? null,
        })) || [],
        routing: {
          route:      routing.route      || null,
          confidence: routing.confidence || null,
          reason:     routing.reason     || null,
        },
      };

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        synthesizedAnswer: data.synthesizedAnswer || null,
        sections: data.sections || [],
        sourcesQueried: data.sourcesQueried || null,
        provenance,
        text: !data.sections?.length
          ? (data.answer || data.synthesizedAnswer || 'No results found.')
          : null,
        timestamp: new Date(),
      }]);
    } catch (err) {
      // err?.response?.data?.detail can be a Pydantic object array — always stringify
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(d => d?.msg || JSON.stringify(d)).join('; ')
          : detail
            ? JSON.stringify(detail)
            : `Could not reach the MCP server at ${mcpUrl}.`;
      setError(msg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showWelcome = messages.length === 0;

  const handleNewChat = useCallback(() => {
    setMessages(prev => { saveSessionToHistory(prev, username); return []; });
    setError(null);
  }, [username]);

  const handleRestoreSession = useCallback((sessionMessages) => {
    // Save the current active chat before switching to the history session
    setMessages(prev => {
      saveSessionToHistory(prev, username);
      return sessionMessages;
    });
    setError(null);
  }, [username]);

  return (
    <div className="chat-page">

      {/* ── History panel (slide-in drawer) ──────────────────────────────────── */}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreSession}
        username={username}
      />

      {/* ── Top header bar — always show when instances loaded, New chat only after first message ── */}
      <ChatHeader
        instances={instances}
        activeInstId={activeInstId}
        onInstanceChange={handleInstanceChange}
        onNewChat={handleNewChat}
        showNewChat={!showWelcome}
        onHistoryOpen={() => {
          // Flush the current in-progress session so it appears in the panel
          saveSessionToHistory(messagesRef.current, username);
          setHistoryOpen(true);
        }}
      />

      {/* ── Scrollable conversation area ─────────────────────────────────────── */}
      <div
        className="chat-scroll-area"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {showWelcome ? (
          <WelcomeScreen
            agentName={AGENT_NAME}
            onSuggest={(q) => send(q)}
            demoMode={demoMode}
          />
        ) : (
          <div className="chat-messages">
            {messages.map(msg =>
              msg.type === 'user'
                ? <UserMessage key={msg.id} message={msg} username={username} userInitials={initials(username)} />
                : <BotMessage  key={msg.id} message={msg} agentName={AGENT_NAME} onNavigate={onNavigate} />
            )}
            {loading && (
              <div className="msg-row msg-bot">
                <div className="msg-bot-meta">
                  <span className="msg-bot-avatar" aria-hidden="true">KH</span>
                  <span className="msg-bot-name">{AGENT_NAME}</span>
                </div>
                <div className="loading-bubble" aria-label="Thinking…" role="status">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <InlineNotification
          kind="error"
          title="Connection error — "
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          className="chat-error-bar"
        />
      )}

      {/* ── Composer — pinned at the bottom ──────────────────────────────────── */}
      <div className="composer-bar" role="form" aria-label="Send a message">
        <div className="composer-pill">
          <TextInput
            ref={inputRef}
            id="chat-input"
            labelText="Message"
            hideLabel
            placeholder="Type something…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            className="composer-input"
          />
          <Button
            kind="ghost"
            size="sm"
            renderIcon={SendAlt}
            iconDescription="Send message"
            hasIconOnly
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="composer-send-btn"
            aria-label="Send message"
          />
        </div>
      </div>

    </div>
  );
}
