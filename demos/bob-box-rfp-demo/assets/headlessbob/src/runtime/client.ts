import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import type { Config } from '../config.js';
import { BobRuntime, type Execution, type Runtime } from './bob.js';
import { RuntimeError } from './parser.js';

/** Shared REST and partner runtime using Agent Client Protocol v1 over stdio. */
export class BobClientRuntime implements Runtime {
  constructor(private config: Config, private observe: (event: { method: string; detail: unknown }) => void = () => {}) {}
  ready() { return new BobRuntime(this.config).ready(); }
  async run(execution: Execution) {
    const c = this.config;
    if (execution.signal.aborted) throw new RuntimeError('cancelled', 'Run cancelled');
    const child = spawn(c.bobBin, ['acp', '--trust', '--disable-mcp', '--disable-subagents'], {
      cwd: execution.workspace, env: c.bobEnv, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let nextId = 0, bytes = 0, pendingText = '', text = '', sessionId = '', prompting = false;
    let failure: Error | undefined;
    let completed = false, eventCount = 0;
    const decoder = new StringDecoder('utf8');
    const pending = new Map<number, { method: string; resolve: (value: any) => void; reject: (error: Error) => void }>();
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    const kill = (signal: NodeJS.Signals) => {
      if (child.pid) try { process.kill(-child.pid, signal); } catch { child.kill(signal); }
    };
    const fail = (error: Error) => {
      failure ??= error;
      for (const item of pending.values()) item.reject(failure);
      pending.clear();
    };
    const send = (message: object) => { if (!child.stdin.destroyed) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n'); };
    const rpc = (method: string, params: object): Promise<any> => {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        const id = ++nextId; pending.set(id, { method, resolve, reject }); send({ id, method, params });
      });
    };
    const cancel = () => {
      if (sessionId) { send({ method: 'session/cancel', params: { sessionId } }); this.observe({ method: 'session/cancel', detail: 'sent' }); }
      fail(new RuntimeError('cancelled', 'Run cancelled'));
    };
    execution.signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => fail(new RuntimeError('timeout', 'Bob ACP timed out')), c.timeoutMs);
    child.on('error', () => fail(new RuntimeError('spawn_error', 'Could not start Bob ACP')));
    child.on('exit', () => { if (!completed) fail(new RuntimeError('bob_exit', 'Bob ACP exited before completion')); });
    child.on('close', () => { if (!completed) fail(new RuntimeError('bob_exit', 'Bob ACP exited before completion')); });
    child.stdin.on('error', () => fail(new RuntimeError('stdin_error', 'Could not write to Bob ACP')));
    child.stderr.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > c.maxOutputBytes) fail(new RuntimeError('output_limit', 'Bob ACP output limit exceeded')); });
    child.stdout.on('data', (chunk: Buffer) => {
      if (failure) return;
      try {
        bytes += chunk.length;
        if (bytes > c.maxOutputBytes) throw new RuntimeError('output_limit', 'Bob ACP output limit exceeded');
        pendingText += decoder.write(chunk);
        let end: number;
        while ((end = pendingText.indexOf('\n')) >= 0) {
          const line = pendingText.slice(0, end); pendingText = pendingText.slice(end + 1);
          if (!line.trim()) continue;
          const message = JSON.parse(line);
          if (!message || Array.isArray(message) || message.jsonrpc !== '2.0') throw new RuntimeError('invalid_output', 'Invalid Bob ACP message');
          if (++eventCount > c.maxEvents) throw new RuntimeError('event_limit', 'Bob ACP event limit exceeded');
          if (message.method === 'session/request_permission' && message.id !== undefined) {
            // Preserve trusted headless execution: grant only this invocation, never persistent approval.
            if (message.params?.sessionId !== sessionId) throw new RuntimeError('session_recovery', 'Bob returned a different session');
            const option = prompting && !execution.signal.aborted && Array.isArray(message.params.options)
              ? message.params.options.find((o: any) => o?.kind === 'allow_once' && typeof o.optionId === 'string') : undefined;
            this.observe({ method: message.method, detail: option ? 'allow_once' : 'cancelled' });
            send({ id: message.id, result: { outcome: option ? { outcome: 'selected', optionId: option.optionId } : { outcome: 'cancelled' } } });
          } else if (message.method && message.id !== undefined) {
            send({ id: message.id, error: { code: -32601, message: 'Client method not supported' } });
          } else if (message.method === 'session/update') {
            // Setup notifications can precede the session/new response; none are run output.
            if (!sessionId && !prompting) continue;
            if (message.params?.sessionId !== sessionId) throw new RuntimeError('session_recovery', 'Bob returned a different session');
            const update = message.params?.update;
            if (typeof update?.sessionUpdate !== 'string') throw new RuntimeError('invalid_output', 'Invalid Bob session update');
            this.observe({ method: message.method, detail: update.sessionUpdate });
            if (prompting && message.params.sessionId === sessionId && update.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
              if (typeof update.content.text !== 'string') throw new RuntimeError('invalid_output', 'Invalid Bob text chunk');
              text += update.content.text; execution.onText(update.content.text);
            }
          } else if (message.id !== undefined) {
            const item = pending.get(message.id); if (!item) continue;
            pending.delete(message.id);
            if (item.method === 'session/prompt') prompting = false;
            if (message.error) item.reject(new RuntimeError(item.method === 'session/resume' ? 'session_recovery' : 'acp_error', 'Bob ACP request failed'));
            else {
              if (item.method === 'session/new') sessionId = message.result?.sessionId;
              item.resolve(message.result);
            }
          }
        }
      } catch (error) { fail(error instanceof RuntimeError ? error : new RuntimeError('invalid_output', 'Invalid Bob ACP output')); }
    });
    try {
      if (execution.signal.aborted) cancel();
      const init = await rpc('initialize', { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'headlessbob', version: '0.1.0' } });
      this.observe({ method: 'initialize', detail: init });
      if (init?.protocolVersion !== 1) throw new RuntimeError('invalid_output', 'Unsupported Agent Client Protocol version');
      const params = { cwd: execution.workspace, mcpServers: [] };
      let setup;
      if (execution.taskId) {
        if (!init.agentCapabilities?.sessionCapabilities?.resume) throw new RuntimeError('session_recovery', 'Bob does not support session/resume');
        sessionId = execution.taskId;
        setup = await rpc('session/resume', { ...params, sessionId });
        this.observe({ method: 'session/resume', detail: 'success' });
      } else {
        setup = await rpc('session/new', params); sessionId = setup.sessionId;
        if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(sessionId)) throw new RuntimeError('invalid_output', 'Invalid Bob session ID');
      }
      if (setup.modes?.currentModeId !== execution.mode) await rpc('session/set_mode', { sessionId, modeId: execution.mode });
      prompting = true;
      const result = await rpc('session/prompt', { sessionId, prompt: [{ type: 'text', text: execution.prompt }] });
      prompting = false;
      this.observe({ method: 'session/prompt', detail: result });
      if (failure) throw failure;
      if (execution.signal.aborted) throw new RuntimeError('cancelled', 'Run cancelled');
      if (result?.stopReason !== 'end_turn') throw new RuntimeError(result?.stopReason === 'cancelled' ? 'cancelled' : 'execution_limit', 'Bob ACP stopped without completing the turn');
      // Flush Bob session resources before terminating a per-run ACP process.
      if (init.agentCapabilities?.sessionCapabilities?.close) {
        await rpc('session/close', { sessionId });
        this.observe({ method: 'session/close', detail: 'success' });
      }
      completed = true;
      return { text, taskId: sessionId };
    } finally {
      clearTimeout(timer); execution.signal.removeEventListener('abort', cancel);
      // Allow a cancellation notification to reach Bob, then clean up its process group.
      if (execution.signal.aborted) await delay(250);
      kill('SIGTERM'); await delay(c.killGraceMs); kill('SIGKILL'); await closed;
    }
  }
}
