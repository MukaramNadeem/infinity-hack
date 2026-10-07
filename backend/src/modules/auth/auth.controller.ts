import type { Request, Response } from 'express';
import * as authService from './auth.service';
import type { LoginInput } from './auth.schemas';

export async function login(_req: Request, res: Response) {
  const result = await authService.login(res.locals.body as LoginInput);
  res.json(result);
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

// JWTs are stateless: logout is the client discarding its token. The endpoint exists so the
// frontend has a uniform contract (and a place to add token revocation later if needed).
export function logout(_req: Request, res: Response) {
  res.status(204).end();
}
