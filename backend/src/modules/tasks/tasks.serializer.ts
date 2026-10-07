import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../../lib/dates';
import type { TaskStatus } from '../../types/roles';
import { userSummarySelect } from '../users/users.serializer';

export const taskInclude = {
  assignee: { select: userSummarySelect },
  project: { select: { id: true, name: true, clientName: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export const taskOrderBy: Prisma.TaskOrderByWithRelationInput[] = [{ deadline: 'asc' }, { createdAt: 'asc' }];

export function toTaskDto(task: TaskWithRelations) {
  return {
    id: task.id,
    projectId: task.projectId,
    project: task.project,
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    deadline: formatDateOnly(task.deadline),
    estimatedHours: task.estimatedHours,
    status: task.status as TaskStatus,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
