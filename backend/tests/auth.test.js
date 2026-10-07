import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {setup,privateCheck} from './helpers.js';
let ctx;
before(async()=>{ctx=await setup();});after(async()=>{await ctx?.close();});
test('login, session regeneration, me and logout',async()=>{
  const agent=request.agent(ctx.app);
  const logged=await agent.post('/api/auth/login').send({email:'admin@novaworks.example',password:ctx.config.demoPassword}).expect(200);
  privateCheck(logged.body);assert.equal(logged.body.user.id,'ADMIN');assert.match(logged.headers['set-cookie'][0],/HttpOnly/);
  privateCheck((await agent.get('/api/auth/me').expect(200)).body);
  const again=await agent.post('/api/auth/login').send({email:'admin@novaworks.example',password:ctx.config.demoPassword}).expect(200);
  assert.notEqual(logged.headers['set-cookie'][0].split(';')[0],again.headers['set-cookie'][0].split(';')[0]);
  await agent.post('/api/auth/logout').expect(204);
  await agent.get('/api/auth/me').expect(401);
  await request(ctx.app).get('/api/auth/me').expect(401);
});
test('unknown account and wrong password return identical safe errors',async()=>{
  const a=await request(ctx.app).post('/api/auth/login').send({email:'admin@novaworks.example',password:'wrong'}).expect(401);
  const b=await request(ctx.app).post('/api/auth/login').send({email:'unknown@example.com',password:'wrong'}).expect(401);
  assert.deepEqual(a.body,b.body);privateCheck(a.body);
});
test('reject malformed JSON, missing fields, blocked origins; allow configured CORS',async()=>{
  await request(ctx.app).post('/api/auth/login').send({}).expect(400);
  const invalid=await request(ctx.app).post('/api/auth/login').set('Content-Type','application/json').send('{').expect(400);
  assert.equal(invalid.body.error.code,'INVALID_JSON');
  await request(ctx.app).post('/api/auth/login').set('Origin','https://untrusted.example').send({}).expect(403);
  const cors=await request(ctx.app).options('/api/auth/login').set('Origin',ctx.config.origins[0]).set('Access-Control-Request-Method','POST').expect(204);
  assert.equal(cors.headers['access-control-allow-credentials'],'true');
  const missing=await request(ctx.app).get('/missing').expect(404);assert.equal(missing.body.error.code,'NOT_FOUND');
});
