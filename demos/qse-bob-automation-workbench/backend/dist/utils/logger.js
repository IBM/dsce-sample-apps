import { pino } from 'pino';
import { redact } from './redact.js';
export function createLogger(level = 'info') {
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
                const mapped = args.map((arg) => (typeof arg === 'string' ? redact(arg) : arg));
                method.apply(this, mapped);
            }
        },
        serializers: {
            err: (err) => ({ type: err.name, message: redact(err.message), stack: err.stack ? redact(err.stack) : undefined })
        }
    });
}
//# sourceMappingURL=logger.js.map