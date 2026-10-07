import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import {createPool} from '../src/db/pool.js';
import {setup} from './helpers.js';
test('hosted URL SSL parameters cannot override the configured CA',async()=>{
  const pool=createPool({databaseUrl:'postgres://app:placeholder@example.com/app?sslmode=no-verify',databaseSSL:true,databaseCA:'test-ca'});
  const client=new pg.Client(pool.options);
  assert.deepEqual(client.ssl,{ca:'test-ca',rejectUnauthorized:true});await pool.end();
});
test('production proxy login issues secure cross-site cookies and rejects unrelated origins',async()=>{
  const ctx=await setup(undefined,{production:true,cookie:{httpOnly:true,secure:true,sameSite:'none',path:'/'},origins:['https://frontend.example']});
  try {
    assert.equal(ctx.app.get('trust proxy'),1);
    const response=await request(ctx.app).post('/api/auth/login').set('Origin','https://frontend.example').set('X-Forwarded-Proto','https').send({email:'admin@novaworks.example',password:ctx.config.demoPassword}).expect(200);
    const cookie=response.headers['set-cookie'][0];
    for(const flag of ['HttpOnly','Secure','SameSite=None']) assert.ok(cookie.includes(flag));
    await request(ctx.app).get('/api/auth/me').set('Cookie',cookie.split(';')[0]).set('Origin','https://frontend.example').set('X-Forwarded-Proto','https').expect(200);
    await request(ctx.app).post('/api/auth/logout').set('Origin','https://unrelated.example').set('Cookie',cookie.split(';')[0]).expect(403);
  } finally {await ctx.close();}
});
