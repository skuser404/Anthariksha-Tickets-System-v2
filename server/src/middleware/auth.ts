import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/http.js';
import { verifyAccess, type AccessClaims, type Role } from '../lib/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessClaims;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }
  try {
    req.user = verifyAccess(header.slice(7));
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
}

export const requireAdmin = [requireAuth, requireRole('admin')];

/** Gate for super-admin-only actions (admin management, permanent deletes, etc.). */
export function requireSuper(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (req.user.role !== 'admin' || !req.user.isSuper) {
    return next(new ApiError(403, 'Super-admin access required'));
  }
  next();
}
