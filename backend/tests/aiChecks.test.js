import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {changedTranscript,compare} from '../scripts/testAi.js';
test('changed transcript updates all final references and refuses missing or repeated replacement text',async()=>{
  const transcript=await readFile(new URL('../fixtures/transcript.txt',import.meta.url),'utf8');
  const changed=changedTranscript(transcript);
  assert.ok(changed.includes('Usman owns Mobile integration and testing: 12 hours, 23 October.'));
  assert.throws(()=>changedTranscript('unrelated transcript'),/fixture text differs/);
  assert.throws(()=>changedTranscript(transcript+' '+transcript),/fixture text differs/);
});
test('AI comparison catches extra/missing tasks, wrong owner, date, hours and empty descriptions',async()=>{
  const expected=JSON.parse(await readFile(new URL('../fixtures/expected.json',import.meta.url),'utf8'));
  const actual=expected.projects.map(p=>({project:{...p,description:'project',manager:{id:p.managerId},totalEstimatedHours:p.totalHours},tasks:p.tasks.map(t=>({...t,description:'task',assignee:{id:t.assigneeId}}))}));
  assert.deepEqual(compare(actual,expected),[]);
  actual[0].tasks[0].deadline='2026-10-01';actual[0].tasks[1].assignee.id='DEV99';actual[0].tasks[2].estimatedHours=1;actual[0].project.description='';
  assert.ok(compare(actual,expected).length>=4);
});
