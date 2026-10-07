process.env.TZ='Asia/Karachi';
import assert from 'node:assert/strict';
import request from 'supertest';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
import {initDb} from '../scripts/initDb.js';
import {seed,demoUsers} from '../scripts/seed.js';
import {createApp} from '../src/app.js';
export async function setup(llm,overrides={}) {
  const config={...loadConfig(),...overrides};
  const url=config.testDatabaseUrl;
  if(!url || url===config.databaseUrl || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must identify a separate database ending in _test.');
  const pool=createPool(config,url);
  await initDb(pool);
  await pool.query('TRUNCATE tasks,projects');
  await seed(pool,config.demoPassword);
  const app=createApp({pool,llm,config});
  return {pool,app,config,async close(){await app.locals.sessionStore.close();await pool.end();}};
}
export async function login(app,id='ADMIN') {
  const agent=request.agent(app);
  const response=await agent.post('/api/auth/login').send({email:demoUsers.find(u=>u.id===id).email,password:loadConfig().demoPassword}).expect(200);
  privateCheck(response.body);
  return agent;
}
export function privateCheck(value) {
  if(value && typeof value==='object') for(const [key,item] of Object.entries(value)) {assert.ok(!/password|hash|cookie|secret/i.test(key),`Private field leaked: ${key}`);privateCheck(item);}
}
