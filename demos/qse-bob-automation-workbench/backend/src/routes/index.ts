import { Router } from 'express';
import type { AppContext } from '../app-context.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { heavyRateLimit, loginRateLimit } from '../middleware/security.js';
import { controllers } from '../controllers/index.js';

type Handler = (req: any, res: any, next: any) => unknown;

/** Express 5 forwards rejected promises, but wrapping keeps sync throws consistent too. */
const h = (fn: Handler): Handler => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch(next);
  } catch (e) {
    next(e);
  }
};

export function apiRouter(ctx: AppContext): Router {
  const c = controllers(ctx);
  const router = Router();
  const authn = authenticate(ctx.config, ctx.users, ctx.sessions);
  const heavy = heavyRateLimit(ctx.config);
  const operator = requireRole('operator');
  const admin = requireRole('admin');

  router.post('/auth/login', loginRateLimit(ctx.config), h(c.auth.login));
  router.post('/auth/logout', authn, h(c.auth.logout));
  router.get('/auth/me', authn, h(c.auth.me));
  router.post('/auth/password', authn, h(c.auth.changePassword));

  router.use(authn);

  router.get('/bob/status', h(c.bob.status));
  router.post('/bob/connect', operator, heavy, h(c.bob.connect));
  router.post('/bob/test-connection', operator, heavy, h(c.bob.test));
  router.post('/bob/disconnect', operator, h(c.bob.disconnect));

  router.get('/repositories', h(c.repositories.list));
  router.post('/repositories/validate', operator, heavy, h(c.repositories.validate));
  router.post('/repositories/clone', operator, heavy, h(c.repositories.clone));
  router.get('/repositories/:id', h(c.repositories.get));
  router.post('/repositories/:id/reclone', operator, heavy, h(c.repositories.reclone));
  router.delete('/repositories/:id', operator, h(c.repositories.remove));

  router.get('/qse/discover', operator, h(c.qse.discover));
  router.post('/qse/configure', operator, heavy, h(c.qse.configure));
  router.post('/qse/validate', operator, heavy, h(c.qse.validate));
  router.get('/qse/status', h(c.qse.status));

  router.post('/executions', operator, heavy, h(c.executions.create));
  router.get('/executions', h(c.executions.list));
  router.get('/executions/prompts', h(c.executions.prompts));
  router.get('/executions/:id', h(c.executions.get));
  router.get('/executions/:id/stream', h(c.executions.stream));
  router.post('/executions/:id/cancel', operator, h(c.executions.cancel));
  router.get('/executions/:id/logs', h(c.executions.logs));
  router.get('/executions/:id/report', h(c.executions.report));
  router.get('/executions/:id/artifacts', h(c.executions.artifacts));
  router.get('/executions/:id/artifacts/:artifactId/download', h(c.executions.artifact));

  router.get('/reports/:id', h(c.reports.get));
  router.get('/reports/:id/download', h(c.reports.download));
  router.get('/reports/:id/export', h(c.reports.export));

  router.get('/settings', h(c.system.settings));
  router.post('/admin/rotate-secrets', admin, h(c.system.rotateSecrets));

  return router;
}
