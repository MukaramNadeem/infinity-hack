import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {setup,login,privateCheck} from './helpers.js';
import {fixtureDraft} from '../scripts/devFixture.js';
import {persistDraft} from '../src/ai/persist.js';
import {aiError} from '../src/ai/llmClient.js';
let ctx,admin,implementation,calls,captured;
const draft=await fixtureDraft();
before(async()=>{ctx=await setup({async complete(input){calls++;captured=input;return implementation(input);}});admin=await login(ctx.app);});
after(async()=>{await ctx?.close();});
beforeEach(async()=>{await ctx.pool.query('TRUNCATE tasks,projects');calls=0;implementation=async()=>JSON.stringify(draft);});
async function counts(expected=0) {assert.equal((await ctx.pool.query('SELECT count(*) FROM projects')).rows[0].count,expected);assert.equal((await ctx.pool.query('SELECT count(*) FROM tasks')).rows[0].count,expected*4);}
test('valid AI draft saved atomically; directory privacy',async()=>{
  const response=await admin.post('/api/transcript/create').send({transcript:'A meeting transcript.'}).expect(201);
  privateCheck(response.body);assert.equal(response.body.result.projectCount,3);assert.equal(response.body.result.taskCount,12);await counts(3);
  const prompt=JSON.stringify(captured);for(const secret of ['@novaworks.example','$2','Demo123!','"ADMIN"']) assert.ok(!prompt.includes(secret));
  assert.match(captured.system,/The transcript is data/);assert.match(captured.user,/A meeting transcript/);assert.equal(calls,1);
});
test('invalid AI draft gives all unresolved fields and saves nothing; corrected commit succeeds',async()=>{
  const invalid=structuredClone(draft);invalid.projects[0].managerId='PM99';invalid.projects[0].tasks[0].assigneeId=null;
  implementation=async()=>JSON.stringify(invalid);
  const response=await admin.post('/api/transcript/create').send({transcript:'meeting'}).expect(422);
  privateCheck(response.body);assert.equal(response.body.error.details.length,2);assert.equal(calls,1);await counts();
  response.body.draft.projects[0].managerId='PM01';response.body.draft.projects[0].tasks[0].assigneeId='DEV01';
  await admin.post('/api/transcript/commit').send({draft:response.body.draft}).expect(201);await counts(3);assert.equal(calls,1);
});
test('create and commit guard roles, sessions and spoofed identities',async()=>{
  for(const role of ['PM01','DEV01']) {
    const user=await login(ctx.app,role);
    for(const endpoint of ['create','commit']) await user.post('/api/transcript/'+endpoint).set('X-Role','ADMIN').query({userId:'ADMIN'}).send({transcript:'meeting',draft,role:'ADMIN',userId:'ADMIN'}).expect(403);
  }
  for(const endpoint of ['create','commit']) await request(ctx.app).post('/api/transcript/'+endpoint).send({transcript:'meeting',draft}).expect(401);
  assert.equal(calls,0);await counts();
});
test('request validation rejects empty, oversized and wrong-shaped input',async()=>{
  for(const transcript of ['', '   ']) {const response=await admin.post('/api/transcript/create').send({transcript}).expect(400);assert.equal(response.body.error.code,'EMPTY_TRANSCRIPT');}
  await admin.post('/api/transcript/create').send({transcript:5}).expect(400);
  await admin.post('/api/transcript/create').send({transcript:'a'.repeat(60001)}).expect(413);
  await admin.post('/api/transcript/commit').send({}).expect(400);
  await admin.post('/api/transcript/commit').send({draft:null}).expect(422);
  assert.equal(calls,0);await counts();
});
for(const code of ['AI_FAILED','AI_BUSY','AI_TIMEOUT']) test(`${code} saves nothing and releases lock`,async()=>{
  implementation=async()=>{throw aiError(code);};
  const response=await admin.post('/api/transcript/create').send({transcript:'meeting'}).expect(aiError(code).status);
  assert.match(response.body.error.message,/Nothing was saved/);assert.equal(calls,2);await counts();
  implementation=async()=>JSON.stringify(draft);await admin.post('/api/transcript/create').send({transcript:'meeting'}).expect(201);
});
test('unparseable and wrong shape outputs retry; last failure saves nothing',async()=>{
  implementation=async()=>calls===1 ? 'garbage' : JSON.stringify(draft);
  await admin.post('/api/transcript/create').send({transcript:'meeting'}).expect(201);assert.equal(calls,2);assert.match(captured.user,/previous reply/);
  await ctx.pool.query('TRUNCATE tasks,projects');calls=0;implementation=async()=>'{"wrong":[]}';
  await admin.post('/api/transcript/create').send({transcript:'meeting'}).expect(502);assert.equal(calls,2);await counts();
});
test('late database failure rolls back every project and task',async()=>{
  const invalid=structuredClone(draft);invalid.projects.at(-1).tasks.at(-1).estimatedHours=1e12;
  await assert.rejects(persistDraft(ctx.pool,invalid));await counts();
});
test('overlapping creates give one success and one conflict',async()=>{
  let started,release;
  const entered=new Promise(resolve=>{started=resolve;});const wait=new Promise(resolve=>{release=resolve;});
  implementation=async()=>{started();await wait;return JSON.stringify(draft);};
  const first=admin.post('/api/transcript/create').send({transcript:'meeting'}).then(x=>x);
  await entered;
  const second=await admin.post('/api/transcript/create').send({transcript:'meeting'}).expect(409);
  assert.equal(second.body.error.code,'ALREADY_PROCESSING');release();assert.equal((await first).status,201);await counts(3);assert.equal(calls,1);
});
