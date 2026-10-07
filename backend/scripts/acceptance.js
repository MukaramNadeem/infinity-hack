import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
import {seed} from './seed.js';
import {compare} from './testAi.js';
const config=loadConfig(),api=process.env.API_URL || 'http://localhost:4000',snapshot='/tmp/novaworks-restart-proof.json';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(api).hostname)) throw new Error('Acceptance script is local only.');
let cookie;
async function call(path,body,session=cookie) {
  const response=await fetch(api+'/api'+path,{method:body ? 'POST' : 'GET',headers:{'Content-Type':'application/json',...(session ? {Cookie:session} : {})},...(body ? {body:JSON.stringify(body)} : {})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
if(process.argv.includes('--after-restart')) {
  const before=JSON.parse(await readFile(snapshot,'utf8'));cookie=before.cookie;
  assert.equal((await call('/auth/me')).status,200);
  const response=await call('/projects');assert.equal(response.status,200);assert.deepEqual(response.data.projects,before.projects);
  await unlink(snapshot);console.log('API RESTART PASS: persisted session and unchanged saved projects.');
} else {
  const pool=createPool(config);
  try {
    const before=(await pool.query('SELECT id FROM projects ORDER BY id')).rows;
    await seed(pool,config.demoPassword);await seed(pool,config.demoPassword);
    assert.deepEqual((await pool.query('SELECT id FROM projects ORDER BY id')).rows,before);
    assert.equal((await pool.query('SELECT count(*) FROM users')).rows[0].count,10);
    const login=await call('/auth/login',{email:'admin@novaworks.example',password:config.demoPassword});assert.equal(login.status,200);cookie=login.cookie;
    const response=await call('/projects');assert.equal(response.status,200);
    const actual=[];for(const p of response.data.projects) actual.push((await call('/projects/'+p.id)).data);
    const expected=JSON.parse(await readFile(new URL('../fixtures/expected.json',import.meta.url),'utf8'));
    assert.deepEqual(compare(actual,expected),[]);
    await writeFile(snapshot,JSON.stringify({cookie,projects:response.data.projects}),{mode:0o600});
    const quick=actual.find(x=>x.project.manager.id==='PM02').project.id;
    for(const [email,projects,tasks] of [['ayesha',1,0],['ali',1,3],['hamza',2,2]]) {
      const user=await call('/auth/login',{email:email+'@novaworks.example',password:config.demoPassword},null);
      assert.equal((await call('/projects',null,user.cookie)).data.projects.length,projects);
      assert.equal((await call('/tasks/mine',null,user.cookie)).data.tasks.length,tasks);
      if(email==='ali') assert.equal((await call('/projects/'+quick,null,user.cookie)).status,403);
    }
    const invalid=await call('/transcript/commit',{draft:{projects:[{name:'Invalid demo',clientName:'Demo',managerId:'PM01',deadline:'2026-10-20',tasks:[{title:'Invalid owner',assigneeId:'UNKNOWN',deadline:'2026-10-12',estimatedHours:2}]}]}});
    assert.equal(invalid.status,422);assert.ok(invalid.data.error.details.some(e=>e.path.endsWith('assigneeId')));
    assert.deepEqual((await pool.query('SELECT id FROM projects ORDER BY id')).rows,before);
    await pool.query(await readFile(new URL('../db/verify.sql',import.meta.url),'utf8'));
    console.log('LIVE ACCEPTANCE PASS: 10 users, exact original projects/tasks, 40/46/38 hours, role views, 403 denial, 422/no writes; session snapshot stored privately for restart verification.');
  } finally {await pool.end();}
}
