import { pino, type Logger } from 'pino';
import { redact } from './redact.js';

export type { Logger };

export function createLogger(level = 'info'): Logger {
  return pino({
    level,
    base: { service: 'qse-workbench-backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.apiKey',
        '*.token',
        '*.password',
        '*.githubToken',
        '*.csrfToken'
      ],
      censor: '[REDACTED]'
    },
    hooks: {
      logMethod(args, method) {
        const mapped = args.map((arg) => (typeof arg === 'string' ? redact(arg) : arg)) as unknown as Parameters<typeof method>;
        method.apply(this, mapped);
      }
    },
    serializers: {
      err: (err: Error) => ({ type: err.name, message: redact(err.message), stack: err.stack ? redact(err.stack) : undefined })
    }
  });
}
