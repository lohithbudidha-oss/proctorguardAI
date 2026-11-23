import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../models/User';
import { getJwtSecret } from '../config/jwt';
import Session from '../models/Session';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    id?: string;
    role: Role;
    status: string;
    email?: string;
    name?: string;
  };
}

// In-memory cache for valid sessions to prevent redundant MongoDB round trips on high-frequency requests
// Cache entries remain valid for 60 seconds
interface CachedSession {
  isValid: boolean;
  cachedAt: number;
}
const sessionCache = new Map<string, CachedSession>();
const CACHE_TTL_MS = 60 * 1000;

export const invalidateSessionCache = (token?: string) => {
  if (token) {
    sessionCache.delete(token);
  } else {
    sessionCache.clear();
  }
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token.trim();
  } else if (typeof req.body?.token === 'string') {
    token = req.body.token.trim();
  } else if (typeof req.headers['x-access-token'] === 'string') {
    token = (req.headers['x-access-token'] as string).trim();
  }

  if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Token missing.' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;
    
    // REM-08: Session Revocation Check with in-memory caching
    const now = Date.now();
    const cached = sessionCache.get(token);
    let isSessionValid = false;

    if (cached && (now - cached.cachedAt < CACHE_TTL_MS)) {
      isSessionValid = cached.isValid;
    } else {
      const activeSession = await Session.findOne({ tokenIdentifier: token }).lean();
      if (activeSession) {
        isSessionValid = Boolean(activeSession.isValid);
      } else {
        // If session document does not exist yet for this cryptographically valid token,
        // self-heal by upserting active session so subsequent queries and logout revoke it cleanly
        isSessionValid = true;
        Session.findOneAndUpdate(
          { tokenIdentifier: token },
          {
            userId: decoded.userId || decoded.id,
            tokenIdentifier: token,
            isValid: true,
            expiresAt: new Date(decoded.exp ? decoded.exp * 1000 : Date.now() + 8 * 60 * 60 * 1000)
          },
          { upsert: true, returnDocument: 'after' }
        ).catch(() => {});
      }

      sessionCache.set(token, { isValid: isSessionValid, cachedAt: now });

      // Prevent unbound memory growth
      if (sessionCache.size > 10000) {
        const oldestKeys = Array.from(sessionCache.keys()).slice(0, 1000);
        oldestKeys.forEach(k => sessionCache.delete(k));
      }
    }

    if (!isSessionValid) {
      sessionCache.delete(token);
      return res.status(401).json({ success: false, message: 'Unauthorized. Session revoked.' });
    }

    req.user = {
      ...decoded,
      userId: (decoded.userId || decoded.id || decoded._id)?.toString(),
      id: (decoded.id || decoded.userId || decoded._id)?.toString()
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Invalid or expired token.' });
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    const userRole = String(req.user.role).toUpperCase();
    const allowed = roles.map(r => String(r).toUpperCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
};
