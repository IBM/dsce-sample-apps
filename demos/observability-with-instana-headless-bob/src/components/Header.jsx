import React from 'react';
import { InstanaMcpIcon } from './Icons.jsx';

const MenuIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--cds-icon-primary)">
    {open ? (
      <>
        <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </>
    )}
  </svg>
);

export default function Header({
  sidebarOpen,
  onToggleSidebar,
  serverStatus,
  activeView,
  showHeadlessBob,
  onToggleHeadlessBob,
}) {
  // Live state only: no optimistic defaults. `null` serverStatus means "still connecting".
  const mock = serverStatus?.streamMode === 'mock';
  const connected = serverStatus?.mcpConnected === true;
  const toolCount = serverStatus?.toolCount ?? 0;

  return (
    <header
      style={{
        background: '#000000',
        borderBottom: '1px solid var(--cds-border-subtle-01)',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1rem',
        gap: '0.75rem',
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--cds-icon-primary)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cds-background-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        <MenuIcon open={sidebarOpen} />
      </button>

      {/* Logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <InstanaMcpIcon size={26} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#ffffff', letterSpacing: '0.01em' }}>
            IBM Instana Observability
          </span>
          <span style={{ color: 'var(--cds-text-secondary)', fontSize: '0.8rem', fontWeight: 300 }}>|</span>
          <span style={{ fontSize: '0.8rem', color: '#78a9ff', fontWeight: 500 }}>
            Autonomous SRE Platform
          </span>
        </div>
        <span
          style={{
            fontSize: '0.65rem',
            color: '#a6c8ff',
            background: 'rgba(15, 98, 254, 0.2)',
            border: '1px solid rgba(15, 98, 254, 0.4)',
            padding: '1px 6px',
            borderRadius: '3px',
            fontFamily: 'IBM Plex Mono, monospace',
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginLeft: '2px',
          }}
        >
          GENAI SRE ENGINE
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Headless Bob panel expand / contract (chat view only) */}
      {activeView === 'chat' && onToggleHeadlessBob && (
        <button
          onClick={onToggleHeadlessBob}
          aria-pressed={showHeadlessBob}
          title={showHeadlessBob ? 'Contract Headless Bob Panel' : 'Expand Headless Bob Panel'}
          style={{
            background: showHeadlessBob ? 'rgba(15, 98, 254, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: `1px solid ${showHeadlessBob ? 'rgba(15, 98, 254, 0.6)' : 'var(--cds-border-subtle-01)'}`,
            color: showHeadlessBob ? '#78a9ff' : 'var(--cds-text-secondary)',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginRight: '0.5rem',
            fontFamily: 'inherit',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              d="M2 2h2v12H2V2zm11.7 5.3L9.4 3 8 4.4l3.3 3.3H5v1.6h6.3L8 12.6l1.4 1.4 4.3-4.3c.4-.4.4-1 0-1.4z"
              transform={showHeadlessBob ? 'scale(-1, 1) translate(-16, 0)' : undefined}
            />
          </svg>
          <span>{showHeadlessBob ? 'Contract Bob Panel' : 'Expand Bob Panel'}</span>
        </button>
      )}

      {/* Data source status: simulated (mock) or live Instana MCP (realtime) */}
      <div
        title={mock ? 'STREAM_MODE=mock: all data is mock data; Instana is not queried.' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: mock ? '#f1c21b' : connected ? 'var(--cds-support-success)' : 'var(--cds-support-error)',
          background: mock ? 'rgba(241, 194, 27, 0.12)' : connected ? 'var(--cds-tag-green-background)' : 'var(--cds-tag-red-background)',
          padding: '3px 10px',
          borderRadius: '2px',
          border: `1px solid ${mock ? '#8e6a00' : connected ? '#0e4e2a' : '#5a1e22'}`,
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: mock ? '#f1c21b' : connected ? 'var(--cds-support-success)' : 'var(--cds-support-error)',
            flexShrink: 0,
          }}
        />
        {serverStatus === null
          ? 'Connecting…'
          : mock
          ? 'MOCK DATA'
          : connected
          ? `Instana MCP · ${toolCount} tools`
          : 'MCP Disconnected'}
      </div>
    </header>
  );
}
