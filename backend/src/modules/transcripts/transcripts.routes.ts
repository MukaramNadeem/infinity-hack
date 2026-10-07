import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { commitInputSchema, forceQuerySchema, transcriptInputSchema } from './transcripts.schemas';
import * as controller from './transcripts.controller';

// Meeting transcript -> projects and tasks. ADMIN only.
export const transcriptsRouter = Router();

transcriptsRouter.use(authenticate, requireRole('ADMIN'));

transcriptsRouter.post('/', validate(forceQuerySchema, 'query'), validate(transcriptInputSchema), controller.create);
transcriptsRouter.post('/extract', validate(transcriptInputSchema), controller.extract);
transcriptsRouter.post('/commit', validate(forceQuerySchema, 'query'), validate(commitInputSchema), controller.commit);
transcriptsRouter.get('/', controller.list);
transcriptsRouter.get('/:id', controller.getById);
