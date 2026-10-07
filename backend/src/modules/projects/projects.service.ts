import { prisma } from '../../lib/prisma';
import { forbidden, notFound } from '../../errors/AppError';
import { canManageProject, projectWhere, taskWhere } from '../../access/scope';
import type { AuthUser } from '../../types/roles';
import { taskInclude, taskOrderBy, toTaskDto } from '../tasks/tasks.serializer';
import type { CreateTaskInput, TaskListQuery } from '../tasks/tasks.schemas';
import { projectInclude, toProjectDetail, toProjectSummary } from './projects.serializer';
import { checkTaskDeadline, checkUserRefs, throwIfIssues } from './projects.rules';
import type { CreateProjectInput, UpdateProjectInput } from './projects.schemas';

// Projects outside the user's scope are reported as 404 (not 403) so their existence isn't revealed.
async function findVisibleProject(user: AuthUser, id: string) {
  const project = await prisma.project.findFirst({ where: { id, ...projectWhere(user) } });
  if (!project) throw notFound('Project');
  return project;
}

export async function listProjects(user: AuthUser) {
  const projects = await prisma.project.findMany({
    where: projectWhere(user),
    include: projectInclude(user),
    orderBy: [{ deadline: 'asc' }, { name: 'asc' }],
  });
  return projects.map(toProjectSummary);
}

export async function getProject(user: AuthUser, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, ...projectWhere(user) },
    include: projectInclude(user),
  });
  if (!project) throw notFound('Project');
  return toProjectDetail(project);
}

export async function listProjectTasks(user: AuthUser, projectId: string, query: TaskListQuery) {
  await findVisibleProject(user, projectId);
  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        taskWhere(user),
        { projectId },
        query.status ? { status: query.status } : {},
        query.assigneeId ? { assigneeId: query.assigneeId } : {},
      ],
    },
    include: taskInclude,
    orderBy: taskOrderBy,
  });
  return tasks.map(toTaskDto);
}

// ADMIN only (enforced by the route). Project and its tasks are created in one atomic write.
export async function createProject(user: AuthUser, input: CreateProjectInput) {
  throwIfIssues([
    ...(await checkUserRefs([
      { path: 'managerId', id: input.managerId, role: 'MANAGER' },
      ...input.tasks.map((t, i) => ({ path: `tasks.${i}.assigneeId`, id: t.assigneeId, role: 'DEVELOPER' as const })),
    ])),
    ...input.tasks.flatMap((t, i) => checkTaskDeadline(t.deadline, input.deadline, `tasks.${i}.deadline`)),
  ]);

  const project = await prisma.project.create({
    data: {
      name: input.name,
      clientName: input.clientName,
      description: input.description,
      managerId: input.managerId,
      deadline: input.deadline,
      tasks: { create: input.tasks },
    },
    include: projectInclude(user),
  });
  return toProjectDetail(project);
}

// ADMIN, or the MANAGER who manages the project. Only ADMIN may reassign the manager.
export async function updateProject(user: AuthUser, id: string, input: UpdateProjectInput) {
  const project = await findVisibleProject(user, id);
  if (!canManageProject(user, project)) throw forbidden('Only an admin or this project\'s manager can edit it');
  if (input.managerId !== undefined && user.role !== 'ADMIN') {
    throw forbidden('Only an admin can change a project\'s manager');
  }

  const issues = input.managerId
    ? await checkUserRefs([{ path: 'managerId', id: input.managerId, role: 'MANAGER' }])
    : [];
  if (input.deadline) {
    const latest = await prisma.task.aggregate({ where: { projectId: id }, _max: { deadline: true } });
    if (latest._max.deadline) {
      issues.push(
        ...checkTaskDeadline(latest._max.deadline, input.deadline, 'deadline').map((i) => ({
          ...i,
          message: `${i.message}; move those task deadlines first`,
        })),
      );
    }
  }
  throwIfIssues(issues);

  const updated = await prisma.project.update({
    where: { id },
    data: input,
    include: projectInclude(user),
  });
  return toProjectDetail(updated);
}

// ADMIN only (enforced by the route). Cascades to the project's tasks.
export async function deleteProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) throw notFound('Project');
  await prisma.project.delete({ where: { id } });
}

// ADMIN, or the MANAGER who manages the project.
export async function createTask(user: AuthUser, projectId: string, input: CreateTaskInput) {
  const project = await findVisibleProject(user, projectId);
  if (!canManageProject(user, project)) throw forbidden('Only an admin or this project\'s manager can add tasks');

  throwIfIssues([
    ...(await checkUserRefs([{ path: 'assigneeId', id: input.assigneeId, role: 'DEVELOPER' }])),
    ...checkTaskDeadline(input.deadline, project.deadline, 'deadline'),
  ]);

  const task = await prisma.task.create({
    data: { ...input, projectId },
    include: taskInclude,
  });
  return toTaskDto(task);
}
