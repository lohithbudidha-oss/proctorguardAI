import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../models/User';
import { getJwtSecret } from '../config/jwt';
import Session from '../models/Session';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: Role;
    status: string;
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
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  } else if (typeof req.body?.token === 'string') {
    token = req.body.token;
  }

  if (!token) {
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
      isSessionValid = Boolean(activeSession && activeSession.isValid);
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

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Invalid or expired token.' });
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
};
