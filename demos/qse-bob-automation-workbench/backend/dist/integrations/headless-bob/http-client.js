import { request } from 'undici';
import { AppError } from '../../utils/errors.js';
import { redact } from '../../utils/redact.js';
import { assertHostAllowedByName, createGuardedAgent, parseEndpoint } from '../../utils/ssrf.js';
import { BobHttpError, BobNetworkError } from './types.js';
const MAX_JSON_BYTES = 4 * 1024 * 1024;
export class BobHttpClient {
    settings;
    timeoutMs;
    dispatcher;
    base;
    constructor(settings, policy, timeoutMs) {
        this.settings = settings;
        this.timeoutMs = timeoutMs;
        this.base = parseEndpoint(settings.endpoint);
        assertHostAllowedByName(this.base, policy);
        this.dispatcher = createGuardedAgent(policy, timeoutMs);
    }
    get apiBasePath() {
        return this.settings.apiBasePath;
    }
    url(path, withApiBase = true) {
        const prefix = this.base.pathname.replace(/\/+$/, '');
        const apiBase = withApiBase ? this.settings.apiBasePath.replace(/\/+$/, '') : '';
        return `${this.base.origin}${prefix}${apiBase}${path}`;
    }
    headers(extra = {}, json = false) {
        const h = { accept: 'application/json', ...extra };
        if (json)
            h['content-type'] = 'application/json';
        const key = this.settings.apiKey;
        if (key && this.settings.authMode === 'bearer')
            h.authorization = `Bearer ${key}`;
        else if (key && this.settings.authMode === 'header')
            h[this.settings.authHeaderName.toLowerCase()] = key;
        return h;
    }
    wrap(error) {
        if (error instanceof AppError || error instanceof BobHttpError)
            throw error;
        const err = error;
        const cause = err.cause ?? err;
        if (cause instanceof AppError)
            throw cause;
        if (err.name === 'AbortError')
            throw err;
        const code = cause.code ?? err.code ?? '';
        const msg = code === 'ECONNREFUSED'
            ? 'Connection refused. Check the address and that Headless Bob is running.'
            : code === 'ENOTFOUND' || code === 'EAI_AGAIN'
                ? 'Host name could not be resolved.'
                : code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'ETIMEDOUT'
                    ? 'Timed out connecting to Headless Bob.'
                    : code === 'CERT_HAS_EXPIRED' || String(code).startsWith('ERR_TLS') || String(code).includes('CERT')
                        ? `TLS error: ${code}`
                        : redact(err.message || 'Network error');
        throw new BobNetworkError(msg, error);
    }
    async json(method, path, opts = {}) {
        try {
            const res = await request(this.url(path, opts.withApiBase ?? true), {
                method,
                headers: opts.auth === false ? { accept: 'application/json' } : this.headers(opts.headers, opts.body !== undefined),
                body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
                dispatcher: this.dispatcher,
                signal: opts.signal,
                maxRedirections: 0
            });
            const text = await readLimited(res.body, MAX_JSON_BYTES);
            let data = undefined;
            if (text) {
                try {
                    data = JSON.parse(text);
                }
                catch {
                    data = { raw: text.slice(0, 500) };
                }
            }
            if (res.statusCode >= 400) {
                throw new BobHttpError(res.statusCode, extractMessage(data) ?? `HTTP ${res.statusCode}`, data);
            }
            return { status: res.statusCode, data: data };
        }
        catch (e) {
            return this.wrap(e);
        }
    }
    async binary(path, maxBytes, signal) {
        try {
            const res = await request(this.url(path), {
                method: 'GET',
                headers: this.headers({ accept: '*/*' }),
                dispatcher: this.dispatcher,
                signal,
                maxRedirections: 0
            });
            if (res.statusCode >= 400) {
                const text = await readLimited(res.body, 64 * 1024);
                let data;
                try {
                    data = JSON.parse(text);
                }
                catch {
                    data = undefined;
                }
                throw new BobHttpError(res.statusCode, extractMessage(data) ?? `HTTP ${res.statusCode}`, data);
            }
            const chunks = [];
            let total = 0;
            for await (const chunk of res.body) {
                total += chunk.length;
                if (total > maxBytes) {
                    res.body.destroy();
                    throw new BobHttpError(413, 'File exceeds the configured download limit');
                }
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        }
        catch (e) {
            return this.wrap(e);
        }
    }
    /** Opens an SSE stream and yields parsed `data:` payloads with their ids. */
    async *sse(path, signal, query = '') {
        let res;
        try {
            res = await request(this.url(path) + query, {
                method: 'GET',
                headers: this.headers({ accept: 'text/event-stream' }),
                dispatcher: this.dispatcher,
                signal,
                maxRedirections: 0
            });
        }
        catch (e) {
            return this.wrap(e);
        }
        if (res.statusCode >= 400) {
            const text = await readLimited(res.body, 64 * 1024);
            let data;
            try {
                data = JSON.parse(text);
            }
            catch {
                data = undefined;
            }
            throw new BobHttpError(res.statusCode, extractMessage(data) ?? `HTTP ${res.statusCode}`, data);
        }
        let buffer = '';
        let id = null;
        const dataLines = [];
        try {
            for await (const chunk of res.body) {
                buffer += chunk.toString('utf8');
                if (buffer.length > 8 * 1024 * 1024)
                    throw new BobNetworkError('SSE buffer exceeded limit');
                let nl;
                while ((nl = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, nl).replace(/\r$/, '');
                    buffer = buffer.slice(nl + 1);
                    if (line === '') {
                        if (dataLines.length) {
                            const payload = dataLines.join('\n');
                            dataLines.length = 0;
                            try {
                                yield { id, data: JSON.parse(payload) };
                            }
                            catch {
                                /* ignore malformed event */
                            }
                        }
                        id = null;
                    }
                    else if (line.startsWith('data:'))
                        dataLines.push(line.slice(5).replace(/^ /, ''));
                    else if (line.startsWith('id:'))
                        id = line.slice(3).trim();
                }
            }
        }
        catch (e) {
            if (e.name === 'AbortError')
                throw e;
            return this.wrap(e);
        }
    }
    async close() {
        await this.dispatcher.close();
    }
}
async function readLimited(body, limit) {
    const chunks = [];
    let total = 0;
    for await (const chunk of body) {
        total += chunk.length;
        if (total > limit)
            break;
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}
function extractMessage(data) {
    if (!data || typeof data !== 'object')
        return undefined;
    const d = data;
    const m = d.error?.message ?? d.message ?? d.detail;
    return typeof m === 'string' ? redact(m).slice(0, 500) : undefined;
}
//# sourceMappingURL=http-client.js.map