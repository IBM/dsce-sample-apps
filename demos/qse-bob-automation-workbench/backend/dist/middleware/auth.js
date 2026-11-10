import crypto from 'node:crypto';
import { AppError, forbidden, unauthorized } from '../utils/errors.js';
import { ROLE_RANK } from './context.js';
export const SESSION_COOKIE = 'qse_sid';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export function cookieOptions(config, maxAgeMs) {
    return {
        httpOnly: true,
        sameSite: 'strict',
        secure: config.cookieSecure,
        path: '/',
        ...(maxAgeMs ? { maxAge: maxAgeMs } : {})
    };
}
function sameToken(a, b) {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
/** Origin of the request must be the service's own origin or an allow-listed one. */
function originAllowed(req, config) {
    const origin = req.header('origin');
    if (!origin)
        return true;
    if (config.corsAllowedOrigins.includes(origin))
        return true;
    try {
        const u = new URL(origin);
        const host = req.header('x-forwarded-host') ?? req.header('host');
        return u.host === host;
    }
    catch {
        return false;
    }
}
export function authenticate(config, users, sessions) {
    return (req, _res, next) => {
        const sid = req.cookies?.[SESSION_COOKIE];
        if (!sid)
            return next(unauthorized());
        const session = sessions.find(sid);
        if (!session)
            return next(unauthorized('Session is invalid or has expired'));
        const now = Date.now();
        if (Date.parse(session.expiresAt) < now || Date.parse(session.lastSeenAt) + config.sessionIdleMinutes * 60_000 < now) {
            sessions.delete(sid);
            return next(unauthorized('Session has expired. Please sign in again.'));
        }
        const user = users.findById(session.userId);
        if (!user) {
            sessions.delete(sid);
            return next(unauthorized());
        }
        if (!SAFE_METHODS.has(req.method)) {
            if (!originAllowed(req, config))
                return next(forbidden('Cross-origin request rejected'));
            const sent = req.header('x-csrf-token');
            if (!sent || !sameToken(sent, session.csrfToken))
                return next(new AppError(403, 'csrf_invalid', 'CSRF token missing or invalid'));
        }
        sessions.touch(sid);
        req.auth = { user, sessionId: sid, csrfToken: session.csrfToken };
        next();
    };
}
export function requireRole(min) {
    return (req, _res, next) => {
        if (!req.auth)
            return next(unauthorized());
        if (ROLE_RANK[req.auth.user.role] < ROLE_RANK[min])
            return next(forbidden(`This action requires the ${min} role`));
        next();
    };
}
//# sourceMappingURL=auth.js.map