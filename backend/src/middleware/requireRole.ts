import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../errors/AppError';
import type { Role } from '../types/roles';

// Use after `authenticate`: router.post('/', authenticate, requireRole('ADMIN'), handler)
export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(forbidden(`This action requires role: ${allowed.join(' or ')}`));
    }
    next();
  };
