import { spawn } from 'node:child_process';
import type { Config } from '../config.js';
import { BobParser, RuntimeError, type Result } from './parser.js';
export interface Execution { workspace: string; mode: string; prompt: string; taskId?: string; signal: AbortSignal; onText: (text: string) => void }
export interface Runtime { run(execution: Execution): Promise<Result>; ready(): Promise<{ ready: boolean; reason?: string }> }
export class BobRuntime implements Runtime {
  constructor(private config: Config) {}
  async ready() {
    if (!this.config.bobEnv.BOB_API_KEY) return { ready: false, reason: 'BOB_API_KEY is required for headless Bob' };
    return new Promise<{ ready: boolean; reason?: string }>((resolve) => {
      const child = spawn(this.config.bobBin, ['--version'], { env: this.config.bobEnv, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
      let output = '';
      child.stdout.on('data', (data) => { if (output.length < 4096) output += data.toString(); });
      child.on('error', () => resolve({ ready: false, reason: 'Bob executable is unavailable' }));
      child.on('close', (code) => resolve(code === 0 && /^2\.0\.(?:1|4)(?:\s|$)/.test(output) ? { ready: true } : { ready: false, reason: 'Expected Bob Shell 2.0.1 or 2.0.4' }));
    });
  }
  run(execution: Execution): Promise<Result> {
    const c = this.config;
    if (execution.signal.aborted) return Promise.reject(new RuntimeError('cancelled', 'Run cancelled'));
    return new Promise((resolve, reject) => {
      const args = ['run', '--format', 'stream-json', '--workspace', execution.workspace, '--mode', execution.mode,
        '--max-turns', String(c.maxTurns), '--max-cost', String(c.maxCost), '--disable-mcp', '--disable-subagents', '--trust'];
      if (execution.taskId) args.push('--resume', execution.taskId);
      // stdin avoids command-line length limits and prompt/flag confusion.
      const child = spawn(c.bobBin, args, { cwd: execution.workspace, env: c.bobEnv, shell: false, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let failure: RuntimeError | undefined;
      let stderr = '';
      let stderrBytes = 0;
      let exited = false;
      let closed = false;
      let finalized = false;
      let exitCode: number | null = null;
      let escalation: ReturnType<typeof setTimeout> | undefined;
      let graceFinished = false;
      const killGroup = (signal: NodeJS.Signals) => { if (child.pid) { try { process.kill(-child.pid, signal); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') child.kill(signal); } } };
      const cleanupGroup = () => {
        if (escalation) return;
        killGroup('SIGTERM');
        escalation = setTimeout(() => { killGroup('SIGKILL'); graceFinished = true; finish(); }, c.killGraceMs);
      };
      const fail = (error: RuntimeError) => { failure ??= error; cleanupGroup(); };
      const parser = new BobParser(c.maxOutputBytes, execution.onText);
      const cancel = () => fail(new RuntimeError('cancelled', 'Run cancelled'));
      const timeout = setTimeout(() => fail(new RuntimeError('timeout', 'Bob exceeded the configured run timeout')), c.timeoutMs);
      const finish = () => {
        if (finalized || !closed || !graceFinished) return;
        finalized = true; clearTimeout(timeout); execution.signal.removeEventListener('abort', cancel);
        if (failure) return reject(failure);
        if (execution.taskId && /No task found|does not belong|not a root task|not a normal task/i.test(stderr)) return reject(new RuntimeError('session_recovery', 'Bob task history is unavailable; start a fresh session'));
        if (exitCode !== 0) return reject(new RuntimeError('bob_exit', `Bob exited unsuccessfully (${exitCode ?? 'signal'})`));
        try { resolve(parser.finish()); } catch (error) { reject(error); }
      };
      execution.signal.addEventListener('abort', cancel, { once: true });
      child.stdout.on('data', (chunk: Buffer) => { if (!failure) try { parser.push(chunk); } catch (e) { fail(e instanceof RuntimeError ? e : new RuntimeError('event_limit', 'Run event limit exceeded')); } });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderr.length < 16384) stderr += chunk.toString().slice(0, 16384 - stderr.length);
        if (stderrBytes > c.maxOutputBytes) fail(new RuntimeError('output_limit', 'Bob stderr exceeded the configured byte limit'));
      });
      child.stdin.on('error', (error: NodeJS.ErrnoException) => { if (error.code !== 'EPIPE') fail(new RuntimeError('stdin_error', 'Could not send the task to Bob')); });
      child.on('error', () => { fail(new RuntimeError('spawn_error', 'Could not start Bob')); });
      // Clean up descendants even when the parent exits first, before releasing its workspace.
      child.on('exit', (code) => { exited = true; exitCode = code; clearTimeout(timeout); cleanupGroup(); });
      child.on('close', (code) => { closed = true; if (!exited) exitCode = code; cleanupGroup(); finish(); });
      child.stdin.end(execution.prompt);
      if (execution.signal.aborted) cancel();
    });
  }
}
