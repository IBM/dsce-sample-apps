import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';
import { InstanaMcpIcon, BobMascotIcon } from './Icons.jsx';

const WelcomeScreen = ({ suggestedPrompts, onSelectPrompt }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      gap: '2rem',
    }}
  >
    {/* Hero */}
    <div style={{ textAlign: 'center', maxWidth: '480px' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, rgba(15, 98, 254, 0.2) 0%, rgba(0, 45, 156, 0.35) 100%)',
          border: '1px solid rgba(15, 98, 254, 0.45)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          boxShadow: '0 0 20px rgba(15, 98, 254, 0.3)',
        }}
      >
        <InstanaMcpIcon size={42} />
      </div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 300,
          color: 'var(--cds-text-primary)',
          marginBottom: '0.75rem',
          letterSpacing: '-0.01em',
        }}
      >
        Instana AI Assistant
      </h1>
      <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
        Ask about application health, error rates, traces, incidents, and infrastructure metrics.
        Powered by the live Instana MCP server and Headless Bob.
      </p>
    </div>

    {/* Suggested prompt cards */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.75rem',
        width: '100%',
        maxWidth: '640px',
      }}
    >
      {suggestedPrompts.map((prompt, i) => (
        <button
          key={i}
          onClick={() => onSelectPrompt(prompt)}
          style={{
            background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-subtle-01)',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem 1rem',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--cds-text-secondary)',
            fontSize: '0.825rem',
            lineHeight: 1.4,
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--cds-layer-hover-01)';
            e.currentTarget.style.borderColor = 'var(--cds-border-strong-01)';
            e.currentTarget.style.color = 'var(--cds-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--cds-layer-01)';
            e.currentTarget.style.borderColor = 'var(--cds-border-subtle-01)';
            e.currentTarget.style.color = 'var(--cds-text-secondary)';
          }}
        >
          {prompt}
        </button>
      ))}
    </div>
  </div>
);

// Generic progress phases. They describe what the agent loop does for ANY prompt;
// they are not a trace of the specific MCP tools being called.
const MCP_STEPS = [
  '⚡ Connecting to Instana MCP server…',
  '🔧 Selecting Instana MCP tools for your question…',
  '📊 Querying Instana telemetry…',
  '⚙️ Correlating results and writing the report…',
];

const TypingIndicator = () => {
  const [stepIdx, setStepIdx] = React.useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStepIdx((p) => (p + 1) % MCP_STEPS.length), 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        margin: '0 auto',
        maxWidth: '900px',
        width: '100%',
      }}
    >
      <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <InstanaMcpIcon size={26} />
      </div>
      <div
        style={{
          background: 'var(--cds-layer-01)',
          border: '1px solid var(--cds-border-subtle-01)',
          borderRadius: 'var(--radius-md)',
          padding: '0.625rem 0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#4589ff',
                display: 'inline-block',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.1); }
          }
        `}</style>
        <span style={{ fontSize: '0.775rem', color: 'var(--cds-text-primary)', fontFamily: 'IBM Plex Mono, monospace' }}>
          {MCP_STEPS[stepIdx]}
        </span>
      </div>
    </div>
  );
};

const BOB_STEPS = [
  '🤖 Headless Bob: reviewing the Instana findings…',
  '🤖 Headless Bob: correlating evidence and dependencies…',
  '🤖 Headless Bob: drafting Root Cause Analysis (RCA) & remediation plan…',
];

const BobDiagnosingIndicator = () => {
  const [stepIdx, setStepIdx] = React.useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStepIdx((p) => (p + 1) % BOB_STEPS.length), 1900);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        margin: '0 auto',
        maxWidth: '900px',
        width: '100%',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          background: 'linear-gradient(135deg, #0f62fe 0%, #002d9c 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <BobMascotIcon size={20} />
      </div>
      <div
        style={{
          background: 'var(--cds-layer-02)',
          border: '1px solid #0f62fe',
          borderRadius: 'var(--radius-md)',
          padding: '0.625rem 0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#da1e28',
            display: 'inline-block',
            boxShadow: '0 0 6px #da1e28',
            animation: 'pulse 1s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: '0.775rem', color: '#78a9ff', fontWeight: 500 }}>
          {BOB_STEPS[stepIdx]}
        </span>
      </div>
    </div>
  );
};

export default function ChatPanel({ messages, isLoading, isBobDiagnosing, onSuggestedPrompt, onInvestigate, hasMessages, suggestedPrompts }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isBobDiagnosing]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!hasMessages ? (
        <WelcomeScreen suggestedPrompts={suggestedPrompts} onSelectPrompt={onSuggestedPrompt} />
      ) : (
        <div
          style={{
            flex: 1,
            padding: '1rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onInvestigate={onInvestigate} />
          ))}
          {isLoading && <TypingIndicator />}
          {isBobDiagnosing && <BobDiagnosingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
