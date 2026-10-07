import type { Request, Response } from 'express';
import type { CreateTaskInput, TaskListQuery } from '../tasks/tasks.schemas';
import type { CreateProjectInput, UpdateProjectInput } from './projects.schemas';
import * as projectsService from './projects.service';

type IdParams = Request<{ id: string }>;

export async function list(req: Request, res: Response) {
  res.json({ projects: await projectsService.listProjects(req.user!) });
}

export async function getById(req: IdParams, res: Response) {
  res.json({ project: await projectsService.getProject(req.user!, req.params.id) });
}

export async function listTasks(req: IdParams, res: Response) {
  const query = res.locals.query as TaskListQuery;
  res.json({ tasks: await projectsService.listProjectTasks(req.user!, req.params.id, query) });
}

export async function create(req: Request, res: Response) {
  const project = await projectsService.createProject(req.user!, res.locals.body as CreateProjectInput);
  res.status(201).json({ project });
}

export async function update(req: IdParams, res: Response) {
  const input = res.locals.body as UpdateProjectInput;
  res.json({ project: await projectsService.updateProject(req.user!, req.params.id, input) });
}

export async function remove(req: IdParams, res: Response) {
  await projectsService.deleteProject(req.params.id);
  res.status(204).end();
}

export async function createTask(req: IdParams, res: Response) {
  const task = await projectsService.createTask(req.user!, req.params.id, res.locals.body as CreateTaskInput);
  res.status(201).json({ task });
}
