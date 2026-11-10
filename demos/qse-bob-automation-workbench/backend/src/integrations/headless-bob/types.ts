import type { BobAuthMode, BobCapabilities, BobConnectionState } from '../../models/types.js';

export interface BobClientSettings {
  endpoint: string;
  apiBasePath: string;
  authMode: BobAuthMode;
  authHeaderName: string;
  apiKey: string | null;
}

export interface ConnectionTestResult {
  state: BobConnectionState;
  message: string;
  capabilities: BobCapabilities | null;
}

export interface BobRunHandle {
  runId: string;
  threadId: string | null;
}

export type BobRunStatus = 'created' | 'in-progress' | 'cancelling' | 'cancelled' | 'completed' | 'failed';

export interface BobRunResult {
  status: 'completed' | 'failed' | 'cancelled';
  output: string;
  error: string | null;
  usage: Record<string, unknown> | null;
}

export interface BobFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number | null;
  downloadable: boolean;
}

export interface FollowHooks {
  onText(text: string): void;
  onStatus(status: BobRunStatus): void;
  signal: AbortSignal;
}

/**
 * The only surface the orchestrator uses to talk to Headless Bob. Each adapter
 * maps this to a real, documented Headless Bob protocol. Nothing outside the
 * adapters knows about Headless Bob URLs or payloads.
 */
export interface BobAdapter {
  readonly kind: 'rest-threads' | 'acp';
  readonly supportsFiles: boolean;
  testConnection(): Promise<ConnectionTestResult>;
  startRun(input: { prompt: string; title: string; idempotencyKey: string }): Promise<BobRunHandle>;
  followRun(handle: BobRunHandle, hooks: FollowHooks): Promise<BobRunResult>;
  cancelRun(handle: BobRunHandle): Promise<void>;
  listFiles(handle: BobRunHandle, dir: string): Promise<BobFileEntry[]>;
  downloadFile(handle: BobRunHandle, relPath: string, maxBytes: number): Promise<Buffer>;
}

export class BobHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'BobHttpError';
  }
}

export class BobNetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BobNetworkError';
  }
}
