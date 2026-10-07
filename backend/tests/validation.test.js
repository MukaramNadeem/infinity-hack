import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDraft} from '../src/ai/validate.js';
import {extractJson} from '../src/ai/extract.js';
import {fixtureDraft} from '../scripts/devFixture.js';
import {demoUsers} from '../scripts/seed.js';
const original=await fixtureDraft();
const validate=draft=>validateDraft(draft,demoUsers,'2026-10-07');
const cases=[
 ['V1',d=>d.projects=[], 'projects'],
 ['V2 name',d=>d.projects[0].name='', 'projects[0].name'],
 ['V2 client',d=>d.projects[0].clientName='', 'projects[0].clientName'],
 ['V3 missing',d=>d.projects[0].managerId=null, 'projects[0].managerId','could not be determined'],
 ['V3 unknown',d=>d.projects[0].managerId='PM99', 'projects[0].managerId','not in the team'],
 ['V3 role',d=>d.projects[0].managerId='DEV01', 'projects[0].managerId','MANAGER role'],
 ['V4 impossible',d=>d.projects[0].deadline='2026-02-30', 'projects[0].deadline'],
 ['V4 year',d=>d.projects[0].deadline='2027-10-20', 'projects[0].deadline'],
 ['V5',d=>d.projects[0].tasks=[], 'projects[0].tasks'],
 ['V6',d=>d.projects.push(structuredClone(d.projects[0])), 'projects[3].name'],
 ['V7',d=>d.projects[0].tasks[0].title='', 'projects[0].tasks[0].title'],
 ['V8 missing',d=>d.projects[0].tasks[0].assigneeId=null, 'projects[0].tasks[0].assigneeId','could not be determined'],
 ['V8 unknown',d=>d.projects[0].tasks[0].assigneeId='DEV99', 'projects[0].tasks[0].assigneeId','not in the team'],
 ['V8 role',d=>d.projects[0].tasks[0].assigneeId='PM01', 'projects[0].tasks[0].assigneeId','AGENT role'],
 ['V9 format',d=>d.projects[0].tasks[0].deadline='tomorrow', 'projects[0].tasks[0].deadline'],
 ['V9 after',d=>d.projects[0].tasks[0].deadline='2026-10-23', 'projects[0].tasks[0].deadline','after the project deadline'],
 ...[0,-1,1001,Infinity,NaN,true,[],{},null,'abc'].map((value,i)=>['V10 '+i,d=>d.projects[0].tasks[0].estimatedHours=value,'projects[0].tasks[0].estimatedHours'])
];
for(const [name,mutate,path,message] of cases) test(name,()=>{const draft=structuredClone(original);mutate(draft);const result=validate(draft);assert.equal(result.ok,false);assert.ok(result.errors.some(x=>x.path===path && (!message || x.message.includes(message))));});
test('normalization, unknown fields, numeric strings, all errors, and arbitrary JSON values',()=>{
  const draft=structuredClone(original);draft.projects[0].managerId=' pm01 ';draft.projects[0].tasks[0].estimatedHours='12';draft.projects[0].ignored='ignored';delete draft.projects[0].description;
  const result=validate(draft);assert.equal(result.ok,true);assert.equal(result.draft.projects[0].managerId,'PM01');assert.equal(result.draft.projects[0].description,'');assert.equal(result.draft.projects[0].tasks[0].estimatedHours,12);assert.ok(!Object.hasOwn(result.draft.projects[0],'ignored'));
  const invalid=validate({projects:[{tasks:[null]}]});assert.ok(invalid.errors.length>=7);
  for(const value of [null,[],false,123,'text',{projects:[null,1,'x',{tasks:[false,1,[]]}]}]) assert.doesNotThrow(()=>validate(value));
});
test('extract bare, fenced, prose JSON; reject garbage',()=>{
  for(const value of ['{"projects":[]}','```json\n{"projects":[]}\n```','Here is the output: {"projects":[]} Thank you.']) assert.deepEqual(extractJson(value),{projects:[]});
  assert.throws(()=>extractJson('not JSON'));
});
