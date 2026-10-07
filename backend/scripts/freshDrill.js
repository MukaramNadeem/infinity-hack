import {cp,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import dotenv from 'dotenv';
const source=fileURLToPath(new URL('..',import.meta.url));
const directory=await mkdtemp(join(tmpdir(),'novaworks-clean-'));
const envValues=dotenv.parse(await readFile(join(source,'.env'),'utf8'));
const db=new URL(envValues.DATABASE_URL);
if(!['localhost','127.0.0.1','[::1]'].includes(db.hostname)) throw new Error('Clean drill is local only.');
const run=(command,args,cwd=directory,env=process.env)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env,stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>code===0 ? resolve() : reject(new Error(command+' exited '+code)));
});
await run('psql',['-X','-w','-U','postgres','-p',db.port || '5432','-d','postgres','-f',join(source,'db/setup-verification.sql')]);
await cp(source,directory,{recursive:true,filter:path=>!['node_modules','.env'].includes(basename(path))});
db.pathname='/novaworks_verify';envValues.DATABASE_URL=db.href;
db.pathname='/novaworks_verify_test';envValues.TEST_DATABASE_URL=db.href;
envValues.PORT='4001';envValues.API_URL='http://localhost:4001';envValues.SESSION_SECRET=randomBytes(48).toString('hex');
await writeFile(join(directory,'.env'),Object.entries(envValues).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
const environment={...process.env,...envValues};
console.log('Clean installation directory:',directory);
await run('npm',['ci']);
await run('npm',['run','db:init'],directory,environment);
await run('npm',['run','db:init'],directory,environment);
await run('npm',['run','db:seed'],directory,environment);
await run('npm',['run','db:seed'],directory,environment);
await run('npm',['test'],directory,environment);
const server=spawn('node',['src/server.js'],{cwd:directory,env:environment,stdio:'inherit'});
try {
  let ready=false;
  for(let i=0;i<40;i++) {try {const response=await fetch(envValues.API_URL+'/api/health');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready) throw new Error('Clean-install API did not start.');
  await run('npm',['run','test:ai'],directory,environment);
  console.log('CLEAN INSTALL PASS: npm ci, double init/seed, offline tests, health, 3 original + 3 changed AI runs.');
} finally {server.kill('SIGTERM');}
