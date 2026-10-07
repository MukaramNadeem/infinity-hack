import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.schemas';
import * as controller from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), controller.login);
authRouter.get('/me', authenticate, controller.me);
authRouter.post('/logout', authenticate, controller.logout);
