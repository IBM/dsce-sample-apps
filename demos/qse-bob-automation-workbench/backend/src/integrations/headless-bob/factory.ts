import type { BobAdapterKind } from '../../models/types.js';
import type { AppConfig } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { AcpAdapter } from './acp.adapter.js';
import { BobHttpClient } from './http-client.js';
import { RestThreadsAdapter } from './rest-threads.adapter.js';
import type { BobAdapter, BobClientSettings } from './types.js';

export interface AdapterHandle {
  adapter: BobAdapter;
  close(): Promise<void>;
}

export interface AdapterFactoryOptions {
  pollMs?: number;
}

export function createAdapter(
  kind: BobAdapterKind,
  settings: BobClientSettings,
  config: AppConfig,
  options: AdapterFactoryOptions = {}
): AdapterHandle {
  if (config.streamMode !== 'realtime') throw new AppError(500, 'demo_mode', 'Headless Bob adapters are only created when STREAM_MODE=realtime.');
  const http = new BobHttpClient(
    settings,
    { allowedHosts: config.bob.allowedHosts, allowPrivateNetwork: config.bob.allowPrivateNetwork },
    config.bob.requestTimeoutMs
  );
  const adapter = kind === 'acp' ? new AcpAdapter(http, options.pollMs) : new RestThreadsAdapter(http, options.pollMs);
  return { adapter, close: () => http.close() };
}
