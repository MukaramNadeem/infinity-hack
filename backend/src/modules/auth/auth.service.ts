import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { DUMMY_HASH, verifyPassword } from '../../lib/password';
import { unauthorized } from '../../errors/AppError';
import { toPublicUser } from '../users/users.serializer';
import type { LoginInput } from './auth.schemas';

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always run bcrypt, and return the same error for unknown email and wrong password.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const publicUser = toPublicUser(user);
  return {
    token: signToken({ sub: user.id, role: user.role }),
    user: publicUser,
  };
}
