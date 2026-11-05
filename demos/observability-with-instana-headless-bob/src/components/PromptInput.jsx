import React, { useState, useRef, useEffect } from 'react';

const SendIcon = ({ disabled }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M14 8L2 2l2 6-2 6 12-6z"
      stroke={disabled ? 'var(--cds-text-disabled)' : 'var(--cds-text-on-color)'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const EXAMPLE_PROMPTS = [
  'Give me the health of "Retail Application"',
  'What is the current error rate for the backend service?',
  'Show me erroneous traces for the last 30 minutes',
  'Are there any open incidents right now?',
];

export default function PromptInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % EXAMPLE_PROMPTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const canSubmit = value.trim().length > 0 && !isLoading;

  return (
    <div
      style={{
        borderTop: '1px solid var(--cds-border-subtle-01)',
        background: 'var(--cds-layer-01)',
        padding: '0.75rem 1.5rem 1rem',
        flexShrink: 0,
      }}
    >
      {/* Input container */}
      <div
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          position: 'relative',
          background: 'var(--cds-field-01)',
          border: '1px solid var(--cds-border-subtle-02)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.5rem',
          padding: '0.625rem 0.75rem',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--cds-interactive)'}
        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--cds-border-subtle-02)'}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={EXAMPLE_PROMPTS[placeholderIndex]}
          rows={1}
          disabled={isLoading}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: value ? 'var(--cds-text-primary)' : 'var(--cds-text-placeholder)',
            fontSize: '0.9rem',
            fontFamily: 'IBM Plex Sans, sans-serif',
            lineHeight: 1.5,
            resize: 'none',
            minHeight: '24px',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: 0,
            cursor: isLoading ? 'not-allowed' : 'text',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Send"
          style={{
            background: canSubmit ? 'var(--cds-button-primary)' : 'var(--cds-button-disabled)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
            height: '32px',
            width: '36px',
          }}
          onMouseEnter={(e) => canSubmit && (e.currentTarget.style.background = 'var(--cds-button-primary-hover)')}
          onMouseLeave={(e) => canSubmit && (e.currentTarget.style.background = 'var(--cds-button-primary)')}
        >
          {isLoading ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="8" cy="8" r="6" stroke="var(--cds-text-disabled)" strokeWidth="2" strokeDasharray="20 10" />
              <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
            </svg>
          ) : (
            <SendIcon disabled={!canSubmit} />
          )}
        </button>
      </div>

      {/* Hint */}
      <div
        style={{
          maxWidth: '860px',
          margin: '0.35rem auto 0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          color: 'var(--cds-text-placeholder)',
        }}
      >
        <span>Press <kbd style={{ background: 'var(--cds-layer-02)', border: '1px solid var(--cds-border-subtle-02)', borderRadius: '2px', padding: '0 4px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem' }}>Enter</kbd> to send · <kbd style={{ background: 'var(--cds-layer-02)', border: '1px solid var(--cds-border-subtle-02)', borderRadius: '2px', padding: '0 4px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem' }}>Shift+Enter</kbd> for new line</span>
        <span>{value.length > 0 && `${value.length} chars`}</span>
      </div>
    </div>
  );
}
