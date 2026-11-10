import cors from 'cors';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { AppConfig } from '../config/env.js';

export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] }
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: { maxAge: 31536000, includeSubDomains: true }
  });
}

export function corsPolicy(config: AppConfig): RequestHandler {
  return cors({
    origin: (origin, cb) => cb(null, !origin ? false : config.corsAllowedOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id', 'last-event-id'],
    maxAge: 600
  });
}

const limiterResponse = { error: { code: 'rate_limited', message: 'Too many requests. Please slow down and retry shortly.' } };

export function apiRateLimit(config: AppConfig): RequestHandler {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: limiterResponse,
    skip: (req) => req.path === '/healthz' || req.path === '/readyz'
  });
}

export function loginRateLimit(config: AppConfig): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit: config.rateLimit.loginMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Too many sign-in attempts. Try again later.' } }
  });
}

/** Tighter limit for operations that spawn processes or call out to remote systems. */
export function heavyRateLimit(config: AppConfig): RequestHandler {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: Math.max(10, Math.floor(config.rateLimit.max / 6)),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: limiterResponse
  });
}
