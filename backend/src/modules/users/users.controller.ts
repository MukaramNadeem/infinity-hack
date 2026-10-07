import type { Request, Response } from 'express';
import type { Role } from '../../types/roles';
import * as usersService from './users.service';

export async function list(_req: Request, res: Response) {
  const { role } = res.locals.query as { role?: Role };
  res.json({ users: await usersService.listUsers(role) });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  res.json({ user: await usersService.getUser(req.params.id) });
}
