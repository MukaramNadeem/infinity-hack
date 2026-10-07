import type { Prisma } from '@prisma/client';
import { taskWhere } from '../../access/scope';
import { formatDateOnly } from '../../lib/dates';
import type { AuthUser } from '../../types/roles';
import { userSummarySelect, type UserSummary } from '../users/users.serializer';
import { taskInclude, taskOrderBy, toTaskDto } from '../tasks/tasks.serializer';

// Loads a project together with only the tasks the current user may see, so task counts,
// hours and members never leak information about tasks outside the user's scope.
export function projectInclude(user: AuthUser) {
  return {
    manager: { select: userSummarySelect },
    tasks: { where: taskWhere(user), include: taskInclude, orderBy: taskOrderBy },
  } satisfies Prisma.ProjectInclude;
}

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { manager: { select: typeof userSummarySelect }; tasks: { include: typeof taskInclude } };
}>;

// Members = distinct developers assigned to the (visible) tasks of the project.
function membersOf(project: ProjectWithRelations): UserSummary[] {
  const byId = new Map<string, UserSummary>();
  for (const task of project.tasks) byId.set(task.assignee.id, task.assignee);
  return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function toProjectSummary(project: ProjectWithRelations) {
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    description: project.description,
    deadline: formatDateOnly(project.deadline),
    manager: project.manager,
    members: membersOf(project),
    taskCount: project.tasks.length,
    totalEstimatedHours: project.tasks.reduce((sum, t) => sum + t.estimatedHours, 0),
    transcriptId: project.transcriptId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function toProjectDetail(project: ProjectWithRelations) {
  return { ...toProjectSummary(project), tasks: project.tasks.map(toTaskDto) };
}
