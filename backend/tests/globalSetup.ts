import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { TEST_ENV } from './testEnv';

// Runs once before all test files: recreate prisma/test.db from the migrations and seed
// the ten demo users. The development database (prisma/dev.db) is never touched.
export default function globalSetup() {
  const root = path.resolve(__dirname, '..');
  const env = { ...process.env, ...TEST_ENV };

  for (const file of ['test.db', 'test.db-journal']) {
    rmSync(path.join(root, 'prisma', file), { force: true });
  }
  execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: root, env, stdio: 'pipe' });
}
