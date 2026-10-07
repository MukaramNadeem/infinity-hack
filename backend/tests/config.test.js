import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
const base = {DATABASE_URL:'postgres://user:password@localhost/test',SESSION_SECRET:'s'.repeat(48),LLM_PROVIDER:'openai',LLM_API_KEY:'test-key',LLM_MODEL:'test-model'};
test('configuration fails safely for missing credentials',()=>{
  assert.throws(()=>loadConfig({...base,SESSION_SECRET:''}),/SESSION_SECRET/);
  assert.throws(()=>loadConfig({...base,LLM_MODEL:''}),/LLM_MODEL/);
});
test('configuration enforces valid dates and secure cross-site cookies',()=>{
  assert.throws(()=>loadConfig({...base,MEETING_DATE:'2026-02-30'}),/MEETING_DATE/);
  assert.throws(()=>loadConfig({...base,COOKIE_SAMESITE:'none'}),/COOKIE_SAMESITE/);
  assert.throws(()=>loadConfig({...base,NODE_ENV:'production',DEBUG_AI:'true'}),/DEBUG_AI/);
  assert.equal(loadConfig({...base,NODE_ENV:'production'}).cookie.secure,true);
});
test('configuration decodes PEM newlines and trims base URL',()=>{
  const config=loadConfig({...base,DATABASE_CA_CERT:'line1\\nline2',LLM_BASE_URL:'https://example.com/v1/'});
  assert.equal(config.databaseCA,'line1\nline2');
  assert.equal(config.baseUrl,'https://example.com/v1');
});
