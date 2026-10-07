import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`NovaWorks CRM API listening on http://localhost:${env.PORT}/api`);
  console.log(`API docs: http://localhost:${env.PORT}/api/docs`);
  console.log(`CORS allowed origin(s): ${env.FRONTEND_URL.join(', ')} | AI: ${env.AI_MOCK ? 'mock (offline)' : env.AI_MODEL}`);
});

const shutdown = () => {
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
