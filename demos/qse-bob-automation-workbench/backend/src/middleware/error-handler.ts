import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { redact } from '../utils/redact.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'route_not_found', `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.id;
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        requestId
      }
    });
    return;
  }
  if (err instanceof AppError) {
    if (err.status >= 500) req.log?.error({ err }, 'request failed');
    res.status(err.status).json({ error: { code: err.code, message: redact(err.message), details: err.details, requestId } });
    return;
  }
  // body-parser / http-errors
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status < 500) {
    const message = err.type === 'entity.too.large' ? 'Request body is too large' : err.type === 'entity.parse.failed' ? 'Malformed JSON body' : 'Bad request';
    res.status(status).json({ error: { code: 'bad_request', message, requestId } });
    return;
  }
  req.log?.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal_error', message: 'An unexpected error occurred', requestId } });
};
