/**
 * Markdown → HTML renderer (zero external deps).
 * Handles: # headings, **bold**, *italic*, `code`, bullet/numbered lists,
 *          pipe tables, [text](url), horizontal rules.
 */
export function renderMarkdown(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const html  = [];
  let inUl    = false;
  let inOl    = false;
  let inTable = false;
  let tableHeaderDone = false;

  const closeOpenBlocks = () => {
    if (inUl)    { html.push('</ul>');    inUl    = false; }
    if (inOl)    { html.push('</ol>');    inOl    = false; }
    if (inTable) { html.push('</tbody></table>'); inTable = false; tableHeaderDone = false; }
  };

  // Inline formatting applied to every line
  const inline = (str) =>
    str
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`([^`]+)`/g,     '<code>$1</code>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

  for (const raw of lines) {
    const line = raw.trimEnd();

    // ── Headings ─────────────────────────────────────────────────────────────
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      closeOpenBlocks();
      const level = Math.min(h[1].length + 1, 6); // ## → h3, ### → h4 for visual hierarchy
      html.push(`<h${level} class="md-h${level}">${inline(h[2])}</h${level}>`);
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (/^---+$/.test(line.trim())) {
      closeOpenBlocks();
      html.push('<hr class="md-hr" />');
      continue;
    }

    // ── Pipe table ────────────────────────────────────────────────────────────
    if (/^\s*\|/.test(line)) {
      // Skip separator rows like |---|---|
      if (/^\s*\|[\s|:-]+\|[\s|:-]*$/.test(line)) {
        if (inTable && !tableHeaderDone) {
          html.push('</thead><tbody>');
          tableHeaderDone = true;
        }
        continue;
      }

      const cells = line
        .split('|')
        .slice(1, -1)          // drop leading/trailing empty strings
        .map(c => inline(c.trim()));

      if (!inTable) {
        closeOpenBlocks();
        html.push('<div class="md-table-wrap"><table class="md-table"><thead><tr>');
        cells.forEach(c => html.push(`<th>${c}</th>`));
        html.push('</tr>');
        inTable = true;
        tableHeaderDone = false;
      } else {
        html.push('<tr>');
        cells.forEach(c => html.push(`<td>${c}</td>`));
        html.push('</tr>');
      }
      continue;
    }

    // ── Bullet list ───────────────────────────────────────────────────────────
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (ulMatch) {
      if (inTable) closeOpenBlocks();
      if (inOl)  { html.push('</ol>'); inOl = false; }
      if (!inUl) { html.push('<ul class="md-ul">'); inUl = true; }
      html.push(`<li>${inline(ulMatch[2])}</li>`);
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────────
    const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
    if (olMatch) {
      if (inTable) closeOpenBlocks();
      if (inUl)  { html.push('</ul>'); inUl = false; }
      if (!inOl) { html.push('<ol class="md-ol">'); inOl = true; }
      html.push(`<li>${inline(olMatch[1])}</li>`);
      continue;
    }

    // ── Blank line / paragraph ────────────────────────────────────────────────
    closeOpenBlocks();
    if (line.trim() === '') {
      // intentional gap — skip (lists/tables already closed above)
    } else {
      html.push(`<p class="md-p">${inline(line)}</p>`);
    }
  }

  closeOpenBlocks();
  return html.join('');
}

/** React component that renders markdown safely. */
export function MarkdownText({ text, className = '' }) {
  return (
    <div
      className={`markdown-text ${className}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}
