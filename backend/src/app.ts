import express from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// App factory, kept separate from server.ts so Supertest can use it without opening a port.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' })); // transcripts can be long

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
