import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
const config=loadConfig(),api=process.env.API_URL || 'http://localhost:4000';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(api).hostname)) throw new Error('Smoke test requires a local API.');
const pool=createPool(config);
const request=async(path,body,cookie)=>{const response=await fetch(api+'/api'+path,{method:body ? 'POST' : 'GET',headers:{'Content-Type':'application/json',...(cookie ? {Cookie:cookie} : {})},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(210000)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
try {
  await pool.query('TRUNCATE tasks,projects');
  const admin=await request('/auth/login',{email:'admin@novaworks.example',password:config.demoPassword});assert.equal(admin.status,200);
  const transcript=await readFile(new URL('../fixtures/transcript.txt',import.meta.url),'utf8');
  const result=await request('/transcript/create',{transcript},admin.cookie);assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(result.body.result.projectCount,3);assert.equal(result.body.result.taskCount,12);
  const projects=await request('/projects',null,admin.cookie);
  const detail=await request('/projects/'+projects.body.projects[0].id,null,admin.cookie);
  await writeFile(new URL('../docs/API-examples.json',import.meta.url),JSON.stringify({login:admin.body,create:result.body,projects:projects.body,detail:detail.body},null,2)+'\n');
  const manager=await request('/auth/login',{email:'ayesha@novaworks.example',password:config.demoPassword});
  assert.equal((await request('/transcript/create',{transcript},manager.cookie)).status,403);
  assert.equal((await request('/transcript/create',{transcript})).status,401);
  console.log('Live transcript gate passed: 201, 3 projects, 12 tasks; manager 403; anonymous 401.');
} finally {await pool.end();}
