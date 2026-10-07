import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadConfig} from '../src/config.js';
const run=promisify(execFile),config=loadConfig(),source=new URL(config.databaseUrl);
if(!['localhost','127.0.0.1','[::1]'].includes(source.hostname)) throw new Error('Persistence check requires a local source database.');
const directory=await mkdtemp(join(tmpdir(),'novaworks-persistence-')),cluster=join(directory,'cluster');
const env={...process.env,PGHOST:source.hostname,PGPORT:source.port || '5432',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),PGDATABASE:source.pathname.slice(1)};
const {stdout:dump}=await run('pg_dump',['--data-only','--table=users','--table=projects','--table=tasks','--no-owner','--no-privileges'],{env,maxBuffer:8*1024*1024});
const backup=join(directory,'records.sql');await writeFile(backup,dump,{mode:0o600});
await run('initdb',['-D',cluster,'-U','novaworks','-A','trust','--no-instructions']);
let started=false;
const psql=async args=>(await run('psql',['-X','-q','-v','ON_ERROR_STOP=1','-h',directory,'-p','55432','-U','novaworks','-d','postgres',...args])).stdout;
try {
  await run('pg_ctl',['-D',cluster,'-l',join(directory,'server.log'),'-o',`-k ${directory} -h '' -p 55432`,'-w','start']);started=true;
  await psql(['-f',fileURLToPath(new URL('../db/schema.sql',import.meta.url))]);
  await psql(['-f',backup]);
  const query="SELECT json_build_object('users',(SELECT count(*) FROM users),'projects',(SELECT json_agg(p ORDER BY p.id) FROM projects p),'tasks',(SELECT json_agg(t ORDER BY t.id) FROM tasks t));";
  const before=JSON.parse((await psql(['-t','-A','-c',query])).trim());
  assert.equal(before.users,10);assert.equal(before.projects.length,3);assert.equal(before.tasks.length,12);
  await run('pg_ctl',['-D',cluster,'-l',join(directory,'server.log'),'-w','restart']);
  const after=JSON.parse((await psql(['-t','-A','-c',query])).trim());assert.deepEqual(after,before);
  console.log('DATABASE RESTART PASS: copied actual saved records into isolated PostgreSQL, restarted it, and verified all 10 users, 3 projects and 12 tasks persisted unchanged.');
} finally {if(started) await run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);}
