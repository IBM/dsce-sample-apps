import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderMarkdown, artifactPath } from '../browser/markdown.js';
test('Markdown renders structure while removing executable HTML', () => {
  const { document } = new JSDOM('').window;
  const fragment = renderMarkdown('# Heading\n\n**Bold** and [file](tetris.html)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```html\n<script>alert(1)</script>\n```\n\n<script>bad()</script><img src=x onerror=bad()><iframe src=x></iframe><a href="javascript:bad()" onclick="bad()">unsafe</a>', document);
  assert.equal(fragment.querySelector('h1')?.textContent, 'Heading');
  assert.equal(fragment.querySelector('strong')?.textContent, 'Bold');
  assert.equal(fragment.querySelectorAll('td').length, 2);
  assert.match(fragment.querySelector('pre code')?.textContent ?? '', /<script>/);
  assert.equal(fragment.querySelector('script,img,iframe,[onclick],[onerror]'), null);
  assert.equal(fragment.querySelector('a[href^="javascript:"]'), null);
  assert.equal(fragment.querySelector('a')?.getAttribute('href'), 'tetris.html');
});
test('artifact links normalize safe paths and reject traversal or external schemes', () => {
  assert.equal(artifactPath('./nested/t%C3%A9tris.html'), 'nested/tétris.html');
  for (const path of ['../secret', '%2e%2e/secret', '/etc/passwd', 'https://example.com', 'javascript:bad()', 'a\\b', '.env', '%00', '//evil/x']) assert.equal(artifactPath(path), null, path);
});
