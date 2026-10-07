import express, { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { transcriptsRouter } from './modules/transcripts/transcripts.routes';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { docsRouter } from './docs';

const healthRouter = Router().get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

// Every API router and its mount path under /api. Also used by tests/docs.test.ts to check
// that docs/openapi.yaml documents every route.
export const API_ROUTERS: [path: string, router: Router][] = [
  ['/health', healthRouter],
  ['/auth', authRouter],
  ['/users', usersRouter],
  ['/projects', projectsRouter],
  ['/tasks', tasksRouter],
  ['/transcripts', transcriptsRouter],
];

// App factory, kept separate from server.ts so Supertest can use it without opening a port.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' })); // transcripts can be long

  app.use('/api/docs', docsRouter());
  for (const [path, router] of API_ROUTERS) app.use(`/api${path}`, router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
