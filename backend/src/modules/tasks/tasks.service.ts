import { prisma } from '../../lib/prisma';
import { forbidden, notFound } from '../../errors/AppError';
import { canManageProject, taskWhere } from '../../access/scope';
import type { AuthUser } from '../../types/roles';
import { checkTaskDeadline, checkUserRefs, throwIfIssues } from '../projects/projects.rules';
import { taskInclude, taskOrderBy, toTaskDto } from './tasks.serializer';
import type { TaskListQuery, UpdateTaskInput } from './tasks.schemas';

// Tasks outside the user's scope are reported as 404 (not 403) so their existence isn't revealed.
async function findVisibleTask(user: AuthUser, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, ...taskWhere(user) },
    include: { project: { select: { managerId: true, deadline: true } } },
  });
  if (!task) throw notFound('Task');
  return task;
}

// "My Tasks" for developers; every task in scope for managers and admins.
export async function listTasks(user: AuthUser, query: TaskListQuery) {
  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        taskWhere(user),
        query.projectId ? { projectId: query.projectId } : {},
        query.assigneeId ? { assigneeId: query.assigneeId } : {},
        query.status ? { status: query.status } : {},
      ],
    },
    include: taskInclude,
    orderBy: taskOrderBy,
  });
  return tasks.map(toTaskDto);
}

export async function getTask(user: AuthUser, id: string) {
  const task = await prisma.task.findFirst({ where: { id, ...taskWhere(user) }, include: taskInclude });
  if (!task) throw notFound('Task');
  return toTaskDto(task);
}

// ADMIN / owning MANAGER: any field. Assigned DEVELOPER: `status` only.
export async function updateTask(user: AuthUser, id: string, input: UpdateTaskInput) {
  const task = await findVisibleTask(user, id);

  if (!canManageProject(user, task.project)) {
    const onlyStatus = Object.keys(input).every((key) => key === 'status');
    if (user.role !== 'DEVELOPER' || task.assigneeId !== user.id || !onlyStatus) {
      throw forbidden('Developers can only update the status of their own tasks');
    }
  } else {
    throwIfIssues([
      ...(input.assigneeId
        ? await checkUserRefs([{ path: 'assigneeId', id: input.assigneeId, role: 'DEVELOPER' }])
        : []),
      ...(input.deadline ? checkTaskDeadline(input.deadline, task.project.deadline, 'deadline') : []),
    ]);
  }

  const updated = await prisma.task.update({ where: { id }, data: input, include: taskInclude });
  return toTaskDto(updated);
}

// ADMIN, or the MANAGER who manages the task's project.
export async function deleteTask(user: AuthUser, id: string) {
  const task = await findVisibleTask(user, id);
  if (!canManageProject(user, task.project)) throw forbidden('Only an admin or this project\'s manager can delete tasks');
  await prisma.task.delete({ where: { id } });
}
