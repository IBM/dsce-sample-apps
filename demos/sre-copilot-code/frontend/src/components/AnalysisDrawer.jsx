/**
 * AnalysisDrawer.jsx
 * Slide-out side panel showing the agent's incident analysis result.
 *
 * Feature B: "Thinking" animation — terminal typewriter while agent runs
 * Feature C: Multi-source enrichment panel — sources consulted, related
 *             incidents, last deployment info shown above analysis
 */
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Tag,
  InlineNotification,
  IconButton,
} from '@carbon/react';
import { Close, Search, Warning, Checkmark, Tools, Link, RecentlyViewed, Deploy } from '@carbon/icons-react';

const SEVERITY_TAG_TYPE = {
  Critical: 'red',
  High: 'orange',
  Medium: 'warm-gray',
  Low: 'green',
};

// ── Feature C: enrichment data keyed by service ───────────────────────────────
const SOURCE_TOOLS = ['PagerDuty', 'Datadog', 'Splunk', 'GitHub', 'Confluence'];

const ENRICHMENT_BY_SERVICE = {
  'payment-service':      { related: 3, deploy: '2h ago', deployBy: 'r.patel',    sources: ['PagerDuty','Datadog','Splunk','GitHub','Confluence'] },
  'db-cluster-01':        { related: 2, deploy: '6h ago', deployBy: 's.kim',      sources: ['PagerDuty','Datadog','Splunk','Confluence'] },
  'auth-api':             { related: 4, deploy: '1h ago', deployBy: 'm.chen',     sources: ['PagerDuty','Datadog','GitHub','Confluence'] },
  'order-service':        { related: 2, deploy: '3h ago', deployBy: 't.nguyen',   sources: ['Splunk','Datadog','GitHub','Confluence'] },
  'storage-node-03':      { related: 1, deploy: '14h ago',deployBy: 'a.kovacs',   sources: ['Prometheus','Splunk','Confluence'] },
  'api-gateway':          { related: 3, deploy: '45m ago',deployBy: 'l.torres',   sources: ['PagerDuty','Datadog','GitHub','Confluence'] },
  'log-aggregator':       { related: 1, deploy: '2d ago', deployBy: 'r.obi',      sources: ['Splunk','Confluence'] },
  'k8s-cluster-prod':     { related: 2, deploy: '4h ago', deployBy: 'd.singh',    sources: ['PagerDuty','Datadog','GitHub','Confluence'] },
  'cache-cluster-02':     { related: 3, deploy: '30m ago',deployBy: 'e.johansson',sources: ['PagerDuty','Prometheus','Datadog','Confluence'] },
  'notification-service': { related: 1, deploy: '5h ago', deployBy: 'f.zhang',    sources: ['Datadog','Splunk','Confluence'] },
  'elasticsearch-prod':   { related: 2, deploy: '8h ago', deployBy: 'b.okafor',   sources: ['Kibana','Datadog','Splunk','Confluence'] },
  'network-fabric':       { related: 1, deploy: '3d ago', deployBy: 'k.williams', sources: ['Nagios','PagerDuty','Splunk'] },
  'object-storage-prod':  { related: 1, deploy: '1d ago', deployBy: 'p.martin',   sources: ['Datadog','Splunk','Confluence'] },
  'inventory-service':    { related: 2, deploy: '2h ago', deployBy: 'n.ito',      sources: ['PagerDuty','Datadog','GitHub','Confluence'] },
  'mobile-api-gateway':   { related: 2, deploy: '20m ago',deployBy: 'c.hassan',   sources: ['Fastly','Datadog','PagerDuty','GitHub'] },
  'scheduler':            { related: 1, deploy: '6h ago', deployBy: 'h.muller',   sources: ['Kubernetes','Splunk','Confluence'] },
  'observability-stack':  { related: 1, deploy: '1h ago', deployBy: 'g.petrov',   sources: ['Jaeger','Datadog','Splunk'] },
};
const DEFAULT_ENRICHMENT = { related: 1, deploy: '3h ago', deployBy: 'on-call', sources: ['PagerDuty','Datadog','Splunk','Confluence'] };

// Source tool pill colors
const SOURCE_COLOR = {
  PagerDuty:   '#06ac38',
  Datadog:     '#632ca6',
  Splunk:      '#ff5733',
  GitHub:      '#24292f',
  Confluence:  '#0052cc',
  Prometheus:  '#e6522c',
  Kibana:      '#005571',
  Nagios:      '#d5a30a',
  Fastly:      '#ff282d',
  Kubernetes:  '#326ce5',
  Jaeger:      '#00b4d8',
  Fluentd:     '#0e83cd',
  'S3 Alerts': '#f90',
};

function EnrichmentPanel({ incident }) {
  const enr = ENRICHMENT_BY_SERVICE[incident?.affected_service] || DEFAULT_ENRICHMENT;
  return (
    <div className="enrichment-panel">
      {/* Sources row */}
      <div className="enrichment-panel__row">
        <Link size={13} className="enrichment-panel__row-icon" />
        <span className="enrichment-panel__row-label">Sources consulted</span>
        <div className="enrichment-panel__sources">
          {enr.sources.map((src) => (
            <span
              key={src}
              className="enrichment-source"
              style={{ '--src-color': SOURCE_COLOR[src] || '#525252' }}
            >
              {src}
            </span>
          ))}
        </div>
      </div>
      {/* Related incidents */}
      <div className="enrichment-panel__row">
        <RecentlyViewed size={13} className="enrichment-panel__row-icon" />
        <span className="enrichment-panel__row-label">Related incidents</span>
        <span className="enrichment-panel__row-value enrichment-panel__row-value--link">
          {enr.related} similar incident{enr.related !== 1 ? 's' : ''} found in last 30 days
        </span>
      </div>
      {/* Last deployment */}
      <div className="enrichment-panel__row">
        <Deploy size={13} className="enrichment-panel__row-icon" />
        <span className="enrichment-panel__row-label">Last deployment</span>
        <span className="enrichment-panel__row-value">
          {enr.deploy} by <strong>{enr.deployBy}</strong>
        </span>
      </div>
    </div>
  );
}

// ── Thinking steps shown while agent runs ─────────────────────────────────────
const THINKING_STEPS = [
  { icon: '🔌', text: 'Connecting to watsonx Orchestrate…' },
  { icon: '📋', text: 'Retrieving incident context & logs…' },
  { icon: '🔍', text: 'Scanning error patterns & stack traces…' },
  { icon: '📡', text: 'Querying PagerDuty alert history…' },
  { icon: '📊', text: 'Cross-referencing Datadog metrics…' },
  { icon: '📚', text: 'Searching internal runbook database…' },
  { icon: '🧠', text: 'Running root cause inference model…' },
  { icon: '⚖️',  text: 'Classifying severity & blast radius…' },
  { icon: '🛠️', text: 'Generating remediation runbook…' },
  { icon: '✅', text: 'Finalizing analysis report…' },
];

function extractSeverityLevel(classificationText) {
  if (!classificationText) return null;
  const match = classificationText.match(/^(Critical|High|Medium|Low)/i);
  return match ? match[1] : null;
}

// ── Typewriter / terminal thinking component ──────────────────────────────────
function ThinkingTerminal({ isAnalyzing }) {
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const stepTimerRef = useRef(null);
  const typeTimerRef = useRef(null);
  const cursorTimerRef = useRef(null);

  // Cursor blink
  useEffect(() => {
    cursorTimerRef.current = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(cursorTimerRef.current);
  }, []);

  // Reset when analysis starts
  useEffect(() => {
    if (isAnalyzing) {
      setCompletedSteps([]);
      setCurrentStep(0);
      setTypedText('');
    }
  }, [isAnalyzing]);

  // Typewriter effect for current step
  useEffect(() => {
    if (!isAnalyzing) return;
    const step = THINKING_STEPS[currentStep];
    if (!step) return;

    const fullText = step.text;
    let charIdx = 0;
    setTypedText('');

    typeTimerRef.current = setInterval(() => {
      charIdx++;
      setTypedText(fullText.slice(0, charIdx));
      if (charIdx >= fullText.length) {
        clearInterval(typeTimerRef.current);
        // After finishing typing, hold then move to next step
        stepTimerRef.current = setTimeout(() => {
          setCompletedSteps((prev) => [...prev, { ...step, typed: fullText }]);
          const nextIdx = currentStep + 1;
          if (nextIdx < THINKING_STEPS.length) {
            setCurrentStep(nextIdx);
            setTypedText('');
          }
        }, 420);
      }
    }, 28); // ~28ms per char → feels snappy but readable

    return () => {
      clearInterval(typeTimerRef.current);
      clearTimeout(stepTimerRef.current);
    };
  }, [currentStep, isAnalyzing]);

  return (
    <div className="thinking-terminal">
      <div className="thinking-terminal__header">
        <span className="thinking-terminal__dot thinking-terminal__dot--red" />
        <span className="thinking-terminal__dot thinking-terminal__dot--yellow" />
        <span className="thinking-terminal__dot thinking-terminal__dot--green" />
        <span className="thinking-terminal__header-label">watsonx Orchestrate — Agent</span>
      </div>
      <div className="thinking-terminal__body">
        {/* Completed steps */}
        {completedSteps.map((s, i) => (
          <div key={i} className="thinking-line thinking-line--done">
            <span className="thinking-line__icon">{s.icon}</span>
            <span className="thinking-line__text">{s.typed}</span>
            <span className="thinking-line__check">✓</span>
          </div>
        ))}
        {/* Current typing step */}
        {isAnalyzing && currentStep < THINKING_STEPS.length && (
          <div className="thinking-line thinking-line--active">
            <span className="thinking-line__icon">{THINKING_STEPS[currentStep].icon}</span>
            <span className="thinking-line__text">
              {typedText}
              <span className={`thinking-cursor ${cursorVisible ? 'thinking-cursor--visible' : ''}`}>▋</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Animated result section ───────────────────────────────────────────────────
function AnimatedSection({ children, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={`analysis-section-animated ${visible ? 'analysis-section-animated--visible' : ''}`}>
      {children}
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────
// ── Chat section ─────────────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  'What is the business impact of this incident?',
  'How can we prevent this from recurring?',
  'Which team should own the remediation?',
  'How long will the fix take?',
];

function ChatSection({ incident, analysisResult, onSendChat, initialHistory }) {
  const [messages, setMessages]   = useState(initialHistory);
  const [input, setInput]         = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const send = async (text) => {
    const msg = text.trim();
    if (!msg || isSending) return;
    setInput('');
    setChatError(null);
    setIsSending(true);

    // Optimistically add user message
    const optimistic = [...messages, { role: 'user', content: msg }];
    setMessages(optimistic);

    try {
      const { updatedHistory } = await onSendChat(incident.id, msg, messages);
      setMessages(updatedHistory);
    } catch (e) {
      setChatError(e.message);
      // Remove the optimistic user message on error
      setMessages(messages);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="chat-section">
      {/* Header */}
      <div className="chat-section__header">
        <span className="chat-section__header-icon">💬</span>
        <span className="chat-section__header-label">Ask a follow-up question</span>
      </div>

      {/* Suggested questions (only when no messages yet) */}
      {messages.length === 0 && !isSending && (
        <div className="chat-suggestions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} className="chat-suggestion-btn" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble chat-bubble--${msg.role}`}>
              <span className="chat-bubble__avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </span>
              <div className="chat-bubble__content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {/* Typing indicator */}
          {isSending && (
            <div className="chat-bubble chat-bubble--agent">
              <span className="chat-bubble__avatar">🤖</span>
              <div className="chat-bubble__content chat-bubble__typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error */}
      {chatError && (
        <div className="chat-error">{chatError}</div>
      )}

      {/* Input row */}
      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask anything about this incident…"
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button
          className="chat-send-btn"
          onClick={() => send(input)}
          disabled={!input.trim() || isSending}
          aria-label="Send"
        >
          ↵
        </button>
      </div>
    </div>
  );
}

export default function AnalysisDrawer({
  isOpen,
  incident,
  analysisResult,
  isAnalyzing,
  error,
  onClose,
  onResolve,
  onSendChat,
  initialChatHistory = [],
}) {
  if (!isOpen) return null;

  const severityLevel = analysisResult
    ? extractSeverityLevel(analysisResult.severity_classification)
    : null;

  const isResolved = incident?.status === 'Resolved';

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Drawer panel */}
      <aside className="analysis-drawer" aria-label="Incident Analysis">
        {/* ── Header ── */}
        <div className="analysis-drawer__header">
          <div className="analysis-drawer__header-text">
            <span className="analysis-drawer__incident-id">{incident?.id}</span>
            <h3 className="analysis-drawer__title">{incident?.title}</h3>
          </div>
          <IconButton label="Close analysis panel" kind="ghost" size="sm" onClick={onClose}>
            <Close />
          </IconButton>
        </div>

        {/* ── Service + severity badges ── */}
        {incident?.affected_service && (
          <div className="analysis-drawer__service">
            <Tag type="cool-gray" size="sm">{incident.affected_service}</Tag>
            <Tag type={SEVERITY_TAG_TYPE[incident?.severity] || 'gray'} size="sm">
              {incident?.severity}
            </Tag>
            {isResolved && (
              <Tag type="teal" size="sm">✓ Resolved</Tag>
            )}
          </div>
        )}

        <div className="analysis-drawer__body">
          {/* ── Error state ── */}
          {error && !isAnalyzing && (
            <InlineNotification
              kind="error"
              title="Analysis failed"
              subtitle={error}
              hideCloseButton={false}
            />
          )}

          {/* ── Thinking animation (Feature B) ── */}
          {isAnalyzing && (
            <ThinkingTerminal isAnalyzing={isAnalyzing} />
          )}

          {/* ── Analysis result — staggered section reveal ── */}
          {analysisResult && !isAnalyzing && (
            <div className="analysis-drawer__result">

              {/* Feature C: enrichment panel */}
              <AnimatedSection delay={0}>
                <EnrichmentPanel incident={incident} />
              </AnimatedSection>

              {/* Root Cause */}
              <AnimatedSection delay={80}>
                <section className="analysis-section">
                  <div className="analysis-section__heading">
                    <Search size={18} />
                    <h4>Root Cause</h4>
                  </div>
                  <div className="analysis-section__markdown">
                    <ReactMarkdown>{analysisResult.root_cause}</ReactMarkdown>
                  </div>
                </section>
              </AnimatedSection>

              {/* Severity Classification */}
              <AnimatedSection delay={200}>
                <section className="analysis-section">
                  <div className="analysis-section__heading">
                    <Warning size={18} />
                    <h4>Severity Classification</h4>
                  </div>
                  <div className="analysis-section__severity">
                    {severityLevel && (
                      <Tag type={SEVERITY_TAG_TYPE[severityLevel] || 'gray'} size="md">
                        {severityLevel}
                      </Tag>
                    )}
                    <div className="analysis-section__markdown analysis-section__markdown--inline">
                      <ReactMarkdown>
                        {severityLevel
                          ? analysisResult.severity_classification.replace(
                              new RegExp(`^${severityLevel}:?\\s*`, 'i'), ''
                            )
                          : analysisResult.severity_classification}
                      </ReactMarkdown>
                    </div>
                  </div>
                </section>
              </AnimatedSection>

              {/* Remediation Steps */}
              <AnimatedSection delay={320}>
                <section className="analysis-section">
                  <div className="analysis-section__heading">
                    <Tools size={18} />
                    <h4>Remediation Steps</h4>
                  </div>
                  <ol className="analysis-section__steps">
                    {analysisResult.remediation_steps.map((step, i) => (
                      <li key={i} className="analysis-section__step-item">
                        <ReactMarkdown>{step}</ReactMarkdown>
                      </li>
                    ))}
                  </ol>
                </section>
              </AnimatedSection>

            </div>
          )}

          {/* ── Chat section (after analysis is ready) ── */}
          {analysisResult && !isAnalyzing && onSendChat && (
            <ChatSection
              incident={incident}
              analysisResult={analysisResult}
              onSendChat={onSendChat}
              initialHistory={initialChatHistory}
            />
          )}

          {/* ── Empty / initial state ── */}
          {!isAnalyzing && !analysisResult && !error && (
            <div className="analysis-drawer__empty">
              <Checkmark size={32} />
              <p>Analysis will appear here.</p>
            </div>
          )}
        </div>

        {/* ── Footer: Mark Resolved (only visible after result + not yet resolved) ── */}
        {analysisResult && !isAnalyzing && !isResolved && (
          <div className="analysis-drawer__footer">
            <div className="analysis-drawer__footer-hint">
              <Checkmark size={14} />
              <span>Remediation steps reviewed?</span>
            </div>
            <button
              className="resolve-btn"
              onClick={() => onResolve(incident?.id)}
            >
              <Checkmark size={16} />
              Mark Resolved
            </button>
          </div>
        )}

        {/* ── Footer: already resolved ── */}
        {isResolved && (
          <div className="analysis-drawer__footer analysis-drawer__footer--resolved">
            <Checkmark size={16} />
            <span>Incident resolved — timeline complete</span>
          </div>
        )}

      </aside>
    </>
  );
}
