import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import type { AppContext } from './app-context.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestContext } from './middleware/context.js';
import { apiRateLimit, corsPolicy, securityHeaders } from './middleware/security.js';
import { apiRouter } from './routes/index.js';

export interface AppState {
  shuttingDown: boolean;
}

export function createApp(ctx: AppContext, state: AppState = { shuttingDown: false }): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', ctx.config.trustProxy);
  app.use(requestContext(ctx.log));
  app.use(securityHeaders());

  // Probes: unauthenticated and free of secrets.
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/readyz', (_req, res) => {
    const checks = {
      database: (() => {
        try {
          return ctx.db.ping();
        } catch {
          return false;
        }
      })(),
      workspace: (() => {
        try {
          return ctx.repos.list() !== undefined;
        } catch {
          return false;
        }
      })(),
      accepting: !state.shuttingDown
    };
    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
  });

  app.use('/api', corsPolicy(ctx.config), apiRateLimit(ctx.config), cookieParser(), express.json({ limit: '64kb', strict: true }), (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', apiRouter(ctx));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
