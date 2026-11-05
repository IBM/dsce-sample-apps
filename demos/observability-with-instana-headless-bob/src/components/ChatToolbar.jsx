import React, { useState, useEffect } from 'react';

// Slim toolbar above the Autonomous SRE chat: message count + "Clear chat".
// Clearing is a two-step action (Clear chat → Confirm / Cancel) so a stray click
// does not wipe the conversation. It is disabled while a request is in flight.

export default function ChatToolbar({ messageCount, busy, onClear }) {
  const [confirming, setConfirming] = useState(false);

  // Drop a pending confirmation when the chat empties or becomes busy.
  useEffect(() => {
    if (messageCount === 0 || busy) setConfirming(false);
  }, [messageCount, busy]);

  const disabled = messageCount === 0 || busy;

  const btn = (extra = {}) => ({
    fontFamily: 'inherit', fontSize: 12, padding: '4px 12px', borderRadius: 2,
    border: '1px solid var(--cds-border-strong-01, #6f6f6f)', background: 'transparent',
    color: 'var(--cds-text-primary)', cursor: 'pointer', ...extra,
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '6px 16px', borderBottom: '1px solid var(--cds-border-subtle-01)',
      background: 'var(--cds-layer-01)', flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }} aria-live="polite">
        {messageCount === 0 ? 'No messages' : `${messageCount} message${messageCount === 1 ? '' : 's'}`}
      </span>

      {confirming ? (
        <span role="group" aria-label="Confirm clearing the chat" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--cds-text-primary)' }}>Clear all messages?</span>
          <button type="button" autoFocus onClick={() => { setConfirming(false); onClear(); }}
            style={btn({ background: '#da1e28', borderColor: '#da1e28', color: '#fff' })}>
            Clear
          </button>
          <button type="button" onClick={() => setConfirming(false)} style={btn()}>Cancel</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} disabled={disabled}
          title={busy ? 'Wait for the current response to finish' : 'Remove all messages from this conversation'}
          style={btn(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {})}>
          🗑 Clear chat
        </button>
      )}
    </div>
  );
}
