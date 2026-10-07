import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
export function changedTranscript(original) {
  let text=original.replace(/\s+/g,' ');
  const replacements=[
    ['Make the final estimate 10 hours. Keep the task deadline at 22 October.','Make the final estimate 12 hours. Move the task deadline to 23 October.'],
    ['Mobile integration and testing, Usman, 10 hours, 22 October.','Mobile integration and testing, Usman, 12 hours, 23 October.'],
    ['Usman owns Mobile integration and testing: 10 hours, 22 October.','Usman owns Mobile integration and testing: 12 hours, 23 October.']
  ];
  for(const [find,replace] of replacements) {
    if(text.split(find).length!==2) throw new Error('fixture text differs — update the replacements');
    text=text.replace(find,replace);
  }
  return text;
}
const normalize=s=>typeof s==='string' ? s.trim().toLowerCase() : s;
export function compare(actual,expected) {
  const diffs=[];
  function eq(value,want,path) {if(!isDeepStrictEqual(value,want)) diffs.push(`${path}: expected ${JSON.stringify(want)}, got ${JSON.stringify(value)}`);}
  eq(actual.length,expected.projects.length,'projects.length');
  for(const p of expected.projects) {
    const matches=actual.filter(x=>normalize(x.project.name)===normalize(p.name));
    if(matches.length!==1){diffs.push(`${p.name}: expected exactly one project, got ${matches.length}`);continue;}
    const {project,tasks}=matches[0];
    eq(normalize(project.clientName),normalize(p.clientName),p.name+'.clientName');
    eq(project.manager.id,p.managerId,p.name+'.managerId');eq(project.deadline,p.deadline,p.name+'.deadline');
    eq(tasks.length,p.taskCount,p.name+'.tasks.length');eq(project.taskCount,p.taskCount,p.name+'.taskCount');eq(project.totalEstimatedHours,p.totalHours,p.name+'.totalHours');
    if(typeof project.description!=='string' || !project.description.trim()) diffs.push(p.name+': missing description');
    for(const t of p.tasks) {
      const found=tasks.filter(x=>normalize(x.title)===normalize(t.title));
      if(found.length!==1){diffs.push(`${p.name}/${t.title}: expected exactly one task, got ${found.length}`);continue;}
      const task=found[0],path=p.name+'/'+t.title;
      eq(task.assignee.id,t.assigneeId,path+'.assigneeId');eq(task.deadline,t.deadline,path+'.deadline');eq(task.estimatedHours,t.estimatedHours,path+'.estimatedHours');
      if(typeof task.description!=='string' || !task.description.trim()) diffs.push(path+': missing description');
    }
  }
  return diffs;
}
export async function run() {
  const config=loadConfig(),api=process.env.API_URL || 'http://localhost:4000';
  const isLocal=url=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
  if((!isLocal(api) || !isLocal(config.databaseUrl) || config.production) && !process.argv.includes('--allow-remote')) throw new Error('Refusing to clear remote/production work without --allow-remote.');
  const index=process.argv.indexOf('--runs'),runs=index<0 ? 3 : Number(process.argv[index+1]);
  if(!Number.isInteger(runs) || runs<1 || runs>20) throw new Error('--runs must be an integer between 1 and 20.');
  const original=await readFile(new URL('../fixtures/transcript.txt',import.meta.url),'utf8'),changed=changedTranscript(original);
  const expected=JSON.parse(await readFile(new URL('../fixtures/expected.json',import.meta.url),'utf8'));
  const modified=structuredClone(expected),project=modified.projects.find(p=>p.managerId==='PM02'),task=project.tasks.find(t=>t.assigneeId==='DEV04');
  task.estimatedHours=12;task.deadline='2026-10-23';project.totalHours+=2;
  const pool=createPool(config);let cookie;let failures=0;
  const request=async(path,body)=>{
    const response=await fetch(api+'/api'+path,{method:body ? 'POST' : 'GET',headers:{'Content-Type':'application/json',...(cookie ? {Cookie:cookie} : {})},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(config.timeoutMs*config.maxAttempts+30000)});
    const data=await response.json();
    if(!response.ok) throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Request failed'}`);
    if(response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
    return {data,status:response.status};
  };
  try {
    await request('/auth/login',{email:'admin@novaworks.example',password:config.demoPassword});
    for(let i=1;i<=runs;i++) for(const [label,transcript,want] of [['original',original,expected],['changed',changed,modified]]) {
      const start=Date.now();
      try {
        await pool.query('TRUNCATE tasks,projects');
        const result=await request('/transcript/create',{transcript});
        if(result.status!==201) throw new Error('Expected HTTP 201.');
        const {data}=await request('/projects');
        const actual=[];
        for(const p of data.projects) actual.push((await request('/projects/'+p.id)).data);
        const diffs=compare(actual,want);
        const count=(await pool.query('SELECT count(*) FROM users')).rows[0].count;
        if(count!==10) diffs.push(`users: expected 10, got ${count}`);
        const persisted=(await pool.query('SELECT id FROM projects')).rows.map(x=>x.id).sort();
        if(!isDeepStrictEqual(persisted,data.projects.map(x=>x.id).sort())) diffs.push('API and DATABASE_URL do not refer to the same data.');
        if(diffs.length) throw new Error(diffs.join('\n'));
        console.log(`PASS ${label} ${i}/${runs} (${Date.now()-start}ms)`);
      } catch(error) {failures++;console.error(`FAIL ${label} ${i}/${runs}: ${error.message}`);}
    }
    console.log(`AI verification: ${runs*2-failures}/${runs*2} passed (${runs} original, ${runs} changed).`);
    if(failures) process.exitCode=1;
  } finally {await pool.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) run().catch(error=>{console.error(error.message);process.exitCode=1;});
