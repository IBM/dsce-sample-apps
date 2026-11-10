import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../utils/logger.js';
import type { Role, User } from '../models/types.js';
import type { SessionRecord } from '../repositories/auth.repository.js';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    log: Logger;
    auth?: { user: User; sessionId: string; csrfToken: string };
    /** The live session behind the request's cookie; set by the CSRF middleware for state-changing requests. */
    session?: SessionRecord;
  }
}

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Correlation ID + request-scoped logger. */
export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    req.id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('x-request-id', req.id);
    req.log = logger.child({ requestId: req.id });
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path === '/healthz' || req.path === '/readyz') return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      req.log.info({ method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms), user: req.auth?.user.username }, 'request');
    });
    next();
  };
}

export const ROLE_RANK: Record<Role, number> = { viewer: 1, operator: 2, admin: 3 };
