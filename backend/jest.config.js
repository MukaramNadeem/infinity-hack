/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // Fresh SQLite test database (prisma/test.db): migrated + seeded once per run.
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  // Points the app at the test DB and the mock AI before any app module loads.
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.ts'],
  testTimeout: 20000,
};
