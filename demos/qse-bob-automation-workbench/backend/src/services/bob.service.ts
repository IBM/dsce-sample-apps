import type { AppConfig } from '../config/env.js';
import { createAdapter, type AdapterFactoryOptions, type AdapterHandle } from '../integrations/headless-bob/factory.js';
import type { BobClientSettings } from '../integrations/headless-bob/types.js';
import type { BobAdapterKind, BobAuthMode, BobConnectionView } from '../models/types.js';
import type { BobConnectionRecord, BobConnectionRepository } from '../repositories/bob-connection.repository.js';
import { AppError } from '../utils/errors.js';
import { redactor } from '../utils/redact.js';
import type { SecretBox } from '../utils/secret-box.js';
import { assertHostAllowedByName, parseEndpoint } from '../utils/ssrf.js';
import { DEMO_BANNER, DEMO_ENDPOINT, type DemoService } from './demo.service.js';

export interface BobConnectInput {
  endpoint: string;
  adapter: BobAdapterKind;
  apiBasePath: string;
  authMode: BobAuthMode;
  authHeaderName: string;
  apiKey?: string;
}

export class BobService {
  constructor(
    private readonly repo: BobConnectionRepository,
    private readonly box: SecretBox,
    private readonly config: AppConfig,
    private readonly adapterOptions: AdapterFactoryOptions = {},
    private readonly demo: DemoService | null = null
  ) {
    const rec = repo.get();
    if (rec?.apiKeyEnc) redactor.register(this.safeOpen(rec.apiKeyEnc));
  }

  private safeOpen(enc: string): string | null {
    try {
      return this.box.open(enc);
    } catch {
      return null;
    }
  }

  view(): BobConnectionView {
    const rec = this.repo.get();
    if (!rec) {
      return {
        state: 'not_configured',
        configured: false,
        endpoint: null,
        adapter: 'rest-threads',
        apiBasePath: '/api/v1',
        authMode: 'bearer',
        authHeaderName: 'authorization',
        apiKeyHint: null,
        message: 'Headless Bob has not been configured yet.',
        lastTestedAt: null,
        capabilities: null,
        mock: this.config.streamMode === 'mock'
      };
    }
    return {
      state: rec.state,
      configured: true,
      endpoint: this.demo ? null : rec.endpoint,
      adapter: rec.adapter,
      apiBasePath: rec.apiBasePath,
      authMode: rec.authMode,
      authHeaderName: rec.authHeaderName,
      apiKeyHint: rec.apiKeyHint,
      message: rec.message,
      lastTestedAt: rec.lastTestedAt,
      capabilities: rec.capabilities ? { ...rec.capabilities, raw: undefined } : null,
      mock: this.demo !== null
    };
  }

  isConnected(): boolean {
    return this.repo.get()?.state === 'connected';
  }

  private static maskKey(key: string): string {
    return `••••${key.slice(-4)}`;
  }

  private normalizeBasePath(p: string): string {
    const v = p.trim();
    if (v === '' || v === '/') return '';
    if (!/^\/[A-Za-z0-9._~/-]*$/.test(v) || v.includes('..') || v.includes('//')) {
      throw new AppError(400, 'invalid_base_path', 'API base path must look like /api/v1');
    }
    return v.replace(/\/+$/, '');
  }

  /**
   * STREAM_MODE=mock: nothing is contacted and the entered address / key are discarded (never stored).
   * The connection reports the capabilities captured from a real Headless Bob, labelled as a demo.
   */
  private saveDemo(input: BobConnectInput): BobConnectionView {
    const demo = this.demo!;
    this.repo.save({
      endpoint: DEMO_ENDPOINT,
      adapter: demo.recording.recordedFrom.adapter,
      apiBasePath: this.normalizeBasePath(input.apiBasePath),
      authMode: input.authMode,
      authHeaderName: input.authHeaderName,
      apiKeyEnc: null,
      apiKeyHint: null,
      state: 'connected',
      message: `${DEMO_BANNER} No connection was made; the address and API key you entered were not used or stored.`,
      lastTestedAt: new Date().toISOString(),
      capabilities: demo.recording.bobCapabilities
    });
    return this.view();
  }

  async save(input: BobConnectInput): Promise<BobConnectionView> {
    if (this.demo) return this.saveDemo(input);
    const previous = this.repo.get();
    const adapter = input.adapter;
    const url = parseEndpoint(input.endpoint);
    assertHostAllowedByName(url, { allowedHosts: this.config.bob.allowedHosts, allowPrivateNetwork: this.config.bob.allowPrivateNetwork });
    const endpoint = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    const apiBasePath = this.normalizeBasePath(input.apiBasePath);
    if (input.authMode === 'header' && !/^[A-Za-z0-9-]{1,64}$/.test(input.authHeaderName)) {
      throw new AppError(400, 'invalid_header_name', 'Authentication header name is invalid');
    }

    let apiKeyEnc: string | null = null;
    let apiKeyHint: string | null = null;
    if (input.authMode !== 'none') {
      if (input.apiKey && input.apiKey.trim()) {
        const key = input.apiKey.trim();
        if (key.length < 8 || key.length > 512 || /[\s\0]/.test(key)) throw new AppError(400, 'invalid_api_key', 'API key format is invalid');
        apiKeyEnc = this.box.seal(key);
        apiKeyHint = BobService.maskKey(key);
        redactor.register(key);
        if (previous?.apiKeyEnc) redactor.unregister(this.safeOpen(previous.apiKeyEnc));
      } else if (previous?.apiKeyEnc && previous.endpoint === endpoint) {
        apiKeyEnc = previous.apiKeyEnc;
        apiKeyHint = previous.apiKeyHint;
      } else {
        throw new AppError(400, 'api_key_required', 'An API key is required (re-enter it when the endpoint changes).');
      }
    }

    const rec: BobConnectionRecord = {
      endpoint,
      adapter,
      apiBasePath,
      authMode: input.authMode,
      authHeaderName: input.authHeaderName,
      apiKeyEnc,
      apiKeyHint,
      state: 'connecting',
      message: 'Verifying connection…',
      lastTestedAt: null,
      capabilities: null
    };
    this.repo.save(rec);
    return this.test();
  }

  private settingsFor(rec: BobConnectionRecord): BobClientSettings {
    let apiKey: string | null = null;
    if (rec.apiKeyEnc) {
      apiKey = this.safeOpen(rec.apiKeyEnc);
      if (!apiKey) throw new AppError(500, 'secret_unreadable', 'The stored API key cannot be decrypted with the configured SECRETS_KEYS. Re-enter the API key.');
      redactor.register(apiKey);
    }
    return { endpoint: rec.endpoint, apiBasePath: rec.apiBasePath, authMode: rec.authMode, authHeaderName: rec.authHeaderName, apiKey };
  }

  /** Builds an adapter for the saved configuration. Caller must `close()` the handle. */
  getAdapter(): AdapterHandle {
    if (this.demo) throw new AppError(500, 'demo_mode', 'Headless Bob is never contacted when STREAM_MODE=mock.');
    const rec = this.repo.get();
    if (!rec) throw new AppError(409, 'bob_not_configured', 'Headless Bob is not configured');
    return createAdapter(rec.adapter, this.settingsFor(rec), this.config, this.adapterOptions);
  }

  async test(): Promise<BobConnectionView> {
    const rec = this.repo.get();
    if (!rec) throw new AppError(409, 'bob_not_configured', 'Headless Bob is not configured');
    if (this.demo) {
      this.repo.save({ ...rec, state: 'connected', message: `${DEMO_BANNER} No connection test was performed.`, capabilities: this.demo.recording.bobCapabilities, lastTestedAt: new Date().toISOString() });
      return this.view();
    }
    this.repo.save({ ...rec, state: 'connecting', message: 'Verifying connection…' });
    let handle: AdapterHandle | null = null;
    try {
      handle = this.getAdapter();
      const result = await handle.adapter.testConnection();
      this.repo.save({
        ...rec,
        state: result.state,
        message: result.message,
        capabilities: result.capabilities,
        lastTestedAt: new Date().toISOString()
      });
    } catch (e) {
      const message = e instanceof AppError ? e.message : (e as Error).message;
      this.repo.save({ ...rec, state: 'connection_failed', message, capabilities: null, lastTestedAt: new Date().toISOString() });
    } finally {
      await handle?.close().catch(() => undefined);
    }
    return this.view();
  }

  disconnect(): BobConnectionView {
    const rec = this.repo.get();
    if (rec?.apiKeyEnc) redactor.unregister(this.safeOpen(rec.apiKeyEnc));
    this.repo.delete();
    return this.view();
  }

  /** Re-encrypts the stored API key with the active encryption key (credential rotation). */
  reencrypt(): boolean {
    const rec = this.repo.get();
    if (!rec?.apiKeyEnc) return false;
    const key = this.safeOpen(rec.apiKeyEnc);
    if (!key) throw new AppError(500, 'secret_unreadable', 'Stored API key cannot be decrypted; re-enter it.');
    this.repo.save({ ...rec, apiKeyEnc: this.box.seal(key) });
    return true;
  }
}
