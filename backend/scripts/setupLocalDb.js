import { spawnSync } from 'node:child_process';
import { loadConfig } from '../src/config.js';
const config = loadConfig();
const db = new URL(config.databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(db.hostname)) throw new Error('Local setup requires a localhost database.');
const result = spawnSync('psql', ['-X', '-w', '-U', 'postgres', '-d', 'postgres', '-p', db.port || '5432', '-f', 'db/setup-local.sql'], {
  stdio: 'inherit', env: { ...process.env, NW_DATABASE_PASSWORD: decodeURIComponent(db.password) }
});
process.exitCode = result.status ?? 1;
