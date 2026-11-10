import React from 'react';
import instanaImg from '../assets/instana.png';
import bobImg from '../assets/bob.png';

// ── 1. Instana MCP Server Icon (Exact Image Asset) ───────────────────────────
export function InstanaMcpIcon({ size = 32, style = {}, className = '' }) {
  return (
    <img
      src={instanaImg}
      alt="Instana Observability"
      width={size}
      height={size}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    />
  );
}

// ── 2. Official Bob Mascot Avatar (Exact Image Asset) ────────────────────────
export function BobMascotIcon({ size = 36, style = {}, className = '' }) {
  return (
    <img
      src={bobImg}
      alt="IBM Bob SRE Mascot"
      width={size}
      height={Math.round(size * 1.35)}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    />
  );
}
