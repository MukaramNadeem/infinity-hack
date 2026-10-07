// Business rules that Zod can't express on its own because they need the database
// or cross-field context. Shared by manual CRUD and (later) the transcript flow.

import { prisma } from '../../lib/prisma';
import { badRequest } from '../../errors/AppError';
import { formatDateOnly } from '../../lib/dates';
import type { Role } from '../../types/roles';

export interface Issue {
  path: string;
  message: string;
}

export interface UserRef {
  path: string; // e.g. "tasks.2.assigneeId"
  id: string;
  role: Role; // role the referenced user must have
}

// Every referenced user must exist and have the expected role
// (project managers must be MANAGERs, task assignees must be DEVELOPERs).
export async function checkUserRefs(refs: UserRef[]): Promise<Issue[]> {
  if (refs.length === 0) return [];
  const ids = [...new Set(refs.map((r) => r.id))];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, role: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const issues: Issue[] = [];
  for (const ref of refs) {
    const user = byId.get(ref.id);
    if (!user) {
      issues.push({ path: ref.path, message: `No user with id "${ref.id}"` });
    } else if (user.role !== ref.role) {
      issues.push({ path: ref.path, message: `${user.name} is a ${user.role}, expected a ${ref.role}` });
    }
  }
  return issues;
}

export function checkTaskDeadline(taskDeadline: Date, projectDeadline: Date, path: string): Issue[] {
  if (taskDeadline.getTime() <= projectDeadline.getTime()) return [];
  return [
    {
      path,
      message: `Task deadline ${formatDateOnly(taskDeadline)} is after the project deadline ${formatDateOnly(projectDeadline)}`,
    },
  ];
}

export function throwIfIssues(issues: Issue[]): void {
  if (issues.length > 0) throw badRequest('Request validation failed', issues);
}
