// Environment for the test run. These values are set on process.env before the app loads,
// and dotenv never overrides variables that already exist, so backend/.env is ignored:
// tests always use a separate database and the offline mock AI (never the real API).
export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./test.db', // relative to prisma/schema.prisma -> prisma/test.db
  JWT_SECRET: 'jest-only-secret-0123456789abcdef',
  JWT_EXPIRES_IN: '1h',
  AI_MOCK: 'true',
  OPENROUTER_API_KEY: '',
  FRONTEND_URL: 'http://localhost:5173, https://crm.novaworks.example/',
} as const;
