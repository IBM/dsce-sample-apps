import crypto from 'node:crypto';
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;
/** Correlation ID + request-scoped logger. */
export function requestContext(logger) {
    return (req, res, next) => {
        const incoming = req.header('x-request-id');
        req.id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
        res.setHeader('x-request-id', req.id);
        req.log = logger.child({ requestId: req.id });
        const started = process.hrtime.bigint();
        res.on('finish', () => {
            if (req.path === '/healthz' || req.path === '/readyz')
                return;
            const ms = Number(process.hrtime.bigint() - started) / 1e6;
            req.log.info({ method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms), user: req.auth?.user.username }, 'request');
        });
        next();
    };
}
export const ROLE_RANK = { viewer: 1, operator: 2, admin: 3 };
//# sourceMappingURL=context.js.map