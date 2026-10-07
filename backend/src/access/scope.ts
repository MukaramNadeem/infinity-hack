// Role-based visibility — the single source of truth for who can see what.
// Every project/task query in the app is filtered through these, so access is enforced
// in data requests, not just in the frontend.
//
//   ADMIN     -> all projects, all tasks
//   MANAGER   -> projects they manage, and every task in those projects
//   DEVELOPER -> projects containing at least one task assigned to them,
//                and only the tasks assigned to them (never other developers' tasks)

import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../types/roles';

export function projectWhere(user: AuthUser): Prisma.ProjectWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'MANAGER':
      return { managerId: user.id };
    case 'DEVELOPER':
      return { tasks: { some: { assigneeId: user.id } } };
  }
}

export function taskWhere(user: AuthUser): Prisma.TaskWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'MANAGER':
      return { project: { managerId: user.id } };
    case 'DEVELOPER':
      return { assigneeId: user.id };
  }
}

// Edit rights over a project and its tasks (create/edit/delete tasks, edit project details).
export function canManageProject(user: AuthUser, project: { managerId: string }): boolean {
  return user.role === 'ADMIN' || (user.role === 'MANAGER' && project.managerId === user.id);
}
