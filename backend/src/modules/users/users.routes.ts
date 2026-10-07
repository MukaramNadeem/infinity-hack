import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { ROLES } from '../../types/roles';
import * as controller from './users.controller';

// Team directory — read-only, visible to every logged-in user.
export const usersRouter = Router();

const listQuerySchema = z.object({ role: z.enum(ROLES).optional() });

usersRouter.use(authenticate);
usersRouter.get('/', validate(listQuerySchema, 'query'), controller.list);
usersRouter.get('/:id', controller.getById);
