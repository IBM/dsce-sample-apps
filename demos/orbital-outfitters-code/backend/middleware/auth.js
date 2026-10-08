import jwt from 'jsonwebtoken';

export default function requireAuth(req, res, next) {
  // Prefer httpOnly cookie; fall back to Authorization header for API/agent clients.
  const cookieToken = req.cookies?.token;
  const header = req.headers.authorization;
  const token = cookieToken || (header?.startsWith('Bearer ') ? header.slice(7) : null);

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
