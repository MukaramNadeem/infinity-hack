import type { Request, Response } from 'express';
import type { TaskListQuery, UpdateTaskInput } from './tasks.schemas';
import * as tasksService from './tasks.service';

type IdParams = Request<{ id: string }>;

export async function list(req: Request, res: Response) {
  res.json({ tasks: await tasksService.listTasks(req.user!, res.locals.query as TaskListQuery) });
}

export async function getById(req: IdParams, res: Response) {
  res.json({ task: await tasksService.getTask(req.user!, req.params.id) });
}

export async function update(req: IdParams, res: Response) {
  const input = res.locals.body as UpdateTaskInput;
  res.json({ task: await tasksService.updateTask(req.user!, req.params.id, input) });
}

export async function remove(req: IdParams, res: Response) {
  await tasksService.deleteTask(req.user!, req.params.id);
  res.status(204).end();
}
