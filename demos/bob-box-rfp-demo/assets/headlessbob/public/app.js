'use strict';
const $ = id => document.getElementById(id);
const state = { token: '', session: 0, view: 0, listRequest: 0, thread: null, run: null, messages: [], threads: [], nextThreads: null, nextMessages: null, archived: false, sending: false, watch: null, pendingSend: null, drafts: new Map() };
const finalStatuses = new Set(['completed', 'failed', 'cancelled']);
const labels = { created: 'Queued', 'in-progress': 'Bob is working', cancelling: 'Stopping…', cancelled: 'Cancelled', failed: 'Failed', completed: 'Completed' };
const messageNodes = new Map();
let filesPath = '', filesRequest = 0;
function messageContent(node, text, role, threadId) {
  if (role !== 'assistant') { node.textContent = text; return; }
  node.replaceChildren(HeadlessMarkdown.renderMarkdown(text));
  for (const link of node.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '', path = HeadlessMarkdown.artifactPath(href);
    if (path && threadId) {
      link.href = '#'; link.title = `Download ${path}`;
      link.addEventListener('click', event => { event.preventDefault(); downloadFile(threadId, path).catch(report); });
    } else if (/^https?:\/\//i.test(href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else link.removeAttribute('href');
  }
}
async function downloadFile(threadId, path) {
  const session = state.session;
  const response = await fetch(`/api/v1/threads/${threadId}/files/download?path=${encodeURIComponent(path)}`, { headers: state.token ? { Authorization: `Bearer ${state.token}` } : {} });
  if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || 'Download failed'); }
  const blob = await response.blob(); if (session !== state.session) throw abortError();
  const url = URL.createObjectURL(blob), anchor = el('a');
  anchor.href = url; anchor.download = path.split('/').at(-1); document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function loadFiles(path = filesPath) {
  const threadId = state.thread?.id, version = ++filesRequest;
  $('files-panel').hidden = !threadId;
  if (!threadId) return;
  filesPath = path; $('files-path').textContent = path ? `/${path}` : '/'; $('files-up').hidden = !path;
  $('file-list').replaceChildren(); $('files-note').textContent = 'Loading workspace files…';
  try {
    const page = await api(`/threads/${threadId}/files?path=${encodeURIComponent(path)}`);
    if (version !== filesRequest || threadId !== state.thread?.id) return;
    $('files-note').textContent = page.truncated ? 'Listing is limited. Open a subfolder to narrow the results.' : page.items.length ? 'Download files to your device. Open HTML files locally to run them. Maximum 25 MiB per file.' : 'No downloadable files in this folder yet.';
    const fragment = document.createDocumentFragment();
    for (const file of page.items) {
      const row = el('div', 'file-row'), name = el('span', 'file-name', file.name);
      const size = file.type === 'directory' ? 'Folder' : file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`;
      const action = el('button', 'button outline', file.type === 'directory' ? 'Open folder' : file.downloadable ? 'Download' : 'Over 25 MiB');
      action.disabled = file.type !== 'directory' && !file.downloadable;
      action.addEventListener('click', async () => { action.disabled = true; try { if (file.type === 'directory') await loadFiles(file.path); else await downloadFile(threadId, file.path); } catch (error) { report(error); } finally { action.disabled = false; } });
      row.append(name, el('span', 'file-size', size), action); fragment.append(row);
    }
    $('file-list').replaceChildren(fragment);
  } catch (error) { if (version === filesRequest && threadId === state.thread?.id && error.name !== 'AbortError') $('files-note').textContent = error.message; }
}
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
function abortError() { return new DOMException('View changed', 'AbortError'); }
function report(error) { if (error.name !== 'AbortError') notice(error.message || 'Something went wrong. Try refreshing.'); }
async function api(path, options = {}) {
  const session = state.session;
  let response;
  try { response = await fetch(`/api/v1${path}`, { ...options, headers: { ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); }
  catch (error) { if (error.name === 'AbortError') throw error; throw new Error('Could not reach the service. Check your connection and try again.'); }
  if (session !== state.session) throw abortError();
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error?.message || `Request failed (${response.status})`); error.code = body.error?.code; throw error; }
  return body;
}
function displayDate(value) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function renderThreads() {
  const fragment = document.createDocumentFragment();
  for (const thread of state.threads) {
    const button = el('button', `thread-item${thread.id === state.thread?.id ? ' current' : ''}`);
    button.title = thread.title; button.setAttribute('aria-current', thread.id === state.thread?.id ? 'page' : 'false');
    button.append(el('strong', '', thread.title), el('small', '', `${thread.status === 'running' ? '● Running · ' : ''}${displayDate(thread.updated_at)}`));
    button.addEventListener('click', () => selectThread(thread.id).catch(report)); fragment.append(button);
  }
  if (!state.threads.length) fragment.append(el('p', 'list-empty', $('search').value ? 'No matching threads.' : state.archived ? 'No archived threads.' : 'Your threads will appear here.'));
  $('thread-list').replaceChildren(fragment); $('more-threads').hidden = !state.nextThreads;
}
async function loadThreads(more = false) {
  const version = ++state.listRequest;
  const query = new URLSearchParams({ archived: String(state.archived), q: $('search').value });
  if (more && state.nextThreads) query.set('cursor', state.nextThreads);
  const page = await api(`/threads?${query}`);
  if (version !== state.listRequest) return;
  state.threads = more ? [...state.threads, ...page.items.filter(item => !state.threads.some(old => old.id === item.id))] : page.items;
  state.nextThreads = page.next_cursor; renderThreads();
}
function nearBottom() { const box = $('conversation'); return box.scrollHeight - box.scrollTop - box.clientHeight < 140; }
function scrollBottom() { $('conversation').scrollTop = $('conversation').scrollHeight; }
function usageSection(message) {
  const section = el('details', 'usage-details');
  section.append(el('summary', '', 'Usage'));
  const usage = message.usage;
  if (!usage) {
    section.append(el('p', '', finalStatuses.has(message.status) ? 'Usage was not recorded for this response.' : 'Usage will appear when Bob finishes.'));
    return section;
  }
  section.open = true;
  const list = el('dl', 'usage-metrics');
  const fields = [['duration_ms', 'Duration', value => `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`],
    ['session_costs', 'Session cost (Bob)', value => value.toLocaleString(undefined, { maximumFractionDigits: 6 })],
    ['tool_calls', 'Tool calls'], ['input_tokens', 'Input tokens'], ['output_tokens', 'Output tokens'],
    ['total_tokens', 'Total tokens'], ['cache_read_tokens', 'Cache read tokens'], ['cache_write_tokens', 'Cache write tokens']];
  for (const [key, label, format] of fields) {
    if (typeof usage[key] !== 'number') continue;
    const item = el('div'); item.append(el('dt', '', label), el('dd', '', format ? format(usage[key]) : usage[key].toLocaleString())); list.append(item);
  }
  section.append(list);
  return section;
}
function renderMessages() {
  const fragment = document.createDocumentFragment(); messageNodes.clear();
  for (const message of state.messages) {
    const article = el('article', `message ${message.role}`);
    article.append(el('div', 'avatar', message.role === 'assistant' ? 'b.' : 'You'));
    const body = el('div'); const top = el('div', 'message-top');
    const time = el('time', '', new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })); time.dateTime = message.created_at;
    const copy = el('button', 'text-button', 'Copy'); copy.type = 'button'; copy.setAttribute('aria-label', `Copy ${message.role === 'assistant' ? 'Bob response' : 'your message'}`);
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(message.content); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1500); } catch { notice('Copy is unavailable. Select and copy the message text instead.'); } });
    top.append(el('strong', '', message.role === 'assistant' ? 'Bob' : 'You'), time, copy);
    const content = el('div', `message-content${message.role === 'assistant' ? ' markdown' : ''}`);
    messageContent(content, message.content || (message.role === 'assistant' && !finalStatuses.has(message.status) ? 'Waiting for Bob…' : ''), message.role, state.thread?.id);
    const status = el('div', 'message-status', message.role === 'assistant' ? labels[message.status] || message.status : '');
    body.append(top, content, status);
    if (message.role === 'assistant') body.append(usageSection(message));
    if (message.error) body.append(el('p', 'message-error', message.error.message));
    article.append(body); fragment.append(article); messageNodes.set(message.id, { content, status });
  }
  $('messages').replaceChildren(fragment); $('empty-state').hidden = state.messages.length > 0;
  $('older-messages').hidden = !state.nextMessages;
}
function renderContext() {
  const thread = state.thread, run = state.run;
  const busy = thread?.status === 'running' || !!(run && !finalStatuses.has(run.status));
  const blocked = !!thread && ['archived', 'needs_new_thread'].includes(thread.status);
  $('thread-title').textContent = thread?.title || 'Your next thread';
  $('rename-thread').disabled = !thread; $('archive-thread').disabled = !thread || busy;
  $('show-files').disabled = !thread;
  $('files-panel').hidden = !thread;
  $('delete-thread').disabled = !thread || busy;
  $('delete-thread').title = busy ? 'Stop or finish the active run before deleting' : 'Permanently delete this conversation';
  $('archive-thread').textContent = thread?.archived ? 'Restore' : 'Archive';
  $('message-input').disabled = blocked || state.sending;
  $('send-message').disabled = blocked || busy || state.sending || !$('message-input').value.trim();
  $('send-message').textContent = state.sending ? 'Sending…' : 'Send message ↑';
  $('cancel-run').hidden = false;
  $('cancel-run').disabled = !busy || !run || run.status === 'cancelling';
  $('cancel-run').title = busy && run ? 'Cancel the queued or running task' : 'No active run to cancel';
  $('cancel-run').textContent = run?.status === 'cancelling' ? 'Cancelling…' : 'Cancel run';
  const status = thread?.archived ? 'Archived' : thread?.status === 'needs_new_thread' ? 'New thread needed' : run ? labels[run.status] : 'Ready for a task';
  $('run-status').textContent = status;
  $('run-status').className = `status-badge${busy ? ' busy' : thread?.status === 'needs_new_thread' ? ' failed' : ''}`;
  $('thread-context').textContent = thread?.status === 'needs_new_thread' ? 'This session stopped. Start a new thread to continue safely.' : thread?.archived ? 'Restore this thread to send a message.' : thread?.session_id ? 'Continuing in the same Bob workspace.' : 'A new workspace is created with your first message.';
  $('run-details').hidden = !run; $('run-json').textContent = run ? JSON.stringify(run, null, 2) : '';
  $('character-count').textContent = `${$('message-input').value.length.toLocaleString()} / 20,000`;
}
function rememberDraft() { state.drafts.set(state.thread?.id || 'new', $('message-input').value); }
async function selectThread(id, refresh = false) {
  if (!refresh) filesPath = '';
  if (!refresh) rememberDraft();
  const view = ++state.view; state.watch?.abort(); state.watch = null;
  $('rename-form').hidden = true;
  const [thread, page] = await Promise.all([api(`/threads/${id}`), api(`/threads/${id}/messages`)]);
  if (view !== state.view) return;
  const run = thread.last_run_id ? await api(`/runs/${thread.last_run_id}`) : null;
  if (view !== state.view) return;
  state.thread = thread; state.messages = page.items; state.nextMessages = page.next_cursor; state.run = run;
  if (!refresh) $('message-input').value = state.drafts.get(id) || '';
  history.replaceState(null, '', `#${id}`);
  renderThreads(); renderMessages(); renderContext(); scrollBottom();
  void loadFiles();
  if (run && !finalStatuses.has(run.status)) void watchRun(run.run_id, id, view).catch(report);
}
async function watchRun(runId, threadId, view) {
  const controller = new AbortController(); state.watch = controller;
  let cursor = 0, accumulated = '', finished = false;
  for (let attempt = 0; attempt < 4 && !controller.signal.aborted; attempt++) {
    try {
      const response = await fetch(`/api/v1/runs/${runId}/events`, { headers: { ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), 'Last-Event-ID': String(cursor) }, signal: controller.signal });
      if (!response.ok) throw new Error('The live stream could not connect.');
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      const apply = record => {
        const lines = record.split('\n'), data = lines.filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
        if (!data || state.view !== view) return;
        const event = JSON.parse(data), id = lines.find(line => line.startsWith('id: '));
        if (id) cursor = Number(id.slice(4));
        const stick = nearBottom(), reply = state.messages.find(message => message.role === 'assistant' && message.run_id === runId);
        if (event.type === 'message.part' && reply) {
          accumulated += event.part.content; reply.content = accumulated;
          const node = messageNodes.get(reply.id); if (node) messageContent(node.content, accumulated, 'assistant', threadId);
        }
        if (event.run) { state.run = event.run; if (reply) reply.status = event.run.status; }
        if (event.type === 'generic' && event.generic.status === 'cancelling') { state.run.status = 'cancelling'; if (reply) reply.status = 'cancelling'; }
        if (reply) { const node = messageNodes.get(reply.id); if (node) node.status.textContent = labels[reply.status] || reply.status; }
        finished = !!(event.run && finalStatuses.has(event.run.status));
        renderContext(); if (stick) scrollBottom();
      };
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let index; while ((index = buffer.indexOf('\n\n')) >= 0) { apply(buffer.slice(0, index)); buffer = buffer.slice(index + 2); }
        if (done) break;
      }
      if (finished && state.view === view && !controller.signal.aborted) { await selectThread(threadId, true); await loadThreads(); return; }
      if (controller.signal.aborted || state.view !== view) return;
      throw new Error('Live connection interrupted.');
    } catch (error) {
      if (controller.signal.aborted || state.view !== view || error.name === 'AbortError') return;
      if (attempt === 3) { notice('Live updates disconnected. The run continues on the server. Use Refresh to reconnect or inspect its result.'); return; }
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
}
function disconnect() {
  filesRequest++; filesPath = ''; $('file-list').replaceChildren(); $('files-panel').hidden = true;
  state.session++; state.view++; state.listRequest++; state.watch?.abort(); state.watch = null;
  state.token = ''; state.thread = null; state.run = null; state.messages = []; state.threads = []; state.drafts.clear(); state.pendingSend = null; state.sending = false;
  state.nextThreads = null; state.nextMessages = null; messageNodes.clear(); $('search').value = ''; setFilter(false);
  $('access-token').value = ''; $('message-input').value = ''; $('messages').replaceChildren(); $('thread-list').replaceChildren(); $('run-json').textContent = '';
  $('workspace').hidden = true; $('connect-screen').hidden = false; $('connect-error').hidden = true;
  if ($('api-dialog').open) $('api-dialog').close();
  if ($('delete-dialog').open) $('delete-dialog').close();
  history.replaceState(null, '', location.pathname); notice(); renderContext(); $('access-token').focus();
}
$('connect-form').addEventListener('submit', async event => {
  event.preventDefault(); $('connect-button').disabled = true; $('connect-error').hidden = true;
  state.session++; state.token = $('access-token').value.trim();
  try {
    const capabilities = await api('/capabilities'); $('access-token').value = '';
    $('connect-screen').hidden = true; $('workspace').hidden = false;
    $('connection-label').textContent = capabilities.runtime.ready ? capabilities.caller : 'Bob unavailable';
    $('connection-dot').className = `connection-dot${capabilities.runtime.ready ? '' : ' offline'}`;
    if (!capabilities.runtime.ready) notice(capabilities.runtime.reason || 'Bob is not ready.');
    renderContext(); await loadThreads();
    const requested = location.hash.slice(1);
    if (/^[a-f0-9-]{36}$/.test(requested)) await selectThread(requested);
    else if (state.threads[0]) await selectThread(state.threads[0].id);
  } catch (error) {
    if (!$('workspace').hidden) report(error);
    else { state.token = ''; $('connect-error').textContent = error.code === 'unauthorized' ? 'That service token was not accepted. Check AUTH_TOKENS in your local .env.' : error.message; $('connect-error').hidden = false; }
  } finally { $('connect-button').disabled = false; }
});
$('disconnect').addEventListener('click', disconnect);
$('new-thread').addEventListener('click', async () => {
  $('new-thread').disabled = true; notice();
  try { const thread = await api('/threads', { method: 'POST', body: '{}' }); setFilter(false); $('search').value = ''; await loadThreads(); await selectThread(thread.id); $('message-input').focus(); }
  catch (error) { report(error); } finally { $('new-thread').disabled = false; }
});
let searchTimer;
$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadThreads().catch(report), 250); });
function setFilter(archived) {
  state.archived = archived;
  for (const [id, selected] of [['active-tab', !archived], ['archived-tab', archived]]) { $(id).classList.toggle('selected', selected); $(id).setAttribute('aria-pressed', String(selected)); }
}
$('active-tab').addEventListener('click', () => { setFilter(false); loadThreads().catch(report); });
$('archived-tab').addEventListener('click', () => { setFilter(true); loadThreads().catch(report); });
$('more-threads').addEventListener('click', async () => { $('more-threads').disabled = true; try { await loadThreads(true); } catch (error) { report(error); } finally { $('more-threads').disabled = false; } });
$('older-messages').addEventListener('click', async () => {
  if (!state.thread || !state.nextMessages) return;
  const view = state.view, beforeHeight = $('conversation').scrollHeight; $('older-messages').disabled = true;
  try { const page = await api(`/threads/${state.thread.id}/messages?before=${state.nextMessages}`); if (view !== state.view) return; state.messages = [...page.items, ...state.messages]; state.nextMessages = page.next_cursor; renderMessages(); $('conversation').scrollTop += $('conversation').scrollHeight - beforeHeight; }
  catch (error) { report(error); } finally { $('older-messages').disabled = false; }
});
$('rename-thread').addEventListener('click', () => { if (!state.thread) return; $('rename-input').value = state.thread.title; $('rename-form').hidden = false; $('rename-input').focus(); });
$('rename-cancel').addEventListener('click', () => { $('rename-form').hidden = true; });
$('rename-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!state.thread) return; const id = state.thread.id;
  try { const thread = await api(`/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ title: $('rename-input').value }) }); if (state.thread?.id === id) { state.thread = thread; renderContext(); $('rename-form').hidden = true; } await loadThreads(); } catch (error) { report(error); }
});
$('archive-thread').addEventListener('click', async () => {
  if (!state.thread) return; const id = state.thread.id; $('archive-thread').disabled = true;
  try { await api(`/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ archived: !state.thread.archived }) }); if (state.thread?.id === id) await selectThread(id, true); await loadThreads(); } catch (error) { report(error); renderContext(); }
});
$('message-input').addEventListener('input', () => { rememberDraft(); renderContext(); });
$('message-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!$('send-message').disabled) $('message-form').requestSubmit(); } });
$('message-form').addEventListener('submit', async event => {
  event.preventDefault(); if ($('send-message').disabled) return;
  const content = $('message-input').value.trim(); state.sending = true; notice(); renderContext();
  try {
    const view = state.view;
    let id = state.thread?.id;
    if (!id) { const thread = await api('/threads', { method: 'POST', body: '{}' }); id = thread.id; if (view === state.view) state.thread = thread; }
    if (!state.pendingSend || state.pendingSend.threadId !== id || state.pendingSend.content !== content) state.pendingSend = { threadId: id, content, key: crypto.randomUUID() };
    await api(`/threads/${id}/messages`, { method: 'POST', headers: { 'Idempotency-Key': state.pendingSend.key }, body: JSON.stringify({ content }) });
    state.pendingSend = null; state.drafts.delete(id); state.drafts.delete('new');
    if (state.thread?.id === id) { $('message-input').value = ''; await selectThread(id, true); }
    await loadThreads();
  } catch (error) { report(error); }
  finally { state.sending = false; renderContext(); }
});
$('cancel-run').addEventListener('click', async () => {
  if (!state.run) return; const id = state.run.run_id; $('cancel-run').disabled = true;
  try { const run = await api(`/runs/${id}/cancel`, { method: 'POST' }); if (state.run?.run_id === id) { state.run = run; renderContext(); } } catch (error) { report(error); $('cancel-run').disabled = false; }
});
$('refresh').addEventListener('click', async () => { notice(); try { await loadThreads(); if (state.thread) await selectThread(state.thread.id, true); } catch (error) { report(error); } });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { if ($('message-input').disabled) return; $('message-input').value = button.dataset.prompt; rememberDraft(); renderContext(); $('message-input').focus(); }));
$('api-help').addEventListener('click', () => $('api-dialog').showModal());
$('close-api').addEventListener('click', () => $('api-dialog').close());
$('show-files').addEventListener('click', () => { $('files-panel').open = true; loadFiles().then(() => $('files-panel').scrollIntoView({ block: 'nearest' })).catch(report); });
$('refresh-files').addEventListener('click', () => loadFiles().catch(report));
$('files-up').addEventListener('click', () => loadFiles(filesPath.split('/').slice(0, -1).join('/')).catch(report));
let deleteTarget = null;
$('delete-thread').addEventListener('click', () => {
  if (!state.thread || $('delete-thread').disabled) return;
  deleteTarget = state.thread.id; $('delete-thread-name').textContent = state.thread.title;
  $('delete-error').hidden = true; $('delete-dialog').showModal(); $('keep-thread').focus();
});
$('keep-thread').addEventListener('click', () => $('delete-dialog').close());
$('confirm-delete').addEventListener('click', async () => {
  if (!deleteTarget) return; const id = deleteTarget; $('confirm-delete').disabled = true;
  try {
    await api(`/threads/${id}`, { method: 'DELETE' }); state.drafts.delete(id);
    if (state.pendingSend?.threadId === id) state.pendingSend = null;
    if (state.thread?.id === id) {
      state.view++; state.watch?.abort(); state.watch = null; state.thread = null; state.run = null; state.messages = []; state.nextMessages = null;
      $('message-input').value = ''; history.replaceState(null, '', location.pathname); renderMessages(); renderContext();
    }
    $('delete-dialog').close(); deleteTarget = null; await loadThreads(); notice('Thread deleted. Run records and workspace files were retained.');
  } catch (error) { if (error.name !== 'AbortError') { $('delete-error').textContent = error.message; $('delete-error').hidden = false; } }
  finally { $('confirm-delete').disabled = false; }
});
