import { prisma } from '../../lib/prisma';
import { notFound } from '../../errors/AppError';
import type { Role } from '../../types/roles';
import { toPublicUser } from './users.serializer';

const ROLE_ORDER: Record<Role, number> = { ADMIN: 0, MANAGER: 1, DEVELOPER: 2 };

export async function listUsers(role?: Role) {
  const users = await prisma.user.findMany({ where: role ? { role } : {} });
  return users
    .map(toPublicUser)
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.code.localeCompare(b.code));
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User');
  return toPublicUser(user);
}
