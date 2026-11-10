import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../../utils/errors.js';
import { redact, redactor } from '../../utils/redact.js';
import { minimalEnv, runFile } from '../../utils/safe-exec.js';
import { isInside } from '../../utils/paths.js';

export interface GitClientOptions {
  gitBin: string;
  timeoutMs: number;
}

export interface CloneResult {
  commit: string;
  fileCount: number;
  removedLinks: number;
}

const MAX_FILES = 250_000;

/**
 * Thin, shell-free wrapper around the git CLI. Credentials only travel through
 * environment variables (GIT_CONFIG_*), never argv, URLs or on-disk config, and
 * every invocation disables hooks, prompts and non-https transports.
 */
export class GitClient {
  constructor(private readonly opts: GitClientOptions) {}

  private env(token?: string | null): NodeJS.ProcessEnv {
    const env = minimalEnv({
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: '/bin/true',
      GIT_ALLOW_PROTOCOL: 'https',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_LFS_SKIP_SMUDGE: '1'
    });
    if (token) {
      redactor.register(token);
      const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
      env.GIT_CONFIG_COUNT = '1';
      env.GIT_CONFIG_KEY_0 = 'http.extraHeader';
      env.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${basic}`;
      redactor.register(basic);
    }
    return env;
  }

  private static readonly SAFE_FLAGS = [
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'core.fsmonitor=false',
    '-c', 'protocol.version=2',
    '-c', 'submodule.recurse=false',
    '-c', 'advice.detachedHead=false',
    '-c', 'credential.helper='
  ];

  async version(): Promise<string> {
    const r = await runFile(this.opts.gitBin, ['--version'], { env: minimalEnv(), timeoutMs: 10_000 });
    if (r.spawnError || r.code !== 0) throw new AppError(500, 'git_unavailable', 'The git CLI is not available on the server');
    return r.stdout.trim();
  }

  /** Verifies the repository and branch are reachable (and the token works) without cloning. */
  async validateRemote(url: string, branch: string, token: string | null, signal?: AbortSignal): Promise<{ commit: string }> {
    const r = await runFile(
      this.opts.gitBin,
      [...GitClient.SAFE_FLAGS, 'ls-remote', '--exit-code', '--heads', '--', url, `refs/heads/${branch}`],
      { env: this.env(token), timeoutMs: Math.min(this.opts.timeoutMs, 60_000), signal }
    );
    if (r.spawnError) throw new AppError(500, 'git_unavailable', 'The git CLI is not available on the server');
    if (r.timedOut) throw new AppError(504, 'git_timeout', 'Timed out contacting the repository');
    if (r.code === 2) throw new AppError(422, 'branch_not_found', `Branch "${branch}" was not found in the repository`);
    if (r.code !== 0) throw new AppError(422, 'repository_unreachable', GitClient.explain(r.stderr, Boolean(token)));
    const commit = r.stdout.trim().split(/\s+/)[0] ?? '';
    return { commit };
  }

  async clone(
    url: string,
    branch: string,
    token: string | null,
    workDir: string,
    onProgress: (line: string) => void,
    signal?: AbortSignal
  ): Promise<CloneResult> {
    const target = path.join(workDir, 'repo');
    const staging = path.join(workDir, 'repo.new');
    fs.rmSync(staging, { recursive: true, force: true });
    const r = await runFile(
      this.opts.gitBin,
      [...GitClient.SAFE_FLAGS, 'clone', '--depth', '1', '--single-branch', '--no-tags', '--progress', '--branch', branch, '--', url, staging],
      {
        env: this.env(token),
        timeoutMs: this.opts.timeoutMs,
        signal,
        onStderrLine: (line) => onProgress(redact(line))
      }
    );
    if (r.spawnError) throw new AppError(500, 'git_unavailable', 'The git CLI is not available on the server');
    if (r.aborted) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw new AppError(499, 'clone_cancelled', 'Clone was cancelled');
    }
    if (r.timedOut) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw new AppError(504, 'git_timeout', 'Clone timed out');
    }
    if (r.code !== 0) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw new AppError(422, 'clone_failed', GitClient.explain(r.stderr, Boolean(token)));
    }
    if (!fs.existsSync(path.join(staging, '.git'))) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw new AppError(422, 'clone_failed', 'Clone completed but no git repository root was found');
    }
    const { fileCount, removedLinks } = this.sanitizeTree(staging);
    const head = await runFile(this.opts.gitBin, [...GitClient.SAFE_FLAGS, '-C', staging, 'rev-parse', 'HEAD'], {
      env: this.env(null),
      timeoutMs: 20_000
    });
    if (head.code !== 0) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw new AppError(422, 'clone_failed', 'Could not determine the checked-out commit');
    }
    // Drop the remote URL so no later git invocation can reach out from the workspace.
    await runFile(this.opts.gitBin, [...GitClient.SAFE_FLAGS, '-C', staging, 'remote', 'remove', 'origin'], {
      env: this.env(null),
      timeoutMs: 20_000
    });
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);
    return { commit: head.stdout.trim(), fileCount, removedLinks };
  }

  /** Counts files and removes symlinks that point outside the checkout. */
  private sanitizeTree(root: string): { fileCount: number; removedLinks: number } {
    let fileCount = 0;
    let removedLinks = 0;
    const realRoot = fs.realpathSync(root);
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.git' && dir === root) continue;
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) {
          let escapes = true;
          try {
            escapes = !isInside(realRoot, fs.realpathSync(full));
          } catch {
            escapes = true;
          }
          if (escapes) {
            fs.rmSync(full, { force: true });
            removedLinks++;
          }
          continue;
        }
        if (entry.isDirectory()) stack.push(full);
        else if (entry.isFile()) {
          fileCount++;
          if (fileCount > MAX_FILES) throw new AppError(422, 'repository_too_large', `Repository has more than ${MAX_FILES} files`);
        }
      }
    }
    return { fileCount, removedLinks };
  }

  private static explain(stderr: string, hadToken: boolean): string {
    const s = redact(stderr).toLowerCase();
    if (s.includes('could not read username') || s.includes('authentication failed') || s.includes('http basic') || s.includes('403')) {
      return hadToken
        ? 'Authentication failed. Check that the access token is valid and has read access to the repository.'
        : 'Authentication required. The repository is private or does not exist; provide a personal access token.';
    }
    if (s.includes('not found') || s.includes('repository') && s.includes('does not exist')) {
      return 'Repository not found. Check the URL (private repositories require an access token).';
    }
    if (s.includes('could not resolve host') || s.includes('unable to access')) {
      return 'Could not reach the Git host from the server. Check network access.';
    }
    if (s.includes('remote branch') && s.includes('not found')) return 'Branch not found in the repository.';
    return `git failed: ${redact(stderr).trim().split('\n').slice(-2).join(' ').slice(0, 300) || 'unknown error'}`;
  }
}
