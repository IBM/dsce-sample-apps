import { marked } from 'marked';
import createDOMPurify from 'dompurify';

export function renderMarkdown(text, document = window.document) {
  if (text.length > 200000) {
    const fragment = document.createDocumentFragment(), pre = document.createElement('pre');
    pre.textContent = text; fragment.append(pre); return fragment;
  }
  const purifier = createDOMPurify(document.defaultView);
  return purifier.sanitize(marked.parse(text, { gfm: true, breaks: false, async: false }), {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','del','ul','ol','li','pre','code','blockquote','table','thead','tbody','tr','th','td','a'],
    ALLOWED_ATTR: ['href','title'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false
  });
}
export function artifactPath(href) {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(href)) return null;
  try {
    const path = decodeURIComponent(href.split(/[?#]/)[0]).replace(/^(\.\/)+/, '');
    if (!path || path.length > 4096 || /[\\\x00-\x1f\x7f]/.test(path) || path.split('/').some(part => !part || part.startsWith('.'))) return null;
    return path;
  } catch { return null; }
}
