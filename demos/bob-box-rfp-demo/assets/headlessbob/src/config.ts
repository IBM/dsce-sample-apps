import { resolve } from 'node:path';
export interface Config {
  host: string; port: number; dataDir: string; bobBin: string; bobMode: string;
  maxConcurrent: number; maxQueued: number; timeoutMs: number; killGraceMs: number;
  maxOutputBytes: number; maxEvents: number; maxBodyBytes: number; maxTurns: number; maxCost: number;
  continuation: boolean; tokens: Record<string, string>; bobEnv: NodeJS.ProcessEnv;
}
function number(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = env[key] === undefined ? fallback : Number(env[key]);
  if (!Number.isFinite(n) || n < min || n > max || (key !== 'BOB_MAX_COST' && !Number.isInteger(n))) throw new Error(`Invalid ${key}`);
  return n;
}
export function loadConfig(env = process.env): Config {
  const host = env.HOST ?? '127.0.0.1';
  const tokens: Record<string, string> = JSON.parse(env.AUTH_TOKENS ?? '{}');
  if (!tokens || Array.isArray(tokens) || typeof tokens !== 'object' || Object.entries(tokens).some(([owner, token]) => !owner || typeof token !== 'string' || token.length < 24)) throw new Error('AUTH_TOKENS must map caller names to tokens of at least 24 characters');
  if (new Set(Object.values(tokens)).size !== Object.keys(tokens).length) throw new Error('AUTH_TOKENS values must be unique');
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && (!Object.keys(tokens).length || env.ALLOW_TRUSTED_NETWORK !== 'true')) throw new Error('Non-loopback binding requires AUTH_TOKENS and ALLOW_TRUSTED_NETWORK=true; use only on a trusted isolated network');
  const bobEnv: NodeJS.ProcessEnv = {};
  // Service tokens and unrelated credentials never enter the child environment.
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'BOB_API_KEY', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS']) if (env[key]) bobEnv[key] = env[key];
  bobEnv.BOBSHELL_NO_RELAUNCH = 'true';
  const bobMode = env.BOB_MODE ?? 'agent';
  if (!/^[a-zA-Z0-9_-]+$/.test(bobMode)) throw new Error('Invalid BOB_MODE');
  return {
    host, port: number(env, 'PORT', 8000, 0, 65535), dataDir: resolve(env.DATA_DIR ?? '.headlessbob'),
    bobBin: env.BOB_BIN ?? 'bob', bobMode, tokens, bobEnv, continuation: env.BOB_ENABLE_CONTINUATION === 'true',
    maxConcurrent: number(env, 'MAX_CONCURRENT', 2, 1, 32), maxQueued: number(env, 'MAX_QUEUED', 100, 1, 10000),
    timeoutMs: number(env, 'RUN_TIMEOUT_MS', 300000, 1, 2147483647), killGraceMs: number(env, 'KILL_GRACE_MS', 2000, 1, 60000),
    maxOutputBytes: number(env, 'MAX_OUTPUT_BYTES', 2097152, 128, 16777216), maxEvents: number(env, 'MAX_EVENTS', 10000, 16, 100000),
    maxBodyBytes: number(env, 'MAX_BODY_BYTES', 65536, 128, 1048576), maxTurns: number(env, 'BOB_MAX_TURNS', 20, 1, 1000), maxCost: number(env, 'BOB_MAX_COST', 1, 0.001, 1000)
  };
}
