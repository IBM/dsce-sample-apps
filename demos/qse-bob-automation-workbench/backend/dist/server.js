import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createApp } from './app.js';
import { createContext } from './app-context.js';
import { loadConfig } from './config/env.js';
import { createLogger } from './utils/logger.js';
async function main() {
    let config;
    try {
        config = loadConfig();
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
    const log = createLogger(config.logLevel);
    const ctx = await createContext(config, log);
    const state = { shuttingDown: false };
    const app = createApp(ctx, state);
    const server = config.tls
        ? https.createServer({ key: fs.readFileSync(config.tls.keyFile), cert: fs.readFileSync(config.tls.certFile) }, app)
        : http.createServer(app);
    server.requestTimeout = 0; // SSE streams are long-lived
    server.headersTimeout = 20_000;
    const purge = setInterval(() => ctx.sessions.purgeExpired(config.sessionIdleMinutes), 5 * 60_000);
    purge.unref();
    await new Promise((resolve) => server.listen(config.port, config.host, resolve));
    log.info({ port: config.port, host: config.host, tls: Boolean(config.tls), strategy: config.execution.strategy }, 'QSE Workbench backend listening');
    if (config.streamMode === 'mock')
        log.warn('STREAM_MODE=mock: serving RECORDED DEMO DATA only. Headless Bob, git and the QSE CLI are never contacted. Set STREAM_MODE=realtime for real executions.');
    else
        log.info('STREAM_MODE=realtime: real Headless Bob, git and QSE CLI. No demo data is served.');
    let closing = false;
    const shutdown = async (signal) => {
        if (closing)
            return;
        closing = true;
        state.shuttingDown = true;
        log.info({ signal }, 'shutting down');
        const force = setTimeout(() => process.exit(1), 25_000);
        force.unref();
        clearInterval(purge);
        server.close();
        server.closeAllConnections();
        try {
            await ctx.close();
        }
        catch (err) {
            log.error({ err }, 'error during shutdown');
        }
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('unhandledRejection', (err) => log.error({ err }, 'unhandled rejection'));
    process.on('uncaughtException', (err) => {
        log.fatal({ err }, 'uncaught exception');
        void shutdown('uncaughtException');
    });
}
void main();
//# sourceMappingURL=server.js.map