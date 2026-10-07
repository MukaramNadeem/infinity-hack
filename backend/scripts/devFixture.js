import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
export async function fixtureDraft() {
  const expected=JSON.parse(await readFile(new URL('../fixtures/expected.json',import.meta.url),'utf8'));
  return {projects:expected.projects.map(({taskCount,totalHours,...p})=>({...p,description:'Development fixture project.',tasks:p.tasks.map(t=>({...t,description:'Development fixture task.'}))}))};
}
export async function devFixture(pool) {
  if(process.env.NODE_ENV==='production') throw new Error('DEV FIXTURE is forbidden in production.');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    for(const p of (await fixtureDraft()).projects) {
      const id=randomUUID();
      await client.query('INSERT INTO projects(id,name,client_name,description,manager_id,deadline) VALUES($1,$2,$3,$4,$5,$6)',[id,p.name,p.clientName,p.description,p.managerId,p.deadline]);
      for(const t of p.tasks) await client.query('INSERT INTO tasks(id,project_id,title,description,assignee_id,deadline,estimated_hours) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,t.title,t.description,t.assigneeId,t.deadline,t.estimatedHours]);
    }
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.env.NODE_ENV==='production') throw new Error('DEV FIXTURE is forbidden in production.');
  const pool=createPool(loadConfig());
  try {await devFixture(pool);console.log('DEV FIXTURE — not for the demo');} finally {await pool.end();}
}
