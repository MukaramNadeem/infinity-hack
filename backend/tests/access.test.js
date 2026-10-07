import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {setup,login,privateCheck} from './helpers.js';
import {devFixture} from '../scripts/devFixture.js';
import {seed} from '../scripts/seed.js';
let ctx,projects;
before(async()=>{ctx=await setup();await devFixture(ctx.pool);projects=(await ctx.pool.query('SELECT id,manager_id FROM projects')).rows;});
after(async()=>{await ctx?.close();});
const matrix=[['ADMIN',3,12,0],['PM01',1,4,0],['PM02',1,4,0],['PM03',1,4,0],['DEV01',1,3,3],['DEV02',2,2,2],['DEV03',1,2,2],['DEV04',1,1,1],['DEV05',1,2,2],['DEV06',1,2,2]];
for(const [id,projectCount,taskCount,mineCount] of matrix) test(`${id} sees only authorized projects and tasks`,async()=>{
  const agent=await login(ctx.app,id);
  const {body}=await agent.get('/api/projects').query({userId:'ADMIN',role:'ADMIN'}).set('X-User-Id','ADMIN').set('X-Role','ADMIN').expect(200);
  privateCheck(body);assert.equal(body.projects.length,projectCount);
  assert.equal(body.projects.reduce((n,p)=>n+p.taskCount,0),taskCount);
  for(const p of projects) {
    const visible=body.projects.some(x=>x.id===p.id);
    const detail=await agent.get('/api/projects/'+p.id).expect(visible ? 200 : 403);
    const tasks=await agent.get('/api/projects/'+p.id+'/tasks').expect(visible ? 200 : 403);
    privateCheck(detail.body);privateCheck(tasks.body);
    if(visible){assert.equal(detail.body.tasks.length,detail.body.project.taskCount);assert.equal(detail.body.project.totalEstimatedHours,detail.body.tasks.reduce((n,t)=>n+t.estimatedHours,0));assert.deepEqual(tasks.body.tasks,detail.body.tasks);if(id.startsWith('DEV')) for(const t of tasks.body.tasks)assert.equal(t.assignee.id,id);}
  }
  const mine=await agent.get('/api/tasks/mine').expect(200);privateCheck(mine.body);assert.equal(mine.body.tasks.length,mineCount);
  for(const t of mine.body.tasks){assert.equal(t.assignee.id,id);assert.match(t.deadline,/^2026-\d{2}-\d{2}$/);assert.ok(t.project.manager.name);}
  const team=await agent.get('/api/team').expect(200);privateCheck(team.body);assert.equal(team.body.team.length,10);assert.ok(team.body.team.every(x=>!x.email));
  await agent.get('/api/projects/not-a-project').expect(404);
});
test('reads reject anonymous callers; seeding preserves all work and dates',async()=>{
  for(const url of ['/api/projects','/api/team','/api/tasks/mine']) await request(ctx.app).get(url).expect(401);
  await seed(ctx.pool);await seed(ctx.pool);
  assert.equal((await ctx.pool.query('SELECT count(*) FROM users')).rows[0].count,10);
  assert.equal((await ctx.pool.query('SELECT count(*) FROM tasks')).rows[0].count,12);
  assert.equal((await ctx.pool.query("SELECT deadline FROM projects WHERE manager_id='PM01'")).rows[0].deadline,'2026-10-20');
});
