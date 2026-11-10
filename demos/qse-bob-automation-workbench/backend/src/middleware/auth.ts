import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import type { Role } from '../models/types.js';
import type { SessionRecord, SessionRepository, UserRepository } from '../repositories/auth.repository.js';
import { AppError, forbidden, unauthorized } from '../utils/errors.js';
import { ROLE_RANK } from './context.js';

export const SESSION_COOKIE = 'qse_sid';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function cookieOptions(config: AppConfig, maxAgeMs?: number) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.cookieSecure,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {})
  };
}

function sameToken(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Origin of the request must be the service's own origin or an allow-listed one. */
function originAllowed(req: Request, config: AppConfig): boolean {
  const origin = req.header('origin');
  if (!origin) return true;
  if (config.corsAllowedOrigins.includes(origin)) return true;
  try {
    const u = new URL(origin);
    const host = req.header('x-forwarded-host') ?? req.header('host');
    return u.host === host;
  } catch {
    return false;
  }
}

function sessionExpired(config: AppConfig, session: SessionRecord, now: number): boolean {
  return Date.parse(session.expiresAt) < now || Date.parse(session.lastSeenAt) + config.sessionIdleMinutes * 60_000 < now;
}

/** The error to return when a state-changing request fails the same-origin or CSRF-token check; null when it passes. */
function csrfFailure(req: Request, config: AppConfig, csrfToken: string): AppError | null {
  if (SAFE_METHODS.has(req.method)) return null;
  if (!originAllowed(req, config)) return forbidden('Cross-origin request rejected');
  const sent = req.header('x-csrf-token');
  if (!sent || !sameToken(sent, csrfToken)) return new AppError(403, 'csrf_invalid', 'CSRF token missing or invalid');
  return null;
}

/**
 * CSRF protection for the cookie-authenticated API. It is installed right after the cookie parser, so every
 * state-changing request that carries a live session must pass the same-origin and X-CSRF-Token checks, whichever
 * route it reaches. Requests without a live session are left to `authenticate` (401), and sign-in is exempt
 * because it has no session or token yet. `authenticate` repeats the check as defence in depth.
 */
export function csrfProtection(config: AppConfig, sessions: SessionRepository) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method) || req.path === '/auth/login') return next();
    const sid = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const session = sid ? sessions.find(sid) : undefined;
    if (!session || sessionExpired(config, session, Date.now())) return next();
    next(csrfFailure(req, config, session.csrfToken) ?? undefined);
  };
}

export function authenticate(config: AppConfig, users: UserRepository, sessions: SessionRepository) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const sid = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!sid) return next(unauthorized());
    const session = sessions.find(sid);
    if (!session) return next(unauthorized('Session is invalid or has expired'));
    if (sessionExpired(config, session, Date.now())) {
      sessions.delete(sid);
      return next(unauthorized('Session has expired. Please sign in again.'));
    }
    const user = users.findById(session.userId);
    if (!user) {
      sessions.delete(sid);
      return next(unauthorized());
    }
    const failure = csrfFailure(req, config, session.csrfToken);
    if (failure) return next(failure);
    sessions.touch(sid);
    req.auth = { user, sessionId: sid, csrfToken: session.csrfToken };
    next();
  };
}

export function requireRole(min: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (ROLE_RANK[req.auth.user.role] < ROLE_RANK[min]) return next(forbidden(`This action requires the ${min} role`));
    next();
  };
}
