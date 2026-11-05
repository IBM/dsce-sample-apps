import React from 'react';

export default function StatusBar({ serverStatus, messageCount }) {
  const pending = serverStatus === null;
  const mock = serverStatus?.streamMode === 'mock';
  const connected = serverStatus?.mcpConnected;
  const toolCount = serverStatus?.toolCount ?? 0;
  const instanaUrl = serverStatus?.instanaUrl;
  const bobModel = serverStatus?.bobModel;

  return (
    <div
      style={{
        background: pending ? '#393939' : mock ? '#8e6a00' : connected ? 'var(--cds-button-primary)' : '#6f1d1d',
        height: '22px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1rem',
        gap: '1.5rem',
        flexShrink: 0,
        fontSize: '0.68rem',
        color: 'rgba(255,255,255,0.85)',
        fontFamily: 'IBM Plex Mono, monospace',
        letterSpacing: '0.02em',
      }}
    >
      {/* Connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: pending ? '#a8a8a8' : mock ? '#f1c21b' : connected ? '#42be65' : '#ff8389',
            flexShrink: 0,
          }}
        />
        {pending ? 'Connecting…' : mock ? 'STREAM_MODE=mock · mock data' : connected ? `MCP Connected · ${toolCount} tools` : 'MCP Disconnected'}
      </div>

      {!mock && instanaUrl && instanaUrl !== 'not configured' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ opacity: 0.6 }}>⬡</span>
          {instanaUrl.replace('https://', '')}
        </div>
      )}

      {!mock && bobModel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ opacity: 0.6 }}>◆</span>
          {bobModel}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {messageCount > 0 && (
        <div>{messageCount} message{messageCount !== 1 ? 's' : ''}</div>
      )}

      <div>Instana AI · Bob Inference · MCP</div>
    </div>
  );
}
