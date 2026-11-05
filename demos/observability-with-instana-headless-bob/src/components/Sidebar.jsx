import React from 'react';

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
);

const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H5l-4 3V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LightningIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M9 1L2 9h6l-1 6 7-8H8l1-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Sidebar({ chatSessions, activeChatId, onNewChat, onSelectChat, suggestedPrompts, onSelectPrompt }) {
  return (
    <aside
      style={{
        width: '260px',
        background: 'var(--cds-layer-01)',
        borderRight: '1px solid var(--cds-border-subtle-01)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* New chat button */}
      <div style={{ padding: '0.75rem' }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            background: 'var(--cds-button-primary)',
            color: 'var(--cds-text-on-color)',
            border: 'none',
            cursor: 'pointer',
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            fontWeight: 400,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cds-button-primary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cds-button-primary)')}
        >
          <PlusIcon />
          New Conversation
        </button>
      </div>

      {/* Chat history */}
      <div style={{ padding: '0 0.5rem' }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--cds-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0.5rem 0.5rem 0.25rem',
          }}
        >
          Recent
        </div>
        {chatSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectChat(session.id)}
            style={{
              width: '100%',
              background: session.id === activeChatId ? 'var(--cds-background-selected)' : 'none',
              border: session.id === activeChatId ? '1px solid var(--cds-border-subtle-02)' : '1px solid transparent',
              cursor: 'pointer',
              padding: '0.5rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '2px',
              textAlign: 'left',
              color: session.id === activeChatId ? 'var(--cds-text-primary)' : 'var(--cds-text-secondary)',
              fontSize: '0.8rem',
              transition: 'background 0.1s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              if (session.id !== activeChatId) e.currentTarget.style.background = 'var(--cds-layer-hover-01)';
            }}
            onMouseLeave={(e) => {
              if (session.id !== activeChatId) e.currentTarget.style.background = 'none';
            }}
          >
            <ChatIcon />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: '0.8rem',
                }}
              >
                {session.title}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--cds-text-placeholder)', marginTop: '1px' }}>
                {formatTime(session.timestamp)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--cds-border-subtle-01)', margin: '0.5rem 0' }} />

      {/* Suggested prompts */}
      <div style={{ padding: '0 0.5rem', overflow: 'auto', flex: 1 }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--cds-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 0.5rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <LightningIcon />
          Quick Prompts
        </div>
        {suggestedPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelectPrompt(prompt)}
            style={{
              width: '100%',
              background: 'none',
              border: '1px solid var(--cds-border-subtle-01)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              display: 'block',
              textAlign: 'left',
              color: 'var(--cds-text-secondary)',
              fontSize: '0.775rem',
              marginBottom: '4px',
              transition: 'all 0.1s',
              lineHeight: 1.4,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--cds-layer-hover-01)';
              e.currentTarget.style.color = 'var(--cds-text-primary)';
              e.currentTarget.style.borderColor = 'var(--cds-border-strong-01)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--cds-text-secondary)';
              e.currentTarget.style.borderColor = 'var(--cds-border-subtle-01)';
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </aside>
  );
}
