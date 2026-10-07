import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { taskListQuerySchema, updateTaskSchema } from './tasks.schemas';
import * as controller from './tasks.controller';

// All reads are role-scoped in the service layer (see access/scope.ts).
// Tasks are created under their project: POST /api/projects/:id/tasks.
export const tasksRouter = Router();

tasksRouter.use(authenticate);

tasksRouter.get('/', validate(taskListQuerySchema, 'query'), controller.list);
tasksRouter.get('/:id', controller.getById);
tasksRouter.patch('/:id', validate(updateTaskSchema), controller.update); // developers: status only
tasksRouter.delete('/:id', requireRole('ADMIN', 'MANAGER'), controller.remove);
