import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { createTaskSchema, taskListQuerySchema } from '../tasks/tasks.schemas';
import { createProjectSchema, updateProjectSchema } from './projects.schemas';
import * as controller from './projects.controller';

// All reads are role-scoped in the service layer (see access/scope.ts).
export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get('/', controller.list);
projectsRouter.post('/', requireRole('ADMIN'), validate(createProjectSchema), controller.create);
projectsRouter.get('/:id', controller.getById);
projectsRouter.patch('/:id', requireRole('ADMIN', 'MANAGER'), validate(updateProjectSchema), controller.update);
projectsRouter.delete('/:id', requireRole('ADMIN'), controller.remove);

projectsRouter.get('/:id/tasks', validate(taskListQuerySchema, 'query'), controller.listTasks);
projectsRouter.post('/:id/tasks', requireRole('ADMIN', 'MANAGER'), validate(createTaskSchema), controller.createTask);
