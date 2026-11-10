import { spawn } from 'node:child_process';

export interface ExecOptions {
  cwd?: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBytes?: number;
  signal?: AbortSignal;
  onStderrLine?: (line: string) => void;
}

export interface ExecResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  truncated: boolean;
  spawnError?: string;
}

/**
 * Runs an executable with an argument array. A shell is never involved, so
 * arguments cannot be re-interpreted. The child gets its own process group so a
 * timeout or abort terminates the whole tree.
 */
export function runFile(file: string, args: readonly string[], options: ExecOptions): Promise<ExecResult> {
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let truncated = false;
    let timedOut = false;
    let aborted = false;
    let spawnError: string | undefined;
    let stderrBuffer = '';
    let settled = false;

    const child = spawn(file, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const killTree = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          /* already gone */
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree('SIGTERM');
      setTimeout(() => killTree('SIGKILL'), 2000).unref();
    }, options.timeoutMs);

    const onAbort = () => {
      aborted = true;
      killTree('SIGTERM');
      setTimeout(() => killTree('SIGKILL'), 2000).unref();
    };
    if (options.signal) {
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener('abort', onAbort, { once: true });
    }

    const append = (target: 'out' | 'err', chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        truncated = true;
        return;
      }
      const text = chunk.toString('utf8');
      if (target === 'out') stdout += text;
      else {
        stderr += text;
        if (options.onStderrLine) {
          stderrBuffer += text;
          const parts = stderrBuffer.split(/[\r\n]+/);
          stderrBuffer = parts.pop() ?? '';
          for (const line of parts) if (line) options.onStderrLine(line);
        }
      }
    };

    child.stdout.on('data', (chunk: Buffer) => append('out', chunk));
    child.stderr.on('data', (chunk: Buffer) => append('err', chunk));

    const finish = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (options.onStderrLine && stderrBuffer) options.onStderrLine(stderrBuffer);
      resolve({ code, signal, stdout, stderr, timedOut, aborted, truncated, spawnError });
    };

    child.on('error', (error) => {
      spawnError = error.message;
      finish(null, null);
    });
    child.on('close', (code, signal) => finish(code, signal));
  });
}

/** Minimal environment for child processes: no inherited secrets. */
export function minimalEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env.HOME ?? '/tmp',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8'
  };
  return { ...env, ...extra };
}
