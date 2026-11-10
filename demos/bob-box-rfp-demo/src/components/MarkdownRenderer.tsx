/**
 * Lightweight, security-hardened markdown renderer.
 *
 * Security model
 * ──────────────
 * Content originates from an LLM and is therefore untrusted.
 * Every text segment is escaped before it is placed inside a React element;
 * we never use dangerouslySetInnerHTML.  Patterns are matched on the *raw*
 * input string and converted to React nodes with properly-escaped children.
 *
 * Supported subset (sufficient for RFP responses produced by this app):
 *   # / ## / ###  headings
 *   **text**       bold
 *   *text* / _text_  italic
 *   `code`         inline code
 *   - / * / + bullets (plain list, no nesting)
 *   |col|…        simple GitHub-flavour tables
 *   OPEN ITEM:     highlighted callout lines
 *   [Citation]     bracketed citation spans
 *   ---            horizontal rule
 *   blank lines    paragraph breaks
 */

import React from 'react';

// ─── Escaping ─────────────────────────────────────────────────────────────────

/** Renders a string as a plain text React node — no HTML interpretation. */
const T: React.FC<{ children: string }> = ({ children }) => <>{children}</>;

// ─── Inline parser ────────────────────────────────────────────────────────────

type InlineNode =
  | { k: 'text'; v: string }
  | { k: 'bold'; v: string }
  | { k: 'italic'; v: string }
  | { k: 'code'; v: string }
  | { k: 'citation'; v: string };

/**
 * Tokenises inline markdown in `raw` into typed nodes.
 * Operates purely on strings — no HTML is emitted here.
 */
function parseInline(raw: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // Patterns tried left-to-right; first match wins at each position.
  const patterns: Array<{ re: RegExp; k: InlineNode['k'] }> = [
    { re: /`([^`]+)`/, k: 'code' },
    { re: /\*\*([^*]+)\*\*/, k: 'bold' },
    { re: /\*([^*]+)\*/, k: 'italic' },
    { re: /_([^_]+)_/, k: 'italic' },
    { re: /\[([^\]]+)\](?!\()/, k: 'citation' }, // [Foo] not followed by ( — avoids link syntax
  ];

  let rest = raw;
  while (rest.length > 0) {
    let earliest: { idx: number; len: number; node: InlineNode } | null = null;
    for (const { re, k } of patterns) {
      const m = rest.match(re);
      if (!m || m.index === undefined) continue;
      if (!earliest || m.index < earliest.idx) {
        earliest = { idx: m.index, len: m[0].length, node: { k, v: m[1] } as InlineNode };
      }
    }
    if (!earliest) {
      nodes.push({ k: 'text', v: rest });
      break;
    }
    if (earliest.idx > 0) nodes.push({ k: 'text', v: rest.slice(0, earliest.idx) });
    nodes.push(earliest.node);
    rest = rest.slice(earliest.idx + earliest.len);
  }
  return nodes;
}

function renderInline(raw: string, keyPrefix: string): React.ReactNode[] {
  return parseInline(raw).map((node, i) => {
    const k = `${keyPrefix}-${i}`;
    switch (node.k) {
      case 'bold':
        return <strong key={k} className="font-semibold text-gray-900"><T>{node.v}</T></strong>;
      case 'italic':
        return <em key={k} className="italic text-gray-700"><T>{node.v}</T></em>;
      case 'code':
        return (
          <code key={k} className="px-1 py-0.5 rounded bg-gray-100 text-[11px] font-mono text-gray-800 border border-gray-200">
            <T>{node.v}</T>
          </code>
        );
      case 'citation':
        return (
          <span key={k} className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200 mx-0.5">
            <T>{node.v}</T>
          </span>
        );
      default:
        return <T key={k}>{node.v}</T>;
    }
  });
}

// ─── Block parser ─────────────────────────────────────────────────────────────

type Block =
  | { k: 'h1' | 'h2' | 'h3'; text: string }
  | { k: 'bullet'; text: string }
  | { k: 'openItem'; text: string }
  | { k: 'hr' }
  | { k: 'tableHeader'; cols: string[] }
  | { k: 'tableSep' }
  | { k: 'tableRow'; cols: string[] }
  | { k: 'blank' }
  | { k: 'para'; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine; // preserve content but analyse trimmed
    const t = line.trim();
    if (!t) { blocks.push({ k: 'blank' }); continue; }
    if (/^---+$/.test(t)) { blocks.push({ k: 'hr' }); continue; }
    if (t.startsWith('### ')) { blocks.push({ k: 'h3', text: t.slice(4) }); continue; }
    if (t.startsWith('## ')) { blocks.push({ k: 'h2', text: t.slice(3) }); continue; }
    if (t.startsWith('# ')) { blocks.push({ k: 'h1', text: t.slice(2) }); continue; }
    if (/^[-*+] /.test(t)) { blocks.push({ k: 'bullet', text: t.slice(2) }); continue; }
    if (/^\d+\. /.test(t)) { blocks.push({ k: 'bullet', text: t.replace(/^\d+\.\s+/, '') }); continue; }
    if (/^OPEN ITEM:/i.test(t)) { blocks.push({ k: 'openItem', text: t }); continue; }
    if (t.startsWith('|')) {
      const cols = t.split('|').slice(1, -1).map(c => c.trim());
      if (cols.every(c => /^[-:]+$/.test(c))) { blocks.push({ k: 'tableSep' }); continue; }
      // Check if it's after a tableSep → row, otherwise header
      const last = blocks[blocks.length - 1];
      if (last?.k === 'tableSep' || last?.k === 'tableRow') {
        blocks.push({ k: 'tableRow', cols });
      } else {
        blocks.push({ k: 'tableHeader', cols });
      }
      continue;
    }
    blocks.push({ k: 'para', text: t });
  }
  return blocks;
}

// ─── Block → React ────────────────────────────────────────────────────────────

function renderBlocks(blocks: Block[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let tableHeaderCols: string[] | null = null;
  let tableRowsBuffer: string[][] = [];
  let paraBuffer: string[] = [];

  const flushBullets = (key: string) => {
    if (!bulletBuffer.length) return;
    out.push(
      <ul key={key} className="my-2 space-y-1 pl-4">
        {bulletBuffer.map((text, i) => (
          <li key={i} className="flex items-start space-x-1.5 text-sm text-gray-700">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            <span>{renderInline(text, `b-${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  const flushTable = (key: string) => {
    if (!tableHeaderCols) return;
    out.push(
      <div key={key} className="my-3 overflow-x-auto">
        <table className="w-full text-xs border-collapse border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              {tableHeaderCols.map((col, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                  {renderInline(col, `th-${key}-${i}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRowsBuffer.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-gray-700 border-b border-gray-100">
                    {renderInline(cell, `td-${key}-${ri}-${ci}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeaderCols = null;
    tableRowsBuffer = [];
  };

  const flushPara = (key: string) => {
    if (!paraBuffer.length) return;
    const combined = paraBuffer.join(' ');
    out.push(
      <p key={key} className="text-sm text-gray-700 leading-relaxed my-1.5">
        {renderInline(combined, `p-${key}`)}
      </p>
    );
    paraBuffer = [];
  };

  blocks.forEach((block, idx) => {
    const key = String(idx);

    // Anything that isn't a continuation flushes pending buffers
    if (block.k !== 'bullet' && bulletBuffer.length) flushBullets(`ul-${idx}`);
    if (block.k !== 'tableHeader' && block.k !== 'tableSep' && block.k !== 'tableRow' && tableHeaderCols !== null) {
      flushTable(`tbl-${idx}`);
    }
    if (block.k !== 'para' && block.k !== 'blank' && paraBuffer.length) flushPara(`par-${idx}`);

    switch (block.k) {
      case 'h1':
        out.push(
          <h2 key={key} className="text-lg font-bold text-gray-900 mt-5 mb-2 pb-1.5 border-b border-gray-200">
            {renderInline(block.text, `h1-${key}`)}
          </h2>
        );
        break;
      case 'h2':
        out.push(
          <h3 key={key} className="text-base font-bold text-gray-800 mt-4 mb-1.5">
            {renderInline(block.text, `h2-${key}`)}
          </h3>
        );
        break;
      case 'h3':
        out.push(
          <h4 key={key} className="text-sm font-semibold text-gray-800 mt-3 mb-1">
            {renderInline(block.text, `h3-${key}`)}
          </h4>
        );
        break;
      case 'bullet':
        bulletBuffer.push(block.text);
        break;
      case 'openItem':
        out.push(
          <div
            key={key}
            className="my-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm font-medium flex items-start space-x-2"
          >
            <span className="mt-0.5 text-amber-600 font-bold text-[11px] uppercase tracking-wide flex-shrink-0">⚠</span>
            <span>{renderInline(block.text, `oi-${key}`)}</span>
          </div>
        );
        break;
      case 'hr':
        out.push(<hr key={key} className="my-4 border-gray-200" />);
        break;
      case 'tableHeader':
        flushBullets(`ul-${idx}`);
        tableHeaderCols = block.cols;
        tableRowsBuffer = [];
        break;
      case 'tableSep':
        // consumed — just signals the next rows are body rows
        break;
      case 'tableRow':
        if (tableHeaderCols) tableRowsBuffer.push(block.cols);
        break;
      case 'blank':
        if (paraBuffer.length) {
          flushPara(`par-${idx}`);
        }
        break;
      case 'para':
        paraBuffer.push(block.text);
        break;
    }
  });

  // Flush any remaining buffers
  flushBullets('ul-end');
  flushTable('tbl-end');
  flushPara('par-end');

  return out;
}

// ─── Public component ─────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  /** Untrusted LLM-produced markdown string. */
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const blocks = parseBlocks(content);
  const nodes = renderBlocks(blocks);
  return (
    <div className={`min-w-0 ${className}`}>
      {nodes}
    </div>
  );
};
