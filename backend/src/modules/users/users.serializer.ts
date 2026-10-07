import type { Prisma, User } from '@prisma/client';
import type { AuthUser, Role } from '../../types/roles';

function parseSkills(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

// Public shape of a user — the only form in which users leave the API (no passwordHash).
export function toPublicUser(user: User): AuthUser {
  return {
    id: user.id,
    code: user.code,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    specialization: user.specialization,
    skills: parseSkills(user.skills),
  };
}

// Compact user embedded in projects/tasks (manager, assignee, members).
export const userSummarySelect = {
  id: true,
  code: true,
  name: true,
  email: true,
  role: true,
  specialization: true,
} satisfies Prisma.UserSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;
