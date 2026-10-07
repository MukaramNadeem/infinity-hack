import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
export async function initDb(pool) { await pool.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')); }
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const pool=createPool(loadConfig());
  try {await initDb(pool);console.log('Database schema initialized.');} finally {await pool.end();}
}
