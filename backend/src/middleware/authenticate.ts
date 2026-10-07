import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../lib/jwt';
import { unauthorized } from '../errors/AppError';
import { toPublicUser } from '../modules/users/users.serializer';

// Requires `Authorization: Bearer <jwt>`. The user is re-loaded from the database on every
// request, so role and identity always come from the DB — never from anything the caller sends.
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return next(unauthorized('Missing or malformed Authorization header'));
  }

  let userId: string;
  try {
    userId = verifyToken(match[1]).sub;
  } catch {
    return next(unauthorized('Invalid or expired token', 'INVALID_TOKEN'));
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return next(unauthorized('User no longer exists', 'INVALID_TOKEN'));
  }

  req.user = toPublicUser(user);
  next();
};
