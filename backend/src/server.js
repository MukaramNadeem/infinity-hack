import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createApp } from './app.js';
let pool;
try {
  const config=loadConfig();
  pool=createPool(config);
  await pool.query('SELECT 1');
  const app=createApp({pool,config});
  const server=app.listen(config.port,()=>console.log(`NovaWorks API listening on port ${config.port}`));
  server.on('error',async error=>{ console.error('Server could not start:',error.code); await pool.end(); process.exitCode=1; });
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
} catch(error) { console.error(error.message?.startsWith('Missing or invalid') ? error.message : 'Startup failed: check the database configuration and service.'); if(pool) await pool.end(); process.exitCode=1; }
