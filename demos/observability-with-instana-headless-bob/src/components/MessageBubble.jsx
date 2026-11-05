import React, { useState } from 'react';
import { InstanaMcpIcon, BobMascotIcon } from './Icons.jsx';

// Minimal markdown renderer (handles the patterns used in Instana responses)
function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  let tableBuffer = [];
  let inTable = false;
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = '';

  const flushTable = (key) => {
    if (tableBuffer.length < 2) {
      tableBuffer.forEach((l, li) =>
        elements.push(<p key={`${key}-tp-${li}`} style={{ color: 'var(--cds-text-secondary)', margin: '0.25rem 0' }}>{l}</p>)
      );
      tableBuffer = [];
      return;
    }
    const headers = tableBuffer[0].split('|').map((h) => h.trim()).filter(Boolean);
    const rows = tableBuffer.slice(2).map((row) => row.split('|').map((c) => c.trim()).filter(Boolean));
    elements.push(
      <table key={`${key}-table`} style={{ width: '100%', borderCollapse: 'collapse', margin: '0.75rem 0', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            {headers.map((h, hi) => (
              <th key={hi} style={{ background: 'var(--cds-layer-02)', color: 'var(--cds-text-primary)', fontWeight: 600, textAlign: 'left', padding: '0.5rem 0.75rem', border: '1px solid var(--cds-border-subtle-01)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '0.45rem 0.75rem', border: '1px solid var(--cds-border-subtle-01)', color: 'var(--cds-text-secondary)' }}>
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    tableBuffer = [];
    inTable = false;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        elements.push(
          <pre key={`code-${i}`} style={{ background: 'var(--cds-layer-02)', border: '1px solid var(--cds-border-subtle-01)', borderRadius: 'var(--radius-md)', padding: '1rem', overflowX: 'auto', margin: '0.75rem 0' }}>
            <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem', color: '#a8c7fa', whiteSpace: 'pre' }}>
              {codeLines.join('\n')}
            </code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
      }
      i++;
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); i++; continue; }

    // Table row
    if (line.startsWith('|')) {
      inTable = true;
      tableBuffer.push(line);
      i++;
      continue;
    }
    if (inTable) flushTable(i);

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ color: 'var(--cds-text-primary)', fontWeight: 600, fontSize: '1rem', margin: '1rem 0 0.4rem' }}><InlineMarkdown text={line.slice(4)} /></h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: 'var(--cds-text-primary)', fontWeight: 600, fontSize: '1.1rem', margin: '1.2rem 0 0.4rem', borderBottom: '1px solid var(--cds-border-subtle-01)', paddingBottom: '0.3rem' }}><InlineMarkdown text={line.slice(3)} /></h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: 'var(--cds-text-primary)', fontWeight: 300, fontSize: '1.35rem', margin: '1.2rem 0 0.5rem' }}><InlineMarkdown text={line.slice(2)} /></h1>);
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ borderLeft: '3px solid var(--cds-interactive)', margin: '0.75rem 0', padding: '0.5rem 1rem', background: 'var(--cds-layer-01)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
          <span style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}><InlineMarkdown text={line.slice(2)} /></span>
        </blockquote>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '0.5rem', margin: '0.2rem 0', paddingLeft: '0.5rem' }}>
          <span style={{ color: 'var(--cds-text-secondary)', flexShrink: 0, marginTop: '0.1rem' }}>•</span>
          <span style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}><InlineMarkdown text={line.slice(2)} /></span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)[1];
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '0.5rem', margin: '0.2rem 0', paddingLeft: '0.5rem' }}>
          <span style={{ color: 'var(--cds-interactive)', flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem', minWidth: '20px' }}>{num}.</span>
          <span style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}><InlineMarkdown text={line.replace(/^\d+\.\s/, '')} /></span>
        </div>
      );
    } else if (line.startsWith('---') || line.startsWith('***')) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--cds-border-subtle-01)', margin: '1rem 0' }} />);
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '0.4rem' }} />);
    } else {
      elements.push(
        <p key={i} style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0.25rem 0' }}>
          <InlineMarkdown text={line} />
        </p>
      );
    }
    i++;
  }

  if (inTable) flushTable('end');

  return elements;
}

function InlineMarkdown({ text }) {
  // bold, italic, code, emoji pass-through
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    const matches = [
      boldMatch && { index: boldMatch.index, type: 'bold', match: boldMatch },
      codeMatch && { index: codeMatch.index, type: 'code', match: codeMatch },
      linkMatch && { index: linkMatch.index, type: 'link', match: linkMatch },
    ].filter(Boolean);

    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const first = matches.sort((a, b) => a.index - b.index)[0];

    if (first.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, first.index)}</span>);
    }

    if (first.type === 'bold') {
      parts.push(<strong key={key++} style={{ color: 'var(--cds-text-primary)', fontWeight: 600 }}>{first.match[1]}</strong>);
      remaining = remaining.slice(first.index + first.match[0].length);
    } else if (first.type === 'code') {
      parts.push(
        <code key={key++} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem', background: 'var(--cds-layer-02)', color: '#78a9ff', padding: '0.1em 0.35em', borderRadius: '2px' }}>
          {first.match[1]}
        </code>
      );
      remaining = remaining.slice(first.index + first.match[0].length);
    } else if (first.type === 'link') {
      // LLM output is untrusted: only render http(s) links (blocks javascript:, data:, etc.)
      if (/^https?:\/\//i.test(first.match[2].trim())) {
        parts.push(
          <a key={key++} href={first.match[2].trim()} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--cds-link-primary)' }}>
            {first.match[1]}
          </a>
        );
      } else {
        parts.push(<span key={key++}>{first.match[1]}</span>);
      }
      remaining = remaining.slice(first.index + first.match[0].length);
    }
  }

  return <>{parts}</>;
}

function ToolCallsBadge({ toolCalls }) {
  const [expanded, setExpanded] = useState(false);
  if (!toolCalls?.length) return null;

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          background: 'none',
          border: '1px solid var(--cds-border-subtle-01)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          padding: '3px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          color: 'var(--cds-text-secondary)',
          fontSize: '0.72rem',
          fontFamily: 'inherit',
          transition: 'all 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cds-layer-hover-01)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="M6 2l2 2-2 2M10 14l-2-2 2-2M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M0 2l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        </svg>
      </button>

      {expanded && (
        <div
          style={{
            marginTop: '4px',
            background: 'var(--cds-layer-02)',
            border: '1px solid var(--cds-border-subtle-01)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          {toolCalls.map((tc, i) => (
            <div
              key={i}
              style={{
                padding: '0.4rem 0.75rem',
                borderBottom: i < toolCalls.length - 1 ? '1px solid var(--cds-border-subtle-01)' : 'none',
              }}
            >
              <div
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '0.72rem',
                  color: '#78a9ff',
                }}
              >
                {tc.tool}
              </div>
              {tc.input && Object.keys(tc.input).length > 0 && (
                <div style={{ fontSize: '0.68rem', color: 'var(--cds-text-placeholder)', marginTop: '2px', fontFamily: 'IBM Plex Mono, monospace' }}>
                  {JSON.stringify(tc.input).slice(0, 120)}
                  {JSON.stringify(tc.input).length > 120 ? '…' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Bob robot avatar
function BobAvatar() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #0f62fe 0%, #002d9c 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px rgba(15, 98, 254, 0.4)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <BobMascotIcon size={24} />
    </div>
  );
}

export default function MessageBubble({ message, onInvestigate }) {
  const isUser      = message.role === 'user';
  const isError     = message.role === 'error';
  const isHBob      = message.isHeadlessBob;
  const isAlert     = message.isAutonomousAlert;
  const isCritAlert = isAlert && (message.severity === 'critical' || message.severity === 'CRITICAL');

  return (
    <div
      style={{
        padding: '0.25rem 1.5rem',
        maxWidth: '900px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {isUser ? (
        /* User message */
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
          <div
            style={{
              background: 'var(--cds-button-primary)',
              color: 'var(--cds-text-on-color)',
              borderRadius: '4px 4px 0 4px',
              padding: '0.625rem 0.875rem',
              maxWidth: '72%',
              fontSize: '0.875rem',
              lineHeight: 1.5,
            }}
          >
            {message.content}
          </div>
        </div>
      ) : (
        /* Assistant or error message */
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0, marginTop: '2px' }}>
            {isError ? (
              <div style={{ width: 28, height: 28, background: 'var(--cds-support-error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3v5M8 11v1" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
            ) : isHBob ? (
              <BobAvatar />
            ) : (
              <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <InstanaMcpIcon size={26} />
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '0.3rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isError ? 'var(--cds-support-error)' : isHBob ? '#0f62fe' : 'var(--cds-text-primary)' }}>
                {isError ? 'Error' : isAlert ? 'Headless Bob — Autonomous Alert' : isHBob ? 'Headless Bob' : 'Instana Assistant'}
              </span>
              {isAlert && (
                <span style={{
                  fontSize: '0.65rem',
                  background: isCritAlert ? '#da1e28' : '#f1c21b',
                  color: isCritAlert ? '#fff' : '#161616',
                  padding: '1px 7px',
                  borderRadius: 3,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}>
                  {isCritAlert ? '🔴 CRITICAL ALERT' : '🟡 WARNING'}
                </span>
              )}
              {isHBob && !isAlert && (
                <span style={{ fontSize: '0.65rem', background: '#0f3460', color: '#78a9ff', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>
                  headlessbob
                </span>
              )}
              {isAlert && message.errorRate !== null && message.errorRate !== undefined && (
                <span style={{ fontSize: '0.68rem', color: isCritAlert ? '#ff8389' : '#f1c21b', background: 'var(--cds-layer-02)', padding: '1px 6px', borderRadius: 3 }}>
                  err: <strong>{message.errorRate}%</strong>
                </span>
              )}
              {isAlert && message.p90Latency && (
                <span style={{ fontSize: '0.68rem', color: 'var(--cds-text-secondary)', background: 'var(--cds-layer-02)', padding: '1px 6px', borderRadius: 3 }}>
                  p90: <strong>{message.p90Latency}ms</strong>
                </span>
              )}
              <span style={{ fontSize: '0.68rem', color: 'var(--cds-text-placeholder)' }}>
                {formatTime(message.timestamp)}
              </span>
              {message.iterations > 1 && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--cds-text-placeholder)',
                    background: 'var(--cds-layer-02)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                >
                  {message.iterations} steps
                </span>
              )}
            </div>

            <ToolCallsBadge toolCalls={message.toolCalls} />

            <div
              style={{
                background: isError
                  ? 'var(--cds-tag-red-background)'
                  : isAlert
                  ? (isCritAlert ? 'rgba(218, 30, 40, 0.08)' : 'rgba(241, 194, 27, 0.08)')
                  : 'transparent',
                border: isError
                  ? '1px solid #5a1e22'
                  : isAlert
                  ? `1px solid ${isCritAlert ? '#da1e28' : '#f1c21b'}`
                  : 'none',
                borderLeft: isAlert
                  ? `4px solid ${isCritAlert ? '#da1e28' : '#f1c21b'}`
                  : undefined,
                borderRadius: isError || isAlert ? 'var(--radius-md)' : 0,
                padding: isError || isAlert ? '0.75rem 1rem' : 0,
              }}
            >
              {isError ? (
                <p style={{ color: 'var(--cds-support-error)', fontSize: '0.875rem' }}>{message.content}</p>
              ) : (
                <>
                  {renderMarkdown(message.content)}
                  {isAlert && onInvestigate && (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.6rem', borderTop: '1px solid var(--cds-border-subtle-01)' }}>
                      <button
                        onClick={() => onInvestigate(`Investigate root cause of this critical anomaly detected in Retail Application: ${message.content.slice(0, 200)}`)}
                        style={{
                          background: 'var(--cds-layer-02)',
                          border: '1px solid #0f62fe',
                          color: '#78a9ff',
                          padding: '5px 12px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '0.775rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#0f62fe'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cds-layer-02)'; e.currentTarget.style.color = '#78a9ff'; }}
                      >
                        <span>🔍</span> Investigate Root Cause in Chat
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timestamp under user message */}
      {isUser && (
        <div style={{ textAlign: 'right', fontSize: '0.68rem', color: 'var(--cds-text-placeholder)', marginTop: '2px' }}>
          {formatTime(message.timestamp)}
        </div>
      )}
    </div>
  );
}
