import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import bcrypt from 'bcryptjs';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
export const demoUsers=JSON.parse(await readFile(new URL('../db/users.json',import.meta.url),'utf8'));
export async function seed(pool,password='Demo123!') {
  const hash=await bcrypt.hash(password,10);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    for(const u of demoUsers) await client.query(`INSERT INTO users(id,name,email,password_hash,role,specialization,skills)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,
      password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,specialization=EXCLUDED.specialization,skills=EXCLUDED.skills`,
      [u.id,u.name,u.email,hash,u.role,u.specialization,u.skills]);
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
  return demoUsers.map(({id,name,role})=>({id,name,role}));
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const config=loadConfig(),pool=createPool(config);
  try {console.table(await seed(pool,config.demoPassword));} finally {await pool.end();}
}
